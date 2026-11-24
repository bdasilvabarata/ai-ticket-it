import { LIMITES_PAGINACION, type PaginaVista } from "@ai-ticket-it/shared";

/** Una página de una lista: sus elementos y los totales de la lista completa. */
export interface Paginado<T> {
  elementos: T[];
  pagina: PaginaVista;
}

/**
 * Corta la página `numeroPedido` (desde 1) de una lista que llega **ya filtrada y ordenada** por
 * el que llama (FR-003), de a `LIMITES_PAGINACION.tamanoDePagina` (research R1). Una página
 * posterior a la última devuelve la última, con su número real, y la lista vacía, la página 1 sin
 * elementos (FR-005). No muta la lista recibida.
 */
export function paginar<T>(elementos: readonly T[], numeroPedido: number): Paginado<T> {
  const tamano = LIMITES_PAGINACION.tamanoDePagina;
  const totalElementos = elementos.length;
  const totalPaginas = Math.ceil(totalElementos / tamano);
  const numero = Math.min(numeroPedido, Math.max(totalPaginas, 1));
  return {
    elementos: elementos.slice((numero - 1) * tamano, numero * tamano),
    pagina: { numero, tamano, totalElementos, totalPaginas },
  };
}
