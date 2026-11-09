import type { UsuarioVista } from "@ai-ticket-it/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colores } from "../../../componentes";
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.borde,
    backgroundColor: colores.fondo,
  },
  presionada: { opacity: 0.6 },
  textos: { flex: 1, gap: 2 },
  nombre: { fontSize: 17, fontWeight: "500", color: colores.texto },
  detalle: { fontSize: 14, color: colores.textoSecundario },
  actual: { fontSize: 14, fontWeight: "600", color: colores.primario, marginLeft: 12 },
});
