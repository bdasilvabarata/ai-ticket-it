import { StyleSheet, Text, View } from "react-native";

import { Ilustracion, type PropsIlustracion } from "./Ilustracion";
import { tema } from "./tema";

export interface PropsListaVacia {
  mensaje: string;
  /** Por defecto, una bandeja vacía. */
  icono?: PropsIlustracion["icono"];
}

export function ListaVacia({ mensaje, icono = "file-tray-outline" }: PropsListaVacia) {
  return (
    <View style={estilos.contenedor}>
      <Ilustracion icono={icono} />
      <Text style={estilos.texto}>{mensaje}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: tema.espacio.amplio,
    gap: tema.espacio.normal,
  },
  texto: { ...tema.tipografia.cuerpo, textAlign: "center", color: tema.colores.textoSecundario },
});
