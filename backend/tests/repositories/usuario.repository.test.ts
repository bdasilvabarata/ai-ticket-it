import { describe, expect, it } from "vitest";
import { Usuario } from "../../src/domain/usuario";
import { UsuarioRepository } from "../../src/repositories/usuario.repository";

function usuario(id: string, favoritos: string[] = []): Usuario {
  return new Usuario({ id, nombre: "Ana", apellido: "Paz", favoritos });
}

describe("UsuarioRepository (en memoria)", () => {
  it("guardar da de alta un usuario nuevo", async () => {
    const repositorio = new UsuarioRepository();
    const ana = usuario("u1");
    await repositorio.guardar(ana);
    expect(await repositorio.buscarPorId("u1")).toBe(ana);
    expect(await repositorio.listar()).toEqual([ana]);
  });

  it("guardar reemplaza la instancia por id", async () => {
    const original = usuario("u1");
    const repositorio = new UsuarioRepository([original, usuario("u2")]);
    const marcado = original.marcarFavorito("e1");
    await repositorio.guardar(marcado);
    expect(await repositorio.buscarPorId("u1")).toBe(marcado);
    expect(await repositorio.listar()).toHaveLength(2);
  });

  it("listarPorFavorito devuelve solo los usuarios que tienen ese evento entre sus favoritos", async () => {
    const u1 = usuario("u1", ["e1", "e2"]);
    const u2 = usuario("u2", ["e2"]);
    const u3 = usuario("u3", ["e3"]);
    const repositorio = new UsuarioRepository([u1, u2, u3]);
    expect(await repositorio.listarPorFavorito("e2")).toEqual([u1, u2]);
    expect(await repositorio.listarPorFavorito("e3")).toEqual([u3]);
  });

  it("listarPorFavorito devuelve [] si nadie lo tiene", async () => {
    const repositorio = new UsuarioRepository([usuario("u1", ["e1"])]);
    expect(await repositorio.listarPorFavorito("e9")).toEqual([]);
    expect(await new UsuarioRepository().listarPorFavorito("e1")).toEqual([]);
  });

  it("listarPorFavorito ve lo guardado después", async () => {
    const repositorio = new UsuarioRepository([usuario("u1")]);
    await repositorio.guardar(usuario("u1", ["e1"]));
    expect((await repositorio.listarPorFavorito("e1")).map((u) => u.id)).toEqual(["u1"]);
  });
});
