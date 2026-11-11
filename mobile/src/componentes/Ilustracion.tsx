import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { tema } from "./tema";

export interface PropsIlustracion {
  icono: keyof typeof Ionicons.glyphMap;
  /** Por defecto, `"resaltado"` (vacío); `"peligro"` para un error. */
  tono?: "resaltado" | "peligro";
}

/** Círculo con un ícono que encabeza los estados vacío y de error. Decorativo: no se anuncia. */
export function Ilustracion({ icono, tono = "resaltado" }: PropsIlustracion) {
  const color = tono === "peligro" ? tema.colores.sobrePeligro : tema.colores.texto;
  return (
    <View
      style={[estilos.circulo, tono === "peligro" ? estilos.peligro : estilos.resaltado]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Ionicons name={icono} size={tema.tamano.iconoGrande} color={color} />
    </View>
  );
}

const estilos = StyleSheet.create({
  circulo: {
    width: tema.tamano.ilustracion,
    height: tema.tamano.ilustracion,
    borderRadius: tema.radio.pildora,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: tema.sombra.nivel1,
  },
  resaltado: { backgroundColor: tema.colores.resaltado },
  peligro: { backgroundColor: tema.colores.peligro },
});
