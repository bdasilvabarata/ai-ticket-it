import { Router, type RequestHandler } from "express";
import type { CompraController } from "../controllers/compra.controller";
import { compraPorId } from "../validations/compra.validation";

/** `/compras` (feature 006): ver y pagar una compra, solo su comprador (el usuario actual). */
export function crearComprasRouter(controller: CompraController, requerirUsuario: RequestHandler): Router {
  const router = Router();
  router.get("/:compraId", requerirUsuario, compraPorId.middleware, controller.obtener);
  // Pago simulado: sin cuerpo (si viene uno, se ignora).
  router.post("/:compraId/pago", requerirUsuario, compraPorId.middleware, controller.pagar);
  return router;
}
