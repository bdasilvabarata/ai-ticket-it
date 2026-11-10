import { Router, type RequestHandler } from "express";
import type { EventoController } from "../controllers/evento.controller";
import { eventoNuevo } from "../validations/evento.validation";

export function crearEventosRouter(controller: EventoController, requerirUsuario: RequestHandler): Router {
  const router = Router();
  // Requiere usuario. Declarada antes que /:eventoId ("mios" tampoco es un id válido).
  router.get("/mios", requerirUsuario, controller.listarMios);
  router.post("/", requerirUsuario, eventoNuevo.middleware, controller.crear);
  return router;
}
