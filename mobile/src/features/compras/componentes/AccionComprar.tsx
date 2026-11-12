import type { EventoVista, TipoEntradaVista } from "@ai-ticket-it/shared";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

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
    return (
      <View style={estilos.maximo}>
        <Text style={estilos.textoMaximo}>Ya tenés el máximo de entradas para este evento</Text>
      </View>
    );
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
  // Ocupa a lo sumo una columna angosta a la derecha (como "Comprar"), así el nombre y la
  // descripción del tipo conservan su ancho: el aviso se parte en varias líneas, no los empuja.
  maximo: { flexBasis: "38%", flexGrow: 0, flexShrink: 1 },
  textoMaximo: { ...tema.tipografia.secundario, color: tema.colores.textoSecundario, textAlign: "right" },
});
