import { EstadoCompra } from "@ai-ticket-it/shared";
import { describe, expect, it } from "vitest";
import { Compra } from "../../src/domain/compra";
import { CompraRepository } from "../../src/repositories/compra.repository";

function compra(id: string, estado: EstadoCompra, eventoId = "evento-a", tipoEntradaId = "tipo-a-general") {
  return new Compra({
    id,
    compradorId: "usuario-martin",
    eventoId,
    tipoEntradaId,
    cantidad: 1,
    total: 1000,
    estado,
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

  it("dos instancias no comparten estado", async () => {
    const iniciales = [compra("compra-1", EstadoCompra.CONFIRMADA)];
    const primero = new CompraRepository(iniciales);
    const segundo = new CompraRepository(iniciales);
    await primero.guardar(compra("compra-2", EstadoCompra.CONFIRMADA, "evento-b", "tipo-b-vip"));
    expect(await segundo.existePorEvento("evento-b")).toBe(false);
  });
});
