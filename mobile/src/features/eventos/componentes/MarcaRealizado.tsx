import { StyleSheet, Text, View } from "react-native";

import { tema } from "../../../componentes";

/** Marca "Realizado" de un evento: la etiqueta escrita, no solo el color. */
export function MarcaRealizado() {
  return (
    <View style={estilos.marca}>
      <Text style={estilos.texto}>Realizado</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  marca: {
    alignSelf: "flex-start",
    paddingVertical: tema.espacio.minimo,
    paddingHorizontal: tema.espacio.chico,
    borderRadius: tema.radio.normal,
    backgroundColor: tema.colores.neutro,
  },
  texto: { fontSize: tema.texto.chico, fontWeight: tema.peso.fuerte, color: tema.colores.sobreNeutro },
});
