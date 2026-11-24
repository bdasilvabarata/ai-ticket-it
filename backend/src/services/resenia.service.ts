import type { Evento } from "../domain/evento";
import type { RepositorioResenias } from "../domain/repositorios";
import {
  calcularPuntaje,
  compararResenias,
  exigirQueNoReseniO,
  puntajesPorOrganizador,
  Resenia,
  type Puntaje,
} from "../domain/resenia";

/**
 * Casos de uso de reseñas, dueño del agregado `Resenia`: el puntaje de los organizadores (005), el
 * alta y las lecturas de la 012. Las reseñas son otro agregado, así que `EventoService` y
 * `CompraService` le piden acá lo que necesitan (constitución 2.2.0, principio III). Recibe los
 * eventos por parámetro y depende solo de su repositorio: no conoce a otros services (sin ciclos).
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

  /**
   * El alta (R2): se usa **dentro del cerrojo del evento del que llama** (`CompraService.reseniar`),
   * sin tomarlo, así la búsqueda de una previa y el guardado no se intercalan con otro pedido. Lanza
   * `RESENIA_REPETIDA` si ya la hay; si no, guarda **una** reseña y la devuelve.
   */
  async registrar(
    datos: { eventoId: string; compradorId: string; puntuacion: number; comentario: string | null },
    ahora: Date,
  ): Promise<Resenia> {
    exigirQueNoReseniO(await this.#resenias.buscarPorEventoYComprador(datos.eventoId, datos.compradorId));
    const resenia = Resenia.crear({ ...datos, id: this.#resenias.siguienteId() }, ahora);
    await this.#resenias.guardar(resenia);
    return resenia;
  }

  /** La reseña de ese comprador a ese evento, o `null` (una lectura): "Tu compra". */
  async deCompradorEnEvento(compradorId: string, eventoId: string): Promise<Resenia | null> {
    return this.#resenias.buscarPorEventoYComprador(eventoId, compradorId);
  }

  /** Búsqueda en lote (sin N+1): las reseñas de ese autor por `eventoId`, en una lectura ("Mis compras"). */
  async deComprador(compradorId: string): Promise<Map<string, Resenia>> {
    const resenias = await this.#resenias.listarPorComprador(compradorId);
    return new Map(resenias.map((resenia) => [resenia.eventoId, resenia]));
  }

  /** Las reseñas de esos eventos en una lectura, de la más reciente a la más vieja (R8). */
  async listarDeEventos(eventos: readonly Evento[]): Promise<Resenia[]> {
    const resenias = await this.#resenias.listarPorEventos(eventos.map((e) => e.id));
    return [...resenias].sort(compararResenias);
  }
}
