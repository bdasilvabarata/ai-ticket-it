import Ionicons from "@expo/vector-icons/Ionicons";
import { LIMITES_RESENIA } from "@ai-ticket-it/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { tema } from "../../../componentes";
import { MensajeDeCampo } from "../../eventos";

const PUNTUACIONES = Array.from(
  { length: LIMITES_RESENIA.puntuacionMaxima - LIMITES_RESENIA.puntuacionMinima + 1 },
  (_, i) => LIMITES_RESENIA.puntuacionMinima + i,
);

/**
 * La puntuación de una reseña, de 1 a 5 (feature 012, contracts/app.md): cinco estrellas en fila, de
 * izquierda a derecha, sin ninguna elegida al empezar. Tocar la N pinta de amarillo las estrellas 1 a
 * N; las demás quedan solo con el contorno. Cada estrella es un `radio` "N de 5" (marcado solo el
 * elegido), con el área táctil mínima aunque se dibuje sin caja. El contorno oscuro va siempre, así la
 * pintada se distingue por la forma rellena y no solo por el color. Debajo, el error de
 * `body.puntuacion` del servidor.
 */
export function SelectorPuntuacion({
  valor,
  alElegir,
  error,
}: {
  valor: number | null;
  alElegir: (puntuacion: number) => void;
  error?: string | null;
}) {
  return (
    <View style={estilos.selector}>
      <Text style={estilos.etiqueta}>Puntuación</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Puntuación" style={estilos.estrellas}>
        {PUNTUACIONES.map((puntuacion) => {
          const pintada = valor !== null && puntuacion <= valor;
          return (
            <Pressable
              key={puntuacion}
              accessibilityRole="radio"
              accessibilityLabel={`${puntuacion} de ${LIMITES_RESENIA.puntuacionMaxima}`}
              accessibilityState={{ checked: puntuacion === valor }}
              onPress={() => alElegir(puntuacion)}
              hitSlop={tema.espacio.minimo}
              style={({ pressed }) => [estilos.estrella, pressed && estilos.presionada]}
            >
              {pintada && (
                <Ionicons
                  name="star"
                  size={tema.tamano.iconoGrande}
                  color={tema.colores.resaltado}
                  style={estilos.relleno}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              )}
              <Ionicons
                name="star-outline"
                size={tema.tamano.iconoGrande}
                color={tema.colores.texto}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            </Pressable>
          );
        })}
      </View>
      <MensajeDeCampo mensaje={error} />
    </View>
  );
}

const estilos = StyleSheet.create({
  selector: { gap: tema.espacio.chico },
  etiqueta: { ...tema.tipografia.etiqueta, color: tema.colores.texto },
  estrellas: { flexDirection: "row", gap: tema.espacio.chico },
  estrella: {
    minHeight: tema.tamano.tactil,
    minWidth: tema.tamano.tactil,
    alignItems: "center",
    justifyContent: "center",
  },
  presionada: { opacity: tema.opacidadApagado },
  // El relleno amarillo queda debajo del contorno, centrado en la misma caja.
  relleno: { position: "absolute" },
});
