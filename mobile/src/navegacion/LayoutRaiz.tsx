import { QueryClientProvider } from "@tanstack/react-query";
import { router, Stack, useSegments } from "expo-router";
import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";

import { Boton, FranjaServidorNoDisponible, tema } from "../componentes";
import type { Dependencias } from "../composicion";
import { useConexion } from "../conexion";
import { conectarFocoDeLaApp } from "../consultas/query-client";
import { SesionProvider, useSesion, type EstadoSesion } from "../features/sesion";
import { opcionesDeEncabezado } from "./encabezado";

/**
 * Layout raíz de la app (R3). Vive fuera de `app/` para que los tests lo rendericen con
 * dependencias falsas. `ExpoRoot` ya monta el `SafeAreaProvider`.
 */
export function LayoutRaiz({ dependencias }: { dependencias: Dependencias }) {
  useEffect(() => conectarFocoDeLaApp(), []);

  return (
    <QueryClientProvider client={dependencias.queryClient}>
      <SesionProvider dependencias={dependencias}>
        <Navegacion />
      </SesionProvider>
    </QueryClientProvider>
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
  const conUsuario = estado.fase === "con-usuario";
  return (
    <Stack screenOptions={{ ...opcionesDeEncabezado, contentStyle: estilos.contenido }}>
      <Stack.Protected guard={estado.fase === "iniciando"}>
        <Stack.Screen name="cargando" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={conUsuario}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* Formularios y pantallas apiladas de la feature 004 (contracts/app.md, "Rutas"). */}
        <Stack.Screen name="eventos/nuevo" options={{ title: "Crear evento" }} />
        {/* El título inicial; EventoDelOrganizador lo cambia a "Editar evento" o "Evento realizado". */}
        <Stack.Screen name="eventos/[eventoId]/index" options={{ title: "Evento" }} />
        <Stack.Screen
          name="eventos/[eventoId]/tipos-entrada/nuevo"
          options={{ title: "Agregar tipo de entrada" }}
        />
        <Stack.Screen
          name="eventos/[eventoId]/tipos-entrada/[tipoEntradaId]"
          options={{ title: "Editar tipo de entrada" }}
        />
        {/* Las compras de un evento propio, para su organizador (feature 008). */}
        <Stack.Screen name="eventos/[eventoId]/compras" options={{ title: "Compras del evento" }} />
        {/* El detalle público desde Explorar (feature 005), también para un evento propio. */}
        <Stack.Screen name="explorar/[eventoId]/index" options={{ title: "Evento" }} />
        <Stack.Screen
          name="explorar/[eventoId]/comprar/[tipoEntradaId]"
          options={{ title: "Comprar entradas" }}
        />
        <Stack.Screen name="explorar/[eventoId]/mis-entradas" options={{ title: "Mis entradas" }} />
        <Stack.Screen name="compras/[compraId]" options={{ title: "Tu compra" }} />
      </Stack.Protected>
      {/* Expo Router no admite declarar dos veces la misma pantalla: el selector va una sola vez.
          Sin usuario es la única ruta disponible, a pantalla completa. Con usuario, (tabs) está
          antes y el selector se abre desde Perfil como modal con "Cerrar" (FR-015). Si un 401
          olvida al usuario con el modal abierto, (tabs) sale y el selector queda a pantalla
          completa, sin "Cerrar" (CHK020). */}
      <Stack.Protected guard={estado.fase !== "iniciando"}>
        <Stack.Screen
          name="seleccionar-usuario"
          options={
            conUsuario
              ? {
                  presentation: "modal",
                  headerShown: true,
                  title: "Cambiar usuario",
                  headerRight: BotonCerrar,
                }
              : { headerShown: false, gestureEnabled: false }
          }
        />
      </Stack.Protected>
    </Stack>
  );
}

function BotonCerrar() {
  return (
    <Boton
      variante="texto"
      texto="Cerrar"
      accessibilityLabel="Cerrar sin cambiar de usuario"
      hitSlop={8}
      alPresionar={() => router.back()}
    />
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: tema.colores.fondo },
  contenido: { backgroundColor: tema.colores.fondo },
});
