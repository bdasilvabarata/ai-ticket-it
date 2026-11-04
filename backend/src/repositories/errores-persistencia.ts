import type { DetalleError } from "@ai-ticket-it/shared";
import mongoose from "mongoose";
import { ConflictoError, EntradaInvalidaError, type ErrorAplicacion } from "../errors/index";

const { CastError, ValidationError } = mongoose.Error;

function detalleDeValidacion(
  campo: string,
  error: mongoose.Error.ValidatorError | mongoose.Error.CastError,
): DetalleError {
  // Los validadores propios del esquema ya tienen mensaje en español; los de Mongoose, no.
  if (error.kind === "required") return { campo, mensaje: "Es obligatorio." };
  if (error.kind === "user defined") return { campo, mensaje: error.message };
  return { campo, mensaje: "No es válido." };
}

/**
 * Traduce errores de Mongo/Mongoose a errores de aplicación (red de seguridad del error
 * handler). Vive en `repositories/` porque es la única capa que conoce Mongoose (principio
 * III). Las features pueden lanzar errores más específicos antes de llegar acá.
 * Devuelve `undefined` si no es un error de persistencia conocido.
 */
export function traducirErrorPersistencia(error: unknown): ErrorAplicacion | undefined {
  if (error instanceof ValidationError) {
    // La clave trae la ruta completa (`tiposEntrada.0.precio`); en subdocumentos `path` no.
    return new EntradaInvalidaError(
      Object.entries(error.errors).map(([campo, detalle]) => detalleDeValidacion(campo, detalle)),
    );
  }
  if (error instanceof CastError) {
    return new EntradaInvalidaError([{ campo: error.path, mensaje: "Tiene un formato inválido." }]);
  }
  if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
    return new ConflictoError("RECURSO_DUPLICADO", "Ya existe un recurso con esos datos.");
  }
  return undefined;
}
