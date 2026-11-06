import { z } from "zod";

/** Identificador de 24 caracteres hexadecimales (ObjectId). */
export const idSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Debe ser un identificador válido.");

export function esIdValido(valor: string): boolean {
  return idSchema.safeParse(valor).success;
}
