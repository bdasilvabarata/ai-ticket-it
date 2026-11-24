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
      style={({ pressed }) => [estilos.fila, pressed && estilos.presionada, deshabilitada && estilos.apagada]}
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
    borderBottomWidth: tema.grosor.fino,
    borderBottomColor: tema.colores.borde,
    backgroundColor: tema.colores.fondo,
  },
  presionada: { backgroundColor: tema.colores.neutro },
  apagada: { opacity: tema.opacidadApagado },
  textos: { flex: 1, gap: tema.espacio.minimo },
  nombre: { ...tema.tipografia.tituloTarjeta, color: tema.colores.texto },
  detalle: { ...tema.tipografia.secundario, color: tema.colores.textoSecundario },
  actual: {
    ...tema.tipografia.badge,
    color: tema.colores.primario,
    marginLeft: tema.espacio.medio,
  },
});
