import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

type NombreIcono = keyof typeof Ionicons.glyphMap;

/**
 * Ícono de pestaña. React Native 0.88 admite colores numéricos y `null`, pero los tipos de
 * `@expo/vector-icons` no: la barra de pestañas siempre pasa un string.
 */
function icono(nombre: NombreIcono) {
  function IconoDePestana({ color, size }: { color: ColorValue; size: number }) {
    return (
      <Ionicons
        name={nombre}
        color={typeof color === "number" ? undefined : (color ?? undefined)}
        size={size}
      />
    );
  }
  return IconoDePestana;
}

/** Navegación principal (FR-017). */
export default function LayoutPestanas() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{ title: "Explorar", tabBarLabel: "Explorar", tabBarIcon: icono("compass-outline") }}
      />
    </Tabs>
  );
}
