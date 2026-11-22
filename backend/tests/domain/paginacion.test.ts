import { describe, expect, it } from "vitest";
import { paginar } from "../../src/domain/paginacion";

/** `[1, 2, …, n]`: elementos distinguibles para ver el corte y el orden. */
function lista(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1);
}

describe("paginar", () => {
  it("con la lista vacía devuelve la página 1 sin elementos, pida la que pida (FR-005)", () => {
    for (const pedida of [1, 5]) {
      expect(paginar([], pedida)).toEqual({
        elementos: [],
        pagina: { numero: 1, tamano: 10, totalElementos: 0, totalPaginas: 0 },
      });
    }
  });

  it("con 1 elemento hay una sola página", () => {
    expect(paginar(lista(1), 1)).toEqual({
      elementos: [1],
      pagina: { numero: 1, tamano: 10, totalElementos: 1, totalPaginas: 1 },
    });
  });

  it("con 10 elementos hay una página con los 10", () => {
    expect(paginar(lista(10), 1)).toEqual({
      elementos: lista(10),
      pagina: { numero: 1, tamano: 10, totalElementos: 10, totalPaginas: 1 },
    });
  });

  it("con 11 elementos hay 2 páginas y la 2 tiene 1", () => {
    expect(paginar(lista(11), 1).elementos).toEqual(lista(10));
    expect(paginar(lista(11), 2)).toEqual({
      elementos: [11],
      pagina: { numero: 2, tamano: 10, totalElementos: 11, totalPaginas: 2 },
    });
  });

  it("con 25 elementos hay 3 páginas de 10, 10 y 5", () => {
    const tamanos = [1, 2, 3].map((n) => paginar(lista(25), n).elementos.length);
    expect(tamanos).toEqual([10, 10, 5]);
    expect(paginar(lista(25), 1).pagina.totalPaginas).toBe(3);
  });

  it("la página 3 de 25 trae los elementos 21 a 25", () => {
    expect(paginar(lista(25), 3).elementos).toEqual([21, 22, 23, 24, 25]);
  });

  it("una página posterior a la última devuelve la última, con su número real (FR-005)", () => {
    for (const pedida of [4, 99]) {
      expect(paginar(lista(25), pedida)).toEqual({
        elementos: [21, 22, 23, 24, 25],
        pagina: { numero: 3, tamano: 10, totalElementos: 25, totalPaginas: 3 },
      });
    }
  });

  it("el tamaño es siempre 10", () => {
    for (const n of [0, 1, 10, 11, 25]) {
      expect(paginar(lista(n), 1).pagina.tamano).toBe(10);
    }
  });

  it("concatenar las páginas 1…totalPaginas da la lista original en su orden (SC-002)", () => {
    for (const n of [0, 1, 10, 11, 25]) {
      const original = lista(n).reverse();
      const { totalPaginas } = paginar(original, 1).pagina;
      const concatenadas = Array.from(
        { length: totalPaginas },
        (_, i) => paginar(original, i + 1).elementos,
      ).flat();
      expect(concatenadas).toEqual(original);
    }
  });

  it("no muta el arreglo recibido ni devuelve el mismo", () => {
    const original = Object.freeze(lista(11));
    const { elementos } = paginar(original, 1);
    expect(original).toEqual(lista(11));
    expect(elementos).not.toBe(original);
  });
});
