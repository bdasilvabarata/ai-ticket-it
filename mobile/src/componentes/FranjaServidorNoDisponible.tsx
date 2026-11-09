import { useEffect } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tema } from "./tema";

export interface PropsFranjaServidorNoDisponible {
  urlBase: string;
  reintentando: boolean;
  alReintentar: () => void;
}

/**
 * Aviso no bloqueante de servidor no disponible, arriba de todo (R8, FR-021). Ocupa el inset
 * superior de la zona segura; el aviso va con fondo **y** texto, no solo color (FR-022).
 */
export function FranjaServidorNoDisponible({
  urlBase,
  reintentando,
  alReintentar,
}: PropsFranjaServidorNoDisponible) {
  const { top } = useSafeAreaInsets();

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility("Servidor no disponible");
  }, []);

  return (
    <View style={[estilos.franja, { paddingTop: top + tema.espacio.chico }]}>
      {/* El rol va en el texto y no en el contenedor: así el botón sigue siendo un elemento aparte. */}
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={estilos.texto}>
        {`Servidor no disponible · ${urlBase}`}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: reintentando }}
        disabled={reintentando}
        onPress={alReintentar}
        style={({ pressed }) => [estilos.boton, (pressed || reintentando) && estilos.botonApagado]}
      >
        <Text style={estilos.textoBoton}>{reintentando ? "Reintentando…" : "Reintentar"}</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  franja: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: tema.espacio.chico,
    paddingHorizontal: tema.espacio.normal,
    paddingBottom: tema.espacio.chico,
    backgroundColor: tema.colores.avisoFondo,
    borderBottomWidth: 1,
    borderBottomColor: tema.colores.borde,
  },
  texto: { flexGrow: 1, flexShrink: 1, fontSize: tema.texto.chico, color: tema.colores.avisoTexto },
  boton: {
    paddingVertical: tema.espacio.chico,
    paddingHorizontal: tema.espacio.medio,
    borderRadius: tema.radio.normal,
    borderWidth: 1,
    borderColor: tema.colores.avisoTexto,
  },
  botonApagado: { opacity: tema.opacidadApagado },
  textoBoton: { fontSize: tema.texto.chico, fontWeight: tema.peso.fuerte, color: tema.colores.avisoTexto },
});
