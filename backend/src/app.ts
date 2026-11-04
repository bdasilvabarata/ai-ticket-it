import express, { type Express } from "express";
import type { Almacenamiento } from "@ai-ticket-it/shared";
import { crearRouterApi } from "./routes/index";

/** Arma la app de Express. No llama a `listen`: lo hace server.ts (y los tests usan supertest). */
export function crearApp(opciones: { almacenamiento: Almacenamiento }): Express {
  const app = express();
  app.locals.almacenamiento = opciones.almacenamiento;
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));
  app.use("/api", crearRouterApi());
  return app;
}
