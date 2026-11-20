import type { Compra } from "./compra";

/**
 * Las entradas que liberan las compras vencidas en `ahora` (PENDIENTE pasado el plazo), sumadas por
 * `tipoEntradaId`. Las demás no cuentan. Sin vencidas, un `Map` vacío.
 */
export function cupoLiberadoPorTipo(compras: readonly Compra[], ahora: Date): Map<string, number> {
  const liberado = new Map<string, number>();
  for (const compra of compras) {
    if (!compra.estaVencida(ahora)) continue;
    liberado.set(compra.tipoEntradaId, (liberado.get(compra.tipoEntradaId) ?? 0) + compra.cantidad);
  }
  return liberado;
}
