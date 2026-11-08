import { existsSync } from "node:fs";
import path from "node:path";
import { parsearEnv } from "./env-esquema";

// Se resuelve desde este módulo (no desde process.cwd()) para que funcione igual si el
// comando se lanza desde la raíz o desde backend/. En test no se lee: los tests no dependen
// de la configuración local.
const rutaEnv = path.resolve(import.meta.dirname, "../../.env");
if (process.env.NODE_ENV !== "test" && existsSync(rutaEnv)) {
  process.loadEnvFile(rutaEnv);
}

export const env = parsearEnv(process.env);
