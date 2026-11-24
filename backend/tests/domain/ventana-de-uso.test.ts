import { describe, expect, it } from "vitest";
import { ReglaDeNegocioError } from "../../src/domain/errores";
import { instanteDesdeHoraDeBuenosAires } from "../../src/domain/hora-buenos-aires";
import {
  estadoDeVentana,
  exigirVentanaAbierta,
  HORAS_ANTES_DEL_INICIO,
  HORAS_DESPUES_DEL_INICIO,
  ventanaDeUso,
} from "../../src/domain/ventana-de-uso";

const ba = instanteDesdeHoraDeBuenosAires;
const MINUTO = 60 * 1000;
const mas = (instante: Date, ms: number) => new Date(instante.getTime() + ms);

describe("ventana de uso (FR-016, research R8)", () => {
  const inicio = ba("2026-11-20T21:00");
  const ventana = ventanaDeUso(inicio);

  it("va de 4 horas antes a 12 horas después del inicio", () => {
    expect(HORAS_ANTES_DEL_INICIO).toBe(4);
    expect(HORAS_DESPUES_DEL_INICIO).toBe(12);
    expect(ventana.desde).toEqual(ba("2026-11-20T17:00"));
    expect(ventana.hasta).toEqual(ba("2026-11-21T09:00"));
  });

  it("exactamente en desde y en hasta está abierta (inclusive)", () => {
    expect(estadoDeVentana(ventana, new Date(ventana.desde))).toBe("abierta");
    expect(estadoDeVentana(ventana, new Date(ventana.hasta))).toBe("abierta");
    expect(estadoDeVentana(ventana, inicio)).toBe("abierta");
  });

  it("1 minuto antes de desde es antes, y 1 minuto después de hasta es despues", () => {
    expect(estadoDeVentana(ventana, mas(ventana.desde, -MINUTO))).toBe("antes");
    expect(estadoDeVentana(ventana, mas(ventana.hasta, MINUTO))).toBe("despues");
  });

  it("un evento a las 23:00 va de las 19:00 a las 11:00 del día siguiente", () => {
    const tarde = ventanaDeUso(ba("2026-11-20T23:00"));
    expect(tarde.desde).toEqual(ba("2026-11-20T19:00"));
    expect(tarde.hasta).toEqual(ba("2026-11-21T11:00"));
  });

  describe("exigirVentanaAbierta", () => {
    it("adentro no lanza", () => {
      expect(() => exigirVentanaAbierta(inicio, new Date(ventana.desde))).not.toThrow();
      expect(() => exigirVentanaAbierta(inicio, new Date(ventana.hasta))).not.toThrow();
    });

    it.each([
      ["antes", mas(ventana.desde, -MINUTO)],
      ["después", mas(ventana.hasta, MINUTO)],
    ])("%s de la ventana lanza FUERA_DE_HORARIO_DE_USO con la hora de Buenos Aires", (_, ahora) => {
      let error: unknown;
      try {
        exigirVentanaAbierta(inicio, ahora);
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(ReglaDeNegocioError);
      expect(error).toMatchObject({
        codigo: "FUERA_DE_HORARIO_DE_USO",
        message: "El ingreso se registra desde el 20/11 17:00 hasta el 21/11 09:00.",
      });
    });
  });
});
