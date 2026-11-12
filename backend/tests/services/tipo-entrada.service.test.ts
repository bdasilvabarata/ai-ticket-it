import { EstadoCompra } from "@ai-ticket-it/shared";
import { describe, expect, it, vi } from "vitest";
import type { Compra } from "../../src/domain/compra";
import type { Evento } from "../../src/domain/evento";
import { NoEncontradoError, SinPermisoError } from "../../src/errors/index";
import type { EventoService } from "../../src/services/evento.service";
import type { TipoEntradaService } from "../../src/services/tipo-entrada.service";
import { compra, DIA, evento, relojMovible, tipo } from "../helpers/eventos";
import { crearServicesDeEventos } from "../helpers/services-de-eventos";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const general = tipo({ id: "tipo-a-general", nombre: "General", precio: 1000, cupo: 10 });
const vip = tipo({ id: "tipo-a-vip", nombre: "VIP", precio: 5000, cupo: 2 });
const deOtroEvento = tipo({ id: "tipo-b-platea", nombre: "Platea" });

function crearService(compras: Compra[] = [], eventos: Evento[] = []) {
  const {
    tipoEntradaService: service,
    repositorioEventos,
    repositorioCompras,
  } = crearServicesDeEventos({
    eventos: [
      evento({ id: "evento-a", tiposEntrada: [general, vip] }),
      evento({ id: "evento-b", organizadorId: "usuario-martin", tiposEntrada: [deOtroEvento] }),
      evento({ id: "evento-pasado", en: -DIA, tiposEntrada: [tipo({ id: "tipo-pasado-general" })] }),
      ...eventos,
    ],
    compras,
  });
  return { service, repositorioEventos, repositorioCompras };
}

const datos = { nombre: "Platea", descripcion: "Butacas.", precio: 0, cupo: 100 };

/** Ejecuta cada operación con los mismos ids y verifica el error esperado de cada una. */
async function esperarEnLasTres(
  service: TipoEntradaService,
  [eventoId, tipoId, usuarioId]: [string, string, string],
  esperado: object,
  { tambienCrear = true } = {},
) {
  if (tambienCrear) await expect(service.crear(eventoId, usuarioId, datos)).rejects.toMatchObject(esperado);
  await expect(service.actualizar(eventoId, tipoId, usuarioId, datos)).rejects.toMatchObject(esperado);
  await expect(service.eliminar(eventoId, tipoId, usuarioId)).rejects.toMatchObject(esperado);
}

describe("TipoEntradaService", () => {
  it("crear agrega un tipo con un UUID nuevo y devuelve su vista", async () => {
    const { service, repositorioEventos } = crearService();
    const vista = await service.crear("evento-a", "usuario-lucia", datos);
    expect(vista).toEqual({ id: expect.stringMatching(UUID), ...datos });
    const guardado = await repositorioEventos.buscarPorId("evento-a");
    expect(guardado?.tiposEntrada.map((t) => t.nombre)).toEqual(["General", "VIP", "Platea"]);
  });

  it("actualizar edita el tipo y devuelve su vista; aceptar cupo 0 (agotado)", async () => {
    const { service } = crearService();
    expect(
      await service.actualizar("evento-a", "tipo-a-vip", "usuario-lucia", {
        ...datos,
        nombre: "VIP",
        cupo: 0,
      }),
    ).toEqual({ id: "tipo-a-vip", nombre: "VIP", descripcion: "Butacas.", precio: 0, cupo: 0 });
  });

  it("eliminar quita un tipo sin compras", async () => {
    const { service, repositorioEventos } = crearService();
    await service.eliminar("evento-a", "tipo-a-vip", "usuario-lucia");
    expect((await repositorioEventos.buscarPorId("evento-a"))?.tiposEntrada.map((t) => t.id)).toEqual([
      "tipo-a-general",
    ]);
  });

  it("404 EVENTO_NO_ENCONTRADO va primero", async () => {
    const { service } = crearService();
    await esperarEnLasTres(service, ["evento-x", "tipo-x", "usuario-martin"], {
      constructor: NoEncontradoError,
      codigo: "EVENTO_NO_ENCONTRADO",
    });
  });

  it("403 va antes que el 404 del tipo: a quien no organiza no se le revela qué tipos hay", async () => {
    const { service } = crearService();
    await esperarEnLasTres(service, ["evento-a", "tipo-inexistente", "usuario-martin"], {
      constructor: SinPermisoError,
      mensaje: "Solo el organizador puede modificar este evento.",
    });
  });

  it("404 TIPO_ENTRADA_NO_ENCONTRADO para un tipo inexistente o de otro evento (FR-023), antes que el 409", async () => {
    const { service } = crearService();
    for (const [eventoId, tipoId] of [
      ["evento-a", "tipo-inexistente"],
      ["evento-a", "tipo-b-platea"],
      ["evento-pasado", "tipo-a-general"],
    ] as const) {
      await esperarEnLasTres(
        service,
        [eventoId, tipoId, "usuario-lucia"],
        { constructor: NoEncontradoError, codigo: "TIPO_ENTRADA_NO_ENCONTRADO" },
        { tambienCrear: false },
      );
    }
  });

  it("409 EVENTO_REALIZADO en las tres operaciones", async () => {
    const { service } = crearService();
    await esperarEnLasTres(service, ["evento-pasado", "tipo-pasado-general", "usuario-lucia"], {
      codigo: "EVENTO_REALIZADO",
    });
  });

  it("TIPO_ENTRADA_CON_COMPRAS con una compra cancelada", async () => {
    const { service } = crearService([compra("evento-a", "tipo-a-vip", EstadoCompra.CANCELADA)]);
    await expect(service.eliminar("evento-a", "tipo-a-vip", "usuario-lucia")).rejects.toMatchObject({
      codigo: "TIPO_ENTRADA_CON_COMPRAS",
    });
  });

  it("cambiar el precio de un tipo con compras se acepta y el total de la compra no cambia (FR-015)", async () => {
    const compraVip = compra("evento-a", "tipo-a-vip");
    const { service } = crearService([compraVip]);
    await service.actualizar("evento-a", "tipo-a-vip", "usuario-lucia", {
      ...datos,
      nombre: "VIP",
      precio: 99999,
    });
    expect(compraVip.total).toBe(1000);
  });

  it("nada se guarda cuando falla", async () => {
    const { service, repositorioEventos } = crearService();
    const original = await repositorioEventos.buscarPorId("evento-a");
    await expect(
      service.crear("evento-a", "usuario-lucia", { ...datos, nombre: "vip" }),
    ).rejects.toMatchObject({
      codigo: "NOMBRE_TIPO_ENTRADA_REPETIDO",
    });
    await expect(
      service.actualizar("evento-a", "tipo-a-vip", "usuario-lucia", { ...datos, nombre: " GENERAL " }),
    ).rejects.toMatchObject({ codigo: "NOMBRE_TIPO_ENTRADA_REPETIDO" });
    await service.eliminar("evento-a", "tipo-a-vip", "usuario-lucia");
    await expect(service.eliminar("evento-a", "tipo-a-general", "usuario-lucia")).rejects.toMatchObject({
      codigo: "ULTIMO_TIPO_ENTRADA",
    });
    expect((await repositorioEventos.buscarPorId("evento-a"))?.tiposEntrada.map((t) => t.id)).toEqual([
      "tipo-a-general",
    ]);
    expect(original?.tiposEntrada).toHaveLength(2);
  });
});

describe("TipoEntradaService: materializa los vencimientos antes de escribir (feature 006, R3)", () => {
  const MINUTO = 60 * 1000;
  /** 2 VIP (cupo guardado 2) en una compra PENDIENTE desde AHORA: vence a los 15 minutos. */
  const vencida = () =>
    compra("evento-a", "tipo-a-vip", EstadoCompra.PENDIENTE, { id: "compra-vencida", cantidad: 2 });

  function armar() {
    const reloj = relojMovible();
    const servicios = crearServicesDeEventos({
      eventos: [evento({ id: "evento-a", tiposEntrada: [general, vip] })],
      compras: [vencida()],
      reloj,
    });
    reloj.avanzar(15 * MINUTO);
    return { reloj, ...servicios };
  }

  const cupoVip = async (eventoService: EventoService) =>
    (await eventoService.obtener("evento-a")).tiposEntrada.find((t) => t.id === "tipo-a-vip")?.cupo;

  it("actualizar: editar el cupo de un tipo con una compra vencida guarda el cupo pedido, sin volver a sumar las vencidas", async () => {
    const { reloj, tipoEntradaService, eventoService, repositorioCompras } = armar();
    expect(await cupoVip(eventoService)).toBe(4);
    const ahora = vi.spyOn(reloj, "ahora");

    await tipoEntradaService.actualizar("evento-a", "tipo-a-vip", "usuario-lucia", {
      nombre: "VIP",
      descripcion: "",
      precio: 5000,
      cupo: 4,
    });

    expect(ahora).toHaveBeenCalledTimes(1);
    expect((await repositorioCompras.buscarPorId("compra-vencida"))?.fueVencida()).toBe(true);
    expect(await cupoVip(eventoService)).toBe(4);
  });

  it("crear: materializa antes de agregar el tipo y el cupo devuelto queda guardado", async () => {
    const { reloj, tipoEntradaService, repositorioEventos, repositorioCompras } = armar();
    const ahora = vi.spyOn(reloj, "ahora");
    await tipoEntradaService.crear("evento-a", "usuario-lucia", datos);
    expect(ahora).toHaveBeenCalledTimes(1);
    expect((await repositorioCompras.buscarPorId("compra-vencida"))?.fueVencida()).toBe(true);
    const guardado = await repositorioEventos.buscarPorId("evento-a");
    expect(guardado?.buscarTipoEntrada("tipo-a-vip")?.cupo).toBe(4);
    expect(guardado?.tiposEntrada).toHaveLength(3);
  });

  it("eliminar: quitar un tipo cuya única compra está vencida sigue rechazado (toda compra cuenta)", async () => {
    const { reloj, tipoEntradaService, repositorioEventos, repositorioCompras } = armar();
    const ahora = vi.spyOn(reloj, "ahora");
    await expect(
      tipoEntradaService.eliminar("evento-a", "tipo-a-vip", "usuario-lucia"),
    ).rejects.toMatchObject({
      codigo: "TIPO_ENTRADA_CON_COMPRAS",
    });
    expect(ahora).toHaveBeenCalledTimes(1);
    expect((await repositorioCompras.buscarPorId("compra-vencida"))?.fueVencida()).toBe(true);
    expect((await repositorioEventos.buscarPorId("evento-a"))?.buscarTipoEntrada("tipo-a-vip")?.cupo).toBe(4);
  });
});
