import Ionicons from "@expo/vector-icons/Ionicons";
import { LIMITES_RESENIA } from "@ai-ticket-it/shared";
import { StyleSheet, View } from "react-native";

import { tema } from "../../../componentes";
import { textoPuntuacion } from "../formato";

const MARCAS = Array.from({ length: LIMITES_RESENIA.puntuacionMaxima }, (_, i) => i + 1);

/**
 * La puntuación de una reseña, de solo lectura (feature 012): cinco estrellas, las llenas por forma
 * (estrella rellena o solo el contorno) y no solo por color. Es un único elemento accesible que se
 * lee "Puntuación: N de 5".
 */
export function Puntuacion({ puntuacion }: { puntuacion: number }) {
  return (
    <View
      style={estilos.fila}
      accessible
      accessibilityRole="image"
      accessibilityLabel={textoPuntuacion(puntuacion)}
    >
      {MARCAS.map((marca) => (
        <Ionicons
          key={marca}
          name={marca <= puntuacion ? "star" : "star-outline"}
          size={tema.tamano.iconoChico}
          color={tema.colores.texto}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", gap: tema.espacio.minimo },
});
