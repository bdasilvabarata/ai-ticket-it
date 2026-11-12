import { randomUUID } from "node:crypto";
import { EstadoCompra } from "@ai-ticket-it/shared";
import type { Compra } from "../domain/compra";
import type { RepositorioCompras } from "../domain/repositorios";

/** Compras en memoria (constitución, principio IV), en un `Map` privado por id. */
export class CompraRepository implements RepositorioCompras {
  readonly #compras: Map<string, Compra>;

  constructor(compras: Compra[] = []) {
    this.#compras = new Map(compras.map((compra) => [compra.id, compra]));
  }

  siguienteId(): string {
    return randomUUID();
  }

  async buscarPorId(id: string): Promise<Compra | null> {
    return this.#compras.get(id) ?? null;
  }

  async listarPorEventoYComprador(eventoId: string, compradorId: string): Promise<Compra[]> {
    return [...this.#compras.values()].filter(
      (compra) => compra.eventoId === eventoId && compra.compradorId === compradorId,
    );
  }

  async listarPendientesPorEventos(eventoIds: readonly string[]): Promise<Compra[]> {
    const ids = new Set(eventoIds);
    return [...this.#compras.values()].filter(
      (compra) => ids.has(compra.eventoId) && compra.estado === EstadoCompra.PENDIENTE,
    );
  }

  async existePorEvento(eventoId: string): Promise<boolean> {
    return [...this.#compras.values()].some((compra) => compra.eventoId === eventoId);
  }

  async existePorTipoEntrada(tipoEntradaId: string): Promise<boolean> {
    return [...this.#compras.values()].some((compra) => compra.tipoEntradaId === tipoEntradaId);
  }

  async guardar(compra: Compra): Promise<void> {
    this.#compras.set(compra.id, compra);
  }
}
