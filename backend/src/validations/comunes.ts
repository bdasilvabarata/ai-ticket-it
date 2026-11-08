import { z } from "zod";

/** UUID v4: lo que crean los usuarios (`crypto.randomUUID()`). */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Id legible de los datos de ejemplo: `<tipo>-<slug>` en minúsculas (`usuario-lucia`). */
const ID_LEGIBLE = /^[a-z]+(-[a-z0-9]+)+$/;

/** Identificador de una entidad: UUID o id legible (constitución, principio IV). */
export const idSchema = z
  .string()
  .refine((valor) => UUID_V4.test(valor) || ID_LEGIBLE.test(valor), "Debe ser un identificador válido.");

export function esIdValido(valor: string): boolean {
  return idSchema.safeParse(valor).success;
}
