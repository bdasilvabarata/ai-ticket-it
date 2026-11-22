import { Router, type RequestHandler } from "express";
import type { CompraController } from "../controllers/compra.controller";
import type { EntradaController } from "../controllers/entrada.controller";
import type { EventoController } from "../controllers/evento.controller";
import type { TipoEntradaController } from "../controllers/tipo-entrada.controller";
import { compraNueva, comprasDelEvento } from "../validations/compra.validation";
import { entradaPorCodigo } from "../validations/entrada.validation";
import { consultaCatalogo, eventoEditado, eventoNuevo, eventoPorId } from "../validations/evento.validation";
import { reseniaNueva } from "../validations/resenia.validation";
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

/**
 * `/eventos/:eventoId/entradas` (feature 008): buscar una entrada por su código y registrar su uso.
 * Requieren usuario (el organizador; el 403 lo decide el service).
 */
function crearEntradasRouter(controller: EntradaController, requerirUsuario: RequestHandler): Router {
  const router = Router({ mergeParams: true });
  router.get("/:codigo", requerirUsuario, entradaPorCodigo.middleware, controller.obtener);
  router.post("/:codigo/uso", requerirUsuario, entradaPorCodigo.middleware, controller.registrarUso);
  return router;
}

export function crearEventosRouter(
  controllers: {
    eventos: EventoController;
    tiposEntrada: TipoEntradaController;
    compras: CompraController;
    entradas: EntradaController;
  },
  requerirUsuario: RequestHandler,
): Router {
  const { eventos: controller } = controllers;
  const router = Router();
  // Público: el catálogo de Explorar (un X-Usuario-Id inválido se ignora).
  router.get("/", consultaCatalogo.middleware, controller.listar);
  // Requiere usuario. Declarada antes que /:eventoId ("mios" tampoco es un id válido).
  router.get("/mios", requerirUsuario, controller.listarMios);
  router.post("/", requerirUsuario, eventoNuevo.middleware, controller.crear);
  // Público: lo usan editar, la vista de solo lectura y, en la 005, el detalle (research R8).
  router.get("/:eventoId", eventoPorId.middleware, controller.obtener);
  router.put("/:eventoId", requerirUsuario, eventoEditado.middleware, controller.actualizar);
  router.delete("/:eventoId", requerirUsuario, eventoPorId.middleware, controller.eliminar);
  // Compras (feature 006): en nombre del usuario actual.
  router.post("/:eventoId/compras", requerirUsuario, compraNueva.middleware, controllers.compras.crear);
  // Compras del evento (feature 008): solo su organizador (el 403 lo decide el service).
  router.get(
    "/:eventoId/compras",
    requerirUsuario,
    comprasDelEvento.middleware,
    controllers.compras.comprasDelEvento,
  );
  router.get(
    "/:eventoId/mis-compras",
    requerirUsuario,
    comprasDelEvento.middleware,
    controllers.compras.misComprasDelEvento,
  );
  // Reseñas (feature 012): en nombre del usuario actual, con una compra UTILIZADA del evento (los 409
  // los decide el dominio). Sin PUT, PATCH ni DELETE: una reseña no se edita ni se borra.
  router.post("/:eventoId/resenias", requerirUsuario, reseniaNueva.middleware, controllers.compras.reseniar);
  // Público, como el detalle (feature 012, R7): el organizador del evento con su puntaje y las
  // reseñas de todos sus eventos. Un X-Usuario-Id, si llega, se ignora.
  router.get(
    "/:eventoId/resenias-del-organizador",
    eventoPorId.middleware,
    controller.reseniasDelOrganizador,
  );
  router.use("/:eventoId/tipos-entrada", crearTiposEntradaRouter(controllers.tiposEntrada, requerirUsuario));
  router.use("/:eventoId/entradas", crearEntradasRouter(controllers.entradas, requerirUsuario));
  return router;
}
