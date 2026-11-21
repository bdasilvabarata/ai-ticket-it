import type { Evento } from "../domain/evento";
import type { RepositorioResenias } from "../domain/repositorios";
import { calcularPuntaje, puntajesPorOrganizador, type Puntaje } from "../domain/resenia";

/**
 * Casos de uso de reseñas (mínimo de la 005): el puntaje de los organizadores. Las reseñas son
 * otro agregado, así que `EventoService` le pide los puntajes acá (constitución 2.2.0, principio
 * III). Recibe los eventos por parámetro y depende solo de su repositorio: no conoce a
 * `EventoService` (sin ciclo). La 012 le suma el alta.
 */
export class ReseniaService {
  readonly #resenias: RepositorioResenias;

  constructor({ resenias }: { resenias: RepositorioResenias }) {
    this.#resenias = resenias;
  }

  /**
   * Búsqueda en lote (sin N+1): el puntaje de **todos** los organizadores de `eventos`, con una
   * sola lectura; los que no tienen reseñas, sin puntaje.
   */
  async puntajesPorOrganizador(eventos: readonly Evento[]): Promise<Map<string, Puntaje>> {
    const resenias = await this.#resenias.listarPorEventos(eventos.map((e) => e.id));
    const conResenias = puntajesPorOrganizador(eventos, resenias);
    return new Map(
      eventos.map((e) => [e.organizadorId, conResenias.get(e.organizadorId) ?? calcularPuntaje([])]),
    );
  }

  /** El puntaje de las reseñas de esos eventos (los de un organizador: el detalle). */
  async puntajeDe(eventosDelOrganizador: readonly Evento[]): Promise<Puntaje> {
    const resenias = await this.#resenias.listarPorEventos(eventosDelOrganizador.map((e) => e.id));
    return calcularPuntaje(resenias.map((r) => r.puntuacion));
  }
}
