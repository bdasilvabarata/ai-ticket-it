import type { EventoVista, TipoEntradaVista } from "@ai-ticket-it/shared";
import { useMemo } from "react";

import { DetalleEvento, type ComplementosDelDetalle } from "../../eventos";
import { useSesion } from "../../sesion";
import { AccionComprar } from "../componentes/AccionComprar";
import { SeccionDeCompras } from "../componentes/SeccionDeCompras";

/**
 * El detalle público de la 005 con lo de las compras (research R12): "Comprar" en cada tipo y la
 * sección propia del usuario. `eventos` no conoce a `compras`: se lo pasa por `complementos`.
 */
export function DetalleEventoConCompras() {
  const { estado } = useSesion();
  const usuarioId = estado.fase === "con-usuario" ? estado.usuarioId : null;
  const complementos = useMemo((): ComplementosDelDetalle => {
    if (usuarioId === null) return {};
    return {
      AccionDeTipo: ({ evento, tipo }: { evento: EventoVista; tipo: TipoEntradaVista }) => (
        <AccionComprar usuarioId={usuarioId} evento={evento} tipo={tipo} />
      ),
      SeccionPropia: ({ evento }: { evento: EventoVista }) => (
        <SeccionDeCompras usuarioId={usuarioId} evento={evento} />
      ),
    };
  }, [usuarioId]);
  return <DetalleEvento complementos={complementos} />;
}
