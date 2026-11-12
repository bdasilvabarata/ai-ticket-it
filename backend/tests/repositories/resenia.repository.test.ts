import { describe, expect, it } from "vitest";
import { Resenia } from "../../src/domain/resenia";
import { ReseniaRepository } from "../../src/repositories/resenia.repository";

function resenia(id: string, eventoId: string, puntuacion = 4) {
  return new Resenia({ id, compradorId: "usuario-diego", eventoId, puntuacion });
}

describe("ReseniaRepository (en memoria)", () => {
  const r1 = resenia("r1", "evento-a");
  const r2 = resenia("r2", "evento-b");
  const r3 = resenia("r3", "evento-c");

  it("listarPorEventos devuelve solo las reseñas de los eventos pedidos", async () => {
    const repositorio = new ReseniaRepository([r1, r2, r3]);
    expect(await repositorio.listarPorEventos(["evento-a", "evento-c"])).toEqual([r1, r3]);
  });

  it("sin ids o con ids sin reseñas devuelve []", async () => {
    const repositorio = new ReseniaRepository([r1]);
    expect(await repositorio.listarPorEventos([])).toEqual([]);
    expect(await repositorio.listarPorEventos(["evento-z"])).toEqual([]);
    expect(await new ReseniaRepository().listarPorEventos(["evento-a"])).toEqual([]);
  });

  it("dos instancias no comparten estado", async () => {
    const iniciales = [r1];
    const primero = new ReseniaRepository(iniciales);
    iniciales.push(r2);
    const segundo = new ReseniaRepository(iniciales);
    expect(await primero.listarPorEventos(["evento-b"])).toEqual([]);
    expect(await segundo.listarPorEventos(["evento-b"])).toEqual([r2]);
  });
});
