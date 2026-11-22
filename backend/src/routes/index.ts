import { Router, type RequestHandler } from "express";
import type { CategoriaController } from "../controllers/categoria.controller";
import type { CompraController } from "../controllers/compra.controller";
import type { EntradaController } from "../controllers/entrada.controller";
import type { EventoController } from "../controllers/evento.controller";
import type { SaludController } from "../controllers/salud.controller";
import type { TipoEntradaController } from "../controllers/tipo-entrada.controller";
import type { UsuarioController } from "../controllers/usuario.controller";
import { crearCategoriasRouter } from "./categorias.routes";
import { crearComprasRouter } from "./compras.routes";
import { crearEventosRouter } from "./eventos.routes";
import { crearSaludRouter } from "./salud.routes";
import { crearUsuariosRouter } from "./usuarios.routes";

export interface ControllersApi {
  salud: SaludController;
  usuarios: UsuarioController;
  categorias: CategoriaController;
  eventos: EventoController;
  tiposEntrada: TipoEntradaController;
  compras: CompraController;
  entradas: EntradaController;
}

/** Router de `/api`. Recibe los controllers ya armados por el composition root. */
export function crearRouterApi(controllers: ControllersApi, requerirUsuario: RequestHandler): Router {
  const router = Router();
  router.use("/salud", crearSaludRouter(controllers.salud));
  router.use("/usuarios", crearUsuariosRouter(controllers.usuarios, controllers.eventos, requerirUsuario));
  router.use("/categorias", crearCategoriasRouter(controllers.categorias));
  router.use("/eventos", crearEventosRouter(controllers, requerirUsuario));
  router.use("/compras", crearComprasRouter(controllers.compras, requerirUsuario));
  return router;
}
