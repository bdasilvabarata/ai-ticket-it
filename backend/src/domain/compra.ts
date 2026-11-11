import { EstadoCompra } from "@ai-ticket-it/shared";
import { esEnteroNoNegativo, Invariantes } from "./invariantes";

export interface PropiedadesCompra {
  id: string;
  compradorId: string;
  eventoId: string;
  tipoEntradaId: string;
  /** Entradas compradas: entero ≥ 1. */
  cantidad: number;
  /** Pesos enteros ≥ 0, fijado al comprar (precio × cantidad): no cambia si cambia el precio. */
  total: number;
  estado: EstadoCompra;
}

const ESTADOS = new Set<string>(Object.values(EstadoCompra));

/**
 * Compra mínima (feature 004): alcanza para saber si un evento o un tipo de entrada tiene
 * compras. La 006 le suma el historial, las transiciones y el alta con descuento de cupo.
 */
export class Compra {
  readonly id: string;
  readonly compradorId: string;
  readonly eventoId: string;
  readonly tipoEntradaId: string;
  readonly cantidad: number;
  readonly total: number;
  readonly estado: EstadoCompra;

  constructor(propiedades: PropiedadesCompra) {
    new Invariantes()
      .exigir(
        Number.isInteger(propiedades.cantidad) && propiedades.cantidad >= 1,
        "cantidad",
        "Debe ser un entero mayor o igual a 1.",
      )
      .exigir(esEnteroNoNegativo(propiedades.total), "total", "Debe ser un entero mayor o igual a 0.")
      .exigir(ESTADOS.has(propiedades.estado), "estado", "Debe ser un estado de compra válido.")
      .verificar();
    this.id = propiedades.id;
    this.compradorId = propiedades.compradorId;
    this.eventoId = propiedades.eventoId;
    this.tipoEntradaId = propiedades.tipoEntradaId;
    this.cantidad = propiedades.cantidad;
    this.total = propiedades.total;
    this.estado = propiedades.estado;
  }
}
