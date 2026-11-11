import { z } from "zod";
import { instanteDesdeHoraDeBuenosAires } from "../domain/hora-buenos-aires";

/** UUID v4: lo que crean los usuarios (`crypto.randomUUID()`). */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Id legible de los datos de ejemplo: `<tipo>-<slug>` en minúsculas (`usuario-lucia`). */
const ID_LEGIBLE = /^[a-z]+(-[a-z0-9]+)+$/;

export const OBLIGATORIO = "Es obligatorio.";

/**
 * Mensaje de error de tipo de un campo obligatorio (contracts/api.md, "Reglas de los cuerpos"):
 * faltante o `null` → "Es obligatorio."; de otro tipo → el mensaje de la regla.
 */
export function obligatorio(mensajeDeLaRegla: string) {
  return (problema: { input?: unknown }) =>
    problema.input === undefined || problema.input === null ? OBLIGATORIO : mensajeDeLaRegla;
}

const MENSAJE_ID = "Debe ser un identificador válido.";

/** Identificador de una entidad: UUID o id legible (constitución, principio IV). */
export const idSchema = z
  .string({ error: obligatorio(MENSAJE_ID) })
  .refine((valor) => UUID_V4.test(valor) || ID_LEGIBLE.test(valor), MENSAJE_ID);

export function esIdValido(valor: string): boolean {
  return idSchema.safeParse(valor).success;
}

const MENSAJE_FECHA = "Debe ser una fecha y hora válidas (AAAA-MM-DDTHH:mm).";
const FECHA_DE_PARED = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** ¿"YYYY-MM-DDTHH:mm" es una fecha y hora que existen? (rechaza `2026-02-30` y `25:00`). */
function esFechaDeParedReal(valor: string): boolean {
  const partes = FECHA_DE_PARED.exec(valor);
  if (!partes) return false;
  const [anio, mes, dia, hora, minuto] = partes.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia && hora <= 23 && minuto <= 59;
}

/**
 * Fecha y hora de pared de Buenos Aires, sin zona (research R10). Valida el formato y que la
 * fecha exista, y la transforma en el instante que representa. Que sea futura es una regla de
 * negocio (409 `FECHA_NO_FUTURA`), no de forma.
 */
export const fechaDeParedSchema = z
  .string({ error: obligatorio(MENSAJE_FECHA) })
  .refine(esFechaDeParedReal, MENSAJE_FECHA)
  .transform(instanteDesdeHoraDeBuenosAires);

/** Texto obligatorio, recortado, de 1 a `maximo` caracteres. */
export function textoObligatorio(maximo: number) {
  const mensajeMaximo = `Debe tener como máximo ${maximo} caracteres.`;
  return z
    .string({ error: obligatorio(OBLIGATORIO) })
    .trim()
    .min(1, OBLIGATORIO)
    .max(maximo, mensajeMaximo);
}

/** Texto opcional, recortado, de hasta `maximo` caracteres; `""` si falta. */
export function textoOpcional(maximo: number) {
  const mensajeMaximo = `Debe tener como máximo ${maximo} caracteres.`;
  return z.string({ error: mensajeMaximo }).trim().max(maximo, mensajeMaximo).default("");
}

/** Entero ≥ `minimo` (precio y cupo). */
export function enteroDesde(minimo: number) {
  const mensaje = `Debe ser un entero mayor o igual a ${minimo}.`;
  return z
    .number({ error: obligatorio(mensaje) })
    .int(mensaje)
    .min(minimo, mensaje);
}
