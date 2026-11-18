import { EstadoCompra } from "@ai-ticket-it/shared";
import { describe, expect, it } from "vitest";
import { compararComprasDelEvento } from "../../src/domain/compras-del-evento";
import { AHORA, compra } from "../helpers/eventos";

const MINUTO = 60 * 1000;

function compraEn(id: string, minutos: number) {
  return compra("evento-a", "tipo-a-general", EstadoCompra.CONFIRMADA, {
    id,
    creadaEn: new Date(AHORA.getTime() + minutos * MINUTO),
  });
}

const ordenar = (lista: ReturnType<typeof compraEn>[]) =>
  lista.toSorted(compararComprasDelEvento).map((c) => c.id);

describe("compararComprasDelEvento", () => {
  it("de la más nueva a la más vieja (creadaEn descendente)", () => {
    const lista = [compraEn("vieja", 0), compraEn("nueva", 20), compraEn("media", 10)];
    expect(ordenar(lista)).toEqual(["nueva", "media", "vieja"]);
  });

  it("con la misma creadaEn, por id ascendente", () => {
    const lista = [compraEn("c", 5), compraEn("a", 5), compraEn("b", 5)];
    expect(ordenar(lista)).toEqual(["a", "b", "c"]);
  });

  it("es estable: el orden de entrada no cambia el resultado", () => {
    const lista = [compraEn("b", 5), compraEn("x", 0), compraEn("a", 5), compraEn("z", 30)];
    expect(ordenar(lista)).toEqual(ordenar(lista.toReversed()));
    expect(ordenar(lista)).toEqual(["z", "a", "b", "x"]);
  });

  it("dos compras iguales comparan 0", () => {
    expect(compararComprasDelEvento(compraEn("a", 0), compraEn("a", 0))).toBe(0);
  });
});
