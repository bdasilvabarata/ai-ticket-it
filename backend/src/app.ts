import express, { type Express } from "express";
import { relojDelSistema } from "./config/reloj";
import { CategoriaController } from "./controllers/categoria.controller";
import { EventoController } from "./controllers/evento.controller";
import { SaludController } from "./controllers/salud.controller";
import { TipoEntradaController } from "./controllers/tipo-entrada.controller";
import { UsuarioController } from "./controllers/usuario.controller";
import { manejarErrores } from "./middlewares/manejar-errores";
import { registrarError } from "./middlewares/registrar-error";
import { registrarPedido } from "./middlewares/registrar-pedido";
import { crearRequerirUsuario } from "./middlewares/requerir-usuario";
import { rutaNoEncontrada } from "./middlewares/ruta-no-encontrada";
import { crearDocsRouter } from "./routes/docs.routes";
import type { Reloj } from "./domain/reloj";
import { crearRouterApi } from "./routes/index";
import { crearRepositoriosDeEjemplo, type Repositorios } from "./seed/repositorios-de-ejemplo";
import { CategoriaService } from "./services/categoria.service";
import { CerrojoPorClave } from "./services/cerrojo-por-clave";
import { EventoService } from "./services/evento.service";
import { ReseniaService } from "./services/resenia.service";
import { TipoEntradaService } from "./services/tipo-entrada.service";
import { UsuarioService } from "./services/usuario.service";
import { VencimientoService } from "./services/vencimiento.service";

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
  const { usuarios, categorias, eventos, compras, resenias } = {
    ...crearRepositoriosDeEjemplo(reloj.ahora()),
    ...repositorios,
  };

  const usuarioService = new UsuarioService({ usuarios, eventos });
  const categoriaService = new CategoriaService({ categorias });
  const reseniaService = new ReseniaService({ resenias });
  // Una sola instancia: los services que modifican eventos comparten el cerrojo (research R2).
  const cerrojo = new CerrojoPorClave();
  // Vence las compras pendientes a los 15 minutos; lo necesita el dueño del evento (research R4).
  const vencimientoService = new VencimientoService({ compras });
  // Eventos se apoya en los dueños de categorías, usuarios y reseñas (constitución 2.2.0, principio III).
  const eventoService = new EventoService({
    eventos,
    compras,
    vencimientoService,
    categoriaService,
    usuarioService,
    reseniaService,
    cerrojo,
    reloj,
  });
  const tipoEntradaService = new TipoEntradaService({ eventos, compras, eventoService, cerrojo, reloj });

  const controllers = {
    salud: new SaludController(),
    usuarios: new UsuarioController(usuarioService),
    categorias: new CategoriaController(categoriaService),
    eventos: new EventoController(eventoService),
    tiposEntrada: new TipoEntradaController(tipoEntradaService),
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
