import type { ChatDeLaCompraVista } from "@ai-ticket-it/shared";
import { StyleSheet, Text, View } from "react-native";

import { EtiquetaEstadoCompra, tema } from "../../../componentes";
import { textoCantidad, textoOtraParte } from "../formato";

/**
 * El encabezado del chat (contracts/app.md): el evento como título, la otra parte, el tipo con la
 * cantidad y el estado de la compra al día. Se dibuja solo con la respuesta del chat (FR-016).
 */
export function EncabezadoDelChat({ chat }: { chat: ChatDeLaCompraVista }) {
  const { compra, otraParte } = chat;
  return (
    <View style={estilos.encabezado}>
      <Text style={estilos.nombre} accessibilityRole="header">
        {compra.evento.nombre}
      </Text>
      <Text style={estilos.dato}>{textoOtraParte(otraParte)}</Text>
      <View style={estilos.fila}>
        <Text style={estilos.tipo}>{`${compra.tipoEntrada.nombre} · ${textoCantidad(compra.cantidad)}`}</Text>
        <EtiquetaEstadoCompra estado={compra.estado} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  encabezado: { gap: tema.espacio.minimo },
  nombre: { ...tema.tipografia.titulo, color: tema.colores.texto },
  dato: { ...tema.tipografia.cuerpo, color: tema.colores.textoSecundario },
  fila: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: tema.espacio.chico,
    marginTop: tema.espacio.chico,
  },
  tipo: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.texto, flexShrink: 1 },
});
