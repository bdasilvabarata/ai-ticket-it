import { Pressable, StyleSheet, Text, View } from "react-native";

import { tema } from "../../../componentes";
import { FILTROS_DE_COMPRAS, textoDelFiltro, type FiltroDeCompras } from "../filtro-de-compras";

export interface PropsFiltroPorEstado {
  filtro: FiltroDeCompras;
  alCambiar: (filtro: FiltroDeCompras) => void;
}

/**
 * Los chips del filtro de "Compras del evento": un grupo de radios ("Todas", "Sin responder",
 * "Pendiente"…) con el elegido marcado por color y por `checked`, que lee el lector de pantalla.
 */
export function FiltroPorEstado({ filtro: elegido, alCambiar }: PropsFiltroPorEstado) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Filtrar compras" style={estilos.opciones}>
      {FILTROS_DE_COMPRAS.map((filtro) => {
        const esElegido = filtro === elegido;
        const texto = textoDelFiltro(filtro);
        return (
          <Pressable
            key={filtro}
            accessibilityRole="radio"
            accessibilityLabel={texto}
            accessibilityState={{ checked: esElegido }}
            onPress={() => alCambiar(filtro)}
            style={({ pressed }) => [
              estilos.opcion,
              pressed && estilos.presionada,
              esElegido && estilos.elegida,
            ]}
          >
            <Text style={[estilos.texto, esElegido && estilos.textoElegido]}>{texto}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
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
