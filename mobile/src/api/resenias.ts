import type { DatosResenia, ReseniasDelOrganizadorVista, ReseniaVista } from "@ai-ticket-it/shared";

import type { ClienteApi } from "./cliente";

const rutaDelEvento = (eventoId: string) => `/eventos/${encodeURIComponent(eventoId)}`;

/**
 * Lo que envía el formulario de reseña: lo elegido y lo escrito tal cual, sin validar. Sin puntuación
 * elegida va `null`, y el servidor responde el 400 que la pantalla muestra junto al selector.
 */
export type CuerpoResenia = Omit<DatosResenia, "puntuacion" | "comentario"> & {
  puntuacion: number | null;
  comentario: string;
};

/**
 * `POST /eventos/:eventoId/resenias` (feature 012): solo la puntuación y el comentario, sin recortar
 * (el autor y la fecha los pone el servidor, que también valida). Va en nombre del usuario de la
 * pantalla y no se reintenta solo.
 */
export function reseniarEvento(
  cliente: ClienteApi,
  eventoId: string,
  { puntuacion, comentario }: CuerpoResenia,
  { usuarioId }: { usuarioId: string },
): Promise<ReseniaVista> {
  const datos: CuerpoResenia = { puntuacion, comentario };
  return cliente.post<ReseniaVista>(`${rutaDelEvento(eventoId)}/resenias`, datos, { usuarioId });
}

/**
 * `GET /eventos/:eventoId/resenias-del-organizador/resumen` (feature 013, R5): el organizador del
 * evento con el puntaje y la cantidad de todas sus reseñas y las 3 más recientes (la sección del
 * detalle). Público en el servidor.
 */
export function obtenerResumenDeResenias(
  cliente: ClienteApi,
  eventoId: string,
  opciones: { signal?: AbortSignal } = {},
): Promise<ReseniasDelOrganizadorVista> {
  return cliente.get<ReseniasDelOrganizadorVista>(
    `${rutaDelEvento(eventoId)}/resenias-del-organizador/resumen`,
    { signal: opciones.signal },
  );
}
