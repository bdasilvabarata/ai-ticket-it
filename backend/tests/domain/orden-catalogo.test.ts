import { describe, expect, it } from "vitest";
import { ordenarCatalogo, type Ordenable } from "../../src/domain/orden-catalogo";

const BASE = new Date("2026-12-01T00:00:00.000Z").getTime();
const DIA = 24 * 60 * 60 * 1000;

function elemento(
  id: string,
  cambios: { nombre?: string; dia?: number; precio?: number; puntaje?: number | null } = {},
) {
  return {
    id,
    nombre: cambios.nombre ?? `Evento ${id}`,
    fechaHora: new Date(BASE + (cambios.dia ?? 0) * DIA),
    precioDesde: cambios.precio ?? 1000,
    puntaje: cambios.puntaje === undefined ? null : cambios.puntaje,
  } satisfies Ordenable;
}

const ids = (lista: readonly Ordenable[]) => lista.map((e) => e.id);

describe("ordenarCatalogo: fecha", () => {
  it("ordena por fechaHora ascendente", () => {
    const lista = [elemento("c", { dia: 3 }), elemento("a", { dia: 1 }), elemento("b", { dia: 2 })];
    expect(ids(ordenarCatalogo(lista, "fecha"))).toEqual(["a", "b", "c"]);
  });

  it("con la misma fecha desempata por nombre sin mayúsculas ni tildes", () => {
    const lista = [
      elemento("1", { nombre: "Zamba" }),
      elemento("2", { nombre: "álvarez en vivo" }),
      elemento("3", { nombre: "Banda" }),
    ];
    expect(ids(ordenarCatalogo(lista, "fecha"))).toEqual(["2", "3", "1"]);
  });

  it("con el mismo nombre (sin distinguir tildes ni mayúsculas) y la misma fecha desempata por id", () => {
    const lista = [elemento("b", { nombre: "Alvarez" }), elemento("a", { nombre: "álvarez" })];
    expect(ids(ordenarCatalogo(lista, "fecha"))).toEqual(["a", "b"]);
    expect(ids(ordenarCatalogo(lista.toReversed(), "fecha"))).toEqual(["a", "b"]);
  });

  it("devuelve un arreglo nuevo y no cambia el de entrada", () => {
    const lista = [elemento("b", { dia: 2 }), elemento("a", { dia: 1 })];
    const copia = [...lista];
    const ordenado = ordenarCatalogo(lista, "fecha");
    expect(ordenado).not.toBe(lista);
    expect(lista).toEqual(copia);
  });

  it("acepta elementos con campos de más y devuelve los mismos objetos", () => {
    const a = { ...elemento("a", { dia: 2 }), vista: { nombre: "A" } };
    const b = { ...elemento("b", { dia: 1 }), vista: { nombre: "B" } };
    const ordenado = ordenarCatalogo([a, b], "fecha");
    expect(ordenado[0]).toBe(b);
    expect(ordenado[1]).toBe(a);
    expect(ordenado[0]?.vista).toEqual({ nombre: "B" });
  });
});
