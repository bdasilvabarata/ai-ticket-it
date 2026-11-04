import type { ErrorApi } from "@ai-ticket-it/shared";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger";
import { ErrorAplicacion } from "../errors/index";

/** Tipo que `express.json()` pone en sus errores (`entity.parse.failed`, `entity.too.large`). */
function tipoDeErrorDelParser(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "type" in error) {
    return typeof error.type === "string" ? error.type : undefined;
  }
  return undefined;
}

/** Único punto que traduce errores a HTTP con el formato `ErrorApi` (FR-018, FR-019). */
export function manejarErrores(
  error: unknown,
  req: Request,
  res: Response<ErrorApi>,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ErrorAplicacion) {
    const { codigo, mensaje, detalles } = error;
    res.status(error.status).json({ error: detalles ? { codigo, mensaje, detalles } : { codigo, mensaje } });
    return;
  }

  const tipo = tipoDeErrorDelParser(error);
  if (tipo === "entity.parse.failed") {
    res.status(400).json({
      error: { codigo: "JSON_INVALIDO", mensaje: "El cuerpo del pedido no es JSON válido." },
    });
    return;
  }
  if (tipo === "entity.too.large") {
    res.status(413).json({
      error: {
        codigo: "CUERPO_DEMASIADO_GRANDE",
        mensaje: "El cuerpo del pedido supera el máximo de 100 kB.",
      },
    });
    return;
  }

  logger.error(`Error inesperado en ${req.method} ${req.originalUrl}`, error);
  res.status(500).json({
    error: { codigo: "ERROR_INTERNO", mensaje: "Ocurrió un error inesperado." },
  });
}
