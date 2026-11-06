import type { Almacenamiento } from "@ai-ticket-it/shared";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { destinoMongo } from "./destino-mongo";
import { env } from "./env";
import { ErrorArranque } from "./fallas-arranque";

let servidorMemoria: MongoMemoryServer | undefined;

/**
 * Conecta Mongoose a `mongoUri` (almacenamiento "externo") o, sin ella, a un MongoDB en
 * memoria standalone ("memoria"). Nunca cae a memoria si hay `mongoUri`.
 */
export async function conectarBase(
  mongoUri: string | undefined = env.MONGO_URI,
  opciones: { timeoutMs?: number } = {},
): Promise<{ almacenamiento: Almacenamiento }> {
  const { timeoutMs = 5000 } = opciones;

  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: timeoutMs });
    } catch (error) {
      await mongoose.disconnect();
      throw new ErrorArranque(
        `No se pudo conectar a MONGO_URI (${destinoMongo(mongoUri).host}). ` +
          "Revisá que la base esté encendida y accesible desde esta máquina.",
        { cause: error },
      );
    }
    return { almacenamiento: "externo" };
  }

  try {
    servidorMemoria = await MongoMemoryServer.create();
  } catch (error) {
    throw new ErrorArranque(
      "No se pudo preparar MongoDB en memoria; la primera ejecución necesita internet para " + "descargarlo.",
      { cause: error },
    );
  }
  await mongoose.connect(servidorMemoria.getUri());
  return { almacenamiento: "memoria" };
}

/** Cierra Mongoose y, si existe, detiene el MongoDB en memoria. */
export async function desconectarBase(): Promise<void> {
  await mongoose.disconnect();
  if (servidorMemoria) {
    const servidor = servidorMemoria;
    servidorMemoria = undefined;
    await servidor.stop();
  }
}
