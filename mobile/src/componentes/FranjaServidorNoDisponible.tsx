import { useEffect } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colores } from "./estilos";

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
    <View style={[estilos.franja, { paddingTop: top + 8 }]}>
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
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: colores.avisoFondo,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
  texto: { flexGrow: 1, flexShrink: 1, fontSize: 14, color: colores.avisoTexto },
  boton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colores.avisoTexto,
  },
  botonApagado: { opacity: 0.6 },
  textoBoton: { fontSize: 14, fontWeight: "600", color: colores.avisoTexto },
});
