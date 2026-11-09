import type { UsuarioVista } from "@ai-ticket-it/shared";

import { ErrorDeApi } from "../api";

export type ResultadoValidacion = { ok: true; usuario: UsuarioVista } | { ok: false; error: unknown };

export type DecisionValidacion =
  { tipo: "confirmado"; usuario: UsuarioVista } | { tipo: "olvidar" } | { tipo: "conservar-sin-servidor" };

/**
 * Regla de FR-013: solo el 401 `USUARIO_NO_IDENTIFICADO` hace olvidar al usuario. Cualquier otra
 * falla (sin conexión, tiempo agotado, error inesperado) lo conserva como "servidor no disponible".
 */
export function decidirValidacion(resultado: ResultadoValidacion): DecisionValidacion {
  if (resultado.ok) return { tipo: "confirmado", usuario: resultado.usuario };
  const { error } = resultado;
  if (error instanceof ErrorDeApi && error.status === 401 && error.codigo === "USUARIO_NO_IDENTIFICADO") {
    return { tipo: "olvidar" };
  }
  return { tipo: "conservar-sin-servidor" };
}
