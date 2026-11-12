import type { CompraVista } from "@ai-ticket-it/shared";
import { StyleSheet, Text, View } from "react-native";

import { tema } from "../../../componentes";
import { textoFechaHora } from "../../eventos";
import { textoCantidad, textoTotal } from "../formato";

export interface PropsResumenCompra {
  compra: CompraVista;
}

/** Evento, fecha y hora, tipo, cantidad y total de una compra (el total que fijó el servidor). */
export function ResumenCompra({ compra }: PropsResumenCompra) {
  return (
    <View style={estilos.resumen}>
      <Text style={estilos.nombre} accessibilityRole="header">
        {compra.evento.nombre}
      </Text>
      <Text style={estilos.dato}>{textoFechaHora(compra.evento.fechaHoraLocal)}</Text>
      <View style={estilos.entradas}>
        <Text style={estilos.tipo}>{compra.tipoEntrada.nombre}</Text>
        <Text style={estilos.dato}>{textoCantidad(compra.cantidad)}</Text>
      </View>
      <Text style={estilos.total}>{`Total: ${textoTotal(compra.total)}`}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  resumen: { gap: tema.espacio.minimo },
  nombre: { ...tema.tipografia.titulo, color: tema.colores.texto },
  dato: { ...tema.tipografia.cuerpo, color: tema.colores.textoSecundario },
  entradas: { gap: tema.espacio.minimo, marginTop: tema.espacio.chico },
  tipo: { ...tema.tipografia.subtitulo, color: tema.colores.texto },
  total: { ...tema.tipografia.subtitulo, color: tema.colores.texto, marginTop: tema.espacio.chico },
});
