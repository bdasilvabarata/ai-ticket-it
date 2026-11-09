import { Image, StyleSheet } from "react-native";

import imagenLogo from "../../assets/logo.png";
import { tema } from "./tema";

/** Proporción ancho/alto de assets/logo.png (480 × 554). */
const PROPORCION = 480 / 554;

export function Logo() {
  return (
    <Image
      source={imagenLogo}
      style={estilos.logo}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="AI Ticket It"
    />
  );
}

const estilos = StyleSheet.create({
  logo: { height: tema.logo.alto, aspectRatio: PROPORCION, alignSelf: "center" },
});
