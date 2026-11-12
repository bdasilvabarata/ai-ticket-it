import { LIMITES_COMPRA } from "@ai-ticket-it/shared";
import type { Compra } from "./compra";
import { ReglaDeNegocioError } from "./errores";
import type { TipoEntrada } from "./evento";

// Tope por persona (constitución, research R6). Cada compra cuenta según su `total` (fijado al
// comprar) y el pedido según el precio **vigente** del tipo: si el precio cambió, las compras ya
// hechas no se reclasifican.

const sumarCantidades = (compras: readonly Compra[]): number =>
  compras.reduce((suma, compra) => suma + compra.cantidad, 0);

/**
 * Cuántas entradas más de `tipo` puede comprar la persona según su tope (no según el cupo). Tipo
 * gratis: 1 menos sus entradas gratis de **ese** tipo. Tipo pago: 4 menos sus entradas pagas de todo
 * el evento. Nunca menos de 0. `vigentes` son sus compras de ese evento que cuentan para el tope
 * (PENDIENTE no vencidas y CONFIRMADA): esta función no filtra por estado.
 */
export function entradasRestantes(tipo: TipoEntrada, vigentes: readonly Compra[]): number {
  const restantes = tipo.esGratis()
    ? LIMITES_COMPRA.entradasPorTipoGratis -
      sumarCantidades(vigentes.filter((compra) => compra.esGratis() && compra.tipoEntradaId === tipo.id))
    : LIMITES_COMPRA.entradasPorEvento - sumarCantidades(vigentes.filter((compra) => !compra.esGratis()));
  return Math.max(0, restantes);
}

/** `TOPE_POR_PERSONA` si `cantidad` supera las restantes; el mensaje dice cuántas puede comprar todavía. */
export function exigirTopePorPersona(tipo: TipoEntrada, cantidad: number, vigentes: readonly Compra[]): void {
  const restantes = entradasRestantes(tipo, vigentes);
  if (cantidad <= restantes) return;
  throw new ReglaDeNegocioError("TOPE_POR_PERSONA", mensajeDeTope(tipo, restantes));
}

function mensajeDeTope(tipo: TipoEntrada, restantes: number): string {
  if (tipo.esGratis()) {
    return restantes === 0
      ? `Ya tenés tu entrada gratis de «${tipo.nombre}».`
      : `Podés tener ${LIMITES_COMPRA.entradasPorTipoGratis} sola entrada de «${tipo.nombre}».`;
  }
  if (restantes === 0) {
    return `Ya tenés el máximo de ${LIMITES_COMPRA.entradasPorEvento} entradas de tipos pagos de este evento.`;
  }
  const entradas = restantes === 1 ? "1 entrada" : `${restantes} entradas`;
  return `Podés comprar ${entradas} más de tipos pagos de este evento.`;
}
