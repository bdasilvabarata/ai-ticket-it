import type { EventoCatalogoVista, UsuarioVista } from "@ai-ticket-it/shared";

import type { ClienteApi } from "./cliente";

/** `GET /usuarios`: público, sale sin `X-Usuario-Id`. */
export function listarUsuarios(
  cliente: ClienteApi,
  opciones: { signal?: AbortSignal } = {},
): Promise<UsuarioVista[]> {
  return cliente.get<UsuarioVista[]>("/usuarios", { signal: opciones.signal, usuarioId: null });
}

/** `GET /usuarios/actual` en nombre de `usuarioId` (puede no ser todavía el actual). */
export function obtenerUsuarioActual(
  cliente: ClienteApi,
  usuarioId: string,
  opciones: { signal?: AbortSignal } = {},
): Promise<UsuarioVista> {
  return cliente.get<UsuarioVista>("/usuarios/actual", { signal: opciones.signal, usuarioId });
}

const FAVORITOS = "/usuarios/actual/favoritos";

/** `GET /usuarios/actual/favoritos` (feature 014): las tarjetas de los favoritos de `usuarioId`. */
export function listarFavoritos(
  cliente: ClienteApi,
  usuarioId: string,
  opciones: { signal?: AbortSignal } = {},
): Promise<EventoCatalogoVista[]> {
  return cliente.get<EventoCatalogoVista[]>(FAVORITOS, { signal: opciones.signal, usuarioId });
}

/** `PUT /usuarios/actual/favoritos/:eventoId`: idempotente, responde `204`. */
export function marcarFavorito(cliente: ClienteApi, usuarioId: string, eventoId: string): Promise<void> {
  return cliente.put<void>(`${FAVORITOS}/${encodeURIComponent(eventoId)}`, undefined, { usuarioId });
}

/** `DELETE /usuarios/actual/favoritos/:eventoId`: idempotente, responde `204`. */
export function desmarcarFavorito(cliente: ClienteApi, usuarioId: string, eventoId: string): Promise<void> {
  return cliente.delete<void>(`${FAVORITOS}/${encodeURIComponent(eventoId)}`, { usuarioId });
}
