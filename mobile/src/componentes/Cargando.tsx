import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { tema } from "./tema";

export function Cargando() {
  return (
    <View style={estilos.contenedor}>
      <ActivityIndicator size="large" color={tema.colores.primario} />
      <Text style={estilos.texto}>Cargando…</Text>
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
  texto: { fontSize: tema.texto.normal, color: tema.colores.texto },
});
