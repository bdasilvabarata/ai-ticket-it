import type { Server } from "node:http";
import type { Express } from "express";
import { crearApp } from "./app";
import { direccionesDeRed } from "./config/direcciones";
import { env } from "./config/env";
import { mensajeFallaArranque } from "./config/fallas-arranque";

function escuchar(app: Express, puerto: number, host: string): Promise<Server> {
  return new Promise((resolve, reject) => {
    const servidor = app.listen(puerto, host);
    servidor.once("listening", () => resolve(servidor));
    servidor.once("error", reject);
  });
}

async function arrancar(): Promise<void> {
  // crearApp() arma repositorios en memoria nuevos con los datos de ejemplo (FR-005).
  const servidor = await escuchar(crearApp(), env.PORT, env.HOST);

  // console.log y no el logger: el arranque se ve aunque LOG_LEVEL=silent.
  console.log("AI Ticket It API escuchando");
  console.log(`  Local: http://localhost:${env.PORT}/api`);
  for (const { direccion, interfaz } of direccionesDeRed()) {
    console.log(`  Red:   http://${direccion}:${env.PORT}/api (${interfaz})`);
  }
  console.log("Datos de ejemplo cargados en memoria (se pierden al detener el servidor)");

  const apagar = () => servidor.close(() => process.exit(0));
  process.once("SIGINT", apagar);
  process.once("SIGTERM", apagar);
}

arrancar().catch((error: unknown) => {
  console.error(mensajeFallaArranque(error, env.PORT));
  process.exit(1);
});
