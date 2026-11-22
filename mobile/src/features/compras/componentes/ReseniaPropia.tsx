import type { ReseniaVista } from "@ai-ticket-it/shared";
import { StyleSheet, Text, View } from "react-native";

import { tema } from "../../../componentes";
import { Puntuacion } from "../../eventos";

/**
 * La reseña propia (feature 012): la puntuación y el comentario, si tiene (sin texto de relleno). La
 * muestran "Tu compra", "Mis compras" y "Reseñar evento" cuando ya se reseñó.
 */
export function ReseniaPropia({ resenia }: { resenia: ReseniaVista }) {
  return (
    <View style={estilos.resenia}>
      <Puntuacion puntuacion={resenia.puntuacion} />
      {resenia.comentario ? <Text style={estilos.comentario}>{resenia.comentario}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  resenia: { gap: tema.espacio.minimo, flexShrink: 1 },
  comentario: { ...tema.tipografia.cuerpo, color: tema.colores.texto, flexShrink: 1 },
});
