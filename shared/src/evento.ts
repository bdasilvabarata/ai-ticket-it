/** Tipo de entrada de un evento, con su cupo **disponible**. */
export interface TipoEntradaVista {
  id: string;
  nombre: string;
  descripcion: string;
  /** Pesos argentinos enteros; 0 = gratis. */
  precio: number;
  /** Entradas disponibles (≥ 0). */
  cupo: number;
}

/** Evento en una lista (Mis eventos). */
export interface EventoResumenVista {
  id: string;
  nombre: string;
  categoria: { id: string; nombre: string };
  /** Instante ISO UTC. */
  fechaHora: string;
  /** "YYYY-MM-DDTHH:mm", hora de pared de Buenos Aires: lo que muestra la app. */
  fechaHoraLocal: string;
  organizadorId: string;
  /** Calculado por el servidor al consultar: su reloj llegó a `fechaHora`. */
  realizado: boolean;
  cantidadTiposEntrada: number;
}

/** Evento completo, con sus tipos de entrada en el orden en que se agregaron. */
export interface EventoVista extends EventoResumenVista {
  descripcion: string;
  multimedia: string[];
  tiposEntrada: TipoEntradaVista[];
}

/** Cuerpo de alta y edición de un tipo de entrada. */
export interface DatosTipoEntrada {
  nombre: string;
  descripcion?: string;
  precio: number;
  cupo: number;
}

/** Cuerpo de edición de un evento (reemplaza todos sus datos; no toca los tipos). */
export interface DatosEvento {
  nombre: string;
  descripcion?: string;
  categoriaId: string;
  /** "YYYY-MM-DDTHH:mm" en hora de Buenos Aires, sin zona. */
  fechaHora: string;
  /** URLs http/https de imágenes. */
  multimedia?: string[];
}

/** Cuerpo de alta de un evento, con uno o más tipos de entrada. */
export interface DatosNuevoEvento extends DatosEvento {
  tiposEntrada: DatosTipoEntrada[];
}

/** Límites de forma: los valida el servidor y la app los usa en `maxLength`. */
export const LIMITES_EVENTO = { nombre: 100, descripcion: 2000, multimedia: 5 } as const;

export const LIMITES_TIPO_ENTRADA = { nombre: 50, descripcion: 300 } as const;
