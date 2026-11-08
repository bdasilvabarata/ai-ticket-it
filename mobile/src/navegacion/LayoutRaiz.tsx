import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useEffect } from "react";

import { DependenciasProvider, type Dependencias } from "../composicion";
import { conectarFocoDeLaApp } from "../consultas/query-client";
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

/** Guard por fase de la sesión: Expo Router muestra solo las rutas permitidas (R3, FR-011). */
function Navegacion() {
  const { estado } = useSesion();
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
