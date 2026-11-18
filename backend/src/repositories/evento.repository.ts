import { randomUUID } from "node:crypto";
import type { Evento } from "../domain/evento";
import type { RepositorioEventos } from "../domain/repositorios";

/**
 * Eventos en memoria, con sus tipos de entrada adentro (constitución, principio IV). Lo amplían
 * 004 (crear) y 005 (explorar). Las entidades son inmutables: `guardar` reemplaza la referencia.
 * Verificar y modificar un evento ocurre bajo su cerrojo, en los services ("Operaciones atómicas
 * por evento").
 */
export class EventoRepository implements RepositorioEventos {
  readonly #eventos: Map<string, Evento>;

  constructor(eventos: Evento[] = []) {
    this.#eventos = new Map(eventos.map((evento) => [evento.id, evento]));
  }

  siguienteId(): string {
    return randomUUID();
  }

  async listar(): Promise<Evento[]> {
    return [...this.#eventos.values()];
  }

  async buscarPorId(id: string): Promise<Evento | null> {
    return this.#eventos.get(id) ?? null;
  }

  async listarPorIds(ids: readonly string[]): Promise<Evento[]> {
    return [...new Set(ids)].flatMap((id) => this.#eventos.get(id) ?? []);
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

  async listarPorOrganizador(organizadorId: string): Promise<Evento[]> {
    return [...this.#eventos.values()].filter((evento) => evento.organizadorId === organizadorId);
  }

  async guardar(evento: Evento): Promise<void> {
    this.#eventos.set(evento.id, evento);
  }

  async eliminarPorId(id: string): Promise<void> {
    this.#eventos.delete(id);
  }
}
