import { describe, expect, it } from "vitest";
import { diasRestantes } from "../../src/domain/dias-restantes";
import { instanteDesdeHoraDeBuenosAires } from "../../src/domain/hora-buenos-aires";

// Fechas de pared de Buenos Aires (UTC−3). El lunes 10 de agosto de 2026 es el día de referencia.
const ba = instanteDesdeHoraDeBuenosAires;

describe("diasRestantes", () => {
  it("cuenta días de calendario hasta el evento", () => {
    expect(diasRestantes(ba("2026-08-20T20:00"), ba("2026-08-10T12:00"))).toBe(10);
  });

  it("un evento de mañana es 1 tanto a las 00:01 como a las 23:59 (no son bloques de 24 h)", () => {
    expect(diasRestantes(ba("2026-08-11T21:00"), ba("2026-08-10T00:01"))).toBe(1);
    expect(diasRestantes(ba("2026-08-11T21:00"), ba("2026-08-10T23:59"))).toBe(1);
  });

  it("un evento de hoy que todavía no empezó es 0", () => {
    expect(diasRestantes(ba("2026-08-11T21:00"), ba("2026-08-11T00:00"))).toBe(0);
    expect(diasRestantes(ba("2026-08-11T21:00"), ba("2026-08-11T20:59"))).toBe(0);
  });

  it("en el instante exacto de inicio el evento ya empezó: null", () => {
    const inicio = ba("2026-08-11T21:00");
    expect(diasRestantes(inicio, new Date(inicio.getTime()))).toBeNull();
  });

  it("un evento ya empezado el mismo día o antes es null", () => {
    expect(diasRestantes(ba("2026-08-11T21:00"), ba("2026-08-11T22:30"))).toBeNull();
    expect(diasRestantes(ba("2026-08-11T21:00"), ba("2026-08-15T10:00"))).toBeNull();
  });

  it("usa la medianoche de Buenos Aires, no la de UTC", () => {
    const evento = new Date("2026-08-11T23:00:00.000Z"); // 11/08 20:00 en Buenos Aires
    expect(diasRestantes(evento, new Date("2026-08-11T02:59:59.000Z"))).toBe(1); // 10/08 23:59:59
    expect(diasRestantes(evento, new Date("2026-08-11T03:00:00.000Z"))).toBe(0); // 11/08 00:00
  });

  it("cruza bien el fin de mes y el de año", () => {
    expect(diasRestantes(ba("2027-01-02T10:00"), ba("2026-12-31T18:00"))).toBe(2);
    expect(diasRestantes(ba("2026-09-01T10:00"), ba("2026-08-31T23:00"))).toBe(1);
  });

  it("siempre devuelve un entero ≥ 0 mientras el evento no empezó", () => {
    const ahora = ba("2026-08-10T13:17");
    for (const minutos of [1, 59, 600, 1439, 1440, 2881, 60_000]) {
      const dias = diasRestantes(new Date(ahora.getTime() + minutos * 60_000), ahora);
      expect(Number.isInteger(dias)).toBe(true);
      expect(dias).toBeGreaterThanOrEqual(0);
    }
  });
});
