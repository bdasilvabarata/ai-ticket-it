import type { CategoriaVista } from "@ai-ticket-it/shared";
import type { RepositorioCategorias } from "../domain/repositorios";

const comparador = new Intl.Collator("es", { sensitivity: "base" });

/** Catálogo de categorías (solo lectura). */
export class CategoriaService {
  readonly #categorias: RepositorioCategorias;

  constructor({ categorias }: { categorias: RepositorioCategorias }) {
    this.#categorias = categorias;
  }

  /** Por nombre, sin distinguir mayúsculas ni tildes. */
  async listar(): Promise<CategoriaVista[]> {
    return (await this.#categorias.listar())
      .toSorted((a, b) => comparador.compare(a.nombre, b.nombre))
      .map(({ id, nombre, descripcion }) => ({ id, nombre, descripcion }));
  }
}
