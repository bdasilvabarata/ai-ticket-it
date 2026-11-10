import { EstadoCompra } from "@ai-ticket-it/shared";
import { describe, expect, it } from "vitest";
import { Compra, type PropiedadesCompra } from "../../src/domain/compra";
import { DatosInvalidosError } from "../../src/domain/errores";

const datos: PropiedadesCompra = {
  id: "compra-1",
  compradorId: "usuario-martin",
  eventoId: "evento-festival",
  tipoEntradaId: "tipo-festival-vip",
  cantidad: 2,
  total: 240000,
  estado: EstadoCompra.CONFIRMADA,
};

function camposInvalidos(cambios: Partial<Record<keyof PropiedadesCompra, unknown>>): string[] {
  try {
    new Compra({ ...datos, ...cambios } as PropiedadesCompra);
  } catch (error) {
    expect(error).toBeInstanceOf(DatosInvalidosError);
    return (error as DatosInvalidosError).detalles.map((detalle) => detalle.campo);
  }
  throw new Error("Debía lanzar DatosInvalidosError.");
}

describe("Compra (mínima)", () => {
  it("se crea con datos válidos", () => {
    const compra = new Compra(datos);
    expect(compra).toMatchObject(datos);
  });

  it("acepta total 0 (entradas gratis) y todos los estados", () => {
    for (const estado of Object.values(EstadoCompra)) {
      expect(() => new Compra({ ...datos, total: 0, estado })).not.toThrow();
    }
  });

  it("rechaza cantidad que no es entero ≥ 1", () => {
    for (const cantidad of [0, -1, 1.5]) expect(camposInvalidos({ cantidad })).toEqual(["cantidad"]);
  });

  it("rechaza total que no es entero ≥ 0", () => {
    for (const total of [-1, 10.5]) expect(camposInvalidos({ total })).toEqual(["total"]);
  });

  it("rechaza un estado que no es uno de los cinco", () => {
    expect(camposInvalidos({ estado: "ABIERTA" })).toEqual(["estado"]);
  });
});
