/** Tamaños fijos que decide el servidor (FR-006, FR-020). */
export const LIMITES_PAGINACION = { tamanoDePagina: 10, reseniasEnElDetalle: 3 } as const;

/** Lo que acompaña a los elementos de una lista paginada (FR-002). */
export interface PaginaVista {
  /** La página entregada, desde 1: la pedida o, si no existe, la última (FR-005). */
  numero: number;
  /** Siempre `LIMITES_PAGINACION.tamanoDePagina`. */
  tamano: number;
  /** Elementos de la lista completa, con los filtros aplicados. */
  totalElementos: number;
  /** `ceil(totalElementos / tamano)`; 0 con la lista vacía. */
  totalPaginas: number;
}
