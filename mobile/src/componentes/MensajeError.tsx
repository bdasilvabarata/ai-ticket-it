import { StyleSheet, Text, View } from "react-native";

import { Boton } from "./Boton";
import { tema } from "./tema";

export interface PropsMensajeError {
  mensaje: string;
  titulo?: string;
  alReintentar?: () => void;
  reintentando?: boolean;
}

/** Estado de error de una pantalla, con "Reintentar" opcional. */
export function MensajeError({ mensaje, titulo, alReintentar, reintentando = false }: PropsMensajeError) {
  return (
    <View style={estilos.contenedor}>
      {titulo ? (
        <Text style={estilos.titulo} accessibilityRole="header">
          {titulo}
        </Text>
      ) : null}
      <Text style={estilos.mensaje}>{mensaje}</Text>
      {alReintentar ? (
        <Boton
          texto="Reintentar"
          textoEnCurso="Reintentando…"
          enCurso={reintentando}
          alPresionar={alReintentar}
        />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: tema.espacio.amplio,
    gap: tema.espacio.medio,
  },
  titulo: {
    fontSize: tema.texto.subtitulo,
    fontWeight: tema.peso.fuerte,
    textAlign: "center",
    color: tema.colores.texto,
  },
  mensaje: { fontSize: tema.texto.normal, textAlign: "center", color: tema.colores.texto },
});
