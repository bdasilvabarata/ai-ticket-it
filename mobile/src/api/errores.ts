import type { DetalleError, ErrorApi } from "@ai-ticket-it/shared";

export const CODIGO_RESPUESTA_INESPERADA = "RESPUESTA_INESPERADA";
export const MENSAJE_RESPUESTA_INESPERADA = "El servidor respondió de forma inesperada.";
export const MENSAJE_SERVIDOR_NO_DISPONIBLE = "No se pudo conectar con el servidor.";

export type MotivoServidorNoDisponible = "sin-conexion" | "tiempo-agotado";

/** El servidor respondió con un error (status ≥ 400) o con un cuerpo que no se pudo interpretar. */
export class ErrorDeApi extends Error {
  readonly status: number;
  readonly codigo: string;
  readonly mensaje: string;
  readonly detalles: DetalleError[];

  constructor(status: number, codigo: string, mensaje: string, detalles: DetalleError[] = []) {
    super(mensaje);
    this.name = "ErrorDeApi";
    this.status = status;
    this.codigo = codigo;
    this.mensaje = mensaje;
    this.detalles = detalles;
  }
}

/** No hubo respuesta: falla de conexión o tiempo límite agotado. */
export class ServidorNoDisponibleError extends Error {
  readonly url: string;
  readonly motivo: MotivoServidorNoDisponible;
  readonly mensaje = MENSAJE_SERVIDOR_NO_DISPONIBLE;

  constructor(url: string, motivo: MotivoServidorNoDisponible) {
    super(MENSAJE_SERVIDOR_NO_DISPONIBLE);
    this.name = "ServidorNoDisponibleError";
    this.url = url;
    this.motivo = motivo;
  }
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

function esDetalleError(valor: unknown): valor is DetalleError {
  return esObjeto(valor) && typeof valor.campo === "string" && typeof valor.mensaje === "string";
}

/** El cuerpo tiene el formato único de error de la API (shared, `ErrorApi`). */
export function esErrorApi(valor: unknown): valor is ErrorApi {
  if (!esObjeto(valor) || !esObjeto(valor.error)) return false;
  const { codigo, mensaje, detalles } = valor.error;
  return (
    typeof codigo === "string" &&
    typeof mensaje === "string" &&
    (detalles === undefined || (Array.isArray(detalles) && detalles.every(esDetalleError)))
  );
}
