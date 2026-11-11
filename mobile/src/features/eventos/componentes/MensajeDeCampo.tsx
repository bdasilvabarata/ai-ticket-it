import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";

import { tema } from "../../../componentes";

/** El error de un campo, tal como lo respondió el servidor; se anuncia al aparecer. */
export function MensajeDeCampo({ mensaje }: { mensaje?: string | null }) {
  if (!mensaje) return null;
  return (
    <View style={estilos.fila}>
      <Ionicons
        name="alert-circle"
        size={tema.tamano.iconoChico}
        color={tema.colores.error}
        style={estilos.icono}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={estilos.mensaje} accessibilityLiveRegion="polite">
        {mensaje}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", gap: tema.espacio.minimo },
  // Centra el ícono con la primera línea del mensaje.
  icono: { marginTop: (tema.alturaLinea.aviso - tema.tamano.iconoChico) / 2 },
  mensaje: { ...tema.tipografia.mensaje, flex: 1, color: tema.colores.error },
});
