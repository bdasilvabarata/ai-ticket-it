import type { Evento } from "../domain/evento";
import type { RepositorioEventos } from "../domain/repositorios";

/**
 * Eventos en memoria, con sus tipos de entrada adentro (constitución, principio IV). Lo amplían
 * 003 (crear) y 004 (explorar). Las operaciones que toquen el cupo deben cumplir la regla de
 * cupo atómico: verificar y guardar sin `await` en el medio.
 */
export class EventoRepository implements RepositorioEventos {
  readonly #eventos: Map<string, Evento>;

  constructor(eventos: Evento[] = []) {
    this.#eventos = new Map(eventos.map((evento) => [evento.id, evento]));
  }

  async listar(): Promise<Evento[]> {
    return [...this.#eventos.values()];
  }

  async buscarPorId(id: string): Promise<Evento | null> {
    return this.#eventos.get(id) ?? null;
  }

  async contarPorOrganizador(ids: string[]): Promise<Map<string, number>> {
    const buscados = new Set(ids);
    const cantidades = new Map<string, number>();
    for (const { organizadorId } of this.#eventos.values()) {
      if (buscados.has(organizadorId))
        cantidades.set(organizadorId, (cantidades.get(organizadorId) ?? 0) + 1);
    }
    return cantidades;
  }
}
