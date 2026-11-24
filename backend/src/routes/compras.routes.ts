import { Router, type RequestHandler } from "express";
import type { CompraController } from "../controllers/compra.controller";
import { compraPorId, mensajeNuevo } from "../validations/compra.validation";

/**
 * `/compras`: la lista de las compras del usuario actual como comprador (feature 007) y ver, pagar
 * y cancelar una compra, solo su comprador (feature 006; una confirmada desde la 009), y confirmar
 * su reembolso, solo el organizador del evento (feature 009), y el chat de la compra, solo entre su
 * comprador y el organizador del evento (feature 011).
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
  // El chat de la compra (feature 011): las dos partes, en cualquier estado y momento (sin 409).
  router.get("/:compraId/mensajes", requerirUsuario, compraPorId.middleware, controller.chat);
  // El cuerpo es solo `{ texto }`: el autor sale de X-Usuario-Id y la fecha, del reloj.
  router.post("/:compraId/mensajes", requerirUsuario, mensajeNuevo.middleware, controller.enviarMensaje);
  return router;
}
