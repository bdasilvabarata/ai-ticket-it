import type { OrganizadorVista } from "./evento";

/** Límites de una reseña (feature 012): los usan la validación y el dominio. */
export const LIMITES_RESENIA = {
  puntuacionMinima: 1,
  puntuacionMaxima: 5,
  comentarioLargoMaximo: 500,
} as const;

/**
 * Cuerpo de `POST /eventos/:eventoId/resenias`: la puntuación (entero de 1 a 5) y un comentario
 * opcional. El autor, el evento y la fecha los pone el servidor.
 */
export interface DatosResenia {
  puntuacion: number;
  comentario?: string;
}

/** La reseña propia: en la compra (`CompraVista.resenia`) y en la respuesta del alta. */
export interface ReseniaVista {
  id: string;
  eventoId: string;
  /** Entero de 1 a 5. */
  puntuacion: number;
  /** Ya recortado; `null` si no se escribió nada. */
  comentario: string | null;
  /** Instante ISO UTC (reloj del servidor). */
  creadaEn: string;
  /** "YYYY-MM-DDTHH:mm", hora de Buenos Aires. */
  creadaEnLocal: string;
}

/** Una reseña en "Reseñas del organizador": sin el id del autor, compras ni códigos (FR-016). */
export interface ReseniaDelOrganizadorVista {
  id: string;
  /** Entero de 1 a 5. */
  puntuacion: number;
  /** Ya recortado; `null` si no se escribió nada. */
  comentario: string | null;
  /** Solo el nombre (sin id). */
  autor: { nombre: string; apellido: string };
  /** El evento reseñado, uno de los del organizador. */
  evento: { id: string; nombre: string };
  /** Instante ISO UTC (reloj del servidor). */
  creadaEn: string;
  /** "YYYY-MM-DDTHH:mm", hora de Buenos Aires. */
  creadaEnLocal: string;
}

/** Respuesta de `GET /eventos/:eventoId/resenias-del-organizador` (pública). */
export interface ReseniasDelOrganizadorVista {
  /** El organizador del evento con su puntaje (el mismo de la tarjeta y del detalle). */
  organizador: OrganizadorVista;
  /** Las reseñas de todos sus eventos, de la más reciente a la más vieja. */
  resenias: ReseniaDelOrganizadorVista[];
}
