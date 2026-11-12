import { EstadoCompra } from "@ai-ticket-it/shared";
import { describe, expect, it, vi } from "vitest";
import type { Compra } from "../../src/domain/compra";
import type { Evento } from "../../src/domain/evento";
import {
  CompraNoEncontradaError,
  NoEncontradoError,
  ReferenciaInvalidaError,
  SinPermisoError,
} from "../../src/errors/index";
import { AHORA, DIA, compra, evento, relojFijo, relojMovible, tipo } from "../helpers/eventos";
import { crearServicesDeEventos } from "../helpers/services-de-eventos";

const MINUTO = 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const general = tipo({ id: "tipo-a-general", nombre: "General", precio: 45000, cupo: 10 });
const vip = tipo({ id: "tipo-a-vip", nombre: "VIP", precio: 120000, cupo: 50 });
const backstage = tipo({ id: "tipo-a-backstage", nombre: "Backstage", precio: 300000, cupo: 3 });
const kids = tipo({ id: "tipo-a-kids", nombre: "Carrera kids", precio: 0, cupo: 20 });

/** El Festival de Lucía (en 5 días), otro evento de Martín y un evento ya realizado de Lucía. */
function armar({ compras = [] as Compra[], eventos = [] as Evento[], reloj = relojFijo() } = {}) {
  return crearServicesDeEventos({
    eventos: [
      evento({ id: "evento-a", nombre: "Festival", tiposEntrada: [general, vip, backstage, kids] }),
      evento({
        id: "evento-b",
        organizadorId: "usuario-martin",
        tiposEntrada: [tipo({ id: "tipo-b-platea", nombre: "Platea" })],
      }),
      evento({ id: "evento-pasado", en: -DIA, tiposEntrada: [tipo({ id: "tipo-pasado-general" })] }),
      ...eventos,
    ],
    compras,
    reloj,
  });
}

async function cupoDe(
  repositorioEventos: { buscarPorId(id: string): Promise<Evento | null> },
  tipoId: string,
) {
  return (await repositorioEventos.buscarPorId("evento-a"))?.buscarTipoEntrada(tipoId)?.cupo;
}

describe("CompraService.crear", () => {
  it("registra PENDIENTE con el total del servidor, descuenta el cupo y devuelve la vista", async () => {
    const { compraService, repositorioEventos, repositorioCompras } = armar();

    const vista = await compraService.crear("evento-a", "usuario-sofia", {
      tipoEntradaId: "tipo-a-vip",
      cantidad: 2,
    });

    expect(vista).toEqual({
      id: expect.stringMatching(UUID),
      compradorId: "usuario-sofia",
      evento: {
        id: "evento-a",
        nombre: "Festival",
        fechaHora: "2026-11-15T15:00:00.000Z",
        fechaHoraLocal: "2026-11-15T12:00",
        realizado: false,
      },
      tipoEntrada: { id: "tipo-a-vip", nombre: "VIP" },
      cantidad: 2,
      total: 240000,
      estado: EstadoCompra.PENDIENTE,
      creadaEn: "2026-11-10T15:00:00.000Z",
      venceEn: "2026-11-10T15:15:00.000Z",
      venceEnLocal: "2026-11-10T12:15",
      historial: [
        {
          estado: EstadoCompra.PENDIENTE,
          autor: { tipo: "usuario", usuarioId: "usuario-sofia" },
          fechaHora: "2026-11-10T15:00:00.000Z",
          fechaHoraLocal: "2026-11-10T12:00",
        },
      ],
    });
    expect(await cupoDe(repositorioEventos, "tipo-a-vip")).toBe(48);
    const guardada = await repositorioCompras.buscarPorId(vista.id);
    expect(guardada).toMatchObject({ estado: EstadoCompra.PENDIENTE, total: 240000, cantidad: 2 });
  });

  it("el cupo justo deja el tipo en 0", async () => {
    const { compraService, repositorioEventos } = armar();
    await compraService.crear("evento-a", "usuario-diego", {
      tipoEntradaId: "tipo-a-backstage",
      cantidad: 3,
    });
    expect(await cupoDe(repositorioEventos, "tipo-a-backstage")).toBe(0);
  });

  it("un tipo gratis da total 0", async () => {
    const { compraService } = armar();
    const vista = await compraService.crear("evento-a", "usuario-sofia", {
      tipoEntradaId: "tipo-a-kids",
      cantidad: 1,
    });
    expect(vista.total).toBe(0);
  });

  it("un mismo comprador puede hacer varias compras del mismo tipo (FR-010)", async () => {
    const { compraService, repositorioCompras } = armar();
    await compraService.crear("evento-a", "usuario-sofia", { tipoEntradaId: "tipo-a-vip", cantidad: 1 });
    await compraService.crear("evento-a", "usuario-sofia", { tipoEntradaId: "tipo-a-vip", cantidad: 1 });
    expect(await repositorioCompras.listarPorEventoYComprador("evento-a", "usuario-sofia")).toHaveLength(2);
  });

  describe("orden de los rechazos (R2): con dos a la vez, gana el primero", () => {
    /** Ejecuta el alta y verifica el error, y que el cupo y las compras quedaron igual. */
    async function rechazo(
      servicios: ReturnType<typeof armar>,
      [eventoId, compradorId, tipoEntradaId, cantidad]: [string, string, string, number],
      esperado: object,
    ) {
      const { compraService, repositorioEventos, repositorioCompras } = servicios;
      const cuposAntes = (await repositorioEventos.listar()).map((e) => e.tiposEntrada.map((t) => t.cupo));
      const comprasAntes = await repositorioCompras.listarPendientesPorEventos(["evento-a", "evento-pasado"]);
      await expect(
        compraService.crear(eventoId, compradorId, { tipoEntradaId, cantidad }),
      ).rejects.toMatchObject(esperado);
      expect((await repositorioEventos.listar()).map((e) => e.tiposEntrada.map((t) => t.cupo))).toEqual(
        cuposAntes,
      );
      expect(await repositorioCompras.listarPendientesPorEventos(["evento-a", "evento-pasado"])).toEqual(
        comprasAntes,
      );
    }

    it("404 del evento antes que el tipo inexistente", async () => {
      const servicios = armar();
      await expect(
        servicios.compraService.crear("evento-x", "usuario-sofia", {
          tipoEntradaId: "tipo-nada",
          cantidad: 1,
        }),
      ).rejects.toBeInstanceOf(NoEncontradoError);
      await rechazo(servicios, ["evento-x", "usuario-sofia", "tipo-nada", 1], {
        codigo: "EVENTO_NO_ENCONTRADO",
      });
    });

    it("el tipo de otro evento (400 sobre tipoEntradaId) antes que EVENTO_REALIZADO", async () => {
      const servicios = armar();
      await expect(
        servicios.compraService.crear("evento-pasado", "usuario-sofia", {
          tipoEntradaId: "tipo-b-platea",
          cantidad: 1,
        }),
      ).rejects.toBeInstanceOf(ReferenciaInvalidaError);
      await rechazo(servicios, ["evento-pasado", "usuario-sofia", "tipo-b-platea", 1], {
        campo: "tipoEntradaId",
        mensaje: "No existe el tipo de entrada en este evento.",
      });
    });

    it("EVENTO_REALIZADO antes que COMPRA_PROPIO_EVENTO", async () => {
      await rechazo(armar(), ["evento-pasado", "usuario-lucia", "tipo-pasado-general", 1], {
        codigo: "EVENTO_REALIZADO",
        message: "El evento ya se realizó: no se pueden comprar entradas.",
      });
    });

    it("COMPRA_PROPIO_EVENTO antes que TOPE_POR_PERSONA", async () => {
      const servicios = armar({
        compras: [
          compra("evento-a", "tipo-a-vip", EstadoCompra.CONFIRMADA, {
            id: "compra-lucia",
            compradorId: "usuario-lucia",
            cantidad: 4,
          }),
        ],
      });
      await rechazo(servicios, ["evento-a", "usuario-lucia", "tipo-a-vip", 1], {
        codigo: "COMPRA_PROPIO_EVENTO",
      });
    });

    it("TOPE_POR_PERSONA antes que CUPO_INSUFICIENTE", async () => {
      const servicios = armar({
        compras: [
          compra("evento-a", "tipo-a-vip", EstadoCompra.CONFIRMADA, { id: "compra-martin", cantidad: 3 }),
        ],
      });
      await rechazo(servicios, ["evento-a", "usuario-martin", "tipo-a-backstage", 4], {
        codigo: "TOPE_POR_PERSONA",
        message: "Podés comprar 1 entrada más de tipos pagos de este evento.",
      });
    });

    it("CUPO_INSUFICIENTE con las que quedan", async () => {
      await rechazo(armar(), ["evento-a", "usuario-sofia", "tipo-a-backstage", 4], {
        codigo: "CUPO_INSUFICIENTE",
        message: "Quedan 3 entradas de «Backstage».",
      });
    });
  });

  it("el tope cuenta solo las vigentes: con una pendiente de 4 vencida se pueden comprar 4 más, con su cupo devuelto antes", async () => {
    const reloj = relojMovible();
    const servicios = armar({
      reloj,
      eventos: [
        evento({
          id: "evento-c",
          tiposEntrada: [tipo({ id: "tipo-c-vip", nombre: "VIP", precio: 1000, cupo: 0 })],
        }),
      ],
      compras: [
        compra("evento-c", "tipo-c-vip", EstadoCompra.PENDIENTE, { id: "compra-vencida", cantidad: 4 }),
        compra("evento-c", "tipo-c-vip", EstadoCompra.CANCELADA, { id: "compra-cancelada", cantidad: 4 }),
      ],
    });
    reloj.avanzar(15 * MINUTO);

    await servicios.compraService.crear("evento-c", "usuario-martin", {
      tipoEntradaId: "tipo-c-vip",
      cantidad: 4,
    });

    expect((await servicios.repositorioCompras.buscarPorId("compra-vencida"))?.fueVencida()).toBe(true);
    expect(
      (await servicios.repositorioEventos.buscarPorId("evento-c"))?.buscarTipoEntrada("tipo-c-vip")?.cupo,
    ).toBe(0);
  });

  it("corre dentro del cerrojo del evento y lee el reloj una sola vez", async () => {
    const reloj = relojFijo();
    const { compraService, cerrojo } = armar({ reloj });
    const ejecutar = vi.spyOn(cerrojo, "ejecutar");
    const ahora = vi.spyOn(reloj, "ahora");
    await compraService.crear("evento-a", "usuario-sofia", { tipoEntradaId: "tipo-a-vip", cantidad: 1 });
    expect(ejecutar).toHaveBeenCalledTimes(1);
    expect(ejecutar).toHaveBeenCalledWith("evento-a", expect.any(Function));
    expect(ahora).toHaveBeenCalledTimes(1);
  });

  it("guarda el evento antes que la compra (R8)", async () => {
    const { compraService, repositorioEventos, repositorioCompras } = armar();
    const guardarEvento = vi.spyOn(repositorioEventos, "guardar");
    const guardarCompra = vi.spyOn(repositorioCompras, "guardar");
    await compraService.crear("evento-a", "usuario-sofia", { tipoEntradaId: "tipo-a-vip", cantidad: 1 });
    expect(guardarEvento).toHaveBeenCalledTimes(1);
    expect(guardarCompra).toHaveBeenCalledTimes(1);
    expect(guardarEvento.mock.invocationCallOrder[0]!).toBeLessThan(
      guardarCompra.mock.invocationCallOrder[0]!,
    );
  });
});

describe("CompraService.obtenerOFallar", () => {
  it("devuelve la compra o lanza COMPRA_NO_ENCONTRADA", async () => {
    const existente = compra("evento-a", "tipo-a-vip", EstadoCompra.CONFIRMADA, { id: "compra-1" });
    const { compraService } = armar({ compras: [existente] });
    expect(await compraService.obtenerOFallar("compra-1")).toBe(existente);
    await expect(compraService.obtenerOFallar("compra-x")).rejects.toBeInstanceOf(CompraNoEncontradaError);
    await expect(compraService.obtenerOFallar("compra-x")).rejects.toMatchObject({
      codigo: "COMPRA_NO_ENCONTRADA",
      mensaje: "No existe la compra.",
    });
  });
});

describe("CompraService.misComprasDelEvento", () => {
  const deSofia = (id: string, estado: EstadoCompra, creadaEn: Date, cambios = {}) =>
    compra("evento-a", "tipo-a-vip", estado, { id, compradorId: "usuario-sofia", creadaEn, ...cambios });
  const hace = (minutos: number) => new Date(AHORA.getTime() - minutos * MINUTO);

  it("404 si el evento no existe", async () => {
    await expect(
      armar().compraService.misComprasDelEvento("evento-x", "usuario-sofia"),
    ).rejects.toMatchObject({
      codigo: "EVENTO_NO_ENCONTRADO",
    });
  });

  it("pendientes: solo sus PENDIENTE no vencidas de ese evento, de la más vieja a la más nueva", async () => {
    const { compraService } = armar({
      compras: [
        deSofia("nueva", EstadoCompra.PENDIENTE, hace(5)),
        deSofia("vieja", EstadoCompra.PENDIENTE, hace(10)),
        deSofia("vencida", EstadoCompra.PENDIENTE, hace(15)),
        deSofia("confirmada", EstadoCompra.CONFIRMADA, hace(30)),
        compra("evento-a", "tipo-a-vip", EstadoCompra.PENDIENTE, { id: "de-martin", creadaEn: hace(1) }),
        compra("evento-b", "tipo-b-platea", EstadoCompra.PENDIENTE, {
          id: "de-otro-evento",
          compradorId: "usuario-sofia",
          creadaEn: hace(1),
        }),
      ],
    });
    const { pendientes } = await compraService.misComprasDelEvento("evento-a", "usuario-sofia");
    expect(pendientes.map((c) => c.id)).toEqual(["vieja", "nueva"]);
    expect(pendientes[0]).toMatchObject({ estado: EstadoCompra.PENDIENTE, tipoEntrada: { nombre: "VIP" } });
  });

  it("confirmadas: solo sus CONFIRMADA de ese evento, de la más nueva a la más vieja", async () => {
    const { compraService } = armar({
      compras: [
        deSofia("vieja", EstadoCompra.CONFIRMADA, hace(60)),
        deSofia("nueva", EstadoCompra.CONFIRMADA, hace(20)),
        deSofia("pendiente", EstadoCompra.PENDIENTE, hace(5)),
        deSofia("cancelada", EstadoCompra.CANCELADA, hace(40)),
        compra("evento-a", "tipo-a-vip", EstadoCompra.CONFIRMADA, { id: "de-martin", creadaEn: hace(1) }),
        compra("evento-b", "tipo-b-platea", EstadoCompra.CONFIRMADA, {
          id: "de-otro-evento",
          compradorId: "usuario-sofia",
          creadaEn: hace(1),
        }),
      ],
    });
    const { confirmadas } = await compraService.misComprasDelEvento("evento-a", "usuario-sofia");
    expect(confirmadas.map((c) => c.id)).toEqual(["nueva", "vieja"]);
    expect(confirmadas[0]).toMatchObject({ estado: EstadoCompra.CONFIRMADA, tipoEntrada: { nombre: "VIP" } });
  });

  it("restantesPorTipo: uno por tipo, en el orden del evento, según sus vigentes", async () => {
    const { compraService } = armar({
      compras: [
        deSofia("confirmada", EstadoCompra.CONFIRMADA, hace(30), { cantidad: 2, total: 240000 }),
        deSofia("pendiente", EstadoCompra.PENDIENTE, hace(5)),
        deSofia("vencida", EstadoCompra.PENDIENTE, hace(15), { cantidad: 4 }),
        compra("evento-a", "tipo-a-kids", EstadoCompra.CONFIRMADA, {
          id: "kids",
          compradorId: "usuario-sofia",
          total: 0,
        }),
      ],
    });
    expect((await compraService.misComprasDelEvento("evento-a", "usuario-sofia")).restantesPorTipo).toEqual([
      { tipoEntradaId: "tipo-a-general", restantes: 1 },
      { tipoEntradaId: "tipo-a-vip", restantes: 1 },
      { tipoEntradaId: "tipo-a-backstage", restantes: 1 },
      { tipoEntradaId: "tipo-a-kids", restantes: 0 },
    ]);
  });

  it("para el organizador, 0 en todos los tipos", async () => {
    const { restantesPorTipo } = await armar().compraService.misComprasDelEvento("evento-a", "usuario-lucia");
    expect(restantesPorTipo.map((r) => r.restantes)).toEqual([0, 0, 0, 0]);
  });

  it("con el evento realizado se calcula igual", async () => {
    const { restantesPorTipo } = await armar().compraService.misComprasDelEvento(
      "evento-pasado",
      "usuario-sofia",
    );
    expect(restantesPorTipo).toEqual([{ tipoEntradaId: "tipo-pasado-general", restantes: 4 }]);
  });

  it("no toma el cerrojo ni guarda nada (tampoco materializa las vencidas)", async () => {
    const { compraService, cerrojo, repositorioEventos, repositorioCompras } = armar({
      compras: [deSofia("vencida", EstadoCompra.PENDIENTE, hace(15))],
    });
    const ejecutar = vi.spyOn(cerrojo, "ejecutar");
    const guardarEvento = vi.spyOn(repositorioEventos, "guardar");
    const guardarCompra = vi.spyOn(repositorioCompras, "guardar");
    await compraService.misComprasDelEvento("evento-a", "usuario-sofia");
    expect(ejecutar).not.toHaveBeenCalled();
    expect(guardarEvento).not.toHaveBeenCalled();
    expect(guardarCompra).not.toHaveBeenCalled();
  });
});

describe("CompraService.obtener", () => {
  const deSofia = (estado = EstadoCompra.PENDIENTE) =>
    compra("evento-a", "tipo-a-vip", estado, {
      id: "compra-sofia",
      compradorId: "usuario-sofia",
      cantidad: 2,
    });

  it("404 COMPRA_NO_ENCONTRADA si no existe", async () => {
    await expect(armar().compraService.obtener("compra-x", "usuario-sofia")).rejects.toBeInstanceOf(
      CompraNoEncontradaError,
    );
  });

  it("403 SIN_PERMISO si no es su comprador", async () => {
    const { compraService } = armar({ compras: [deSofia()] });
    await expect(compraService.obtener("compra-sofia", "usuario-diego")).rejects.toBeInstanceOf(
      SinPermisoError,
    );
    await expect(compraService.obtener("compra-sofia", "usuario-diego")).rejects.toMatchObject({
      codigo: "SIN_PERMISO",
      mensaje: "Solo quien hizo la compra puede verla o pagarla.",
    });
  });

  it("su comprador la ve con el evento y el tipo", async () => {
    const vista = await armar({ compras: [deSofia()] }).compraService.obtener(
      "compra-sofia",
      "usuario-sofia",
    );
    expect(vista).toMatchObject({
      id: "compra-sofia",
      estado: EstadoCompra.PENDIENTE,
      evento: { id: "evento-a", nombre: "Festival", realizado: false },
      tipoEntrada: { id: "tipo-a-vip", nombre: "VIP" },
      venceEn: "2026-11-10T15:15:00.000Z",
    });
  });

  it("al día: una pendiente vencida se ve CANCELADA por el sistema en venceEn, sin guardar nada", async () => {
    const reloj = relojMovible();
    const { compraService, repositorioCompras, repositorioEventos, cerrojo } = armar({
      reloj,
      compras: [deSofia()],
    });
    reloj.avanzar(20 * MINUTO);
    const guardarCompra = vi.spyOn(repositorioCompras, "guardar");
    const guardarEvento = vi.spyOn(repositorioEventos, "guardar");
    const ejecutar = vi.spyOn(cerrojo, "ejecutar");

    const vista = await compraService.obtener("compra-sofia", "usuario-sofia");

    expect(vista.estado).toBe(EstadoCompra.CANCELADA);
    expect(vista.venceEn).toBeNull();
    expect(vista.venceEnLocal).toBeNull();
    expect(vista.historial.at(-1)).toEqual({
      estado: EstadoCompra.CANCELADA,
      autor: { tipo: "sistema" },
      fechaHora: "2026-11-10T15:15:00.000Z",
      fechaHoraLocal: "2026-11-10T12:15",
    });
    expect(guardarCompra).not.toHaveBeenCalled();
    expect(guardarEvento).not.toHaveBeenCalled();
    expect(ejecutar).not.toHaveBeenCalled();
    expect((await repositorioCompras.buscarPorId("compra-sofia"))?.estado).toBe(EstadoCompra.PENDIENTE);
  });
});

describe("CompraService.pagar", () => {
  const deSofia = () =>
    compra("evento-a", "tipo-a-vip", EstadoCompra.PENDIENTE, {
      id: "compra-sofia",
      compradorId: "usuario-sofia",
      cantidad: 2,
      total: 240000,
    });

  it("404 COMPRA_NO_ENCONTRADA si no existe", async () => {
    await expect(armar().compraService.pagar("compra-x", "usuario-sofia")).rejects.toBeInstanceOf(
      CompraNoEncontradaError,
    );
  });

  it("403 SIN_PERMISO si no es su comprador, sin cambiar nada", async () => {
    const { compraService, repositorioCompras } = armar({ compras: [deSofia()] });
    await expect(compraService.pagar("compra-sofia", "usuario-diego")).rejects.toMatchObject({
      codigo: "SIN_PERMISO",
      mensaje: "Solo quien hizo la compra puede verla o pagarla.",
    });
    const guardada = await repositorioCompras.buscarPorId("compra-sofia");
    expect(guardada?.estado).toBe(EstadoCompra.PENDIENTE);
    expect(guardada?.historial).toHaveLength(1);
  });

  it("la pasa a CONFIRMADA por el comprador, la guarda y devuelve la vista", async () => {
    const reloj = relojMovible();
    const { compraService, repositorioCompras } = armar({ reloj, compras: [deSofia()] });
    reloj.avanzar(5 * MINUTO);

    const vista = await compraService.pagar("compra-sofia", "usuario-sofia");

    expect(vista).toMatchObject({ estado: EstadoCompra.CONFIRMADA, venceEn: null, venceEnLocal: null });
    expect(vista.historial).toEqual([
      expect.objectContaining({ estado: EstadoCompra.PENDIENTE }),
      {
        estado: EstadoCompra.CONFIRMADA,
        autor: { tipo: "usuario", usuarioId: "usuario-sofia" },
        fechaHora: "2026-11-10T15:05:00.000Z",
        fechaHoraLocal: "2026-11-10T12:05",
      },
    ]);
    expect((await repositorioCompras.buscarPorId("compra-sofia"))?.estado).toBe(EstadoCompra.CONFIRMADA);
  });

  it("pagar dos veces → TRANSICION_INVALIDA la segunda", async () => {
    const { compraService } = armar({ compras: [deSofia()] });
    await compraService.pagar("compra-sofia", "usuario-sofia");
    await expect(compraService.pagar("compra-sofia", "usuario-sofia")).rejects.toMatchObject({
      codigo: "TRANSICION_INVALIDA",
    });
  });

  it("con el reloj 15 minutos después → COMPRA_VENCIDA; queda CANCELADA del sistema y su cupo vuelve", async () => {
    const reloj = relojMovible();
    const { compraService, repositorioCompras, repositorioEventos } = armar({ reloj, compras: [deSofia()] });
    reloj.avanzar(15 * MINUTO);

    await expect(compraService.pagar("compra-sofia", "usuario-sofia")).rejects.toMatchObject({
      codigo: "COMPRA_VENCIDA",
      message: "La compra venció: pasaron 15 minutos sin pagarla.",
    });
    expect((await repositorioCompras.buscarPorId("compra-sofia"))?.fueVencida()).toBe(true);
    expect(await cupoDe(repositorioEventos, "tipo-a-vip")).toBe(52);
  });

  it("con el evento ya empezado y la compra sin vencer → CONFIRMADA (R9)", async () => {
    const empieza = new Date(AHORA.getTime() + 5 * MINUTO);
    const reloj = relojMovible();
    const { compraService } = armar({
      reloj,
      eventos: [evento({ id: "evento-c", en: 5 * MINUTO, tiposEntrada: [tipo({ id: "tipo-c-general" })] })],
      compras: [
        compra("evento-c", "tipo-c-general", EstadoCompra.PENDIENTE, {
          id: "compra-c",
          compradorId: "usuario-sofia",
        }),
      ],
    });
    reloj.avanzar(10 * MINUTO);
    expect(reloj.ahora().getTime()).toBeGreaterThan(empieza.getTime());

    const vista = await compraService.pagar("compra-c", "usuario-sofia");

    expect(vista.estado).toBe(EstadoCompra.CONFIRMADA);
    expect(vista.evento.realizado).toBe(true);
  });

  it("toma el cerrojo del evento de la compra y relee la compra adentro", async () => {
    const { compraService, cerrojo, repositorioCompras } = armar({ compras: [deSofia()] });
    const ejecutar = vi.spyOn(cerrojo, "ejecutar");
    const buscar = vi.spyOn(repositorioCompras, "buscarPorId");

    await compraService.pagar("compra-sofia", "usuario-sofia");

    expect(ejecutar).toHaveBeenCalledTimes(1);
    expect(ejecutar).toHaveBeenCalledWith("evento-a", expect.any(Function));
    // Una lectura afuera (para saber qué cerrojo tomar) y la relectura adentro.
    const [afuera, adentro] = buscar.mock.invocationCallOrder;
    expect(afuera!).toBeLessThan(ejecutar.mock.invocationCallOrder[0]!);
    expect(adentro!).toBeGreaterThan(ejecutar.mock.invocationCallOrder[0]!);
    expect(buscar).toHaveBeenCalledTimes(2);
  });
});

describe("CompraService.cancelar (corrección de la 006)", () => {
  const deSofia = () =>
    compra("evento-a", "tipo-a-vip", EstadoCompra.PENDIENTE, {
      id: "compra-sofia",
      compradorId: "usuario-sofia",
      cantidad: 2,
      total: 240000,
    });
  // El cupo de VIP del evento ya tiene descontadas las 2 de la pendiente: 50 → 52 al devolverlas.

  it("404 COMPRA_NO_ENCONTRADA si no existe", async () => {
    await expect(armar().compraService.cancelar("compra-x", "usuario-sofia")).rejects.toBeInstanceOf(
      CompraNoEncontradaError,
    );
  });

  it("403 SIN_PERMISO si no es su comprador, sin cambiar nada", async () => {
    const { compraService, repositorioCompras, repositorioEventos } = armar({ compras: [deSofia()] });
    await expect(compraService.cancelar("compra-sofia", "usuario-diego")).rejects.toBeInstanceOf(
      SinPermisoError,
    );
    expect((await repositorioCompras.buscarPorId("compra-sofia"))?.estado).toBe(EstadoCompra.PENDIENTE);
    expect(await cupoDe(repositorioEventos, "tipo-a-vip")).toBe(50);
  });

  it("la pasa a CANCELADA por el comprador, devuelve su cupo y la vista", async () => {
    const reloj = relojMovible();
    const { compraService, repositorioCompras, repositorioEventos } = armar({ reloj, compras: [deSofia()] });
    reloj.avanzar(5 * MINUTO);

    const vista = await compraService.cancelar("compra-sofia", "usuario-sofia");

    expect(vista).toMatchObject({ estado: EstadoCompra.CANCELADA, venceEn: null });
    expect(vista.historial.at(-1)).toEqual({
      estado: EstadoCompra.CANCELADA,
      autor: { tipo: "usuario", usuarioId: "usuario-sofia" },
      fechaHora: "2026-11-10T15:05:00.000Z",
      fechaHoraLocal: "2026-11-10T12:05",
    });
    expect((await repositorioCompras.buscarPorId("compra-sofia"))?.estado).toBe(EstadoCompra.CANCELADA);
    expect(await cupoDe(repositorioEventos, "tipo-a-vip")).toBe(52);
    const { pendientes } = await compraService.misComprasDelEvento("evento-a", "usuario-sofia");
    expect(pendientes).toEqual([]);
  });

  it("cancelar dos veces → TRANSICION_INVALIDA y el cupo vuelve una sola vez", async () => {
    const { compraService, repositorioEventos } = armar({ compras: [deSofia()] });
    await compraService.cancelar("compra-sofia", "usuario-sofia");
    await expect(compraService.cancelar("compra-sofia", "usuario-sofia")).rejects.toMatchObject({
      codigo: "TRANSICION_INVALIDA",
    });
    expect(await cupoDe(repositorioEventos, "tipo-a-vip")).toBe(52);
  });

  it("una CONFIRMADA → TRANSICION_INVALIDA (cancelarla con reembolso es de la 009)", async () => {
    const { compraService } = armar({ compras: [deSofia()] });
    await compraService.pagar("compra-sofia", "usuario-sofia");
    await expect(compraService.cancelar("compra-sofia", "usuario-sofia")).rejects.toMatchObject({
      codigo: "TRANSICION_INVALIDA",
    });
  });

  it("con el reloj 15 minutos después → COMPRA_VENCIDA y el cupo vuelve una sola vez (por el vencimiento)", async () => {
    const reloj = relojMovible();
    const { compraService, repositorioCompras, repositorioEventos } = armar({ reloj, compras: [deSofia()] });
    reloj.avanzar(15 * MINUTO);
    await expect(compraService.cancelar("compra-sofia", "usuario-sofia")).rejects.toMatchObject({
      codigo: "COMPRA_VENCIDA",
    });
    expect((await repositorioCompras.buscarPorId("compra-sofia"))?.fueVencida()).toBe(true);
    expect(await cupoDe(repositorioEventos, "tipo-a-vip")).toBe(52);
  });

  it("toma el cerrojo del evento y guarda la compra antes que el evento", async () => {
    const { compraService, cerrojo, repositorioCompras, repositorioEventos } = armar({
      compras: [deSofia()],
    });
    const ejecutar = vi.spyOn(cerrojo, "ejecutar");
    const guardarCompra = vi.spyOn(repositorioCompras, "guardar");
    const guardarEvento = vi.spyOn(repositorioEventos, "guardar");

    await compraService.cancelar("compra-sofia", "usuario-sofia");

    expect(ejecutar).toHaveBeenCalledWith("evento-a", expect.any(Function));
    expect(guardarCompra.mock.invocationCallOrder[0]!).toBeLessThan(
      guardarEvento.mock.invocationCallOrder[0]!,
    );
  });
});
