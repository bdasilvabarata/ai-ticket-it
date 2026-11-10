import { ReglaDeNegocioError } from "./errores";
import { esEnteroNoNegativo, esTextoConContenido, Invariantes } from "./invariantes";

// En `es`, con sensitivity "base", "Platea" = " PLATEA " = "Plátea", pero "Año" ≠ "Ano" (R14).
const comparadorDeNombres = new Intl.Collator("es", { sensitivity: "base" });

/** ¿Dos nombres de tipo de entrada son "el mismo"? Sin distinguir mayúsculas, tildes ni espacios de los extremos. */
export function mismoNombreDeTipo(a: string, b: string): boolean {
  return comparadorDeNombres.compare(a.trim(), b.trim()) === 0;
}

/** "Futura" = `fechaHora > ahora`: el complemento exacto de "realizado" (research R3). */
function exigirFechaFutura(fechaHora: Date, ahora: Date): void {
  if (!(fechaHora.getTime() > ahora.getTime())) {
    throw new ReglaDeNegocioError("FECHA_NO_FUTURA", "La fecha y hora del evento deben ser futuras.");
  }
}

function hayNombresRepetidos(tipos: readonly TipoEntrada[]): boolean {
  return tipos.some((tipo, i) =>
    tipos.slice(i + 1).some((otro) => mismoNombreDeTipo(tipo.nombre, otro.nombre)),
  );
}

export interface PropiedadesTipoEntrada {
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

  constructor({ id, nombre, descripcion, precio, cupo }: PropiedadesTipoEntrada) {
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

  /** Un tipo nuevo con los datos editados y el mismo `id`; este no cambia. */
  con(datos: DatosDeTipoEntrada): TipoEntrada {
    return new TipoEntrada({ ...datos, id: this.id });
  }
}

/** Datos editables de un tipo de entrada (todo menos el id). */
export type DatosDeTipoEntrada = Omit<PropiedadesTipoEntrada, "id">;

export interface PropiedadesEvento {
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

/** Datos editables de un evento: lo que reemplaza `actualizar` (ni id, ni organizador, ni tipos). */
export type DatosDeEvento = Omit<PropiedadesEvento, "id" | "organizadorId" | "tiposEntrada">;

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

  constructor(datos: PropiedadesEvento) {
    new Invariantes()
      .exigir(esTextoConContenido(datos.nombre), "nombre", "Es obligatorio.")
      .exigir(!Number.isNaN(datos.fechaHora.getTime()), "fechaHora", "Debe ser una fecha válida.")
      .exigir(
        datos.tiposEntrada.length > 0,
        "tiposEntrada",
        "El evento necesita al menos un tipo de entrada.",
      )
      .verificar();
    if (hayNombresRepetidos(datos.tiposEntrada)) {
      throw new ReglaDeNegocioError(
        "NOMBRE_TIPO_ENTRADA_REPETIDO",
        "Ya hay un tipo de entrada con ese nombre en el evento.",
      );
    }
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
   * Fábrica de alta: la fecha tiene que ser futura según `ahora` (el reloj del servidor). Después
   * construye, y el constructor verifica las invariantes.
   */
  static crear(propiedades: PropiedadesEvento, ahora: Date): Evento {
    exigirFechaFutura(propiedades.fechaHora, ahora);
    return new Evento(propiedades);
  }

  /** Realizado desde el instante de inicio, inclusive (`ahora ≥ fechaHora`; research R3). */
  estaRealizado(ahora: Date): boolean {
    return ahora.getTime() >= this.fechaHora.getTime();
  }

  esOrganizadoPor(usuarioId: string): boolean {
    return this.organizadorId === usuarioId;
  }

  buscarTipoEntrada(tipoId: string): TipoEntrada | null {
    return this.tiposEntrada.find((tipo) => tipo.id === tipoId) ?? null;
  }

  /**
   * ¿Algún tipo de entrada tiene un precio entre `min` y `max` (inclusive)? (diagrama de la
   * consigna; lo usa la búsqueda por precio de la feature 005).
   */
  tuPrecioEstaEntre(min: number, max: number): boolean {
    return this.tiposEntrada.some((tipo) => tipo.precio >= min && tipo.precio <= max);
  }
}
