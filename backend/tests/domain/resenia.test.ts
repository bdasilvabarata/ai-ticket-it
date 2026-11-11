import { describe, expect, it } from "vitest";
import { DatosInvalidosError } from "../../src/domain/errores";
import {
  calcularPuntaje,
  puntajesPorOrganizador,
  Resenia,
  type PropiedadesResenia,
} from "../../src/domain/resenia";
import { DIA, evento } from "../helpers/eventos";

const datos: PropiedadesResenia = {
  id: "resenia-1",
  compradorId: "usuario-martin",
  eventoId: "evento-a",
  puntuacion: 4,
};

function resenia(id: string, eventoId: string, puntuacion: number): Resenia {
  return new Resenia({ id, compradorId: "usuario-diego", eventoId, puntuacion });
}

describe("Resenia (mínima)", () => {
  it("se crea con una puntuación de 1 a 5", () => {
    expect(new Resenia({ ...datos, puntuacion: 1 })).toMatchObject({ ...datos, puntuacion: 1 });
    expect(new Resenia({ ...datos, puntuacion: 5 })).toMatchObject({ ...datos, puntuacion: 5 });
  });

  it.each([0, 6, 4.5])("rechaza la puntuación %s con detalle en puntuacion", (puntuacion) => {
    try {
      new Resenia({ ...datos, puntuacion });
    } catch (error) {
      expect(error).toBeInstanceOf(DatosInvalidosError);
      expect((error as DatosInvalidosError).detalles).toEqual([
        { campo: "puntuacion", mensaje: "Debe ser un entero de 1 a 5." },
      ]);
      return;
    }
    throw new Error("Debía lanzar DatosInvalidosError.");
  });
});

describe("calcularPuntaje", () => {
  it("sin puntuaciones no hay puntaje (null, nunca 0)", () => {
    expect(calcularPuntaje([])).toEqual({ promedio: null, cantidad: 0 });
  });

  it("promedia sin redondear", () => {
    const puntaje = calcularPuntaje([5, 4, 4]);
    expect(puntaje.promedio).toBeCloseTo(13 / 3, 10);
    expect(puntaje.cantidad).toBe(3);
  });
});

describe("puntajesPorOrganizador", () => {
  const deLucia = evento({ id: "evento-lucia-1", organizadorId: "usuario-lucia" });
  const deLuciaRealizado = evento({ id: "evento-lucia-2", organizadorId: "usuario-lucia", en: -3 * DIA });
  const deSofia = evento({ id: "evento-sofia", organizadorId: "usuario-sofia" });

  it("agrupa por el organizador del evento reseñado, incluido un evento realizado", () => {
    const puntajes = puntajesPorOrganizador(
      [deLucia, deLuciaRealizado, deSofia],
      [
        resenia("r1", "evento-lucia-1", 5),
        resenia("r2", "evento-lucia-2", 4),
        resenia("r3", "evento-sofia", 2),
      ],
    );
    expect(puntajes.get("usuario-lucia")).toEqual({ promedio: 4.5, cantidad: 2 });
    expect(puntajes.get("usuario-sofia")).toEqual({ promedio: 2, cantidad: 1 });
  });

  it("ignora las reseñas de eventos que no están en la lista", () => {
    const puntajes = puntajesPorOrganizador(
      [deLucia],
      [resenia("r1", "evento-lucia-1", 5), resenia("r2", "otro", 1)],
    );
    expect(puntajes.get("usuario-lucia")).toEqual({ promedio: 5, cantidad: 1 });
    expect(puntajes.size).toBe(1);
  });

  it("un organizador sin reseñas no aparece", () => {
    const puntajes = puntajesPorOrganizador([deLucia, deSofia], [resenia("r1", "evento-lucia-1", 3)]);
    expect(puntajes.has("usuario-sofia")).toBe(false);
  });
});
