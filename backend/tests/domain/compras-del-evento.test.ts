import { EstadoCompra } from "@ai-ticket-it/shared";
import { describe, expect, it } from "vitest";
import { Compra, Entrada } from "../../src/domain/compra";
import { compararComprasDelEvento, resumenPorTipo } from "../../src/domain/compras-del-evento";
import { AHORA, codigosDePrueba, compra, historialHasta, tipo } from "../helpers/eventos";

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

describe("resumenPorTipo", () => {
  const general = tipo({ id: "tipo-general", nombre: "General", cupo: 5 });
  const vip = tipo({ id: "tipo-vip", nombre: "VIP", cupo: 7 });

  let numero = 0;
  function de(tipoEntradaId: string, estado: EstadoCompra, cantidad: number) {
    numero += 1;
    return compra("evento-a", tipoEntradaId, estado, { id: `compra-${numero}`, cantidad });
  }

  /** Una UTILIZADA de `cantidad` entradas con `usadas` de ellas usadas por Lucía. */
  function utilizada(tipoEntradaId: string, cantidad: number, usadas: number): Compra {
    numero += 1;
    const uso = {
      estado: EstadoCompra.UTILIZADA,
      autor: { tipo: "usuario", usuarioId: "usuario-lucia" } as const,
      fechaHora: AHORA,
    };
    return new Compra({
      id: `compra-${numero}`,
      compradorId: "usuario-martin",
      eventoId: "evento-a",
      tipoEntradaId,
      cantidad,
      total: 1000 * cantidad,
      historial: [...historialHasta(EstadoCompra.CONFIRMADA, "usuario-martin"), uso],
      entradas: codigosDePrueba(cantidad).map(
        (codigo, i) => new Entrada({ codigo, cambios: i < usadas ? [uso] : [] }),
      ),
    });
  }

  it("uno por tipo, en el orden del evento, con su cupo como disponibles", () => {
    const resumen = resumenPorTipo([vip, general], []);
    expect(resumen.map((r) => r.tipoEntrada.id)).toEqual(["tipo-vip", "tipo-general"]);
    expect(resumen[0]).toEqual({ tipoEntrada: vip, disponibles: 7, pendientes: 0, vendidas: 0, usadas: 0 });
  });

  it("un tipo sin compras: su cupo y ceros", () => {
    const resumen = resumenPorTipo([general, vip], [de("tipo-vip", EstadoCompra.CONFIRMADA, 2)]);
    expect(resumen[0]).toMatchObject({ disponibles: 5, pendientes: 0, vendidas: 0, usadas: 0 });
  });

  it("pendientes suma las PENDIENTE y vendidas las CONFIRMADA y UTILIZADA", () => {
    const compras = [
      de("tipo-general", EstadoCompra.PENDIENTE, 2),
      de("tipo-general", EstadoCompra.PENDIENTE, 1),
      de("tipo-general", EstadoCompra.CONFIRMADA, 2),
      utilizada("tipo-general", 3, 1),
    ];
    expect(resumenPorTipo([general], compras)[0]).toMatchObject({ pendientes: 3, vendidas: 5, usadas: 1 });
  });

  it("una UTILIZADA de 3 con 1 entrada usada: 3 vendidas y 1 usada", () => {
    expect(resumenPorTipo([general], [utilizada("tipo-general", 3, 1)])[0]).toMatchObject({
      vendidas: 3,
      usadas: 1,
    });
  });

  it("CANCELADA y REEMBOLSADA no suman", () => {
    const compras = [
      de("tipo-general", EstadoCompra.CANCELADA, 2),
      de("tipo-general", EstadoCompra.REEMBOLSADA, 3),
    ];
    expect(resumenPorTipo([general], compras)[0]).toMatchObject({ pendientes: 0, vendidas: 0, usadas: 0 });
  });

  it("las compras de otro tipo no se mezclan", () => {
    const compras = [
      de("tipo-general", EstadoCompra.PENDIENTE, 1),
      de("tipo-vip", EstadoCompra.PENDIENTE, 4),
      de("tipo-vip", EstadoCompra.CONFIRMADA, 2),
      de("tipo-otro", EstadoCompra.CONFIRMADA, 3),
    ];
    const [deGeneral, deVip] = resumenPorTipo([general, vip], compras);
    expect(deGeneral).toMatchObject({ pendientes: 1, vendidas: 0 });
    expect(deVip).toMatchObject({ pendientes: 4, vendidas: 2 });
  });
});
