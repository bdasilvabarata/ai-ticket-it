import { describe, expect, it } from "vitest";
import { Resenia } from "../../src/domain/resenia";
import { ReseniaRepository } from "../../src/repositories/resenia.repository";

function resenia(id: string, eventoId: string, compradorId = "usuario-diego", puntuacion = 4) {
  return new Resenia({ id, compradorId, eventoId, puntuacion, comentario: null, creadaEn: new Date() });
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

  it("siguienteId da UUIDs distintos", () => {
    const repositorio = new ReseniaRepository();
    const a = repositorio.siguienteId();
    const b = repositorio.siguienteId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });

  it("guardar agrega una nueva y reemplaza la del mismo id", async () => {
    const repositorio = new ReseniaRepository([r1]);
    await repositorio.guardar(r2);
    const r1Nueva = resenia("r1", "evento-a", "usuario-diego", 2);
    await repositorio.guardar(r1Nueva);
    expect(await repositorio.listarPorEventos(["evento-a", "evento-b"])).toEqual([r1Nueva, r2]);
  });

  it("buscarPorEventoYComprador encuentra la del par exacto o da null", async () => {
    const deMartin = resenia("r4", "evento-a", "usuario-martin");
    const repositorio = new ReseniaRepository([r1, r2, deMartin]);
    expect(await repositorio.buscarPorEventoYComprador("evento-a", "usuario-martin")).toBe(deMartin);
    expect(await repositorio.buscarPorEventoYComprador("evento-a", "usuario-diego")).toBe(r1);
    expect(await repositorio.buscarPorEventoYComprador("evento-b", "usuario-martin")).toBeNull();
    expect(await repositorio.buscarPorEventoYComprador("evento-z", "usuario-diego")).toBeNull();
  });

  it("listarPorComprador trae las de todos los eventos de ese autor, o []", async () => {
    const deMartin = resenia("r4", "evento-a", "usuario-martin");
    const repositorio = new ReseniaRepository([r1, r2, deMartin]);
    expect(await repositorio.listarPorComprador("usuario-diego")).toEqual([r1, r2]);
    expect(await repositorio.listarPorComprador("usuario-sofia")).toEqual([]);
  });

  it("no expone su colección interna: modificar lo devuelto no cambia el repositorio", async () => {
    const repositorio = new ReseniaRepository([r1]);
    (await repositorio.listarPorComprador("usuario-diego")).push(r2);
    (await repositorio.listarPorEventos(["evento-a", "evento-b"])).push(r3);
    expect(await repositorio.listarPorComprador("usuario-diego")).toEqual([r1]);
    expect("eliminarPorId" in repositorio).toBe(false);
  });
});
