import type { CategoriaVista } from "@ai-ticket-it/shared";

import type { ClienteApi } from "./cliente";

/** `GET /categorias`: público, sale sin `X-Usuario-Id`; ordenadas por nombre. */
export function listarCategorias(
  cliente: ClienteApi,
  opciones: { signal?: AbortSignal } = {},
): Promise<CategoriaVista[]> {
  return cliente.get<CategoriaVista[]>("/categorias", { signal: opciones.signal, usuarioId: null });
}
