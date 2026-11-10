import express, { type Express } from "express";
import { relojDelSistema } from "./config/reloj";
import { SaludController } from "./controllers/salud.controller";
import { UsuarioController } from "./controllers/usuario.controller";
import { manejarErrores } from "./middlewares/manejar-errores";
import { registrarError } from "./middlewares/registrar-error";
import { registrarPedido } from "./middlewares/registrar-pedido";
import { crearRequerirUsuario } from "./middlewares/requerir-usuario";
import { rutaNoEncontrada } from "./middlewares/ruta-no-encontrada";
import { crearDocsRouter } from "./routes/docs.routes";
import { crearRouterApi } from "./routes/index";
import type { Reloj } from "./domain/reloj";
import { crearRepositoriosDeEjemplo, type Repositorios } from "./seed/repositorios-de-ejemplo";
import { UsuarioService } from "./services/usuario.service";

export interface OpcionesApp {
  /**
   * Reemplaza repositorios (los tests inyectan los suyos). Por defecto, repositorios en
   * memoria nuevos con los datos de ejemplo (FR-005).
   */
  repositorios?: Partial<Repositorios>;
  /** Única referencia de "ahora" (FR-010a). Los tests fijan el instante. */
  reloj?: Reloj;
}

/**
 * Composition root (principio III): el único lugar que instancia y conecta
 * repositories → services → controllers → rutas. No llama a `listen`: lo hace server.ts
 * (y los tests usan supertest).
 */
export function crearApp({ repositorios = {}, reloj = relojDelSistema }: OpcionesApp = {}): Express {
  const { usuarios, eventos } = { ...crearRepositoriosDeEjemplo(reloj.ahora()), ...repositorios };

  const usuarioService = new UsuarioService({ usuarios, eventos });

  const controllers = {
    salud: new SaludController(),
    usuarios: new UsuarioController(usuarioService),
  };
  const requerirUsuario = crearRequerirUsuario(usuarioService);

  const app = express();
  app.disable("x-powered-by");
  // Antes del parser, para registrar también los 400/413 que produce.
  app.use(registrarPedido);
  app.use(express.json({ limit: "100kb" }));
  app.use("/api/docs", crearDocsRouter());
  app.use("/api", crearRouterApi(controllers, requerirUsuario));
  app.use(rutaNoEncontrada);
  // Errores: primero se registran, después se responden (dos responsabilidades).
  app.use(registrarError);
  app.use(manejarErrores);
  return app;
}
