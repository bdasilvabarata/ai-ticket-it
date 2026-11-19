import { z } from "zod";
import { idSchema, obligatorio } from "./comunes";
import { crearValidacion } from "./validacion";

// Forma de la entrada de las rutas de entradas (feature 008, contracts/api.md). El código se
// normaliza y se busca en el service: acá solo se limita su forma.

const LARGO_MAXIMO_DEL_CODIGO = 32;
const MENSAJE_CODIGO = `Debe ser un texto de 1 a ${LARGO_MAXIMO_DEL_CODIGO} caracteres.`;

const paramsEntrada = z.object({
  eventoId: idSchema,
  codigo: z
    .string({ error: obligatorio(MENSAJE_CODIGO) })
    .min(1, MENSAJE_CODIGO)
    .max(LARGO_MAXIMO_DEL_CODIGO, MENSAJE_CODIGO),
});

/** `GET /eventos/:eventoId/entradas/:codigo` y `POST …/uso` (sin cuerpo: si llega uno, se ignora). */
export const entradaPorCodigo = crearValidacion({ params: paramsEntrada });
