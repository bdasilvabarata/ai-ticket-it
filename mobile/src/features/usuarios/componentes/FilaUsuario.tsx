import type { UsuarioVista } from "@ai-ticket-it/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { tema } from "../../../componentes";
import { nombreCompleto, textoEventosOrganizados } from "../formato";

export interface PropsFilaUsuario {
  usuario: UsuarioVista;
  esActual: boolean;
  deshabilitada: boolean;
  alElegir: (usuario: UsuarioVista) => void;
}

/** Una fila del selector de usuario. */
export function FilaUsuario({ usuario, esActual, deshabilitada, alElegir }: PropsFilaUsuario) {
  const nombre = nombreCompleto(usuario);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={esActual ? `${nombre}, usuario actual` : `Elegir a ${nombre}`}
      accessibilityState={{ disabled: deshabilitada, selected: esActual }}
      disabled={deshabilitada}
      onPress={() => alElegir(usuario)}
      style={({ pressed }) => [estilos.fila, pressed && estilos.presionada]}
    >
      <View style={estilos.textos}>
        <Text style={estilos.nombre}>{nombre}</Text>
        <Text style={estilos.detalle}>{textoEventosOrganizados(usuario.cantidadEventosOrganizados)}</Text>
      </View>
      {esActual ? <Text style={estilos.actual}>Actual</Text> : null}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: tema.espacio.fila,
    paddingHorizontal: tema.espacio.normal,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.colores.borde,
    backgroundColor: tema.colores.fondo,
  },
  presionada: { opacity: tema.opacidadApagado },
  textos: { flex: 1, gap: tema.espacio.minimo },
  nombre: { fontSize: tema.texto.destacado, fontWeight: tema.peso.medio, color: tema.colores.texto },
  detalle: { fontSize: tema.texto.chico, color: tema.colores.textoSecundario },
  actual: {
    fontSize: tema.texto.chico,
    fontWeight: tema.peso.fuerte,
    color: tema.colores.primario,
    marginLeft: tema.espacio.medio,
  },
});
