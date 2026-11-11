import type {
  EventoResumenVista,
  EventoVista,
  OrganizadorVista,
  TipoEntradaVista,
} from "@ai-ticket-it/shared";
import type { Categoria } from "../domain/categoria";
import type { Evento, TipoEntrada } from "../domain/evento";
import { horaDeBuenosAires } from "../domain/hora-buenos-aires";
import type { Puntaje } from "../domain/resenia";
import type { Usuario } from "../domain/usuario";

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

/**
 * El organizador con su puntaje. Cambio de nombres deliberado (data-model, "Nombres del puntaje"):
 * el `Puntaje { promedio, cantidad }` del dominio pasa a `puntaje` / `cantidadResenias` del
 * contrato, que habla del organizador ("su puntaje" y "cuántas reseñas").
 */
export function aOrganizadorVista(usuario: Usuario, puntaje: Puntaje): OrganizadorVista {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    puntaje: puntaje.promedio,
    cantidadResenias: puntaje.cantidad,
  };
}

/** El resumen más descripción, multimedia, los tipos en el orden en que se agregaron y el organizador. */
export function aEventoVista(
  evento: Evento,
  categoria: Categoria,
  organizador: OrganizadorVista,
  ahora: Date,
): EventoVista {
  return {
    ...aEventoResumenVista(evento, categoria, ahora),
    descripcion: evento.descripcion,
    multimedia: [...evento.multimedia],
    tiposEntrada: evento.tiposEntrada.map(aTipoEntradaVista),
    organizador,
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
