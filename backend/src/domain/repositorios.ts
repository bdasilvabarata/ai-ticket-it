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
  /** Cantidad de eventos (pasados y futuros) por id de organizador; los que no organizan no aparecen. */
  contarPorOrganizador(ids: string[]): Promise<Map<string, number>>;
  /** Los eventos que organiza el usuario (posiblemente ninguno). */
  listarPorOrganizador(organizadorId: string): Promise<Evento[]>;
  /** Alta o reemplazo por id: guarda la instancia nueva, nunca modifica la guardada. */
  guardar(evento: Evento): Promise<void>;
  eliminarPorId(id: string): Promise<void>;
}

/** Compras (mínimo de la feature 004): alcanza para saber si algo tiene compras, en cualquier estado. */
export interface RepositorioCompras {
  existePorEvento(eventoId: string): Promise<boolean>;
  /** Los ids de tipo son únicos en todo el sistema: no hace falta el evento. */
  existePorTipoEntrada(tipoEntradaId: string): Promise<boolean>;
  guardar(compra: Compra): Promise<void>;
}

/** Reseñas (mínimo de la 005): lo justo para el puntaje del organizador. La 011 lo amplía. */
export interface RepositorioResenias {
  /** Las reseñas de esos eventos (posiblemente ninguna). */
  listarPorEventos(eventoIds: readonly string[]): Promise<Resenia[]>;
}
