import type { UsuarioVista } from "@ai-ticket-it/shared";
import type { RepositorioEventos, RepositorioUsuarios } from "../domain/repositorios";
import { compararPorApellidoYNombre, type Usuario } from "../domain/usuario";
import { NoEncontradoError } from "../errors/index";

function aVista(usuario: Usuario, cantidadEventosOrganizados: number): UsuarioVista {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    cantidadEventosOrganizados,
  };
}

/** Casos de uso de usuarios. Recibe sus repositorios por constructor (principio III). */
export class UsuarioService {
  readonly #usuarios: RepositorioUsuarios;
  readonly #eventos: RepositorioEventos;

  constructor({ usuarios, eventos }: { usuarios: RepositorioUsuarios; eventos: RepositorioEventos }) {
    this.#usuarios = usuarios;
    this.#eventos = eventos;
  }

  async listar(): Promise<UsuarioVista[]> {
    const usuarios = await this.#usuarios.listar();
    const cantidades = await this.#eventos.contarPorOrganizador(usuarios.map((u) => u.id));
    return usuarios
      .toSorted(compararPorApellidoYNombre)
      .map((usuario) => aVista(usuario, cantidades.get(usuario.id) ?? 0));
  }

  /** Vista del usuario; 404 si no existe. */
  async obtener(id: string): Promise<UsuarioVista> {
    const usuario = await this.#obtenerOFallar(id);
    const cantidades = await this.#eventos.contarPorOrganizador([id]);
    return aVista(usuario, cantidades.get(id) ?? 0);
  }

  /** La entidad o `null`, sin lanzar: lo usa la identificación de usuario (401, no 404). */
  buscarPorId(id: string): Promise<Usuario | null> {
    return this.#usuarios.buscarPorId(id);
  }

  /** Único lugar del service que busca por id y lanza 404 si no existe. */
  async #obtenerOFallar(id: string): Promise<Usuario> {
    const usuario = await this.#usuarios.buscarPorId(id);
    if (!usuario) throw new NoEncontradoError("USUARIO_NO_ENCONTRADO", "No existe el usuario.");
    return usuario;
  }
}
