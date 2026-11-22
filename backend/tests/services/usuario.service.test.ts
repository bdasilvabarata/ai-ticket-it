import { describe, expect, it, vi } from "vitest";
import { Evento, TipoEntrada } from "../../src/domain/evento";
import { Usuario } from "../../src/domain/usuario";
import { NoEncontradoError } from "../../src/errors/index";
import { CerrojoPorClave } from "../../src/services/cerrojo-por-clave";
import { UsuarioService } from "../../src/services/usuario.service";
import { EventoRepository } from "../../src/repositories/evento.repository";
import { UsuarioRepository } from "../../src/repositories/usuario.repository";

// Sin servidor: el service recibe los repositorios en memoria de producción, construidos con
// las entidades de cada caso.
const lucia = new Usuario({ id: "u1", nombre: "Lucía", apellido: "Álvarez", favoritos: [] });
const martin = new Usuario({ id: "u2", nombre: "Martín", apellido: "Benítez", favoritos: [] });
const diego = new Usuario({ id: "u3", nombre: "Diego", apellido: "Fernández", favoritos: [] });

let numeroEvento = 0;
function eventoDe(organizadorId: string): Evento {
  numeroEvento += 1;
  return new Evento({
    id: `e${numeroEvento}`,
    nombre: `Evento ${numeroEvento}`,
    descripcion: "Descripción.",
    categoriaId: "c1",
    fechaHora: new Date("2026-12-01T00:00:00Z"),
    multimedia: [],
    organizadorId,
    tiposEntrada: [
      new TipoEntrada({ id: `t${numeroEvento}`, nombre: "General", descripcion: "", precio: 1000, cupo: 10 }),
    ],
  });
}

function crearService(usuarios: Usuario[], eventos: Evento[] = []) {
  const repositorioEventos = new EventoRepository(eventos);
  const repositorioUsuarios = new UsuarioRepository(usuarios);
  const cerrojo = new CerrojoPorClave();
  const service = new UsuarioService({
    usuarios: repositorioUsuarios,
    eventos: repositorioEventos,
    cerrojo,
  });
  return { service, repositorioEventos, repositorioUsuarios, cerrojo };
}

describe("UsuarioService.listar", () => {
  it("ordena por apellido y arma la vista con la cantidad de eventos (0 si no organiza)", async () => {
    const { service } = crearService(
      [diego, martin, lucia],
      [eventoDe("u1"), eventoDe("u1"), eventoDe("u1"), eventoDe("u2")],
    );
    expect(await service.listar()).toEqual([
      { id: "u1", nombre: "Lucía", apellido: "Álvarez", cantidadEventosOrganizados: 3 },
      { id: "u2", nombre: "Martín", apellido: "Benítez", cantidadEventosOrganizados: 1 },
      { id: "u3", nombre: "Diego", apellido: "Fernández", cantidadEventosOrganizados: 0 },
    ]);
  });

  it("cuenta los eventos de todos los usuarios en una sola consulta (sin N+1)", async () => {
    const { service, repositorioEventos } = crearService([lucia, martin, diego]);
    const espia = vi.spyOn(repositorioEventos, "contarPorOrganizador");
    await service.listar();
    expect(espia).toHaveBeenCalledTimes(1);
    expect(espia).toHaveBeenCalledWith(["u1", "u2", "u3"]);
  });

  it("la vista no expone los favoritos", async () => {
    const { service } = crearService([lucia]);
    const [vista] = await service.listar();
    expect(vista).not.toHaveProperty("favoritos");
  });
});

describe("UsuarioService.obtener", () => {
  it("devuelve la vista del usuario", async () => {
    const { service } = crearService([lucia], [eventoDe("u1")]);
    expect(await service.obtener("u1")).toEqual({
      id: "u1",
      nombre: "Lucía",
      apellido: "Álvarez",
      cantidadEventosOrganizados: 1,
    });
  });

  it("lanza 404 USUARIO_NO_ENCONTRADO si no existe", async () => {
    const { service } = crearService([lucia]);
    await expect(service.obtener("u9")).rejects.toMatchObject({
      constructor: NoEncontradoError,
      codigo: "USUARIO_NO_ENCONTRADO",
    });
  });
});

describe("UsuarioService.buscarPorId", () => {
  it("devuelve la entidad o null (no lanza): lo usa la identificación de usuario", async () => {
    const { service } = crearService([lucia]);
    expect(await service.buscarPorId("u1")).toBe(lucia);
    expect(await service.buscarPorId("u9")).toBeNull();
  });
});

describe("UsuarioService.obtenerOFallar", () => {
  it("devuelve la entidad o lanza 404 USUARIO_NO_ENCONTRADO", async () => {
    const { service } = crearService([lucia]);
    expect(await service.obtenerOFallar("u1")).toBe(lucia);
    await expect(service.obtenerOFallar("u9")).rejects.toMatchObject({
      constructor: NoEncontradoError,
      codigo: "USUARIO_NO_ENCONTRADO",
    });
  });
});

describe("UsuarioService.obtenerPorIds", () => {
  it("devuelve los usuarios por id, en una sola lectura, aunque los ids se repitan", async () => {
    const repositorio = new UsuarioRepository([lucia, martin, diego]);
    const lecturas = vi.spyOn(repositorio, "listarPorIds");
    const service = new UsuarioService({
      usuarios: repositorio,
      eventos: new EventoRepository(),
      cerrojo: new CerrojoPorClave(),
    });
    const porId = await service.obtenerPorIds(["u2", "u1", "u2"]);
    expect([...porId]).toEqual([
      ["u2", martin],
      ["u1", lucia],
    ]);
    expect(lecturas).toHaveBeenCalledTimes(1);
  });

  it("sin ids devuelve un Map vacío", async () => {
    const { service } = crearService([lucia]);
    expect((await service.obtenerPorIds([])).size).toBe(0);
  });

  it("si falta alguno lanza 404 USUARIO_NO_ENCONTRADO", async () => {
    const { service } = crearService([lucia]);
    await expect(service.obtenerPorIds(["u1", "u9"])).rejects.toMatchObject({
      constructor: NoEncontradoError,
      codigo: "USUARIO_NO_ENCONTRADO",
    });
  });
});

describe("UsuarioService.marcarFavorito (feature 014)", () => {
  const conFavoritos = new Usuario({ id: "u1", nombre: "Lucía", apellido: "Álvarez", favoritos: ["e1"] });

  it("guarda el usuario con el evento al final", async () => {
    const { service, repositorioUsuarios } = crearService([conFavoritos]);
    await service.marcarFavorito("u1", "e2");
    expect((await repositorioUsuarios.buscarPorId("u1"))?.favoritos).toEqual(["e1", "e2"]);
  });

  it("si ya lo tenía no guarda (idempotente)", async () => {
    const { service, repositorioUsuarios } = crearService([conFavoritos]);
    const guardar = vi.spyOn(repositorioUsuarios, "guardar");
    await service.marcarFavorito("u1", "e1");
    expect(guardar).not.toHaveBeenCalled();
    expect((await repositorioUsuarios.buscarPorId("u1"))?.favoritos).toEqual(["e1"]);
  });

  it("un usuario inexistente lanza 404 USUARIO_NO_ENCONTRADO", async () => {
    const { service } = crearService([conFavoritos]);
    await expect(service.marcarFavorito("u9", "e1")).rejects.toMatchObject({
      constructor: NoEncontradoError,
      codigo: "USUARIO_NO_ENCONTRADO",
    });
  });

  it("corre bajo el cerrojo con la clave usuario:<id> y relee el usuario adentro", async () => {
    const { service, repositorioUsuarios, cerrojo } = crearService([conFavoritos]);
    const orden: string[] = [];
    const ejecutar = cerrojo.ejecutar.bind(cerrojo);
    const espiaCerrojo = vi.spyOn(cerrojo, "ejecutar").mockImplementation((clave, operacion) => {
      orden.push(`cerrojo:${clave}`);
      return ejecutar(clave, async () => {
        orden.push("adentro");
        return operacion();
      });
    });
    const buscarPorId = repositorioUsuarios.buscarPorId.bind(repositorioUsuarios);
    vi.spyOn(repositorioUsuarios, "buscarPorId").mockImplementation((id) => {
      orden.push(`leer:${id}`);
      return buscarPorId(id);
    });
    await service.marcarFavorito("u1", "e2");
    expect(espiaCerrojo).toHaveBeenCalledWith("usuario:u1", expect.any(Function));
    expect(orden).toEqual(["cerrojo:usuario:u1", "adentro", "leer:u1"]);
  });

  it("dos marcas concurrentes del mismo usuario sobre eventos distintos conservan las dos", async () => {
    const { service, repositorioUsuarios } = crearService([conFavoritos]);
    const buscarPorId = repositorioUsuarios.buscarPorId.bind(repositorioUsuarios);
    // Cede el turno entre leer y guardar: sin cerrojo, la segunda pisaría a la primera.
    vi.spyOn(repositorioUsuarios, "buscarPorId").mockImplementation(async (id) => {
      const usuario = await buscarPorId(id);
      await new Promise((resolver) => setTimeout(resolver, 0));
      return usuario;
    });
    await Promise.all([service.marcarFavorito("u1", "e2"), service.marcarFavorito("u1", "e3")]);
    expect((await buscarPorId("u1"))?.favoritos).toEqual(["e1", "e2", "e3"]);
  });
});

describe("UsuarioService.desmarcarFavorito (feature 014)", () => {
  const conFavoritos = new Usuario({
    id: "u1",
    nombre: "Lucía",
    apellido: "Álvarez",
    favoritos: ["e1", "e2"],
  });

  it("guarda el usuario sin el evento", async () => {
    const { service, repositorioUsuarios } = crearService([conFavoritos]);
    await service.desmarcarFavorito("u1", "e1");
    expect((await repositorioUsuarios.buscarPorId("u1"))?.favoritos).toEqual(["e2"]);
  });

  it("si no lo tenía no guarda (idempotente)", async () => {
    const { service, repositorioUsuarios } = crearService([conFavoritos]);
    const guardar = vi.spyOn(repositorioUsuarios, "guardar");
    await service.desmarcarFavorito("u1", "e9");
    expect(guardar).not.toHaveBeenCalled();
  });

  it("corre bajo el cerrojo con la clave usuario:<id>", async () => {
    const { service, cerrojo } = crearService([conFavoritos]);
    const espiaCerrojo = vi.spyOn(cerrojo, "ejecutar");
    await service.desmarcarFavorito("u1", "e1");
    expect(espiaCerrojo).toHaveBeenCalledWith("usuario:u1", expect.any(Function));
  });

  it("un usuario inexistente lanza 404 USUARIO_NO_ENCONTRADO", async () => {
    const { service } = crearService([conFavoritos]);
    await expect(service.desmarcarFavorito("u9", "e1")).rejects.toMatchObject({
      codigo: "USUARIO_NO_ENCONTRADO",
    });
  });
});
