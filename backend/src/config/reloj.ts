import type { Reloj } from "../domain/reloj";

/** Reloj de producción: la hora del sistema. */
export const relojDelSistema: Reloj = { ahora: () => new Date() };
