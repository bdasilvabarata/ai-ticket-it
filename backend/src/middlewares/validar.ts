import type { DetalleError } from "@ai-ticket-it/shared";
import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import { EntradaInvalidaError } from "../errors/index";

type Parte = "params" | "query" | "body";
type Esquemas = Partial<Record<Parte, z.ZodType>>;

const PARTES: Parte[] = ["params", "query", "body"];

/**
 * Valida las partes del pedido con esquemas zod. Si alguna falla, lanza
 * `EntradaInvalidaError` con un detalle por campo; si no, deja los valores parseados en
 * `req.validado` (en Express 5 `req.query` es de solo lectura).
 */
export function validar(esquemas: Esquemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const detalles: DetalleError[] = [];
    const validado: NonNullable<Request["validado"]> = {};
    for (const parte of PARTES) {
      const esquema = esquemas[parte];
      if (!esquema) continue;
      const resultado = esquema.safeParse(req[parte]);
      if (resultado.success) {
        validado[parte] = resultado.data;
      } else {
        for (const problema of resultado.error.issues) {
          detalles.push({
            campo: [parte, ...problema.path.map(String)].join("."),
            mensaje: problema.message,
          });
        }
      }
    }
    if (detalles.length > 0) throw new EntradaInvalidaError(detalles);
    req.validado = validado;
    next();
  };
}

/**
 * Devuelve la parte ya validada con su tipo. Re-parsea lo ya validado para recuperar el tipo
 * sin casts; si falla, es un error de programación (ruta sin `validar`) → 500.
 */
export function leerValidado<T>(req: Request, parte: Parte, esquema: z.ZodType<T>): T {
  return esquema.parse(req.validado?.[parte]);
}
