import type { Evento } from "../domain/evento";
import { SinPermisoError } from "../errors/index";

/** 403 si el usuario actual no organiza el evento (principio VI). Lo usan los services que lo modifican. */
export function exigirOrganizador(evento: Evento, usuarioId: string): void {
  if (!evento.esOrganizadoPor(usuarioId)) {
    throw new SinPermisoError("Solo el organizador puede modificar este evento.");
  }
}
