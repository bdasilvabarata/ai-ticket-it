import type { Almacenamiento } from "@ai-ticket-it/shared";
import type { Usuario } from "../domain/usuario";

declare module "express-serve-static-core" {
  interface Request {
    /** Lo deja `requerirUsuario`. */
    usuario?: Usuario;
  }

  interface Locals {
    /** Lo fija `crearApp`. */
    almacenamiento: Almacenamiento;
  }
}
