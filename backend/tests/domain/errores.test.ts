import { describe, expect, it } from "vitest";
import { DatosInvalidosError, ErrorDeDominio, ReglaDeNegocioError } from "../../src/domain/errores";

describe("errores de dominio", () => {
  it("DatosInvalidosError lleva un detalle por campo y no sabe de HTTP", () => {
    const error = new DatosInvalidosError([{ campo: "precio", mensaje: "Debe ser un entero." }]);
    expect(error).toBeInstanceOf(ErrorDeDominio);
    expect(error.detalles).toEqual([{ campo: "precio", mensaje: "Debe ser un entero." }]);
    expect(error).not.toHaveProperty("status");
  });

  it("ReglaDeNegocioError lleva el código de la regla y su mensaje, sin status", () => {
    const error = new ReglaDeNegocioError("CUPO_INSUFICIENTE", "No quedan entradas suficientes.");
    expect(error).toBeInstanceOf(ErrorDeDominio);
    expect(error).toMatchObject({ codigo: "CUPO_INSUFICIENTE", message: "No quedan entradas suficientes." });
    expect(error).not.toHaveProperty("status");
  });
});
