import type { UsuarioVista } from "@ai-ticket-it/shared";

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
