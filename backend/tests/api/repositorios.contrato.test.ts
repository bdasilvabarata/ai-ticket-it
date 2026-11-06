import { describe, expect, it } from "vitest";
import type { RepositorioEventos, RepositorioUsuarios } from "../../src/domain/repositorios";
import { Usuario } from "../../src/domain/usuario";
import { EventoRepository } from "../../src/repositories/evento.repository";
import { UsuarioRepository } from "../../src/repositories/usuario.repository";
import { crearDatosEjemplo } from "../../src/seed/datos-ejemplo";
import { RepositorioEventosEnMemoria } from "../fakes/repositorio-eventos";
import { RepositorioUsuariosEnMemoria } from "../fakes/repositorio-usuarios";
import { usarBaseDePrueba } from "./helpers/base-de-prueba";

// Test de contrato: los mismos casos corren contra los repositorios de Mongo (con el seed
// cargado) y contra los falsos en memoria (con los mismos datos de ejemplo). Si un falso se
// desvía del comportamiento real, falla acá y no en un test de service que confía en él.
usarBaseDePrueba();

const LUCIA = "000000000000000000000101";
const DIEGO = "000000000000000000000104";
const INEXISTENTE = "0000000000000000000009ff";

const implementaciones: [string, () => { usuarios: RepositorioUsuarios; eventos: RepositorioEventos }][] = [
  ["Mongo", () => ({ usuarios: new UsuarioRepository(), eventos: new EventoRepository() })],
  [
    "en memoria",
    () => {
      const datos = crearDatosEjemplo(new Date());
      return {
        usuarios: new RepositorioUsuariosEnMemoria(datos.usuarios),
        eventos: new RepositorioEventosEnMemoria(datos.eventos),
      };
    },
  ],
];

describe.each(implementaciones)("contrato de repositorios — %s", (_nombre, crear) => {
  describe("RepositorioUsuarios", () => {
    it("listar devuelve entidades Usuario con los 5 usuarios de ejemplo", async () => {
      const usuarios = await crear().usuarios.listar();
      expect(usuarios).toHaveLength(5);
      for (const usuario of usuarios) expect(usuario).toBeInstanceOf(Usuario);
      expect(usuarios.map((u) => u.id).sort()).toContain(LUCIA);
    });

    it("buscarPorId devuelve la entidad o null si no existe", async () => {
      const { usuarios } = crear();
      const lucia = await usuarios.buscarPorId(LUCIA);
      expect(lucia).toBeInstanceOf(Usuario);
      expect(lucia).toMatchObject({ id: LUCIA, nombre: "Lucía", apellido: "Álvarez", favoritos: [] });
      expect(await usuarios.buscarPorId(INEXISTENTE)).toBeNull();
    });
  });

  describe("RepositorioEventos", () => {
    it("contarPorOrganizador cuenta pasados y futuros y omite a quien no organiza", async () => {
      const cantidades = await crear().eventos.contarPorOrganizador([LUCIA, DIEGO, INEXISTENTE]);
      expect(cantidades.get(LUCIA)).toBe(3);
      expect(cantidades.has(DIEGO)).toBe(false);
      expect(cantidades.has(INEXISTENTE)).toBe(false);
    });

    it("contarPorOrganizador con una lista vacía devuelve un Map vacío", async () => {
      expect((await crear().eventos.contarPorOrganizador([])).size).toBe(0);
    });
  });
});
