import type { ConsultaComprasDelEvento } from "@ai-ticket-it/shared";
import { EstadoCompra } from "@ai-ticket-it/shared";

import { textoEtiquetaEstado } from "../../componentes";

/**
 * Qué compras se ven en "Compras del evento": todas, las de un estado (docs/mejoras-organizador.md,
 * grupo 3) o las que tienen un mensaje sin responder (grupo 4). Desde la 013 filtra el servidor,
 * antes de paginar (`consultaDelFiltro`).
 */
export type FiltroDeCompras = "todas" | "sin-responder" | EstadoCompra;

/** Los filtros, en el orden de los chips. */
export const FILTROS_DE_COMPRAS: readonly FiltroDeCompras[] = [
  "todas",
  "sin-responder",
  EstadoCompra.PENDIENTE,
  EstadoCompra.CONFIRMADA,
  EstadoCompra.UTILIZADA,
  EstadoCompra.CANCELADA,
  EstadoCompra.REEMBOLSADA,
];

/**
 * Lo que el filtro le pide al servidor (feature 013, FR-017): "todas" no manda nada; "sin-responder",
 * `sinResponder: true`; un estado, ese `estado`.
 */
export function consultaDelFiltro(
  filtro: FiltroDeCompras,
): Pick<ConsultaComprasDelEvento, "estado" | "sinResponder"> {
  if (filtro === "todas") return {};
  if (filtro === "sin-responder") return { sinResponder: true };
  return { estado: filtro };
}

/**
 * El nombre del chip: "Todas", "Sin responder" o el del estado, igual que su etiqueta ("Pendiente",
 * "Confirmada"…).
 */
export function textoDelFiltro(filtro: FiltroDeCompras): string {
  if (filtro === "todas") return "Todas";
  if (filtro === "sin-responder") return "Sin responder";
  return textoEtiquetaEstado(filtro);
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
  if (filtro === "todas") return SIN_COMPRAS;
  if (filtro === "sin-responder") return "No hay mensajes sin responder";
  return `No hay compras ${PLURAL_DEL_ESTADO[filtro]}`;
}
