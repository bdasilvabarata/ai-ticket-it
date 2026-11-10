import { Router, type RequestHandler } from "express";
import type { CategoriaController } from "../controllers/categoria.controller";
import type { EventoController } from "../controllers/evento.controller";
import type { SaludController } from "../controllers/salud.controller";
import type { UsuarioController } from "../controllers/usuario.controller";
import { crearCategoriasRouter } from "./categorias.routes";
import { crearEventosRouter } from "./eventos.routes";
import { crearSaludRouter } from "./salud.routes";
import { crearUsuariosRouter } from "./usuarios.routes";

export interface ControllersApi {
  salud: SaludController;
  usuarios: UsuarioController;
  categorias: CategoriaController;
  eventos: EventoController;
}

/** Router de `/api`. Recibe los controllers ya armados por el composition root. */
export function crearRouterApi(controllers: ControllersApi, requerirUsuario: RequestHandler): Router {
  const router = Router();
  router.use("/salud", crearSaludRouter(controllers.salud));
  router.use("/usuarios", crearUsuariosRouter(controllers.usuarios, requerirUsuario));
  router.use("/categorias", crearCategoriasRouter(controllers.categorias));
  router.use("/eventos", crearEventosRouter(controllers.eventos, requerirUsuario));
  return router;
}
