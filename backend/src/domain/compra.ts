import { EstadoCompra, LIMITES_COMPRA } from "@ai-ticket-it/shared";
import { ReglaDeNegocioError } from "./errores";
import type { TipoEntrada } from "./evento";
import { esEnteroNoNegativo, Invariantes } from "./invariantes";

/** Quién hizo un cambio de estado: un usuario o el sistema (el vencimiento). */
export type AutorDelCambio = { tipo: "usuario"; usuarioId: string } | { tipo: "sistema" };

export interface CambioEstadoCompra {
  estado: EstadoCompra;
  autor: AutorDelCambio;
  fechaHora: Date;
}

export interface PropiedadesCompra {
  id: string;
  compradorId: string;
  eventoId: string;
  tipoEntradaId: string;
  /** Entradas compradas: entero ≥ 1. */
  cantidad: number;
  /** Pesos enteros ≥ 0, fijado al comprar (precio × cantidad): no cambia si cambia el precio. */
  total: number;
  /** En orden cronológico; el primero es siempre PENDIENTE. Es la única fuente del estado (R5). */
  historial: CambioEstadoCompra[];
}

/** Lo que necesita `Compra.registrar`: el tipo comprado (con su precio vigente) y el instante del alta. */
export interface DatosDeAlta {
  id: string;
  compradorId: string;
  eventoId: string;
  tipo: TipoEntrada;
  cantidad: number;
  ahora: Date;
}

const ESTADOS = new Set<string>(Object.values(EstadoCompra));
const PLAZO_PARA_PAGAR_MS = LIMITES_COMPRA.minutosParaPagar * 60 * 1000;

/** No vacío, empieza en PENDIENTE, estados y fechas válidos y fechas no decrecientes. */
function esHistorialValido(historial: readonly CambioEstadoCompra[]): boolean {
  return (
    historial.length > 0 &&
    historial[0]?.estado === EstadoCompra.PENDIENTE &&
    historial.every(
      (cambio, i) =>
        ESTADOS.has(cambio.estado) &&
        cambio.fechaHora instanceof Date &&
        !Number.isNaN(cambio.fechaHora.getTime()) &&
        (i === 0 || cambio.fechaHora.getTime() >= historial[i - 1]!.fechaHora.getTime()),
    )
  );
}

/**
 * Una compra de entradas de un tipo, con su historial de estados (feature 006). El estado, el alta
 * y el vencimiento se derivan del historial. Es inmutable: las operaciones devuelven una `Compra`
 * nueva. El alta es `Compra.registrar` (PENDIENTE). Transiciones de esta feature:
 * `PENDIENTE → CONFIRMADA` (el pago del comprador), `PENDIENTE → CANCELADA` por el sistema
 * (vencimiento a los 15 minutos) y `PENDIENTE → CANCELADA` por el comprador (la cancela antes de
 * pagarla); las de la 008 y la 009 se suman después.
 */
export class Compra {
  readonly id: string;
  readonly compradorId: string;
  readonly eventoId: string;
  readonly tipoEntradaId: string;
  readonly cantidad: number;
  readonly total: number;
  readonly historial: readonly CambioEstadoCompra[];

  constructor(propiedades: PropiedadesCompra) {
    new Invariantes()
      .exigir(
        Number.isInteger(propiedades.cantidad) && propiedades.cantidad >= 1,
        "cantidad",
        "Debe ser un entero mayor o igual a 1.",
      )
      .exigir(esEnteroNoNegativo(propiedades.total), "total", "Debe ser un entero mayor o igual a 0.")
      .exigir(
        esHistorialValido(propiedades.historial),
        "historial",
        "Debe empezar en PENDIENTE, con estados válidos y fechas válidas no decrecientes.",
      )
      .verificar();
    this.id = propiedades.id;
    this.compradorId = propiedades.compradorId;
    this.eventoId = propiedades.eventoId;
    this.tipoEntradaId = propiedades.tipoEntradaId;
    this.cantidad = propiedades.cantidad;
    this.total = propiedades.total;
    this.historial = Object.freeze(propiedades.historial.map((cambio) => Object.freeze({ ...cambio })));
  }

  /**
   * Fábrica de alta: el total lo calcula el servidor (`precio × cantidad`, fijo desde ahora) y el
   * historial arranca en PENDIENTE por el comprador en `ahora`. Las reglas de la compra (realizado,
   * propio evento, tope y cupo) ya las verificaron el evento y el service.
   */
  static registrar({ id, compradorId, eventoId, tipo, cantidad, ahora }: DatosDeAlta): Compra {
    return new Compra({
      id,
      compradorId,
      eventoId,
      tipoEntradaId: tipo.id,
      cantidad,
      total: tipo.precio * cantidad,
      historial: [
        {
          estado: EstadoCompra.PENDIENTE,
          autor: { tipo: "usuario", usuarioId: compradorId },
          fechaHora: ahora,
        },
      ],
    });
  }

  /** El estado del último cambio. */
  get estado(): EstadoCompra {
    return this.#ultimoCambio().estado;
  }

  /** La fecha del alta (el primer cambio). */
  get creadaEn(): Date {
    return this.historial[0]!.fechaHora;
  }

  /** Hasta cuándo se puede pagar: el alta + 15 minutos (`LIMITES_COMPRA.minutosParaPagar`). */
  get venceEn(): Date {
    return new Date(this.creadaEn.getTime() + PLAZO_PARA_PAGAR_MS);
  }

  /** PENDIENTE y pasado el plazo: a los 15 minutos exactos, ya venció (R3). */
  estaVencida(ahora: Date): boolean {
    return this.estado === EstadoCompra.PENDIENTE && ahora.getTime() >= this.venceEn.getTime();
  }

  /** CANCELADA por el sistema: venció sin pagarse. */
  fueVencida(): boolean {
    const ultimo = this.#ultimoCambio();
    return ultimo.estado === EstadoCompra.CANCELADA && ultimo.autor.tipo === "sistema";
  }

  /** Cuenta para el tope por persona: PENDIENTE no vencida, o CONFIRMADA. */
  esVigente(ahora: Date): boolean {
    return (
      this.estado === EstadoCompra.CONFIRMADA ||
      (this.estado === EstadoCompra.PENDIENTE && !this.estaVencida(ahora))
    );
  }

  esGratis(): boolean {
    return this.total === 0;
  }

  /**
   * PENDIENTE → CANCELADA por el sistema. Se fecha en `venceEn` (cuándo venció de verdad), no en el
   * momento en que se materializa: la lectura al día y la guardada coinciden (R3).
   */
  vencer(): Compra {
    if (this.estado !== EstadoCompra.PENDIENTE) {
      throw new ReglaDeNegocioError("TRANSICION_INVALIDA", "La compra no está pendiente de pago.");
    }
    return this.#conCambio({
      estado: EstadoCompra.CANCELADA,
      autor: { tipo: "sistema" },
      fechaHora: this.venceEn,
    });
  }

  /**
   * PENDIENTE → CONFIRMADA por `usuarioId` en `ahora` (pago simulado). En orden: vencida (pasado el
   * plazo, o ya CANCELADA por el sistema) → `COMPRA_VENCIDA`; no PENDIENTE → `TRANSICION_INVALIDA`.
   * El permiso (solo el comprador) lo verifica el service antes. Que el evento haya empezado no
   * importa: se paga hasta que vence (R9).
   */
  pagar(usuarioId: string, ahora: Date): Compra {
    if (this.estaVencida(ahora) || this.fueVencida()) {
      throw new ReglaDeNegocioError("COMPRA_VENCIDA", "La compra venció: pasaron 15 minutos sin pagarla.");
    }
    if (this.estado !== EstadoCompra.PENDIENTE) {
      throw new ReglaDeNegocioError("TRANSICION_INVALIDA", "La compra no está pendiente de pago.");
    }
    return this.#conCambio({
      estado: EstadoCompra.CONFIRMADA,
      autor: { tipo: "usuario", usuarioId },
      fechaHora: ahora,
    });
  }

  /**
   * PENDIENTE → CANCELADA por su comprador en `ahora`, antes de pagarla (sus entradas vuelven al
   * cupo). Mismo orden que `pagar`: vencida → `COMPRA_VENCIDA`; no PENDIENTE → `TRANSICION_INVALIDA`
   * (cancelar una confirmada, con reembolso, es de la 009). También con el evento empezado.
   */
  cancelar(usuarioId: string, ahora: Date): Compra {
    if (this.estaVencida(ahora) || this.fueVencida()) {
      throw new ReglaDeNegocioError("COMPRA_VENCIDA", "La compra venció: pasaron 15 minutos sin pagarla.");
    }
    if (this.estado !== EstadoCompra.PENDIENTE) {
      throw new ReglaDeNegocioError("TRANSICION_INVALIDA", "La compra no está pendiente de pago.");
    }
    return this.#conCambio({
      estado: EstadoCompra.CANCELADA,
      autor: { tipo: "usuario", usuarioId },
      fechaHora: ahora,
    });
  }

  /** La compra como se ve en `ahora`, sin guardarla: vencida si correspondía, si no, esta misma. */
  alDia(ahora: Date): Compra {
    return this.estaVencida(ahora) ? this.vencer() : this;
  }

  #ultimoCambio(): CambioEstadoCompra {
    // El constructor garantiza que el historial no está vacío.
    return this.historial[this.historial.length - 1]!;
  }

  #conCambio(cambio: CambioEstadoCompra): Compra {
    return new Compra({
      id: this.id,
      compradorId: this.compradorId,
      eventoId: this.eventoId,
      tipoEntradaId: this.tipoEntradaId,
      cantidad: this.cantidad,
      total: this.total,
      historial: [...this.historial, cambio],
    });
  }
}

/**
 * Las entradas que liberan las compras vencidas en `ahora` (PENDIENTE pasado el plazo), sumadas por
 * `tipoEntradaId`. Las demás no cuentan. Sin vencidas, un `Map` vacío.
 */
export function cupoLiberadoPorTipo(compras: readonly Compra[], ahora: Date): Map<string, number> {
  const liberado = new Map<string, number>();
  for (const compra of compras) {
    if (!compra.estaVencida(ahora)) continue;
    liberado.set(compra.tipoEntradaId, (liberado.get(compra.tipoEntradaId) ?? 0) + compra.cantidad);
  }
  return liberado;
}
