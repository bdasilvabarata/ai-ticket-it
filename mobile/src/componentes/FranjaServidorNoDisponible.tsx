import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Boton } from "./Boton";
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
      <Ionicons
        name="cloud-offline-outline"
        size={tema.tamano.icono}
        color={tema.colores.avisoTexto}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      {/* El rol va en el texto y no en el contenedor: así el botón sigue siendo un elemento aparte. */}
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={estilos.texto}>
        {`Servidor no disponible · ${urlBase}`}
      </Text>
      <Boton
        variante="aviso"
        texto="Reintentar"
        textoEnCurso="Reintentando…"
        enCurso={reintentando}
        alPresionar={alReintentar}
      />
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
    borderBottomWidth: tema.grosor.normal,
    borderBottomColor: tema.colores.borde,
  },
  texto: { ...tema.tipografia.mensaje, flexGrow: 1, flexShrink: 1, color: tema.colores.avisoTexto },
});
