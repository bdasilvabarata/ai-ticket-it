import type { EntradaDelEventoVista } from "@ai-ticket-it/shared";
import { StyleSheet, Text, View } from "react-native";

import { EtiquetaEstadoCompra, tema, textoEtiquetaEstado } from "../../../componentes";
import { textoCodigo, textoCodigoAccesible, textoEntradasUsadas } from "../formato";

export interface PropsTarjetaEntrada {
  entrada: EntradaDelEventoVista;
}

/**
 * La entrada encontrada en "Registrar ingreso" (contracts/app.md): el código en grupos, el
 * comprador, el tipo, el estado de la entrada y, si la compra ya tiene usadas, cuántas. El código se
 * anuncia de a un carácter.
 */
export function TarjetaEntrada({ entrada }: PropsTarjetaEntrada) {
  const { compra } = entrada;
  const comprador = `${compra.comprador.nombre} ${compra.comprador.apellido}`;
  return (
    <View style={estilos.tarjeta}>
      <Text
        style={estilos.codigo}
        accessibilityLabel={`Entrada, código ${textoCodigoAccesible(entrada.codigo)}, ${textoEtiquetaEstado(entrada.estado)}`}
      >
        {textoCodigo(entrada.codigo)}
      </Text>
      <Text style={estilos.comprador}>{comprador}</Text>
      <Text style={estilos.dato}>{compra.tipoEntrada.nombre}</Text>
      <View style={estilos.estado}>
        <EtiquetaEstadoCompra estado={entrada.estado} />
        {compra.entradasUsadas > 0 ? (
          <Text style={estilos.dato}>{textoEntradasUsadas(compra.entradasUsadas, compra.cantidad)}</Text>
        ) : null}
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
  codigo: { ...tema.tipografia.titulo, color: tema.colores.texto },
  comprador: { ...tema.tipografia.subtitulo, color: tema.colores.texto, flexShrink: 1 },
  dato: { ...tema.tipografia.cuerpo, color: tema.colores.textoSecundario, flexShrink: 1 },
  // El aviso va al lado de la etiqueta (nunca la reemplaza) y baja de renglón si no entra.
  estado: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: tema.espacio.chico },
});
