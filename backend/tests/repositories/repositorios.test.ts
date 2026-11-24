import { describe, expect, it } from "vitest";
import { Categoria } from "../../src/domain/categoria";
import { Evento, TipoEntrada } from "../../src/domain/evento";
import { Usuario } from "../../src/domain/usuario";
import { CategoriaRepository } from "../../src/repositories/categoria.repository";
import { EventoRepository } from "../../src/repositories/evento.repository";
import { UsuarioRepository } from "../../src/repositories/usuario.repository";

const lucia = new Usuario({ id: "usuario-lucia", nombre: "Lucía", apellido: "Álvarez", favoritos: [] });
const diego = new Usuario({ id: "usuario-diego", nombre: "Diego", apellido: "Fernández", favoritos: [] });

let numero = 0;
function eventoDe(organizadorId: string): Evento {
  numero += 1;
  return new Evento({
    id: `evento-${numero}`,
    nombre: `Evento ${numero}`,
    descripcion: "",
    categoriaId: "categoria-musica",
    fechaHora: new Date("2026-12-01T00:00:00Z"),
    multimedia: [],
    organizadorId,
    tiposEntrada: [
      new TipoEntrada({ id: `tipo-${numero}`, nombre: "General", descripcion: "", precio: 0, cupo: 1 }),
    ],
  });
}

describe("UsuarioRepository (en memoria)", () => {
  it("listar devuelve las entidades con las que se construyó", async () => {
    expect(await new UsuarioRepository([lucia, diego]).listar()).toEqual([lucia, diego]);
    expect(await new UsuarioRepository().listar()).toEqual([]);
  });

  it("buscarPorId devuelve la entidad o null (no lanza)", async () => {
    const repositorio = new UsuarioRepository([lucia]);
    expect(await repositorio.buscarPorId("usuario-lucia")).toBe(lucia);
    expect(await repositorio.buscarPorId("usuario-inexistente")).toBeNull();
  });

  it("listarPorIds devuelve los que existen, sin repetir, o []", async () => {
    const repositorio = new UsuarioRepository([lucia, diego]);
    expect(await repositorio.listarPorIds(["usuario-diego", "usuario-inexistente", "usuario-diego"])).toEqual(
      [diego],
    );
    expect(await repositorio.listarPorIds([])).toEqual([]);
  });

  it("no expone su colección interna: modificar lo devuelto no cambia el repositorio", async () => {
    const repositorio = new UsuarioRepository([lucia]);
    const lista = await repositorio.listar();
    lista.push(diego);
    expect(await repositorio.listar()).toEqual([lucia]);
  });

  it("cada instancia tiene su propio estado", async () => {
    const iniciales = [lucia];
    const repositorio = new UsuarioRepository(iniciales);
    iniciales.push(diego);
    expect(await repositorio.listar()).toEqual([lucia]);
  });
});

describe("CategoriaRepository (en memoria)", () => {
  const musica = new Categoria({ id: "categoria-musica", nombre: "Música", descripcion: "" });

  it("lista y busca por id", async () => {
    const repositorio = new CategoriaRepository([musica]);
    expect(await repositorio.listar()).toEqual([musica]);
    expect(await repositorio.buscarPorId("categoria-musica")).toBe(musica);
    expect(await repositorio.buscarPorId("categoria-teatro")).toBeNull();
  });

  it("listarPorIds devuelve las que existen, sin repetir, o []", async () => {
    const repositorio = new CategoriaRepository([musica]);
    expect(
      await repositorio.listarPorIds(["categoria-musica", "categoria-teatro", "categoria-musica"]),
    ).toEqual([musica]);
    expect(await repositorio.listarPorIds([])).toEqual([]);
  });
});

describe("EventoRepository (en memoria)", () => {
  it("lista y busca por id", async () => {
    const evento = eventoDe("usuario-lucia");
    const repositorio = new EventoRepository([evento]);
    expect(await repositorio.listar()).toEqual([evento]);
    expect(await repositorio.buscarPorId(evento.id)).toBe(evento);
    expect(await repositorio.buscarPorId("evento-inexistente")).toBeNull();
  });

  it("contarPorOrganizador cuenta todos sus eventos y omite a quien no organiza", async () => {
    const repositorio = new EventoRepository([
      eventoDe("usuario-lucia"),
      eventoDe("usuario-lucia"),
      eventoDe("usuario-martin"),
    ]);
    const cantidades = await repositorio.contarPorOrganizador(["usuario-lucia", "usuario-diego"]);
    expect(cantidades.get("usuario-lucia")).toBe(2);
    expect(cantidades.has("usuario-diego")).toBe(false);
    expect(cantidades.has("usuario-martin")).toBe(false);
  });

  it("contarPorOrganizador con una lista vacía devuelve un Map vacío", async () => {
    expect((await new EventoRepository([eventoDe("usuario-lucia")]).contarPorOrganizador([])).size).toBe(0);
  });
});
