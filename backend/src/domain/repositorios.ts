import type { Categoria } from "./categoria";
import type { Evento } from "./evento";
import type { Usuario } from "./usuario";

// Interfaces de repositorio (puertos): los services dependen de estas, no de una
// implementación. Las implementan los repositorios en memoria de repositories/.
// Convención de nombres: AGENTS.md ("Convención de nombres").

export interface RepositorioUsuarios {
  listar(): Promise<Usuario[]>;
  buscarPorId(id: string): Promise<Usuario | null>;
}

export interface RepositorioCategorias {
  listar(): Promise<Categoria[]>;
  buscarPorId(id: string): Promise<Categoria | null>;
}

export interface RepositorioEventos {
  listar(): Promise<Evento[]>;
  buscarPorId(id: string): Promise<Evento | null>;
  /** Cantidad de eventos (pasados y futuros) por id de organizador; los que no organizan no aparecen. */
  contarPorOrganizador(ids: string[]): Promise<Map<string, number>>;
}
