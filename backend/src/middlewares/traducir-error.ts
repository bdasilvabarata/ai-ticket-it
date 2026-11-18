import { DatosInvalidosError, ReglaDeNegocioError } from "../domain/errores";
import {
  CompraNoEncontradaError,
  ConflictoError,
  CuerpoDemasiadoGrandeError,
  EntradaInvalidaError,
  EntradaNoEncontradaError,
  ErrorAplicacion,
  JsonInvalidoError,
  type OrigenDeReferencia,
  NoEncontradoError,
  ReferenciaInvalidaError,
  SinPermisoError,
  UsuarioNoIdentificadoError,
} from "../errors/index";

/**
 * La parte del pedido de cada origen de una referencia: un origen nuevo no compila sin su prefijo.
 */
const PREFIJO: Record<OrigenDeReferencia, string> = { datos: "body", consulta: "query" };

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
  // El campo de una referencia inválida viene del cuerpo (datos) o de la query (consulta): el
  // detalle lo nombra como los de zod.
  if (error instanceof ReferenciaInvalidaError) {
    return new EntradaInvalidaError([
      { campo: `${PREFIJO[error.origen]}.${error.campo}`, mensaje: error.mensaje },
    ]);
  }
  if (error instanceof ErrorAplicacion) return error;
  if (error instanceof DatosInvalidosError) return new EntradaInvalidaError([...error.detalles]);
  if (error instanceof ReglaDeNegocioError) return new ConflictoError(error.codigo, error.message);
  const tipo = tipoDeErrorDelParser(error);
  if (tipo === "entity.parse.failed") return new JsonInvalidoError();
  if (tipo === "entity.too.large") return new CuerpoDemasiadoGrandeError();
  return undefined;
}

type ClaseDeError = abstract new (...argumentos: never[]) => ErrorAplicacion;

/** El status HTTP de cada error de aplicación: el único lugar que lo conoce. */
const STATUS: ReadonlyArray<readonly [ClaseDeError, number]> = [
  [EntradaInvalidaError, 400],
  [ReferenciaInvalidaError, 400],
  [JsonInvalidoError, 400],
  [UsuarioNoIdentificadoError, 401],
  [SinPermisoError, 403],
  [NoEncontradoError, 404],
  [CompraNoEncontradaError, 404],
  [EntradaNoEncontradaError, 404],
  [ConflictoError, 409],
  [CuerpoDemasiadoGrandeError, 413],
];

/** Un error de aplicación sin status en la tabla es un error de programación: 500. */
export function statusDe(error: ErrorAplicacion): number {
  return STATUS.find(([Clase]) => error instanceof Clase)?.[1] ?? 500;
}
