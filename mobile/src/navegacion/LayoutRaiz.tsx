import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useSegments } from "expo-router";
import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";

import { FranjaServidorNoDisponible } from "../componentes/FranjaServidorNoDisponible";
import { DependenciasProvider, type Dependencias } from "../composicion";
import { useConexion } from "../conexion/useConexion";
import { conectarFocoDeLaApp } from "../consultas/query-client";
import type { EstadoSesion } from "../sesion/estado-sesion";
import { SesionProvider, useSesion } from "../sesion/SesionProvider";

/**
 * Layout raíz de la app (R3). Vive fuera de `app/` para que los tests lo rendericen con
 * dependencias falsas. `ExpoRoot` ya monta el `SafeAreaProvider`.
 */
export function LayoutRaiz({ dependencias }: { dependencias: Dependencias }) {
  useEffect(() => conectarFocoDeLaApp(), []);

  return (
    <DependenciasProvider dependencias={dependencias}>
      <QueryClientProvider client={dependencias.queryClient}>
        <SesionProvider>
          <Navegacion />
        </SesionProvider>
      </QueryClientProvider>
    </DependenciasProvider>
  );
}

/**
 * Guard por fase de la sesión: Expo Router muestra solo las rutas permitidas (R3, FR-011). Encima,
 * la franja de servidor no disponible en toda ruta salvo el selector, que tiene su propio estado
 * de error (R8).
 */
function Navegacion() {
  const { estado } = useSesion();
  const conexion = useConexion();
  const segmentos = useSegments();
  const insets = useSafeAreaInsets();

  const conFranja =
    estado.fase === "con-usuario" &&
    estado.servidor === "no-disponible" &&
    segmentos[0] !== "seleccionar-usuario";

  // La franja ya ocupa el inset superior: los headers de abajo no lo vuelven a sumar.
  const insetsDelStack = useMemo(() => (conFranja ? { ...insets, top: 0 } : insets), [conFranja, insets]);

  // El Provider se monta siempre, para que mostrar u ocultar la franja no remonte el Stack.
  return (
    <View style={estilos.raiz}>
      {conFranja ? (
        <FranjaServidorNoDisponible
          urlBase={conexion.urlBase}
          reintentando={conexion.enCurso}
          alReintentar={() => void conexion.reintentarAhora()}
        />
      ) : null}
      <SafeAreaInsetsContext.Provider value={insetsDelStack}>
        <Pila estado={estado} />
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

function Pila({ estado }: { estado: EstadoSesion }) {
  return (
    <Stack>
      <Stack.Protected guard={estado.fase === "iniciando"}>
        <Stack.Screen name="cargando" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={estado.fase === "sin-usuario"}>
        <Stack.Screen name="seleccionar-usuario" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={estado.fase === "con-usuario"}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
});
