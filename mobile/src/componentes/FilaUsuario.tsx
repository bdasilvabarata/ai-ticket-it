import type { UsuarioVista } from "@ai-ticket-it/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colores } from "./estilos";

export interface PropsFilaUsuario {
  usuario: UsuarioVista;
  esActual: boolean;
  deshabilitada: boolean;
  alElegir: (usuario: UsuarioVista) => void;
}

export function textoEventos(cantidad: number): string {
  if (cantidad === 0) return "No organiza eventos";
  return cantidad === 1 ? "Organiza 1 evento" : `Organiza ${cantidad} eventos`;
}

/** Una fila del selector de usuario. */
export function FilaUsuario({ usuario, deshabilitada, alElegir }: PropsFilaUsuario) {
  const nombre = `${usuario.nombre} ${usuario.apellido}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Elegir a ${nombre}`}
      accessibilityState={{ disabled: deshabilitada }}
      disabled={deshabilitada}
      onPress={() => alElegir(usuario)}
      style={({ pressed }) => [estilos.fila, pressed && estilos.presionada]}
    >
      <View style={estilos.textos}>
        <Text style={estilos.nombre}>{nombre}</Text>
        <Text style={estilos.detalle}>{textoEventos(usuario.cantidadEventosOrganizados)}</Text>
      </View>
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
});
