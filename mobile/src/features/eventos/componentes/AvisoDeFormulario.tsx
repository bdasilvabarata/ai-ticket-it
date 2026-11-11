import { StyleSheet, Text, View } from "react-native";

import { tema } from "../../../componentes";

/** Un error que no es de un campo (403, otros 409, error del servidor), con el mensaje del servidor. */
export function AvisoDeFormulario({ mensaje }: { mensaje?: string | null }) {
  if (!mensaje) return null;
  return (
    <View style={estilos.aviso} accessibilityLiveRegion="polite">
      <Text style={estilos.texto}>{mensaje}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  aviso: {
    padding: tema.espacio.medio,
    borderRadius: tema.radio.normal,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.avisoFondo,
  },
  texto: { ...tema.tipografia.mensaje, color: tema.colores.avisoTexto },
});
