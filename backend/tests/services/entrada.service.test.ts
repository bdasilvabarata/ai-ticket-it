import { EstadoCompra } from "@ai-ticket-it/shared";
import { describe, expect, it, vi } from "vitest";
import type { Compra } from "../../src/domain/compra";
import { ReglaDeNegocioError } from "../../src/domain/errores";
import { EntradaNoEncontradaError, NoEncontradoError, SinPermisoError } from "../../src/errors/index";
import { AHORA, HORA, compra, evento, relojMovible, tipo } from "../helpers/eventos";
import { crearServicesDeEventos } from "../helpers/services-de-eventos";

const MINUTO = 60 * 1000;

const general = tipo({ id: "tipo-a-general", nombre: "General", precio: 6000, cupo: 10 });

/**
 * El evento de Lucía empieza 2 h después de AHORA: su ventana de uso va de AHORA − 2 h a AHORA + 14 h.
 * Otro evento de Lucía, en 5 días, con la ventana cerrada.
 */
function armar({ compras = [] as Compra[], reloj = relojMovible() } = {}) {
  const servicios = crearServicesDeEventos({
    eventos: [
      evento({ id: "evento-a", nombre: "Peña", en: 2 * HORA, tiposEntrada: [general] }),
      evento({
        id: "evento-b",
        nombre: "Festival",
        tiposEntrada: [tipo({ id: "tipo-b-vip", nombre: "VIP" })],
      }),
    ],
    compras,
    reloj,
  });
  return { ...servicios, reloj };
}

/** Una compra de Martín de 3 General del evento A en `estado`. */
const deMartin = (estado: EstadoCompra = EstadoCompra.CONFIRMADA, cambios = {}) =>
  compra("evento-a", "tipo-a-general", estado, { id: `compra-martin-${estado}`, cantidad: 3, ...cambios });
const codigoDe = (c: Compra, i = 0) => c.entradas[i]!.codigo;
/** El código con minúsculas y un guion en el medio, como lo podría tipear el organizador. */
const tipeado = (codigo: string) => `${codigo.slice(0, 4).toLowerCase()}-${codigo.slice(4).toLowerCase()}`;

describe("EntradaService.obtener (feature 008, lectura)", () => {
  it("normaliza el código y devuelve la entrada, su compra y la ventana de uso", async () => {
    const confirmada = deMartin();
    const { entradaService } = armar({ compras: [confirmada] });

    const vista = await entradaService.obtener("evento-a", tipeado(codigoDe(confirmada)), "usuario-lucia");

    expect(vista).toEqual({
      codigo: codigoDe(confirmada),
      estado: EstadoCompra.CONFIRMADA,
      usadaEn: null,
      usadaEnLocal: null,
      compra: {
        id: confirmada.id,
        comprador: { id: "usuario-martin", nombre: "Martín", apellido: "Benítez" },
        tipoEntrada: { id: "tipo-a-general", nombre: "General" },
        cantidad: 3,
        estado: EstadoCompra.CONFIRMADA,
        entradasUsadas: 0,
      },
      ventanaDeUso: {
        desde: "2026-11-10T13:00:00.000Z",
        hasta: "2026-11-11T05:00:00.000Z",
        desdeLocal: "2026-11-10T10:00",
        hastaLocal: "2026-11-11T02:00",
        estado: "abierta",
      },
    });
  });

  it("también encuentra el código con espacios", async () => {
    const confirmada = deMartin();
    const { entradaService } = armar({ compras: [confirmada] });
    const codigo = codigoDe(confirmada);
    const vista = await entradaService.obtener(
      "evento-a",
      ` ${codigo.slice(0, 4)} ${codigo.slice(4)} `,
      "usuario-lucia",
    );
    expect(vista.codigo).toBe(codigo);
  });

  it("una entrada no usable no es error: devuelve su estado al día (una pendiente vencida → CANCELADA)", async () => {
    const pendiente = deMartin(EstadoCompra.PENDIENTE);
    const { entradaService, reloj } = armar({ compras: [pendiente] });
    expect((await entradaService.obtener("evento-a", codigoDe(pendiente), "usuario-lucia")).estado).toBe(
      EstadoCompra.PENDIENTE,
    );
    reloj.avanzar(15 * MINUTO);
    const vista = await entradaService.obtener("evento-a", codigoDe(pendiente), "usuario-lucia");
    expect(vista.estado).toBe(EstadoCompra.CANCELADA);
    expect(vista.compra.estado).toBe(EstadoCompra.CANCELADA);
  });

  it("orden de chequeos: 404 evento → 403 → 404 entrada", async () => {
    const confirmada = deMartin();
    const { entradaService } = armar({ compras: [confirmada] });
    await expect(entradaService.obtener("evento-x", "ZZZZZZZZ", "usuario-martin")).rejects.toBeInstanceOf(
      NoEncontradoError,
    );
    await expect(entradaService.obtener("evento-a", "ZZZZZZZZ", "usuario-martin")).rejects.toMatchObject({
      codigo: "SIN_PERMISO",
      mensaje: "Solo el organizador del evento puede ver sus compras.",
    });
    await expect(entradaService.obtener("evento-a", "ZZZZZZZZ", "usuario-lucia")).rejects.toBeInstanceOf(
      EntradaNoEncontradaError,
    );
  });

  it("un código con formato inválido o de otro evento → el mismo 404, sin datos del otro", async () => {
    const delFestival = compra("evento-b", "tipo-b-vip", EstadoCompra.CONFIRMADA, { id: "del-festival" });
    const { entradaService } = armar({ compras: [delFestival] });
    for (const codigo of ["abc", "7K3M-Q9TI", codigoDe(delFestival)]) {
      await expect(entradaService.obtener("evento-a", codigo, "usuario-lucia")).rejects.toMatchObject({
        codigo: "ENTRADA_NO_ENCONTRADA",
        mensaje: "No hay ninguna entrada con ese código en este evento.",
      });
    }
  });

  it("es una lectura: sin cerrojo y sin guardar nada", async () => {
    const pendiente = deMartin(EstadoCompra.PENDIENTE);
    const { entradaService, cerrojo, repositorioCompras, repositorioEventos, reloj } = armar({
      compras: [pendiente],
    });
    const ejecutar = vi.spyOn(cerrojo, "ejecutar");
    const guardarCompra = vi.spyOn(repositorioCompras, "guardar");
    const guardarEvento = vi.spyOn(repositorioEventos, "guardar");
    reloj.avanzar(15 * MINUTO);
    await entradaService.obtener("evento-a", codigoDe(pendiente), "usuario-lucia");
    expect(ejecutar).not.toHaveBeenCalled();
    expect(guardarCompra).not.toHaveBeenCalled();
    expect(guardarEvento).not.toHaveBeenCalled();
  });
});

describe("EntradaService.registrarUso (feature 008, escritura bajo el cerrojo)", () => {
  /** El error de dominio con el que rechaza `promesa`. */
  async function rechazo(promesa: Promise<unknown>): Promise<ReglaDeNegocioError> {
    try {
      await promesa;
    } catch (error) {
      expect(error).toBeInstanceOf(ReglaDeNegocioError);
      return error as ReglaDeNegocioError;
    }
    throw new Error("Debía rechazar con ReglaDeNegocioError.");
  }

  it("la entrada y la compra pasan a UTILIZADA por Lucía con el reloj leído dentro del cerrojo", async () => {
    const confirmada = deMartin();
    const { entradaService, cerrojo, reloj, repositorioCompras } = armar({ compras: [confirmada] });
    const ejecutar = vi.spyOn(cerrojo, "ejecutar").mockImplementation(async (_clave, operacion) => {
      reloj.avanzar(MINUTO); // el reloj se mueve mientras espera el cerrojo
      return operacion();
    });

    const vista = await entradaService.registrarUso(
      "evento-a",
      tipeado(codigoDe(confirmada)),
      "usuario-lucia",
    );

    const enElCerrojo = new Date(AHORA.getTime() + MINUTO);
    expect(ejecutar).toHaveBeenCalledTimes(1);
    expect(ejecutar.mock.calls[0]![0]).toBe("evento-a");
    expect(vista).toMatchObject({
      codigo: codigoDe(confirmada),
      estado: EstadoCompra.UTILIZADA,
      usadaEn: enElCerrojo.toISOString(),
      compra: { estado: EstadoCompra.UTILIZADA, entradasUsadas: 1 },
    });
    const guardada = (await repositorioCompras.buscarPorId(confirmada.id))!;
    expect(guardada.estado).toBe(EstadoCompra.UTILIZADA);
    expect(guardada.historial.at(-1)).toEqual({
      estado: EstadoCompra.UTILIZADA,
      autor: { tipo: "usuario", usuarioId: "usuario-lucia" },
      fechaHora: enElCerrojo,
    });
    expect(guardada.estadoDeEntrada(codigoDe(confirmada, 1))).toBe(EstadoCompra.CONFIRMADA);
  });

  it("una segunda entrada de la misma compra: queda usada y la compra no suma otro cambio", async () => {
    const confirmada = deMartin();
    const { entradaService, repositorioCompras } = armar({ compras: [confirmada] });
    await entradaService.registrarUso("evento-a", codigoDe(confirmada, 0), "usuario-lucia");
    const vista = await entradaService.registrarUso("evento-a", codigoDe(confirmada, 1), "usuario-lucia");
    expect(vista.compra.entradasUsadas).toBe(2);
    const guardada = (await repositorioCompras.buscarPorId(confirmada.id))!;
    expect(guardada.historial.filter((c) => c.estado === EstadoCompra.UTILIZADA)).toHaveLength(1);
  });

  it("un solo guardar (la compra) y el cupo del evento no cambia (FR-009)", async () => {
    const confirmada = deMartin();
    const { entradaService, repositorioCompras, repositorioEventos } = armar({ compras: [confirmada] });
    const guardarCompra = vi.spyOn(repositorioCompras, "guardar");
    const guardarEvento = vi.spyOn(repositorioEventos, "guardar");
    await entradaService.registrarUso("evento-a", codigoDe(confirmada), "usuario-lucia");
    expect(guardarCompra).toHaveBeenCalledTimes(1);
    expect(guardarEvento).not.toHaveBeenCalled();
    expect(
      (await repositorioEventos.buscarPorId("evento-a"))?.buscarTipoEntrada("tipo-a-general")?.cupo,
    ).toBe(10);
  });

  it("orden de chequeos: 404 evento → 403 → 404 entrada → FUERA_DE_HORARIO_DE_USO → TRANSICION_INVALIDA", async () => {
    const pendienteDelFestival = compra("evento-b", "tipo-b-vip", EstadoCompra.PENDIENTE, { id: "festival" });
    const usada = deMartin();
    const { entradaService } = armar({ compras: [pendienteDelFestival, usada] });
    await entradaService.registrarUso("evento-a", codigoDe(usada), "usuario-lucia");

    await expect(
      entradaService.registrarUso("evento-x", "ZZZZZZZZ", "usuario-martin"),
    ).rejects.toBeInstanceOf(NoEncontradoError);
    await expect(
      entradaService.registrarUso("evento-a", "ZZZZZZZZ", "usuario-martin"),
    ).rejects.toBeInstanceOf(SinPermisoError);
    await expect(entradaService.registrarUso("evento-a", "ZZZZZZZZ", "usuario-lucia")).rejects.toBeInstanceOf(
      EntradaNoEncontradaError,
    );
    // Una PENDIENTE fuera de la ventana: el de la ventana va primero.
    const fuera = await rechazo(
      entradaService.registrarUso("evento-b", codigoDe(pendienteDelFestival), "usuario-lucia"),
    );
    expect(fuera.codigo).toBe("FUERA_DE_HORARIO_DE_USO");
    expect(fuera.message).toBe("El ingreso se registra desde el 15/11 08:00 hasta el 16/11 00:00.");
    const yaUsada = await rechazo(entradaService.registrarUso("evento-a", codigoDe(usada), "usuario-lucia"));
    expect(yaUsada).toMatchObject({ codigo: "TRANSICION_INVALIDA", message: "Esta entrada ya se utilizó." });
  });

  it.each([
    ["exactamente 4 h antes del inicio", -2 * HORA, true],
    ["1 minuto antes de la ventana", -2 * HORA - MINUTO, false],
    ["exactamente 12 h después del inicio", 14 * HORA, true],
    ["1 minuto después de la ventana", 14 * HORA + MINUTO, false],
  ])("bordes de la ventana: %s", async (_caso, desfase, acepta) => {
    const confirmada = deMartin(EstadoCompra.CONFIRMADA, { creadaEn: new Date(AHORA.getTime() - 3 * HORA) });
    const { entradaService } = armar({
      compras: [confirmada],
      reloj: relojMovible(new Date(AHORA.getTime() + desfase)),
    });
    const uso = entradaService.registrarUso("evento-a", codigoDe(confirmada), "usuario-lucia");
    if (acepta) {
      await expect(uso).resolves.toMatchObject({ estado: EstadoCompra.UTILIZADA });
    } else {
      expect((await rechazo(uso)).codigo).toBe("FUERA_DE_HORARIO_DE_USO");
    }
  });

  it("una pendiente vencida sin materializar → TRANSICION_INVALIDA «…está cancelada.» y queda materializada", async () => {
    const pendiente = deMartin(EstadoCompra.PENDIENTE);
    const { entradaService, reloj, repositorioCompras } = armar({ compras: [pendiente] });
    reloj.avanzar(15 * MINUTO);
    const error = await rechazo(
      entradaService.registrarUso("evento-a", codigoDe(pendiente), "usuario-lucia"),
    );
    expect(error).toMatchObject({
      codigo: "TRANSICION_INVALIDA",
      message: "La compra de esta entrada está cancelada.",
    });
    const guardada = (await repositorioCompras.buscarPorId(pendiente.id))!;
    expect(guardada.estado).toBe(EstadoCompra.CANCELADA);
    expect(guardada.fueVencida()).toBe(true);
  });

  it("toma el cerrojo del evento una vez y lo libera también ante un error", async () => {
    const pendiente = deMartin(EstadoCompra.PENDIENTE);
    const { entradaService, cerrojo } = armar({ compras: [pendiente] });
    const ejecutar = vi.spyOn(cerrojo, "ejecutar");
    await rechazo(entradaService.registrarUso("evento-a", codigoDe(pendiente), "usuario-lucia"));
    expect(ejecutar).toHaveBeenCalledTimes(1);
    // Liberado: otra operación sobre el mismo evento no queda esperando.
    await expect(cerrojo.ejecutar("evento-a", async () => "libre")).resolves.toBe("libre");
  });
});
