import { StyleSheet, Text, View } from "react-native";

import { colores } from "./estilos";

/** Sección de la navegación principal que todavía no tiene contenido (FR-018). */
export function SeccionPendiente({ nombre }: { nombre: string }) {
  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.titulo} accessibilityRole="header">
        {nombre}
      </Text>
      <Text style={estilos.texto}>Esta sección todavía no está disponible.</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  titulo: { fontSize: 22, fontWeight: "600", color: colores.texto, textAlign: "center" },
  texto: { fontSize: 16, color: colores.textoSecundario, textAlign: "center" },
});
