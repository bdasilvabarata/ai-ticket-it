import type { DetalleError } from "@ai-ticket-it/shared";

/** Error con significado HTTP: el error handler lo traduce a su status y al formato ErrorApi. */
export class ErrorAplicacion extends Error {
  readonly status: number;
  readonly codigo: string;
  readonly mensaje: string;
  readonly detalles?: DetalleError[];

  constructor(status: number, codigo: string, mensaje: string, detalles?: DetalleError[]) {
    super(mensaje);
    this.name = new.target.name;
    this.status = status;
    this.codigo = codigo;
    this.mensaje = mensaje;
    this.detalles = detalles;
  }
}

/** 400: parámetros, consulta o cuerpo que no cumplen el esquema. */
export class EntradaInvalidaError extends ErrorAplicacion {
  constructor(detalles: DetalleError[]) {
    super(400, "ENTRADA_INVALIDA", "Los datos enviados no son válidos.", detalles);
  }
}

/** 401: el endpoint requiere un usuario válido en `X-Usuario-Id`. */
export class UsuarioNoIdentificadoError extends ErrorAplicacion {
  constructor() {
    super(401, "USUARIO_NO_IDENTIFICADO", "Tenés que indicar un usuario válido.");
  }
}

/** 403: el usuario no puede operar sobre el recurso. */
export class SinPermisoError extends ErrorAplicacion {
  constructor(mensaje = "No tenés permiso para realizar esta acción.") {
    super(403, "SIN_PERMISO", mensaje);
  }
}

/** 404: recurso inexistente (por ejemplo, `USUARIO_NO_ENCONTRADO`). */
export class NoEncontradoError extends ErrorAplicacion {
  constructor(codigo: string, mensaje: string) {
    super(404, codigo, mensaje);
  }
}

/** 409: conflicto de estado o de cupo. */
export class ConflictoError extends ErrorAplicacion {
  constructor(codigo: string, mensaje: string) {
    super(409, codigo, mensaje);
  }
}

/** 400: el cuerpo del pedido no es JSON válido. */
export class JsonInvalidoError extends ErrorAplicacion {
  constructor() {
    super(400, "JSON_INVALIDO", "El cuerpo del pedido no es JSON válido.");
  }
}

/** 413: el cuerpo del pedido supera el límite de tamaño. */
export class CuerpoDemasiadoGrandeError extends ErrorAplicacion {
  constructor() {
    super(413, "CUERPO_DEMASIADO_GRANDE", "El cuerpo del pedido supera el máximo de 100 kB.");
  }
}
