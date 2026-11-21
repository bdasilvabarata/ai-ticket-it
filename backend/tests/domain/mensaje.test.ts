import { LIMITES_MENSAJE } from "@ai-ticket-it/shared";
import { describe, expect, it } from "vitest";
import { DatosInvalidosError } from "../../src/domain/errores";
import { Mensaje, type PropiedadesMensaje } from "../../src/domain/mensaje";

const T = new Date("2026-11-20T17:35:00.000Z");
const datos: PropiedadesMensaje = { autorId: "usuario-martin", texto: "Hola", enviadoEn: T };

function detallesInvalidos(cambios: Partial<PropiedadesMensaje>) {
  try {
    new Mensaje({ ...datos, ...cambios });
  } catch (error) {
    expect(error).toBeInstanceOf(DatosInvalidosError);
    return (error as DatosInvalidosError).detalles;
  }
  throw new Error("Debía lanzar DatosInvalidosError.");
}

const camposInvalidos = (cambios: Partial<PropiedadesMensaje>) =>
  detallesInvalidos(cambios).map((detalle) => detalle.campo);

describe("Mensaje (feature 011)", () => {
  it("se construye con su autor, su texto y su fecha", () => {
    const mensaje = new Mensaje(datos);

    expect(mensaje.autorId).toBe("usuario-martin");
    expect(mensaje.texto).toBe("Hola");
    expect(mensaje.enviadoEn).toEqual(T);
  });

  it("acepta un texto de 1 y de exactamente 500 caracteres", () => {
    expect(LIMITES_MENSAJE.largoMaximo).toBe(500);
    expect(new Mensaje({ ...datos, texto: "a" }).texto).toBe("a");
    expect(new Mensaje({ ...datos, texto: "a".repeat(500) }).texto).toHaveLength(500);
  });

  it("acepta saltos de línea internos", () => {
    expect(new Mensaje({ ...datos, texto: "Hola\n\nChau" }).texto).toBe("Hola\n\nChau");
  });

  it.each([
    ["vacío", ""],
    ["solo espacios", "   "],
    ["solo saltos de línea", "\n\n"],
    ["sin recortar al principio y al final", " hola "],
    ["sin recortar al final", "hola\n"],
    ["de 501 caracteres", "a".repeat(501)],
  ])("rechaza el texto %s con un detalle en texto", (_caso, texto) => {
    expect(camposInvalidos({ texto })).toEqual(["texto"]);
  });

  it("rechaza un autor vacío con un detalle en autorId", () => {
    expect(camposInvalidos({ autorId: "" })).toEqual(["autorId"]);
  });

  it("rechaza una fecha inválida con un detalle en enviadoEn", () => {
    expect(camposInvalidos({ enviadoEn: new Date(NaN) })).toEqual(["enviadoEn"]);
  });

  it("con varios problemas a la vez, un detalle por campo", () => {
    expect(camposInvalidos({ autorId: "", texto: "", enviadoEn: new Date(NaN) }).sort()).toEqual([
      "autorId",
      "enviadoEn",
      "texto",
    ]);
  });

  it("es inmutable y copia la fecha recibida", () => {
    const enviadoEn = new Date(T);
    const mensaje = new Mensaje({ ...datos, enviadoEn });

    expect(Object.isFrozen(mensaje)).toBe(true);
    enviadoEn.setTime(0);
    expect(mensaje.enviadoEn).toEqual(T);
  });
});
