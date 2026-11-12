import { LIMITES_COMPRA } from "@ai-ticket-it/shared";
import { z } from "zod";
import { idSchema, obligatorio } from "./comunes";
import { crearValidacion } from "./validacion";

// Forma de la entrada de las compras (contracts/api.md). Las reglas (tipo del evento, tope, cupo…)
// son del dominio y del service.

const paramsEvento = z.object({ eventoId: idSchema });

const MENSAJE_CANTIDAD = `Debe ser un entero entre 1 y ${LIMITES_COMPRA.entradasPorEvento}.`;

/**
 * Cuerpo de `POST /eventos/:eventoId/compras`. Las claves desconocidas (`precio`, `total`…) se
 * descartan: el total lo calcula el servidor.
 */
const datosCompraSchema = z.object({
  tipoEntradaId: idSchema,
  cantidad: z
    .number({ error: obligatorio(MENSAJE_CANTIDAD) })
    .int(MENSAJE_CANTIDAD)
    .min(1, MENSAJE_CANTIDAD)
    .max(LIMITES_COMPRA.entradasPorEvento, MENSAJE_CANTIDAD),
});

/** `POST /eventos/:eventoId/compras`. */
export const compraNueva = crearValidacion({ params: paramsEvento, body: datosCompraSchema });

/** `GET /eventos/:eventoId/mis-compras`. */
export const comprasDelEvento = crearValidacion({ params: paramsEvento });

/** `GET /compras/:compraId` y `POST /compras/:compraId/pago`. */
export const compraPorId = crearValidacion({ params: z.object({ compraId: idSchema }) });
