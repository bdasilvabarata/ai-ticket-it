import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { hundido, tema } from "./tema";

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

const colorDelTexto = {
  primario: tema.colores.sobrePrimario,
  aviso: tema.colores.texto,
  texto: tema.colores.primario,
} as const;

/**
 * Botón base de la app (FR-012, research R7), accesible. El primario es la acción principal; el
 * aviso, una secundaria (superficie con borde); el de texto, una acción liviana. Los dos con borde
 * llevan sombra dura y se hunden al presionarlos.
 */
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
  const conSombra = variante !== "texto";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: inactivo, busy: enCurso }}
      disabled={inactivo}
      hitSlop={hitSlop}
      onPress={alPresionar}
      style={({ pressed }) => [
        estilos.base,
        contenedores[variante],
        conSombra && !pressed && !inactivo && estilos.sombra,
        conSombra && pressed && hundido,
        !conSombra && pressed && estilos.textoPresionado,
        inactivo && estilos.apagado,
        style,
      ]}
    >
      {({ pressed }) => (
        <>
          {enCurso ? <ActivityIndicator size="small" color={colorDelTexto[variante]} /> : null}
          <Text
            style={[
              textos[variante],
              { color: !conSombra && pressed ? tema.colores.texto : colorDelTexto[variante] },
            ]}
          >
            {enCurso ? textoEnCurso : texto}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tema.espacio.chico,
    borderRadius: tema.radio.normal,
  },
  sombra: { boxShadow: tema.sombra.nivel1 },
  textoPresionado: { backgroundColor: tema.colores.resaltado },
  apagado: { opacity: tema.opacidadApagado },
});

const contenedores = StyleSheet.create({
  primario: {
    minHeight: tema.tamano.boton,
    paddingHorizontal: tema.espacio.grande,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.primario,
  },
  aviso: {
    minHeight: tema.tamano.tactil,
    paddingHorizontal: tema.espacio.normal,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.superficie,
  },
  texto: {
    minHeight: tema.tamano.tactil,
    paddingHorizontal: tema.espacio.chico,
  },
});

const textos = StyleSheet.create({
  primario: tema.tipografia.boton,
  aviso: tema.tipografia.botonChico,
  texto: tema.tipografia.botonChico,
});
