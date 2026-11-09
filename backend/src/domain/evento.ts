import { esEnteroNoNegativo, esTextoConContenido, Invariantes } from "./invariantes";

export interface DatosTipoEntrada {
  id: string;
  nombre: string;
  descripcion: string;
  /** Pesos argentinos enteros, ≥ 0. */
  precio: number;
  /** Entradas disponibles: entero ≥ 0 que decrece con cada compra (constitución, "Cupo"). */
  cupo: number;
}

/** Tipo de entrada de un evento (General, Platea, VIP…), con su precio y cupo disponible. */
export class TipoEntrada {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly precio: number;
  readonly cupo: number;

  constructor({ id, nombre, descripcion, precio, cupo }: DatosTipoEntrada) {
    new Invariantes()
      .exigir(esTextoConContenido(nombre), "nombre", "Es obligatorio.")
      .exigir(esEnteroNoNegativo(precio), "precio", "Debe ser un entero mayor o igual a 0.")
      .exigir(esEnteroNoNegativo(cupo), "cupo", "Debe ser un entero mayor o igual a 0.")
      .verificar();
    this.id = id;
    this.nombre = nombre.trim();
    this.descripcion = descripcion;
    this.precio = precio;
    this.cupo = cupo;
  }

  /** ¿Se pueden comprar `cantidad` entradas sin dejar el cupo por debajo de 0? (diagrama de la consigna) */
  hayCupoPara(cantidad: number): boolean {
    return Number.isInteger(cantidad) && cantidad > 0 && cantidad <= this.cupo;
  }
}

export interface DatosEvento {
  id: string;
  nombre: string;
  descripcion: string;
  categoriaId: string;
  /** Instante UTC. */
  fechaHora: Date;
  /** URLs de imágenes. */
  multimedia: string[];
  organizadorId: string;
  tiposEntrada: TipoEntrada[];
}

/** Evento publicado por un organizador, con uno o más tipos de entrada. */
export class Evento {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly categoriaId: string;
  readonly fechaHora: Date;
  readonly multimedia: readonly string[];
  readonly organizadorId: string;
  readonly tiposEntrada: readonly TipoEntrada[];

  constructor(datos: DatosEvento) {
    new Invariantes()
      .exigir(esTextoConContenido(datos.nombre), "nombre", "Es obligatorio.")
      .exigir(!Number.isNaN(datos.fechaHora.getTime()), "fechaHora", "Debe ser una fecha válida.")
      .exigir(
        datos.tiposEntrada.length > 0,
        "tiposEntrada",
        "El evento necesita al menos un tipo de entrada.",
      )
      .verificar();
    this.id = datos.id;
    this.nombre = datos.nombre.trim();
    this.descripcion = datos.descripcion;
    this.categoriaId = datos.categoriaId;
    this.fechaHora = datos.fechaHora;
    this.multimedia = [...datos.multimedia];
    this.organizadorId = datos.organizadorId;
    this.tiposEntrada = [...datos.tiposEntrada];
  }

  /**
   * ¿Algún tipo de entrada tiene un precio entre `min` y `max` (inclusive)? (diagrama de la
   * consigna; lo usa la búsqueda por precio de la feature 004).
   */
  tuPrecioEstaEntre(min: number, max: number): boolean {
    return this.tiposEntrada.some((tipo) => tipo.precio >= min && tipo.precio <= max);
  }
}
