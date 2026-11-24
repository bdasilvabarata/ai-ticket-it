import type { Categoria } from "../domain/categoria";
import type { RepositorioCategorias } from "../domain/repositorios";

/** Categorías en memoria (constitución, principio IV). Las expone por HTTP la feature 004 (`GET /api/categorias`). */
export class CategoriaRepository implements RepositorioCategorias {
  readonly #categorias: Map<string, Categoria>;

  constructor(categorias: Categoria[] = []) {
    this.#categorias = new Map(categorias.map((categoria) => [categoria.id, categoria]));
  }

  async listar(): Promise<Categoria[]> {
    return [...this.#categorias.values()];
  }

  async buscarPorId(id: string): Promise<Categoria | null> {
    return this.#categorias.get(id) ?? null;
  }

  async listarPorIds(ids: readonly string[]): Promise<Categoria[]> {
    return [...new Set(ids)].flatMap((id) => this.#categorias.get(id) ?? []);
  }
}
