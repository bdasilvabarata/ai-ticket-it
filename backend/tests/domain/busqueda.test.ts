import { describe, expect, it } from "vitest";
import { normalizarParaBuscar, palabrasDeBusqueda } from "../../src/domain/busqueda";
import { mismoNombreDeTipo } from "../../src/domain/evento";

describe("normalizarParaBuscar", () => {
  it("ignora mayúsculas, acentos y diéresis", () => {
    expect(normalizarParaBuscar("BÁSQUET")).toBe("basquet");
    expect(normalizarParaBuscar("Pingüino")).toBe("pinguino");
  });

  it("conserva la ñ, también si llega descompuesta", () => {
    expect(normalizarParaBuscar("Año")).toBe("año");
    expect(normalizarParaBuscar("An\u0303o")).toBe("año");
  });

  it("da lo mismo con una tilde precompuesta o descompuesta", () => {
    expect(normalizarParaBuscar("Caf\u00e9")).toBe(normalizarParaBuscar("Cafe\u0301"));
    expect(normalizarParaBuscar("Caf\u00e9")).toBe("cafe");
  });
});

describe("palabrasDeBusqueda", () => {
  it("separa por uno o más espacios, normalizado y sin vacíos", () => {
    expect(palabrasDeBusqueda("  club   ROCK ")).toEqual(["club", "rock"]);
  });

  it("sin texto no hay palabras (sin filtro)", () => {
    expect(palabrasDeBusqueda("   ")).toEqual([]);
    expect(palabrasDeBusqueda("")).toEqual([]);
  });
});

describe("coherencia con mismoNombreDeTipo (R3)", () => {
  it.each([
    ["Café", "cafe"],
    ["PINGÜINO", "pinguino"],
    ["Año", "Ano"],
    ["Plátea", " PLATEA "],
    ["Música", "MUSICA"],
    ["Niño", "nino"],
    ["Vip", "vip"],
    ["General", "Generales"],
  ])("%s / %s", (a, b) => {
    expect(normalizarParaBuscar(a.trim()) === normalizarParaBuscar(b.trim())).toBe(mismoNombreDeTipo(a, b));
  });
});
