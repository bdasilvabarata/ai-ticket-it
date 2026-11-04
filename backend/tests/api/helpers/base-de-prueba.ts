import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach } from "vitest";

/**
 * Base MongoDB en memoria propia del archivo de test. Con `sembrar` (default) carga los datos
 * de ejemplo antes de cada test; si no, vacía todas las colecciones.
 */
export function usarBaseDePrueba(opciones: { sembrar?: boolean } = {}): void {
  const { sembrar = true } = opciones;
  let servidor: MongoMemoryServer | undefined;

  beforeAll(async () => {
    servidor = await MongoMemoryServer.create();
    await mongoose.connect(servidor.getUri());
  });

  beforeEach(async () => {
    if (sembrar) {
      // Import dinámico: un test con { sembrar: false } no depende de que exista el seed.
      const { cargarSeed } = await import("../../../src/seed/cargar-seed");
      await cargarSeed();
    } else {
      for (const coleccion of Object.values(mongoose.connection.collections)) {
        await coleccion.deleteMany({});
      }
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await servidor?.stop();
  });
}
