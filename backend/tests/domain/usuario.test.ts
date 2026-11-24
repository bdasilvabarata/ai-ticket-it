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

describe("Usuario: favoritos (feature 014)", () => {
  const conFavoritos = (...favoritos: string[]): Usuario =>
    new Usuario({ id: "u1", nombre: "Ana", apellido: "Paz", favoritos });

  it("tieneFavorito dice si el evento está entre sus favoritos", () => {
    const ana = conFavoritos("e1", "e2");
    expect(ana.tieneFavorito("e2")).toBe(true);
    expect(ana.tieneFavorito("e3")).toBe(false);
  });

  it("marcarFavorito agrega el id al final y devuelve un Usuario nuevo sin cambiar el original", () => {
    const original = conFavoritos("e1");
    const marcado = original.marcarFavorito("e2");
    expect(marcado).not.toBe(original);
    expect(marcado).toBeInstanceOf(Usuario);
    expect(marcado.favoritos).toEqual(["e1", "e2"]);
    expect(original.favoritos).toEqual(["e1"]);
    expect(marcado).toMatchObject({ id: "u1", nombre: "Ana", apellido: "Paz" });
  });

  it("marcar un evento que ya es favorito devuelve el mismo objeto", () => {
    const original = conFavoritos("e1");
    expect(original.marcarFavorito("e1")).toBe(original);
  });

  it("desmarcarFavorito lo saca y devuelve un Usuario nuevo sin cambiar el original", () => {
    const original = conFavoritos("e1", "e2", "e3");
    const desmarcado = original.desmarcarFavorito("e2");
    expect(desmarcado).not.toBe(original);
    expect(desmarcado.favoritos).toEqual(["e1", "e3"]);
    expect(original.favoritos).toEqual(["e1", "e2", "e3"]);
    expect(desmarcado).toMatchObject({ id: "u1", nombre: "Ana", apellido: "Paz" });
  });

  it("desmarcar un evento que no es favorito devuelve el mismo objeto", () => {
    const original = conFavoritos("e1");
    expect(original.desmarcarFavorito("e9")).toBe(original);
  });

  it("rechaza favoritos repetidos con un detalle sobre favoritos", () => {
    let error: unknown;
    try {
      conFavoritos("e1", "e2", "e1");
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(DatosInvalidosError);
    expect((error as DatosInvalidosError).detalles).toEqual([
      { campo: "favoritos", mensaje: "No puede repetir eventos." },
    ]);
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
