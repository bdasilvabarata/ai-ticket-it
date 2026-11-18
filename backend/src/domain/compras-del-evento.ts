/**
 * Lo que hace falta para ordenar una compra de "Compras del evento" (feature 008, FR-005). Una
 * `Compra` lo cumple; los tests pueden pasar objetos simples.
 */
export interface OrdenableCompraDelEvento {
  id: string;
  creadaEn: Date;
}

/** De la más nueva a la más vieja (`creadaEn` descendente); con la misma fecha, `id` ascendente. */
export function compararComprasDelEvento(a: OrdenableCompraDelEvento, b: OrdenableCompraDelEvento): number {
  const porCreacion = b.creadaEn.getTime() - a.creadaEn.getTime();
  if (porCreacion !== 0) return porCreacion;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
