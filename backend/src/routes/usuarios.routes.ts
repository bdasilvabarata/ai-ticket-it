import { Router, type RequestHandler } from "express";
import type { EventoController } from "../controllers/evento.controller";
import type { UsuarioController } from "../controllers/usuario.controller";
import { eventoPorId } from "../validations/evento.validation";
import { usuarioPorId } from "../validations/usuario.validation";

/**
 * Recibe también `EventoController` (feature 014, research R3): los favoritos del usuario actual son
 * un sub-recurso suyo, pero el caso de uso (404 del evento, tarjetas del catálogo) es de eventos.
 */
export function crearUsuariosRouter(
  controller: UsuarioController,
  eventos: EventoController,
  requerirUsuario: RequestHandler,
): Router {
  const router = Router();
  // Público.
  router.get("/", controller.listar);
  // Requiere usuario. Declaradas antes que /:id ("actual" no es un id válido, no hay ambigüedad).
  router.get("/actual", requerirUsuario, controller.obtenerActual);
  // Favoritos del usuario actual (feature 014): 401 → 400 params.eventoId → 404 evento.
  router.put("/actual/favoritos/:eventoId", requerirUsuario, eventoPorId.middleware, eventos.marcarFavorito);
  router.delete(
    "/actual/favoritos/:eventoId",
    requerirUsuario,
    eventoPorId.middleware,
    eventos.desmarcarFavorito,
  );
  // Público.
  router.get("/:id", usuarioPorId.middleware, controller.obtenerPorId);
  return router;
}
