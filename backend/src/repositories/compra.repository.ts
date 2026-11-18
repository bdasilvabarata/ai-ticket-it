import { randomInt, randomUUID } from "node:crypto";
import { EstadoCompra } from "@ai-ticket-it/shared";
import { ALFABETO_DE_CODIGO, LARGO_DE_CODIGO } from "../domain/codigo-de-entrada";
import type { Compra } from "../domain/compra";
import type { RepositorioCompras } from "../domain/repositorios";

/** Compras en memoria (constitución, principio IV), en un `Map` privado por id. */
export class CompraRepository implements RepositorioCompras {
  readonly #compras: Map<string, Compra>;
  readonly #alAzar: (hasta: number) => number;

  /** `alAzar(hasta)` da un entero en `[0, hasta)`; por defecto, `crypto.randomInt` (los tests lo fijan). */
  constructor(compras: Compra[] = [], alAzar: (hasta: number) => number = randomInt) {
    this.#compras = new Map(compras.map((compra) => [compra.id, compra]));
    this.#alAzar = alAzar;
  }

  siguienteId(): string {
    return randomUUID();
  }

  /** Al azar en el alfabeto; ante una colisión (con 32⁸ combinaciones, casi imposible), reintenta. */
  siguientesCodigosDeEntrada(cantidad: number): string[] {
    const usados = new Set(
      [...this.#compras.values()].flatMap((compra) => compra.entradas.map((entrada) => entrada.codigo)),
    );
    const nuevos: string[] = [];
    while (nuevos.length < cantidad) {
      const codigo = this.#codigoAlAzar();
      if (usados.has(codigo)) continue;
      usados.add(codigo);
      nuevos.push(codigo);
    }
    return nuevos;
  }

  #codigoAlAzar(): string {
    return Array.from(
      { length: LARGO_DE_CODIGO },
      () => ALFABETO_DE_CODIGO[this.#alAzar(ALFABETO_DE_CODIGO.length)],
    ).join("");
  }

  async buscarPorId(id: string): Promise<Compra | null> {
    return this.#compras.get(id) ?? null;
  }

  async listarPorEventoYComprador(eventoId: string, compradorId: string): Promise<Compra[]> {
    return [...this.#compras.values()].filter(
      (compra) => compra.eventoId === eventoId && compra.compradorId === compradorId,
    );
  }

  async listarPorComprador(compradorId: string): Promise<Compra[]> {
    return [...this.#compras.values()].filter((compra) => compra.compradorId === compradorId);
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
