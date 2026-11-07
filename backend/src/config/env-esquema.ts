import { z } from "zod";

const esquema = z.object({
  PORT: z.coerce
    .number({ error: "debe ser un número" })
    .int("debe ser un entero")
    .min(1, "debe estar entre 1 y 65535")
    .max(65535, "debe estar entre 1 y 65535")
    .default(3000),
  HOST: z.string().min(1, "no puede estar vacía").default("0.0.0.0"),
  LOG_LEVEL: z.enum(["info", "silent"], { error: 'debe ser "info" o "silent"' }).default("info"),
});

export type Env = z.output<typeof esquema>;

/**
 * Valida las variables de entorno. Puro: no lee archivos ni `process.env`.
 * Con `NODE_ENV=test` el nivel de log es siempre `silent`.
 */
export function parsearEnv(fuente: Record<string, string | undefined>): Env {
  const resultado = esquema.safeParse({
    PORT: fuente.PORT,
    HOST: fuente.HOST,
    LOG_LEVEL: fuente.LOG_LEVEL,
  });
  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map((problema) => `${problema.path.join(".")} ${problema.message}`)
      .join("; ");
    throw new Error(`Configuración inválida: ${problemas}.`);
  }
  const env = resultado.data;
  return fuente.NODE_ENV === "test" ? { ...env, LOG_LEVEL: "silent" } : env;
}
