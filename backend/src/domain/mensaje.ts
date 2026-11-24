import { LIMITES_MENSAJE } from "@ai-ticket-it/shared";
import { Invariantes } from "./invariantes";

export interface PropiedadesMensaje {
  autorId: string;
  /** Ya recortado (lo recorta la validación de la entrada): entre 1 y 500 caracteres. */
  texto: string;
  /** La fija el servidor con su reloj. */
  enviadoEn: Date;
}

const esTextoValido = (texto: string): boolean =>
  texto.length >= 1 && texto.length <= LIMITES_MENSAJE.largoMaximo && texto === texto.trim();

/**
 * Un mensaje del chat de una compra (feature 011): vive dentro del agregado `Compra` y se guarda con
 * él, sin id propio (su posición en la conversación lo identifica). Inmutable: no se edita ni se
 * borra. Que el autor sea el comprador o el organizador del evento lo verifica el service.
 */
export class Mensaje {
  readonly autorId: string;
  readonly texto: string;
  readonly enviadoEn: Date;

  constructor({ autorId, texto, enviadoEn }: PropiedadesMensaje) {
    new Invariantes()
      .exigir(autorId.length > 0, "autorId", "Es obligatorio.")
      .exigir(
        esTextoValido(texto),
        "texto",
        `Debe tener entre 1 y ${LIMITES_MENSAJE.largoMaximo} caracteres, sin espacios al principio ni al final.`,
      )
      .exigir(
        enviadoEn instanceof Date && !Number.isNaN(enviadoEn.getTime()),
        "enviadoEn",
        "Debe ser una fecha válida.",
      )
      .verificar();
    this.autorId = autorId;
    this.texto = texto;
    this.enviadoEn = new Date(enviadoEn);
    Object.freeze(this);
  }
}
