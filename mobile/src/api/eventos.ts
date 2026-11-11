import type {
  DatosEvento,
  DatosTipoEntrada,
  EventoResumenVista,
  EventoVista,
  TipoEntradaVista,
} from "@ai-ticket-it/shared";

import type { ClienteApi } from "./cliente";

/**
 * Lo que envía un formulario: la app no duplica las reglas del servidor (research R13). Un número
 * que la persona no escribió bien viaja como texto (o `null` si está vacío), y lo que no eligió,
 * como `null`; el servidor responde el 400 con el detalle de cada campo.
 */
type Escrito<T> = T | string | null;

export type CuerpoTipoEntrada = Omit<DatosTipoEntrada, "precio" | "cupo"> & {
  precio: Escrito<number>;
  cupo: Escrito<number>;
};

export type CuerpoEvento = Omit<DatosEvento, "categoriaId" | "fechaHora"> & {
  categoriaId: string | null;
  fechaHora: string | null;
};

export type CuerpoNuevoEvento = CuerpoEvento & { tiposEntrada: CuerpoTipoEntrada[] };

interface ConSignal {
  signal?: AbortSignal;
}

/** Las escrituras van en nombre del usuario **del formulario** (research R12) y no se reintentan solas. */
interface EnNombreDe {
  usuarioId: string;
}

const rutaDelEvento = (eventoId: string) => `/eventos/${encodeURIComponent(eventoId)}`;
const rutaDelTipo = (eventoId: string, tipoId: string) =>
  `${rutaDelEvento(eventoId)}/tipos-entrada/${encodeURIComponent(tipoId)}`;

/** `GET /eventos/mios`: los eventos que organiza el usuario actual, en el orden del servidor. */
export function listarMisEventos(
  cliente: ClienteApi,
  opciones: ConSignal = {},
): Promise<EventoResumenVista[]> {
  return cliente.get<EventoResumenVista[]>("/eventos/mios", { signal: opciones.signal });
}

/** `GET /eventos/:eventoId`: el evento con sus tipos de entrada. */
export function obtenerEvento(
  cliente: ClienteApi,
  eventoId: string,
  opciones: ConSignal = {},
): Promise<EventoVista> {
  return cliente.get<EventoVista>(rutaDelEvento(eventoId), { signal: opciones.signal });
}

/** `POST /eventos`. */
export function crearEvento(cliente: ClienteApi, datos: CuerpoNuevoEvento, { usuarioId }: EnNombreDe) {
  return cliente.post<EventoVista>("/eventos", datos, { usuarioId });
}

/** `PUT /eventos/:eventoId`: reemplaza los datos del evento; los tipos no se tocan. */
export function actualizarEvento(
  cliente: ClienteApi,
  eventoId: string,
  datos: CuerpoEvento,
  { usuarioId }: EnNombreDe,
): Promise<EventoVista> {
  return cliente.put<EventoVista>(rutaDelEvento(eventoId), datos, { usuarioId });
}

/** `DELETE /eventos/:eventoId` → `undefined` (204). */
export function eliminarEvento(
  cliente: ClienteApi,
  eventoId: string,
  { usuarioId }: EnNombreDe,
): Promise<void> {
  return cliente.delete<void>(rutaDelEvento(eventoId), { usuarioId });
}

/** `POST /eventos/:eventoId/tipos-entrada`. */
export function agregarTipoEntrada(
  cliente: ClienteApi,
  eventoId: string,
  datos: CuerpoTipoEntrada,
  { usuarioId }: EnNombreDe,
): Promise<TipoEntradaVista> {
  return cliente.post<TipoEntradaVista>(`${rutaDelEvento(eventoId)}/tipos-entrada`, datos, { usuarioId });
}

/** `PUT /eventos/:eventoId/tipos-entrada/:tipoId` (el cupo es el disponible). */
export function editarTipoEntrada(
  cliente: ClienteApi,
  eventoId: string,
  tipoId: string,
  datos: CuerpoTipoEntrada,
  { usuarioId }: EnNombreDe,
): Promise<TipoEntradaVista> {
  return cliente.put<TipoEntradaVista>(rutaDelTipo(eventoId, tipoId), datos, { usuarioId });
}

/** `DELETE /eventos/:eventoId/tipos-entrada/:tipoId` → `undefined` (204). */
export function quitarTipoEntrada(
  cliente: ClienteApi,
  eventoId: string,
  tipoId: string,
  { usuarioId }: EnNombreDe,
): Promise<void> {
  return cliente.delete<void>(rutaDelTipo(eventoId, tipoId), { usuarioId });
}
