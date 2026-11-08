import { Router, type RequestHandler } from "express";
import type { UsuarioController } from "../controllers/usuario.controller";
import { usuarioPorId } from "../validations/usuario.validation";

export function crearUsuariosRouter(controller: UsuarioController, requerirUsuario: RequestHandler): Router {
  const router = Router();
  // Público.
  router.get("/", controller.listar);
  // Requiere usuario. Declarada antes que /:id ("actual" no es un id válido, no hay ambigüedad).
  router.get("/actual", requerirUsuario, controller.obtenerActual);
  // Público.
  router.get("/:id", usuarioPorId.middleware, controller.obtenerPorId);
  return router;
}
