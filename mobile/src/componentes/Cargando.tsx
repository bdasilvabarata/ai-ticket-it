import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colores } from "./estilos";

export function Cargando() {
  return (
    <View style={estilos.contenedor}>
      <ActivityIndicator size="large" color={colores.primario} />
      <Text style={estilos.texto}>Cargando…</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  texto: { fontSize: 16, color: colores.texto },
});
