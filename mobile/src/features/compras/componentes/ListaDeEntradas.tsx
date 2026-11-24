import type { EntradaVista } from "@ai-ticket-it/shared";
import { StyleSheet, Text, View } from "react-native";

import { EtiquetaEstadoCompra, tema, textoEtiquetaEstado } from "../../../componentes";
import { textoCodigo, textoCodigoAccesible } from "../formato";

export interface PropsListaDeEntradas {
  entradas: readonly EntradaVista[];
}

/**
 * Las entradas de una compra confirmada o utilizada (feature 008, R14): "Entrada N", el código en
 * grupos de cuatro y su estado. Cada fila es un solo elemento accesible que anuncia el código de a
 * un carácter.
 */
export function ListaDeEntradas({ entradas }: PropsListaDeEntradas) {
  return (
    <View style={estilos.lista}>
      {entradas.map((entrada, indice) => (
        <View
          key={entrada.codigo}
          accessible
          accessibilityLabel={`Entrada ${indice + 1}, código ${textoCodigoAccesible(entrada.codigo)}, ${textoEtiquetaEstado(entrada.estado)}`}
          style={estilos.fila}
        >
          <View style={estilos.textos}>
            <Text style={estilos.numero}>{`Entrada ${indice + 1}`}</Text>
            <Text style={estilos.codigo}>{textoCodigo(entrada.codigo)}</Text>
          </View>
          {/* El estado ya lo anuncia la fila: la etiqueta queda solo a la vista. */}
          <View aria-hidden>
            <EtiquetaEstadoCompra estado={entrada.estado} />
          </View>
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: tema.espacio.chico },
  fila: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tema.espacio.chico,
    paddingVertical: tema.espacio.chico,
    paddingHorizontal: tema.espacio.medio,
    borderRadius: tema.radio.normal,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.superficie,
  },
  textos: { flexShrink: 1, gap: tema.espacio.minimo },
  numero: { ...tema.tipografia.secundario, color: tema.colores.textoSecundario },
  codigo: { ...tema.tipografia.subtitulo, color: tema.colores.texto },
});
