import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { tema } from "./tema";

export interface PropsBoton {
  texto: string;
  alPresionar: () => void;
  /** Por defecto, `"primario"`. */
  variante?: "primario" | "aviso" | "texto";
  deshabilitado?: boolean;
  /** Deshabilita el botón, lo anuncia como ocupado y muestra `textoEnCurso`. */
  enCurso?: boolean;
  /** Por defecto, el mismo `texto`. */
  textoEnCurso?: string;
  accessibilityLabel?: string;
  hitSlop?: number;
  /** Solo para ubicarlo (márgenes). */
  style?: StyleProp<ViewStyle>;
}

/** Botón base de la app (FR-012, research R7): variantes con los estilos de siempre y accesible. */
export function Boton({
  texto,
  alPresionar,
  variante = "primario",
  deshabilitado = false,
  enCurso = false,
  textoEnCurso = texto,
  accessibilityLabel,
  hitSlop,
  style,
}: PropsBoton) {
  const inactivo = deshabilitado || enCurso;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: inactivo, busy: enCurso }}
      disabled={inactivo}
      hitSlop={hitSlop}
      onPress={alPresionar}
      style={({ pressed }) => [contenedores[variante], style, (pressed || inactivo) && estilos.apagado]}
    >
      <Text style={textos[variante]}>{enCurso ? textoEnCurso : texto}</Text>
    </Pressable>
  );
}

const contenedores = StyleSheet.create({
  primario: {
    paddingVertical: tema.espacio.medio,
    paddingHorizontal: tema.espacio.grande,
    borderRadius: tema.radio.normal,
    backgroundColor: tema.colores.primario,
  },
  aviso: {
    paddingVertical: tema.espacio.chico,
    paddingHorizontal: tema.espacio.medio,
    borderRadius: tema.radio.normal,
    borderWidth: 1,
    borderColor: tema.colores.avisoTexto,
  },
  texto: {},
});

const textos = StyleSheet.create({
  primario: { color: tema.colores.sobrePrimario, fontSize: tema.texto.normal, fontWeight: tema.peso.fuerte },
  aviso: { fontSize: tema.texto.chico, fontWeight: tema.peso.fuerte, color: tema.colores.avisoTexto },
  texto: { fontSize: tema.texto.normal, fontWeight: tema.peso.fuerte, color: tema.colores.primario },
});

const estilos = StyleSheet.create({
  apagado: { opacity: tema.opacidadApagado },
});
