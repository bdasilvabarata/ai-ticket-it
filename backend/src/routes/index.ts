import { Router, type RequestHandler } from "express";
import type { SaludController } from "../controllers/salud.controller";
import type { UsuarioController } from "../controllers/usuario.controller";
import { crearSaludRouter } from "./salud.routes";
import { crearUsuariosRouter } from "./usuarios.routes";

export interface ControllersApi {
  salud: SaludController;
  usuarios: UsuarioController;
}

/** Router de `/api`. Recibe los controllers ya armados por el composition root. */
export function crearRouterApi(controllers: ControllersApi, requerirUsuario: RequestHandler): Router {
  const router = Router();
  router.use("/salud", crearSaludRouter(controllers.salud));
  router.use("/usuarios", crearUsuariosRouter(controllers.usuarios, requerirUsuario));
  return router;
}
