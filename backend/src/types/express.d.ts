import type { Usuario } from "../domain/usuario";

declare module "express-serve-static-core" {
  interface Request {
    /** Lo deja `requerirUsuario`. */
    usuario?: Usuario;
    /** Valores ya parseados por `validar` (en Express 5 `req.query` es de solo lectura). */
    validado?: { params?: unknown; query?: unknown; body?: unknown };
  }
}
