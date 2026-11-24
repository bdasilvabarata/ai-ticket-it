import { randomUUID } from "node:crypto";
import type { RepositorioResenias } from "../domain/repositorios";
import type { Resenia } from "../domain/resenia";

/**
 * Reseñas en memoria (constitución, principio IV), en un `Map` privado por id. Sin baja: una reseña
 * no se edita ni se borra (FR-006b). Que haya una por comprador y evento lo garantiza el service
 * bajo el cerrojo del evento.
 */
export class ReseniaRepository implements RepositorioResenias {
  readonly #resenias: Map<string, Resenia>;

  constructor(resenias: Resenia[] = []) {
    this.#resenias = new Map(resenias.map((resenia) => [resenia.id, resenia]));
  }

  siguienteId(): string {
    return randomUUID();
  }

  async listarPorEventos(eventoIds: readonly string[]): Promise<Resenia[]> {
    const buscados = new Set(eventoIds);
    return [...this.#resenias.values()].filter((resenia) => buscados.has(resenia.eventoId));
  }

  async buscarPorEventoYComprador(eventoId: string, compradorId: string): Promise<Resenia | null> {
    for (const resenia of this.#resenias.values()) {
      if (resenia.eventoId === eventoId && resenia.compradorId === compradorId) return resenia;
    }
    return null;
  }

  async listarPorComprador(compradorId: string): Promise<Resenia[]> {
    return [...this.#resenias.values()].filter((resenia) => resenia.compradorId === compradorId);
  }

  async guardar(resenia: Resenia): Promise<void> {
    this.#resenias.set(resenia.id, resenia);
  }
}
