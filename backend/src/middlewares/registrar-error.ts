import type { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger";
import { aErrorAplicacion } from "./traducir-error";

/**
 * Registra los errores inesperados completos, con stack (FR-019), y pasa el error al handler.
 * Los esperados (4xx) no se registran acá: ya figuran con su status en el registro de pedidos.
 */
export function registrarError(error: unknown, req: Request, _res: Response, next: NextFunction): void {
  if (!aErrorAplicacion(error)) {
    logger.error(`Error inesperado en ${req.method} ${req.originalUrl}`, error);
  }
  next(error);
}
