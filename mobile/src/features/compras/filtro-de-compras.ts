import type { CompraDelEventoVista } from "@ai-ticket-it/shared";
import { EstadoCompra } from "@ai-ticket-it/shared";

import { textoEtiquetaEstado } from "../../componentes";

/**
 * Qué compras se ven en "Compras del evento": todas o las de un estado (docs/mejoras-organizador.md,
 * grupo 3). Se filtra en la app, sobre la vista que ya llega: el endpoint no cambia.
 */
export type FiltroDeCompras = "todas" | EstadoCompra;

/** Los filtros, en el orden de los chips. */
export const FILTROS_DE_COMPRAS: readonly FiltroDeCompras[] = [
  "todas",
  EstadoCompra.PENDIENTE,
  EstadoCompra.CONFIRMADA,
  EstadoCompra.UTILIZADA,
  EstadoCompra.CANCELADA,
  EstadoCompra.REEMBOLSADA,
];

/** Las compras que deja ver el filtro, en el orden en que llegan. */
export function filtrarCompras(
  compras: readonly CompraDelEventoVista[],
  filtro: FiltroDeCompras,
): CompraDelEventoVista[] {
  return filtro === "todas" ? [...compras] : compras.filter((compra) => compra.estado === filtro);
}

/** El nombre del chip: "Todas" o el del estado, igual que su etiqueta ("Pendiente", "Confirmada"…). */
export function textoDelFiltro(filtro: FiltroDeCompras): string {
  return filtro === "todas" ? "Todas" : textoEtiquetaEstado(filtro);
}

/** El vacío sin ninguna compra del evento (también el de "Todas"). */
export const SIN_COMPRAS = "Todavía nadie compró entradas";

const PLURAL_DEL_ESTADO: Record<EstadoCompra, string> = {
  [EstadoCompra.PENDIENTE]: "pendientes",
  [EstadoCompra.CONFIRMADA]: "confirmadas",
  [EstadoCompra.UTILIZADA]: "utilizadas",
  [EstadoCompra.CANCELADA]: "canceladas",
  [EstadoCompra.REEMBOLSADA]: "reembolsadas",
};

/** El vacío de la lista con el filtro elegido: "No hay compras canceladas". */
export function textoSinComprasDelFiltro(filtro: FiltroDeCompras): string {
  return filtro === "todas" ? SIN_COMPRAS : `No hay compras ${PLURAL_DEL_ESTADO[filtro]}`;
}
