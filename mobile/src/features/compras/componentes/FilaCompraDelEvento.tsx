import type { CompraDelEventoVista } from "@ai-ticket-it/shared";
import { StyleSheet, Text, View } from "react-native";

import { EtiquetaEstadoCompra, tema, textoEtiquetaEstado } from "../../../componentes";
import { textoAvisoDeCompraDelEvento, textoCantidad, textoCompradaEl, textoTotal } from "../formato";

export interface PropsFilaCompraDelEvento {
  compra: CompraDelEventoVista;
}

/**
 * Una compra de "Compras del evento" (contracts/app.md): comprador, tipo · cantidad · total, fecha
 * de compra, estado y su aviso. No es tocable (no abre "Tu compra") ni tiene acción de uso (FR-017):
 * un solo elemento accesible que resume la fila.
 */
export function FilaCompraDelEvento({ compra }: PropsFilaCompraDelEvento) {
  const comprador = `${compra.comprador.nombre} ${compra.comprador.apellido}`;
  const tipo = compra.tipoEntrada.nombre;
  const cantidad = textoCantidad(compra.cantidad);
  const total = textoTotal(compra.total);
  const aviso = textoAvisoDeCompraDelEvento(compra);
  return (
    <View
      accessible
      accessibilityLabel={`${comprador}, ${tipo}, ${cantidad}, ${total}, ${textoEtiquetaEstado(compra.estado)}`}
      style={estilos.tarjeta}
    >
      <Text style={estilos.comprador}>{comprador}</Text>
      <Text style={estilos.resumen}>{`${tipo} · ${cantidad} · ${total}`}</Text>
      <Text style={estilos.detalle}>{textoCompradaEl(compra.creadaEnLocal)}</Text>
      <View style={estilos.estado}>
        <EtiquetaEstadoCompra estado={compra.estado} />
        {aviso !== null && <Text style={estilos.aviso}>{aviso}</Text>}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    gap: tema.espacio.minimo,
    padding: tema.espacio.normal,
    borderRadius: tema.radio.tarjeta,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.superficie,
    boxShadow: tema.sombra.nivel1,
  },
  comprador: { ...tema.tipografia.subtitulo, color: tema.colores.texto, flexShrink: 1 },
  resumen: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.texto, flexShrink: 1 },
  detalle: { ...tema.tipografia.secundario, color: tema.colores.textoSecundario, flexShrink: 1 },
  // El aviso va al lado de la etiqueta (nunca la reemplaza) y baja de renglón si no entra.
  estado: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: tema.espacio.chico },
  aviso: { ...tema.tipografia.secundario, color: tema.colores.texto, flexShrink: 1 },
});
