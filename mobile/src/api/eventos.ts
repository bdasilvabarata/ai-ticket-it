import type { EventoResumenVista } from "@ai-ticket-it/shared";

import type { ClienteApi } from "./cliente";

/** `GET /eventos/mios`: los eventos que organiza el usuario actual, en el orden del servidor. */
export function listarMisEventos(
  cliente: ClienteApi,
  opciones: { signal?: AbortSignal } = {},
): Promise<EventoResumenVista[]> {
  return cliente.get<EventoResumenVista[]>("/eventos/mios", { signal: opciones.signal });
}
