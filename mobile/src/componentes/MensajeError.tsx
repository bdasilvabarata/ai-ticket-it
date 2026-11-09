import { Pressable, StyleSheet, Text, View } from "react-native";

import { colores } from "./estilos";

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
  contenedor: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  titulo: { fontSize: 18, fontWeight: "600", textAlign: "center", color: colores.texto },
  mensaje: { fontSize: 16, textAlign: "center", color: colores.texto },
  boton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: colores.primario },
  botonApagado: { opacity: 0.6 },
  textoBoton: { color: colores.sobrePrimario, fontSize: 16, fontWeight: "600" },
});
