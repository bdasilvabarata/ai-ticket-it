import type { ReseniaDelOrganizadorVista } from "@ai-ticket-it/shared";
import { StyleSheet, Text, View } from "react-native";

import { tema } from "../../../componentes";
import { etiquetaDeResenia, textoFechaResenia } from "../formato";
import { Puntuacion } from "./Puntuacion";

/**
 * Una reseña de "Reseñas del organizador" (feature 012): la puntuación, el comentario (si tiene),
 * el autor, el evento y el día. Es **un** elemento accesible que se lee con `etiquetaDeResenia`.
 */
export function FilaResenia({ resenia }: { resenia: ReseniaDelOrganizadorVista }) {
  return (
    <View style={estilos.fila} accessible accessibilityLabel={etiquetaDeResenia(resenia)}>
      <Puntuacion puntuacion={resenia.puntuacion} />
      {resenia.comentario === null ? null : <Text style={estilos.comentario}>{resenia.comentario}</Text>}
      <View style={estilos.datos}>
        <Text style={estilos.autor}>{`${resenia.autor.nombre} ${resenia.autor.apellido}`}</Text>
        <Text style={estilos.detalle}>{resenia.evento.nombre}</Text>
        <Text style={estilos.detalle}>{textoFechaResenia(resenia.creadaEnLocal)}</Text>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    gap: tema.espacio.minimo,
    paddingVertical: tema.espacio.chico,
    borderBottomWidth: tema.grosor.fino,
    borderBottomColor: tema.colores.borde,
  },
  comentario: { ...tema.tipografia.cuerpo, color: tema.colores.texto, flexShrink: 1 },
  datos: { flexDirection: "row", flexWrap: "wrap", columnGap: tema.espacio.chico },
  autor: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.texto },
  detalle: { ...tema.tipografia.secundario, color: tema.colores.textoSecundario },
});
