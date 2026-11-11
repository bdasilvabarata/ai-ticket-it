import { LIMITES_EVENTO, LIMITES_TIPO_ENTRADA } from "@ai-ticket-it/shared";
import { z } from "zod";
import {
  enteroDesde,
  fechaDeParedSchema,
  idSchema,
  obligatorio,
  textoObligatorio,
  textoOpcional,
} from "./comunes";
import { crearValidacion } from "./validacion";

// Forma de la entrada de los endpoints de eventos (contracts/api.md, "Reglas de los cuerpos"). Las
// claves desconocidas se descartan: `organizadorId` en el cuerpo se ignora (FR-009).

const MENSAJE_URL = "Debe ser una URL http o https.";
const MENSAJE_MAXIMO_URLS = `Puede tener como máximo ${LIMITES_EVENTO.multimedia} URLs.`;
const MENSAJE_SIN_TIPOS = "El evento necesita al menos un tipo de entrada.";
export const MENSAJE_CUERPO = "El cuerpo debe ser un objeto JSON.";

function esUrlHttp(valor: string): boolean {
  try {
    const url = new URL(valor);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.length > 0;
  } catch {
    return false;
  }
}

const urlSchema = z.string({ error: MENSAJE_URL }).trim().refine(esUrlHttp, MENSAJE_URL);

/** Datos de un tipo de entrada; `cupoMinimo` es 1 al crearlo y 0 al editarlo (cupo disponible). */
export function tipoEntradaSchema(cupoMinimo: 0 | 1) {
  return z.object(
    {
      nombre: textoObligatorio(LIMITES_TIPO_ENTRADA.nombre),
      descripcion: textoOpcional(LIMITES_TIPO_ENTRADA.descripcion),
      precio: enteroDesde(0),
      cupo: enteroDesde(cupoMinimo),
    },
    { error: MENSAJE_CUERPO },
  );
}

const camposDelEvento = {
  nombre: textoObligatorio(LIMITES_EVENTO.nombre),
  descripcion: textoOpcional(LIMITES_EVENTO.descripcion),
  categoriaId: idSchema,
  fechaHora: fechaDeParedSchema,
  multimedia: z
    .array(urlSchema, { error: MENSAJE_MAXIMO_URLS })
    .max(LIMITES_EVENTO.multimedia, MENSAJE_MAXIMO_URLS)
    .default([]),
};

const paramsEvento = z.object({ eventoId: idSchema });

/** `POST /eventos`: los datos del evento y uno o más tipos de entrada. */
export const eventoNuevo = crearValidacion({
  body: z.object(
    {
      ...camposDelEvento,
      tiposEntrada: z
        .array(tipoEntradaSchema(1), { error: obligatorio(MENSAJE_SIN_TIPOS) })
        .min(1, MENSAJE_SIN_TIPOS),
    },
    { error: MENSAJE_CUERPO },
  ),
});

/** `GET` y `DELETE /eventos/:eventoId`. */
export const eventoPorId = crearValidacion({ params: paramsEvento });

/** `PUT /eventos/:eventoId`: reemplaza los datos del evento; los tipos no se tocan. */
export const eventoEditado = crearValidacion({
  params: paramsEvento,
  body: z.object(camposDelEvento, { error: MENSAJE_CUERPO }),
});

/**
 * `GET /eventos`: la consulta del catálogo. Un `z.object`: las claves desconocidas se descartan.
 */
export const consultaCatalogo = crearValidacion({
  query: z.object({}).transform(() => ({ texto: "", orden: "fecha" as const })),
});
