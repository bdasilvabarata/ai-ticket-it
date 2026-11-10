import { describe, expect, it } from "vitest";
import { Evento, mismoNombreDeTipo, TipoEntrada } from "../../src/domain/evento";
import { DatosInvalidosError, ReglaDeNegocioError } from "../../src/domain/errores";

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

/** Ejecuta `operacion` y devuelve el código del ReglaDeNegocioError que lanza. */
function codigoDeRegla(operacion: () => unknown): string {
  try {
    operacion();
  } catch (error) {
    expect(error).toBeInstanceOf(ReglaDeNegocioError);
    return (error as ReglaDeNegocioError).codigo;
  }
  throw new Error("Debía lanzar ReglaDeNegocioError.");
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

describe("mismoNombreDeTipo", () => {
  it("no distingue mayúsculas, tildes ni espacios de los extremos", () => {
    expect(mismoNombreDeTipo("VIP", " vip ")).toBe(true);
    expect(mismoNombreDeTipo("VIP", "Víp")).toBe(true);
    expect(mismoNombreDeTipo("Platea", "Plátea")).toBe(true);
  });

  it("distingue la ñ de la n y nombres distintos", () => {
    expect(mismoNombreDeTipo("Año", "Ano")).toBe(false);
    expect(mismoNombreDeTipo("General", "VIP")).toBe(false);
  });
});

describe("Evento: invariantes y consultas de la feature 004", () => {
  it("rechaza dos tipos con el mismo nombre (sin mayúsculas ni tildes)", () => {
    expect(
      codigoDeRegla(() => evento([tipo({ id: "t1", nombre: "VIP" }), tipo({ id: "t2", nombre: " vip " })])),
    ).toBe("NOMBRE_TIPO_ENTRADA_REPETIDO");
    expect(
      codigoDeRegla(() =>
        evento([tipo({ id: "t1", nombre: "Platea" }), tipo({ id: "t2", nombre: "Plátea" })]),
      ),
    ).toBe("NOMBRE_TIPO_ENTRADA_REPETIDO");
  });

  it("estaRealizado: falso 1 ms antes de la fecha y verdadero en el instante exacto", () => {
    const fechaHora = new Date("2026-12-01T23:00:00.000Z");
    const rock = evento([tipo()], { fechaHora });
    expect(rock.estaRealizado(new Date(fechaHora.getTime() - 1))).toBe(false);
    expect(rock.estaRealizado(new Date(fechaHora))).toBe(true);
    expect(rock.estaRealizado(new Date(fechaHora.getTime() + 1))).toBe(true);
  });

  it("esOrganizadoPor", () => {
    expect(evento().esOrganizadoPor("u1")).toBe(true);
    expect(evento().esOrganizadoPor("u2")).toBe(false);
  });

  it("buscarTipoEntrada devuelve el tipo o null", () => {
    const vip = tipo({ id: "t2", nombre: "VIP" });
    const rock = evento([tipo(), vip]);
    expect(rock.buscarTipoEntrada("t2")).toBe(vip);
    expect(rock.buscarTipoEntrada("t9")).toBeNull();
  });

  it("TipoEntrada.con devuelve un tipo nuevo con el mismo id y deja intacto el original", () => {
    const original = tipo();
    const editado = original.con({ nombre: " Campo ", descripcion: "Nuevo", precio: 0, cupo: 0 });
    expect(editado).not.toBe(original);
    expect(editado).toMatchObject({ id: "t1", nombre: "Campo", descripcion: "Nuevo", precio: 0, cupo: 0 });
    expect(original).toMatchObject({
      id: "t1",
      nombre: "General",
      descripcion: "Campo",
      precio: 15000,
      cupo: 3,
    });
  });

  it("el dominio no limita longitudes ni multimedia (son de forma: los valida zod)", () => {
    expect(
      () =>
        new Evento({
          id: "e1",
          nombre: "x".repeat(101),
          descripcion: "y".repeat(2001),
          categoriaId: "c1",
          fechaHora: new Date("2026-12-01T00:00:00Z"),
          multimedia: Array.from({ length: 6 }, (_, i) => `https://example.com/${i}.jpg`),
          organizadorId: "u1",
          tiposEntrada: [tipo({ nombre: "z".repeat(51) })],
        }),
    ).not.toThrow();
  });
});

describe("Evento.crear", () => {
  const ahora = new Date("2026-11-10T15:00:00.000Z");
  const propiedades = (cambios: { fechaHora?: Date; tiposEntrada?: TipoEntrada[] } = {}) => ({
    id: "e1",
    nombre: "Noche de Tango",
    descripcion: "",
    categoriaId: "c1",
    fechaHora: cambios.fechaHora ?? new Date(ahora.getTime() + 1),
    multimedia: [],
    organizadorId: "u1",
    tiposEntrada: cambios.tiposEntrada ?? [tipo()],
  });

  it("rechaza una fecha igual a ahora con FECHA_NO_FUTURA", () => {
    expect(codigoDeRegla(() => Evento.crear(propiedades({ fechaHora: new Date(ahora) }), ahora))).toBe(
      "FECHA_NO_FUTURA",
    );
  });

  it("rechaza una fecha pasada, aunque además tenga nombres repetidos (la fecha va primero)", () => {
    const repetidos = [tipo({ id: "t1", nombre: "VIP" }), tipo({ id: "t2", nombre: " vip " })];
    expect(
      codigoDeRegla(() =>
        Evento.crear(
          propiedades({ fechaHora: new Date(ahora.getTime() - 1), tiposEntrada: repetidos }),
          ahora,
        ),
      ),
    ).toBe("FECHA_NO_FUTURA");
  });

  it("acepta ahora + 1 ms y devuelve el evento", () => {
    const creado = Evento.crear(propiedades(), ahora);
    expect(creado).toBeInstanceOf(Evento);
    expect(creado.fechaHora.getTime()).toBe(ahora.getTime() + 1);
  });

  it("con fecha futura verifica las invariantes: nombres repetidos y sin tipos", () => {
    const repetidos = [tipo({ id: "t1", nombre: "VIP" }), tipo({ id: "t2", nombre: " vip " })];
    expect(codigoDeRegla(() => Evento.crear(propiedades({ tiposEntrada: repetidos }), ahora))).toBe(
      "NOMBRE_TIPO_ENTRADA_REPETIDO",
    );
    expect(camposInvalidos(() => Evento.crear(propiedades({ tiposEntrada: [] }), ahora))).toEqual([
      "tiposEntrada",
    ]);
  });

  it("acepta un tipo con precio 0 (gratis)", () => {
    expect(() => Evento.crear(propiedades({ tiposEntrada: [tipo({ precio: 0 })] }), ahora)).not.toThrow();
  });
});
