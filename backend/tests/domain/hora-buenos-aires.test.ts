import { afterEach, describe, expect, it } from "vitest";
import { horaDeBuenosAires, instanteDesdeHoraDeBuenosAires } from "../../src/domain/hora-buenos-aires";

const zonaOriginal = process.env.TZ;

afterEach(() => {
  process.env.TZ = zonaOriginal;
});

describe("hora de Buenos Aires (UTC−3 fijo)", () => {
  it("interpreta la hora de pared de Buenos Aires como instante", () => {
    expect(instanteDesdeHoraDeBuenosAires("2026-12-01T20:00").toISOString()).toBe("2026-12-01T23:00:00.000Z");
  });

  it("arma la hora de pared de Buenos Aires de un instante", () => {
    expect(horaDeBuenosAires(new Date("2026-12-01T23:00:00.000Z"))).toBe("2026-12-01T20:00");
  });

  it("ida y vuelta conserva la hora de pared", () => {
    for (const pared of ["2026-01-01T00:00", "2026-06-15T09:05", "2027-02-28T23:59"]) {
      expect(horaDeBuenosAires(instanteDesdeHoraDeBuenosAires(pared))).toBe(pared);
    }
  });

  it("cambia de día y de año cuando corresponde", () => {
    expect(instanteDesdeHoraDeBuenosAires("2026-12-31T22:30").toISOString()).toBe("2027-01-01T01:30:00.000Z");
    expect(horaDeBuenosAires(new Date("2027-01-01T01:30:00.000Z"))).toBe("2026-12-31T22:30");
  });

  it("no depende de la zona del proceso", () => {
    for (const zona of ["Asia/Tokyo", "America/New_York", "UTC"]) {
      process.env.TZ = zona;
      expect(instanteDesdeHoraDeBuenosAires("2026-12-01T20:00").toISOString()).toBe(
        "2026-12-01T23:00:00.000Z",
      );
      expect(horaDeBuenosAires(new Date("2026-12-01T23:00:00.000Z"))).toBe("2026-12-01T20:00");
    }
  });
});
