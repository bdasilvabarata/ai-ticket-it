import { EstadoCompra, type MiCompraVista } from "@ai-ticket-it/shared";

/** Margen después de la hora límite, para pedir cuando el servidor ya la cumplió. */
const MARGEN_MS = 1000;
/** Espera mínima: una pendiente que el servidor todavía no da por vencida no dispara pedidos seguidos. */
const ESPERA_MINIMA_MS = 5000;

/**
 * Cuánto esperar (ms) para volver a pedir "Mis compras" cuando llega la hora límite más próxima de
 * sus pendientes (R9), o `null` si no hay pendientes. El reloj del teléfono solo programa el pedido:
 * quién decide que una compra venció es el servidor (FR-018).
 */
export function esperaHastaElProximoVencimiento(
  compras: readonly MiCompraVista[],
  ahoraMs: number,
): number | null {
  const vencimientos = compras.flatMap(({ estado, venceEn }) =>
    estado === EstadoCompra.PENDIENTE && venceEn !== null ? [Date.parse(venceEn)] : [],
  );
  if (vencimientos.length === 0) return null;
  return Math.max(Math.min(...vencimientos) - ahoraMs + MARGEN_MS, ESPERA_MINIMA_MS);
}
