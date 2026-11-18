import { EstadoCompra, LIMITES_COMPRA } from "@ai-ticket-it/shared";
import { ReglaDeNegocioError } from "./errores";
import type { TipoEntrada } from "./evento";
import { esCodigoValido } from "./codigo-de-entrada";
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

export interface PropiedadesEntrada {
  codigo: string;
  /** Sus cambios propios, posteriores a la confirmación de la compra (por defecto, ninguno). */
  cambios?: readonly CambioEstadoCompra[];
}

/**
 * Una entrada de una compra (feature 008, R1): vive dentro del agregado `Compra` y se guarda con
 * él. Su código es su identificador (único en el sistema). Su estado se deriva: igual al de la
 * compra hasta que esta se confirma; después, el de su último cambio propio o `CONFIRMADA`.
 */
export class Entrada {
  readonly codigo: string;
  readonly cambios: readonly CambioEstadoCompra[];

  constructor({ codigo, cambios = [] }: PropiedadesEntrada) {
    this.codigo = codigo;
    this.cambios = Object.freeze(cambios.map((cambio) => Object.freeze({ ...cambio })));
  }

  /** El estado de esta entrada en `compra` (FR-012a): no se guarda dos veces, no se desincroniza. */
  estadoEn(compra: Compra): EstadoCompra {
    if (compra.estado !== EstadoCompra.CONFIRMADA && compra.estado !== EstadoCompra.UTILIZADA) {
      return compra.estado;
    }
    return this.ultimoEstadoPropio ?? EstadoCompra.CONFIRMADA;
  }

  /** Esta entrada con su uso registrado por `organizadorId` en `ahora` (la compra decide si se puede). */
  usar(organizadorId: string, ahora: Date): Entrada {
    return new Entrada({
      codigo: this.codigo,
      cambios: [
        ...this.cambios,
        {
          estado: EstadoCompra.UTILIZADA,
          autor: { tipo: "usuario", usuarioId: organizadorId },
          fechaHora: ahora,
        },
      ],
    });
  }

  /** El estado de su último cambio propio, sin mirar la compra (para las invariantes). */
  get ultimoEstadoPropio(): EstadoCompra | null {
    return this.cambios[this.cambios.length - 1]?.estado ?? null;
  }

  /** Cuándo se registró su uso, o `null`. */
  get usadaEn(): Date | null {
    return this.cambios.find((cambio) => cambio.estado === EstadoCompra.UTILIZADA)?.fechaHora ?? null;
  }
}

/**
 * Tantas entradas como la cantidad (si la cantidad es válida; si no, ya lo informa ese campo),
 * códigos con formato y distintos, cambios propios solo si la compra llegó a CONFIRMADA y, con la
 * compra CONFIRMADA o UTILIZADA, la compra está UTILIZADA si y solo si alguna entrada lo está.
 */
function sonEntradasValidas(propiedades: PropiedadesCompra): boolean {
  const { entradas, cantidad, historial } = propiedades;
  const cantidadValida = Number.isInteger(cantidad) && cantidad >= 1;
  const codigos = entradas.map((entrada) => entrada.codigo);
  const llegoAConfirmada = historial.some((cambio) => cambio.estado === EstadoCompra.CONFIRMADA);
  return (
    (!cantidadValida || entradas.length === cantidad) &&
    codigos.every(esCodigoValido) &&
    new Set(codigos).size === codigos.length &&
    (llegoAConfirmada || entradas.every((entrada) => entrada.cambios.length === 0)) &&
    usoCoherente(historial, entradas)
  );
}

/** Con la compra CONFIRMADA o UTILIZADA: UTILIZADA ⇔ alguna entrada usada (en otro estado, la entrada lo hereda). */
function usoCoherente(historial: readonly CambioEstadoCompra[], entradas: readonly Entrada[]): boolean {
  const estado = historial[historial.length - 1]?.estado;
  if (estado !== EstadoCompra.CONFIRMADA && estado !== EstadoCompra.UTILIZADA) return true;
  const algunaUsada = entradas.some((entrada) => entrada.ultimoEstadoPropio === EstadoCompra.UTILIZADA);
  return (estado === EstadoCompra.UTILIZADA) === algunaUsada;
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
 * pagarla); la 008 suma `CONFIRMADA → UTILIZADA` (la primera entrada usada) y la 009, las suyas. Desde la 008 lleva sus `entradas`, una por unidad
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
      .exigir(
        sonEntradasValidas(propiedades),
        "entradas",
        "Debe haber una por unidad, con códigos válidos y distintos, y cambios propios solo si la compra se confirmó.",
      )
      .verificar();
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
      historial: [
        {
          estado: EstadoCompra.PENDIENTE,
          autor: { tipo: "usuario", usuarioId: compradorId },
          fechaHora: ahora,
        },
      ],
      entradas: codigos.map((codigo) => new Entrada({ codigo })),
    });
  }

  /** El estado derivado de la entrada con ese código, o `null` si no es de esta compra. */
  estadoDeEntrada(codigo: string): EstadoCompra | null {
    return this.entradas.find((entrada) => entrada.codigo === codigo)?.estadoEn(this) ?? null;
  }

  /** Cuántas de sus entradas están UTILIZADA. */
  get entradasUsadas(): number {
    return this.entradas.filter((entrada) => entrada.estadoEn(this) === EstadoCompra.UTILIZADA).length;
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
        ? [
            ...this.historial,
            {
              estado: EstadoCompra.UTILIZADA,
              autor: { tipo: "usuario", usuarioId: organizadorId },
              fechaHora: ahora,
            } as const,
          ]
        : [...this.historial];
    return new Compra({ ...this.#propiedades(), historial, entradas });
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

/** Por qué no se puede usar una entrada en ese estado (R5): el mensaje del `TRANSICION_INVALIDA`. */
function motivoNoUsable(estado: EstadoCompra | null): string {
  switch (estado) {
    case EstadoCompra.UTILIZADA:
      return "Esta entrada ya se utilizó.";
    case EstadoCompra.PENDIENTE:
      return "La compra de esta entrada todavía no se pagó.";
    case EstadoCompra.CANCELADA:
      return "La compra de esta entrada está cancelada.";
    case EstadoCompra.REEMBOLSADA:
      return "La compra de esta entrada fue reembolsada.";
    default:
      return "La entrada no es de esta compra.";
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
