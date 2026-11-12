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

describe("ordenarCatalogo: precio", () => {
  it("ascendente, con los gratis primero", () => {
    const lista = [
      elemento("a", { precio: 8000 }),
      elemento("b", { precio: 0 }),
      elemento("c", { precio: 2000 }),
    ];
    expect(ids(ordenarCatalogo(lista, "precio"))).toEqual(["b", "c", "a"]);
  });

  it("empate de precio → fecha → nombre → id", () => {
    const lista = [
      elemento("d", { precio: 1000, dia: 2, nombre: "Zeta" }),
      elemento("c", { precio: 1000, dia: 1, nombre: "Zeta" }),
      elemento("b", { precio: 1000, dia: 2, nombre: "Alfa" }),
      elemento("a", { precio: 1000, dia: 2, nombre: "zeta" }),
    ];
    expect(ids(ordenarCatalogo(lista, "precio"))).toEqual(["c", "b", "a", "d"]);
  });
});

describe("ordenarCatalogo: puntaje", () => {
  it("descendente con el valor sin redondear (4,36 antes que 4,34)", () => {
    const lista = [
      elemento("a", { puntaje: 4.34 }),
      elemento("b", { puntaje: 4.36 }),
      elemento("c", { puntaje: 5 }),
    ];
    expect(ids(ordenarCatalogo(lista, "puntaje"))).toEqual(["c", "b", "a"]);
  });

  it("sin puntaje siempre al final, nunca como 0 (un 1,0 va antes)", () => {
    const lista = [elemento("a", { puntaje: null, dia: 0 }), elemento("b", { puntaje: 1, dia: 5 })];
    expect(ids(ordenarCatalogo(lista, "puntaje"))).toEqual(["b", "a"]);
  });

  it("todos sin puntaje → queda en orden de fecha", () => {
    const lista = [elemento("a", { dia: 3 }), elemento("b", { dia: 1 }), elemento("c", { dia: 2 })];
    expect(ids(ordenarCatalogo(lista, "puntaje"))).toEqual(["b", "c", "a"]);
  });

  it("empate de puntaje → fecha → nombre → id, sin cambiar el arreglo original", () => {
    const lista = [
      elemento("c", { puntaje: 4, dia: 2, nombre: "Beta" }),
      elemento("b", { puntaje: 4, dia: 2, nombre: "Alfa" }),
      elemento("a", { puntaje: 4, dia: 1, nombre: "Zeta" }),
      elemento("d", { puntaje: 4, dia: 2, nombre: "alfa" }),
    ];
    const copia = [...lista];
    expect(ids(ordenarCatalogo(lista, "puntaje"))).toEqual(["a", "b", "d", "c"]);
    expect(lista).toEqual(copia);
  });
});

describe("ordenarCatalogo: sentido", () => {
  const lista = [
    elemento("a", { dia: 1, precio: 8000, puntaje: 3 }),
    elemento("b", { dia: 2, precio: 0, puntaje: null }),
    elemento("c", { dia: 3, precio: 2000, puntaje: 5 }),
  ];

  it("sin sentido usa el inicial de cada criterio: fecha y precio ascendentes, puntaje descendente", () => {
    expect(ids(ordenarCatalogo(lista, "fecha"))).toEqual(ids(ordenarCatalogo(lista, "fecha", "asc")));
    expect(ids(ordenarCatalogo(lista, "precio"))).toEqual(ids(ordenarCatalogo(lista, "precio", "asc")));
    expect(ids(ordenarCatalogo(lista, "puntaje"))).toEqual(ids(ordenarCatalogo(lista, "puntaje", "desc")));
  });

  it("fecha desc: la más lejana primero", () => {
    expect(ids(ordenarCatalogo(lista, "fecha", "desc"))).toEqual(["c", "b", "a"]);
  });

  it("precio desc: el más caro primero", () => {
    expect(ids(ordenarCatalogo(lista, "precio", "desc"))).toEqual(["a", "c", "b"]);
  });

  it("puntaje asc: el más bajo primero y sin puntaje igual al final", () => {
    expect(ids(ordenarCatalogo(lista, "puntaje", "asc"))).toEqual(["a", "c", "b"]);
  });

  it("los desempates no se invierten: fecha ascendente → nombre → id", () => {
    const empatados = [
      elemento("d", { precio: 1000, dia: 2, nombre: "Zeta" }),
      elemento("c", { precio: 1000, dia: 1, nombre: "Zeta" }),
      elemento("b", { precio: 1000, dia: 2, nombre: "Alfa" }),
      elemento("a", { precio: 1000, dia: 2, nombre: "zeta" }),
    ];
    expect(ids(ordenarCatalogo(empatados, "precio", "desc"))).toEqual(["c", "b", "a", "d"]);
  });
});
