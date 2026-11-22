import { EstadoCompra } from "@ai-ticket-it/shared";
import { describe, expect, it } from "vitest";
import type { Compra } from "../../src/domain/compra";
import { DatosInvalidosError, ReglaDeNegocioError } from "../../src/domain/errores";
import {
  calcularPuntaje,
  compararResenias,
  exigirQueNoReseniO,
  exigirQuePuedeReseniar,
  puntajesPorOrganizador,
  Resenia,
  type PropiedadesResenia,
} from "../../src/domain/resenia";
import { AHORA, compra, DIA, evento, HORA } from "../helpers/eventos";

const datos: PropiedadesResenia = {
  id: "resenia-1",
  compradorId: "usuario-martin",
  eventoId: "evento-a",
  puntuacion: 4,
  comentario: "Muy buena organización",
  creadaEn: AHORA,
};

function resenia(id: string, eventoId: string, puntuacion: number): Resenia {
  return new Resenia({
    id,
    compradorId: "usuario-diego",
    eventoId,
    puntuacion,
    comentario: null,
    creadaEn: AHORA,
  });
}

/** Los detalles del `DatosInvalidosError` que lanza `crear`, o falla si no lanza. */
function detallesDe(crear: () => unknown): readonly { campo: string; mensaje: string }[] {
  try {
    crear();
  } catch (error) {
    expect(error).toBeInstanceOf(DatosInvalidosError);
    return (error as DatosInvalidosError).detalles;
  }
  throw new Error("Debía lanzar DatosInvalidosError.");
}

/** El código del `ReglaDeNegocioError` que lanza `hacer`, o falla si no lanza. */
function reglaDe(hacer: () => unknown): { codigo: string; mensaje: string } {
  try {
    hacer();
  } catch (error) {
    expect(error).toBeInstanceOf(ReglaDeNegocioError);
    const regla = error as ReglaDeNegocioError;
    return { codigo: regla.codigo, mensaje: regla.message };
  }
  throw new Error("Debía lanzar ReglaDeNegocioError.");
}

describe("Resenia (feature 012)", () => {
  it("se crea con una puntuación de 1 a 5", () => {
    expect(new Resenia({ ...datos, puntuacion: 1 })).toMatchObject({ ...datos, puntuacion: 1 });
    expect(new Resenia({ ...datos, puntuacion: 5 })).toMatchObject({ ...datos, puntuacion: 5 });
  });

  it.each([0, 6, 4.5])("rechaza la puntuación %s con detalle en puntuacion", (puntuacion) => {
    expect(detallesDe(() => new Resenia({ ...datos, puntuacion }))).toEqual([
      { campo: "puntuacion", mensaje: "Debe ser un entero de 1 a 5." },
    ]);
  });

  it("acepta sin comentario (null) y con uno de 1 y de exactamente 500 caracteres", () => {
    expect(new Resenia({ ...datos, comentario: null }).comentario).toBeNull();
    expect(new Resenia({ ...datos, comentario: "x" }).comentario).toBe("x");
    expect(new Resenia({ ...datos, comentario: "x".repeat(500) }).comentario).toHaveLength(500);
  });

  it.each([
    ["de 501 caracteres", "x".repeat(501)],
    ["vacío", ""],
    ["de solo espacios", "   "],
    ["sin recortar", " hola "],
  ])("rechaza un comentario %s con detalle en comentario", (_caso, comentario) => {
    const detalles = detallesDe(() => new Resenia({ ...datos, comentario }));
    expect(detalles.map((d) => d.campo)).toEqual(["comentario"]);
  });

  it("rechaza una creadaEn inválida con detalle en creadaEn", () => {
    expect(detallesDe(() => new Resenia({ ...datos, creadaEn: new Date(NaN) })).map((d) => d.campo)).toEqual([
      "creadaEn",
    ]);
  });

  it("con varios problemas da un detalle por campo", () => {
    const detalles = detallesDe(
      () => new Resenia({ ...datos, puntuacion: 0, comentario: "", creadaEn: new Date(NaN) }),
    );
    expect(detalles.map((d) => d.campo)).toEqual(["puntuacion", "comentario", "creadaEn"]);
  });

  it("es inmutable y copia creadaEn", () => {
    const fecha = new Date(AHORA);
    const r = new Resenia({ ...datos, creadaEn: fecha });
    fecha.setTime(0);
    expect(r.creadaEn).toEqual(AHORA);
    expect(Object.isFrozen(r)).toBe(true);
  });

  describe("Resenia.crear", () => {
    const alta = { id: "r", compradorId: "usuario-martin", eventoId: "evento-a", puntuacion: 4 };

    it("recorta el comentario y fija creadaEn = ahora", () => {
      const r = Resenia.crear({ ...alta, comentario: "  Muy buena  " }, AHORA);
      expect(r.comentario).toBe("Muy buena");
      expect(r.creadaEn).toEqual(AHORA);
    });

    it.each([[""], ["   "], [null]])("pasa %j a null", (comentario) => {
      expect(Resenia.crear({ ...alta, comentario }, AHORA).comentario).toBeNull();
    });

    it("valida como el constructor", () => {
      expect(detallesDe(() => Resenia.crear({ ...alta, puntuacion: 6, comentario: null }, AHORA))).toEqual([
        { campo: "puntuacion", mensaje: "Debe ser un entero de 1 a 5." },
      ]);
    });
  });
});

describe("exigirQuePuedeReseniar", () => {
  const realizado = evento({ id: "evento-pena", organizadorId: "usuario-lucia", en: -2 * HORA });
  const tipoId = "tipo-evento-pena-general";
  const deMartin = (estado: EstadoCompra, cambios = {}) =>
    compra("evento-pena", tipoId, estado, { compradorId: "usuario-martin", ...cambios });
  const exigir =
    (compras: Compra[], usuarioId = "usuario-martin", ev = realizado) =>
    () =>
      exigirQuePuedeReseniar({ usuarioId, evento: ev, compras });

  const SIN_UTILIZADA = {
    codigo: "SIN_COMPRA_UTILIZADA",
    mensaje: "Solo podés reseñar un evento al que asististe (con una compra utilizada).",
  };

  it("el organizador no puede, aunque tuviera compras utilizadas", () => {
    const suya = compra("evento-pena", tipoId, EstadoCompra.UTILIZADA, { compradorId: "usuario-lucia" });
    expect(reglaDe(exigir([suya], "usuario-lucia"))).toEqual({
      codigo: "RESENIA_PROPIO_EVENTO",
      mensaje: "No podés reseñar un evento que organizás.",
    });
    expect(reglaDe(exigir([], "usuario-lucia")).codigo).toBe("RESENIA_PROPIO_EVENTO");
  });

  it("sin compras no puede", () => {
    expect(reglaDe(exigir([]))).toEqual(SIN_UTILIZADA);
  });

  const vencida = deMartin(EstadoCompra.PENDIENTE, { creadaEn: new Date(AHORA.getTime() - DIA) });
  const canceladaPorVencimiento = deMartin(EstadoCompra.PENDIENTE, {
    historial: [
      {
        estado: EstadoCompra.PENDIENTE,
        autor: { tipo: "usuario", usuarioId: "usuario-martin" },
        fechaHora: AHORA,
      },
      {
        estado: EstadoCompra.CANCELADA,
        autor: { tipo: "sistema" },
        fechaHora: new Date(AHORA.getTime() + HORA),
      },
    ],
  });

  it.each([
    ["PENDIENTE", deMartin(EstadoCompra.PENDIENTE)],
    ["PENDIENTE vencida", vencida],
    ["CONFIRMADA", deMartin(EstadoCompra.CONFIRMADA)],
    ["CANCELADA por el comprador", deMartin(EstadoCompra.CANCELADA)],
    ["CANCELADA por vencimiento", canceladaPorVencimiento],
    ["REEMBOLSADA", deMartin(EstadoCompra.REEMBOLSADA)],
  ])("con solo una %s no puede", (_estado, unaCompra) => {
    expect(reglaDe(exigir([unaCompra]))).toEqual(SIN_UTILIZADA);
  });

  it("una UTILIZADA con 1 de 3 entradas usadas alcanza", () => {
    const unaDeTres = deMartin(EstadoCompra.UTILIZADA, { cantidad: 3 });
    expect(unaDeTres.entradasUsadas).toBe(1);
    expect(exigir([unaDeTres])).not.toThrow();
  });

  it("dos UTILIZADA alcanzan, y una UTILIZADA con una CANCELADA también", () => {
    expect(exigir([deMartin(EstadoCompra.UTILIZADA), deMartin(EstadoCompra.UTILIZADA)])).not.toThrow();
    expect(exigir([deMartin(EstadoCompra.CANCELADA), deMartin(EstadoCompra.UTILIZADA)])).not.toThrow();
  });

  it("no mira si el evento está realizado (ventana de uso abierta)", () => {
    const enCurso = evento({ id: "evento-pena", organizadorId: "usuario-lucia", en: 2 * HORA });
    expect(enCurso.fechaHora.getTime()).toBeGreaterThan(AHORA.getTime());
    expect(exigir([deMartin(EstadoCompra.UTILIZADA)], "usuario-martin", enCurso)).not.toThrow();
  });
});

describe("exigirQueNoReseniO", () => {
  it("sin reseña previa no lanza", () => {
    expect(() => exigirQueNoReseniO(null)).not.toThrow();
  });

  it("con una reseña previa lanza RESENIA_REPETIDA", () => {
    expect(reglaDe(() => exigirQueNoReseniO(new Resenia(datos)))).toEqual({
      codigo: "RESENIA_REPETIDA",
      mensaje: "Ya reseñaste este evento.",
    });
  });
});

describe("compararResenias", () => {
  const en = (id: string, ms: number) =>
    new Resenia({ ...datos, id, creadaEn: new Date(AHORA.getTime() + ms) });

  it("ordena por creadaEn descendente y, con la misma fecha, por id ascendente", () => {
    const vieja = en("a", 0);
    const nuevaB = en("b", HORA);
    const nuevaA = en("a2", HORA);
    expect([vieja, nuevaB, nuevaA].sort(compararResenias).map((r) => r.id)).toEqual(["a2", "b", "a"]);
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
