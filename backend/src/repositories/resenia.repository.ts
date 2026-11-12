import type { RepositorioResenias } from "../domain/repositorios";
import type { Resenia } from "../domain/resenia";

/** Reseñas en memoria (constitución, principio IV). Mínimo de la feature 005; lo amplía la 011. */
export class ReseniaRepository implements RepositorioResenias {
  readonly #resenias: Map<string, Resenia>;

  constructor(resenias: Resenia[] = []) {
    this.#resenias = new Map(resenias.map((resenia) => [resenia.id, resenia]));
  }

  async listarPorEventos(eventoIds: readonly string[]): Promise<Resenia[]> {
    const buscados = new Set(eventoIds);
    return [...this.#resenias.values()].filter((resenia) => buscados.has(resenia.eventoId));
  }
}
