import { EstadoCompra } from "@ai-ticket-it/shared";

/** Quién hizo algo con una entrada y cuándo: su uso (el organizador) o su cancelación (el comprador). */
export interface RegistroDeEntrada {
  usuarioId: string;
  fechaHora: Date;
}

export interface PropiedadesEntrada {
  codigo: string;
  /** Su uso, si se registró (por defecto, `null`). */
  uso?: RegistroDeEntrada | null;
  /** Su cancelación, si se canceló (por defecto, `null`). */
  cancelacion?: RegistroDeEntrada | null;
}

function congelar(registro: RegistroDeEntrada | null): RegistroDeEntrada | null {
  return registro ? Object.freeze({ ...registro }) : null;
}

/**
 * Una entrada de una compra (feature 008, R1; forma de la 010): vive dentro del agregado `Compra` y
 * se guarda con él. Su código es su identificador (único en el sistema). Registra su **uso** (el
 * organizador, en "Registrar ingreso") y su **cancelación** (el comprador, al cancelar una compra
 * confirmada, feature 009), cada uno con quién y cuándo, o ninguno. No conoce su compra: su estado
 * visible lo da `Compra.estadoDe(entrada)`, y la coherencia con la compra, las reglas de la compra.
 */
export class Entrada {
  readonly codigo: string;
  readonly uso: RegistroDeEntrada | null;
  readonly cancelacion: RegistroDeEntrada | null;

  constructor({ codigo, uso = null, cancelacion = null }: PropiedadesEntrada) {
    this.codigo = codigo;
    this.uso = congelar(uso);
    this.cancelacion = congelar(cancelacion);
  }

  /** Se registró su uso: la **única** definición de "entrada usada". */
  get usada(): boolean {
    return this.uso !== null;
  }

  get cancelada(): boolean {
    return this.cancelacion !== null;
  }

  /** Cuándo se registró su uso, o `null`. */
  get usadaEn(): Date | null {
    return this.uso?.fechaHora ?? null;
  }

  /**
   * Su estado desde que la compra se confirmó: UTILIZADA si se usó, CANCELADA si se canceló y, si no,
   * CONFIRMADA. Antes de la confirmación vale el de la compra (lo decide `Compra.estadoDe`).
   */
  get estadoPropio(): EstadoCompra {
    if (this.usada) return EstadoCompra.UTILIZADA;
    if (this.cancelada) return EstadoCompra.CANCELADA;
    return EstadoCompra.CONFIRMADA;
  }

  /** Esta entrada con su uso registrado por `organizadorId` en `ahora` (la compra decide si se puede). */
  usar(organizadorId: string, ahora: Date): Entrada {
    return new Entrada({ ...this.#propiedades(), uso: { usuarioId: organizadorId, fechaHora: ahora } });
  }

  /** Esta entrada cancelada por su comprador en `ahora` (feature 009; la compra decide si se puede). */
  cancelar(compradorId: string, ahora: Date): Entrada {
    return new Entrada({
      ...this.#propiedades(),
      cancelacion: { usuarioId: compradorId, fechaHora: ahora },
    });
  }

  #propiedades(): PropiedadesEntrada {
    return { codigo: this.codigo, uso: this.uso, cancelacion: this.cancelacion };
  }
}

/** Por qué no se puede usar una entrada en ese estado (008, R5): el mensaje del `TRANSICION_INVALIDA`. */
export function motivoNoUsable(estado: EstadoCompra | null): string {
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
