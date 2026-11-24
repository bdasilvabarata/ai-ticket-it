import { EstadoCompra, LIMITES_COMPRA } from "@ai-ticket-it/shared";
import { describe, expect, it } from "vitest";
import {
  Compra,
  Entrada,
  Mensaje,
  type CambioEstadoCompra,
  type PropiedadesCompra,
} from "../../src/domain/compra";
import { DatosInvalidosError, ReglaDeNegocioError } from "../../src/domain/errores";
import { TipoEntrada } from "../../src/domain/evento";
import { cupoLiberadoPorTipo } from "../../src/domain/vencimiento";
import { entradasDePrueba } from "../helpers/eventos";

const CREADA = new Date("2026-11-10T15:00:00.000Z");
const MINUTO = 60 * 1000;
const DIA = 24 * 60 * MINUTO;
const PLAZO = LIMITES_COMPRA.minutosParaPagar * MINUTO;
const despues = (ms: number) => new Date(CREADA.getTime() + ms);
/** Un inicio del evento muy posterior a todo lo de estos casos (para cancelar sin que haya empezado). */
const LEJOS = new Date(CREADA.getTime() + 365 * DIA);

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
  entradas: [new Entrada({ codigo: "7K3MQ9TB" }), new Entrada({ codigo: "7K3MQ9TC" })],
};

/** `datos` con los cambios; si cambia la cantidad (y no las entradas), entradas de prueba de esa cantidad. */
const con = (cambios: Partial<PropiedadesCompra>): PropiedadesCompra => ({
  ...datos,
  ...(cambios.cantidad === undefined ? {} : { entradas: entradasDePrueba(cambios.cantidad) }),
  ...cambios,
});
const compraPendiente = (cambios: Partial<PropiedadesCompra> = {}) => new Compra(con(cambios));
const compraConfirmada = (cambios: Partial<PropiedadesCompra> = {}) =>
  new Compra(con({ historial: [pendiente, confirmada], ...cambios }));
const compraCancelada = (cambios: Partial<PropiedadesCompra> = {}) =>
  new Compra(
    con({
      historial: [
        pendiente,
        { estado: EstadoCompra.CANCELADA, autor: porMartin, fechaHora: despues(MINUTO) },
      ],
      ...cambios,
    }),
  );

const porLucia = { tipo: "usuario", usuarioId: "usuario-lucia" } as const;
/** El comprador cancela la compra ya confirmada (feature 009). */
const cancelacion: CambioEstadoCompra = {
  estado: EstadoCompra.CANCELADA,
  autor: porMartin,
  fechaHora: despues(10 * MINUTO),
};
const reembolso: CambioEstadoCompra = {
  estado: EstadoCompra.REEMBOLSADA,
  autor: porLucia,
  fechaHora: despues(20 * MINUTO),
};
/** La cancelación de `cancelacion` como la registra cada entrada: quién y cuándo (feature 010). */
const cancelacionDeEntrada = { usuarioId: "usuario-martin", fechaHora: cancelacion.fechaHora };
/** El uso de una entrada registrado por Lucía en `fechaHora` (feature 010). */
const usoPorLucia = (fechaHora: Date) => ({ usuarioId: "usuario-lucia", fechaHora });
/** Las entradas de `datos`, cada una cancelada por el comprador (feature 009, R3). */
const entradasCanceladas = () =>
  datos.entradas.map((entrada) => new Entrada({ codigo: entrada.codigo, cancelacion: cancelacionDeEntrada }));
/** Una CANCELADA por su comprador después de confirmada, armada con el constructor. */
const compraCanceladaDesdeConfirmada = (cambios: Partial<PropiedadesCompra> = {}) =>
  new Compra(
    con({ historial: [pendiente, confirmada, cancelacion], entradas: entradasCanceladas(), ...cambios }),
  );
/** Una REEMBOLSADA (cancelada después de confirmada y reembolsada por Lucía), armada con el constructor. */
const compraReembolsada = (cambios: Partial<PropiedadesCompra> = {}) =>
  new Compra(
    con({
      historial: [pendiente, confirmada, cancelacion, reembolso],
      entradas: entradasCanceladas(),
      ...cambios,
    }),
  );

function detallesInvalidos(cambios: Partial<Record<keyof PropiedadesCompra, unknown>>) {
  try {
    new Compra({ ...datos, ...cambios } as PropiedadesCompra);
  } catch (error) {
    expect(error).toBeInstanceOf(DatosInvalidosError);
    return (error as DatosInvalidosError).detalles;
  }
  throw new Error("Debía lanzar DatosInvalidosError.");
}

/**
 * Los campos con algún detalle, sin repetir: desde la 010 cada regla informa el suyo, y varias
 * reglas de `entradas` (o de `historial`) pueden fallar a la vez. Qué reglas fallan lo prueba
 * `reglas-de-compra.test.ts`; acá, que la compra se rechaza por ese campo.
 */
function camposInvalidos(cambios: Partial<Record<keyof PropiedadesCompra, unknown>>): string[] {
  return [...new Set(detallesInvalidos(cambios).map((detalle) => detalle.campo))];
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

    it("con varias reglas violadas a la vez informa un detalle por regla (feature 010)", () => {
      const entradas = [
        new Entrada({ codigo: "7K3MQ9TB", uso: { usuarioId: "usuario-lucia", fechaHora: despues(MINUTO) } }),
        new Entrada({ codigo: "7K3MQ9TC" }),
      ];
      expect(detallesInvalidos({ entradas })).toEqual([
        {
          campo: "entradas",
          mensaje: "Una compra que no se confirmó no tiene entradas usadas ni canceladas.",
        },
        {
          campo: "entradas",
          mensaje: "La compra está UTILIZADA si y solo si alguna de sus entradas se usó.",
        },
      ]);
    });

    it("cantidad 0 con 1 entrada informa solo la cantidad, no una entrada por unidad (feature 010)", () => {
      expect(detallesInvalidos({ cantidad: 0, entradas: [new Entrada({ codigo: "7K3MQ9TB" })] })).toEqual([
        { campo: "cantidad", mensaje: "Debe ser un entero mayor o igual a 1." },
      ]);
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
      codigos: ["7K3MQ9TB", "7K3MQ9TC", "7K3MQ9TD"].slice(0, cantidad),
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
    const cancelada = original.cancelar("usuario-martin", despues(PLAZO - 1), LEJOS);
    expect(cancelada.estado).toBe(EstadoCompra.CANCELADA);
    expect(cancelada.historial).toEqual([pendiente, porMartinAhora(PLAZO - 1)]);
    expect(cancelada.fueVencida()).toBe(false);
    expect(cancelada.esVigente(despues(PLAZO - 1))).toBe(false);
    expect(original.estado).toBe(EstadoCompra.PENDIENTE);
  });

  it("una cancelada por el comprador no libera cupo como vencida ni se puede pagar", () => {
    const cancelada = compraPendiente().cancelar("usuario-martin", despues(MINUTO), LEJOS);
    expect(cupoLiberadoPorTipo([cancelada], despues(PLAZO * 2)).size).toBe(0);
    expect(() => cancelada.pagar("usuario-martin", despues(2 * MINUTO))).toThrow(
      expect.objectContaining({ codigo: "TRANSICION_INVALIDA" }),
    );
  });

  it("vencida (a los 15 minutos o ya CANCELADA por el sistema) → COMPRA_VENCIDA", () => {
    const vencida = expect.objectContaining({ codigo: "COMPRA_VENCIDA" });
    expect(() => compraPendiente().cancelar("usuario-martin", despues(PLAZO), LEJOS)).toThrow(vencida);
    expect(() => compraPendiente().vencer().cancelar("usuario-martin", despues(MINUTO), LEJOS)).toThrow(
      vencida,
    );
  });

  it("ya cancelada por el comprador → TRANSICION_INVALIDA (desde la 009, con el mensaje por motivo)", () => {
    const cancelada = compraPendiente().cancelar("usuario-martin", despues(MINUTO), LEJOS);
    expect(() => cancelada.cancelar("usuario-martin", despues(2 * MINUTO), LEJOS)).toThrow(
      expect.objectContaining({ codigo: "TRANSICION_INVALIDA", message: "La compra ya está cancelada." }),
    );
  });

  it("una PENDIENTE se cancela también con el evento empezado (006)", () => {
    const cancelada = compraPendiente().cancelar("usuario-martin", despues(MINUTO), CREADA);
    expect(cancelada.estado).toBe(EstadoCompra.CANCELADA);
    expect(cancelada.entradas.every((entrada) => !entrada.usada && !entrada.cancelada)).toBe(true);
  });
});

describe("Entrada dentro de la Compra (feature 008, R1)", () => {
  const codigos = datos.entradas.map((entrada) => entrada.codigo);
  const usada: CambioEstadoCompra = {
    estado: EstadoCompra.UTILIZADA,
    autor: { tipo: "usuario", usuarioId: "usuario-lucia" },
    fechaHora: despues(60 * MINUTO),
  };

  it("Compra.registrar crea una entrada por código, sin uso ni cancelación y PENDIENTE", () => {
    const compra = Compra.registrar({
      id: "compra-nueva",
      compradorId: "usuario-sofia",
      eventoId: "evento-festival",
      tipo: new TipoEntrada({ id: "tipo-vip", nombre: "VIP", descripcion: "", precio: 100, cupo: 5 }),
      cantidad: 2,
      codigos,
      ahora: CREADA,
    });
    expect(compra.entradas.map((entrada) => entrada.codigo)).toEqual(codigos);
    for (const entrada of compra.entradas) {
      expect(entrada.uso).toBeNull();
      expect(entrada.cancelacion).toBeNull();
      expect(entrada.usadaEn).toBeNull();
      expect(compra.estadoDe(entrada)).toBe(EstadoCompra.PENDIENTE);
    }
  });

  describe("invariantes", () => {
    it("tantas entradas como la cantidad", () => {
      expect(camposInvalidos({ entradas: [new Entrada({ codigo: "7K3MQ9TB" })] })).toEqual(["entradas"]);
      expect(camposInvalidos({ entradas: [] })).toEqual(["entradas"]);
    });

    it("un código inválido", () => {
      for (const codigo of ["7k3mq9tb", "7K3MQ9T", "7K3M-Q9T", "7K3MQ9TI"]) {
        expect(
          camposInvalidos({ entradas: [new Entrada({ codigo: "7K3MQ9TB" }), new Entrada({ codigo })] }),
        ).toEqual(["entradas"]);
      }
    });

    it("un código repetido dentro de la compra", () => {
      expect(
        camposInvalidos({
          entradas: [new Entrada({ codigo: "7K3MQ9TB" }), new Entrada({ codigo: "7K3MQ9TB" })],
        }),
      ).toEqual(["entradas"]);
    });

    it("una entrada usada en una compra que no llegó a CONFIRMADA", () => {
      const entradas = [
        new Entrada({ codigo: "7K3MQ9TB", uso: usoPorLucia(usada.fechaHora) }),
        new Entrada({ codigo: "7K3MQ9TC" }),
      ];
      expect(camposInvalidos({ entradas })).toEqual(["entradas"]);
      expect(
        camposInvalidos({
          entradas,
          historial: [
            pendiente,
            { estado: EstadoCompra.CANCELADA, autor: porMartin, fechaHora: despues(MINUTO) },
          ],
        }),
      ).toEqual(["entradas"]);
    });
  });

  describe("estado derivado (FR-012a)", () => {
    const estados = (compra: Compra) => codigos.map((codigo) => compra.estadoDeEntrada(codigo));

    it("con la compra PENDIENTE, todas PENDIENTE", () => {
      expect(estados(compraPendiente())).toEqual([EstadoCompra.PENDIENTE, EstadoCompra.PENDIENTE]);
    });

    it("tras pagar, todas CONFIRMADA", () => {
      const pagada = compraPendiente().pagar("usuario-martin", despues(MINUTO));
      expect(estados(pagada)).toEqual([EstadoCompra.CONFIRMADA, EstadoCompra.CONFIRMADA]);
    });

    it("tras cancelar o vencer, todas CANCELADA", () => {
      const cancelada = compraPendiente().cancelar("usuario-martin", despues(MINUTO), LEJOS);
      expect(estados(cancelada)).toEqual([EstadoCompra.CANCELADA, EstadoCompra.CANCELADA]);
      expect(estados(compraPendiente().vencer())).toEqual([EstadoCompra.CANCELADA, EstadoCompra.CANCELADA]);
    });

    it("una PENDIENTE vencida, al día, las da CANCELADA", () => {
      expect(estados(compraPendiente().alDia(despues(PLAZO)))).toEqual([
        EstadoCompra.CANCELADA,
        EstadoCompra.CANCELADA,
      ]);
    });

    it("con la compra utilizada, una entrada usada es UTILIZADA y tiene usadaEn", () => {
      const compra = compraConfirmada({
        historial: [pendiente, confirmada, usada],
        entradas: [
          new Entrada({ codigo: "7K3MQ9TB", uso: usoPorLucia(usada.fechaHora) }),
          new Entrada({ codigo: "7K3MQ9TC" }),
        ],
      });
      expect(estados(compra)).toEqual([EstadoCompra.UTILIZADA, EstadoCompra.CONFIRMADA]);
      expect(compra.entradas[0]!.usadaEn).toEqual(usada.fechaHora);
      expect(compra.entradas[1]!.usadaEn).toBeNull();
    });

    it("un código ajeno → null", () => {
      expect(compraPendiente().estadoDeEntrada("ZZZZZZZZ")).toBeNull();
    });
  });

  it("pagar, cancelar, vencer y alDia conservan las entradas", () => {
    const codigosDe = (compra: Compra) => compra.entradas.map((entrada) => entrada.codigo);
    expect(codigosDe(compraPendiente().pagar("usuario-martin", despues(MINUTO)))).toEqual(codigos);
    expect(codigosDe(compraPendiente().cancelar("usuario-martin", despues(MINUTO), LEJOS))).toEqual(codigos);
    expect(codigosDe(compraPendiente().vencer())).toEqual(codigos);
    expect(codigosDe(compraPendiente().alDia(despues(PLAZO)))).toEqual(codigos);
  });
});

describe("Compra.registrarUso (feature 008, R9)", () => {
  const [codigoA, codigoB] = datos.entradas.map((entrada) => entrada.codigo) as [string, string];
  const USO = despues(60 * MINUTO);
  const cambioDeUso = (fechaHora: Date): CambioEstadoCompra => ({
    estado: EstadoCompra.UTILIZADA,
    autor: porLucia,
    fechaHora,
  });

  /** El error de dominio que lanza `operacion`. */
  function errorDe(operacion: () => unknown): ReglaDeNegocioError {
    try {
      operacion();
    } catch (error) {
      expect(error).toBeInstanceOf(ReglaDeNegocioError);
      return error as ReglaDeNegocioError;
    }
    throw new Error("Debía lanzar ReglaDeNegocioError.");
  }

  it("sobre una CONFIRMADA: la entrada y la compra pasan a UTILIZADA con el mismo cambio", () => {
    const original = compraConfirmada();
    const usada = original.registrarUso(codigoA, "usuario-lucia", USO);
    expect(usada).not.toBe(original);
    expect(usada.estado).toBe(EstadoCompra.UTILIZADA);
    expect(usada.historial).toEqual([pendiente, confirmada, cambioDeUso(USO)]);
    const entrada = usada.entradas.find((e) => e.codigo === codigoA)!;
    expect(entrada.uso).toEqual(usoPorLucia(USO));
    expect(entrada.usadaEn).toEqual(USO);
    expect(usada.estadoDeEntrada(codigoA)).toBe(EstadoCompra.UTILIZADA);
    expect(usada.estadoDeEntrada(codigoB)).toBe(EstadoCompra.CONFIRMADA);
    expect(usada.entradasUsadas).toBe(1);
    expect(original.estado).toBe(EstadoCompra.CONFIRMADA);
    expect(original.entradasUsadas).toBe(0);
    expect(original.estadoDeEntrada(codigoA)).toBe(EstadoCompra.CONFIRMADA);
  });

  it("una segunda entrada de una UTILIZADA: la entrada pasa a UTILIZADA y el historial no cambia", () => {
    const primera = compraConfirmada().registrarUso(codigoA, "usuario-lucia", USO);
    const segunda = primera.registrarUso(codigoB, "usuario-lucia", despues(70 * MINUTO));
    expect(segunda.historial).toEqual(primera.historial);
    expect(segunda.estadoDeEntrada(codigoB)).toBe(EstadoCompra.UTILIZADA);
    expect(segunda.entradas.find((e) => e.codigo === codigoB)!.uso).toEqual(
      usoPorLucia(despues(70 * MINUTO)),
    );
    expect(segunda.entradas.find((e) => e.codigo === codigoB)!.usadaEn).toEqual(despues(70 * MINUTO));
    expect(segunda.entradasUsadas).toBe(2);
  });

  it.each([
    [
      "UTILIZADA",
      () => compraConfirmada().registrarUso(codigoA, "usuario-lucia", USO),
      "Esta entrada ya se utilizó.",
    ],
    ["PENDIENTE", () => compraPendiente(), "La compra de esta entrada todavía no se pagó."],
    ["CANCELADA", () => compraCancelada(), "La compra de esta entrada está cancelada."],
    [
      "CANCELADA (vencida al día)",
      () => compraPendiente().alDia(despues(PLAZO)),
      "La compra de esta entrada está cancelada.",
    ],
    // Desde la 009 (R3), las entradas de una REEMBOLSADA están canceladas.
    ["REEMBOLSADA", () => compraReembolsada(), "La compra de esta entrada está cancelada."],
  ])("una entrada %s → TRANSICION_INVALIDA con su mensaje y nada cambia", (_estado, crear, mensaje) => {
    const compra = crear();
    const historial = [...compra.historial];
    const error = errorDe(() => compra.registrarUso(codigoA, "usuario-lucia", despues(PLAZO * 8)));
    expect(error.codigo).toBe("TRANSICION_INVALIDA");
    expect(error.message).toBe(mensaje);
    expect(compra.historial).toEqual(historial);
  });

  it("un código que no es de la compra → TRANSICION_INVALIDA (nunca un 404 desde el dominio)", () => {
    const error = errorDe(() => compraConfirmada().registrarUso("ZZZZZZZZ", "usuario-lucia", USO));
    expect(error.codigo).toBe("TRANSICION_INVALIDA");
  });

  describe("invariante: estado UTILIZADA ⇔ alguna entrada UTILIZADA", () => {
    it("una CONFIRMADA con una entrada usada es inválida", () => {
      expect(
        camposInvalidos({
          historial: [pendiente, confirmada],
          entradas: [
            new Entrada({ codigo: codigoA, uso: usoPorLucia(USO) }),
            new Entrada({ codigo: codigoB }),
          ],
        }),
      ).toEqual(["entradas"]);
    });

    it("una UTILIZADA sin entradas usadas es inválida", () => {
      expect(camposInvalidos({ historial: [pendiente, confirmada, cambioDeUso(USO)] })).toEqual(["entradas"]);
    });
  });

  it("una UTILIZADA no se cancela (FR-020) y es vigente", () => {
    const usada = compraConfirmada().registrarUso(codigoA, "usuario-lucia", USO);
    expect(errorDe(() => usada.cancelar("usuario-martin", USO, LEJOS)).codigo).toBe("TRANSICION_INVALIDA");
    expect(usada.esVigente(despues(PLAZO * 10))).toBe(true);
  });

  it("las transiciones de una UTILIZADA conservan el uso de sus entradas", () => {
    const usada = compraConfirmada().registrarUso(codigoA, "usuario-lucia", USO);
    expect(usada.alDia(despues(PLAZO * 10))).toBe(usada);
  });
});

describe("Cancelación y reembolso derivados del historial (feature 009, R3, R4, R6)", () => {
  const INICIO = despues(DIA);
  const antesDelInicio = new Date(INICIO.getTime() - MINUTO);
  const codigos = datos.entradas.map((entrada) => entrada.codigo);
  const usoDeA: CambioEstadoCompra = {
    estado: EstadoCompra.UTILIZADA,
    autor: porLucia,
    fechaHora: despues(60 * MINUTO),
  };
  const compraUtilizada = () =>
    compraConfirmada({
      historial: [pendiente, confirmada, usoDeA],
      entradas: [
        new Entrada({ codigo: codigos[0]!, uso: usoPorLucia(usoDeA.fechaHora) }),
        new Entrada({ codigo: codigos[1]! }),
      ],
    });
  const compraVencida = () => compraPendiente().vencer();

  // `Entrada.cancelar` se prueba en `entrada.test.ts` (feature 010).

  describe("Compra.estadoDe (antes Entrada.estadoEn)", () => {
    const estados = (compra: Compra) => codigos.map((codigo) => compra.estadoDeEntrada(codigo));

    it("si la compra nunca llegó a CONFIRMADA, el estado de la compra", () => {
      expect(estados(compraPendiente())).toEqual([EstadoCompra.PENDIENTE, EstadoCompra.PENDIENTE]);
      expect(estados(compraCancelada())).toEqual([EstadoCompra.CANCELADA, EstadoCompra.CANCELADA]);
      expect(estados(compraVencida())).toEqual([EstadoCompra.CANCELADA, EstadoCompra.CANCELADA]);
    });

    it("en una CANCELADA o una REEMBOLSADA después de confirmada, CANCELADA (la entrada cancelada)", () => {
      expect(estados(compraCanceladaDesdeConfirmada())).toEqual([
        EstadoCompra.CANCELADA,
        EstadoCompra.CANCELADA,
      ]);
      expect(estados(compraReembolsada())).toEqual([EstadoCompra.CANCELADA, EstadoCompra.CANCELADA]);
    });

    it("en una CONFIRMADA o UTILIZADA, como en la 008", () => {
      expect(estados(compraConfirmada())).toEqual([EstadoCompra.CONFIRMADA, EstadoCompra.CONFIRMADA]);
      expect(estados(compraUtilizada())).toEqual([EstadoCompra.UTILIZADA, EstadoCompra.CONFIRMADA]);
    });
  });

  it("fueConfirmada: el historial tiene un CONFIRMADA", () => {
    for (const compra of [
      compraConfirmada(),
      compraUtilizada(),
      compraCanceladaDesdeConfirmada(),
      compraReembolsada(),
    ]) {
      expect(compra.fueConfirmada).toBe(true);
    }
    for (const compra of [compraPendiente(), compraCancelada(), compraVencida()]) {
      expect(compra.fueConfirmada).toBe(false);
    }
  });

  describe("canceladaDesde", () => {
    it("CONFIRMADA en CANCELADA y REEMBOLSADA que pasaron por CONFIRMADA (también una gratis)", () => {
      expect(compraCanceladaDesdeConfirmada().canceladaDesde).toBe("CONFIRMADA");
      expect(compraCanceladaDesdeConfirmada({ total: 0 }).canceladaDesde).toBe("CONFIRMADA");
      expect(compraReembolsada().canceladaDesde).toBe("CONFIRMADA");
    });

    it("PENDIENTE en una CANCELADA sin confirmar: por el comprador o vencida (también al día)", () => {
      expect(compraCancelada().canceladaDesde).toBe("PENDIENTE");
      expect(compraVencida().canceladaDesde).toBe("PENDIENTE");
      expect(compraPendiente().alDia(despues(PLAZO)).canceladaDesde).toBe("PENDIENTE");
    });

    it("null en PENDIENTE, CONFIRMADA y UTILIZADA", () => {
      expect(compraPendiente().canceladaDesde).toBeNull();
      expect(compraConfirmada().canceladaDesde).toBeNull();
      expect(compraUtilizada().canceladaDesde).toBeNull();
    });
  });

  describe("cambioDeCancelacion", () => {
    it("el cambio a CANCELADA del historial, también en una REEMBOLSADA", () => {
      expect(compraCanceladaDesdeConfirmada().cambioDeCancelacion).toEqual(cancelacion);
      expect(compraReembolsada().cambioDeCancelacion).toEqual(cancelacion);
      expect(compraVencida().cambioDeCancelacion).toMatchObject({
        estado: EstadoCompra.CANCELADA,
        autor: { tipo: "sistema" },
      });
    });

    it("null si no hay", () => {
      expect(compraPendiente().cambioDeCancelacion).toBeNull();
      expect(compraConfirmada().cambioDeCancelacion).toBeNull();
      expect(compraUtilizada().cambioDeCancelacion).toBeNull();
    });
  });

  describe("reembolso (tabla de data-model, feature 010)", () => {
    it("REEMBOLSADA → confirmado", () => {
      expect(compraReembolsada().reembolso).toBe("confirmado");
    });

    it("CANCELADA después de confirmada y paga → pendiente", () => {
      expect(compraCanceladaDesdeConfirmada().reembolso).toBe("pendiente");
    });

    it("CANCELADA después de confirmada y gratis → null", () => {
      expect(compraCanceladaDesdeConfirmada({ total: 0 }).reembolso).toBeNull();
    });

    it("CANCELADA desde pendiente o vencida (también al día) → null", () => {
      expect(compraCancelada().reembolso).toBeNull();
      expect(compraVencida().reembolso).toBeNull();
      expect(compraPendiente().alDia(despues(PLAZO)).reembolso).toBeNull();
    });

    it("PENDIENTE, CONFIRMADA y UTILIZADA → null", () => {
      expect(compraPendiente().reembolso).toBeNull();
      expect(compraConfirmada().reembolso).toBeNull();
      expect(compraUtilizada().reembolso).toBeNull();
    });
  });

  describe("motivoNoCancelable (tabla de R6)", () => {
    it("PENDIENTE → null, también con el evento empezado", () => {
      const inicioCercano = despues(5 * MINUTO);
      expect(compraPendiente().motivoNoCancelable(INICIO, despues(MINUTO))).toBeNull();
      expect(compraPendiente().motivoNoCancelable(inicioCercano, despues(10 * MINUTO))).toBeNull();
    });

    it("CONFIRMADA 1 minuto antes del inicio → null", () => {
      expect(compraConfirmada().motivoNoCancelable(INICIO, antesDelInicio)).toBeNull();
    });

    it("CONFIRMADA exactamente en el inicio y después → evento-empezado", () => {
      expect(compraConfirmada().motivoNoCancelable(INICIO, INICIO)).toBe("evento-empezado");
      const unaHoraDespues = new Date(INICIO.getTime() + 60 * MINUTO);
      expect(compraConfirmada().motivoNoCancelable(INICIO, unaHoraDespues)).toBe("evento-empezado");
    });

    it("UTILIZADA → entrada-usada, con el evento empezado y sin empezar", () => {
      expect(compraUtilizada().motivoNoCancelable(INICIO, antesDelInicio)).toBe("entrada-usada");
      expect(compraUtilizada().motivoNoCancelable(INICIO, INICIO)).toBe("entrada-usada");
    });

    it("CANCELADA → cancelada (desde confirmada, pendiente cancelada o vencida)", () => {
      for (const compra of [compraCanceladaDesdeConfirmada(), compraCancelada(), compraVencida()]) {
        expect(compra.motivoNoCancelable(INICIO, antesDelInicio)).toBe("cancelada");
        expect(compra.motivoNoCancelable(INICIO, INICIO)).toBe("cancelada");
      }
    });

    it("REEMBOLSADA → reembolsada", () => {
      expect(compraReembolsada().motivoNoCancelable(INICIO, antesDelInicio)).toBe("reembolsada");
      expect(compraReembolsada().motivoNoCancelable(INICIO, INICIO)).toBe("reembolsada");
    });
  });

  describe("invariantes del historial: REEMBOLSADA", () => {
    const campos = (cambios: Partial<PropiedadesCompra>) =>
      camposInvalidos({ entradas: entradasCanceladas(), ...cambios });

    it("una REEMBOLSADA válida se crea", () => {
      expect(() => compraReembolsada()).not.toThrow();
    });

    it("rechaza un REEMBOLSADA que no es el último cambio", () => {
      const otraCancelacion = { ...cancelacion, fechaHora: despues(30 * MINUTO) };
      expect(campos({ historial: [pendiente, confirmada, cancelacion, reembolso, otraCancelacion] })).toEqual(
        ["historial"],
      );
    });

    it("rechaza un REEMBOLSADA que no sigue inmediatamente a un CANCELADA", () => {
      expect(campos({ historial: [pendiente, confirmada, reembolso] })).toEqual(["historial"]);
    });

    it("rechaza un REEMBOLSADA de una compra que no pasó por CONFIRMADA", () => {
      expect(
        camposInvalidos({
          historial: [pendiente, { ...cancelacion, fechaHora: despues(MINUTO) }, reembolso],
        }),
      ).toEqual(["historial"]);
    });

    it("rechaza un REEMBOLSADA con total 0", () => {
      expect(campos({ total: 0, historial: [pendiente, confirmada, cancelacion, reembolso] })).toEqual([
        "historial",
      ]);
    });
  });

  describe("invariantes de las entradas (uso y cancelación según el estado de la compra)", () => {
    const [codigoA, codigoB] = codigos as [string, string];
    const cancelada = (codigo: string) => new Entrada({ codigo, cancelacion: cancelacionDeEntrada });
    const usada = (codigo: string) => new Entrada({ codigo, uso: usoPorLucia(usoDeA.fechaHora) });
    const sinCambios = (codigo: string) => new Entrada({ codigo });

    it("si la compra no pasó por CONFIRMADA, ninguna entrada usada ni cancelada", () => {
      expect(
        camposInvalidos({
          historial: [pendiente, { ...cancelacion, fechaHora: despues(MINUTO) }],
          entradas: [cancelada(codigoA), cancelada(codigoB)],
        }),
      ).toEqual(["entradas"]);
    });

    it("CONFIRMADA: ninguna cancelada", () => {
      expect(
        camposInvalidos({
          historial: [pendiente, confirmada],
          entradas: [cancelada(codigoA), sinCambios(codigoB)],
        }),
      ).toEqual(["entradas"]);
    });

    it("UTILIZADA: alguna usada y ninguna cancelada", () => {
      expect(
        camposInvalidos({
          historial: [pendiente, confirmada, usoDeA],
          entradas: [usada(codigoA), cancelada(codigoB)],
        }),
      ).toEqual(["entradas"]);
    });

    it.each([
      ["CANCELADA", [pendiente, confirmada, cancelacion]],
      ["REEMBOLSADA", [pendiente, confirmada, cancelacion, reembolso]],
    ])("%s después de confirmada: cada entrada cancelada y ninguna usada", (_estado, historial) => {
      const usadaYCancelada = new Entrada({
        codigo: codigoB,
        uso: usoPorLucia(usoDeA.fechaHora),
        cancelacion: cancelacionDeEntrada,
      });
      expect(
        () => new Compra(con({ historial, entradas: [cancelada(codigoA), cancelada(codigoB)] })),
      ).not.toThrow();
      expect(camposInvalidos({ historial, entradas: [cancelada(codigoA), sinCambios(codigoB)] })).toEqual([
        "entradas",
      ]);
      expect(camposInvalidos({ historial, entradas: [cancelada(codigoA), usada(codigoB)] })).toEqual([
        "entradas",
      ]);
      expect(
        camposInvalidos({
          historial,
          entradas: [cancelada(codigoA), usadaYCancelada],
        }),
      ).toEqual(["entradas"]);
    });
  });

  it("esVigente es false en una CANCELADA desde confirmada y en una REEMBOLSADA (FR-004)", () => {
    expect(compraCanceladaDesdeConfirmada().esVigente(despues(MINUTO))).toBe(false);
    expect(compraReembolsada().esVigente(despues(MINUTO))).toBe(false);
  });
});

describe("Compra.cancelar de una CONFIRMADA (feature 009, R1)", () => {
  const INICIO = despues(DIA);
  const antesDelInicio = new Date(INICIO.getTime() - MINUTO);
  const codigos = datos.entradas.map((entrada) => entrada.codigo);
  const cambioDeCancelacion = (fechaHora: Date): CambioEstadoCompra => ({
    estado: EstadoCompra.CANCELADA,
    autor: porMartin,
    fechaHora,
  });

  it("1 minuto antes del inicio → CANCELADA por el comprador, cada entrada cancelada; la original no cambia", () => {
    const original = compraConfirmada();
    const cancelada = original.cancelar("usuario-martin", antesDelInicio, INICIO);
    expect(cancelada).not.toBe(original);
    expect(cancelada.estado).toBe(EstadoCompra.CANCELADA);
    expect(cancelada.historial).toEqual([pendiente, confirmada, cambioDeCancelacion(antesDelInicio)]);
    for (const entrada of cancelada.entradas) {
      expect(entrada.cancelacion).toEqual({ usuarioId: "usuario-martin", fechaHora: antesDelInicio });
      expect(entrada.usada).toBe(false);
    }
    expect(codigos.map((codigo) => cancelada.estadoDeEntrada(codigo))).toEqual([
      EstadoCompra.CANCELADA,
      EstadoCompra.CANCELADA,
    ]);
    expect(cancelada.entradas.map((entrada) => entrada.codigo)).toEqual(codigos);
    expect(cancelada.canceladaDesde).toBe("CONFIRMADA");
    expect(cancelada.cambioDeCancelacion).toEqual(cambioDeCancelacion(antesDelInicio));
    expect(cancelada.reembolso).toBe("pendiente");
    expect(cancelada.esVigente(antesDelInicio)).toBe(false);
    expect(original.estado).toBe(EstadoCompra.CONFIRMADA);
    expect(original.entradas.every((entrada) => !entrada.usada && !entrada.cancelada)).toBe(true);
  });

  it("una CONFIRMADA gratis → CANCELADA con sus entradas canceladas y sin reembolso pendiente", () => {
    const cancelada = compraConfirmada({ total: 0 }).cancelar("usuario-martin", antesDelInicio, INICIO);
    expect(cancelada.estado).toBe(EstadoCompra.CANCELADA);
    expect(cancelada.entradas.every((e) => e.cancelada)).toBe(true);
    expect(cancelada.reembolso).toBeNull();
  });

  it("la PENDIENTE sigue como en la 006: CANCELADA sin cambios en sus entradas; vencida → COMPRA_VENCIDA", () => {
    const cancelada = compraPendiente().cancelar("usuario-martin", despues(MINUTO), INICIO);
    expect(cancelada.canceladaDesde).toBe("PENDIENTE");
    expect(cancelada.entradas.every((entrada) => !entrada.usada && !entrada.cancelada)).toBe(true);
    expect(() => compraPendiente().cancelar("usuario-martin", despues(PLAZO), INICIO)).toThrow(
      expect.objectContaining({ codigo: "COMPRA_VENCIDA" }),
    );
  });

  it("registrarUso sobre una entrada de la compra cancelada → TRANSICION_INVALIDA", () => {
    const cancelada = compraConfirmada().cancelar("usuario-martin", antesDelInicio, INICIO);
    for (const compra of [cancelada, compraReembolsada()]) {
      expect(() => compra.registrarUso(codigos[0]!, "usuario-lucia", INICIO)).toThrow(
        expect.objectContaining({
          codigo: "TRANSICION_INVALIDA",
          message: "La compra de esta entrada está cancelada.",
        }),
      );
    }
  });

  it("exactamente en el inicio → EVENTO_REALIZADO", () => {
    expect(() => compraConfirmada().cancelar("usuario-martin", INICIO, INICIO)).toThrow(
      expect.objectContaining({
        codigo: "EVENTO_REALIZADO",
        message: "El evento ya empezó: ya no se puede cancelar la compra.",
      }),
    );
  });

  it.each([
    [
      "UTILIZADA",
      () => compraConfirmada().registrarUso(codigos[0]!, "usuario-lucia", despues(MINUTO * 30)),
      "Ya se usó una entrada de esta compra: no se puede cancelar.",
    ],
    ["CANCELADA desde confirmada", () => compraCanceladaDesdeConfirmada(), "La compra ya está cancelada."],
    ["REEMBOLSADA", () => compraReembolsada(), "La compra ya fue reembolsada."],
  ])("%s → TRANSICION_INVALIDA con su mensaje", (_estado, crear, mensaje) => {
    expect(() => crear().cancelar("usuario-martin", antesDelInicio, INICIO)).toThrow(
      expect.objectContaining({ codigo: "TRANSICION_INVALIDA", message: mensaje }),
    );
  });
});

describe("Compra.cancelar: rechazos (feature 009, US3, FR-007, FR-008, FR-010)", () => {
  const INICIO = despues(DIA);
  const antesDelInicio = new Date(INICIO.getTime() - MINUTO);
  const unaHoraDespues = new Date(INICIO.getTime() + 60 * MINUTO);
  const usoDeUna: CambioEstadoCompra = {
    estado: EstadoCompra.UTILIZADA,
    autor: porLucia,
    fechaHora: despues(60 * MINUTO),
  };
  /** Una UTILIZADA con 1 de sus 3 entradas usada. */
  const utilizadaUnaDeTres = () => {
    const [primera, ...resto] = entradasDePrueba(3);
    return new Compra(
      con({
        cantidad: 3,
        total: 360000,
        historial: [pendiente, confirmada, usoDeUna],
        entradas: [new Entrada({ codigo: primera!.codigo, uso: usoPorLucia(usoDeUna.fechaHora) }), ...resto],
      }),
    );
  };
  const vencidaMaterializada = () => compraPendiente().vencer();

  /** Que `cancelar` rechace con ese código y mensaje sin cambiar la instancia, sus entradas ni su historial. */
  function rechaza(compra: Compra, ahora: Date, codigo: string, mensaje: string) {
    const historial = [...compra.historial];
    const entradas = compra.entradas.map((entrada) => [entrada.codigo, entrada.uso, entrada.cancelacion]);
    expect(() => compra.cancelar("usuario-martin", ahora, INICIO)).toThrow(
      expect.objectContaining({ codigo, message: mensaje }),
    );
    expect(() => compra.cancelar("usuario-martin", ahora, INICIO)).toThrow(ReglaDeNegocioError);
    expect(compra.historial).toEqual(historial);
    expect(compra.entradas.map((entrada) => [entrada.codigo, entrada.uso, entrada.cancelacion])).toEqual(
      entradas,
    );
  }

  it("CONFIRMADA exactamente en el inicio y 1 hora después → EVENTO_REALIZADO", () => {
    for (const ahora of [INICIO, unaHoraDespues]) {
      rechaza(
        compraConfirmada(),
        ahora,
        "EVENTO_REALIZADO",
        "El evento ya empezó: ya no se puede cancelar la compra.",
      );
    }
  });

  it("UTILIZADA (1 de 3 usada), con el evento sin empezar y empezado → TRANSICION_INVALIDA, nunca EVENTO_REALIZADO", () => {
    for (const ahora of [antesDelInicio, INICIO, unaHoraDespues]) {
      rechaza(
        utilizadaUnaDeTres(),
        ahora,
        "TRANSICION_INVALIDA",
        "Ya se usó una entrada de esta compra: no se puede cancelar.",
      );
    }
  });

  it("CANCELADA desde confirmada o pendiente cancelada → «La compra ya está cancelada.»", () => {
    for (const compra of [compraCanceladaDesdeConfirmada(), compraCancelada()]) {
      for (const ahora of [antesDelInicio, INICIO]) {
        rechaza(compra, ahora, "TRANSICION_INVALIDA", "La compra ya está cancelada.");
      }
    }
  });

  it("una pendiente vencida, materializada o no, sigue dando COMPRA_VENCIDA (006, R1)", () => {
    const mensaje = "La compra venció: pasaron 15 minutos sin pagarla.";
    rechaza(compraPendiente(), despues(PLAZO), "COMPRA_VENCIDA", mensaje);
    rechaza(vencidaMaterializada(), antesDelInicio, "COMPRA_VENCIDA", mensaje);
  });

  it("REEMBOLSADA, con el evento empezado o no → «La compra ya fue reembolsada.»", () => {
    for (const ahora of [antesDelInicio, INICIO, unaHoraDespues]) {
      rechaza(compraReembolsada(), ahora, "TRANSICION_INVALIDA", "La compra ya fue reembolsada.");
    }
  });
});

describe("Compra.confirmarReembolso (feature 009, R5)", () => {
  const AHORA = despues(30 * MINUTO);
  const SIN_PENDIENTE = "Esta compra no tiene un reembolso pendiente.";
  const vencida = () =>
    new Compra(
      con({
        historial: [
          pendiente,
          { estado: EstadoCompra.CANCELADA, autor: { tipo: "sistema" }, fechaHora: despues(PLAZO) },
        ],
      }),
    );

  it("una CANCELADA paga desde confirmada → REEMBOLSADA por el organizador; las entradas no cambian", () => {
    const original = compraCanceladaDesdeConfirmada();
    const reembolsada = original.confirmarReembolso("usuario-lucia", AHORA);
    expect(reembolsada).not.toBe(original);
    expect(reembolsada.estado).toBe(EstadoCompra.REEMBOLSADA);
    expect(reembolsada.historial).toEqual([
      pendiente,
      confirmada,
      cancelacion,
      { estado: EstadoCompra.REEMBOLSADA, autor: porLucia, fechaHora: AHORA },
    ]);
    for (const entrada of reembolsada.entradas) expect(entrada.cancelacion).toEqual(cancelacionDeEntrada);
    expect(reembolsada.canceladaDesde).toBe("CONFIRMADA");
    expect(reembolsada.cambioDeCancelacion).toEqual(cancelacion);
    expect(reembolsada.reembolso).toBe("confirmado");
    expect(original.estado).toBe(EstadoCompra.CANCELADA);
  });

  it("sin plazo: se confirma mucho después (no recibe la fecha del evento)", () => {
    const reembolsada = compraCanceladaDesdeConfirmada().confirmarReembolso("usuario-lucia", LEJOS);
    expect(reembolsada.estado).toBe(EstadoCompra.REEMBOLSADA);
  });

  it("una REEMBOLSADA → TRANSICION_INVALIDA «ya se confirmó» y no cambia", () => {
    const compra = compraReembolsada();
    expect(() => compra.confirmarReembolso("usuario-lucia", AHORA)).toThrow(
      expect.objectContaining({
        codigo: "TRANSICION_INVALIDA",
        message: "El reembolso de esta compra ya se confirmó.",
      }),
    );
    expect(compra.historial).toHaveLength(4);
  });

  it.each([
    ["PENDIENTE", () => compraPendiente()],
    ["CONFIRMADA", () => compraConfirmada()],
    ["UTILIZADA", () => compraConfirmada().registrarUso("7K3MQ9TB", "usuario-lucia", despues(10 * MINUTO))],
    ["pendiente cancelada", () => compraCancelada()],
    ["vencida", vencida],
    ["gratis cancelada desde confirmada", () => compraCanceladaDesdeConfirmada({ total: 0 })],
  ])("%s → TRANSICION_INVALIDA «no tiene un reembolso pendiente» y no cambia", (_caso, crear) => {
    const compra = crear();
    const estado = compra.estado;
    const largo = compra.historial.length;
    expect(() => compra.confirmarReembolso("usuario-lucia", AHORA)).toThrow(
      expect.objectContaining({ codigo: "TRANSICION_INVALIDA", message: SIN_PENDIENTE }),
    );
    expect(() => compra.confirmarReembolso("usuario-lucia", AHORA)).toThrow(ReglaDeNegocioError);
    expect(compra.estado).toBe(estado);
    expect(compra.historial).toHaveLength(largo);
  });
});

describe("Mensajes de la compra (feature 011)", () => {
  const mensaje = (autorId: string, texto: string, minutos: number) =>
    new Mensaje({ autorId, texto, enviadoEn: despues(minutos * MINUTO) });
  const conversacion = () => [
    mensaje("usuario-martin", "Hola", 1),
    mensaje("usuario-lucia", "¡Hola, Martín!", 2),
  ];
  const AHORA = despues(30 * MINUTO);

  it("sin mensajes en las propiedades la compra tiene [], y Compra.registrar arranca con []", () => {
    expect(compraPendiente().mensajes).toEqual([]);
    const tipo = new TipoEntrada({
      id: "tipo-festival-vip",
      nombre: "VIP",
      descripcion: "",
      precio: 1,
      cupo: 5,
    });
    const alta = Compra.registrar({
      id: "compra-nueva",
      compradorId: "usuario-sofia",
      eventoId: "evento-festival",
      tipo,
      cantidad: 1,
      codigos: ["7K3MQ9TB"],
      ahora: CREADA,
    });
    expect(alta.mensajes).toEqual([]);
  });

  it("conserva los mensajes recibidos, congelados (como las entradas)", () => {
    const mensajes = conversacion();
    const compra = compraConfirmada({ mensajes });

    expect(compra.mensajes).toEqual(mensajes);
    expect(Object.isFrozen(compra.mensajes)).toBe(true);
    mensajes.pop();
    expect(compra.mensajes).toHaveLength(2);
  });

  it("enviarMensaje agrega al final un mensaje con autor, texto y ahora, en una compra nueva", () => {
    const original = compraConfirmada({ mensajes: conversacion() });

    const conMensaje = original.enviarMensaje("usuario-martin", "¡Genial, gracias!", AHORA);

    expect(conMensaje).not.toBe(original);
    expect(conMensaje.mensajes).toHaveLength(3);
    expect(conMensaje.mensajes[2]).toBeInstanceOf(Mensaje);
    expect(conMensaje.mensajes[2]).toMatchObject({
      autorId: "usuario-martin",
      texto: "¡Genial, gracias!",
      enviadoEn: AHORA,
    });
    expect(conMensaje.mensajes.slice(0, 2)).toEqual(original.mensajes);
    expect(original.mensajes).toHaveLength(2);
  });

  it("enviarMensaje no cambia estado, historial, entradas, total, cantidad ni reembolso", () => {
    const original = compraCanceladaDesdeConfirmada();

    const conMensaje = original.enviarMensaje("usuario-lucia", "Ya te reembolso.", AHORA);

    expect(conMensaje.estado).toBe(original.estado);
    expect(conMensaje.historial).toEqual(original.historial);
    expect(conMensaje.entradas).toEqual(original.entradas);
    expect(conMensaje.total).toBe(original.total);
    expect(conMensaje.cantidad).toBe(original.cantidad);
    expect(conMensaje.reembolso).toBe(original.reembolso);
  });

  it.each([
    ["PENDIENTE", () => compraPendiente(), EstadoCompra.PENDIENTE, despues(MINUTO)],
    ["PENDIENTE vencida sin materializar", () => compraPendiente(), EstadoCompra.PENDIENTE, AHORA],
    ["CONFIRMADA", () => compraConfirmada(), EstadoCompra.CONFIRMADA, AHORA],
    [
      "UTILIZADA",
      () => compraConfirmada().registrarUso("7K3MQ9TB", "usuario-lucia", despues(10 * MINUTO)),
      EstadoCompra.UTILIZADA,
      AHORA,
    ],
    ["CANCELADA por el comprador", () => compraCancelada(), EstadoCompra.CANCELADA, AHORA],
    ["CANCELADA por vencimiento", () => compraPendiente().vencer(), EstadoCompra.CANCELADA, AHORA],
    ["REEMBOLSADA", () => compraReembolsada(), EstadoCompra.REEMBOLSADA, AHORA],
  ])("enviarMensaje funciona en una %s", (_caso, crear, estado, ahora) => {
    const conMensaje = crear().enviarMensaje("usuario-martin", "Hola", ahora);

    expect(conMensaje.estado).toBe(estado);
    expect(conMensaje.mensajes.map((m) => m.texto)).toEqual(["Hola"]);
  });

  it("enviarMensaje no recibe la fecha del evento", () => {
    expect(Compra.prototype.enviarMensaje.length).toBe(3);
  });

  it("dos mensajes seguidos quedan en orden", () => {
    const compra = compraConfirmada()
      .enviarMensaje("usuario-martin", "Primero", AHORA)
      .enviarMensaje("usuario-lucia", "Segundo", AHORA);

    expect(compra.mensajes.map((m) => [m.autorId, m.texto])).toEqual([
      ["usuario-martin", "Primero"],
      ["usuario-lucia", "Segundo"],
    ]);
  });

  describe("cada transición conserva los mensajes", () => {
    const esperados = () => conversacion().map((m) => [m.autorId, m.texto, m.enviadoEn]);
    const resumen = (compra: Compra) => compra.mensajes.map((m) => [m.autorId, m.texto, m.enviadoEn]);

    it("pagar", () => {
      const pagada = compraPendiente({ mensajes: conversacion() }).pagar(
        "usuario-martin",
        despues(5 * MINUTO),
      );
      expect(pagada.estado).toBe(EstadoCompra.CONFIRMADA);
      expect(resumen(pagada)).toEqual(esperados());
    });

    it("cancelar una pendiente", () => {
      const cancelada = compraPendiente({ mensajes: conversacion() }).cancelar(
        "usuario-martin",
        despues(5 * MINUTO),
        LEJOS,
      );
      expect(cancelada.estado).toBe(EstadoCompra.CANCELADA);
      expect(resumen(cancelada)).toEqual(esperados());
    });

    it("cancelar una confirmada", () => {
      const cancelada = compraConfirmada({ mensajes: conversacion() }).cancelar(
        "usuario-martin",
        despues(10 * MINUTO),
        LEJOS,
      );
      expect(cancelada.canceladaDesde).toBe(EstadoCompra.CONFIRMADA);
      expect(resumen(cancelada)).toEqual(esperados());
    });

    it("vencer", () => {
      const vencida = compraPendiente({ mensajes: conversacion() }).vencer();
      expect(vencida.fueVencida()).toBe(true);
      expect(resumen(vencida)).toEqual(esperados());
    });

    it("alDia de una vencida", () => {
      const alDia = compraPendiente({ mensajes: conversacion() }).alDia(despues(PLAZO));
      expect(alDia.estado).toBe(EstadoCompra.CANCELADA);
      expect(resumen(alDia)).toEqual(esperados());
    });

    it("registrarUso", () => {
      const usada = compraConfirmada({ mensajes: conversacion() }).registrarUso(
        "7K3MQ9TB",
        "usuario-lucia",
        despues(10 * MINUTO),
      );
      expect(usada.estado).toBe(EstadoCompra.UTILIZADA);
      expect(resumen(usada)).toEqual(esperados());
    });

    it("confirmarReembolso", () => {
      const reembolsada = compraCanceladaDesdeConfirmada({ mensajes: conversacion() }).confirmarReembolso(
        "usuario-lucia",
        despues(20 * MINUTO),
      );
      expect(reembolsada.estado).toBe(EstadoCompra.REEMBOLSADA);
      expect(resumen(reembolsada)).toEqual(esperados());
    });
  });

  describe("mensajeSinResponder (docs/mejoras-organizador.md, grupo 4)", () => {
    it("false sin mensajes", () => {
      expect(compraConfirmada().mensajeSinResponder).toBe(false);
    });
    it("true si el último mensaje es del comprador", () => {
      const compra = compraConfirmada({ mensajes: [...conversacion(), mensaje("usuario-martin", "¿Y?", 3)] });
      expect(compra.mensajeSinResponder).toBe(true);
    });
    it("false si el último es del organizador (se apaga al contestar)", () => {
      expect(compraConfirmada({ mensajes: conversacion() }).mensajeSinResponder).toBe(false);
      const respondida = compraConfirmada()
        .enviarMensaje("usuario-martin", "Hola", AHORA)
        .enviarMensaje("usuario-lucia", "¡Hola!", AHORA);
      expect(respondida.mensajeSinResponder).toBe(false);
    });
  });

  describe("rolDe", () => {
    const compra = compraConfirmada();
    it("comprador con el compradorId", () => {
      expect(compra.rolDe("usuario-martin", "usuario-lucia")).toBe("comprador");
    });
    it("organizador con el organizadorId recibido", () => {
      expect(compra.rolDe("usuario-lucia", "usuario-lucia")).toBe("organizador");
    });
    it("null con otro usuario (no lanza)", () => {
      expect(compra.rolDe("usuario-sofia", "usuario-lucia")).toBeNull();
    });
  });
});
