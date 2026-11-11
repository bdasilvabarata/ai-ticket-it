import { StyleSheet, Text } from "react-native";

import { tema } from "../../../componentes";

/** El error de un campo, tal como lo respondió el servidor; se anuncia al aparecer. */
export function MensajeDeCampo({ mensaje }: { mensaje?: string | null }) {
  if (!mensaje) return null;
  return (
    <Text style={estilos.mensaje} accessibilityLiveRegion="polite">
      {mensaje}
    </Text>
  );
}

const estilos = StyleSheet.create({
  mensaje: { fontSize: tema.texto.chico, color: tema.colores.peligro },
});
