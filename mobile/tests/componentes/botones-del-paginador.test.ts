import { botonesDelPaginador } from "../../src/componentes/botones-del-paginador";

describe("botonesDelPaginador", () => {
  it.each([
    [1, [1, 2, 3, 4, 10]],
    [2, [1, 2, 3, 4, 10]],
    [3, [1, 2, 3, 4, 10]],
    [4, [1, 3, 4, 5, 10]],
    [6, [1, 5, 6, 7, 10]],
    [8, [1, 7, 8, 9, 10]],
    [9, [1, 7, 8, 9, 10]],
    [10, [1, 7, 8, 9, 10]],
  ])("con 10 páginas y la actual %i → %j (ejemplos de la spec)", (actual, esperados) => {
    expect(botonesDelPaginador(10, actual)).toEqual(esperados);
  });

  it("con 5 páginas o menos muestra todas", () => {
    expect(botonesDelPaginador(1, 1)).toEqual([1]);
    expect(botonesDelPaginador(3, 2)).toEqual([1, 2, 3]);
    for (let actual = 1; actual <= 5; actual++) {
      expect(botonesDelPaginador(5, actual)).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it.each([
    [1, [1, 2, 3, 4, 6]],
    [2, [1, 2, 3, 4, 6]],
    [3, [1, 2, 3, 4, 6]],
    [4, [1, 3, 4, 5, 6]],
    [5, [1, 3, 4, 5, 6]],
    [6, [1, 3, 4, 5, 6]],
  ])("con 6 páginas y la actual %i → %j", (actual, esperados) => {
    expect(botonesDelPaginador(6, actual)).toEqual(esperados);
  });

  it("de 1 a 20 páginas, con cualquier actual, cumple la regla (SC-003)", () => {
    for (let total = 1; total <= 20; total++) {
      for (let actual = 1; actual <= total; actual++) {
        const botones = botonesDelPaginador(total, actual);
        const contexto = `total ${total}, actual ${actual}: ${botones.join(" ")}`;

        expect({ contexto, cantidad: botones.length }).toEqual({ contexto, cantidad: Math.min(total, 5) });
        expect({ contexto, ok: botones.every((n, i) => i === 0 || n > botones[i - 1]) }).toEqual({
          contexto,
          ok: true,
        });
        expect({ contexto, ok: botones.every((n) => Number.isInteger(n) && n >= 1 && n <= total) }).toEqual({
          contexto,
          ok: true,
        });
        const obligatorios = [1, total, actual, actual - 1, actual + 1].filter((n) => n >= 1 && n <= total);
        for (const n of obligatorios) {
          expect({ contexto, incluye: n, ok: botones.includes(n) }).toEqual({
            contexto,
            incluye: n,
            ok: true,
          });
        }
      }
    }
  });

  it("con 10 páginas, toda página se alcanza desde la 1 en 3 toques o menos (SC-004)", () => {
    const toques = new Map<number, number>([[1, 0]]);
    let frontera = [1];
    while (frontera.length > 0) {
      const siguiente: number[] = [];
      for (const actual of frontera) {
        for (const destino of botonesDelPaginador(10, actual)) {
          if (!toques.has(destino)) {
            toques.set(destino, (toques.get(actual) ?? 0) + 1);
            siguiente.push(destino);
          }
        }
      }
      frontera = siguiente;
    }

    for (let pagina = 1; pagina <= 10; pagina++) {
      expect({ pagina, alcanzable: toques.has(pagina) }).toEqual({ pagina, alcanzable: true });
      expect(toques.get(pagina)).toBeLessThanOrEqual(3);
    }
  });
});
