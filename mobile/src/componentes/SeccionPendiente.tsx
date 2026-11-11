import { StyleSheet, Text, View } from "react-native";

import { Ilustracion } from "./Ilustracion";
import { tema } from "./tema";

/** Sección de la navegación principal que todavía no tiene contenido (FR-018). */
export function SeccionPendiente({ nombre }: { nombre: string }) {
  return (
    <View style={estilos.contenedor}>
      <Ilustracion icono="construct-outline" />
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
    gap: tema.espacio.medio,
    backgroundColor: tema.colores.fondo,
  },
  titulo: { ...tema.tipografia.titulo, color: tema.colores.texto, textAlign: "center" },
  texto: { ...tema.tipografia.cuerpo, color: tema.colores.textoSecundario, textAlign: "center" },
});
