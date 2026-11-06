import type { Evento } from "../../src/domain/evento";
import type { RepositorioEventos } from "../../src/domain/repositorios";

/**
 * Repositorio de eventos en memoria para tests de services. Estado por instancia. Su
 * comportamiento lo verifica el test de contrato contra el repositorio de Mongo.
 */
export class RepositorioEventosEnMemoria implements RepositorioEventos {
  readonly #eventos: Evento[];

  constructor(eventos: Evento[] = []) {
    this.#eventos = [...eventos];
  }

  async contarPorOrganizador(ids: string[]): Promise<Map<string, number>> {
    const buscados = new Set(ids);
    const cantidades = new Map<string, number>();
    for (const { organizadorId } of this.#eventos) {
      if (buscados.has(organizadorId))
        cantidades.set(organizadorId, (cantidades.get(organizadorId) ?? 0) + 1);
    }
    return cantidades;
  }
}
