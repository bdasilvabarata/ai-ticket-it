import { StyleSheet, Text, View } from "react-native";

import { Boton } from "./Boton";
import { Ilustracion } from "./Ilustracion";
import { tema } from "./tema";

export interface PropsMensajeError {
  mensaje: string;
  titulo?: string;
  alReintentar?: () => void;
  reintentando?: boolean;
}

/** Estado de error de una pantalla, con "Reintentar" opcional. */
export function MensajeError({ mensaje, titulo, alReintentar, reintentando = false }: PropsMensajeError) {
  return (
    <View style={estilos.contenedor}>
      <Ilustracion icono="alert-circle-outline" tono="peligro" />
      {titulo ? (
        <Text style={estilos.titulo} accessibilityRole="header">
          {titulo}
        </Text>
      ) : null}
      <Text style={estilos.mensaje}>{mensaje}</Text>
      {alReintentar ? (
        <Boton
          texto="Reintentar"
          textoEnCurso="Reintentando…"
          enCurso={reintentando}
          alPresionar={alReintentar}
          style={estilos.boton}
        />
      ) : null}
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
  titulo: { ...tema.tipografia.subtitulo, textAlign: "center", color: tema.colores.texto },
  mensaje: { ...tema.tipografia.cuerpo, textAlign: "center", color: tema.colores.textoSecundario },
  boton: { marginTop: tema.espacio.chico },
});
