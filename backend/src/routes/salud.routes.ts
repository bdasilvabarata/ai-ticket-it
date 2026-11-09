import { Router } from "express";
import type { SaludController } from "../controllers/salud.controller";

export function crearSaludRouter(controller: SaludController): Router {
  const router = Router();
  // Público.
  router.get("/", controller.obtener);
  return router;
}
