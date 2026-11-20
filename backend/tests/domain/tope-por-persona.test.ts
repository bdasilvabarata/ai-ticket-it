import { EstadoCompra } from "@ai-ticket-it/shared";
import { describe, expect, it } from "vitest";
import { Compra } from "../../src/domain/compra";
import { ReglaDeNegocioError } from "../../src/domain/errores";
import { TipoEntrada } from "../../src/domain/evento";
import { entradasRestantes, exigirTopePorPersona } from "../../src/domain/tope-por-persona";
import { entradasDePrueba } from "../helpers/eventos";

const AHORA = new Date("2026-11-10T15:00:00.000Z");
const autor = { tipo: "usuario", usuarioId: "usuario-martin" } as const;

const tipoDe = (id: string, nombre: string, precio: number) =>
  new TipoEntrada({ id, nombre, descripcion: "", precio, cupo: 50 });
const general = tipoDe("general", "General", 45000);
const kids = tipoDe("kids", "Carrera kids", 0);
const charla = tipoDe("charla", "Charla", 0);

let numero = 0;
/** Una compra vigente (confirmada o pendiente) de `cantidad` entradas de `tipoId` con ese `total`. */
function vigente(
  tipoId: string,
  cantidad: number,
  total: number,
  estado: EstadoCompra = EstadoCompra.CONFIRMADA,
): Compra {
  numero += 1;
  const alta = { estado: EstadoCompra.PENDIENTE, autor, fechaHora: AHORA };
  return new Compra({
    id: `compra-${numero}`,
    compradorId: "usuario-martin",
    eventoId: "evento",
    tipoEntradaId: tipoId,
    cantidad,
    total,
    historial: estado === EstadoCompra.PENDIENTE ? [alta] : [alta, { estado, autor, fechaHora: AHORA }],
    entradas: entradasDePrueba(cantidad),
  });
}

/** El mensaje del TOPE_POR_PERSONA que lanza `operacion`. */
function mensajeDeTope(operacion: () => unknown): string {
  try {
    operacion();
  } catch (error) {
    expect(error).toBeInstanceOf(ReglaDeNegocioError);
    expect((error as ReglaDeNegocioError).codigo).toBe("TOPE_POR_PERSONA");
    return (error as ReglaDeNegocioError).message;
  }
  throw new Error("Debía lanzar TOPE_POR_PERSONA.");
}

describe("Tope por persona (R6)", () => {
  describe("tipos pagos: 4 por evento, sumando todos los tipos pagos", () => {
    it("sin compras → 4", () => {
      expect(entradasRestantes(general, [])).toBe(4);
    });

    it("una confirmada de 2 y una pendiente de 1 → 1; pedir 2 se rechaza", () => {
      const compras = [vigente("vip", 2, 240000), vigente("general", 1, 45000, EstadoCompra.PENDIENTE)];
      expect(entradasRestantes(general, compras)).toBe(1);
      expect(() => exigirTopePorPersona(general, 1, compras)).not.toThrow();
      expect(mensajeDeTope(() => exigirTopePorPersona(general, 2, compras))).toBe(
        "Podés comprar 1 entrada más de tipos pagos de este evento.",
      );
    });

    it("con N > 1 restantes, el mensaje va en plural", () => {
      expect(mensajeDeTope(() => exigirTopePorPersona(general, 3, [vigente("vip", 2, 240000)]))).toBe(
        "Podés comprar 2 entradas más de tipos pagos de este evento.",
      );
    });

    it("con 4 → 0 y el mensaje del máximo", () => {
      const compras = [vigente("vip", 4, 480000)];
      expect(entradasRestantes(general, compras)).toBe(0);
      expect(mensajeDeTope(() => exigirTopePorPersona(general, 1, compras))).toBe(
        "Ya tenés el máximo de 4 entradas de tipos pagos de este evento.",
      );
    });

    it("las compras gratis no cuentan para el tope de 4", () => {
      expect(entradasRestantes(general, [vigente("kids", 1, 0)])).toBe(4);
    });
  });

  describe("tipos gratis: 1 por tipo, aparte de las 4", () => {
    it("sin compras de ese tipo → 1 (las 4 pagas no cuentan)", () => {
      expect(entradasRestantes(kids, [vigente("vip", 4, 480000)])).toBe(1);
    });

    it("con una vigente gratis de ese tipo → 0 y el mensaje de la entrada gratis", () => {
      const compras = [vigente("kids", 1, 0, EstadoCompra.PENDIENTE)];
      expect(entradasRestantes(kids, compras)).toBe(0);
      expect(mensajeDeTope(() => exigirTopePorPersona(kids, 1, compras))).toBe(
        "Ya tenés tu entrada gratis de «Carrera kids».",
      );
    });

    it("pedir 2 de un gratis → 1 sola entrada", () => {
      expect(mensajeDeTope(() => exigirTopePorPersona(kids, 2, []))).toBe(
        "Podés tener 1 sola entrada de «Carrera kids».",
      );
    });

    it("una gratis de otro tipo no cuenta", () => {
      expect(entradasRestantes(kids, [vigente("charla", 1, 0)])).toBe(1);
      expect(entradasRestantes(charla, [vigente("kids", 1, 0)])).toBe(1);
    });
  });

  describe("precio cambiado: cuenta el total de cada compra y el precio vigente del tipo pedido", () => {
    it("una compra con total > 0 de un tipo que ahora es gratis cuenta como paga", () => {
      const compras = [vigente("vip", 3, 360000)];
      expect(entradasRestantes(general, compras)).toBe(1);
      // VIP ahora es gratis: el pedido se evalúa como gratis y la compra paga no cuenta para él.
      expect(entradasRestantes(tipoDe("vip", "VIP", 0), compras)).toBe(1);
    });

    it("una compra gratis de un tipo que ahora es pago no cuenta para las 4", () => {
      const compras = [vigente("kids", 1, 0)];
      expect(entradasRestantes(tipoDe("kids", "Carrera kids", 5000), compras)).toBe(4);
    });
  });

  it("nunca menos de 0", () => {
    expect(entradasRestantes(general, [vigente("vip", 4, 480000), vigente("general", 2, 90000)])).toBe(0);
    expect(entradasRestantes(kids, [vigente("kids", 1, 0), vigente("kids", 1, 0)])).toBe(0);
  });
});

describe("Tope por persona con compras UTILIZADA (feature 008, R9)", () => {
  it("una compra UTILIZADA es vigente y cuenta para el tope", () => {
    const confirmada = vigente("vip", 3, 360000);
    const usada = confirmada.registrarUso(confirmada.entradas[0]!.codigo, "usuario-lucia", AHORA);
    const vigentes = [usada].filter((compra) => compra.esVigente(AHORA));
    expect(vigentes).toHaveLength(1);
    expect(entradasRestantes(general, vigentes)).toBe(1);
  });
});

describe("Tope por persona al cancelar una confirmada (feature 009, FR-004)", () => {
  const INICIO = new Date(AHORA.getTime() + 24 * 60 * 60 * 1000);
  const vigentesDe = (compras: readonly Compra[]) => compras.filter((compra) => compra.esVigente(AHORA));

  it("con el tope de pagos lleno, cancelar una confirmada devuelve las restantes", () => {
    const vip = vigente("vip", 3, 360000);
    const otra = vigente("general", 1, 45000);
    expect(entradasRestantes(general, vigentesDe([vip, otra]))).toBe(0);
    const cancelada = vip.cancelar("usuario-martin", AHORA, INICIO);
    expect(entradasRestantes(general, vigentesDe([cancelada, otra]))).toBe(3);
  });

  it("con la gratis de un tipo confirmada, cancelarla devuelve el tope a 1", () => {
    const gratis = vigente("kids", 1, 0);
    expect(entradasRestantes(kids, vigentesDe([gratis]))).toBe(0);
    expect(entradasRestantes(kids, vigentesDe([gratis.cancelar("usuario-martin", AHORA, INICIO)]))).toBe(1);
  });
});
