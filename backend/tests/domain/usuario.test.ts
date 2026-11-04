import { describe, expect, it } from "vitest";
import { compararPorApellidoYNombre, type Usuario } from "../../src/domain/usuario";

const usuario = (nombre: string, apellido: string): Usuario => ({
  id: `${nombre}-${apellido}`,
  nombre,
  apellido,
  favoritos: [],
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
