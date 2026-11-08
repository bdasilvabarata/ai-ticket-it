import { StyleSheet, Text, View } from "react-native";

import { colores } from "./estilos";

export function ListaVacia({ mensaje }: { mensaje: string }) {
  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.texto}>{mensaje}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  texto: { fontSize: 16, textAlign: "center", color: colores.textoSecundario },
});
