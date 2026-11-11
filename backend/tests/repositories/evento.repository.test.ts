import { describe, expect, it } from "vitest";
import { Evento, TipoEntrada } from "../../src/domain/evento";
import { EventoRepository } from "../../src/repositories/evento.repository";

function evento(id: string, organizadorId: string, nombre = `Evento ${id}`): Evento {
  return new Evento({
    id,
    nombre,
    descripcion: "",
    categoriaId: "categoria-musica",
    fechaHora: new Date("2026-12-01T23:00:00Z"),
    multimedia: [],
    organizadorId,
    tiposEntrada: [
      new TipoEntrada({ id: `tipo-${id}`, nombre: "General", descripcion: "", precio: 0, cupo: 1 }),
    ],
  });
}

describe("EventoRepository: escrituras y listarPorOrganizador", () => {
  it("listarPorOrganizador devuelve solo los del organizador, o []", async () => {
    const a = evento("evento-a", "usuario-lucia");
    const b = evento("evento-b", "usuario-martin");
    const c = evento("evento-c", "usuario-lucia");
    const repositorio = new EventoRepository([a, b, c]);
    expect(await repositorio.listarPorOrganizador("usuario-lucia")).toEqual([a, c]);
    expect(await repositorio.listarPorOrganizador("usuario-diego")).toEqual([]);
  });

  it("guardar agrega un evento nuevo", async () => {
    const repositorio = new EventoRepository();
    const nuevo = evento("evento-nuevo", "usuario-lucia");
    await repositorio.guardar(nuevo);
    expect(await repositorio.buscarPorId("evento-nuevo")).toBe(nuevo);
  });

  it("guardar reemplaza el evento con el mismo id", async () => {
    const original = evento("evento-a", "usuario-lucia", "Original");
    const repositorio = new EventoRepository([original]);
    const editado = evento("evento-a", "usuario-lucia", "Editado");
    await repositorio.guardar(editado);
    expect(await repositorio.buscarPorId("evento-a")).toBe(editado);
    expect(await repositorio.listar()).toHaveLength(1);
    expect(original.nombre).toBe("Original");
  });

  it("eliminarPorId quita el evento", async () => {
    const repositorio = new EventoRepository([evento("evento-a", "usuario-lucia")]);
    await repositorio.eliminarPorId("evento-a");
    expect(await repositorio.buscarPorId("evento-a")).toBeNull();
    expect(await repositorio.listar()).toEqual([]);
  });

  it("dos instancias no comparten estado", async () => {
    const iniciales = [evento("evento-a", "usuario-lucia")];
    const primero = new EventoRepository(iniciales);
    const segundo = new EventoRepository(iniciales);
    await primero.eliminarPorId("evento-a");
    await primero.guardar(evento("evento-b", "usuario-lucia"));
    expect((await segundo.listar()).map((e) => e.id)).toEqual(["evento-a"]);
  });
});

describe("EventoRepository.siguienteId", () => {
  it("devuelve un UUID distinto en cada llamada", () => {
    const repositorio = new EventoRepository();
    const [a, b] = [repositorio.siguienteId(), repositorio.siguienteId()];
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});
