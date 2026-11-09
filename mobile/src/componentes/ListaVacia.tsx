import { StyleSheet, Text, View } from "react-native";

import { tema } from "./tema";

export function ListaVacia({ mensaje }: { mensaje: string }) {
  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.texto}>{mensaje}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, alignItems: "center", justifyContent: "center", padding: tema.espacio.amplio },
  texto: { fontSize: tema.texto.normal, textAlign: "center", color: tema.colores.textoSecundario },
});
