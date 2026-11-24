import { EstadoCompra, LIMITES_COMPRA, LIMITES_MENSAJE } from "@ai-ticket-it/shared";
import { z } from "zod";
import { idSchema, obligatorio, paginaSchema, textoObligatorio } from "./comunes";
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

/** `GET /eventos/:eventoId/mis-compras` (feature 006): solo el id del evento. */
export const comprasDelEvento = crearValidacion({ params: paramsEvento });

const MENSAJE_ESTADO = "Debe ser uno de los estados de una compra.";
const MENSAJE_SIN_RESPONDER = "Debe ser true o false.";

/**
 * `GET /eventos/:eventoId/compras` (features 008 y 013, research R4): el id del evento y, en la
 * query, la página, el estado (uno de los cinco) y `sinResponder` (`"true"` o `"false"`, por
 * defecto `false`). Repetido o de otro valor → 400 sobre su campo.
 */
export const consultaComprasDelEvento = crearValidacion({
  params: paramsEvento,
  query: z.object({
    pagina: paginaSchema,
    estado: z.enum(EstadoCompra, { error: MENSAJE_ESTADO }).optional(),
    sinResponder: z
      .enum(["true", "false"], { error: MENSAJE_SIN_RESPONDER })
      .optional()
      .transform((valor) => valor === "true"),
  }),
});

/** `GET /compras/:compraId`, `POST /compras/:compraId/pago` y `GET /compras/:compraId/mensajes`. */
export const compraPorId = crearValidacion({ params: z.object({ compraId: idSchema }) });

/**
 * `POST /compras/:compraId/mensajes` (feature 011, R3): el texto, recortado, de 1 a 500 caracteres.
 * Las claves desconocidas (`autorId`, `enviadoEn`, `numero`…) se descartan: el autor es el usuario
 * actual y la fecha, la del reloj del servidor.
 */
export const mensajeNuevo = crearValidacion({
  params: z.object({ compraId: idSchema }),
  body: z.object({ texto: textoObligatorio(LIMITES_MENSAJE.largoMaximo) }),
});
