import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { tema } from "../../../componentes";

/**
 * Estrella indicadora de un favorito (feature 014, FR-015): solo indica, no se toca ni se enfoca
 * aparte; lo dice la etiqueta de la tarjeta o fila (", en favoritos"). Va en la esquina superior
 * derecha de su contenedor, que deja lugar para que no tape el título.
 */
export function MarcaFavorito() {
  return (
    <View
      testID="marca-favorito"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={estilos.marca}
    >
      <Ionicons name="star" size={tema.tamano.icono} color={tema.colores.texto} />
    </View>
  );
}

const estilos = StyleSheet.create({
  marca: {
    position: "absolute",
    top: tema.espacio.chico,
    right: tema.espacio.chico,
    width: tema.tamano.pastillaAncho,
    height: tema.tamano.pastillaAncho,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tema.radio.pildora,
    borderWidth: tema.grosor.fino,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.resaltado,
  },
});
