import { Router } from "express";
import type { CategoriaController } from "../controllers/categoria.controller";

export function crearCategoriasRouter(controller: CategoriaController): Router {
  const router = Router();
  // Público.
  router.get("/", controller.listar);
  return router;
}
