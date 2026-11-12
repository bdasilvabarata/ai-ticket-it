import { ORDENES_CATALOGO, type OrdenCatalogo } from "@ai-ticket-it/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { tema } from "../../../componentes";
import { estilosDeCampo } from "./CampoDeTexto";

export interface PropsSelectorOrden {
  valor: OrdenCatalogo;
  alCambiar: (orden: OrdenCatalogo) => void;
}

const NOMBRES: Record<OrdenCatalogo, string> = { fecha: "Fecha", precio: "Precio", puntaje: "Puntaje" };

/** El orden del catálogo, con el mismo estilo de chips que `SelectorCategoria`. */
export function SelectorOrden({ valor, alCambiar }: PropsSelectorOrden) {
  return (
    <View style={estilos.contenedor}>
      <Text style={estilosDeCampo.etiqueta}>Ordenar por</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Ordenar por" style={estilos.opciones}>
        {ORDENES_CATALOGO.map((orden) => {
          const elegido = orden === valor;
          return (
            <Pressable
              key={orden}
              accessibilityRole="radio"
              accessibilityLabel={NOMBRES[orden]}
              accessibilityState={{ checked: elegido }}
              onPress={() => alCambiar(orden)}
              style={({ pressed }) => [
                estilos.opcion,
                pressed && estilos.presionada,
                elegido && estilos.elegida,
              ]}
            >
              <Text style={[estilos.texto, elegido && estilos.textoElegido]}>{NOMBRES[orden]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: tema.espacio.chico },
  opciones: { flexDirection: "row", flexWrap: "wrap", gap: tema.espacio.chico },
  opcion: {
    minHeight: tema.tamano.chip,
    justifyContent: "center",
    paddingHorizontal: tema.espacio.medio,
    borderRadius: tema.radio.pildora,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.superficie,
  },
  elegida: { backgroundColor: tema.colores.primario },
  presionada: { backgroundColor: tema.colores.neutro },
  texto: { ...tema.tipografia.botonChico, color: tema.colores.texto },
  textoElegido: { color: tema.colores.sobrePrimario },
});
