import type { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger";

/** Registra una línea por pedido: método, ruta, status y duración (FR-021). */
export function registrarPedido(req: Request, res: Response, next: NextFunction): void {
  const inicio = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });
  next();
}
