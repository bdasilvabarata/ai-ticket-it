import type { DetalleError } from "@ai-ticket-it/shared";

/**
 * Errores de dominio: dicen **qué** pasó en términos del negocio, sin saber de HTTP (no
 * tienen status). El error handler los traduce (middlewares/traducir-error.ts).
 */
export abstract class ErrorDeDominio extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = new.target.name;
  }
}

/** Una entidad no cumple sus invariantes; un detalle por campo. HTTP: 400 ENTRADA_INVALIDA. */
export class DatosInvalidosError extends ErrorDeDominio {
  readonly detalles: readonly DetalleError[];

  constructor(detalles: DetalleError[]) {
    super("Los datos no cumplen las reglas de la entidad.");
    this.detalles = [...detalles];
  }
}

/**
 * Una regla del dominio impide la operación (ej.: `CUPO_INSUFICIENTE`,
 * `COMPRA_NO_CANCELABLE`). HTTP: 409 con el código de la regla.
 */
export class ReglaDeNegocioError extends ErrorDeDominio {
  constructor(
    readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
  }
}
