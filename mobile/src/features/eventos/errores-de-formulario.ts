import { ErrorDeApi, ServidorNoDisponibleError } from "../../api";

/**
 * Errores de un formulario (research R13): cada campo con su mensaje, y uno general para el resto.
 * Los campos son la ruta del cuerpo sin `body.`: `nombre`, `multimedia.0`,
 * `tiposEntrada.1.precio`; `tiposEntrada` es la sección de tipos.
 */
export interface ErroresDeFormulario {
  campos: Record<string, string>;
  mensajeGeneral: string | null;
}

export const SIN_ERRORES: ErroresDeFormulario = { campos: {}, mensajeGeneral: null };

const PREFIJO_CUERPO = "body.";

/**
 * Traduce el error de una escritura a errores del formulario. La app no valida por su cuenta:
 * muestra junto a cada campo lo que respondió el servidor. `formulario` decide dónde va un nombre
 * de tipo repetido: arriba de la sección de tipos (evento) o debajo del nombre (tipo).
 */
export function erroresDeFormulario(
  error: unknown,
  formulario: "evento" | "tipo" | "resenia",
): ErroresDeFormulario {
  // Sin servidor no hay mensaje propio: lo muestra la franja, y lo cargado sigue en el formulario.
  if (error instanceof ServidorNoDisponibleError) return SIN_ERRORES;
  if (!(error instanceof ErrorDeApi)) return { campos: {}, mensajeGeneral: "Ocurrió un error inesperado." };

  if (error.codigo === "FECHA_NO_FUTURA")
    return { campos: { fechaHora: error.mensaje }, mensajeGeneral: null };
  if (error.codigo === "NOMBRE_TIPO_ENTRADA_REPETIDO") {
    const campo = formulario === "evento" ? "tiposEntrada" : "nombre";
    return { campos: { [campo]: error.mensaje }, mensajeGeneral: null };
  }

  const campos: Record<string, string> = {};
  let fueraDelCuerpo = false;
  for (const { campo, mensaje } of error.detalles) {
    if (campo.startsWith(PREFIJO_CUERPO)) campos[campo.slice(PREFIJO_CUERPO.length)] ??= mensaje;
    else fueraDelCuerpo = true;
  }
  const sinCampos = Object.keys(campos).length === 0;
  return { campos, mensajeGeneral: fueraDelCuerpo || sinCampos ? error.mensaje : null };
}

/** 404 del evento o del tipo: la pantalla vuelve a Mis eventos (research R15). */
export function esNoEncontrado(error: unknown): error is ErrorDeApi {
  return error instanceof ErrorDeApi && error.status === 404;
}

/** 409 `EVENTO_REALIZADO`: la ruta del evento pasa a solo lectura. */
export function esEventoRealizado(error: unknown): error is ErrorDeApi {
  return error instanceof ErrorDeApi && error.codigo === "EVENTO_REALIZADO";
}

/**
 * Texto de precio o cupo → lo que se envía: un entero sin signo como número, vacío como `null` y
 * cualquier otra cosa tal cual, para que el servidor responda su mensaje (R13).
 */
export function aNumeroParaEnviar(texto: string): number | string | null {
  const recortado = texto.trim();
  if (recortado === "") return null;
  return /^\d+$/.test(recortado) ? Number(recortado) : texto;
}
