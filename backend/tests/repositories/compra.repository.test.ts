import { EstadoCompra } from "@ai-ticket-it/shared";
import { describe, expect, it } from "vitest";
import { ALFABETO_DE_CODIGO, esCodigoValido } from "../../src/domain/codigo-de-entrada";
import { Compra, Entrada } from "../../src/domain/compra";
import { CompraRepository } from "../../src/repositories/compra.repository";
import { entradasDePrueba, historialHasta } from "../helpers/eventos";

function compra(
  id: string,
  estado: EstadoCompra,
  eventoId = "evento-a",
  tipoEntradaId = "tipo-a-general",
  compradorId = "usuario-martin",
) {
  return new Compra({
    id,
    compradorId,
    eventoId,
    tipoEntradaId,
    cantidad: 1,
    total: 1000,
    historial: historialHasta(estado, compradorId),
    entradas: entradasDePrueba(1),
  });
}

describe("CompraRepository (en memoria)", () => {
  it("existePorEvento y existePorTipoEntrada son falsos sin compras", async () => {
    const repositorio = new CompraRepository();
    expect(await repositorio.existePorEvento("evento-a")).toBe(false);
    expect(await repositorio.existePorTipoEntrada("tipo-a-general")).toBe(false);
  });

  it.each(Object.values(EstadoCompra))("una compra %s cuenta (cualquier estado)", async (estado) => {
    const repositorio = new CompraRepository([compra("compra-1", estado)]);
    expect(await repositorio.existePorEvento("evento-a")).toBe(true);
    expect(await repositorio.existePorTipoEntrada("tipo-a-general")).toBe(true);
  });

  it("solo cuenta las compras de ese evento o de ese tipo", async () => {
    const repositorio = new CompraRepository([compra("compra-1", EstadoCompra.CONFIRMADA)]);
    expect(await repositorio.existePorEvento("evento-b")).toBe(false);
    expect(await repositorio.existePorTipoEntrada("tipo-a-vip")).toBe(false);
  });

  it("guardar agrega una compra", async () => {
    const repositorio = new CompraRepository();
    await repositorio.guardar(compra("compra-1", EstadoCompra.PENDIENTE, "evento-b", "tipo-b-vip"));
    expect(await repositorio.existePorEvento("evento-b")).toBe(true);
    expect(await repositorio.existePorTipoEntrada("tipo-b-vip")).toBe(true);
  });

  it("siguienteId da UUID v4 distintos", () => {
    const repositorio = new CompraRepository();
    const ids = new Set(Array.from({ length: 20 }, () => repositorio.siguienteId()));
    expect(ids.size).toBe(20);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });

  it("buscarPorId devuelve la compra o null", async () => {
    const guardada = compra("compra-1", EstadoCompra.CONFIRMADA);
    const repositorio = new CompraRepository([guardada]);
    expect(await repositorio.buscarPorId("compra-1")).toBe(guardada);
    expect(await repositorio.buscarPorId("compra-2")).toBeNull();
  });

  it("listarPorEventoYComprador: solo las de esa persona en ese evento, en cualquier estado", async () => {
    const repositorio = new CompraRepository([
      compra("pendiente", EstadoCompra.PENDIENTE),
      compra("cancelada", EstadoCompra.CANCELADA),
      compra("de-diego", EstadoCompra.CONFIRMADA, "evento-a", "tipo-a-general", "usuario-diego"),
      compra("otro-evento", EstadoCompra.CONFIRMADA, "evento-b", "tipo-b-vip"),
    ]);
    const ids = (await repositorio.listarPorEventoYComprador("evento-a", "usuario-martin")).map((c) => c.id);
    expect(ids.toSorted()).toEqual(["cancelada", "pendiente"]);
    expect(await repositorio.listarPorEventoYComprador("evento-c", "usuario-martin")).toEqual([]);
  });

  it("listarPorComprador: las de esa persona en todos los eventos y en cualquier estado", async () => {
    const repositorio = new CompraRepository([
      compra("a-pendiente", EstadoCompra.PENDIENTE),
      compra("a-confirmada", EstadoCompra.CONFIRMADA),
      compra("b-cancelada", EstadoCompra.CANCELADA, "evento-b", "tipo-b-vip"),
      compra("de-diego", EstadoCompra.CONFIRMADA, "evento-a", "tipo-a-general", "usuario-diego"),
      compra("de-diego-b", EstadoCompra.PENDIENTE, "evento-b", "tipo-b-vip", "usuario-diego"),
    ]);
    const ids = (await repositorio.listarPorComprador("usuario-martin")).map((c) => c.id);
    expect(ids.toSorted()).toEqual(["a-confirmada", "a-pendiente", "b-cancelada"]);
  });

  it("listarPorComprador: un comprador sin compras → []", async () => {
    const repositorio = new CompraRepository([compra("compra-1", EstadoCompra.CONFIRMADA)]);
    expect(await repositorio.listarPorComprador("usuario-lucia")).toEqual([]);
    expect(await new CompraRepository().listarPorComprador("usuario-martin")).toEqual([]);
  });

  it("listarPendientesPorEventos: solo las guardadas PENDIENTE (vencidas o no) de esos eventos", async () => {
    const hace1Dia = new Date("2026-11-09T15:00:00.000Z");
    const repositorio = new CompraRepository([
      compra("a-pendiente", EstadoCompra.PENDIENTE),
      new Compra({
        id: "a-pendiente-vencida",
        compradorId: "usuario-diego",
        eventoId: "evento-a",
        tipoEntradaId: "tipo-a-general",
        cantidad: 2,
        total: 2000,
        historial: historialHasta(EstadoCompra.PENDIENTE, "usuario-diego", hace1Dia),
        entradas: entradasDePrueba(2),
      }),
      compra("a-confirmada", EstadoCompra.CONFIRMADA),
      compra("a-cancelada", EstadoCompra.CANCELADA),
      compra("b-pendiente", EstadoCompra.PENDIENTE, "evento-b", "tipo-b-vip"),
      compra("c-pendiente", EstadoCompra.PENDIENTE, "evento-c", "tipo-c-vip"),
    ]);
    const ids = (await repositorio.listarPendientesPorEventos(["evento-a", "evento-b"])).map((c) => c.id);
    expect(ids.toSorted()).toEqual(["a-pendiente", "a-pendiente-vencida", "b-pendiente"]);
    expect(await repositorio.listarPendientesPorEventos([])).toEqual([]);
  });

  it("listarPorEvento: todas las de ese evento, de todos los compradores y en cualquier estado", async () => {
    const repositorio = new CompraRepository([
      compra("a-pendiente", EstadoCompra.PENDIENTE),
      compra("a-cancelada", EstadoCompra.CANCELADA),
      compra("a-utilizada", EstadoCompra.UTILIZADA, "evento-a", "tipo-a-general", "usuario-sofia"),
      compra("a-de-diego", EstadoCompra.CONFIRMADA, "evento-a", "tipo-a-vip", "usuario-diego"),
      compra("b-confirmada", EstadoCompra.CONFIRMADA, "evento-b", "tipo-b-vip"),
    ]);
    const ids = (await repositorio.listarPorEvento("evento-a")).map((c) => c.id);
    expect(ids.toSorted()).toEqual(["a-cancelada", "a-de-diego", "a-pendiente", "a-utilizada"]);
  });

  it("listarPorEvento: un evento sin compras → []", async () => {
    const repositorio = new CompraRepository([compra("compra-1", EstadoCompra.CONFIRMADA)]);
    expect(await repositorio.listarPorEvento("evento-b")).toEqual([]);
    expect(await new CompraRepository().listarPorEvento("evento-a")).toEqual([]);
  });

  it("guardar reemplaza la instancia del mismo id", async () => {
    const pendiente = compra("compra-1", EstadoCompra.PENDIENTE);
    const repositorio = new CompraRepository([pendiente]);
    const vencida = pendiente.vencer();
    await repositorio.guardar(vencida);
    expect(await repositorio.buscarPorId("compra-1")).toBe(vencida);
    expect(await repositorio.listarPendientesPorEventos(["evento-a"])).toEqual([]);
  });

  it("una compra vencida (CANCELADA por el sistema) sigue contando para existePorEvento y existePorTipoEntrada", async () => {
    const repositorio = new CompraRepository([compra("compra-1", EstadoCompra.PENDIENTE).vencer()]);
    expect(await repositorio.existePorEvento("evento-a")).toBe(true);
    expect(await repositorio.existePorTipoEntrada("tipo-a-general")).toBe(true);
  });

  it("dos instancias no comparten estado", async () => {
    const iniciales = [compra("compra-1", EstadoCompra.CONFIRMADA)];
    const primero = new CompraRepository(iniciales);
    const segundo = new CompraRepository(iniciales);
    await primero.guardar(compra("compra-2", EstadoCompra.CONFIRMADA, "evento-b", "tipo-b-vip"));
    expect(await segundo.existePorEvento("evento-b")).toBe(false);
  });

  describe("siguientesCodigosDeEntrada (feature 008, R2)", () => {
    it("devuelve `cantidad` códigos válidos", () => {
      const codigos = new CompraRepository().siguientesCodigosDeEntrada(3);
      expect(codigos).toHaveLength(3);
      expect(codigos.every(esCodigoValido)).toBe(true);
    });

    it("son distintos entre sí", () => {
      const codigos = new CompraRepository().siguientesCodigosDeEntrada(50);
      expect(new Set(codigos).size).toBe(50);
    });

    /** Un generador que da, carácter por carácter, los códigos dados en orden. */
    const darCodigos = (...codigos: string[]) => {
      const indices = codigos
        .join("")
        .split("")
        .map((caracter) => ALFABETO_DE_CODIGO.indexOf(caracter));
      return () => {
        const indice = indices.shift();
        if (indice === undefined) throw new Error("El generador se quedó sin códigos.");
        return indice;
      };
    };

    it("reintenta si el código ya está guardado en otra compra", () => {
      const guardada = new Compra({
        id: "compra-guardada",
        compradorId: "usuario-martin",
        eventoId: "evento-a",
        tipoEntradaId: "tipo-a-general",
        cantidad: 1,
        total: 1000,
        historial: historialHasta(EstadoCompra.CONFIRMADA, "usuario-martin"),
        entradas: [new Entrada({ codigo: "AAAAAAAA" })],
      });
      const repositorio = new CompraRepository([guardada], darCodigos("AAAAAAAA", "BBBBBBBB"));
      expect(repositorio.siguientesCodigosDeEntrada(1)).toEqual(["BBBBBBBB"]);
    });

    it("reintenta si el código ya salió en el mismo pedido", () => {
      const repositorio = new CompraRepository([], darCodigos("CCCCCCCC", "CCCCCCCC", "DDDDDDDD"));
      expect(repositorio.siguientesCodigosDeEntrada(2)).toEqual(["CCCCCCCC", "DDDDDDDD"]);
    });
  });
});
