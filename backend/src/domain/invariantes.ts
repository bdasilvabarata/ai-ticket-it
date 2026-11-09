import type { DetalleError } from "@ai-ticket-it/shared";
import { DatosInvalidosError } from "./errores";

/**
 * Junta las violaciones de invariantes de una entidad y las informa todas juntas, con un
 * detalle por campo, como `DatosInvalidosError`.
 */
export class Invariantes {
  readonly #problemas: DetalleError[] = [];

  exigir(condicion: boolean, campo: string, mensaje: string): this {
    if (!condicion) this.#problemas.push({ campo, mensaje });
    return this;
  }

  verificar(): void {
    if (this.#problemas.length > 0) throw new DatosInvalidosError([...this.#problemas]);
  }
}

export const esTextoConContenido = (valor: string): boolean => valor.trim().length > 0;
export const esEnteroNoNegativo = (valor: number): boolean => Number.isInteger(valor) && valor >= 0;
