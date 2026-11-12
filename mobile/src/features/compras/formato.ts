// Textos derivados de una compra, puros (sin React ni `Intl`), como los de `eventos`.

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
