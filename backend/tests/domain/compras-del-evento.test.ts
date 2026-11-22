import { EstadoCompra } from "@ai-ticket-it/shared";
import { describe, expect, it } from "vitest";
import { Compra, Entrada } from "../../src/domain/compra";
import {
  compararComprasDelEvento,
  filtrarComprasDelEvento,
  resumenPorTipo,
} from "../../src/domain/compras-del-evento";
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
        (codigo, i) =>
          new Entrada({ codigo, uso: i < usadas ? { usuarioId: "usuario-lucia", fechaHora: AHORA } : null }),
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

describe("filtrarComprasDelEvento", () => {
  const estados = [
    EstadoCompra.PENDIENTE,
    EstadoCompra.CONFIRMADA,
    EstadoCompra.UTILIZADA,
    EstadoCompra.CANCELADA,
    EstadoCompra.REEMBOLSADA,
  ];
  const porEstado = estados.map((estado) =>
    compra("evento-a", "tipo-a-general", estado, { id: `compra-${estado.toLowerCase()}` }),
  );
  const DESPUES = new Date(AHORA.getTime() + 60 * MINUTO);
  /** La confirmada, con un mensaje del comprador sin responder. */
  const sinResponder = porEstado[1]!.enviarMensaje("usuario-martin", "¿Hay estacionamiento?", DESPUES);
  /** La cancelada, con la conversación respondida por el organizador. */
  const respondida = porEstado[3]!
    .enviarMensaje("usuario-martin", "¿Me devuelven?", DESPUES)
    .enviarMensaje("usuario-lucia", "Sí, en estos días.", DESPUES);
  /** La utilizada, con un mensaje del comprador sin responder. */
  const usadaSinResponder = porEstado[2]!.enviarMensaje("usuario-martin", "Gracias", DESPUES);
  const lista = [porEstado[0]!, sinResponder, usadaSinResponder, respondida, porEstado[4]!];
  const ids = (compras: readonly Compra[]) => compras.map((c) => c.id);

  it("sin filtro devuelve todas, en el mismo orden", () => {
    expect(ids(filtrarComprasDelEvento(lista, { sinResponder: false }))).toEqual(ids(lista));
  });

  it.each(estados)("con estado %s, solo las compras en ese estado", (estado) => {
    const filtradas = filtrarComprasDelEvento(lista, { estado, sinResponder: false });
    expect(filtradas).toHaveLength(1);
    expect(filtradas[0]!.estado).toBe(estado);
  });

  it("compara el estado de la compra recibida: una pendiente vencida al día es CANCELADA", () => {
    const vencida = compra("evento-a", "tipo-a-general", EstadoCompra.PENDIENTE, {
      id: "compra-vencida",
    }).alDia(new Date(AHORA.getTime() + 16 * MINUTO));
    expect(
      ids(filtrarComprasDelEvento([vencida], { estado: EstadoCompra.CANCELADA, sinResponder: false })),
    ).toEqual(["compra-vencida"]);
    expect(
      filtrarComprasDelEvento([vencida], { estado: EstadoCompra.PENDIENTE, sinResponder: false }),
    ).toEqual([]);
  });

  it("con sinResponder, solo las del último mensaje del comprador", () => {
    expect(ids(filtrarComprasDelEvento(lista, { sinResponder: true }))).toEqual([
      sinResponder.id,
      usadaSinResponder.id,
    ]);
  });

  it("los dos juntos se aplican con 'y'", () => {
    expect(
      ids(filtrarComprasDelEvento(lista, { estado: EstadoCompra.UTILIZADA, sinResponder: true })),
    ).toEqual([usadaSinResponder.id]);
    expect(filtrarComprasDelEvento(lista, { estado: EstadoCompra.CANCELADA, sinResponder: true })).toEqual(
      [],
    );
  });

  it("no muta la lista recibida", () => {
    const copia = [...lista];
    filtrarComprasDelEvento(lista, { estado: EstadoCompra.CONFIRMADA, sinResponder: true });
    expect(lista).toEqual(copia);
  });
});
