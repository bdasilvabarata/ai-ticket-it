import { env } from "./env";

const silencioso = () => env.LOG_LEVEL === "silent";

/** Logger mínimo sobre console. Es un objeto para que los tests puedan espiarlo. */
export const logger = {
  info(mensaje: string): void {
    if (!silencioso()) console.log(mensaje);
  },
  error(mensaje: string, error?: unknown): void {
    if (silencioso()) return;
    if (error === undefined) console.error(mensaje);
    else console.error(mensaje, error);
  },
};
