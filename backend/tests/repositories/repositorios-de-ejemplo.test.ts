import { describe, expect, it } from "vitest";
import { crearDatosEjemplo } from "../../src/seed/datos-ejemplo";
import { crearRepositoriosDeEjemplo } from "../../src/seed/repositorios-de-ejemplo";

const ahora = new Date("2026-11-07T15:00:00Z");

describe("crearRepositoriosDeEjemplo", () => {
  it("carga 6 categorías, 5 usuarios y 8 eventos con los ids de los datos de ejemplo", async () => {
    const repositorios = crearRepositoriosDeEjemplo(ahora);
    const esperados = crearDatosEjemplo(ahora);
    expect((await repositorios.categorias.listar()).map((c) => c.id)).toEqual(
      esperados.categorias.map((c) => c.id),
    );
    expect((await repositorios.usuarios.listar()).map((u) => u.id)).toEqual(
      esperados.usuarios.map((u) => u.id),
    );
    expect((await repositorios.eventos.listar()).map((e) => e.id)).toEqual(
      esperados.eventos.map((e) => e.id),
    );
  });

  it("es determinista: dos llamadas con el mismo instante dan los mismos datos", async () => {
    const primero = crearRepositoriosDeEjemplo(ahora);
    const segundo = crearRepositoriosDeEjemplo(ahora);
    expect(await segundo.eventos.listar()).toEqual(await primero.eventos.listar());
  });

  it("cada llamada crea repositorios independientes (sin estado compartido)", () => {
    const primero = crearRepositoriosDeEjemplo(ahora);
    const segundo = crearRepositoriosDeEjemplo(ahora);
    expect(segundo.usuarios).not.toBe(primero.usuarios);
    expect(segundo.eventos).not.toBe(primero.eventos);
  });
});
