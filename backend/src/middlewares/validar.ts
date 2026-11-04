import type { DetalleError } from "@ai-ticket-it/shared";
import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import { EntradaInvalidaError } from "../errors/index";

type Parte = "params" | "query" | "body";
type Esquemas = Partial<Record<Parte, z.ZodType>>;
/** Lo que produce cada esquema después de validar (y transformar, si el esquema transforma). */
type Salidas<E extends Esquemas> = { [P in keyof E]: E[P] extends z.ZodType ? z.output<E[P]> : never };

const PARTES: Parte[] = ["params", "query", "body"];

/**
 * Validación declarativa de un endpoint (FR-017, R7). Devuelve:
 * - `middleware`: valida las partes del pedido con los esquemas zod. Si alguna falla, lanza
 *   `EntradaInvalidaError` con un detalle por campo, de todas las partes a la vez.
 * - `leer(req, parte)`: el valor ya validado y transformado, con su tipo.
 *
 * Los valores se guardan en un WeakMap propio de esta validación (no en `req`): así `leer`
 * solo puede devolver lo que produjeron **estos** esquemas, no se vuelve a validar (lo que
 * rompería con esquemas que transforman, como texto → Date) y en Express 5 no hace falta
 * tocar `req.query`, que es de solo lectura.
 */
export function crearValidacion<E extends Esquemas>(esquemas: E) {
  const validados = new WeakMap<Request, Salidas<E>>();

  function middleware(req: Request, _res: Response, next: NextFunction): void {
    const detalles: DetalleError[] = [];
    const salidas: Partial<Record<Parte, unknown>> = {};
    for (const parte of PARTES) {
      const esquema = esquemas[parte];
      if (!esquema) continue;
      const resultado = esquema.safeParse(req[parte]);
      if (resultado.success) {
        salidas[parte] = resultado.data;
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
    // Único cast: cada `salidas[parte]` es el `data` de `esquemas[parte].safeParse`, o sea
    // exactamente `z.output` de ese esquema. TypeScript no puede seguirlo a través del bucle.
    validados.set(req, salidas as Salidas<E>);
    next();
  }

  function leer<P extends keyof E>(req: Request, parte: P): Salidas<E>[P] {
    const salidas = validados.get(req);
    // Error de programación (la ruta no usa `middleware`): sale como 500 genérico.
    if (!salidas) throw new Error(`La ruta ${req.method} ${req.path} lee "${String(parte)}" sin validarlo.`);
    return salidas[parte];
  }

  return { middleware, leer };
}
