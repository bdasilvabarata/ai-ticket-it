import type { OrdenCatalogo, SentidoCatalogo } from "@ai-ticket-it/shared";

/** La consulta del catálogo ya normalizada: texto recortado y `categoriaId` `null` = "Todas". */
export interface ClaveCatalogo {
  texto: string;
  categoriaId: string | null;
  orden: OrdenCatalogo;
  sentido: SentidoCatalogo;
  /** La página pedida, desde 1 (feature 013). */
  pagina: number;
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
  /** Las compras pendientes y el tope restante del usuario en un evento (feature 006). */
  misComprasDelEvento: (usuarioId: string, eventoId: string) =>
    ["mis-compras-del-evento", usuarioId, eventoId] as const,
  /**
   * Todas las compras del usuario como comprador (feature 007). No comparte prefijo con
   * `mis-compras-del-evento`: invalidar una no toca la otra.
   */
  misCompras: (usuarioId: string) => ["mis-compras", usuarioId] as const,
  /**
   * Todas las compras de un evento, leídas por su organizador (feature 008). No comparte prefijo con
   * `mis-compras-del-evento`.
   */
  comprasDelEvento: (
    usuarioId: string,
    eventoId: string,
    filtroYPagina?: { filtro: string; pagina: number },
  ) =>
    filtroYPagina === undefined
      ? (["compras-del-evento", usuarioId, eventoId] as const)
      : (["compras-del-evento", usuarioId, eventoId, filtroYPagina] as const),
  /**
   * Una entrada de un evento buscada por su organizador (feature 008), con el código normalizado
   * (mayúsculas, sin espacios ni guiones).
   */
  entradaDelEvento: (usuarioId: string, eventoId: string, codigo: string) =>
    ["entrada-del-evento", usuarioId, eventoId, codigo] as const,
  /** Una compra, leída por su comprador (feature 006). */
  compra: (usuarioId: string, compraId: string) => ["compra", usuarioId, compraId] as const,
  /**
   * El chat de una compra, leído por una de sus dos partes (feature 011). No comparte prefijo con
   * `["compra"]`: invalidar el chat no vuelve a pedir "Tu compra".
   */
  chatDeLaCompra: (usuarioId: string, compraId: string) =>
    ["chat-de-la-compra", usuarioId, compraId] as const,
  /**
   * "Reseñas del organizador" de un evento (feature 012). No comparte prefijo con `["evento"]`: la
   * sección tiene sus propios estados y se invalida aparte.
   */
  reseniasDelOrganizador: (usuarioId: string, eventoId: string) =>
    ["resenias-del-organizador", usuarioId, eventoId] as const,
  /**
   * Una página de "Reseñas del organizador" (feature 013, US5): la clave del resumen más la página, así
   * el prefijo `["resenias-del-organizador"]` que invalida la reseña nueva alcanza todas.
   */
  paginaDeResenias: (usuarioId: string, eventoId: string, pagina: number) =>
    ["resenias-del-organizador", usuarioId, eventoId, "pagina", pagina] as const,
  /**
   * Excepción a "el usuario en la posición 1": el catálogo es el mismo para todos (feature 005, edge
   * case "Usuario cambiado"). El prefijo `["catalogo"]` invalida todas sus consultas a la vez.
   */
  catalogo: (consulta: ClaveCatalogo) => ["catalogo", consulta] as const,
};
