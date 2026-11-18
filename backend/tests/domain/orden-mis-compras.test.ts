import { describe, expect, it } from "vitest";
import { compararMisCompras, type OrdenableMiCompra } from "../../src/domain/orden-mis-compras";

const BASE = new Date("2026-12-01T00:00:00.000Z").getTime();
const DIA = 24 * 60 * 60 * 1000;
const MINUTO = 60 * 1000;

function compra(
  id: string,
  {
    dia = 0,
    realizado = false,
    creadaMin = 0,
  }: { dia?: number; realizado?: boolean; creadaMin?: number } = {},
): OrdenableMiCompra {
  return {
    id,
    fechaHoraEvento: new Date(BASE + dia * DIA),
    eventoRealizado: realizado,
    creadaEn: new Date(BASE - 30 * DIA + creadaMin * MINUTO),
  };
}

const ordenar = (lista: readonly OrdenableMiCompra[]) => lista.toSorted(compararMisCompras).map((c) => c.id);

describe("compararMisCompras", () => {
  it("las de eventos no realizados van antes que las de realizados aunque la fecha del realizado sea mayor", () => {
    const lista = [compra("realizada", { dia: 10, realizado: true }), compra("proxima", { dia: 1 })];
    expect(ordenar(lista)).toEqual(["proxima", "realizada"]);
  });

  it("las de eventos no realizados, por fecha del evento ascendente", () => {
    const lista = [compra("c", { dia: 3 }), compra("a", { dia: 1 }), compra("b", { dia: 2 })];
    expect(ordenar(lista)).toEqual(["a", "b", "c"]);
  });

  it("las de eventos realizados, por fecha del evento descendente", () => {
    const lista = [
      compra("a", { dia: -3, realizado: true }),
      compra("c", { dia: -1, realizado: true }),
      compra("b", { dia: -2, realizado: true }),
    ];
    expect(ordenar(lista)).toEqual(["c", "b", "a"]);
  });

  it("con la misma fecha del evento, la comprada más recientemente primero", () => {
    const lista = [compra("vieja", { creadaMin: 1 }), compra("nueva", { creadaMin: 5 })];
    expect(ordenar(lista)).toEqual(["nueva", "vieja"]);
  });

  it("con la misma fecha del evento y la misma creación, por id ascendente", () => {
    const lista = [compra("b"), compra("a")];
    expect(ordenar(lista)).toEqual(["a", "b"]);
  });

  it("es estable: el resultado no depende del orden de entrada", () => {
    const lista = [
      compra("r1", { dia: -1, realizado: true }),
      compra("p2", { dia: 2 }),
      compra("p1b", { dia: 1 }),
      compra("p1a", { dia: 1, creadaMin: 3 }),
      compra("r2", { dia: -5, realizado: true }),
      compra("p1c", { dia: 1 }),
    ];
    const esperado = ["p1a", "p1b", "p1c", "p2", "r1", "r2"];
    expect(ordenar(lista)).toEqual(esperado);
    expect(ordenar(lista.toReversed())).toEqual(esperado);
  });
});
