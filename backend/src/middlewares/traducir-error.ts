import { DatosInvalidosError, ReglaDeNegocioError } from "../domain/errores";
import {
  ConflictoError,
  CuerpoDemasiadoGrandeError,
  EntradaInvalidaError,
  ErrorAplicacion,
  JsonInvalidoError,
} from "../errors/index";

/** Tipo que `express.json()` pone en sus errores (`entity.parse.failed`, `entity.too.large`). */
function tipoDeErrorDelParser(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "type" in error) {
    return typeof error.type === "string" ? error.type : undefined;
  }
  return undefined;
}

/**
 * Lleva cualquier error **esperado** a un `ErrorAplicacion`: de aplicación, de dominio
 * (DatosInvalidos → 400 ENTRADA_INVALIDA, ReglaDeNegocio → 409 con su código) o del parser
 * de JSON. Devuelve `undefined` si es inesperado: ese se registra completo y responde 500.
 * Lo usan los dos middlewares de error, así clasifican igual.
 */
export function aErrorAplicacion(error: unknown): ErrorAplicacion | undefined {
  if (error instanceof ErrorAplicacion) return error;
  if (error instanceof DatosInvalidosError) return new EntradaInvalidaError([...error.detalles]);
  if (error instanceof ReglaDeNegocioError) return new ConflictoError(error.codigo, error.message);
  const tipo = tipoDeErrorDelParser(error);
  if (tipo === "entity.parse.failed") return new JsonInvalidoError();
  if (tipo === "entity.too.large") return new CuerpoDemasiadoGrandeError();
  return undefined;
}
