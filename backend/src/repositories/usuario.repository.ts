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

  async listarPorIds(ids: readonly string[]): Promise<Usuario[]> {
    return [...new Set(ids)].flatMap((id) => this.#usuarios.get(id) ?? []);
  }

  async listarPorFavorito(eventoId: string): Promise<Usuario[]> {
    return [...this.#usuarios.values()].filter((usuario) => usuario.tieneFavorito(eventoId));
  }

  async guardar(usuario: Usuario): Promise<void> {
    this.#usuarios.set(usuario.id, usuario);
  }
}
