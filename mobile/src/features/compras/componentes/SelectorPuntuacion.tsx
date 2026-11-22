import Ionicons from "@expo/vector-icons/Ionicons";
import { LIMITES_RESENIA } from "@ai-ticket-it/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { hundido, tema } from "../../../componentes";
import { MensajeDeCampo } from "../../eventos";

const PUNTUACIONES = Array.from(
  { length: LIMITES_RESENIA.puntuacionMaxima - LIMITES_RESENIA.puntuacionMinima + 1 },
  (_, i) => LIMITES_RESENIA.puntuacionMinima + i,
);

/**
 * La puntuación de una reseña, de 1 a 5 (feature 012, contracts/app.md): cinco botones `radio` en
 * fila, "N de 5", sin ninguno elegido al empezar. El elegido se distingue por el relleno **y** por la
 * estrella llena (no solo por el color). Debajo, el error de `body.puntuacion` del servidor.
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
      <View accessibilityRole="radiogroup" accessibilityLabel="Puntuación" style={estilos.opciones}>
        {PUNTUACIONES.map((puntuacion) => {
          const elegida = puntuacion === valor;
          return (
            <Pressable
              key={puntuacion}
              accessibilityRole="radio"
              accessibilityLabel={`${puntuacion} de ${LIMITES_RESENIA.puntuacionMaxima}`}
              accessibilityState={{ checked: elegida }}
              onPress={() => alElegir(puntuacion)}
              style={({ pressed }) => [
                estilos.opcion,
                elegida && estilos.elegida,
                pressed ? hundido : estilos.conSombra,
              ]}
            >
              <Ionicons
                name={elegida ? "star" : "star-outline"}
                size={tema.tamano.icono}
                color={tema.colores.texto}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
              <Text style={estilos.numero}>{puntuacion}</Text>
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
  // Cinco botones que se reparten el ancho: entran en 360 px sin scroll horizontal.
  opciones: { flexDirection: "row", gap: tema.espacio.chico },
  opcion: {
    flex: 1,
    minHeight: tema.tamano.tactil,
    minWidth: tema.tamano.tactil,
    alignItems: "center",
    justifyContent: "center",
    gap: tema.espacio.minimo,
    paddingVertical: tema.espacio.chico,
    borderRadius: tema.radio.normal,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.superficie,
  },
  conSombra: { boxShadow: tema.sombra.nivel1 },
  // El amarillo siempre con `texto` encima.
  elegida: { backgroundColor: tema.colores.resaltado },
  numero: { ...tema.tipografia.etiqueta, color: tema.colores.texto },
});
