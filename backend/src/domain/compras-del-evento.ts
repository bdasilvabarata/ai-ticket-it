import { EstadoCompra } from "@ai-ticket-it/shared";
import type { Compra } from "./compra";
import type { TipoEntrada } from "./evento";

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

/** Cómo viene la venta de un tipo de entrada, al día (feature 008, FR-007). */
export interface ResumenDeTipo {
  tipoEntrada: TipoEntrada;
  /** El cupo disponible del tipo (el del evento al día: el mismo que muestra el detalle). */
  disponibles: number;
  /** Entradas de compras PENDIENTE (no vencidas: las compras ya llegan al día). */
  pendientes: number;
  /** Entradas de compras CONFIRMADA o UTILIZADA. */
  vendidas: number;
  /** Entradas UTILIZADA. */
  usadas: number;
}

/**
 * Un resumen por tipo, en el orden del evento (R7). `comprasAlDia` son las compras del evento ya
 * puestas al día (`alDia(ahora)`); las CANCELADA y REEMBOLSADA no suman.
 */
export function resumenPorTipo(
  tipos: readonly TipoEntrada[],
  comprasAlDia: readonly Compra[],
): ResumenDeTipo[] {
  return tipos.map((tipoEntrada) => {
    const resumen: ResumenDeTipo = {
      tipoEntrada,
      disponibles: tipoEntrada.cupo,
      pendientes: 0,
      vendidas: 0,
      usadas: 0,
    };
    for (const compra of comprasAlDia) {
      if (compra.tipoEntradaId !== tipoEntrada.id) continue;
      if (compra.estado === EstadoCompra.PENDIENTE) resumen.pendientes += compra.cantidad;
      if (compra.estado === EstadoCompra.CONFIRMADA || compra.estado === EstadoCompra.UTILIZADA) {
        resumen.vendidas += compra.cantidad;
        resumen.usadas += compra.entradasUsadas;
      }
    }
    return resumen;
  });
}
