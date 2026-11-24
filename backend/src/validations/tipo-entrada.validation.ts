import { z } from "zod";
import { idSchema } from "./comunes";
import { tipoEntradaSchema } from "./evento.validation";
import { crearValidacion } from "./validacion";

// Forma de la entrada de `/eventos/:eventoId/tipos-entrada` (contracts/api.md).

const paramsEvento = z.object({ eventoId: idSchema });
const paramsTipo = z.object({ eventoId: idSchema, tipoEntradaId: idSchema });

/** `POST`: el cupo inicial es ≥ 1. */
export const tipoEntradaNuevo = crearValidacion({ params: paramsEvento, body: tipoEntradaSchema(1) });

/** `PUT`: el cupo **disponible** es ≥ 0 (0 = agotado). */
export const tipoEntradaEditado = crearValidacion({ params: paramsTipo, body: tipoEntradaSchema(0) });

/** `DELETE`. */
export const tipoEntradaPorId = crearValidacion({ params: paramsTipo });
