import { LIMITES_RESENIA } from "@ai-ticket-it/shared";
import { z } from "zod";
import { idSchema, obligatorio, textoOpcional } from "./comunes";
import { crearValidacion } from "./validacion";

// Forma de la entrada de las reseñas (feature 012, R5; contracts/api.md). Quién puede reseñar y la
// unicidad son reglas del dominio, bajo el cerrojo del evento.

const MENSAJE_PUNTUACION = `Debe ser un entero de ${LIMITES_RESENIA.puntuacionMinima} a ${LIMITES_RESENIA.puntuacionMaxima}.`;

/**
 * `POST /eventos/:eventoId/resenias`: la puntuación (entero de 1 a 5; "Es obligatorio." si falta) y
 * un comentario opcional, recortado, de hasta 500 caracteres (`""` si falta: el service lo pasa a
 * `null`). Las claves desconocidas (`compradorId`, `creadaEn`, `id`…) se descartan: el autor es el
 * usuario actual y la fecha, la del reloj del servidor.
 */
export const reseniaNueva = crearValidacion({
  params: z.object({ eventoId: idSchema }),
  body: z.object({
    puntuacion: z
      .number({ error: obligatorio(MENSAJE_PUNTUACION) })
      .int(MENSAJE_PUNTUACION)
      .min(LIMITES_RESENIA.puntuacionMinima, MENSAJE_PUNTUACION)
      .max(LIMITES_RESENIA.puntuacionMaxima, MENSAJE_PUNTUACION),
    comentario: textoOpcional(LIMITES_RESENIA.comentarioLargoMaximo),
  }),
});
