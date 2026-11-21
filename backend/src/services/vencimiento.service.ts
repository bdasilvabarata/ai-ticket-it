import type { Compra } from "../domain/compra";
import { cupoLiberadoPorTipo } from "../domain/vencimiento";
import type { RepositorioCompras } from "../domain/repositorios";

export interface DependenciasVencimientoService {
  compras: RepositorioCompras;
}

/**
 * Vencimiento perezoso de las compras PENDIENTE a los 15 minutos (research R3). Es la pieza de abajo
 * que necesita el dueño del evento y que no puede pedirle a `CompraService` sin formar un ciclo (R4):
 * trabaja solo sobre el agregado `Compra`. No toma el cerrojo: la escritura corre bajo el del evento
 * que ya tomó quien llama.
 */
export class VencimientoService {
  readonly #compras: RepositorioCompras;

  constructor({ compras }: DependenciasVencimientoService) {
    this.#compras = compras;
  }

  /**
   * Lectura (sin guardar nada): las entradas de las compras pendientes vencidas en `ahora`, por
   * evento y por tipo. Una sola lectura para todos los eventos (sin N+1). Los eventos sin vencidas
   * no aparecen.
   */
  async cupoLiberadoPorTipo(
    eventoIds: readonly string[],
    ahora: Date,
  ): Promise<Map<string, Map<string, number>>> {
    const pendientes = await this.#compras.listarPendientesPorEventos(eventoIds);
    const porEvento = new Map<string, Compra[]>();
    for (const compra of pendientes) {
      porEvento.set(compra.eventoId, [...(porEvento.get(compra.eventoId) ?? []), compra]);
    }
    const liberado = new Map<string, Map<string, number>>();
    for (const [eventoId, compras] of porEvento) {
      const porTipo = cupoLiberadoPorTipo(compras, ahora);
      if (porTipo.size > 0) liberado.set(eventoId, porTipo);
    }
    return liberado;
  }

  /**
   * Escritura, **dentro** del cerrojo del evento que tomó quien llama: guarda cada compra vencida
   * como CANCELADA del sistema (fechada en `venceEn`) y devuelve el cupo que liberan, por tipo. Solo
   * vence las que siguen PENDIENTE en el repositorio: el cupo se devuelve una sola vez (FR-014a).
   */
  async vencerPendientes(eventoId: string, ahora: Date): Promise<Map<string, number>> {
    const vencidas = (await this.#compras.listarPendientesPorEventos([eventoId])).filter((compra) =>
      compra.estaVencida(ahora),
    );
    for (const compra of vencidas) await this.#compras.guardar(compra.vencer());
    return cupoLiberadoPorTipo(vencidas, ahora);
  }
}
