import type { ErrorApi } from "@ai-ticket-it/shared";
import type { NextFunction, Request, Response } from "express";
import { aErrorAplicacion } from "./traducir-error";

/**
 * Único punto que traduce errores a HTTP con el formato `ErrorApi` (FR-018). No registra:
 * eso lo hace `registrarError`, que va antes en la cadena.
 */
export function manejarErrores(
  error: unknown,
  _req: Request,
  res: Response<ErrorApi>,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }
  const esperado = aErrorAplicacion(error);
  if (!esperado) {
    res.status(500).json({ error: { codigo: "ERROR_INTERNO", mensaje: "Ocurrió un error inesperado." } });
    return;
  }
  const { status, codigo, mensaje, detalles } = esperado;
  res.status(status).json({ error: detalles ? { codigo, mensaje, detalles } : { codigo, mensaje } });
}
