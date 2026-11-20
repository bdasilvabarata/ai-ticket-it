import type { Categoria } from "./categoria";
import type { Compra } from "./compra";
import type { Evento } from "./evento";
import type { Resenia } from "./resenia";
import type { Usuario } from "./usuario";

// Interfaces de repositorio (puertos): los services dependen de estas, no de una
// implementación. Las implementan los repositorios en memoria de repositories/.
// Convención de nombres: AGENTS.md ("Convención de nombres").

export interface RepositorioUsuarios {
  listar(): Promise<Usuario[]>;
  buscarPorId(id: string): Promise<Usuario | null>;
  /** Los que existen de esos ids (posiblemente ninguno), sin repetir: para `obtenerPorIds`. */
  listarPorIds(ids: readonly string[]): Promise<Usuario[]>;
}

export interface RepositorioCategorias {
  listar(): Promise<Categoria[]>;
  buscarPorId(id: string): Promise<Categoria | null>;
  /** Las que existen de esos ids (posiblemente ninguna), sin repetir. */
  listarPorIds(ids: readonly string[]): Promise<Categoria[]>;
}

export interface RepositorioEventos {
  /** Un id nuevo, para un evento o para un tipo de entrada (únicos en todo el sistema). */
  siguienteId(): string;
  listar(): Promise<Evento[]>;
  buscarPorId(id: string): Promise<Evento | null>;
  /** Los que existen de esos ids (posiblemente ninguno), sin repetir: para `obtenerPorIds`. */
  listarPorIds(ids: readonly string[]): Promise<Evento[]>;
  /** Cantidad de eventos (pasados y futuros) por id de organizador; los que no organizan no aparecen. */
  contarPorOrganizador(ids: string[]): Promise<Map<string, number>>;
  /** Los eventos que organiza el usuario (posiblemente ninguno). */
  listarPorOrganizador(organizadorId: string): Promise<Evento[]>;
  /** Alta o reemplazo por id: guarda la instancia nueva, nunca modifica la guardada. */
  guardar(evento: Evento): Promise<void>;
  eliminarPorId(id: string): Promise<void>;
}

/** Compras (feature 006): alta, búsquedas para el tope y el vencimiento, y si algo tiene compras. */
export interface RepositorioCompras {
  /** Un id nuevo para una compra (UUID v4). */
  siguienteId(): string;
  /** `cantidad` códigos nuevos, distintos entre sí y de todos los guardados (feature 008, R2). */
  siguientesCodigosDeEntrada(cantidad: number): string[];
  buscarPorId(id: string): Promise<Compra | null>;
  /** Las compras de esa persona en ese evento, en cualquier estado (posiblemente ninguna). */
  listarPorEventoYComprador(eventoId: string, compradorId: string): Promise<Compra[]>;
  /** Las compras de esa persona en todos los eventos, en cualquier estado (posiblemente ninguna). */
  listarPorComprador(compradorId: string): Promise<Compra[]>;
  /** Todas las compras de ese evento, de todos los compradores y en cualquier estado (feature 008). */
  listarPorEvento(eventoId: string): Promise<Compra[]>;
  /** La compra que tiene una entrada con ese código (canónico), de cualquier evento, o `null` (feature 008). */
  buscarPorCodigoDeEntrada(codigo: string): Promise<Compra | null>;
  /** Las compras guardadas como PENDIENTE (vencidas o no) de esos eventos, en una sola lectura. */
  listarPendientesPorEventos(eventoIds: readonly string[]): Promise<Compra[]>;
  /** Cualquier compra, en cualquier estado (también una vencida), cuenta. */
  existePorEvento(eventoId: string): Promise<boolean>;
  /** Los ids de tipo son únicos en todo el sistema: no hace falta el evento. */
  existePorTipoEntrada(tipoEntradaId: string): Promise<boolean>;
  guardar(compra: Compra): Promise<void>;
}

/** Reseñas (mínimo de la 005): lo justo para el puntaje del organizador. La 012 lo amplía. */
export interface RepositorioResenias {
  /** Las reseñas de esos eventos (posiblemente ninguna). */
  listarPorEventos(eventoIds: readonly string[]): Promise<Resenia[]>;
}
