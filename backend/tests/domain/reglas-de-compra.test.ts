import { EstadoCompra } from "@ai-ticket-it/shared";
import { describe, expect, it } from "vitest";
import type { AutorDelCambio, CambioEstadoCompra, PropiedadesCompra } from "../../src/domain/compra";
import { Compra } from "../../src/domain/compra";
import { Entrada } from "../../src/domain/entrada";
import { DatosInvalidosError } from "../../src/domain/errores";
import { Mensaje } from "../../src/domain/mensaje";
import { pasoPorConfirmada, REGLAS_DE_COMPRA, type ReglaDeCompra } from "../../src/domain/reglas-de-compra";

const T0 = new Date("2026-11-10T15:00:00.000Z");
const MINUTO = 60 * 1000;
const despues = (minutos: number) => new Date(T0.getTime() + minutos * MINUTO);

const porMartin = { tipo: "usuario", usuarioId: "usuario-martin" } as const;
const porLucia = { tipo: "usuario", usuarioId: "usuario-lucia" } as const;
const cambio = (
  estado: EstadoCompra,
  minutos: number,
  autor: AutorDelCambio = porMartin,
): CambioEstadoCompra => ({
  estado,
  autor,
  fechaHora: despues(minutos),
});

const pendiente = cambio(EstadoCompra.PENDIENTE, 0);
const confirmada = cambio(EstadoCompra.CONFIRMADA, 5);
const utilizada = cambio(EstadoCompra.UTILIZADA, 60, porLucia);
const canceladaPorMartin = cambio(EstadoCompra.CANCELADA, 10);
const canceladaSinConfirmar = cambio(EstadoCompra.CANCELADA, 1);
const vencida: CambioEstadoCompra = {
  estado: EstadoCompra.CANCELADA,
  autor: { tipo: "sistema" },
  fechaHora: despues(15),
};
const reembolsada = cambio(EstadoCompra.REEMBOLSADA, 20, porLucia);

const HIST_PENDIENTE = [pendiente];
const HIST_CONFIRMADA = [pendiente, confirmada];
const HIST_UTILIZADA = [pendiente, confirmada, utilizada];
const HIST_CANCELADA_TRAS_CONFIRMAR = [pendiente, confirmada, canceladaPorMartin];
const HIST_REEMBOLSADA = [pendiente, confirmada, canceladaPorMartin, reembolsada];
const HIST_CANCELADA_SIN_CONFIRMAR = [pendiente, canceladaSinConfirmar];
const HIST_VENCIDA = [pendiente, vencida];

const A = "7K3MQ9TB";
const B = "7K3MQ9TC";
const registro = (usuarioId: string, minutos: number) => ({ usuarioId, fechaHora: despues(minutos) });
const sinNada = (codigo: string) => new Entrada({ codigo });
const usada = (codigo: string) => new Entrada({ codigo, uso: registro("usuario-lucia", 60) });
const cancelada = (codigo: string) => new Entrada({ codigo, cancelacion: registro("usuario-martin", 10) });
const usadaYCancelada = (codigo: string) =>
  new Entrada({ codigo, uso: registro("usuario-lucia", 60), cancelacion: registro("usuario-martin", 10) });

/** Propiedades de una compra PENDIENTE de 2 entradas pagas, con los cambios (sin construir la `Compra`). */
const props = (cambios: Partial<PropiedadesCompra> = {}): PropiedadesCompra => ({
  id: "compra-1",
  compradorId: "usuario-martin",
  eventoId: "evento-festival",
  tipoEntradaId: "tipo-festival-vip",
  cantidad: 2,
  total: 240000,
  historial: HIST_PENDIENTE,
  entradas: [sinNada(A), sinNada(B)],
  ...cambios,
});

function reglaLlamada(nombre: string): ReglaDeCompra {
  const encontrada = REGLAS_DE_COMPRA.find((candidata) => candidata.nombre === nombre);
  if (!encontrada) throw new Error(`No existe la regla ${nombre}.`);
  return encontrada;
}

describe("REGLAS_DE_COMPRA (feature 010, R2)", () => {
  it("son doce, con nombres distintos y en el orden de data-model", () => {
    expect(REGLAS_DE_COMPRA.map((regla) => [regla.nombre, regla.campo])).toEqual([
      ["cantidad-valida", "cantidad"],
      ["total-valido", "total"],
      ["historial-valido", "historial"],
      ["reembolso-valido", "historial"],
      ["una-entrada-por-unidad", "entradas"],
      ["codigos-con-formato", "entradas"],
      ["codigos-distintos", "entradas"],
      ["sin-cambios-antes-de-confirmar", "entradas"],
      ["usada-o-cancelada", "entradas"],
      ["utilizada-si-alguna-usada", "entradas"],
      ["canceladas-con-la-compra", "entradas"],
      ["mensajes-en-orden", "mensajes"],
    ]);
    expect(new Set(REGLAS_DE_COMPRA.map((regla) => regla.nombre)).size).toBe(12);
  });

  describe("cantidad-valida", () => {
    const regla = reglaLlamada("cantidad-valida");
    it("se cumple con un entero ≥ 1", () => {
      expect(regla.cumple(props({ cantidad: 1 }))).toBe(true);
    });
    it("se viola con 0 o 1.5", () => {
      expect(regla.cumple(props({ cantidad: 0 }))).toBe(false);
      expect(regla.cumple(props({ cantidad: 1.5 }))).toBe(false);
    });
  });

  describe("total-valido", () => {
    const regla = reglaLlamada("total-valido");
    it("se cumple con 0", () => {
      expect(regla.cumple(props({ total: 0 }))).toBe(true);
    });
    it("se viola con −1 o 1.5", () => {
      expect(regla.cumple(props({ total: -1 }))).toBe(false);
      expect(regla.cumple(props({ total: 1.5 }))).toBe(false);
    });
  });

  describe("historial-valido", () => {
    const regla = reglaLlamada("historial-valido");
    it("se cumple con [PENDIENTE]", () => {
      expect(regla.cumple(props({ historial: HIST_PENDIENTE }))).toBe(true);
    });
    it("se viola vacío, sin empezar en PENDIENTE, con un estado desconocido, una fecha inválida o fechas decrecientes", () => {
      const casos: CambioEstadoCompra[][] = [
        [],
        [confirmada],
        [pendiente, { ...confirmada, estado: "ABIERTA" as EstadoCompra }],
        [{ ...pendiente, fechaHora: new Date("no") }],
        [pendiente, { ...confirmada, fechaHora: despues(-1) }],
      ];
      for (const historial of casos) expect(regla.cumple(props({ historial }))).toBe(false);
    });
  });

  describe("reembolso-valido", () => {
    const regla = reglaLlamada("reembolso-valido");
    it("se cumple en una paga cancelada tras confirmar y reembolsada", () => {
      expect(regla.cumple(props({ historial: HIST_REEMBOLSADA }))).toBe(true);
    });
    it("se viola si REEMBOLSADA no es el último, no sigue a CANCELADA, no pasó por CONFIRMADA o el total es 0", () => {
      const otraCancelacion = cambio(EstadoCompra.CANCELADA, 30);
      expect(regla.cumple(props({ historial: [...HIST_REEMBOLSADA, otraCancelacion] }))).toBe(false);
      expect(regla.cumple(props({ historial: [pendiente, confirmada, reembolsada] }))).toBe(false);
      expect(regla.cumple(props({ historial: [pendiente, canceladaSinConfirmar, reembolsada] }))).toBe(false);
      expect(regla.cumple(props({ historial: HIST_REEMBOLSADA, total: 0 }))).toBe(false);
    });
  });

  describe("una-entrada-por-unidad", () => {
    const regla = reglaLlamada("una-entrada-por-unidad");
    it("se cumple con 2 entradas y cantidad 2", () => {
      expect(regla.cumple(props())).toBe(true);
    });
    it("se viola con 1 entrada y cantidad 2", () => {
      expect(regla.cumple(props({ entradas: [sinNada(A)] }))).toBe(false);
    });
    it("con una cantidad inválida (0 o 1.5) se cumple: esa la informa cantidad-valida", () => {
      expect(regla.cumple(props({ cantidad: 0 }))).toBe(true);
      expect(regla.cumple(props({ cantidad: 1.5 }))).toBe(true);
    });
  });

  describe("codigos-con-formato", () => {
    const regla = reglaLlamada("codigos-con-formato");
    it("se cumple con códigos válidos", () => {
      expect(regla.cumple(props())).toBe(true);
    });
    it("se viola con un código de 7 caracteres o con una letra fuera del alfabeto", () => {
      expect(regla.cumple(props({ entradas: [sinNada(A), sinNada("7K3MQ9T")] }))).toBe(false);
      expect(regla.cumple(props({ entradas: [sinNada(A), sinNada("7K3MQ9TI")] }))).toBe(false);
    });
  });

  describe("codigos-distintos", () => {
    const regla = reglaLlamada("codigos-distintos");
    it("se cumple con códigos distintos", () => {
      expect(regla.cumple(props())).toBe(true);
    });
    it("se viola con un código repetido", () => {
      expect(regla.cumple(props({ entradas: [sinNada(A), sinNada(A)] }))).toBe(false);
    });
  });

  describe("sin-cambios-antes-de-confirmar", () => {
    const regla = reglaLlamada("sin-cambios-antes-de-confirmar");
    it("se cumple en una pendiente sin nada y en una cancelada tras confirmar con canceladas", () => {
      expect(regla.cumple(props())).toBe(true);
      expect(
        regla.cumple(
          props({ historial: HIST_CANCELADA_TRAS_CONFIRMAR, entradas: [cancelada(A), cancelada(B)] }),
        ),
      ).toBe(true);
    });
    it("se viola en una pendiente con una usada o una cancelada y en una vencida con una cancelada", () => {
      expect(regla.cumple(props({ entradas: [usada(A), sinNada(B)] }))).toBe(false);
      expect(regla.cumple(props({ entradas: [cancelada(A), sinNada(B)] }))).toBe(false);
      expect(regla.cumple(props({ historial: HIST_VENCIDA, entradas: [cancelada(A), sinNada(B)] }))).toBe(
        false,
      );
    });
  });

  describe("usada-o-cancelada", () => {
    const regla = reglaLlamada("usada-o-cancelada");
    it("se cumple con una usada y otra cancelada en entradas distintas", () => {
      expect(regla.cumple(props({ entradas: [usada(A), cancelada(B)] }))).toBe(true);
    });
    it("se viola con una entrada usada y cancelada a la vez", () => {
      expect(regla.cumple(props({ entradas: [usadaYCancelada(A), sinNada(B)] }))).toBe(false);
    });
  });

  describe("utilizada-si-alguna-usada", () => {
    const regla = reglaLlamada("utilizada-si-alguna-usada");
    it("se cumple en una UTILIZADA con una usada y en una CONFIRMADA sin usadas", () => {
      expect(regla.cumple(props({ historial: HIST_UTILIZADA, entradas: [usada(A), sinNada(B)] }))).toBe(true);
      expect(regla.cumple(props({ historial: HIST_CONFIRMADA }))).toBe(true);
    });
    it("se viola en una UTILIZADA sin usadas y en una CONFIRMADA con una usada", () => {
      expect(regla.cumple(props({ historial: HIST_UTILIZADA }))).toBe(false);
      expect(regla.cumple(props({ historial: HIST_CONFIRMADA, entradas: [usada(A), sinNada(B)] }))).toBe(
        false,
      );
    });
  });

  describe("canceladas-con-la-compra", () => {
    const regla = reglaLlamada("canceladas-con-la-compra");
    const todasCanceladas = [cancelada(A), cancelada(B)];
    it("se cumple en una cancelada tras confirmar o REEMBOLSADA con todas canceladas y en una CONFIRMADA sin canceladas", () => {
      expect(
        regla.cumple(props({ historial: HIST_CANCELADA_TRAS_CONFIRMAR, entradas: todasCanceladas })),
      ).toBe(true);
      expect(regla.cumple(props({ historial: HIST_REEMBOLSADA, entradas: todasCanceladas }))).toBe(true);
      expect(regla.cumple(props({ historial: HIST_CONFIRMADA }))).toBe(true);
    });
    it("se viola en una cancelada tras confirmar con una sin cancelar y con una cancelada en una CONFIRMADA o UTILIZADA", () => {
      expect(
        regla.cumple(
          props({ historial: HIST_CANCELADA_TRAS_CONFIRMAR, entradas: [cancelada(A), sinNada(B)] }),
        ),
      ).toBe(false);
      expect(regla.cumple(props({ historial: HIST_CONFIRMADA, entradas: [cancelada(A), sinNada(B)] }))).toBe(
        false,
      );
      expect(regla.cumple(props({ historial: HIST_UTILIZADA, entradas: [usada(A), cancelada(B)] }))).toBe(
        false,
      );
    });
    it("en una cancelada sin confirmar, ninguna cancelada (esa la cubre también sin-cambios-antes-de-confirmar)", () => {
      expect(regla.cumple(props({ historial: HIST_CANCELADA_SIN_CONFIRMAR }))).toBe(true);
    });
  });

  describe("mensajes-en-orden (feature 011)", () => {
    const regla = reglaLlamada("mensajes-en-orden");
    const mensaje = (minutos: number) =>
      new Mensaje({ autorId: "usuario-martin", texto: "Hola", enviadoEn: despues(minutos) });

    it("se cumple sin mensajes (con y sin la propiedad)", () => {
      expect(regla.cumple(props())).toBe(true);
      expect(regla.cumple(props({ mensajes: [] }))).toBe(true);
    });
    it("se cumple con fechas crecientes y con fechas iguales", () => {
      expect(regla.cumple(props({ mensajes: [mensaje(1), mensaje(2), mensaje(30)] }))).toBe(true);
      expect(regla.cumple(props({ mensajes: [mensaje(3), mensaje(3)] }))).toBe(true);
    });
    it("se cumple con un mensaje a la misma hora que el alta", () => {
      expect(regla.cumple(props({ mensajes: [mensaje(0)] }))).toBe(true);
    });
    it("se viola con fechas que decrecen", () => {
      expect(regla.cumple(props({ mensajes: [mensaje(2), mensaje(1)] }))).toBe(false);
    });
    it("se viola con un mensaje anterior al alta", () => {
      expect(regla.cumple(props({ mensajes: [mensaje(-1)] }))).toBe(false);
    });
    it("con un historial vacío no compara contra el alta (lo informa historial-valido)", () => {
      expect(regla.cumple(props({ historial: [], mensajes: [mensaje(-1), mensaje(5)] }))).toBe(true);
      expect(regla.cumple(props({ historial: [], mensajes: [mensaje(5), mensaje(1)] }))).toBe(false);
    });
    it("el constructor de Compra lo informa en mensajes junto con las otras reglas violadas", () => {
      try {
        new Compra(props({ total: -1, mensajes: [mensaje(2), mensaje(1)] }));
      } catch (error) {
        expect(error).toBeInstanceOf(DatosInvalidosError);
        expect((error as DatosInvalidosError).detalles).toEqual([
          { campo: "total", mensaje: "Debe ser un entero mayor o igual a 0." },
          {
            campo: "mensajes",
            mensaje: "Los mensajes van en orden de envío y no son anteriores al alta de la compra.",
          },
        ]);
        return;
      }
      throw new Error("Debía lanzar DatosInvalidosError.");
    });
  });
});

describe("pasoPorConfirmada", () => {
  it("true con un CONFIRMADA en cualquier posición", () => {
    expect(pasoPorConfirmada(HIST_CONFIRMADA)).toBe(true);
    expect(pasoPorConfirmada(HIST_REEMBOLSADA)).toBe(true);
    expect(pasoPorConfirmada([confirmada])).toBe(true);
  });
  it("false sin él", () => {
    expect(pasoPorConfirmada(HIST_PENDIENTE)).toBe(false);
    expect(pasoPorConfirmada(HIST_CANCELADA_SIN_CONFIRMAR)).toBe(false);
    expect(pasoPorConfirmada([])).toBe(false);
  });
});
