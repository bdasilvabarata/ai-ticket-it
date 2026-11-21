import { EstadoCompra } from "@ai-ticket-it/shared";
import { Categoria } from "../../src/domain/categoria";
import { ALFABETO_DE_CODIGO, LARGO_DE_CODIGO } from "../../src/domain/codigo-de-entrada";
import {
  Compra,
  Entrada,
  type CambioEstadoCompra,
  type Mensaje,
  type RegistroDeEntrada,
} from "../../src/domain/compra";
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
 * el comprador y en `creadaEn` (fechas iguales consecutivas son válidas). UTILIZADA pasa por
 * CONFIRMADA (`[PENDIENTE, CONFIRMADA, UTILIZADA]`), como exige `Compra` (feature 008).
 */
export function historialHasta(
  estado: EstadoCompra,
  compradorId: string,
  creadaEn: Date = AHORA,
): CambioEstadoCompra[] {
  const autor = { tipo: "usuario", usuarioId: compradorId } as const;
  const alta = { estado: EstadoCompra.PENDIENTE, autor, fechaHora: creadaEn };
  if (estado === EstadoCompra.PENDIENTE) return [alta];
  const final = { estado, autor, fechaHora: creadaEn };
  const confirmacion = { estado: EstadoCompra.CONFIRMADA, autor, fechaHora: creadaEn };
  if (estado === EstadoCompra.UTILIZADA) return [alta, confirmacion, final];
  if (estado === EstadoCompra.REEMBOLSADA) {
    const cancelacion = { estado: EstadoCompra.CANCELADA, autor, fechaHora: creadaEn };
    const porLucia = { tipo: "usuario", usuarioId: "usuario-lucia" } as const;
    return [alta, confirmacion, cancelacion, { estado, autor: porLucia, fechaHora: creadaEn }];
  }
  return [alta, final];
}

let numeroCodigo = 0;

/** `cantidad` códigos válidos y distintos de todos los dados antes (un contador en el alfabeto). */
export function codigosDePrueba(cantidad: number): string[] {
  return Array.from({ length: cantidad }, () => {
    numeroCodigo += 1;
    let resto = numeroCodigo;
    let codigo = "";
    for (let i = 0; i < LARGO_DE_CODIGO; i += 1) {
      codigo = ALFABETO_DE_CODIGO[resto % ALFABETO_DE_CODIGO.length] + codigo;
      resto = Math.floor(resto / ALFABETO_DE_CODIGO.length);
    }
    return codigo;
  });
}

/** El usuario y la fecha de un cambio del historial (un cambio de un usuario: el uso o la cancelación). */
function registroDe(cambio: CambioEstadoCompra): RegistroDeEntrada {
  const usuarioId = cambio.autor.tipo === "usuario" ? cambio.autor.usuarioId : "sistema";
  return { usuarioId, fechaHora: cambio.fechaHora };
}

/**
 * `cantidad` entradas con códigos de `codigosDePrueba`, sin uso ni cancelación, salvo que el
 * `historial` dado lo exija: si pasó por CONFIRMADA y tiene un CANCELADA, todas canceladas por el
 * autor y en la fecha de ese cambio; si termina en UTILIZADA, la primera usada por el autor y en la
 * fecha de ese cambio.
 */
export function entradasDePrueba(cantidad: number, historial: readonly CambioEstadoCompra[] = []): Entrada[] {
  const ultimo = historial[historial.length - 1];
  const fueConfirmada = historial.some((cambio) => cambio.estado === EstadoCompra.CONFIRMADA);
  const cancelacion = historial.find((cambio) => cambio.estado === EstadoCompra.CANCELADA);
  if (fueConfirmada && cancelacion) {
    return codigosDePrueba(cantidad).map(
      (codigo) => new Entrada({ codigo, cancelacion: registroDe(cancelacion) }),
    );
  }
  const uso = ultimo?.estado === EstadoCompra.UTILIZADA ? registroDe(ultimo) : null;
  return codigosDePrueba(cantidad).map((codigo, i) => new Entrada({ codigo, uso: i === 0 ? uso : null }));
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
  /** Por defecto, `cantidad` entradas de `entradasDePrueba` (en una UTILIZADA, la primera usada). */
  entradas?: Entrada[];
  /** El chat de la compra (feature 011); por defecto, ninguno. */
  mensajes?: Mensaje[];
}

/** Una compra de Martín de 1 entrada por $ 1000 en `estado` (atajo) o con el historial dado. */
export function compra(
  eventoId: string,
  tipoEntradaId: string,
  estado: EstadoCompra = EstadoCompra.CONFIRMADA,
  {
    compradorId = "usuario-martin",
    creadaEn = AHORA,
    historial,
    cantidad = 1,
    entradas,
    ...cambios
  }: CambiosCompra = {},
): Compra {
  const historialFinal = historial ?? historialHasta(estado, compradorId, creadaEn);
  return new Compra({
    id: `compra-${tipoEntradaId}-${estado.toLowerCase()}`,
    compradorId,
    eventoId,
    tipoEntradaId,
    cantidad,
    total: 1000,
    historial: historialFinal,
    entradas: entradas ?? entradasDePrueba(cantidad, historialFinal),
    ...cambios,
  });
}

let numeroResenia = 0;

/** Una reseña de Diego a ese evento. */
export function resenia(eventoId: string, puntuacion: number): Resenia {
  numeroResenia += 1;
  return new Resenia({ id: `resenia-${numeroResenia}`, compradorId: diego.id, eventoId, puntuacion });
}
