import {
  etiquetaDeResenia,
  SIN_RESENIAS,
  textoCantidadTipos,
  textoCupo,
  textoFechaHora,
  textoFechaResenia,
  textoPrecio,
  textoPrecioDesde,
  textoPuntaje,
  textoPuntuacion,
  textoSentido,
} from "../../../src/features/eventos/formato";
import { reseniaDelOrganizadorDeEjemplo } from "../../helpers/eventos";

describe("formato de eventos (R18, sin Intl)", () => {
  it("textoFechaHora arma día, fecha y hora de la hora de pared", () => {
    expect(textoFechaHora("2026-12-01T20:00")).toBe("mar 1 dic 2026 · 20:00");
    expect(textoFechaHora("2027-01-03T09:05")).toBe("dom 3 ene 2027 · 09:05");
  });

  it("textoFechaHora no depende de la zona del teléfono (la suite corre en Nueva York)", () => {
    // 20:00 de Buenos Aires es medianoche en UTC: con conversión de zona cambiaría el día.
    expect(textoFechaHora("2026-12-01T20:00")).toBe("mar 1 dic 2026 · 20:00");
    expect(textoFechaHora("2026-12-01T23:30")).toBe("mar 1 dic 2026 · 23:30");
  });

  it.each([
    [0, "Gratis"],
    [500, "$ 500"],
    [15000, "$ 15.000"],
    [1250000, "$ 1.250.000"],
  ])("textoPrecio(%i) → %s", (precio, esperado) => {
    expect(textoPrecio(precio)).toBe(esperado);
  });

  it.each([
    [1, "1 tipo de entrada"],
    [3, "3 tipos de entrada"],
  ])("textoCantidadTipos(%i) → %s", (cantidad, esperado) => {
    expect(textoCantidadTipos(cantidad)).toBe(esperado);
  });

  it.each([
    [0, "Agotado"],
    [1, "1 disponible"],
    [30, "30 disponibles"],
  ])("textoCupo(%i) → %s", (cupo, esperado) => {
    expect(textoCupo(cupo)).toBe(esperado);
  });
});

describe("textos del catálogo (R18)", () => {
  it("textoPrecioDesde: 0 es Gratis; si no, desde $ …", () => {
    expect(textoPrecioDesde(0)).toBe("Gratis");
    expect(textoPrecioDesde(8000)).toBe("desde $ 8.000");
  });

  it("textoPuntaje sin reseñas dice Sin reseñas (nunca 0)", () => {
    expect(textoPuntaje({ puntaje: null, cantidadResenias: 0 })).toBe("Sin reseñas");
  });

  it("textoPuntaje redondea al décimo con coma y nombra la cantidad", () => {
    expect(textoPuntaje({ puntaje: 4.5, cantidadResenias: 12 })).toBe("4,5 · 12 reseñas");
    expect(textoPuntaje({ puntaje: 5, cantidadResenias: 1 })).toBe("5,0 · 1 reseña");
    expect(textoPuntaje({ puntaje: 4.45, cantidadResenias: 2 })).toBe("4,5 · 2 reseñas");
    expect(textoPuntaje({ puntaje: 4.04, cantidadResenias: 3 })).toBe("4,0 · 3 reseñas");
  });
});

describe("textoSentido", () => {
  it.each([
    ["fecha", "asc", "Más próximos primero"],
    ["fecha", "desc", "Más lejanos primero"],
    ["precio", "asc", "Más baratos primero"],
    ["precio", "desc", "Más caros primero"],
    ["puntaje", "desc", "Mejor puntaje primero"],
    ["puntaje", "asc", "Menor puntaje primero"],
  ] as const)("%s %s → %s", (orden, sentido, texto) => {
    expect(textoSentido(orden, sentido)).toBe(texto);
  });
});

describe("textoPuntuacion (feature 012)", () => {
  it.each([
    [1, "Puntuación: 1 de 5"],
    [4, "Puntuación: 4 de 5"],
    [5, "Puntuación: 5 de 5"],
  ])("%p → %p", (puntuacion, texto) => {
    expect(textoPuntuacion(puntuacion)).toBe(texto);
  });
});

describe("textos de las reseñas del organizador (feature 012)", () => {
  it("textoFechaResenia muestra el día de la hora de pared, sin hora", () => {
    expect(textoFechaResenia("2026-11-15T21:00")).toBe("dom 15 nov 2026");
    // 23:30 de Buenos Aires ya es el día siguiente en UTC: no se convierte la zona.
    expect(textoFechaResenia("2026-12-01T23:30")).toBe("mar 1 dic 2026");
  });

  it("etiquetaDeResenia junta autor, evento, día, puntuación y comentario", () => {
    expect(etiquetaDeResenia(reseniaDelOrganizadorDeEjemplo())).toBe(
      "Valentina Gómez, Jazz en el Patio, dom 15 nov 2026: Puntuación: 5 de 5. Excelente organización, entramos rapidísimo.",
    );
  });

  it("etiquetaDeResenia sin comentario termina en la puntuación", () => {
    expect(etiquetaDeResenia(reseniaDelOrganizadorDeEjemplo({ comentario: null, puntuacion: 2 }))).toBe(
      "Valentina Gómez, Jazz en el Patio, dom 15 nov 2026: Puntuación: 2 de 5.",
    );
  });

  it("SIN_RESENIAS", () => {
    expect(SIN_RESENIAS).toBe("Todavía no tiene reseñas");
  });
});
