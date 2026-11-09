import { Pressable, StyleSheet, Text, View } from "react-native";

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
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: reintentando }}
          disabled={reintentando}
          onPress={alReintentar}
          style={({ pressed }) => [estilos.boton, (pressed || reintentando) && estilos.botonApagado]}
        >
          <Text style={estilos.textoBoton}>{reintentando ? "Reintentando…" : "Reintentar"}</Text>
        </Pressable>
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
  boton: {
    paddingVertical: tema.espacio.medio,
    paddingHorizontal: tema.espacio.grande,
    borderRadius: tema.radio.normal,
    backgroundColor: tema.colores.primario,
  },
  botonApagado: { opacity: tema.opacidadApagado },
  textoBoton: {
    color: tema.colores.sobrePrimario,
    fontSize: tema.texto.normal,
    fontWeight: tema.peso.fuerte,
  },
});
