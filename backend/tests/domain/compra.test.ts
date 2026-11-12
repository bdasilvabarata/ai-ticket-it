import { EstadoCompra, LIMITES_COMPRA } from "@ai-ticket-it/shared";
import { describe, expect, it } from "vitest";
import {
  Compra,
  cupoLiberadoPorTipo,
  type CambioEstadoCompra,
  type PropiedadesCompra,
} from "../../src/domain/compra";
import { DatosInvalidosError, ReglaDeNegocioError } from "../../src/domain/errores";
import { TipoEntrada } from "../../src/domain/evento";

const CREADA = new Date("2026-11-10T15:00:00.000Z");
const MINUTO = 60 * 1000;
const PLAZO = LIMITES_COMPRA.minutosParaPagar * MINUTO;
const despues = (ms: number) => new Date(CREADA.getTime() + ms);

const porMartin = { tipo: "usuario", usuarioId: "usuario-martin" } as const;
const pendiente: CambioEstadoCompra = { estado: EstadoCompra.PENDIENTE, autor: porMartin, fechaHora: CREADA };
const confirmada: CambioEstadoCompra = {
  estado: EstadoCompra.CONFIRMADA,
  autor: porMartin,
  fechaHora: despues(5 * MINUTO),
};

const datos: PropiedadesCompra = {
  id: "compra-1",
  compradorId: "usuario-martin",
  eventoId: "evento-festival",
  tipoEntradaId: "tipo-festival-vip",
  cantidad: 2,
  total: 240000,
  historial: [pendiente],
};

const compraPendiente = (cambios: Partial<PropiedadesCompra> = {}) => new Compra({ ...datos, ...cambios });
const compraConfirmada = (cambios: Partial<PropiedadesCompra> = {}) =>
  new Compra({ ...datos, historial: [pendiente, confirmada], ...cambios });
const compraCancelada = (cambios: Partial<PropiedadesCompra> = {}) =>
  new Compra({
    ...datos,
    historial: [pendiente, { estado: EstadoCompra.CANCELADA, autor: porMartin, fechaHora: despues(MINUTO) }],
    ...cambios,
  });

function camposInvalidos(cambios: Partial<Record<keyof PropiedadesCompra, unknown>>): string[] {
  try {
    new Compra({ ...datos, ...cambios } as PropiedadesCompra);
  } catch (error) {
    expect(error).toBeInstanceOf(DatosInvalidosError);
    return (error as DatosInvalidosError).detalles.map((detalle) => detalle.campo);
  }
  throw new Error("Debía lanzar DatosInvalidosError.");
}

describe("Compra", () => {
  describe("invariantes", () => {
    it("se crea con datos válidos y total 0 (entradas gratis)", () => {
      expect(() => compraPendiente()).not.toThrow();
      expect(() => compraPendiente({ total: 0 })).not.toThrow();
    });

    it("rechaza cantidad que no es entero ≥ 1", () => {
      for (const cantidad of [0, -1, 1.5]) expect(camposInvalidos({ cantidad })).toEqual(["cantidad"]);
    });

    it("rechaza total que no es entero ≥ 0", () => {
      for (const total of [-1, 10.5]) expect(camposInvalidos({ total })).toEqual(["total"]);
    });

    it("rechaza un historial vacío", () => {
      expect(camposInvalidos({ historial: [] })).toEqual(["historial"]);
    });

    it("rechaza un historial que no empieza en PENDIENTE", () => {
      expect(camposInvalidos({ historial: [confirmada] })).toEqual(["historial"]);
    });

    it("rechaza un estado inválido", () => {
      expect(camposInvalidos({ historial: [pendiente, { ...confirmada, estado: "ABIERTA" }] })).toEqual([
        "historial",
      ]);
    });

    it("rechaza una fecha inválida", () => {
      expect(camposInvalidos({ historial: [{ ...pendiente, fechaHora: new Date("no") }] })).toEqual([
        "historial",
      ]);
    });

    it("rechaza fechas decrecientes", () => {
      expect(camposInvalidos({ historial: [pendiente, { ...confirmada, fechaHora: despues(-1) }] })).toEqual([
        "historial",
      ]);
    });

    it("acepta fechas iguales consecutivas", () => {
      expect(() =>
        compraConfirmada({ historial: [pendiente, { ...confirmada, fechaHora: CREADA }] }),
      ).not.toThrow();
    });

    it("copia el historial: cambiar el arreglo original no cambia la compra", () => {
      const historial = [pendiente];
      const compra = compraPendiente({ historial });
      historial.push(confirmada);
      expect(compra.historial).toHaveLength(1);
      expect(Object.isFrozen(compra.historial)).toBe(true);
    });
  });

  describe("estado, creadaEn y venceEn", () => {
    it("el estado es el del último cambio", () => {
      expect(compraPendiente().estado).toBe(EstadoCompra.PENDIENTE);
      expect(compraConfirmada().estado).toBe(EstadoCompra.CONFIRMADA);
    });

    it("creadaEn es la fecha del primer cambio y venceEn, 15 minutos después", () => {
      const compra = compraConfirmada();
      expect(compra.creadaEn).toEqual(CREADA);
      expect(compra.venceEn).toEqual(despues(PLAZO));
    });
  });

  describe("estaVencida", () => {
    it("una PENDIENTE no venció a los 14:59.999", () => {
      expect(compraPendiente().estaVencida(despues(PLAZO - 1))).toBe(false);
    });

    it("una PENDIENTE venció a los 15 minutos exactos", () => {
      expect(compraPendiente().estaVencida(despues(PLAZO))).toBe(true);
    });

    it("una CONFIRMADA pasado el plazo no está vencida", () => {
      expect(compraConfirmada().estaVencida(despues(PLAZO * 10))).toBe(false);
    });
  });

  describe("vencer", () => {
    it("pasa de PENDIENTE a CANCELADA por el sistema, fechada en venceEn; la original no cambia", () => {
      const original = compraPendiente();
      const vencida = original.vencer();
      expect(vencida).not.toBe(original);
      expect(vencida.estado).toBe(EstadoCompra.CANCELADA);
      expect(vencida.historial).toEqual([
        pendiente,
        { estado: EstadoCompra.CANCELADA, autor: { tipo: "sistema" }, fechaHora: despues(PLAZO) },
      ]);
      expect(vencida).toMatchObject({ id: datos.id, cantidad: datos.cantidad, total: datos.total });
      expect(original.estado).toBe(EstadoCompra.PENDIENTE);
      expect(original.historial).toHaveLength(1);
    });

    it.each([
      ["CONFIRMADA", compraConfirmada],
      ["CANCELADA", compraCancelada],
    ])("desde %s lanza TRANSICION_INVALIDA", (_estado, crear) => {
      const compra = crear();
      expect(() => compra.vencer()).toThrow(ReglaDeNegocioError);
      expect(() => compra.vencer()).toThrow(
        expect.objectContaining({
          codigo: "TRANSICION_INVALIDA",
          message: "La compra no está pendiente de pago.",
        }),
      );
    });
  });

  describe("alDia", () => {
    it("una vencida se ve CANCELADA por el sistema", () => {
      const alDia = compraPendiente().alDia(despues(PLAZO));
      expect(alDia.estado).toBe(EstadoCompra.CANCELADA);
      expect(alDia.fueVencida()).toBe(true);
    });

    it("una no vencida es la misma instancia", () => {
      const compra = compraPendiente();
      expect(compra.alDia(despues(PLAZO - 1))).toBe(compra);
      const pagada = compraConfirmada();
      expect(pagada.alDia(despues(PLAZO * 2))).toBe(pagada);
    });
  });

  describe("fueVencida", () => {
    it("CANCELADA por el sistema → true", () => {
      expect(compraPendiente().vencer().fueVencida()).toBe(true);
    });

    it("PENDIENTE, CONFIRMADA o CANCELADA por un usuario → false", () => {
      expect(compraPendiente().fueVencida()).toBe(false);
      expect(compraConfirmada().fueVencida()).toBe(false);
      expect(compraCancelada().fueVencida()).toBe(false);
    });
  });

  describe("esVigente", () => {
    it("PENDIENTE no vencida y CONFIRMADA son vigentes", () => {
      expect(compraPendiente().esVigente(despues(PLAZO - 1))).toBe(true);
      expect(compraConfirmada().esVigente(despues(PLAZO * 2))).toBe(true);
    });

    it("PENDIENTE vencida y CANCELADA no son vigentes", () => {
      expect(compraPendiente().esVigente(despues(PLAZO))).toBe(false);
      expect(compraCancelada().esVigente(despues(MINUTO))).toBe(false);
    });
  });

  it("esGratis ⇔ total 0", () => {
    expect(compraPendiente({ total: 0 }).esGratis()).toBe(true);
    expect(compraPendiente().esGratis()).toBe(false);
  });
});

describe("cupoLiberadoPorTipo", () => {
  const ahora = despues(PLAZO);

  it("suma la cantidad de las vencidas por tipo", () => {
    const liberado = cupoLiberadoPorTipo(
      [
        compraPendiente({ id: "c1", cantidad: 2 }),
        compraPendiente({ id: "c2", cantidad: 1 }),
        compraPendiente({ id: "c3", cantidad: 3, tipoEntradaId: "tipo-festival-general" }),
      ],
      ahora,
    );
    expect(liberado).toEqual(
      new Map([
        ["tipo-festival-vip", 3],
        ["tipo-festival-general", 3],
      ]),
    );
  });

  it("ignora las no vencidas, las confirmadas y las ya canceladas", () => {
    const liberado = cupoLiberadoPorTipo(
      [
        compraPendiente({ id: "no-vencida", historial: [{ ...pendiente, fechaHora: despues(1) }] }),
        compraConfirmada({ id: "confirmada" }),
        compraCancelada({ id: "cancelada" }),
        compraPendiente({ id: "vencida-ya-cancelada" }).vencer(),
      ],
      ahora,
    );
    expect(liberado).toEqual(new Map());
  });

  it("sin compras, un Map vacío", () => {
    expect(cupoLiberadoPorTipo([], ahora)).toEqual(new Map());
  });
});

describe("Compra.registrar (alta, feature 006)", () => {
  const vip = new TipoEntrada({
    id: "tipo-festival-vip",
    nombre: "VIP",
    descripcion: "",
    precio: 120000,
    cupo: 50,
  });
  const gratis = new TipoEntrada({
    id: "tipo-kids",
    nombre: "Carrera kids",
    descripcion: "",
    precio: 0,
    cupo: 10,
  });
  const alta = (tipo: TipoEntrada, cantidad: number) =>
    Compra.registrar({
      id: "compra-nueva",
      compradorId: "usuario-sofia",
      eventoId: "evento-festival",
      tipo,
      cantidad,
      ahora: CREADA,
    });

  it("total = precio × cantidad, con el tipo y el comprador dados", () => {
    const compra = alta(vip, 2);
    expect(compra).toMatchObject({
      id: "compra-nueva",
      compradorId: "usuario-sofia",
      eventoId: "evento-festival",
      tipoEntradaId: "tipo-festival-vip",
      cantidad: 2,
      total: 240000,
    });
  });

  it("un tipo gratis da total 0", () => {
    expect(alta(gratis, 1).total).toBe(0);
  });

  it("el historial es un único PENDIENTE por el comprador en `ahora`", () => {
    const compra = alta(vip, 1);
    expect(compra.estado).toBe(EstadoCompra.PENDIENTE);
    expect(compra.historial).toEqual([
      {
        estado: EstadoCompra.PENDIENTE,
        autor: { tipo: "usuario", usuarioId: "usuario-sofia" },
        fechaHora: CREADA,
      },
    ]);
  });

  it("cantidad 0 lanza DatosInvalidosError", () => {
    expect(() => alta(vip, 0)).toThrow(DatosInvalidosError);
  });
});

describe("Compra.pagar (feature 006)", () => {
  const porSofia = { tipo: "usuario", usuarioId: "usuario-sofia" } as const;

  it("PENDIENTE → CONFIRMADA por el usuario en `ahora`; la original no cambia", () => {
    const original = compraPendiente();
    const pagada = original.pagar("usuario-sofia", despues(PLAZO - 1));
    expect(pagada).not.toBe(original);
    expect(pagada.estado).toBe(EstadoCompra.CONFIRMADA);
    expect(pagada.historial).toEqual([
      pendiente,
      { estado: EstadoCompra.CONFIRMADA, autor: porSofia, fechaHora: despues(PLAZO - 1) },
    ]);
    expect(pagada).toMatchObject({ id: datos.id, cantidad: datos.cantidad, total: datos.total });
    expect(original.estado).toBe(EstadoCompra.PENDIENTE);
    expect(original.historial).toHaveLength(1);
  });

  it("una vez pagada, ya no vence pasado el plazo", () => {
    const pagada = compraPendiente().pagar("usuario-martin", despues(MINUTO));
    expect(pagada.estaVencida(despues(PLAZO * 2))).toBe(false);
  });

  const vencida = expect.objectContaining({
    codigo: "COMPRA_VENCIDA",
    message: "La compra venció: pasaron 15 minutos sin pagarla.",
  });

  it("a los 15 minutos exactos lanza COMPRA_VENCIDA", () => {
    const compra = compraPendiente();
    expect(() => compra.pagar("usuario-martin", despues(PLAZO))).toThrow(ReglaDeNegocioError);
    expect(() => compra.pagar("usuario-martin", despues(PLAZO))).toThrow(vencida);
  });

  it("una CANCELADA por el sistema (fueVencida) lanza COMPRA_VENCIDA", () => {
    const cancelada = compraPendiente().vencer();
    expect(() => cancelada.pagar("usuario-martin", despues(MINUTO))).toThrow(vencida);
  });

  it("ya CONFIRMADA lanza TRANSICION_INVALIDA", () => {
    expect(() => compraConfirmada().pagar("usuario-martin", despues(10 * MINUTO))).toThrow(
      expect.objectContaining({
        codigo: "TRANSICION_INVALIDA",
        message: "La compra no está pendiente de pago.",
      }),
    );
  });
});

describe("Compra.cancelar (corrección de la 006)", () => {
  const porMartinAhora = (ms: number) => ({
    estado: EstadoCompra.CANCELADA,
    autor: porMartin,
    fechaHora: despues(ms),
  });

  it("PENDIENTE → CANCELADA por su comprador en `ahora`; la original no cambia", () => {
    const original = compraPendiente();
    const cancelada = original.cancelar("usuario-martin", despues(PLAZO - 1));
    expect(cancelada.estado).toBe(EstadoCompra.CANCELADA);
    expect(cancelada.historial).toEqual([pendiente, porMartinAhora(PLAZO - 1)]);
    expect(cancelada.fueVencida()).toBe(false);
    expect(cancelada.esVigente(despues(PLAZO - 1))).toBe(false);
    expect(original.estado).toBe(EstadoCompra.PENDIENTE);
  });

  it("una cancelada por el comprador no libera cupo como vencida ni se puede pagar", () => {
    const cancelada = compraPendiente().cancelar("usuario-martin", despues(MINUTO));
    expect(cupoLiberadoPorTipo([cancelada], despues(PLAZO * 2)).size).toBe(0);
    expect(() => cancelada.pagar("usuario-martin", despues(2 * MINUTO))).toThrow(
      expect.objectContaining({ codigo: "TRANSICION_INVALIDA" }),
    );
  });

  it("vencida (a los 15 minutos o ya CANCELADA por el sistema) → COMPRA_VENCIDA", () => {
    const vencida = expect.objectContaining({ codigo: "COMPRA_VENCIDA" });
    expect(() => compraPendiente().cancelar("usuario-martin", despues(PLAZO))).toThrow(vencida);
    expect(() => compraPendiente().vencer().cancelar("usuario-martin", despues(MINUTO))).toThrow(vencida);
  });

  it("CONFIRMADA o ya cancelada por el comprador → TRANSICION_INVALIDA", () => {
    const invalida = expect.objectContaining({
      codigo: "TRANSICION_INVALIDA",
      message: "La compra no está pendiente de pago.",
    });
    expect(() => compraConfirmada().cancelar("usuario-martin", despues(10 * MINUTO))).toThrow(invalida);
    const cancelada = compraPendiente().cancelar("usuario-martin", despues(MINUTO));
    expect(() => cancelada.cancelar("usuario-martin", despues(2 * MINUTO))).toThrow(invalida);
  });
});
