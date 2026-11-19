import { describe, expect, it } from "vitest";
import {
  ALFABETO_DE_CODIGO,
  esCodigoValido,
  LARGO_DE_CODIGO,
  normalizarCodigo,
} from "../../src/domain/codigo-de-entrada";

describe("código de entrada (research R2)", () => {
  it("el alfabeto es Crockford base 32 sin I, L, O ni U, y el largo es 8", () => {
    expect(ALFABETO_DE_CODIGO).toHaveLength(32);
    expect(ALFABETO_DE_CODIGO).not.toMatch(/[ILOU]/);
    expect(LARGO_DE_CODIGO).toBe(8);
  });

  it("8 caracteres del alfabeto es válido", () => {
    expect(esCodigoValido("7K3MQ9TB")).toBe(true);
    expect(esCodigoValido("00000000")).toBe(true);
    expect(esCodigoValido("ZZZZZZZZ")).toBe(true);
  });

  it("7 o 9 caracteres no es válido", () => {
    expect(esCodigoValido("7K3MQ9T")).toBe(false);
    expect(esCodigoValido("7K3MQ9TBX")).toBe(false);
    expect(esCodigoValido("")).toBe(false);
  });

  it("minúsculas, I, L, O, U o un guion no son válidos", () => {
    expect(esCodigoValido("7k3mq9tb")).toBe(false);
    for (const letra of ["I", "L", "O", "U"]) {
      expect(esCodigoValido(`7K3MQ9T${letra}`)).toBe(false);
    }
    expect(esCodigoValido("7K3M-Q9T")).toBe(false);
    expect(esCodigoValido("7K3M-Q9TB")).toBe(false);
  });

  it("normalizar pasa a mayúsculas y saca espacios y guiones", () => {
    expect(normalizarCodigo(" 7k3m-q9tb ")).toBe("7K3MQ9TB");
    expect(normalizarCodigo("7K3M Q9TB")).toBe("7K3MQ9TB");
    expect(normalizarCodigo("7K3MQ9TB")).toBe("7K3MQ9TB");
  });

  it("normalizar no inventa validez", () => {
    expect(normalizarCodigo("abc")).toBe("ABC");
    expect(esCodigoValido(normalizarCodigo("abc"))).toBe(false);
  });
});
