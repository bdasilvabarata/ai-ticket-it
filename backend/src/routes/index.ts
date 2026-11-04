import { Router } from "express";
import { saludRouter } from "./salud.routes";

export function crearRouterApi(): Router {
  const router = Router();
  router.use("/salud", saludRouter);
  return router;
}
