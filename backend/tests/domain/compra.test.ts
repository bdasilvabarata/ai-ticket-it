import { EstadoCompra, LIMITES_COMPRA } from "@ai-ticket-it/shared";
import { describe, expect, it } from "vitest";
import {
  Compra,
  cupoLiberadoPorTipo,
  Entrada,
  type CambioEstadoCompra,
  type PropiedadesCompra,
} from "../../src/domain/compra";
import { DatosInvalidosError, ReglaDeNegocioError } from "../../src/domain/errores";
import { TipoEntrada } from "../../src/domain/evento";
import { entradasDePrueba } from "../helpers/eventos";

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

describe("Entrada dentro de la Compra (feature 008, R1)", () => {
  const codigos = datos.entradas.map((entrada) => entrada.codigo);
  const usada: CambioEstadoCompra = {
    estado: EstadoCompra.UTILIZADA,
    autor: { tipo: "usuario", usuarioId: "usuario-lucia" },
    fechaHora: despues(60 * MINUTO),
  };

  it("Compra.registrar crea una entrada por código, sin cambios propios y PENDIENTE", () => {
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
      expect(entrada.cambios).toEqual([]);
      expect(entrada.usadaEn).toBeNull();
      expect(entrada.estadoEn(compra)).toBe(EstadoCompra.PENDIENTE);
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

    it("una entrada con cambios propios en una compra que no llegó a CONFIRMADA", () => {
      const entradas = [
        new Entrada({ codigo: "7K3MQ9TB", cambios: [usada] }),
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
      const cancelada = compraPendiente().cancelar("usuario-martin", despues(MINUTO));
      expect(estados(cancelada)).toEqual([EstadoCompra.CANCELADA, EstadoCompra.CANCELADA]);
      expect(estados(compraPendiente().vencer())).toEqual([EstadoCompra.CANCELADA, EstadoCompra.CANCELADA]);
    });

    it("una PENDIENTE vencida, al día, las da CANCELADA", () => {
      expect(estados(compraPendiente().alDia(despues(PLAZO)))).toEqual([
        EstadoCompra.CANCELADA,
        EstadoCompra.CANCELADA,
      ]);
    });

    it("con la compra utilizada, una entrada con su cambio propio tiene ese estado y usadaEn", () => {
      const compra = compraConfirmada({
        historial: [pendiente, confirmada, usada],
        entradas: [
          new Entrada({ codigo: "7K3MQ9TB", cambios: [usada] }),
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
    expect(codigosDe(compraPendiente().cancelar("usuario-martin", despues(MINUTO)))).toEqual(codigos);
    expect(codigosDe(compraPendiente().vencer())).toEqual(codigos);
    expect(codigosDe(compraPendiente().alDia(despues(PLAZO)))).toEqual(codigos);
  });
});

describe("Compra.registrarUso (feature 008, R9)", () => {
  const [codigoA, codigoB] = datos.entradas.map((entrada) => entrada.codigo) as [string, string];
  const USO = despues(60 * MINUTO);
  const porLucia = { tipo: "usuario", usuarioId: "usuario-lucia" } as const;
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
    expect(entrada.cambios).toEqual([cambioDeUso(USO)]);
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
    [
      "REEMBOLSADA",
      () =>
        compraConfirmada({
          historial: [
            pendiente,
            confirmada,
            { estado: EstadoCompra.REEMBOLSADA, autor: porMartin, fechaHora: despues(10 * MINUTO) },
          ],
        }),
      "La compra de esta entrada fue reembolsada.",
    ],
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
            new Entrada({ codigo: codigoA, cambios: [cambioDeUso(USO)] }),
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
    expect(errorDe(() => usada.cancelar("usuario-martin", USO)).codigo).toBe("TRANSICION_INVALIDA");
    expect(usada.esVigente(despues(PLAZO * 10))).toBe(true);
  });

  it("las transiciones de una UTILIZADA conservan los cambios de sus entradas", () => {
    const usada = compraConfirmada().registrarUso(codigoA, "usuario-lucia", USO);
    expect(usada.alDia(despues(PLAZO * 10))).toBe(usada);
  });
});
