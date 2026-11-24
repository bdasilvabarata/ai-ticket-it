/** Lo más que muestra el paginador (FR-008). */
const MAXIMO_DE_BOTONES = 5;

/**
 * Los números de página que muestra el paginador (feature 013, FR-008, research R6), de menor a
 * mayor y sin repetir:
 * - con 5 páginas o menos, todas;
 * - si no, la 1, la última y una ventana `[actual − 1, actual + 1]` recortada a `[1, total]`, que
 *   crece hacia adentro (hacia la última si toca la 1, hacia la 1 si toca la última) hasta que haya
 *   5 botones. Con 10 páginas: actual 1 → `1 2 3 4 10`; 6 → `1 5 6 7 10`; 10 → `1 7 8 9 10`.
 */
export function botonesDelPaginador(totalPaginas: number, actual: number): number[] {
  if (totalPaginas <= MAXIMO_DE_BOTONES) {
    return Array.from({ length: totalPaginas }, (_, i) => i + 1);
  }
  let desde = Math.max(actual - 1, 1);
  let hasta = Math.min(actual + 1, totalPaginas);
  const cantidad = () => new Set([1, totalPaginas, ...rango(desde, hasta)]).size;
  while (cantidad() < MAXIMO_DE_BOTONES) {
    if (desde === 1) hasta++;
    else desde--;
  }
  return [...new Set([1, ...rango(desde, hasta), totalPaginas])];
}

function rango(desde: number, hasta: number): number[] {
  return Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
}
