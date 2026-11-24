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

  it("carga las compras de ejemplo", async () => {
    const { compras } = crearRepositoriosDeEjemplo(ahora);
    expect(await compras.existePorEvento("evento-festival-sonidos-del-sur")).toBe(true);
    expect(await compras.existePorTipoEntrada("tipo-festival-sonidos-del-sur-general")).toBe(true);
    expect(await compras.existePorTipoEntrada("tipo-festival-sonidos-del-sur-backstage")).toBe(false);
    expect(await compras.existePorEvento("evento-noche-de-rock")).toBe(false);
    // Feature 009 (R11): la cancelada de Diego y la reembolsada de Valentina sobre el Maratón.
    expect((await compras.listarPorEvento("evento-maraton-10k")).map((c) => c.id).toSorted()).toEqual([
      "compra-diego-maraton-inscripcion",
      "compra-valentina-maraton-inscripcion",
    ]);
  });

  it("carga las reseñas de ejemplo (feature 012, R10)", async () => {
    const { resenias } = crearRepositoriosDeEjemplo(ahora);
    const esperados = crearDatosEjemplo(ahora);
    const ids = esperados.eventos.map((e) => e.id);
    expect((await resenias.listarPorEventos(ids)).map((r) => r.id).toSorted()).toEqual(
      esperados.resenias.map((r) => r.id).toSorted(),
    );
    expect(await resenias.listarPorComprador("usuario-martin")).toEqual([]);
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
    expect(segundo.compras).not.toBe(primero.compras);
    expect(segundo.resenias).not.toBe(primero.resenias);
  });
});
