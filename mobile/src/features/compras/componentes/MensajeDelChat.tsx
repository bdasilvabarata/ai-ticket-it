import type { MensajeVista } from "@ai-ticket-it/shared";
import { StyleSheet, Text, View } from "react-native";

import { tema } from "../../../componentes";
import { textoFechaHora } from "../../eventos";
import { etiquetaDelMensaje, textoAutorDelMensaje } from "../formato";

/**
 * Un mensaje del chat (R12). Los propios van a la derecha, con "Vos" y fondo `resaltado`; los del
 * otro, a la izquierda, con su nombre y su rol y fondo `superficie`: se distinguen por la posición y
 * el texto, no solo por el color (FR-017). TalkBack lo lee como una unidad, con la etiqueta de
 * `etiquetaDelMensaje` (FR-021).
 */
export function MensajeDelChat({ mensaje, usuarioId }: { mensaje: MensajeVista; usuarioId: string }) {
  const propio = mensaje.autor.id === usuarioId;
  return (
    <View
      accessible
      accessibilityLabel={etiquetaDelMensaje(mensaje, usuarioId)}
      style={[estilos.globo, propio ? estilos.propio : estilos.ajeno]}
    >
      <Text style={estilos.autor}>{textoAutorDelMensaje(mensaje, usuarioId)}</Text>
      <Text style={estilos.texto}>{mensaje.texto}</Text>
      <Text style={estilos.hora}>{textoFechaHora(mensaje.enviadoEnLocal)}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  globo: {
    gap: tema.espacio.minimo,
    padding: tema.espacio.medio,
    borderRadius: tema.radio.tarjeta,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    boxShadow: tema.sombra.nivel1,
    maxWidth: tema.anchoMaximoMensaje,
    flexShrink: 1,
  },
  propio: { alignSelf: "flex-end", backgroundColor: tema.colores.resaltado },
  ajeno: { alignSelf: "flex-start", backgroundColor: tema.colores.superficie },
  autor: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.texto },
  texto: { ...tema.tipografia.cuerpo, color: tema.colores.texto, flexShrink: 1 },
  hora: { ...tema.tipografia.secundario, color: tema.colores.texto },
});
