import { HeaderHeightContext } from "expo-router/react-navigation";
import { useContext, useRef, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type ScrollViewInstance,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tema } from "./tema";

export interface PropsPantallaDesplazable {
  children: ReactNode;
  /** Separación entre los bloques de la pantalla (por defecto, `tema.espacio.amplio`). */
  separacion?: number;
  /**
   * Abre mostrando el final del contenido (feature 011, el chat): cada vez que cambia el tamaño del
   * contenido, desplaza hasta el final sin animación. Sin la prop, la pantalla abre arriba.
   */
  empezarAlFinal?: boolean;
}

/**
 * Pantalla con desplazamiento para formularios y detalles apilados (con header). Resuelve dos
 * cosas que el `ScrollView` solo no hace con la pantalla de borde a borde de Android:
 * - el contenido termina por encima de la barra de navegación del sistema (atrás, inicio), con el
 *   inset inferior como margen;
 * - al abrir el teclado, la pantalla se achica para que el campo enfocado quede a la vista
 *   (Android: `KeyboardAvoidingView` con `padding`, descontando el header; iOS: el `ScrollView`
 *   ajusta sus insets y desplaza hasta el campo).
 */
export function PantallaDesplazable({
  children,
  separacion = tema.espacio.amplio,
  empezarAlFinal = false,
}: PropsPantallaDesplazable) {
  const { bottom } = useSafeAreaInsets();
  // Fuera de un navegador (tests de componentes) no hay header: 0.
  const altoDelHeader = useContext(HeaderHeightContext) ?? 0;
  const esIos = Platform.OS === "ios";
  const scroll = useRef<ScrollViewInstance>(null);
  const alCambiarElContenido = empezarAlFinal
    ? () => scroll.current?.scrollToEnd({ animated: false })
    : undefined;

  return (
    <KeyboardAvoidingView
      style={estilos.pantalla}
      behavior={esIos ? undefined : "padding"}
      keyboardVerticalOffset={altoDelHeader}
    >
      <ScrollView
        ref={scroll}
        style={estilos.pantalla}
        contentContainerStyle={[
          estilos.contenido,
          { gap: separacion, paddingBottom: tema.espacio.normal + bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={esIos}
        onContentSizeChange={alCambiarElContenido}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.colores.fondo },
  contenido: { padding: tema.espacio.normal },
});
