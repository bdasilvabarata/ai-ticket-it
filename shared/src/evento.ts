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
  /** Nuevo en la 005: nada se quita (FR-030). */
  organizador: OrganizadorVista;
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

/** Criterios de orden del catálogo (Explorar). Los usan la validación, el dominio y la app. */
export const ORDENES_CATALOGO = ["fecha", "precio", "puntaje"] as const;

export type OrdenCatalogo = (typeof ORDENES_CATALOGO)[number];

/** Sentido del criterio principal del orden (los desempates no se invierten). */
export const SENTIDOS_CATALOGO = ["asc", "desc"] as const;

export type SentidoCatalogo = (typeof SENTIDOS_CATALOGO)[number];

/** El sentido de cada criterio si no se pide otro: lo más próximo, lo más barato, lo mejor calificado. */
export const SENTIDO_INICIAL: Readonly<Record<OrdenCatalogo, SentidoCatalogo>> = {
  fecha: "asc",
  precio: "asc",
  puntaje: "desc",
};

/** Límites de la búsqueda del catálogo: los valida el servidor y la app los usa en `maxLength`. */
export const LIMITES_BUSQUEDA = { texto: 100 } as const;

/** Lo que pide la app al catálogo: los vacíos no se mandan. */
export interface ConsultaCatalogo {
  texto?: string;
  categoriaId?: string;
  orden?: OrdenCatalogo;
  /** Sin valor: `SENTIDO_INICIAL[orden]`. */
  sentido?: SentidoCatalogo;
  /** Página pedida, desde 1 (feature 013). Sin valor: la 1. */
  pagina?: number;
}

/** Organizador de un evento con su puntaje (las reseñas de todos sus eventos). */
export interface OrganizadorVista {
  id: string;
  nombre: string;
  apellido: string;
  /** Promedio sin redondear; `null` = sin reseñas (nunca 0). */
  puntaje: number | null;
  cantidadResenias: number;
}

/** Evento en Explorar. */
export interface EventoCatalogoVista extends EventoResumenVista {
  /** Menor precio de todos sus tipos; 0 = gratis. */
  precioDesde: number;
  /** Todos sus tipos con cupo 0. */
  agotado: boolean;
  organizador: OrganizadorVista;
}

/** Respuesta de `GET /eventos`. */
export interface CatalogoVista {
  eventos: EventoCatalogoVista[];
  /** Hay eventos no realizados, antes de aplicar texto y categoría (decide el vacío). */
  hayEventosProximos: boolean;
}
