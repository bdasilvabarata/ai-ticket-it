import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";

import { tema } from "../../../componentes";

/** Marca "Realizado" de un evento: la etiqueta escrita, no solo el color. */
export function MarcaRealizado() {
  return (
    <View style={estilos.marca}>
      <Ionicons
        name="flag-outline"
        size={tema.tamano.iconoChico}
        color={tema.colores.sobreNeutro}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={estilos.texto}>Realizado</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  marca: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: tema.espacio.minimo,
    height: tema.tamano.badge,
    paddingHorizontal: tema.espacio.chico,
    borderRadius: tema.radio.pildora,
    borderWidth: tema.grosor.fino,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.neutro,
  },
  texto: { ...tema.tipografia.badge, color: tema.colores.sobreNeutro },
});
