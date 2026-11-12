import type { OrdenCatalogo, SentidoCatalogo } from "@ai-ticket-it/shared";

/** La consulta del catálogo ya normalizada: texto recortado y `categoriaId` `null` = "Todas". */
export interface ClaveCatalogo {
  texto: string;
  categoriaId: string | null;
  orden: OrdenCatalogo;
  sentido: SentidoCatalogo;
}

/**
 * Claves de TanStack Query, en un solo lugar (R9). Las que dependen del usuario llevan el
 * `usuarioId` en la posición 1: así la respuesta de un usuario nunca se lee con la clave de otro.
 */
export const claves = {
  usuarios: () => ["usuarios"] as const,
  usuarioActual: (usuarioId: string) => ["usuario-actual", usuarioId] as const,
  categorias: () => ["categorias"] as const,
  misEventos: (usuarioId: string) => ["mis-eventos", usuarioId] as const,
  evento: (usuarioId: string, eventoId: string) => ["evento", usuarioId, eventoId] as const,
  /**
   * Excepción a "el usuario en la posición 1": el catálogo es el mismo para todos (feature 005, edge
   * case "Usuario cambiado"). El prefijo `["catalogo"]` invalida todas sus consultas a la vez.
   */
  catalogo: (consulta: ClaveCatalogo) => ["catalogo", consulta] as const,
};
