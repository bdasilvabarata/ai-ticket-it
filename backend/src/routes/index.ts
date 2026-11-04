import { Router } from "express";
import { saludRouter } from "./salud.routes";
import { usuariosRouter } from "./usuarios.routes";

export function crearRouterApi(): Router {
  const router = Router();
  router.use("/salud", saludRouter);
  router.use("/usuarios", usuariosRouter);
  return router;
}
