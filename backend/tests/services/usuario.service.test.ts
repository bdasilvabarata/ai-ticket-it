import { describe, expect, it, vi } from "vitest";
import { Evento, TipoEntrada } from "../../src/domain/evento";
import { Usuario } from "../../src/domain/usuario";
import { NoEncontradoError } from "../../src/errors/index";
import { UsuarioService } from "../../src/services/usuario.service";
import { RepositorioEventosEnMemoria } from "../fakes/repositorio-eventos";
import { RepositorioUsuariosEnMemoria } from "../fakes/repositorio-usuarios";

// Sin base de datos: el service recibe los repositorios en memoria de tests/fakes/
// (verificados contra Mongo por tests/api/repositorios.contrato.test.ts).
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
  const repositorioEventos = new RepositorioEventosEnMemoria(eventos);
  const service = new UsuarioService({
    usuarios: new RepositorioUsuariosEnMemoria(usuarios),
    eventos: repositorioEventos,
  });
  return { service, repositorioEventos };
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
      status: 404,
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
