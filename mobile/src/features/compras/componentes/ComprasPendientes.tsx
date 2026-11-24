import { StyleSheet, Text, View } from "react-native";

import { tema } from "../../../componentes";
import { useMisComprasDelEvento } from "../useMisComprasDelEvento";
import { FilaCompraPendiente } from "./FilaCompraPendiente";

export interface PropsComprasPendientes {
  usuarioId: string;
  eventoId: string;
}

/**
 * "Tus compras pendientes" del usuario en el evento (FR-023), de la más vieja a la más nueva como
 * las manda el servidor. Sin pendientes, o mientras carga o si falló, nada: el detalle se ve igual.
 */
export function ComprasPendientes({ usuarioId, eventoId }: PropsComprasPendientes) {
  const { data } = useMisComprasDelEvento(usuarioId, eventoId);
  if (!data || data.pendientes.length === 0) return null;
  return (
    <View style={estilos.seccion}>
      <Text style={estilos.titulo} accessibilityRole="header">
        Tus compras pendientes
      </Text>
      {data.pendientes.map((compra) => (
        <FilaCompraPendiente key={compra.id} usuarioId={usuarioId} compra={compra} />
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { gap: tema.espacio.chico },
  titulo: { ...tema.tipografia.subtitulo, color: tema.colores.texto },
});
