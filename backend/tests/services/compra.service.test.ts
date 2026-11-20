import { EstadoCompra } from "@ai-ticket-it/shared";
import { describe, expect, it, vi } from "vitest";
import type { CambioEstadoCompra, Compra } from "../../src/domain/compra";
import type { Evento } from "../../src/domain/evento";
import { Usuario } from "../../src/domain/usuario";
import {
  CompraNoEncontradaError,
  NoEncontradoError,
  ReferenciaInvalidaError,
  SinPermisoError,
} from "../../src/errors/index";
import { AHORA, DIA, compra, evento, lucia, relojFijo, relojMovible, tipo } from "../helpers/eventos";
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
      entradas: [],
      entradasUsadas: 0,
      canceladaDesde: null,
      reembolso: null,
      cancelable: true,
      motivoNoCancelable: null,
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

  it("la compra guardada tiene una entrada por unidad con los códigos que dio el repositorio (008)", async () => {
    const { compraService, repositorioCompras } = armar();
    const siguientesCodigos = vi.spyOn(repositorioCompras, "siguientesCodigosDeEntrada");

    const vista = await compraService.crear("evento-a", "usuario-sofia", {
      tipoEntradaId: "tipo-a-vip",
      cantidad: 3,
    });

    expect(siguientesCodigos).toHaveBeenCalledTimes(1);
    expect(siguientesCodigos).toHaveBeenCalledWith(3);
    const guardada = await repositorioCompras.buscarPorId(vista.id);
    expect(guardada?.entradas.map((entrada) => entrada.codigo)).toEqual(
      siguientesCodigos.mock.results[0]?.value,
    );
    expect(guardada?.entradas).toHaveLength(3);
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

  it("una CONFIRMADA antes del inicio se cancela (desde la 009); una segunda vez → TRANSICION_INVALIDA", async () => {
    const { compraService } = armar({ compras: [deSofia()] });
    await compraService.pagar("compra-sofia", "usuario-sofia");
    expect(await compraService.cancelar("compra-sofia", "usuario-sofia")).toMatchObject({
      estado: EstadoCompra.CANCELADA,
      canceladaDesde: "CONFIRMADA",
    });
    await expect(compraService.cancelar("compra-sofia", "usuario-sofia")).rejects.toMatchObject({
      codigo: "TRANSICION_INVALIDA",
      message: "La compra ya está cancelada.",
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

describe("CompraService.misCompras (feature 007)", () => {
  const hace = (minutos: number) => new Date(AHORA.getTime() - minutos * MINUTO);
  const deSofia = (
    id: string,
    eventoId: string,
    tipoEntradaId: string,
    estado: EstadoCompra,
    cambios: { creadaEn?: Date; cantidad?: number; total?: number; historial?: CambioEstadoCompra[] } = {},
  ) => compra(eventoId, tipoEntradaId, estado, { id, compradorId: "usuario-sofia", ...cambios });
  /** Una pendiente de Sofía que venció y ya se materializó (CANCELADA por el sistema en venceEn). */
  const vencidaMaterializada = (id: string) =>
    deSofia(id, "evento-a", "tipo-a-vip", EstadoCompra.CANCELADA, {
      historial: [
        {
          estado: EstadoCompra.PENDIENTE,
          autor: { tipo: "usuario", usuarioId: "usuario-sofia" },
          fechaHora: hace(60),
        },
        { estado: EstadoCompra.CANCELADA, autor: { tipo: "sistema" }, fechaHora: hace(45) },
      ],
    });

  it("trae solo las compras del usuario como comprador, de todos los eventos y estados, una vista por compra", async () => {
    const { compraService } = armar({
      compras: [
        deSofia("pendiente", "evento-a", "tipo-a-vip", EstadoCompra.PENDIENTE),
        deSofia("vip-1", "evento-a", "tipo-a-vip", EstadoCompra.CONFIRMADA, { creadaEn: hace(30) }),
        deSofia("vip-2", "evento-a", "tipo-a-vip", EstadoCompra.CONFIRMADA, { creadaEn: hace(20) }),
        deSofia("en-evento-de-martin", "evento-b", "tipo-b-platea", EstadoCompra.CANCELADA),
        compra("evento-a", "tipo-a-general", EstadoCompra.CONFIRMADA, { id: "de-martin" }),
      ],
    });

    const deSofiaVistas = await compraService.misCompras("usuario-sofia");
    expect(deSofiaVistas.map((c) => c.id).toSorted()).toEqual(
      ["en-evento-de-martin", "pendiente", "vip-1", "vip-2"].toSorted(),
    );

    // Martín organiza evento-b: la compra de Sofía en él no es suya.
    expect((await compraService.misCompras("usuario-martin")).map((c) => c.id)).toEqual(["de-martin"]);
    expect(await compraService.misCompras("usuario-diego")).toEqual([]);
  });

  it("la vista no tiene historial ni compradorId y sí los campos de MiCompraVista", async () => {
    const { compraService } = armar({
      compras: [
        deSofia("vip", "evento-a", "tipo-a-vip", EstadoCompra.CONFIRMADA, { cantidad: 2, total: 240000 }),
      ],
    });
    const [vista] = await compraService.misCompras("usuario-sofia");
    expect(vista).toEqual({
      id: "vip",
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
      estado: EstadoCompra.CONFIRMADA,
      creadaEn: "2026-11-10T15:00:00.000Z",
      venceEn: null,
      venceEnLocal: null,
      diasRestantes: 5,
      canceladaPor: null,
      entradasUsadas: 0,
      canceladaDesde: null,
      reembolso: null,
    });
    expect(vista).not.toHaveProperty("historial");
    expect(vista).not.toHaveProperty("compradorId");
  });

  it("nombre y fecha del evento y nombre del tipo actuales; cantidad y total, los de la compra (FR-004)", async () => {
    const { compraService, repositorioEventos } = armar({
      compras: [
        deSofia("vip", "evento-a", "tipo-a-vip", EstadoCompra.CONFIRMADA, { cantidad: 2, total: 240000 }),
      ],
    });
    await repositorioEventos.guardar(
      evento({
        id: "evento-a",
        nombre: "Festival renombrado",
        en: 7 * DIA,
        tiposEntrada: [tipo({ id: "tipo-a-vip", nombre: "Platino", precio: 1, cupo: 50 })],
      }),
    );

    const [vista] = await compraService.misCompras("usuario-sofia");
    expect(vista).toMatchObject({
      evento: { nombre: "Festival renombrado", fechaHora: "2026-11-17T15:00:00.000Z" },
      tipoEntrada: { id: "tipo-a-vip", nombre: "Platino" },
      cantidad: 2,
      total: 240000,
    });
  });

  it("al día: una PENDIENTE con los 15 minutos cumplidos sale CANCELADA por el sistema, sin guardar nada", async () => {
    const reloj = relojMovible();
    const { compraService, repositorioCompras, repositorioEventos } = armar({
      reloj,
      compras: [deSofia("pendiente", "evento-a", "tipo-a-vip", EstadoCompra.PENDIENTE, { cantidad: 2 })],
    });
    const cupoAntes = await cupoDe(repositorioEventos, "tipo-a-vip");

    reloj.avanzar(15 * MINUTO - 1);
    expect((await compraService.misCompras("usuario-sofia"))[0]).toMatchObject({
      estado: EstadoCompra.PENDIENTE,
      venceEn: "2026-11-10T15:15:00.000Z",
      venceEnLocal: "2026-11-10T12:15",
      canceladaPor: null,
    });

    reloj.avanzar(1);
    expect((await compraService.misCompras("usuario-sofia"))[0]).toMatchObject({
      estado: EstadoCompra.CANCELADA,
      venceEn: null,
      venceEnLocal: null,
      canceladaPor: "sistema",
    });
    expect((await repositorioCompras.buscarPorId("pendiente"))?.estado).toBe(EstadoCompra.PENDIENTE);
    expect(await cupoDe(repositorioEventos, "tipo-a-vip")).toBe(cupoAntes);
  });

  it("canceladaPor: sistema si venció (también ya materializada), usuario si la canceló (también en REEMBOLSADA, 009); null en otro estado", async () => {
    const { compraService } = armar({
      compras: [
        vencidaMaterializada("vencida"),
        deSofia("por-ella", "evento-a", "tipo-a-vip", EstadoCompra.CANCELADA),
        deSofia("pendiente", "evento-a", "tipo-a-vip", EstadoCompra.PENDIENTE),
        deSofia("confirmada", "evento-a", "tipo-a-vip", EstadoCompra.CONFIRMADA),
        deSofia("utilizada", "evento-a", "tipo-a-vip", EstadoCompra.UTILIZADA),
        deSofia("reembolsada", "evento-a", "tipo-a-vip", EstadoCompra.REEMBOLSADA),
      ],
    });
    const vistas = await compraService.misCompras("usuario-sofia");
    const porId = new Map(vistas.map((v) => [v.id, v]));

    expect(porId.get("vencida")).toMatchObject({ estado: EstadoCompra.CANCELADA, canceladaPor: "sistema" });
    expect(porId.get("por-ella")).toMatchObject({ estado: EstadoCompra.CANCELADA, canceladaPor: "usuario" });
    expect(porId.get("pendiente")?.canceladaPor).toBeNull();
    expect(porId.get("confirmada")?.canceladaPor).toBeNull();
    for (const vista of vistas) {
      expect(vista.canceladaPor !== null).toBe(
        vista.estado === EstadoCompra.CANCELADA || vista.estado === EstadoCompra.REEMBOLSADA,
      );
      expect(vista.venceEn !== null).toBe(vista.estado === EstadoCompra.PENDIENTE);
    }
  });

  it("UTILIZADA y REEMBOLSADA se devuelven con su estado y diasRestantes null; canceladaPor usuario en la REEMBOLSADA (009)", async () => {
    const { compraService } = armar({
      compras: [
        deSofia("utilizada", "evento-a", "tipo-a-vip", EstadoCompra.UTILIZADA),
        deSofia("reembolsada", "evento-a", "tipo-a-vip", EstadoCompra.REEMBOLSADA),
      ],
    });
    const vistas = await compraService.misCompras("usuario-sofia");
    const resumen = vistas.map(({ id, estado, canceladaPor, diasRestantes }) => ({
      id,
      estado,
      canceladaPor,
      diasRestantes,
    }));
    expect(resumen.toSorted((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: "reembolsada", estado: EstadoCompra.REEMBOLSADA, canceladaPor: "usuario", diasRestantes: null },
      { id: "utilizada", estado: EstadoCompra.UTILIZADA, canceladaPor: null, diasRestantes: null },
    ]);
  });

  it("ordena: no realizados por fecha ascendente, después realizados por fecha descendente, con desempates", async () => {
    const { compraService } = armar({
      eventos: [
        evento({ id: "evento-c", en: 2 * DIA, tiposEntrada: [tipo({ id: "tipo-c" })] }),
        evento({ id: "evento-d", en: -3 * DIA, tiposEntrada: [tipo({ id: "tipo-d" })] }),
      ],
      compras: [
        deSofia("pasado-1d", "evento-pasado", "tipo-pasado-general", EstadoCompra.CONFIRMADA),
        deSofia("a-vieja", "evento-a", "tipo-a-vip", EstadoCompra.CONFIRMADA, { creadaEn: hace(60) }),
        deSofia("d-3d", "evento-d", "tipo-d", EstadoCompra.CONFIRMADA),
        deSofia("a-nueva-b", "evento-a", "tipo-a-general", EstadoCompra.CONFIRMADA, { creadaEn: hace(5) }),
        deSofia("c-2d", "evento-c", "tipo-c", EstadoCompra.CONFIRMADA),
        deSofia("a-nueva-a", "evento-a", "tipo-a-vip", EstadoCompra.CONFIRMADA, { creadaEn: hace(5) }),
      ],
    });
    const vistas = await compraService.misCompras("usuario-sofia");
    expect(vistas.map((c) => c.id)).toEqual([
      "c-2d",
      "a-nueva-a",
      "a-nueva-b",
      "a-vieja",
      "pasado-1d",
      "d-3d",
    ]);
    expect(vistas.map((c) => c.evento.realizado)).toEqual([false, false, false, false, true, true]);
  });

  it("dos lecturas por pedido (SC-007): 30 compras en 10 eventos", async () => {
    const eventos = Array.from({ length: 10 }, (_, i) =>
      evento({ id: `evento-n${i}`, en: (i + 1) * DIA, tiposEntrada: [tipo({ id: `tipo-n${i}` })] }),
    );
    const compras = Array.from({ length: 30 }, (_, i) =>
      deSofia(`compra-${i}`, `evento-n${i % 10}`, `tipo-n${i % 10}`, EstadoCompra.CONFIRMADA),
    );
    const { compraService, repositorioCompras, repositorioEventos } = armar({ eventos, compras });
    const listarPorComprador = vi.spyOn(repositorioCompras, "listarPorComprador");
    const listarPorIds = vi.spyOn(repositorioEventos, "listarPorIds");
    const buscarEvento = vi.spyOn(repositorioEventos, "buscarPorId");
    const buscarCompra = vi.spyOn(repositorioCompras, "buscarPorId");

    expect(await compraService.misCompras("usuario-sofia")).toHaveLength(30);

    expect(listarPorComprador).toHaveBeenCalledTimes(1);
    expect(listarPorComprador).toHaveBeenCalledWith("usuario-sofia");
    expect(listarPorIds).toHaveBeenCalledTimes(1);
    const ids = listarPorIds.mock.calls[0]![0];
    expect(ids).toHaveLength(10);
    expect([...ids].toSorted()).toEqual(eventos.map((e) => e.id).toSorted());
    expect(buscarEvento).not.toHaveBeenCalled();
    expect(buscarCompra).not.toHaveBeenCalled();
  });

  it("sin compras → [] y ninguna lectura de eventos", async () => {
    const { compraService, repositorioEventos } = armar();
    const listarPorIds = vi.spyOn(repositorioEventos, "listarPorIds");
    const buscarEvento = vi.spyOn(repositorioEventos, "buscarPorId");
    expect(await compraService.misCompras("usuario-sofia")).toEqual([]);
    expect(listarPorIds).not.toHaveBeenCalled();
    expect(buscarEvento).not.toHaveBeenCalled();
  });

  describe("diasRestantes (US2)", () => {
    const aDiez = () =>
      evento({ id: "evento-diez", en: 10 * DIA, tiposEntrada: [tipo({ id: "tipo-diez" })] });

    it("una CONFIRMADA de un evento a 10 días → 10; con el reloj un día después → 9, sin guardarlo", async () => {
      const reloj = relojMovible();
      const { compraService, repositorioCompras } = armar({
        reloj,
        eventos: [aDiez()],
        compras: [deSofia("confirmada", "evento-diez", "tipo-diez", EstadoCompra.CONFIRMADA)],
      });
      const guardarCompra = vi.spyOn(repositorioCompras, "guardar");

      expect((await compraService.misCompras("usuario-sofia"))[0]?.diasRestantes).toBe(10);
      reloj.avanzar(DIA);
      expect((await compraService.misCompras("usuario-sofia"))[0]?.diasRestantes).toBe(9);
      expect(guardarCompra).not.toHaveBeenCalled();
    });

    it("una CONFIRMADA de un evento ya empezado → null, con el evento realizado", async () => {
      const { compraService } = armar({
        compras: [deSofia("pasada", "evento-pasado", "tipo-pasado-general", EstadoCompra.CONFIRMADA)],
      });
      expect((await compraService.misCompras("usuario-sofia"))[0]).toMatchObject({
        diasRestantes: null,
        evento: { realizado: true },
      });
    });

    it("PENDIENTE, CANCELADA, UTILIZADA y REEMBOLSADA de eventos futuros → null", async () => {
      const { compraService } = armar({
        eventos: [aDiez()],
        compras: [
          deSofia("pendiente", "evento-diez", "tipo-diez", EstadoCompra.PENDIENTE),
          deSofia("cancelada", "evento-diez", "tipo-diez", EstadoCompra.CANCELADA),
          deSofia("utilizada", "evento-diez", "tipo-diez", EstadoCompra.UTILIZADA),
          deSofia("reembolsada", "evento-diez", "tipo-diez", EstadoCompra.REEMBOLSADA),
        ],
      });
      const vistas = await compraService.misCompras("usuario-sofia");
      expect(vistas).toHaveLength(4);
      for (const vista of vistas) expect(vista.diasRestantes).toBeNull();
    });

    it("si el organizador cambia la fecha del evento, se recalculan con la nueva", async () => {
      const { compraService, repositorioEventos } = armar({
        eventos: [aDiez()],
        compras: [deSofia("confirmada", "evento-diez", "tipo-diez", EstadoCompra.CONFIRMADA)],
      });
      expect((await compraService.misCompras("usuario-sofia"))[0]?.diasRestantes).toBe(10);

      await repositorioEventos.guardar(
        evento({ id: "evento-diez", en: 3 * DIA, tiposEntrada: [tipo({ id: "tipo-diez" })] }),
      );
      expect((await compraService.misCompras("usuario-sofia"))[0]?.diasRestantes).toBe(3);
    });

    it("invariante: diasRestantes !== null ⇒ CONFIRMADA, evento no realizado y ≥ 0", async () => {
      const { compraService } = armar({
        eventos: [aDiez()],
        compras: [
          deSofia("confirmada-diez", "evento-diez", "tipo-diez", EstadoCompra.CONFIRMADA),
          deSofia("confirmada-a", "evento-a", "tipo-a-vip", EstadoCompra.CONFIRMADA),
          deSofia("confirmada-pasada", "evento-pasado", "tipo-pasado-general", EstadoCompra.CONFIRMADA),
          deSofia("pendiente", "evento-a", "tipo-a-vip", EstadoCompra.PENDIENTE),
          vencidaMaterializada("vencida"),
        ],
      });
      const vistas = await compraService.misCompras("usuario-sofia");
      expect(
        vistas
          .filter((v) => v.diasRestantes !== null)
          .map((v) => v.id)
          .toSorted(),
      ).toEqual(["confirmada-a", "confirmada-diez"].toSorted());
      for (const vista of vistas) {
        if (vista.diasRestantes === null) continue;
        expect(vista.estado).toBe(EstadoCompra.CONFIRMADA);
        expect(vista.evento.realizado).toBe(false);
        expect(vista.diasRestantes).toBeGreaterThanOrEqual(0);
      }
    });
  });

  it("no toma el cerrojo, no guarda nada y lee el reloj una vez", async () => {
    const reloj = relojFijo(new Date(AHORA.getTime() + 20 * MINUTO));
    const { compraService, cerrojo, repositorioEventos, repositorioCompras } = armar({
      reloj,
      compras: [
        deSofia("pendiente", "evento-a", "tipo-a-vip", EstadoCompra.PENDIENTE),
        deSofia("confirmada", "evento-b", "tipo-b-platea", EstadoCompra.CONFIRMADA),
      ],
    });
    const ejecutar = vi.spyOn(cerrojo, "ejecutar");
    const guardarEvento = vi.spyOn(repositorioEventos, "guardar");
    const guardarCompra = vi.spyOn(repositorioCompras, "guardar");
    const ahora = vi.spyOn(reloj, "ahora");

    await compraService.misCompras("usuario-sofia");

    expect(ejecutar).not.toHaveBeenCalled();
    expect(guardarEvento).not.toHaveBeenCalled();
    expect(guardarCompra).not.toHaveBeenCalled();
    expect(ahora).toHaveBeenCalledTimes(1);
  });
});

describe("CompraService.comprasDelEvento (feature 008, US1)", () => {
  const hace = (minutos: number) => new Date(AHORA.getTime() - minutos * MINUTO);
  const de = (
    id: string,
    compradorId: string,
    tipoEntradaId: string,
    estado: EstadoCompra,
    cambios: { creadaEn?: Date; cantidad?: number; historial?: CambioEstadoCompra[] } = {},
  ) => compra("evento-a", tipoEntradaId, estado, { id, compradorId, ...cambios });

  it("todas las compras del evento, de todos los compradores y estados, con la forma de CompraDelEventoVista", async () => {
    const { compraService } = armar({
      compras: [
        de("de-martin", "usuario-martin", "tipo-a-vip", EstadoCompra.CONFIRMADA, {
          cantidad: 2,
          creadaEn: hace(30),
        }),
        de("de-sofia", "usuario-sofia", "tipo-a-general", EstadoCompra.CANCELADA, { creadaEn: hace(20) }),
        de("de-diego", "usuario-diego", "tipo-a-kids", EstadoCompra.PENDIENTE, { creadaEn: hace(5) }),
        compra("evento-b", "tipo-b-platea", EstadoCompra.CONFIRMADA, { id: "otro-evento" }),
      ],
    });

    const vista = await compraService.comprasDelEvento("evento-a", "usuario-lucia");

    expect(vista.compras.map((c) => c.id)).toEqual(["de-diego", "de-sofia", "de-martin"]);
    expect(vista.compras[2]).toEqual({
      id: "de-martin",
      comprador: { id: "usuario-martin", nombre: "Martín", apellido: "Benítez" },
      tipoEntrada: { id: "tipo-a-vip", nombre: "VIP" },
      cantidad: 2,
      total: 1000,
      estado: EstadoCompra.CONFIRMADA,
      creadaEn: hace(30).toISOString(),
      creadaEnLocal: "2026-11-10T11:30",
      venceEn: null,
      venceEnLocal: null,
      canceladaPor: null,
      entradasUsadas: 0,
      canceladaDesde: null,
      reembolso: null,
    });
    expect(vista.compras[1]).toMatchObject({ estado: EstadoCompra.CANCELADA, canceladaPor: "usuario" });
    expect(vista.compras[0]).toMatchObject({
      estado: EstadoCompra.PENDIENTE,
      venceEn: new Date(hace(5).getTime() + 15 * MINUTO).toISOString(),
      venceEnLocal: "2026-11-10T12:10",
      canceladaPor: null,
    });
    for (const fila of vista.compras) {
      expect(fila).not.toHaveProperty("entradas");
      expect(fila).not.toHaveProperty("historial");
      expect(fila).not.toHaveProperty("compradorId");
    }
  });

  it("al día: una PENDIENTE con los 15 minutos cumplidos sale CANCELADA por el sistema y no se guarda", async () => {
    const reloj = relojMovible();
    const { compraService, repositorioCompras } = armar({
      compras: [de("pendiente", "usuario-martin", "tipo-a-vip", EstadoCompra.PENDIENTE)],
      reloj,
    });
    const guardar = vi.spyOn(repositorioCompras, "guardar");

    reloj.avanzar(15 * MINUTO - 1);
    expect((await compraService.comprasDelEvento("evento-a", "usuario-lucia")).compras[0]).toMatchObject({
      estado: EstadoCompra.PENDIENTE,
      venceEnLocal: "2026-11-10T12:15",
      canceladaPor: null,
    });

    reloj.avanzar(1);
    expect((await compraService.comprasDelEvento("evento-a", "usuario-lucia")).compras[0]).toMatchObject({
      estado: EstadoCompra.CANCELADA,
      canceladaPor: "sistema",
      venceEn: null,
      venceEnLocal: null,
    });
    expect(guardar).not.toHaveBeenCalled();
    expect((await repositorioCompras.buscarPorId("pendiente"))?.estado).toBe(EstadoCompra.PENDIENTE);
  });

  it("venceEn solo en PENDIENTE y canceladaPor solo en CANCELADA o REEMBOLSADA (009), en todos los estados", async () => {
    const { compraService } = armar({
      compras: Object.values(EstadoCompra).map((estado) =>
        de(`compra-${estado}`, "usuario-martin", "tipo-a-vip", estado),
      ),
    });
    const { compras } = await compraService.comprasDelEvento("evento-a", "usuario-lucia");
    expect(compras).toHaveLength(Object.values(EstadoCompra).length);
    for (const fila of compras) {
      expect(fila.venceEn !== null).toBe(fila.estado === EstadoCompra.PENDIENTE);
      expect(fila.canceladaPor !== null).toBe(
        fila.estado === EstadoCompra.CANCELADA || fila.estado === EstadoCompra.REEMBOLSADA,
      );
    }
  });

  it("el evento y la ventana de uso según el reloj", async () => {
    // evento-a empieza en AHORA + 5 días: la ventana va de 4 h antes a 12 h después.
    const inicio = new Date(AHORA.getTime() + 5 * DIA);
    const reloj = relojMovible();
    const { compraService } = armar({ reloj });

    const vista = await compraService.comprasDelEvento("evento-a", "usuario-lucia");
    expect(vista.evento).toEqual({
      id: "evento-a",
      nombre: "Festival",
      fechaHoraLocal: "2026-11-15T12:00",
      realizado: false,
    });
    expect(vista.ventanaDeUso).toEqual({
      desde: new Date(inicio.getTime() - 4 * 60 * MINUTO).toISOString(),
      hasta: new Date(inicio.getTime() + 12 * 60 * MINUTO).toISOString(),
      desdeLocal: "2026-11-15T08:00",
      hastaLocal: "2026-11-16T00:00",
      estado: "antes",
    });

    reloj.avanzar(5 * DIA - 4 * 60 * MINUTO);
    expect((await compraService.comprasDelEvento("evento-a", "usuario-lucia")).ventanaDeUso.estado).toBe(
      "abierta",
    );
    reloj.avanzar(16 * 60 * MINUTO + 1);
    expect((await compraService.comprasDelEvento("evento-a", "usuario-lucia")).ventanaDeUso.estado).toBe(
      "despues",
    );
  });

  it("también con el evento ya realizado", async () => {
    const { compraService } = armar({
      compras: [compra("evento-pasado", "tipo-pasado-general", EstadoCompra.CONFIRMADA, { id: "vieja" })],
    });
    const vista = await compraService.comprasDelEvento("evento-pasado", "usuario-lucia");
    expect(vista.evento.realizado).toBe(true);
    expect(vista.compras.map((c) => c.id)).toEqual(["vieja"]);
  });

  it("404 antes que 403; 403 para un comprador del evento que no lo organiza", async () => {
    const { compraService } = armar({
      compras: [de("de-martin", "usuario-martin", "tipo-a-vip", EstadoCompra.CONFIRMADA)],
    });
    await expect(compraService.comprasDelEvento("evento-x", "usuario-martin")).rejects.toMatchObject({
      constructor: NoEncontradoError,
      codigo: "EVENTO_NO_ENCONTRADO",
    });
    await expect(compraService.comprasDelEvento("evento-a", "usuario-martin")).rejects.toMatchObject({
      constructor: SinPermisoError,
      mensaje: "Solo el organizador del evento puede ver sus compras.",
    });
  });

  it("lecturas fijas: con 30 compras de 10 compradores, una lectura de cada cosa; sin guardar ni cerrojo", async () => {
    const compradores = Array.from(
      { length: 10 },
      (_, i) =>
        new Usuario({ id: `usuario-${i}`, nombre: `Nombre${i}`, apellido: `Apellido${i}`, favoritos: [] }),
    );
    const compras = Array.from({ length: 30 }, (_, i) =>
      de(`compra-${i}`, `usuario-${i % 10}`, "tipo-a-vip", EstadoCompra.CONFIRMADA, { creadaEn: hace(i) }),
    );
    const servicios = crearServicesDeEventos({
      eventos: [evento({ id: "evento-a", tiposEntrada: [vip] })],
      compras,
      usuarios: [lucia, ...compradores],
    });
    const { compraService, repositorioEventos, repositorioCompras, usuarioService, cerrojo } = servicios;
    const buscarEvento = vi.spyOn(repositorioEventos, "buscarPorId");
    const pendientes = vi.spyOn(repositorioCompras, "listarPendientesPorEventos");
    const porEvento = vi.spyOn(repositorioCompras, "listarPorEvento");
    const usuarios = vi.spyOn(usuarioService, "obtenerPorIds");
    const guardarCompra = vi.spyOn(repositorioCompras, "guardar");
    const guardarEvento = vi.spyOn(repositorioEventos, "guardar");
    const ejecutar = vi.spyOn(cerrojo, "ejecutar");

    const vista = await compraService.comprasDelEvento("evento-a", "usuario-lucia");

    expect(vista.compras).toHaveLength(30);
    expect(buscarEvento).toHaveBeenCalledTimes(1);
    expect(pendientes).toHaveBeenCalledTimes(1);
    expect(porEvento).toHaveBeenCalledTimes(1);
    expect(usuarios).toHaveBeenCalledTimes(1);
    expect(guardarCompra).not.toHaveBeenCalled();
    expect(guardarEvento).not.toHaveBeenCalled();
    expect(ejecutar).not.toHaveBeenCalled();
  });

  describe("resumenPorTipo (US2)", () => {
    // Un tipo de cupo 10 con 3 entradas sin pagar y 2 pagadas: el guardado ya tiene 5 disponibles.
    const conCupo = tipo({ id: "tipo-c-general", nombre: "General", cupo: 5 });
    const sinCompras = tipo({ id: "tipo-c-platea", nombre: "Platea", cupo: 30 });
    const armarResumen = (reloj = relojMovible()) => ({
      reloj,
      ...armar({
        eventos: [evento({ id: "evento-c", tiposEntrada: [conCupo, sinCompras] })],
        compras: [
          compra("evento-c", "tipo-c-general", EstadoCompra.PENDIENTE, { id: "p1", cantidad: 2 }),
          compra("evento-c", "tipo-c-general", EstadoCompra.PENDIENTE, { id: "p2", cantidad: 1 }),
          compra("evento-c", "tipo-c-general", EstadoCompra.CONFIRMADA, { id: "c1", cantidad: 2 }),
        ],
        reloj,
      }),
    });

    it("uno por tipo en el orden del evento: 5 · 3 · 2 · 0, y un tipo sin compras con su cupo y ceros", async () => {
      const { compraService } = armarResumen();
      const { resumenPorTipo } = await compraService.comprasDelEvento("evento-c", "usuario-lucia");
      expect(resumenPorTipo).toEqual([
        {
          tipoEntrada: { id: "tipo-c-general", nombre: "General" },
          disponibles: 5,
          pendientes: 3,
          vendidas: 2,
          usadas: 0,
        },
        {
          tipoEntrada: { id: "tipo-c-platea", nombre: "Platea" },
          disponibles: 30,
          pendientes: 0,
          vendidas: 0,
          usadas: 0,
        },
      ]);
    });

    it("15 minutos después: 8 · 0 · 2 · 0, sin guardar nada", async () => {
      const { compraService, reloj, repositorioCompras, repositorioEventos } = armarResumen();
      const guardarCompra = vi.spyOn(repositorioCompras, "guardar");
      const guardarEvento = vi.spyOn(repositorioEventos, "guardar");
      reloj.avanzar(15 * MINUTO);

      const { resumenPorTipo } = await compraService.comprasDelEvento("evento-c", "usuario-lucia");

      expect(resumenPorTipo[0]).toMatchObject({ disponibles: 8, pendientes: 0, vendidas: 2, usadas: 0 });
      expect(guardarCompra).not.toHaveBeenCalled();
      expect(guardarEvento).not.toHaveBeenCalled();
    });

    it("los disponibles son los mismos que los del detalle en el mismo instante (SC-003)", async () => {
      const { compraService, eventoService, reloj } = armarResumen();
      for (const minutos of [0, 15]) {
        reloj.avanzar(minutos * MINUTO);
        const { resumenPorTipo } = await compraService.comprasDelEvento("evento-c", "usuario-lucia");
        const detalle = await eventoService.obtener("evento-c");
        expect(resumenPorTipo.map((r) => r.disponibles)).toEqual(detalle.tiposEntrada.map((t) => t.cupo));
      }
    });
  });

  it("sin compras, no pide usuarios", async () => {
    const { compraService, usuarioService } = armar();
    const usuarios = vi.spyOn(usuarioService, "obtenerPorIds");
    expect((await compraService.comprasDelEvento("evento-a", "usuario-lucia")).compras).toEqual([]);
    expect(usuarios).not.toHaveBeenCalled();
  });
});

describe("Entradas en las vistas del comprador (feature 008, US3, R11, R14)", () => {
  const usoDeLucia: CambioEstadoCompra = {
    estado: EstadoCompra.UTILIZADA,
    autor: { tipo: "usuario", usuarioId: "usuario-lucia" },
    fechaHora: new Date(AHORA.getTime() + 30 * MINUTO),
  };
  /** Una compra de Sofía de 3 VIP en `estado`; en UTILIZADA, con la primera entrada usada por Lucía. */
  const deSofia = (id: string, estado: EstadoCompra) =>
    compra("evento-a", "tipo-a-vip", estado, { id, compradorId: "usuario-sofia", cantidad: 3 });
  const utilizada = (id: string) => {
    const confirmada = deSofia(id, EstadoCompra.CONFIRMADA);
    return confirmada.registrarUso(confirmada.entradas[0]!.codigo, "usuario-lucia", usoDeLucia.fechaHora);
  };
  const codigosDe = (c: Compra) => c.entradas.map((entrada) => entrada.codigo);

  it("obtener: entradas vacías en PENDIENTE y CANCELADA, con código y estado en CONFIRMADA y UTILIZADA", async () => {
    const pendiente = deSofia("pendiente", EstadoCompra.PENDIENTE);
    const cancelada = deSofia("cancelada", EstadoCompra.CANCELADA);
    const confirmada = deSofia("confirmada", EstadoCompra.CONFIRMADA);
    const usada = utilizada("usada");
    const { compraService } = armar({ compras: [pendiente, cancelada, confirmada, usada] });

    expect(await compraService.obtener("pendiente", "usuario-sofia")).toMatchObject({
      entradas: [],
      entradasUsadas: 0,
    });
    expect((await compraService.obtener("cancelada", "usuario-sofia")).entradas).toEqual([]);
    expect((await compraService.obtener("confirmada", "usuario-sofia")).entradas).toEqual(
      codigosDe(confirmada).map((codigo) => ({
        codigo,
        estado: EstadoCompra.CONFIRMADA,
        usadaEn: null,
        usadaEnLocal: null,
      })),
    );
    const vistaUsada = await compraService.obtener("usada", "usuario-sofia");
    expect(vistaUsada.estado).toBe(EstadoCompra.UTILIZADA);
    expect(vistaUsada.entradasUsadas).toBe(1);
    expect(vistaUsada.entradas).toEqual([
      {
        codigo: codigosDe(usada)[0],
        estado: EstadoCompra.UTILIZADA,
        usadaEn: "2026-11-10T15:30:00.000Z",
        usadaEnLocal: "2026-11-10T12:30",
      },
      { codigo: codigosDe(usada)[1], estado: EstadoCompra.CONFIRMADA, usadaEn: null, usadaEnLocal: null },
      { codigo: codigosDe(usada)[2], estado: EstadoCompra.CONFIRMADA, usadaEn: null, usadaEnLocal: null },
    ]);
  });

  it("una PENDIENTE vencida (al día) no muestra códigos", async () => {
    const reloj = relojMovible();
    const { compraService } = armar({ reloj, compras: [deSofia("pendiente", EstadoCompra.PENDIENTE)] });
    reloj.avanzar(15 * MINUTO);
    expect(await compraService.obtener("pendiente", "usuario-sofia")).toMatchObject({
      estado: EstadoCompra.CANCELADA,
      entradas: [],
    });
  });

  it("crear y cancelar devuelven entradas vacías; pagar, los códigos que dio el repositorio", async () => {
    const { compraService, repositorioCompras } = armar();
    const creada = await compraService.crear("evento-a", "usuario-sofia", {
      tipoEntradaId: "tipo-a-vip",
      cantidad: 2,
    });
    expect(creada).toMatchObject({ entradas: [], entradasUsadas: 0 });
    const pagada = await compraService.pagar(creada.id, "usuario-sofia");
    const guardada = await repositorioCompras.buscarPorId(creada.id);
    expect(pagada.entradas.map((e) => e.codigo)).toEqual(codigosDe(guardada!));
    expect(pagada.entradas.every((e) => e.estado === EstadoCompra.CONFIRMADA)).toBe(true);

    const otra = await compraService.crear("evento-a", "usuario-sofia", {
      tipoEntradaId: "tipo-a-vip",
      cantidad: 1,
    });
    expect((await compraService.cancelar(otra.id, "usuario-sofia")).entradas).toEqual([]);
  });

  it("misComprasDelEvento: confirmadas incluye las UTILIZADA con sus entradas (R9)", async () => {
    const { compraService } = armar({
      compras: [deSofia("confirmada", EstadoCompra.CONFIRMADA), utilizada("usada")],
    });
    const { confirmadas } = await compraService.misComprasDelEvento("evento-a", "usuario-sofia");
    expect(confirmadas.map((c) => c.id).toSorted()).toEqual(["confirmada", "usada"]);
    const usada = confirmadas.find((c) => c.id === "usada")!;
    expect(usada).toMatchObject({ estado: EstadoCompra.UTILIZADA, entradasUsadas: 1 });
    expect(usada.entradas).toHaveLength(3);
  });

  it("misCompras: entradasUsadas sin entradas; diasRestantes solo en CONFIRMADA", async () => {
    const { compraService } = armar({
      compras: [deSofia("confirmada", EstadoCompra.CONFIRMADA), utilizada("usada")],
    });
    const vistas = await compraService.misCompras("usuario-sofia");
    const porId = new Map(vistas.map((v) => [v.id, v]));
    expect(porId.get("usada")).toMatchObject({ entradasUsadas: 1, diasRestantes: null });
    expect(porId.get("confirmada")).toMatchObject({ entradasUsadas: 0, diasRestantes: 5 });
    for (const vista of vistas) expect(vista).not.toHaveProperty("entradas");
  });

  it("comprasDelEvento: entradasUsadas real y sin códigos", async () => {
    const { compraService } = armar({ compras: [utilizada("usada")] });
    const { compras } = await compraService.comprasDelEvento("evento-a", "usuario-lucia");
    expect(compras[0]).toMatchObject({ estado: EstadoCompra.UTILIZADA, entradasUsadas: 1 });
    expect(compras[0]).not.toHaveProperty("entradas");
  });
});

describe("Cancelación y reembolso en las vistas (feature 009, R6, R7)", () => {
  // El Festival (evento-a) empieza a las 15:00 UTC del 15/11, 5 días después de AHORA.
  const HASTA_EL_INICIO = 5 * DIA;
  const porSofia = { tipo: "usuario", usuarioId: "usuario-sofia" } as const;
  const porLuciaAutor = { tipo: "usuario", usuarioId: "usuario-lucia" } as const;
  const enAhora = (
    estado: EstadoCompra,
    autor: CambioEstadoCompra["autor"] = porSofia,
  ): CambioEstadoCompra => ({
    estado,
    autor,
    fechaHora: AHORA,
  });
  const desdeConfirmada = [
    enAhora(EstadoCompra.PENDIENTE),
    enAhora(EstadoCompra.CONFIRMADA),
    enAhora(EstadoCompra.CANCELADA),
  ];
  const deSofia = (
    id: string,
    estado: EstadoCompra,
    cambios: { tipoEntradaId?: string; total?: number; historial?: CambioEstadoCompra[] } = {},
  ) => {
    const { tipoEntradaId = "tipo-a-vip", ...resto } = cambios;
    return compra("evento-a", tipoEntradaId, estado, {
      id,
      compradorId: "usuario-sofia",
      cantidad: 2,
      total: 240000,
      ...resto,
    });
  };
  const confirmada = () => deSofia("confirmada", EstadoCompra.CONFIRMADA);
  const utilizada = () => deSofia("utilizada", EstadoCompra.UTILIZADA);
  const canceladaDesdeConfirmada = () =>
    deSofia("cancelada-desde-confirmada", EstadoCompra.CANCELADA, { historial: desdeConfirmada });
  const reembolsada = () =>
    deSofia("reembolsada", EstadoCompra.REEMBOLSADA, {
      historial: [...desdeConfirmada, enAhora(EstadoCompra.REEMBOLSADA, porLuciaAutor)],
    });
  const gratisCanceladaDesdeConfirmada = () =>
    deSofia("gratis", EstadoCompra.CANCELADA, {
      tipoEntradaId: "tipo-a-kids",
      total: 0,
      historial: desdeConfirmada,
    });
  const pendienteCancelada = () => deSofia("pendiente-cancelada", EstadoCompra.CANCELADA);
  const todas = () => [
    confirmada(),
    utilizada(),
    canceladaDesdeConfirmada(),
    reembolsada(),
    gratisCanceladaDesdeConfirmada(),
    pendienteCancelada(),
  ];

  /** Los servicios con `todas` y los repositorios espiados: ninguna lectura guarda nada. */
  function armarEspiado(reloj = relojMovible()) {
    const servicios = armar({ compras: todas(), reloj });
    const guardarCompra = vi.spyOn(servicios.repositorioCompras, "guardar");
    const guardarEvento = vi.spyOn(servicios.repositorioEventos, "guardar");
    return { ...servicios, reloj, guardarCompra, guardarEvento };
  }

  describe("CompraService.obtener", () => {
    it("una CONFIRMADA antes del inicio es cancelable; al inicio, ya no (evento-empezado)", async () => {
      const { compraService, reloj, guardarCompra, guardarEvento } = armarEspiado();

      expect(await compraService.obtener("confirmada", "usuario-sofia")).toMatchObject({
        canceladaDesde: null,
        reembolso: null,
        cancelable: true,
        motivoNoCancelable: null,
      });
      reloj.avanzar(HASTA_EL_INICIO - MINUTO);
      expect(await compraService.obtener("confirmada", "usuario-sofia")).toMatchObject({
        cancelable: true,
        motivoNoCancelable: null,
      });
      reloj.avanzar(MINUTO);
      expect(await compraService.obtener("confirmada", "usuario-sofia")).toMatchObject({
        cancelable: false,
        motivoNoCancelable: "evento-empezado",
      });
      expect(guardarCompra).not.toHaveBeenCalled();
      expect(guardarEvento).not.toHaveBeenCalled();
    });

    it("una UTILIZADA → entrada-usada, con o sin el evento empezado", async () => {
      const { compraService, reloj } = armarEspiado();
      expect(await compraService.obtener("utilizada", "usuario-sofia")).toMatchObject({
        cancelable: false,
        motivoNoCancelable: "entrada-usada",
        canceladaDesde: null,
        reembolso: null,
      });
      reloj.avanzar(HASTA_EL_INICIO);
      expect(await compraService.obtener("utilizada", "usuario-sofia")).toMatchObject({
        motivoNoCancelable: "entrada-usada",
      });
    });

    it("una paga CANCELADA desde confirmada: reembolso pendiente del total y sin entradas", async () => {
      const { compraService } = armarEspiado();
      expect(await compraService.obtener("cancelada-desde-confirmada", "usuario-sofia")).toMatchObject({
        estado: EstadoCompra.CANCELADA,
        canceladaDesde: "CONFIRMADA",
        reembolso: { estado: "pendiente", monto: 240000 },
        entradas: [],
        cancelable: false,
        motivoNoCancelable: "cancelada",
      });
    });

    it("una REEMBOLSADA: reembolso confirmado del total", async () => {
      const { compraService } = armarEspiado();
      expect(await compraService.obtener("reembolsada", "usuario-sofia")).toMatchObject({
        estado: EstadoCompra.REEMBOLSADA,
        canceladaDesde: "CONFIRMADA",
        reembolso: { estado: "confirmado", monto: 240000 },
        entradas: [],
        cancelable: false,
        motivoNoCancelable: "reembolsada",
      });
    });

    it("una gratis cancelada desde confirmada o una pendiente cancelada: sin reembolso", async () => {
      const { compraService } = armarEspiado();
      expect(await compraService.obtener("gratis", "usuario-sofia")).toMatchObject({
        canceladaDesde: "CONFIRMADA",
        reembolso: null,
        motivoNoCancelable: "cancelada",
      });
      expect(await compraService.obtener("pendiente-cancelada", "usuario-sofia")).toMatchObject({
        canceladaDesde: "PENDIENTE",
        reembolso: null,
        motivoNoCancelable: "cancelada",
      });
    });
  });

  it("misComprasDelEvento: sus CompraVista traen si se pueden cancelar, sin guardar nada", async () => {
    const { compraService, guardarCompra, guardarEvento } = armarEspiado();
    const vista = await compraService.misComprasDelEvento("evento-a", "usuario-sofia");
    const porId = new Map(vista.confirmadas.map((c) => [c.id, c]));
    expect(porId.get("confirmada")).toMatchObject({
      cancelable: true,
      motivoNoCancelable: null,
      reembolso: null,
    });
    expect(porId.get("utilizada")).toMatchObject({ cancelable: false, motivoNoCancelable: "entrada-usada" });
    expect(guardarCompra).not.toHaveBeenCalled();
    expect(guardarEvento).not.toHaveBeenCalled();
  });

  it("las respuestas de pagar y cancelar (pendiente) traen los campos nuevos", async () => {
    const pendiente = (id: string) => deSofia(id, EstadoCompra.PENDIENTE);
    const { compraService } = armar({ compras: [pendiente("a-pagar"), pendiente("a-cancelar")] });

    expect(await compraService.pagar("a-pagar", "usuario-sofia")).toMatchObject({
      estado: EstadoCompra.CONFIRMADA,
      canceladaDesde: null,
      reembolso: null,
      cancelable: true,
      motivoNoCancelable: null,
    });
    expect(await compraService.cancelar("a-cancelar", "usuario-sofia")).toMatchObject({
      estado: EstadoCompra.CANCELADA,
      canceladaDesde: "PENDIENTE",
      reembolso: null,
      cancelable: false,
      motivoNoCancelable: "cancelada",
    });
  });

  it("misCompras trae canceladaDesde y reembolso pero no cancelable ni motivoNoCancelable", async () => {
    const { compraService, guardarCompra, guardarEvento } = armarEspiado();
    const vistas = await compraService.misCompras("usuario-sofia");
    const porId = new Map(vistas.map((v) => [v.id, v]));

    for (const vista of vistas) {
      expect(vista).not.toHaveProperty("cancelable");
      expect(vista).not.toHaveProperty("motivoNoCancelable");
    }
    expect(porId.get("cancelada-desde-confirmada")).toMatchObject({
      canceladaDesde: "CONFIRMADA",
      reembolso: { estado: "pendiente", monto: 240000 },
      canceladaPor: "usuario",
    });
    expect(porId.get("reembolsada")).toMatchObject({
      canceladaDesde: "CONFIRMADA",
      reembolso: { estado: "confirmado", monto: 240000 },
      canceladaPor: "usuario",
    });
    expect(porId.get("gratis")).toMatchObject({ canceladaDesde: "CONFIRMADA", reembolso: null });
    expect(porId.get("pendiente-cancelada")).toMatchObject({ canceladaDesde: "PENDIENTE", reembolso: null });
    expect(porId.get("confirmada")).toMatchObject({
      canceladaDesde: null,
      reembolso: null,
      canceladaPor: null,
    });
    expect(guardarCompra).not.toHaveBeenCalled();
    expect(guardarEvento).not.toHaveBeenCalled();
  });

  it("comprasDelEvento trae canceladaDesde y reembolso, y canceladaPor también en una REEMBOLSADA", async () => {
    const { compraService, guardarCompra, guardarEvento } = armarEspiado();
    const vista = await compraService.comprasDelEvento("evento-a", "usuario-lucia");
    const porId = new Map(vista.compras.map((c) => [c.id, c]));

    expect(porId.get("cancelada-desde-confirmada")).toMatchObject({
      canceladaDesde: "CONFIRMADA",
      reembolso: { estado: "pendiente", monto: 240000 },
      canceladaPor: "usuario",
    });
    expect(porId.get("reembolsada")).toMatchObject({
      canceladaDesde: "CONFIRMADA",
      reembolso: { estado: "confirmado", monto: 240000 },
      canceladaPor: "usuario",
    });
    expect(porId.get("gratis")).toMatchObject({ canceladaDesde: "CONFIRMADA", reembolso: null });
    expect(porId.get("pendiente-cancelada")).toMatchObject({ canceladaDesde: "PENDIENTE", reembolso: null });
    expect(porId.get("confirmada")).toMatchObject({ canceladaDesde: null, reembolso: null });
    for (const fila of vista.compras) {
      expect(fila).not.toHaveProperty("entradas");
      expect(fila).not.toHaveProperty("cancelable");
    }
    expect(guardarCompra).not.toHaveBeenCalled();
    expect(guardarEvento).not.toHaveBeenCalled();
  });
});

describe("CompraService.cancelar de una CONFIRMADA (feature 009, US1, R2)", () => {
  // El Festival (evento-a) empieza 5 días después de AHORA; el cupo de cada tipo no incluye las
  // compras armadas por constructor: cancelarlas lo sube en su cantidad.
  const confirmadaDeSofia = (tipoEntradaId = "tipo-a-vip", { cantidad = 2, total = 240000 } = {}) =>
    compra("evento-a", tipoEntradaId, EstadoCompra.CONFIRMADA, {
      id: "compra-sofia",
      compradorId: "usuario-sofia",
      cantidad,
      total,
    });

  it("responde la CANCELADA con el reembolso pendiente, sin entradas y ya no cancelable", async () => {
    const { compraService } = armar({ compras: [confirmadaDeSofia()] });
    expect(await compraService.cancelar("compra-sofia", "usuario-sofia")).toMatchObject({
      estado: EstadoCompra.CANCELADA,
      canceladaDesde: "CONFIRMADA",
      reembolso: { estado: "pendiente", monto: 240000 },
      entradas: [],
      entradasUsadas: 0,
      cancelable: false,
      motivoNoCancelable: "cancelada",
    });
  });

  it("guarda el CANCELADA del comprador con la hora del reloj leída dentro del cerrojo", async () => {
    const reloj = relojMovible();
    const { compraService, cerrojo, repositorioCompras } = armar({ reloj, compras: [confirmadaDeSofia()] });
    const ejecutar = cerrojo.ejecutar.bind(cerrojo);
    vi.spyOn(cerrojo, "ejecutar").mockImplementation((clave, operacion) => {
      reloj.avanzar(7 * MINUTO);
      return ejecutar(clave, operacion);
    });

    await compraService.cancelar("compra-sofia", "usuario-sofia");

    const guardada = await repositorioCompras.buscarPorId("compra-sofia");
    const esperado = {
      estado: EstadoCompra.CANCELADA,
      autor: { tipo: "usuario", usuarioId: "usuario-sofia" },
      fechaHora: new Date(AHORA.getTime() + 7 * MINUTO),
    };
    expect(guardada?.historial.at(-1)).toEqual(esperado);
    expect(guardada?.entradas.every((entrada) => entrada.cambios.length === 1)).toBe(true);
    expect(guardada?.entradas[0]?.cambios[0]).toEqual(esperado);
  });

  it("el cupo sube exactamente la cantidad: un tipo agotado vuelve a tener disponibles para todos", async () => {
    const { compraService, eventoService, repositorioEventos } = armar();
    const { id } = await compraService.crear("evento-a", "usuario-sofia", {
      tipoEntradaId: "tipo-a-backstage",
      cantidad: 3,
    });
    await compraService.pagar(id, "usuario-sofia");
    expect(await cupoDe(repositorioEventos, "tipo-a-backstage")).toBe(0);

    await compraService.cancelar(id, "usuario-sofia");

    expect(await cupoDe(repositorioEventos, "tipo-a-backstage")).toBe(3);
    const detalle = await eventoService.obtener("evento-a");
    expect(detalle.tiposEntrada.find((t) => t.id === "tipo-a-backstage")?.cupo).toBe(3);
  });

  it("guarda la compra primero y después el evento, una vez cada uno, bajo un cerrojo del evento", async () => {
    const { compraService, cerrojo, repositorioCompras, repositorioEventos } = armar({
      compras: [confirmadaDeSofia()],
    });
    const ejecutar = vi.spyOn(cerrojo, "ejecutar");
    const guardarCompra = vi.spyOn(repositorioCompras, "guardar");
    const guardarEvento = vi.spyOn(repositorioEventos, "guardar");

    await compraService.cancelar("compra-sofia", "usuario-sofia");

    expect(ejecutar).toHaveBeenCalledTimes(1);
    expect(ejecutar).toHaveBeenCalledWith("evento-a", expect.any(Function));
    expect(guardarCompra).toHaveBeenCalledTimes(1);
    expect(guardarEvento).toHaveBeenCalledTimes(1);
    expect(guardarCompra.mock.invocationCallOrder[0]!).toBeLessThan(
      guardarEvento.mock.invocationCallOrder[0]!,
    );
    expect(cerrojo.clavesActivas).toBe(0);
    expect(await cupoDe(repositorioEventos, "tipo-a-vip")).toBe(52);
  });

  it("libera el tope: con 4 pagas confirmadas, después de cancelar vuelve a poder comprar 4", async () => {
    const { compraService } = armar({
      compras: [confirmadaDeSofia("tipo-a-vip", { cantidad: 4, total: 480000 })],
    });
    const restantes = async () =>
      (await compraService.misComprasDelEvento("evento-a", "usuario-sofia")).restantesPorTipo;
    expect((await restantes()).find((r) => r.tipoEntradaId === "tipo-a-general")?.restantes).toBe(0);

    await compraService.cancelar("compra-sofia", "usuario-sofia");

    for (const id of ["tipo-a-general", "tipo-a-vip", "tipo-a-backstage"]) {
      expect((await restantes()).find((r) => r.tipoEntradaId === id)?.restantes).toBe(4);
    }
    const { confirmadas } = await compraService.misComprasDelEvento("evento-a", "usuario-sofia");
    expect(confirmadas).toEqual([]);
    await expect(
      compraService.crear("evento-a", "usuario-sofia", { tipoEntradaId: "tipo-a-vip", cantidad: 4 }),
    ).resolves.toMatchObject({ estado: EstadoCompra.PENDIENTE });
  });

  it("una gratis: sin reembolso, y su cupo vuelve igual", async () => {
    const { compraService, repositorioEventos } = armar({
      compras: [confirmadaDeSofia("tipo-a-kids", { cantidad: 1, total: 0 })],
    });
    expect(await compraService.cancelar("compra-sofia", "usuario-sofia")).toMatchObject({
      estado: EstadoCompra.CANCELADA,
      canceladaDesde: "CONFIRMADA",
      reembolso: null,
    });
    expect(await cupoDe(repositorioEventos, "tipo-a-kids")).toBe(21);
  });

  it("comprasDelEvento la muestra CANCELADA, fuera de vendidas y con disponibles sumado", async () => {
    const { compraService } = armar({ compras: [confirmadaDeSofia()] });
    const vipDe = async () =>
      (await compraService.comprasDelEvento("evento-a", "usuario-lucia")).resumenPorTipo.find(
        (r) => r.tipoEntrada.id === "tipo-a-vip",
      );
    expect(await vipDe()).toMatchObject({ disponibles: 50, vendidas: 2 });

    await compraService.cancelar("compra-sofia", "usuario-sofia");

    expect(await vipDe()).toMatchObject({ disponibles: 52, vendidas: 0 });
    const vista = await compraService.comprasDelEvento("evento-a", "usuario-lucia");
    expect(vista.compras[0]).toMatchObject({
      estado: EstadoCompra.CANCELADA,
      canceladaPor: "usuario",
      canceladaDesde: "CONFIRMADA",
      reembolso: { estado: "pendiente", monto: 240000 },
    });
  });
});

describe("CompraService.cancelar: rechazos (feature 009, US3, FR-009, FR-010, SC-003)", () => {
  // El Festival (evento-a, de Lucía) empieza 5 días después de AHORA.
  const INICIO = new Date(AHORA.getTime() + 5 * DIA);
  const porSofia = { tipo: "usuario", usuarioId: "usuario-sofia" } as const;
  const deSofia = (estado: EstadoCompra, cambios: { historial?: CambioEstadoCompra[] } = {}) =>
    compra("evento-a", "tipo-a-vip", estado, {
      id: "compra-sofia",
      compradorId: "usuario-sofia",
      cantidad: 2,
      total: 240000,
      ...cambios,
    });
  const canceladaDesdeConfirmada = () =>
    deSofia(EstadoCompra.CANCELADA, {
      historial: [
        { estado: EstadoCompra.PENDIENTE, autor: porSofia, fechaHora: AHORA },
        { estado: EstadoCompra.CONFIRMADA, autor: porSofia, fechaHora: AHORA },
        { estado: EstadoCompra.CANCELADA, autor: porSofia, fechaHora: AHORA },
      ],
    });

  /** Cancela como `usuarioId`, espera ese error y verifica que no se guardó nada y el cupo no cambió. */
  async function rechazo(compras: Compra[], usuarioId: string, esperado: object, reloj = relojFijo()) {
    const servicios = armar({ compras, reloj });
    const { compraService, cerrojo, repositorioCompras, repositorioEventos } = servicios;
    const cupoAntes = await cupoDe(repositorioEventos, "tipo-a-vip");
    const historialAntes = (await repositorioCompras.buscarPorId("compra-sofia"))?.historial;
    const guardarCompra = vi.spyOn(repositorioCompras, "guardar");
    const guardarEvento = vi.spyOn(repositorioEventos, "guardar");

    const error = await compraService.cancelar("compra-sofia", usuarioId).catch((e: unknown) => e);

    expect(error).toMatchObject(esperado);
    expect(guardarCompra).not.toHaveBeenCalled();
    expect(guardarEvento).not.toHaveBeenCalled();
    expect(await cupoDe(repositorioEventos, "tipo-a-vip")).toBe(cupoAntes);
    expect((await repositorioCompras.buscarPorId("compra-sofia"))?.historial).toEqual(historialAntes);
    expect(cerrojo.clavesActivas).toBe(0);
    return error;
  }

  it("una compra inexistente → 404 antes que el permiso (para cualquier usuario)", async () => {
    const { compraService, cerrojo } = armar({ compras: [deSofia(EstadoCompra.CONFIRMADA)] });
    for (const usuarioId of ["usuario-lucia", "usuario-sofia"]) {
      await expect(compraService.cancelar("no-existe", usuarioId)).rejects.toBeInstanceOf(
        CompraNoEncontradaError,
      );
    }
    expect(cerrojo.clavesActivas).toBe(0);
  });

  it("el organizador del evento → SinPermisoError, también sobre una CONFIRMADA cancelable", async () => {
    for (const estado of [EstadoCompra.CONFIRMADA, EstadoCompra.PENDIENTE]) {
      const error = await rechazo([deSofia(estado)], "usuario-lucia", {
        message: "Solo quien hizo la compra puede verla o pagarla.",
      });
      expect(error).toBeInstanceOf(SinPermisoError);
    }
  });

  it("CONFIRMADA con el reloj a la hora exacta de inicio → EVENTO_REALIZADO; 1 minuto antes → éxito", async () => {
    await rechazo(
      [deSofia(EstadoCompra.CONFIRMADA)],
      "usuario-sofia",
      { codigo: "EVENTO_REALIZADO", message: "El evento ya empezó: ya no se puede cancelar la compra." },
      relojFijo(INICIO),
    );
    const { compraService } = armar({
      compras: [deSofia(EstadoCompra.CONFIRMADA)],
      reloj: relojFijo(new Date(INICIO.getTime() - MINUTO)),
    });
    await expect(compraService.cancelar("compra-sofia", "usuario-sofia")).resolves.toMatchObject({
      estado: EstadoCompra.CANCELADA,
    });
  });

  it.each([
    [
      "UTILIZADA",
      () => deSofia(EstadoCompra.UTILIZADA),
      "Ya se usó una entrada de esta compra: no se puede cancelar.",
    ],
    ["CANCELADA desde confirmada", canceladaDesdeConfirmada, "La compra ya está cancelada."],
    ["CANCELADA sin pagar", () => deSofia(EstadoCompra.CANCELADA), "La compra ya está cancelada."],
    ["REEMBOLSADA", () => deSofia(EstadoCompra.REEMBOLSADA), "La compra ya fue reembolsada."],
  ])("%s → TRANSICION_INVALIDA sin guardar nada", async (_estado, crear, mensaje) => {
    await rechazo([crear()], "usuario-sofia", { codigo: "TRANSICION_INVALIDA", message: mensaje });
  });

  it("solo se guardan los vencimientos que hay que materializar, nunca la compra rechazada", async () => {
    const vencida = compra("evento-a", "tipo-a-general", EstadoCompra.PENDIENTE, {
      id: "compra-diego-vencida",
      compradorId: "usuario-diego",
      creadaEn: new Date(AHORA.getTime() - 20 * MINUTO),
    });
    const { compraService, repositorioCompras } = armar({
      compras: [deSofia(EstadoCompra.UTILIZADA), vencida],
    });
    const guardarCompra = vi.spyOn(repositorioCompras, "guardar");

    await expect(compraService.cancelar("compra-sofia", "usuario-sofia")).rejects.toMatchObject({
      codigo: "TRANSICION_INVALIDA",
    });

    const guardadas = guardarCompra.mock.calls.map(([guardada]) => guardada.id);
    expect(guardadas).toEqual(["compra-diego-vencida"]);
    expect((await repositorioCompras.buscarPorId("compra-sofia"))?.estado).toBe(EstadoCompra.UTILIZADA);
  });
});

describe("CompraService.confirmarReembolso (feature 009, US2, R5)", () => {
  const porSofia = { tipo: "usuario", usuarioId: "usuario-sofia" } as const;
  const enAhora = (
    estado: EstadoCompra,
    autor: CambioEstadoCompra["autor"] = porSofia,
  ): CambioEstadoCompra => ({
    estado,
    autor,
    fechaHora: AHORA,
  });
  const desdeConfirmada = [
    enAhora(EstadoCompra.PENDIENTE),
    enAhora(EstadoCompra.CONFIRMADA),
    enAhora(EstadoCompra.CANCELADA),
  ];
  const canceladaDeSofia = (eventoId = "evento-a", tipoEntradaId = "tipo-a-vip") =>
    compra(eventoId, tipoEntradaId, EstadoCompra.CANCELADA, {
      id: "compra-sofia",
      compradorId: "usuario-sofia",
      cantidad: 2,
      total: 240000,
      historial: desdeConfirmada,
    });
  const reembolsadaDeSofia = () =>
    compra("evento-a", "tipo-a-vip", EstadoCompra.REEMBOLSADA, {
      id: "compra-reembolsada",
      compradorId: "usuario-sofia",
      cantidad: 2,
      total: 240000,
      historial: [
        ...desdeConfirmada,
        enAhora(EstadoCompra.REEMBOLSADA, { tipo: "usuario", usuarioId: "usuario-lucia" }),
      ],
    });

  it("el organizador → la CompraDelEventoVista REEMBOLSADA con su comprador y sin códigos", async () => {
    const { compraService } = armar({ compras: [canceladaDeSofia()] });
    const vista = await compraService.confirmarReembolso("compra-sofia", "usuario-lucia");
    expect(vista).toMatchObject({
      id: "compra-sofia",
      comprador: { id: "usuario-sofia" },
      estado: EstadoCompra.REEMBOLSADA,
      canceladaPor: "usuario",
      canceladaDesde: "CONFIRMADA",
      reembolso: { estado: "confirmado", monto: 240000 },
    });
    expect(vista).not.toHaveProperty("entradas");
    expect(JSON.stringify(vista)).not.toContain("codigo");
  });

  it("guarda el REEMBOLSADA del organizador con la hora del reloj leída dentro del cerrojo", async () => {
    const reloj = relojMovible();
    const { compraService, cerrojo, repositorioCompras } = armar({ reloj, compras: [canceladaDeSofia()] });
    const ejecutar = cerrojo.ejecutar.bind(cerrojo);
    vi.spyOn(cerrojo, "ejecutar").mockImplementation((clave, operacion) => {
      reloj.avanzar(9 * MINUTO);
      return ejecutar(clave, operacion);
    });

    await compraService.confirmarReembolso("compra-sofia", "usuario-lucia");

    const guardada = await repositorioCompras.buscarPorId("compra-sofia");
    expect(guardada?.historial.at(-1)).toEqual({
      estado: EstadoCompra.REEMBOLSADA,
      autor: { tipo: "usuario", usuarioId: "usuario-lucia" },
      fechaHora: new Date(AHORA.getTime() + 9 * MINUTO),
    });
    expect(guardada?.entradas.every((entrada) => entrada.cambios.length === 1)).toBe(true);
  });

  it("un solo guardar de compras, ninguno de eventos, el cupo no cambia y el cerrojo se toma una vez", async () => {
    const { compraService, cerrojo, repositorioCompras, repositorioEventos } = armar({
      compras: [canceladaDeSofia()],
    });
    const ejecutar = vi.spyOn(cerrojo, "ejecutar");
    const guardarCompra = vi.spyOn(repositorioCompras, "guardar");
    const guardarEvento = vi.spyOn(repositorioEventos, "guardar");

    await compraService.confirmarReembolso("compra-sofia", "usuario-lucia");

    expect(ejecutar).toHaveBeenCalledTimes(1);
    expect(ejecutar).toHaveBeenCalledWith("evento-a", expect.any(Function));
    expect(guardarCompra).toHaveBeenCalledTimes(1);
    expect(guardarEvento).not.toHaveBeenCalled();
    expect(await cupoDe(repositorioEventos, "tipo-a-vip")).toBe(50);
    expect(cerrojo.clavesActivas).toBe(0);
  });

  it("con el evento ya realizado también se acepta (sin plazo)", async () => {
    const { compraService } = armar({ compras: [canceladaDeSofia("evento-pasado", "tipo-pasado-general")] });
    await expect(compraService.confirmarReembolso("compra-sofia", "usuario-lucia")).resolves.toMatchObject({
      estado: EstadoCompra.REEMBOLSADA,
    });
  });

  it("materializa los vencimientos pendientes del evento", async () => {
    const vencida = compra("evento-a", "tipo-a-general", EstadoCompra.PENDIENTE, {
      id: "compra-vencida",
      creadaEn: new Date(AHORA.getTime() - 20 * MINUTO),
    });
    const { compraService, repositorioCompras } = armar({ compras: [canceladaDeSofia(), vencida] });

    await compraService.confirmarReembolso("compra-sofia", "usuario-lucia");

    const guardada = await repositorioCompras.buscarPorId("compra-vencida");
    expect(guardada?.estado).toBe(EstadoCompra.CANCELADA);
    expect(guardada?.fueVencida()).toBe(true);
  });

  describe("orden de los rechazos: 404 → 403 → 409", () => {
    it("una compra inexistente → CompraNoEncontradaError", async () => {
      const { compraService } = armar();
      await expect(compraService.confirmarReembolso("no-existe", "usuario-lucia")).rejects.toBeInstanceOf(
        CompraNoEncontradaError,
      );
    });

    it.each(["usuario-sofia", "usuario-martin"])(
      "%s (no organiza el evento, también el comprador) → SinPermisoError, aunque ya esté reembolsada",
      async (usuarioId) => {
        const { compraService, repositorioCompras } = armar({
          compras: [canceladaDeSofia(), reembolsadaDeSofia()],
        });
        const guardar = vi.spyOn(repositorioCompras, "guardar");
        for (const id of ["compra-sofia", "compra-reembolsada"]) {
          await expect(compraService.confirmarReembolso(id, usuarioId)).rejects.toThrow(
            new SinPermisoError("Solo el organizador puede modificar este evento."),
          );
        }
        expect(guardar).not.toHaveBeenCalled();
      },
    );

    it("el organizador sobre una ya reembolsada → TRANSICION_INVALIDA y libera el cerrojo", async () => {
      const { compraService, cerrojo, repositorioCompras } = armar({ compras: [reembolsadaDeSofia()] });
      const guardar = vi.spyOn(repositorioCompras, "guardar");
      await expect(
        compraService.confirmarReembolso("compra-reembolsada", "usuario-lucia"),
      ).rejects.toMatchObject({
        codigo: "TRANSICION_INVALIDA",
        message: "El reembolso de esta compra ya se confirmó.",
      });
      expect(guardar).not.toHaveBeenCalled();
      expect(cerrojo.clavesActivas).toBe(0);
    });
  });
});
