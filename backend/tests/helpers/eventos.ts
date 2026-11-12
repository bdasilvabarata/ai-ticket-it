import { EstadoCompra } from "@ai-ticket-it/shared";
import { Categoria } from "../../src/domain/categoria";
import { Compra, type CambioEstadoCompra } from "../../src/domain/compra";
import { Evento, TipoEntrada, type PropiedadesTipoEntrada } from "../../src/domain/evento";
import type { Reloj } from "../../src/domain/reloj";
import { Resenia } from "../../src/domain/resenia";
import { Usuario } from "../../src/domain/usuario";

// Constructores de datos para los tests de services: cada caso arma solo lo que necesita.

export const AHORA = new Date("2026-11-10T15:00:00.000Z");
export const HORA = 60 * 60 * 1000;
export const DIA = 24 * HORA;

export const relojFijo = (instante: Date = AHORA): Reloj => ({ ahora: () => new Date(instante) });

/** Un reloj que empieza en `instante` y se mueve con `avanzar(ms)` (vencimiento a los 15 minutos). */
export function relojMovible(instante: Date = AHORA): Reloj & { avanzar(ms: number): void } {
  let actual = instante.getTime();
  return {
    ahora: () => new Date(actual),
    avanzar: (ms: number) => {
      actual += ms;
    },
  };
}

export const musica = new Categoria({ id: "categoria-musica", nombre: "Música", descripcion: "Recitales." });
export const teatro = new Categoria({ id: "categoria-teatro", nombre: "Teatro", descripcion: "Obras." });

export const lucia = new Usuario({
  id: "usuario-lucia",
  nombre: "Lucía",
  apellido: "Álvarez",
  favoritos: [],
});
export const martin = new Usuario({
  id: "usuario-martin",
  nombre: "Martín",
  apellido: "Benítez",
  favoritos: [],
});
export const sofia = new Usuario({ id: "usuario-sofia", nombre: "Sofía", apellido: "Castro", favoritos: [] });
export const diego = new Usuario({
  id: "usuario-diego",
  nombre: "Diego",
  apellido: "Fernández",
  favoritos: [],
});

export function tipo(cambios: Partial<PropiedadesTipoEntrada> = {}): TipoEntrada {
  return new TipoEntrada({
    id: "tipo-a-general",
    nombre: "General",
    descripcion: "",
    precio: 1000,
    cupo: 10,
    ...cambios,
  });
}

export interface CambiosEvento {
  id?: string;
  nombre?: string;
  organizadorId?: string;
  categoriaId?: string;
  /** Desfase respecto de AHORA, en ms. */
  en?: number;
  tiposEntrada?: TipoEntrada[];
}

export function evento({
  id = "evento-a",
  nombre = `Evento ${id}`,
  organizadorId = "usuario-lucia",
  categoriaId = musica.id,
  en = 5 * DIA,
  tiposEntrada,
}: CambiosEvento = {}): Evento {
  return new Evento({
    id,
    nombre,
    descripcion: "Descripción.",
    categoriaId,
    fechaHora: new Date(AHORA.getTime() + en),
    multimedia: ["https://example.com/a.jpg"],
    organizadorId,
    tiposEntrada: tiposEntrada ?? [tipo({ id: `tipo-${id}-general` })],
  });
}

/**
 * El historial más simple que termina en `estado`: `[PENDIENTE]` o `[PENDIENTE, estado]`, todo por
 * el comprador y en `creadaEn` (fechas iguales consecutivas son válidas).
 */
export function historialHasta(
  estado: EstadoCompra,
  compradorId: string,
  creadaEn: Date = AHORA,
): CambioEstadoCompra[] {
  const autor = { tipo: "usuario", usuarioId: compradorId } as const;
  const alta = { estado: EstadoCompra.PENDIENTE, autor, fechaHora: creadaEn };
  return estado === EstadoCompra.PENDIENTE ? [alta] : [alta, { estado, autor, fechaHora: creadaEn }];
}

export interface CambiosCompra {
  id?: string;
  compradorId?: string;
  cantidad?: number;
  total?: number;
  /** Fecha del alta (por defecto, AHORA). */
  creadaEn?: Date;
  /** Reemplaza el historial que arma el atajo de `estado`. */
  historial?: CambioEstadoCompra[];
}

/** Una compra de Martín de 1 entrada por $ 1000 en `estado` (atajo) o con el historial dado. */
export function compra(
  eventoId: string,
  tipoEntradaId: string,
  estado: EstadoCompra = EstadoCompra.CONFIRMADA,
  { compradorId = "usuario-martin", creadaEn = AHORA, historial, ...cambios }: CambiosCompra = {},
): Compra {
  return new Compra({
    id: `compra-${tipoEntradaId}-${estado.toLowerCase()}`,
    compradorId,
    eventoId,
    tipoEntradaId,
    cantidad: 1,
    total: 1000,
    historial: historial ?? historialHasta(estado, compradorId, creadaEn),
    ...cambios,
  });
}

let numeroResenia = 0;

/** Una reseña de Diego a ese evento. */
export function resenia(eventoId: string, puntuacion: number): Resenia {
  numeroResenia += 1;
  return new Resenia({ id: `resenia-${numeroResenia}`, compradorId: diego.id, eventoId, puntuacion });
}
