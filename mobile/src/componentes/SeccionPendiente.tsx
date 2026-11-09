import { StyleSheet, Text, View } from "react-native";

import { tema } from "./tema";

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
  contenedor: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: tema.espacio.amplio,
    gap: tema.espacio.chico,
  },
  titulo: {
    fontSize: tema.texto.titulo,
    fontWeight: tema.peso.fuerte,
    color: tema.colores.texto,
    textAlign: "center",
  },
  texto: { fontSize: tema.texto.normal, color: tema.colores.textoSecundario, textAlign: "center" },
});
