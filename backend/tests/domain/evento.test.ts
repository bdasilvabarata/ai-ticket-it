import { describe, expect, it } from "vitest";
import { Evento, mismoNombreDeTipo, ordenDeMisEventos, TipoEntrada } from "../../src/domain/evento";
import { DatosInvalidosError, ReglaDeNegocioError } from "../../src/domain/errores";

const datosTipo = { id: "t1", nombre: "General", descripcion: "Campo", precio: 15000, cupo: 3 };

function tipo(cambios: Partial<typeof datosTipo> = {}): TipoEntrada {
  return new TipoEntrada({ ...datosTipo, ...cambios });
}

function evento(
  tiposEntrada: TipoEntrada[] = [tipo()],
  cambios: { id?: string; nombre?: string; fechaHora?: Date } = {},
) {
  return new Evento({
    id: cambios.id ?? "e1",
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

describe("Evento: consultas del catálogo (feature 005)", () => {
  it("precioDesde es el menor precio entre todos los tipos, también uno agotado", () => {
    const e = evento([
      tipo({ id: "t1", nombre: "General", precio: 15000, cupo: 10 }),
      tipo({ id: "t2", nombre: "Anticipada", precio: 9000, cupo: 0 }),
      tipo({ id: "t3", nombre: "VIP", precio: 40000, cupo: 5 }),
    ]);
    expect(e.precioDesde()).toBe(9000);
  });

  it("precioDesde es 0 si algún tipo es gratis", () => {
    const e = evento([tipo({ id: "t1", precio: 15000 }), tipo({ id: "t2", nombre: "Kids", precio: 0 })]);
    expect(e.precioDesde()).toBe(0);
  });

  it("estaAgotado solo si todos los tipos tienen cupo 0", () => {
    const agotado = evento([tipo({ id: "t1", cupo: 0 }), tipo({ id: "t2", nombre: "VIP", cupo: 0 })]);
    const parcial = evento([tipo({ id: "t1", cupo: 0 }), tipo({ id: "t2", nombre: "VIP", cupo: 1 })]);
    expect(agotado.estaAgotado()).toBe(true);
    expect(parcial.estaAgotado()).toBe(false);
    expect(evento().estaAgotado()).toBe(false);
  });

  it("ninguna de las dos modifica el evento", () => {
    const e = evento([tipo({ id: "t1", precio: 5000, cupo: 0 })]);
    const antes = structuredClone({ ...e, tiposEntrada: e.tiposEntrada.map((t) => ({ ...t })) });
    e.precioDesde();
    e.estaAgotado();
    expect({ ...e, tiposEntrada: e.tiposEntrada.map((t) => ({ ...t })) }).toEqual(antes);
  });
});

describe("Evento.coincideCon (búsqueda, R4)", () => {
  function conTextos(nombre: string, descripcion: string) {
    return new Evento({
      id: "e1",
      nombre,
      descripcion,
      categoriaId: "c1",
      fechaHora: new Date("2026-12-01T00:00:00Z"),
      multimedia: [],
      organizadorId: "u1",
      tiposEntrada: [tipo()],
    });
  }
  const rock = conTextos("Noche de Rock", "Tres bandas en el club.");

  it("sin palabras coincide siempre", () => {
    expect(rock.coincideCon([])).toBe(true);
  });

  it("encuentra parte de una palabra o la palabra completa, sin mayúsculas ni tildes", () => {
    const basquet = conTextos("Clásico de BÁSQUET", "");
    expect(basquet.coincideCon(["basq"])).toBe(true);
    expect(basquet.coincideCon(["basquet"])).toBe(true);
    expect(rock.coincideCon(["rock"])).toBe(true);
  });

  it("varias palabras en cualquier orden, también repartidas entre nombre y descripción", () => {
    expect(rock.coincideCon(["club", "rock"])).toBe(true);
    const hamlet = conTextos("Hamlet", "Butacas numeradas.");
    expect(hamlet.coincideCon(["hamlet", "butacas"])).toBe(true);
  });

  it("todas las palabras tienen que estar: una sola de dos no alcanza", () => {
    expect(rock.coincideCon(["rock", "jazz"])).toBe(false);
  });

  it("una palabra no coincide pegando el final del nombre con el principio de la descripción", () => {
    const pegado = conTextos("Noche de Ro", "ck en vivo");
    expect(pegado.coincideCon(["rock"])).toBe(false);
  });

  it("los caracteres especiales son literales", () => {
    const raro = conTextos("Fiesta (rock) 2.0", "Con * estrellas");
    expect(raro.coincideCon(["(rock"])).toBe(true);
    expect(raro.coincideCon(["*"])).toBe(true);
    expect(raro.coincideCon(["."])).toBe(true);
    expect(rock.coincideCon(["*"])).toBe(false);
    expect(rock.coincideCon(["."])).toBe(true);
    expect(rock.coincideCon(["(rock"])).toBe(false);
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

describe("Evento: operaciones (devuelven un Evento nuevo y no cambian el original)", () => {
  const inicio = new Date("2026-12-01T23:00:00.000Z");
  const antes = new Date(inicio.getTime() - 1);
  const general = tipo({ id: "t1", nombre: "General", precio: 15000, cupo: 3 });
  const vip = tipo({ id: "t2", nombre: "VIP", precio: 60000, cupo: 1 });
  const original = () => evento([general, vip], { fechaHora: inicio });
  const datos = {
    nombre: "Noche de Rock (nueva fecha)",
    descripcion: "Otra.",
    categoriaId: "c2",
    fechaHora: new Date(inicio.getTime() + 60_000),
    multimedia: ["https://example.com/b.jpg"],
  };
  const comoEstaba = (rock: Evento) => ({
    nombre: rock.nombre,
    fechaHora: rock.fechaHora.getTime(),
    tipos: rock.tiposEntrada.map((t) => [t.id, t.nombre, t.precio, t.cupo]),
  });

  describe("actualizar", () => {
    it("reemplaza los datos y conserva id, organizador y tipos", () => {
      const rock = original();
      const antesDeEditar = comoEstaba(rock);
      const editado = rock.actualizar(datos, antes);
      expect(editado).not.toBe(rock);
      expect(editado).toMatchObject({ ...datos, id: "e1", organizadorId: "u1" });
      expect(editado.tiposEntrada).toEqual(rock.tiposEntrada);
      expect(comoEstaba(rock)).toEqual(antesDeEditar);
    });

    it("rechaza un evento realizado (en el borde) antes que la fecha no futura", () => {
      expect(codigoDeRegla(() => original().actualizar({ ...datos, fechaHora: antes }, inicio))).toBe(
        "EVENTO_REALIZADO",
      );
    });

    it("rechaza una fecha nueva que no es futura", () => {
      expect(codigoDeRegla(() => original().actualizar({ ...datos, fechaHora: antes }, antes))).toBe(
        "FECHA_NO_FUTURA",
      );
    });
  });

  describe("agregarTipoEntrada", () => {
    it("agrega el tipo al final y no cambia el original", () => {
      const rock = original();
      const nuevo = rock.agregarTipoEntrada(tipo({ id: "t3", nombre: "Platea", cupo: 1 }), antes);
      expect(nuevo.tiposEntrada.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
      expect(rock.tiposEntrada.map((t) => t.id)).toEqual(["t1", "t2"]);
    });

    it("rechaza un evento realizado", () => {
      expect(
        codigoDeRegla(() => original().agregarTipoEntrada(tipo({ id: "t3", nombre: "Platea" }), inicio)),
      ).toBe("EVENTO_REALIZADO");
    });

    it("rechaza un cupo inicial 0 con DatosInvalidosError", () => {
      expect(
        camposInvalidos(() =>
          original().agregarTipoEntrada(tipo({ id: "t3", nombre: "Platea", cupo: 0 }), antes),
        ),
      ).toEqual(["cupo"]);
    });

    it("rechaza un nombre repetido sin mayúsculas ni tildes", () => {
      expect(
        codigoDeRegla(() => original().agregarTipoEntrada(tipo({ id: "t3", nombre: " víp " }), antes)),
      ).toBe("NOMBRE_TIPO_ENTRADA_REPETIDO");
    });
  });

  describe("editarTipoEntrada", () => {
    const cambios = { nombre: "General", descripcion: "Nueva.", precio: 20000, cupo: 0 };

    it("edita el tipo en su lugar, con el mismo id, y acepta cupo 0 (agotado)", () => {
      const rock = original();
      const editado = rock.editarTipoEntrada("t1", cambios, antes);
      expect(editado.tiposEntrada.map((t) => [t.id, t.nombre, t.precio, t.cupo])).toEqual([
        ["t1", "General", 20000, 0],
        ["t2", "VIP", 60000, 1],
      ]);
      expect(rock.buscarTipoEntrada("t1")?.precio).toBe(15000);
    });

    it("acepta conservar el propio nombre o cambiarle solo mayúsculas o tildes", () => {
      expect(
        original()
          .editarTipoEntrada("t2", { ...cambios, nombre: "víp" }, antes)
          .buscarTipoEntrada("t2")?.nombre,
      ).toBe("víp");
    });

    it("rechaza el nombre de otro tipo", () => {
      expect(
        codigoDeRegla(() => original().editarTipoEntrada("t2", { ...cambios, nombre: "general" }, antes)),
      ).toBe("NOMBRE_TIPO_ENTRADA_REPETIDO");
    });

    it("rechaza un evento realizado", () => {
      expect(codigoDeRegla(() => original().editarTipoEntrada("t1", cambios, inicio))).toBe(
        "EVENTO_REALIZADO",
      );
    });

    it("rechaza un tipo inexistente (red de seguridad)", () => {
      expect(() => original().editarTipoEntrada("t9", cambios, antes)).toThrow();
    });
  });

  describe("quitarTipoEntrada", () => {
    it("quita el tipo y no cambia el original", () => {
      const rock = original();
      expect(
        rock.quitarTipoEntrada("t2", { ahora: antes, tieneCompras: false }).tiposEntrada.map((t) => t.id),
      ).toEqual(["t1"]);
      expect(rock.tiposEntrada).toHaveLength(2);
    });

    it("verifica en orden: realizado, último tipo y compras", () => {
      const solo = evento([general], { fechaHora: inicio });
      expect(codigoDeRegla(() => solo.quitarTipoEntrada("t1", { ahora: inicio, tieneCompras: true }))).toBe(
        "EVENTO_REALIZADO",
      );
      expect(codigoDeRegla(() => solo.quitarTipoEntrada("t1", { ahora: antes, tieneCompras: true }))).toBe(
        "ULTIMO_TIPO_ENTRADA",
      );
      expect(
        codigoDeRegla(() => original().quitarTipoEntrada("t1", { ahora: antes, tieneCompras: true })),
      ).toBe("TIPO_ENTRADA_CON_COMPRAS");
    });

    it("rechaza un tipo inexistente (red de seguridad)", () => {
      expect(() => original().quitarTipoEntrada("t9", { ahora: antes, tieneCompras: false })).toThrow();
    });
  });

  describe("verificarQueSePuedeEliminar", () => {
    it("rechaza un evento realizado (en el borde) antes que uno con compras", () => {
      expect(
        codigoDeRegla(() => original().verificarQueSePuedeEliminar({ ahora: inicio, tieneCompras: true })),
      ).toBe("EVENTO_REALIZADO");
      expect(
        codigoDeRegla(() => original().verificarQueSePuedeEliminar({ ahora: antes, tieneCompras: true })),
      ).toBe("EVENTO_CON_COMPRAS");
    });

    it("no lanza si se puede eliminar", () => {
      expect(() =>
        original().verificarQueSePuedeEliminar({ ahora: antes, tieneCompras: false }),
      ).not.toThrow();
    });
  });
});

describe("ordenDeMisEventos", () => {
  it("primero los próximos (ascendente) y después los realizados (descendente), según ahora", () => {
    const ahora = new Date("2026-12-01T00:00:00Z");
    const en = (dias: number, nombre: string) =>
      evento([tipo()], { nombre, fechaHora: new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000) });
    const eventos = [en(-5, "hace 5"), en(3, "en 3"), en(0, "ahora"), en(1, "en 1"), en(-1, "ayer")];
    expect(eventos.toSorted(ordenDeMisEventos(ahora)).map((e) => e.nombre)).toEqual([
      "en 1",
      "en 3",
      "ahora",
      "ayer",
      "hace 5",
    ]);
  });

  describe("desempate a la misma fecha (feature 014)", () => {
    const ahora = new Date("2026-12-01T00:00:00Z");
    const proxima = new Date("2026-12-10T21:00:00Z");
    const pasada = new Date("2026-11-10T21:00:00Z");
    const con = (id: string, nombre: string, fechaHora: Date) => evento([tipo()], { id, nombre, fechaHora });

    it("dos próximos a la misma fecha van por nombre sin mayúsculas ni tildes", () => {
      const eventos = [con("e1", "zamba", proxima), con("e2", "Ópera", proxima), con("e3", "árbol", proxima)];
      expect(eventos.toSorted(ordenDeMisEventos(ahora)).map((e) => e.nombre)).toEqual([
        "árbol",
        "Ópera",
        "zamba",
      ]);
    });

    it("dos realizados a la misma fecha también van por nombre ascendente", () => {
      const eventos = [con("e1", "Zamba", pasada), con("e2", "Ópera", pasada), con("e3", "Árbol", pasada)];
      expect(eventos.toSorted(ordenDeMisEventos(ahora)).map((e) => e.nombre)).toEqual([
        "Árbol",
        "Ópera",
        "Zamba",
      ]);
    });

    it("con el mismo nombre (sin distinguir mayúsculas ni tildes) decide el id", () => {
      const eventos = [con("e3", "Opera", proxima), con("e1", "ópera", proxima), con("e2", "OPERA", proxima)];
      expect(eventos.toSorted(ordenDeMisEventos(ahora)).map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
      const realizados = eventos.map((e, i) => con(e.id, ["Opera", "ópera", "OPERA"][i], pasada));
      expect(realizados.toSorted(ordenDeMisEventos(ahora)).map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
    });
  });
});

describe("Devolver cupo (feature 006: vencimiento de compras)", () => {
  it("TipoEntrada.devolver suma al cupo en un tipo nuevo; el original no cambia", () => {
    const original = tipo({ cupo: 3 });
    const devuelto = original.devolver(2);
    expect(devuelto).not.toBe(original);
    expect(devuelto).toMatchObject({ ...datosTipo, cupo: 5 });
    expect(original.cupo).toBe(3);
  });

  it("Evento.devolverCupos devuelve un Evento nuevo con cada tipo devuelto e ignora los ids ausentes", () => {
    const original = evento([tipo({ id: "t1", cupo: 3 }), tipo({ id: "t2", nombre: "VIP", cupo: 0 })]);
    const devuelto = original.devolverCupos(
      new Map([
        ["t1", 1],
        ["t2", 4],
        ["otro", 7],
      ]),
    );
    expect(devuelto).not.toBe(original);
    expect(devuelto.tiposEntrada.map((t) => [t.id, t.cupo])).toEqual([
      ["t1", 4],
      ["t2", 4],
    ]);
    expect(original.tiposEntrada.map((t) => t.cupo)).toEqual([3, 0]);
  });

  it("con un Map vacío los cupos quedan iguales", () => {
    const original = evento([tipo({ cupo: 3 })]);
    expect(original.devolverCupos(new Map()).tiposEntrada.map((t) => t.cupo)).toEqual([3]);
  });

  it("no chequea si el evento se realizó: un evento realizado devuelve igual (R9)", () => {
    const realizado = evento([tipo({ cupo: 0 })], { fechaHora: new Date("2020-01-01T00:00:00Z") });
    expect(realizado.devolverCupos(new Map([["t1", 2]])).tiposEntrada[0]?.cupo).toBe(2);
  });
});

describe("Comprar (feature 006)", () => {
  const INICIO = new Date("2026-12-01T00:00:00Z");
  const antes = new Date(INICIO.getTime() - 1);
  const vip = (cupo: number) => tipo({ id: "vip", nombre: "VIP", precio: 120000, cupo });

  /** El mensaje del ReglaDeNegocioError que lanza `operacion`. */
  function mensajeDeRegla(operacion: () => unknown): string {
    try {
      operacion();
    } catch (error) {
      expect(error).toBeInstanceOf(ReglaDeNegocioError);
      return (error as ReglaDeNegocioError).message;
    }
    throw new Error("Debía lanzar ReglaDeNegocioError.");
  }

  describe("TipoEntrada", () => {
    it("esGratis ⇔ precio 0", () => {
      expect(tipo({ precio: 0 }).esGratis()).toBe(true);
      expect(tipo({ precio: 1 }).esGratis()).toBe(false);
    });

    it("descontar(3) sobre 3 deja cupo 0 en un tipo nuevo; el original no cambia", () => {
      const original = tipo({ cupo: 3 });
      const descontado = original.descontar(3);
      expect(descontado.cupo).toBe(0);
      expect(original.cupo).toBe(3);
    });

    it("descontar más que el cupo lanza DatosInvalidosError (el cupo nunca es negativo)", () => {
      expect(camposInvalidos(() => tipo({ cupo: 2 }).descontar(3))).toEqual(["cupo"]);
    });
  });

  describe("exigirQueSePuedeComprar", () => {
    it("1 ms antes del inicio, alguien que no organiza el evento puede comprar", () => {
      expect(() => evento().exigirQueSePuedeComprar("u2", antes)).not.toThrow();
    });

    it("en el instante exacto del inicio → EVENTO_REALIZADO con el mensaje de la compra", () => {
      expect(codigoDeRegla(() => evento().exigirQueSePuedeComprar("u2", INICIO))).toBe("EVENTO_REALIZADO");
      expect(mensajeDeRegla(() => evento().exigirQueSePuedeComprar("u2", INICIO))).toBe(
        "El evento ya se realizó: no se pueden comprar entradas.",
      );
    });

    it("el organizador → COMPRA_PROPIO_EVENTO", () => {
      expect(codigoDeRegla(() => evento().exigirQueSePuedeComprar("u1", antes))).toBe("COMPRA_PROPIO_EVENTO");
      expect(mensajeDeRegla(() => evento().exigirQueSePuedeComprar("u1", antes))).toBe(
        "No podés comprar entradas de un evento que organizás.",
      );
    });

    it("realizado y organizador → EVENTO_REALIZADO (va primero)", () => {
      expect(codigoDeRegla(() => evento().exigirQueSePuedeComprar("u1", INICIO))).toBe("EVENTO_REALIZADO");
    });
  });

  describe("descontarCupo", () => {
    it("realizado → EVENTO_REALIZADO", () => {
      expect(codigoDeRegla(() => evento([vip(3)]).descontarCupo("vip", 1, INICIO))).toBe("EVENTO_REALIZADO");
    });

    it("cupo 3 y pide 3 → un Evento nuevo con 0; el original no cambia", () => {
      const original = evento([vip(3)]);
      const descontado = original.descontarCupo("vip", 3, antes);
      expect(descontado).not.toBe(original);
      expect(descontado.buscarTipoEntrada("vip")?.cupo).toBe(0);
      expect(original.buscarTipoEntrada("vip")?.cupo).toBe(3);
    });

    it("pide más que el cupo → CUPO_INSUFICIENTE con las que quedan", () => {
      expect(codigoDeRegla(() => evento([vip(3)]).descontarCupo("vip", 4, antes))).toBe("CUPO_INSUFICIENTE");
      expect(mensajeDeRegla(() => evento([vip(3)]).descontarCupo("vip", 4, antes))).toBe(
        "Quedan 3 entradas de «VIP».",
      );
      expect(mensajeDeRegla(() => evento([vip(1)]).descontarCupo("vip", 2, antes))).toBe(
        "Queda 1 entrada de «VIP».",
      );
      expect(mensajeDeRegla(() => evento([vip(0)]).descontarCupo("vip", 1, antes))).toBe(
        "No quedan entradas de «VIP».",
      );
    });

    it("el mensaje de las ediciones (004) no cambia", () => {
      const datos = { nombre: "X", descripcion: "", categoriaId: "c1", fechaHora: INICIO, multimedia: [] };
      expect(mensajeDeRegla(() => evento().actualizar(datos, INICIO))).toBe(
        "El evento ya se realizó: no se puede modificar.",
      );
    });
  });
});
