// Textos derivados de una compra, puros (sin React ni `Intl`), como los de `eventos`.

import type { CompraVista } from "@ai-ticket-it/shared";

import { textoPrecio } from "../eventos";

/** 0 → "Gratis"; 240000 → "$ 240.000". */
export function textoTotal(total: number): string {
  return textoPrecio(total);
}

/** 1 → "1 entrada"; 2 → "2 entradas". */
export function textoCantidad(cantidad: number): string {
  return cantidad === 1 ? "1 entrada" : `${cantidad} entradas`;
}

/** "2026-11-12T15:35" (hora de pared de Buenos Aires) → "Podés pagar hasta las 15:35". */
export function textoVencimiento(venceEnLocal: string): string {
  return `Podés pagar hasta las ${venceEnLocal.slice(11, 16)}`;
}

/**
 * El aviso de una compra CANCELADA según quién la canceló (el último cambio de su historial): el
 * sistema, al vencer, o su comprador, antes de pagarla.
 */
export function textoCancelada(compra: CompraVista): string {
  const ultimo = compra.historial[compra.historial.length - 1];
  return ultimo?.autor.tipo === "usuario"
    ? "Cancelaste esta compra: sus entradas volvieron a estar disponibles."
    : "Esta compra venció: sus entradas volvieron a estar disponibles.";
}

/** 1 → "Tenés 1 entrada confirmada para este evento"; 3 → "Tenés 3 entradas confirmadas…". */
export function textoEntradasConfirmadas(cantidad: number): string {
  return cantidad === 1
    ? "Tenés 1 entrada confirmada para este evento"
    : `Tenés ${cantidad} entradas confirmadas para este evento`;
}
