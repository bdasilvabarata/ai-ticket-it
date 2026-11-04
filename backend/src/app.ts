import express, { type Express } from "express";
import type { Almacenamiento } from "@ai-ticket-it/shared";
import { manejarErrores } from "./middlewares/manejar-errores";
import { registrarPedido } from "./middlewares/registrar-pedido";
import { rutaNoEncontrada } from "./middlewares/ruta-no-encontrada";
import { crearRouterApi } from "./routes/index";

/** Arma la app de Express. No llama a `listen`: lo hace server.ts (y los tests usan supertest). */
export function crearApp(opciones: { almacenamiento: Almacenamiento }): Express {
  const app = express();
  app.locals.almacenamiento = opciones.almacenamiento;
  app.disable("x-powered-by");
  // Antes del parser, para registrar también los 400/413 que produce.
  app.use(registrarPedido);
  app.use(express.json({ limit: "100kb" }));
  app.use("/api", crearRouterApi());
  app.use(rutaNoEncontrada);
  app.use(manejarErrores);
  return app;
}
