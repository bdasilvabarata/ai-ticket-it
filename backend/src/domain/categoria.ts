import { esTextoConContenido, Invariantes } from "./invariantes";

export interface DatosCategoria {
  id: string;
  nombre: string;
  descripcion: string;
}

/** Catálogo precargado de tipos de evento. */
export class Categoria {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string;

  constructor({ id, nombre, descripcion }: DatosCategoria) {
    new Invariantes().exigir(esTextoConContenido(nombre), "nombre", "Es obligatorio.").verificar();
    this.id = id;
    this.nombre = nombre.trim();
    this.descripcion = descripcion;
  }
}
