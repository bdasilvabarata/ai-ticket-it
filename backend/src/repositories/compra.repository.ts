import type { Compra } from "../domain/compra";
import type { RepositorioCompras } from "../domain/repositorios";

/** Compras en memoria (constitución, principio IV). Mínimo de la feature 004; lo amplía la 006. */
export class CompraRepository implements RepositorioCompras {
  readonly #compras: Map<string, Compra>;

  constructor(compras: Compra[] = []) {
    this.#compras = new Map(compras.map((compra) => [compra.id, compra]));
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
