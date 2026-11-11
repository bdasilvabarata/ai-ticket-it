import {
  textoCantidadTipos,
  textoCupo,
  textoFechaHora,
  textoPrecio,
} from "../../../src/features/eventos/formato";

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
