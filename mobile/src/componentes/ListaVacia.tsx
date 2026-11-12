import { StyleSheet, Text, View } from "react-native";

import { Boton } from "./Boton";
import { Ilustracion, type PropsIlustracion } from "./Ilustracion";
import { tema } from "./tema";

export interface PropsListaVacia {
  mensaje: string;
  /** Por defecto, una bandeja vacía. */
  icono?: PropsIlustracion["icono"];
  /** Una acción debajo del mensaje (por ejemplo, "Limpiar búsqueda"). */
  accion?: { texto: string; alPresionar: () => void };
}

export function ListaVacia({ mensaje, icono = "file-tray-outline", accion }: PropsListaVacia) {
  return (
    <View style={estilos.contenedor}>
      <Ilustracion icono={icono} />
      <Text style={estilos.texto}>{mensaje}</Text>
      {accion ? <Boton variante="aviso" texto={accion.texto} alPresionar={accion.alPresionar} /> : null}
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
