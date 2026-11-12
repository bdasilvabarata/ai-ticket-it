import type { EventoVista, TipoEntradaVista } from "@ai-ticket-it/shared";
import { router } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { Boton, tema } from "../../../componentes";
import { useMisComprasDelEvento } from "../useMisComprasDelEvento";

export interface PropsAccionComprar {
  usuarioId: string;
  evento: EventoVista;
  tipo: TipoEntradaVista;
}

/**
 * La acción de un tipo en el detalle (contracts/app.md, "Acción de cada tipo"), en este orden:
 * realizado, organizador o agotado → nada (el cupo ya dice "Agotado"); sin entradas restantes → el
 * aviso del máximo; si no (también mientras `mis-compras` carga o si falló) → "Comprar".
 */
export function AccionComprar({ usuarioId, evento, tipo }: PropsAccionComprar) {
  const { data: misCompras } = useMisComprasDelEvento(usuarioId, evento.id);
  if (evento.realizado || evento.organizador.id === usuarioId || tipo.cupo === 0) return null;
  const restantes = misCompras?.restantesPorTipo.find((r) => r.tipoEntradaId === tipo.id)?.restantes;
  if (restantes === 0) {
    return <Text style={estilos.maximo}>Ya tenés el máximo de entradas para este evento</Text>;
  }
  return (
    <Boton
      texto="Comprar"
      accessibilityLabel={`Comprar ${tipo.nombre}`}
      alPresionar={() =>
        router.push({
          pathname: "/explorar/[eventoId]/comprar/[tipoEntradaId]",
          params: { eventoId: evento.id, tipoEntradaId: tipo.id },
        })
      }
    />
  );
}

const estilos = StyleSheet.create({
  maximo: { ...tema.tipografia.secundario, color: tema.colores.textoSecundario, flexShrink: 1 },
});
