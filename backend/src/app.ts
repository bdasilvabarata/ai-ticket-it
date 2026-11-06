import express, { type Express } from "express";
import type { Almacenamiento } from "@ai-ticket-it/shared";
import { SaludController } from "./controllers/salud.controller";
import { UsuarioController } from "./controllers/usuario.controller";
import type { RepositorioEventos, RepositorioUsuarios } from "./domain/repositorios";
import { manejarErrores } from "./middlewares/manejar-errores";
import { registrarError } from "./middlewares/registrar-error";
import { registrarPedido } from "./middlewares/registrar-pedido";
import { crearRequerirUsuario } from "./middlewares/requerir-usuario";
import { rutaNoEncontrada } from "./middlewares/ruta-no-encontrada";
import { EventoRepository } from "./repositories/evento.repository";
import { UsuarioRepository } from "./repositories/usuario.repository";
import { crearDocsRouter } from "./routes/docs.routes";
import { crearRouterApi } from "./routes/index";
import { UsuarioService } from "./services/usuario.service";

export interface Repositorios {
  usuarios: RepositorioUsuarios;
  eventos: RepositorioEventos;
}

export interface OpcionesApp {
  almacenamiento: Almacenamiento;
  /** Reemplaza repositorios (los tests inyectan falsos); por defecto, los de Mongoose. */
  repositorios?: Partial<Repositorios>;
}

/**
 * Composition root (principio III): el único lugar que instancia y conecta
 * repositories → services → controllers → rutas. No llama a `listen`: lo hace server.ts
 * (y los tests usan supertest).
 */
export function crearApp({ almacenamiento, repositorios = {} }: OpcionesApp): Express {
  const usuarios = repositorios.usuarios ?? new UsuarioRepository();
  const eventos = repositorios.eventos ?? new EventoRepository();

  const usuarioService = new UsuarioService({ usuarios, eventos });

  const controllers = {
    salud: new SaludController(almacenamiento),
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
