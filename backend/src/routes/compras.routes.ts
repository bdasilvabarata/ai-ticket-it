import { Router, type RequestHandler } from "express";
import type { CompraController } from "../controllers/compra.controller";
import { compraPorId } from "../validations/compra.validation";

/**
 * `/compras`: la lista de las compras del usuario actual como comprador (feature 007) y ver, pagar
 * y cancelar una compra, solo su comprador (feature 006; una confirmada desde la 009), y confirmar
 * su reembolso, solo el organizador del evento (feature 009).
 */
export function crearComprasRouter(controller: CompraController, requerirUsuario: RequestHandler): Router {
  const router = Router();
  // "Mis compras": sin parámetros ni cuerpo (una query se ignora). Antes de `/:compraId`.
  router.get("/", requerirUsuario, controller.misCompras);
  router.get("/:compraId", requerirUsuario, compraPorId.middleware, controller.obtener);
  // Pago simulado: sin cuerpo (si viene uno, se ignora).
  router.post("/:compraId/pago", requerirUsuario, compraPorId.middleware, controller.pagar);
  // Cancelar una PENDIENTE antes de que venza: también sin cuerpo.
  router.post("/:compraId/cancelacion", requerirUsuario, compraPorId.middleware, controller.cancelar);
  // El organizador confirma el reembolso de una cancelada (feature 009): sin cuerpo.
  router.post("/:compraId/reembolso", requerirUsuario, compraPorId.middleware, controller.confirmarReembolso);
  return router;
}
