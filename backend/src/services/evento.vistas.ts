import type { EventoResumenVista } from "@ai-ticket-it/shared";
import type { Categoria } from "../domain/categoria";
import type { Evento } from "../domain/evento";
import { horaDeBuenosAires } from "../domain/hora-buenos-aires";

// Vistas explícitas de eventos (principio V): campos elegidos, nunca la entidad completa. Las
// usan EventoService y TipoEntradaService.

/** `realizado` se calcula con el `ahora` del reloj del servidor, al consultar (FR-010a). */
export function aEventoResumenVista(evento: Evento, categoria: Categoria, ahora: Date): EventoResumenVista {
  return {
    id: evento.id,
    nombre: evento.nombre,
    categoria: { id: categoria.id, nombre: categoria.nombre },
    fechaHora: evento.fechaHora.toISOString(),
    fechaHoraLocal: horaDeBuenosAires(evento.fechaHora),
    organizadorId: evento.organizadorId,
    realizado: evento.estaRealizado(ahora),
    cantidadTiposEntrada: evento.tiposEntrada.length,
  };
}
