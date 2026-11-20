import { EstadoCompra, LIMITES_COMPRA, type MotivoNoCancelable } from "@ai-ticket-it/shared";
import { ReglaDeNegocioError } from "./errores";
import type { TipoEntrada } from "./evento";
import { Invariantes } from "./invariantes";
import { Entrada, motivoNoUsable } from "./entrada";
import { pasoPorConfirmada, REGLAS_DE_COMPRA } from "./reglas-de-compra";

export { Entrada, type RegistroDeEntrada } from "./entrada";

/** El reembolso de una compra cancelada después de confirmada y paga (feature 010, R5). */
export type EstadoDeReembolso = "pendiente" | "confirmado";

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
  /** Una por unidad (`entradas.length === cantidad`), cada una con su código (feature 008, R1). */
  entradas: readonly Entrada[];
}

/** Lo que necesita `Compra.registrar`: el tipo comprado (con su precio vigente) y el instante del alta. */
export interface DatosDeAlta {
  id: string;
  compradorId: string;
  eventoId: string;
  tipo: TipoEntrada;
  cantidad: number;
  /** Los códigos de las entradas, uno por unidad: los da el repositorio (R2). */
  codigos: readonly string[];
  ahora: Date;
}

const PLAZO_PARA_PAGAR_MS = LIMITES_COMPRA.minutosParaPagar * 60 * 1000;

/** Un cambio de estado hecho por un usuario en `fechaHora`. */
function cambioPorUsuario(estado: EstadoCompra, usuarioId: string, fechaHora: Date): CambioEstadoCompra {
  return { estado, autor: { tipo: "usuario", usuarioId }, fechaHora };
}

/**
 * Una compra de entradas de un tipo, con su historial de estados (feature 006). El estado, el alta
 * y el vencimiento se derivan del historial. Es inmutable: las operaciones devuelven una `Compra`
 * nueva. El alta es `Compra.registrar` (PENDIENTE). Transiciones de esta feature:
 * `PENDIENTE → CONFIRMADA` (el pago del comprador), `PENDIENTE → CANCELADA` por el sistema
 * (vencimiento a los 15 minutos) y `PENDIENTE → CANCELADA` por el comprador (la cancela antes de
 * pagarla); la 008 suma `CONFIRMADA → UTILIZADA` (la primera entrada usada) y la 009, `CONFIRMADA → CANCELADA`
 * por el comprador y `CANCELADA → REEMBOLSADA` por el organizador. Desde la 008 lleva sus `entradas`, una por unidad
 * con su código; sus transiciones las conservan.
 */
export class Compra {
  readonly id: string;
  readonly compradorId: string;
  readonly eventoId: string;
  readonly tipoEntradaId: string;
  readonly cantidad: number;
  readonly total: number;
  readonly historial: readonly CambioEstadoCompra[];
  readonly entradas: readonly Entrada[];

  /**
   * Verifica cada regla de `REGLAS_DE_COMPRA` (feature 010, R2) y, si alguna falla, lanza
   * `DatosInvalidosError` con un detalle por regla violada.
   */
  constructor(propiedades: PropiedadesCompra) {
    const invariantes = new Invariantes();
    for (const regla of REGLAS_DE_COMPRA)
      invariantes.exigir(regla.cumple(propiedades), regla.campo, regla.mensaje);
    invariantes.verificar();
    this.id = propiedades.id;
    this.compradorId = propiedades.compradorId;
    this.eventoId = propiedades.eventoId;
    this.tipoEntradaId = propiedades.tipoEntradaId;
    this.cantidad = propiedades.cantidad;
    this.total = propiedades.total;
    this.historial = Object.freeze(propiedades.historial.map((cambio) => Object.freeze({ ...cambio })));
    this.entradas = Object.freeze([...propiedades.entradas]);
  }

  /**
   * Fábrica de alta: el total lo calcula el servidor (`precio × cantidad`, fijo desde ahora) y el
   * historial arranca en PENDIENTE por el comprador en `ahora`. Las reglas de la compra (realizado,
   * propio evento, tope y cupo) ya las verificaron el evento y el service.
   */
  static registrar({ id, compradorId, eventoId, tipo, cantidad, codigos, ahora }: DatosDeAlta): Compra {
    return new Compra({
      id,
      compradorId,
      eventoId,
      tipoEntradaId: tipo.id,
      cantidad,
      total: tipo.precio * cantidad,
      historial: [cambioPorUsuario(EstadoCompra.PENDIENTE, compradorId, ahora)],
      entradas: codigos.map((codigo) => new Entrada({ codigo })),
    });
  }

  /**
   * El estado visible de una de sus entradas (FR-012a): si la compra nunca llegó a CONFIRMADA, el de
   * la compra; si llegó, el propio de la entrada (UTILIZADA si se usó, CANCELADA si se canceló —
   * también en una REEMBOLSADA—, si no CONFIRMADA).
   */
  estadoDe(entrada: Entrada): EstadoCompra {
    if (!this.fueConfirmada) return this.estado;
    return entrada.estadoPropio;
  }

  /** El estado visible de la entrada con ese código, o `null` si no es de esta compra. */
  estadoDeEntrada(codigo: string): EstadoCompra | null {
    const entrada = this.entradas.find((candidata) => candidata.codigo === codigo);
    return entrada ? this.estadoDe(entrada) : null;
  }

  /** Cuántas de sus entradas se usaron. */
  get entradasUsadas(): number {
    return this.entradas.filter((entrada) => entrada.usada).length;
  }

  /**
   * La entrada con ese código pasa a UTILIZADA por el organizador en `ahora` (feature 008, R9). Si es
   * la primera de la compra, la compra pasa a UTILIZADA con el mismo cambio; si ya lo estaba, su
   * historial no cambia. Una entrada que no está CONFIRMADA (o un código ajeno, que el service ya
   * descartó) → `TRANSICION_INVALIDA`. La ventana de uso y el permiso los verifica el service antes.
   * Se llama sobre la compra al día (una pendiente vencida falla como CANCELADA).
   */
  registrarUso(codigo: string, organizadorId: string, ahora: Date): Compra {
    const estado = this.estadoDeEntrada(codigo);
    if (estado !== EstadoCompra.CONFIRMADA) {
      throw new ReglaDeNegocioError("TRANSICION_INVALIDA", motivoNoUsable(estado));
    }
    const entradas = this.entradas.map((entrada) =>
      entrada.codigo === codigo ? entrada.usar(organizadorId, ahora) : entrada,
    );
    const historial =
      this.estado === EstadoCompra.CONFIRMADA
        ? [...this.historial, cambioPorUsuario(EstadoCompra.UTILIZADA, organizadorId, ahora)]
        : [...this.historial];
    return new Compra({ ...this.#propiedades(), historial, entradas });
  }

  /** El historial pasó por CONFIRMADA (feature 009). */
  get fueConfirmada(): boolean {
    return pasoPorConfirmada(this.historial);
  }

  /** En CANCELADA o REEMBOLSADA, desde qué estado se canceló; en otro estado, `null` (feature 009, R4). */
  get canceladaDesde(): "PENDIENTE" | "CONFIRMADA" | null {
    if (this.estado !== EstadoCompra.CANCELADA && this.estado !== EstadoCompra.REEMBOLSADA) return null;
    return this.fueConfirmada ? EstadoCompra.CONFIRMADA : EstadoCompra.PENDIENTE;
  }

  /** El cambio a CANCELADA del historial, también en una REEMBOLSADA; si no hay, `null` (feature 009). */
  get cambioDeCancelacion(): CambioEstadoCompra | null {
    return this.historial.find((cambio) => cambio.estado === EstadoCompra.CANCELADA) ?? null;
  }

  /**
   * El reembolso, derivado del historial (feature 010, R5): `confirmado` en una REEMBOLSADA;
   * `pendiente` en una CANCELADA después de confirmada y paga (falta que el organizador lo confirme);
   * si no (también en una gratis o cancelada antes de pagar), `null`.
   */
  get reembolso(): EstadoDeReembolso | null {
    if (this.estado === EstadoCompra.REEMBOLSADA) return "confirmado";
    if (this.estado === EstadoCompra.CANCELADA && this.fueConfirmada && this.total > 0) return "pendiente";
    return null;
  }

  /**
   * Por qué no se puede cancelar en `ahora`, o `null` si se puede (feature 009, R6). Se llama sobre
   * la compra al día. Una PENDIENTE se cancela siempre (006); una CONFIRMADA, hasta el inicio del
   * evento (exclusive: a la hora exacta ya empezó, como `Evento.estaRealizado`).
   */
  motivoNoCancelable(inicioDelEvento: Date, ahora: Date): MotivoNoCancelable | null {
    switch (this.estado) {
      case EstadoCompra.PENDIENTE:
        return null;
      case EstadoCompra.CONFIRMADA:
        return ahora.getTime() >= inicioDelEvento.getTime() ? "evento-empezado" : null;
      case EstadoCompra.UTILIZADA:
        return "entrada-usada";
      case EstadoCompra.CANCELADA:
        return "cancelada";
      case EstadoCompra.REEMBOLSADA:
        return "reembolsada";
    }
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

  /** Cuenta para el tope por persona: PENDIENTE no vencida, CONFIRMADA o UTILIZADA. */
  esVigente(ahora: Date): boolean {
    return (
      this.estado === EstadoCompra.CONFIRMADA ||
      this.estado === EstadoCompra.UTILIZADA ||
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
    return this.#conCambio(cambioPorUsuario(EstadoCompra.CONFIRMADA, usuarioId, ahora));
  }

  /**
   * La cancela su comprador en `ahora` (sus entradas vuelven al cupo; el permiso lo verifica el
   * service antes). En orden (R1): vencida → `COMPRA_VENCIDA`; PENDIENTE → CANCELADA, también con
   * el evento empezado (006); si no, según `motivoNoCancelable`: el evento empezó →
   * `EVENTO_REALIZADO`; otro motivo → `TRANSICION_INVALIDA` con su mensaje; ninguno (una CONFIRMADA
   * antes del inicio, feature 009) → CANCELADA y cada entrada cancelada (quién y cuándo).
   */
  cancelar(usuarioId: string, ahora: Date, inicioDelEvento: Date): Compra {
    if (this.estaVencida(ahora) || this.fueVencida()) {
      throw new ReglaDeNegocioError("COMPRA_VENCIDA", "La compra venció: pasaron 15 minutos sin pagarla.");
    }
    const cambio = cambioPorUsuario(EstadoCompra.CANCELADA, usuarioId, ahora);
    if (this.estado === EstadoCompra.PENDIENTE) return this.#conCambio(cambio);
    const motivo = this.motivoNoCancelable(inicioDelEvento, ahora);
    if (motivo === "evento-empezado") {
      throw new ReglaDeNegocioError(
        "EVENTO_REALIZADO",
        "El evento ya empezó: ya no se puede cancelar la compra.",
      );
    }
    if (motivo !== null) throw new ReglaDeNegocioError("TRANSICION_INVALIDA", MENSAJE_NO_CANCELABLE[motivo]);
    return new Compra({
      ...this.#propiedades(),
      historial: [...this.historial, cambio],
      entradas: this.entradas.map((entrada) => entrada.cancelar(usuarioId, ahora)),
    });
  }

  /**
   * CANCELADA (paga, desde confirmada) → REEMBOLSADA por su organizador en `ahora` (feature 009, R5).
   * Sin plazo: no mira la fecha del evento. Las entradas no cambian y el cupo tampoco. El permiso lo
   * verifica el service antes. Según `reembolso`: `confirmado` → `TRANSICION_INVALIDA` «ya se
   * confirmó»; `null` → `TRANSICION_INVALIDA` «no tiene un reembolso pendiente».
   */
  confirmarReembolso(organizadorId: string, ahora: Date): Compra {
    if (this.reembolso === "confirmado") {
      throw new ReglaDeNegocioError("TRANSICION_INVALIDA", "El reembolso de esta compra ya se confirmó.");
    }
    if (this.reembolso === null) {
      throw new ReglaDeNegocioError("TRANSICION_INVALIDA", "Esta compra no tiene un reembolso pendiente.");
    }
    return this.#conCambio(cambioPorUsuario(EstadoCompra.REEMBOLSADA, organizadorId, ahora));
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
    return new Compra({ ...this.#propiedades(), historial: [...this.historial, cambio] });
  }

  #propiedades(): PropiedadesCompra {
    return {
      id: this.id,
      compradorId: this.compradorId,
      eventoId: this.eventoId,
      tipoEntradaId: this.tipoEntradaId,
      cantidad: this.cantidad,
      total: this.total,
      historial: [...this.historial],
      entradas: this.entradas,
    };
  }
}

/** El mensaje del `TRANSICION_INVALIDA` al cancelar, por motivo (feature 009, data-model). */
const MENSAJE_NO_CANCELABLE: Record<Exclude<MotivoNoCancelable, "evento-empezado">, string> = {
  "entrada-usada": "Ya se usó una entrada de esta compra: no se puede cancelar.",
  cancelada: "La compra ya está cancelada.",
  reembolsada: "La compra ya fue reembolsada.",
};
