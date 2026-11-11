import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { PlatformPressable } from "expo-router/react-navigation";
import type { BottomTabBarButtonProps } from "expo-router/tabs";
import { StyleSheet, View } from "react-native";

import { tema } from "../componentes";
import { opcionesDeEncabezado } from "./encabezado";

type NombreIcono = keyof typeof Ionicons.glyphMap;

/**
 * Ícono de pestaña: el contorno si está inactiva y el relleno, dentro de la pastilla resaltada,
 * si está activa. El color sale del tema (la barra lo pasa, pero el activo va sobre la pastilla).
 */
function icono(inactivo: NombreIcono, activo: NombreIcono) {
  function IconoDePestana({ focused }: { focused: boolean }) {
    return (
      <View style={[estilos.pastilla, focused && estilos.pastillaActiva]}>
        <Ionicons
          name={focused ? activo : inactivo}
          color={focused ? tema.colores.texto : tema.colores.textoSecundario}
          size={tema.tamano.icono}
        />
      </View>
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
    <Tabs
      screenOptions={{
        ...opcionesDeEncabezado,
        tabBarButton: BotonDePestana,
        tabBarActiveTintColor: tema.colores.primario,
        tabBarInactiveTintColor: tema.colores.textoSecundario,
        tabBarStyle: estilos.barra,
        tabBarLabelStyle: tema.tipografia.pestana,
        sceneStyle: estilos.escena,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Explorar",
          tabBarLabel: "Explorar",
          tabBarIcon: icono("compass-outline", "compass"),
        }}
      />
      <Tabs.Screen
        name="mis-compras"
        options={{
          title: "Mis compras",
          tabBarLabel: "Mis compras",
          tabBarIcon: icono("ticket-outline", "ticket"),
        }}
      />
      <Tabs.Screen
        name="mis-eventos"
        options={{
          title: "Mis eventos",
          tabBarLabel: "Mis eventos",
          tabBarIcon: icono("calendar-outline", "calendar"),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: "Perfil", tabBarLabel: "Perfil", tabBarIcon: icono("person-outline", "person") }}
      />
    </Tabs>
  );
}

const estilos = StyleSheet.create({
  barra: {
    backgroundColor: tema.colores.superficie,
    borderTopWidth: tema.grosor.normal,
    borderTopColor: tema.colores.borde,
    elevation: 0,
    shadowOpacity: 0,
  },
  escena: { backgroundColor: tema.colores.fondo },
  pastilla: {
    width: tema.tamano.pastillaAncho,
    height: tema.tamano.pastillaAlto,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tema.radio.normal,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.superficie,
  },
  pastillaActiva: { backgroundColor: tema.colores.resaltado, borderColor: tema.colores.borde },
});
