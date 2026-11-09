import { describe, expect, it } from "vitest";
import { Evento, TipoEntrada } from "../../src/domain/evento";
import { DatosInvalidosError } from "../../src/domain/errores";

const datosTipo = { id: "t1", nombre: "General", descripcion: "Campo", precio: 15000, cupo: 3 };

function tipo(cambios: Partial<typeof datosTipo> = {}): TipoEntrada {
  return new TipoEntrada({ ...datosTipo, ...cambios });
}

function evento(tiposEntrada: TipoEntrada[] = [tipo()], cambios: { nombre?: string; fechaHora?: Date } = {}) {
  return new Evento({
    id: "e1",
    nombre: cambios.nombre ?? "Noche de Rock",
    descripcion: "Tres bandas.",
    categoriaId: "c1",
    fechaHora: cambios.fechaHora ?? new Date("2026-12-01T00:00:00Z"),
    multimedia: [],
    organizadorId: "u1",
    tiposEntrada,
  });
}

/** Ejecuta `crear` y devuelve los campos de los detalles del DatosInvalidosError que lanza. */
function camposInvalidos(crear: () => unknown): string[] {
  try {
    crear();
  } catch (error) {
    expect(error).toBeInstanceOf(DatosInvalidosError);
    return ((error as DatosInvalidosError).detalles ?? []).map((detalle) => detalle.campo);
  }
  throw new Error("Debía lanzar DatosInvalidosError.");
}

describe("TipoEntrada", () => {
  it("se crea con datos válidos y recorta el nombre", () => {
    const general = tipo({ nombre: "  General  " });
    expect(general.nombre).toBe("General");
    expect(general.cupo).toBe(3);
  });

  it("acepta precio 0 (evento gratuito) y cupo 0 (agotado)", () => {
    expect(() => tipo({ precio: 0, cupo: 0 })).not.toThrow();
  });

  it("rechaza nombre vacío, precio y cupo negativos o con decimales, todos a la vez", () => {
    expect(camposInvalidos(() => tipo({ nombre: "  ", precio: 1.5, cupo: -1 }))).toEqual([
      "nombre",
      "precio",
      "cupo",
    ]);
  });

  describe("hayCupoPara", () => {
    it("es verdadero si la cantidad no supera el cupo disponible", () => {
      expect(tipo({ cupo: 3 }).hayCupoPara(3)).toBe(true);
      expect(tipo({ cupo: 3 }).hayCupoPara(1)).toBe(true);
    });

    it("es falso si la cantidad supera el cupo (sin dejarlo por debajo de 0)", () => {
      expect(tipo({ cupo: 3 }).hayCupoPara(4)).toBe(false);
      expect(tipo({ cupo: 0 }).hayCupoPara(1)).toBe(false);
    });

    it("es falso para cantidades que no son enteros positivos", () => {
      for (const cantidad of [0, -1, 1.5, Number.NaN]) {
        expect(tipo({ cupo: 10 }).hayCupoPara(cantidad)).toBe(false);
      }
    });
  });
});

describe("Evento", () => {
  it("se crea con sus tipos de entrada", () => {
    const rock = evento([tipo({ id: "t1" }), tipo({ id: "t2", nombre: "VIP" })]);
    expect(rock.tiposEntrada.map((t) => t.nombre)).toEqual(["General", "VIP"]);
  });

  it("rechaza nombre vacío, fecha inválida y que no tenga tipos de entrada", () => {
    expect(camposInvalidos(() => evento([], { nombre: " ", fechaHora: new Date("no-es-fecha") }))).toEqual([
      "nombre",
      "fechaHora",
      "tiposEntrada",
    ]);
  });

  describe("tuPrecioEstaEntre", () => {
    const festival = evento([
      tipo({ id: "t1", nombre: "General", precio: 45000 }),
      tipo({ id: "t2", nombre: "VIP", precio: 120000 }),
    ]);

    it("es verdadero si algún tipo de entrada tiene un precio dentro del rango (inclusive)", () => {
      expect(festival.tuPrecioEstaEntre(40000, 50000)).toBe(true);
      expect(festival.tuPrecioEstaEntre(120000, 200000)).toBe(true);
      expect(festival.tuPrecioEstaEntre(45000, 45000)).toBe(true);
    });

    it("es falso si ningún precio cae en el rango", () => {
      expect(festival.tuPrecioEstaEntre(50000, 100000)).toBe(false);
      expect(festival.tuPrecioEstaEntre(0, 10000)).toBe(false);
    });
  });
});
