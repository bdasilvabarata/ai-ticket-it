import type { CompraVista, DatosCompra, MisComprasDelEventoVista } from "@ai-ticket-it/shared";

import type { ClienteApi } from "./cliente";

const rutaDelEvento = (eventoId: string) => `/eventos/${encodeURIComponent(eventoId)}`;

/**
 * `POST /eventos/:eventoId/compras`: solo el tipo y la cantidad (el total lo calcula el servidor). Va
 * en nombre del usuario de la pantalla y no se reintenta solo.
 */
export function comprarEntradas(
  cliente: ClienteApi,
  eventoId: string,
  { tipoEntradaId, cantidad }: DatosCompra,
  { usuarioId }: { usuarioId: string },
): Promise<CompraVista> {
  const datos: DatosCompra = { tipoEntradaId, cantidad };
  return cliente.post<CompraVista>(`${rutaDelEvento(eventoId)}/compras`, datos, { usuarioId });
}

/** `GET /eventos/:eventoId/mis-compras`: las pendientes y el tope restante del usuario actual. */
export function obtenerMisComprasDelEvento(
  cliente: ClienteApi,
  eventoId: string,
  opciones: { signal?: AbortSignal } = {},
): Promise<MisComprasDelEventoVista> {
  return cliente.get<MisComprasDelEventoVista>(`${rutaDelEvento(eventoId)}/mis-compras`, {
    signal: opciones.signal,
  });
}
