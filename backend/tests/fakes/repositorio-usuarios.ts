import type { RepositorioUsuarios } from "../../src/domain/repositorios";
import type { Usuario } from "../../src/domain/usuario";

/**
 * Repositorio de usuarios en memoria para tests de services. Estado por instancia (cada test
 * crea el suyo: nada compartido entre tests). Su comportamiento lo verifica el test de
 * contrato contra el repositorio de Mongo (tests/api/repositorios.contrato.test.ts).
 */
export class RepositorioUsuariosEnMemoria implements RepositorioUsuarios {
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
