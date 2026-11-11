import type { EventoVista, TipoEntradaVista } from "@ai-ticket-it/shared";

import type { CuerpoEvento, CuerpoTipoEntrada } from "../../api";
import { aNumeroParaEnviar } from "./errores-de-formulario";

// Estado de los formularios (data-model, "Mobile: estado de los formularios") y el cuerpo que se
// envía. Sin React: funciones puras.

export interface ValoresEvento {
  nombre: string;
  descripcion: string;
  categoriaId: string | null;
  /** "YYYY-MM-DDTHH:mm" en hora de Buenos Aires, o `null` si todavía no se eligió. */
  fechaHoraLocal: string | null;
  multimedia: string[];
}

export interface ValoresTipoEntrada {
  nombre: string;
  descripcion: string;
  /** Lo que escribió la persona; se envía con `aNumeroParaEnviar`. */
  precio: string;
  cupo: string;
}

export const VALORES_EVENTO_VACIO: ValoresEvento = {
  nombre: "",
  descripcion: "",
  categoriaId: null,
  fechaHoraLocal: null,
  multimedia: [],
};

export const VALORES_TIPO_VACIO: ValoresTipoEntrada = { nombre: "", descripcion: "", precio: "", cupo: "" };

export function valoresDeEvento(evento: EventoVista): ValoresEvento {
  return {
    nombre: evento.nombre,
    descripcion: evento.descripcion,
    categoriaId: evento.categoria.id,
    fechaHoraLocal: evento.fechaHoraLocal,
    multimedia: [...evento.multimedia],
  };
}

export function valoresDeTipo(tipo: TipoEntradaVista): ValoresTipoEntrada {
  return {
    nombre: tipo.nombre,
    descripcion: tipo.descripcion,
    precio: String(tipo.precio),
    cupo: String(tipo.cupo),
  };
}

export function aCuerpoEvento(valores: ValoresEvento): CuerpoEvento {
  return {
    nombre: valores.nombre,
    descripcion: valores.descripcion,
    categoriaId: valores.categoriaId,
    fechaHora: valores.fechaHoraLocal,
    multimedia: valores.multimedia,
  };
}

export function aCuerpoTipo(valores: ValoresTipoEntrada): CuerpoTipoEntrada {
  return {
    nombre: valores.nombre,
    descripcion: valores.descripcion,
    precio: aNumeroParaEnviar(valores.precio),
    cupo: aNumeroParaEnviar(valores.cupo),
  };
}

/** Los errores de un tipo del formulario de creación, que el servidor informa con su índice. */
export function erroresDelTipo(campos: Record<string, string>, indice: number) {
  const de = (campo: string) => campos[`tiposEntrada.${indice}.${campo}`];
  return { nombre: de("nombre"), descripcion: de("descripcion"), precio: de("precio"), cupo: de("cupo") };
}
