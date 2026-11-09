import { describe, expect, it } from "vitest";
import { Categoria } from "../../src/domain/categoria";
import { compararPorApellidoYNombre, Usuario } from "../../src/domain/usuario";
import { DatosInvalidosError } from "../../src/domain/errores";

const usuario = (nombre: string, apellido: string): Usuario =>
  new Usuario({ id: `${nombre}-${apellido}`, nombre, apellido, favoritos: [] });

describe("Usuario", () => {
  it("se crea con datos válidos y recorta nombre y apellido", () => {
    const ana = new Usuario({ id: "u1", nombre: "  Ana ", apellido: " Paz  ", favoritos: [] });
    expect(ana).toMatchObject({ id: "u1", nombre: "Ana", apellido: "Paz", favoritos: [] });
  });

  it("rechaza nombre o apellido vacíos", () => {
    expect(() => new Usuario({ id: "u1", nombre: " ", apellido: "Paz", favoritos: [] })).toThrow(
      DatosInvalidosError,
    );
    expect(() => new Usuario({ id: "u1", nombre: "Ana", apellido: "", favoritos: [] })).toThrow(
      DatosInvalidosError,
    );
  });
});

describe("Categoria", () => {
  it("rechaza un nombre vacío", () => {
    expect(() => new Categoria({ id: "c1", nombre: "", descripcion: "x" })).toThrow(DatosInvalidosError);
  });
});

describe("compararPorApellidoYNombre", () => {
  it("ordena por apellido con tildes en su lugar alfabético", () => {
    const ordenados = [usuario("Martín", "Benítez"), usuario("Lucía", "Álvarez")].toSorted(
      compararPorApellidoYNombre,
    );
    expect(ordenados.map((u) => u.apellido)).toEqual(["Álvarez", "Benítez"]);
  });

  it("no distingue mayúsculas ni tildes en el apellido", () => {
    expect(compararPorApellidoYNombre(usuario("Ana", "alvarez"), usuario("Ana", "Álvarez"))).toBe(0);
  });

  it("con igual apellido decide el nombre", () => {
    expect(
      compararPorApellidoYNombre(usuario("Bruno", "Álvarez"), usuario("Ana", "alvarez")),
    ).toBeGreaterThan(0);
  });

  it("no muta el arreglo original con toSorted", () => {
    const original = [usuario("Martín", "Benítez"), usuario("Lucía", "Álvarez")];
    const copia = [...original];
    original.toSorted(compararPorApellidoYNombre);
    expect(original).toEqual(copia);
  });
});
