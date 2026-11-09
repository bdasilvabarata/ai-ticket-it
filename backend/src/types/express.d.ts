import type { Usuario } from "../domain/usuario";

declare module "express-serve-static-core" {
  interface Request {
    /** Lo deja `requerirUsuario`. */
    usuario?: Usuario;
  }
}
