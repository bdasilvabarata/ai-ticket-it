import type { DetalleError } from "@ai-ticket-it/shared";

/**
 * Error de aplicación: dice **qué** pasó (código y mensaje del contrato `ErrorApi`), sin saber de
 * HTTP. El status lo decide el error handler según la clase (middlewares/traducir-error.ts).
 */
export abstract class ErrorAplicacion extends Error {
  readonly codigo: string;
  readonly mensaje: string;
  readonly detalles?: DetalleError[];

  constructor(codigo: string, mensaje: string, detalles?: DetalleError[]) {
    super(mensaje);
    this.name = new.target.name;
    this.codigo = codigo;
    this.mensaje = mensaje;
    this.detalles = detalles;
  }
}

/** Parámetros, consulta o cuerpo que no cumplen el esquema; un detalle por campo. HTTP: 400. */
export class EntradaInvalidaError extends ErrorAplicacion {
  constructor(detalles: DetalleError[]) {
    super("ENTRADA_INVALIDA", "Los datos enviados no son válidos.", detalles);
  }
}

/**
 * De qué parte de la entrada del caso de uso vino una referencia: los datos que se escriben o la
 * consulta que se hace. En términos del caso de uso, no de HTTP (research R1 de la 005).
 */
export type OrigenDeReferencia = "datos" | "consulta";

/**
 * Un dato de la entrada apunta a algo que no existe (ej.: `categoriaId`). Lleva el nombre del campo
 * tal como lo recibe el service y de dónde vino; el error handler lo informa como 400
 * `ENTRADA_INVALIDA` sobre `body.<campo>` o `query.<campo>`.
 */
export class ReferenciaInvalidaError extends ErrorAplicacion {
  readonly campo: string;
  readonly origen: OrigenDeReferencia;

  constructor(campo: string, mensaje: string, origen: OrigenDeReferencia = "datos") {
    super("ENTRADA_INVALIDA", mensaje);
    this.campo = campo;
    this.origen = origen;
  }
}

/** El endpoint requiere un usuario válido en `X-Usuario-Id`. HTTP: 401. */
export class UsuarioNoIdentificadoError extends ErrorAplicacion {
  constructor() {
    super("USUARIO_NO_IDENTIFICADO", "Tenés que indicar un usuario válido.");
  }
}

/** El usuario no puede operar sobre el recurso. HTTP: 403. */
export class SinPermisoError extends ErrorAplicacion {
  constructor(mensaje = "No tenés permiso para realizar esta acción.") {
    super("SIN_PERMISO", mensaje);
  }
}

/** Recurso inexistente (ej.: `EVENTO_NO_ENCONTRADO`). HTTP: 404. */
export class NoEncontradoError extends ErrorAplicacion {
  constructor(codigo: string, mensaje: string) {
    super(codigo, mensaje);
  }
}

/** La compra no existe (feature 006). HTTP: 404. */
export class CompraNoEncontradaError extends ErrorAplicacion {
  constructor() {
    super("COMPRA_NO_ENCONTRADA", "No existe la compra.");
  }
}

/** Conflicto de estado o de cupo (ej.: una regla del dominio). HTTP: 409. */
export class ConflictoError extends ErrorAplicacion {
  constructor(codigo: string, mensaje: string) {
    super(codigo, mensaje);
  }
}

/** El cuerpo del pedido no es JSON válido. HTTP: 400. */
export class JsonInvalidoError extends ErrorAplicacion {
  constructor() {
    super("JSON_INVALIDO", "El cuerpo del pedido no es JSON válido.");
  }
}

/** El cuerpo del pedido supera el límite de tamaño. HTTP: 413. */
export class CuerpoDemasiadoGrandeError extends ErrorAplicacion {
  constructor() {
    super("CUERPO_DEMASIADO_GRANDE", "El cuerpo del pedido supera el máximo de 100 kB.");
  }
}
