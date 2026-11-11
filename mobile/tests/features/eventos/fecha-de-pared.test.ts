import { aFechaDePared, aFechaDelSelector } from "../../../src/features/eventos/fecha-de-pared";

// La suite corre en America/New_York (jest.global-setup.js): una zona distinta de Buenos Aires
// y con horario de verano, como un teléfono de viaje.
describe("fecha de pared ⇄ fecha del selector (R11)", () => {
  it("aFechaDelSelector arma un Date con los componentes locales de la hora de pared", () => {
    const fecha = aFechaDelSelector("2026-12-01T20:00");
    expect([
      fecha.getFullYear(),
      fecha.getMonth(),
      fecha.getDate(),
      fecha.getHours(),
      fecha.getMinutes(),
    ]).toEqual([2026, 11, 1, 20, 0]);
  });

  it("aFechaDePared toma los componentes locales, sin segundos ni zona", () => {
    expect(aFechaDePared(new Date(2027, 0, 3, 9, 5, 42))).toBe("2027-01-03T09:05");
  });

  it("ida y vuelta conserva la hora de pared con el teléfono fuera de Buenos Aires", () => {
    for (const pared of ["2026-12-01T20:00", "2026-01-01T00:00", "2026-07-15T23:59"]) {
      expect(aFechaDePared(aFechaDelSelector(pared))).toBe(pared);
    }
  });

  it("con el teléfono en una zona con horario de verano, una hora que no existe ahí se corre (riesgo aceptado)", () => {
    // 2026-03-08 02:30 no existe en Nueva York (de 02:00 se pasa a 03:00): el selector no puede
    // representarla. La app nunca la propone sola; si la persona la eligiera, quedaría 03:30.
    expect(aFechaDePared(aFechaDelSelector("2026-03-08T02:30"))).toBe("2026-03-08T03:30");
  });
});
