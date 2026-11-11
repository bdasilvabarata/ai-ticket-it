import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { PlatformPressable } from "expo-router/react-navigation";
import type { BottomTabBarButtonProps } from "expo-router/tabs";
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

/**
 * Botón de cada pestaña. El de React Navigation usa en Android un ripple `borderless`, que se
 * dibuja como un círculo más alto que la barra; acá el ripple queda recortado al botón.
 */
function BotonDePestana(props: BottomTabBarButtonProps) {
  return <PlatformPressable {...props} android_ripple={{ borderless: false }} />;
}

/** Navegación principal (FR-017). */
export function LayoutPestanas() {
  return (
    <Tabs screenOptions={{ tabBarButton: BotonDePestana }}>
      <Tabs.Screen
        name="index"
        options={{ title: "Explorar", tabBarLabel: "Explorar", tabBarIcon: icono("compass-outline") }}
      />
      <Tabs.Screen
        name="mis-compras"
        options={{ title: "Mis compras", tabBarLabel: "Mis compras", tabBarIcon: icono("ticket-outline") }}
      />
      <Tabs.Screen
        name="mis-eventos"
        options={{ title: "Mis eventos", tabBarLabel: "Mis eventos", tabBarIcon: icono("calendar-outline") }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: "Perfil", tabBarLabel: "Perfil", tabBarIcon: icono("person-circle-outline") }}
      />
    </Tabs>
  );
}
