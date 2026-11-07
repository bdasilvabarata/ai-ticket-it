import type { RepositorioUsuarios } from "../domain/repositorios";
import type { Usuario } from "../domain/usuario";

/** Usuarios en memoria (constitución, principio IV). */
export class UsuarioRepository implements RepositorioUsuarios {
  readonly #usuarios: Map<string, Usuario>;

  constructor(usuarios: Usuario[] = []) {
    this.#usuarios = new Map(usuarios.map((usuario) => [usuario.id, usuario]));
  }

  async listar(): Promise<Usuario[]> {
    return [...this.#usuarios.values()];
  }

  async buscarPorId(id: string): Promise<Usuario | null> {
    return this.#usuarios.get(id) ?? null;
  }
}
