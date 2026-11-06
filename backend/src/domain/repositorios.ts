import type { Usuario } from "./usuario";

// Interfaces de repositorio (puertos): los services dependen de estas, no de Mongoose.
// Las implementan las clases de repositories/ y, en los tests, objetos falsos.

export interface RepositorioUsuarios {
  listar(): Promise<Usuario[]>;
  buscarPorId(id: string): Promise<Usuario | null>;
}

export interface RepositorioEventos {
  /** Cantidad de eventos (pasados y futuros) por id de organizador; los que no organizan no aparecen. */
  contarPorOrganizador(ids: string[]): Promise<Map<string, number>>;
}
