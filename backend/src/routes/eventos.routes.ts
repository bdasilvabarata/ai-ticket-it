import { Router, type RequestHandler } from "express";
import type { EventoController } from "../controllers/evento.controller";
import type { TipoEntradaController } from "../controllers/tipo-entrada.controller";
import { eventoEditado, eventoNuevo, eventoPorId } from "../validations/evento.validation";
import {
  tipoEntradaEditado,
  tipoEntradaNuevo,
  tipoEntradaPorId,
} from "../validations/tipo-entrada.validation";

/** `/eventos/:eventoId/tipos-entrada`: todas sus rutas requieren usuario (el organizador). */
function crearTiposEntradaRouter(controller: TipoEntradaController, requerirUsuario: RequestHandler): Router {
  const router = Router({ mergeParams: true });
  router.post("/", requerirUsuario, tipoEntradaNuevo.middleware, controller.crear);
  router.put("/:tipoEntradaId", requerirUsuario, tipoEntradaEditado.middleware, controller.actualizar);
  router.delete("/:tipoEntradaId", requerirUsuario, tipoEntradaPorId.middleware, controller.eliminar);
  return router;
}

export function crearEventosRouter(
  controllers: { eventos: EventoController; tiposEntrada: TipoEntradaController },
  requerirUsuario: RequestHandler,
): Router {
  const { eventos: controller } = controllers;
  const router = Router();
  // Requiere usuario. Declarada antes que /:eventoId ("mios" tampoco es un id válido).
  router.get("/mios", requerirUsuario, controller.listarMios);
  router.post("/", requerirUsuario, eventoNuevo.middleware, controller.crear);
  // Público: lo usan editar, la vista de solo lectura y, en la 005, el detalle (research R8).
  router.get("/:eventoId", eventoPorId.middleware, controller.obtener);
  router.put("/:eventoId", requerirUsuario, eventoEditado.middleware, controller.actualizar);
  router.delete("/:eventoId", requerirUsuario, eventoPorId.middleware, controller.eliminar);
  router.use("/:eventoId/tipos-entrada", crearTiposEntradaRouter(controllers.tiposEntrada, requerirUsuario));
  return router;
}
