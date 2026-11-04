import type { Server } from "node:http";
import type { Express } from "express";
import { crearApp } from "./app";
import { conectarBase, desconectarBase } from "./config/db";
import { direccionesDeRed } from "./config/direcciones";
import { env } from "./config/env";
import { mensajeFallaArranque } from "./config/fallas-arranque";
import { cargarSeed } from "./seed/cargar-seed";

function escuchar(app: Express, puerto: number, host: string): Promise<Server> {
  return new Promise((resolve, reject) => {
    const servidor = app.listen(puerto, host);
    servidor.once("listening", () => resolve(servidor));
    servidor.once("error", reject);
  });
}

async function arrancar(): Promise<void> {
  const { almacenamiento } = await conectarBase();
  if (almacenamiento === "memoria") await cargarSeed();

  const servidor = await escuchar(crearApp({ almacenamiento }), env.PORT, env.HOST);

  // console.log y no el logger: el arranque se ve aunque LOG_LEVEL=silent.
  console.log("AI Ticket It API escuchando");
  console.log(`  Local: http://localhost:${env.PORT}/api`);
  for (const { direccion, interfaz } of direccionesDeRed()) {
    console.log(`  Red:   http://${direccion}:${env.PORT}/api (${interfaz})`);
  }
  console.log(
    almacenamiento === "memoria"
      ? "Almacenamiento: MongoDB en memoria con datos de ejemplo"
      : "Almacenamiento: MongoDB externo",
  );

  const apagar = async () => {
    await new Promise<void>((resolve) => servidor.close(() => resolve()));
    await desconectarBase();
    process.exit(0);
  };
  process.once("SIGINT", () => void apagar());
  process.once("SIGTERM", () => void apagar());
}

arrancar().catch(async (error: unknown) => {
  console.error(mensajeFallaArranque(error, env.PORT));
  await desconectarBase().catch(() => undefined);
  process.exit(1);
});
