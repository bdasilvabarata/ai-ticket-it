// Textos derivados de una compra, puros (sin React ni `Intl`), como los de `eventos`.

import { EstadoCompra, type CompraVista, type MiCompraVista } from "@ai-ticket-it/shared";

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

/** Días que faltan para un evento confirmado: 0 → "Hoy · 21:00"; 1 → "Mañana"; 10 → "Faltan 10 días". */
export function textoDiasRestantes(dias: number, fechaHoraLocal: string): string {
  if (dias === 0) return `Hoy · ${fechaHoraLocal.slice(11, 16)}`;
  if (dias === 1) return "Mañana";
  return `Faltan ${dias} días`;
}

/** La acción de pago de una pendiente: 0 → "Confirmar" (gratis); con precio → "Pagar". */
export function textoAccionDePago(total: number): string {
  return total === 0 ? "Confirmar" : "Pagar";
}

/** El aviso que va junto al estado de una fila de "Mis compras", o `null` si no lleva (contracts/app.md). */
export function textoAvisoDeMiCompra(compra: MiCompraVista): string | null {
  switch (compra.estado) {
    case EstadoCompra.CONFIRMADA:
      if (compra.evento.realizado) return "Evento realizado";
      return compra.diasRestantes === null
        ? null
        : textoDiasRestantes(compra.diasRestantes, compra.evento.fechaHoraLocal);
    case EstadoCompra.PENDIENTE:
      return compra.venceEnLocal === null ? null : textoVencimiento(compra.venceEnLocal);
    case EstadoCompra.CANCELADA:
      if (compra.canceladaPor === "sistema") return "Venció sin pagarse";
      return compra.canceladaPor === "usuario" ? "La cancelaste" : null;
    default:
      return null;
  }
}
