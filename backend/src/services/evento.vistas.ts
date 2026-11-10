import type { EventoResumenVista, EventoVista, TipoEntradaVista } from "@ai-ticket-it/shared";
import type { Categoria } from "../domain/categoria";
import type { Evento, TipoEntrada } from "../domain/evento";
import { horaDeBuenosAires } from "../domain/hora-buenos-aires";

// Vistas explícitas de eventos (principio V): campos elegidos, nunca la entidad completa. Las
// usan EventoService y TipoEntradaService.

/** El cupo es el **disponible**. */
export function aTipoEntradaVista(tipo: TipoEntrada): TipoEntradaVista {
  return {
    id: tipo.id,
    nombre: tipo.nombre,
    descripcion: tipo.descripcion,
    precio: tipo.precio,
    cupo: tipo.cupo,
  };
}

/** El resumen más descripción, multimedia y los tipos en el orden en que se agregaron. */
export function aEventoVista(evento: Evento, categoria: Categoria, ahora: Date): EventoVista {
  return {
    ...aEventoResumenVista(evento, categoria, ahora),
    descripcion: evento.descripcion,
    multimedia: [...evento.multimedia],
    tiposEntrada: evento.tiposEntrada.map(aTipoEntradaVista),
  };
}

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
