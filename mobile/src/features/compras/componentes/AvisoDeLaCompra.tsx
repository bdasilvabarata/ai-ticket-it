import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Boton, Ilustracion, tema, type PropsIlustracion } from "../../../componentes";

/**
 * Lo que ocupa la pantalla en lugar de una compra que no se puede mostrar (un 403 o un 404 al
 * leerla): la ilustración, el mensaje anunciado y, opcionalmente, una acción. Lo comparten "Tu
 * compra" y "Chat de la compra".
 */
export function AvisoDeLaCompra({
  icono,
  mensaje,
  children,
}: {
  icono: PropsIlustracion["icono"];
  mensaje: string;
  children?: ReactNode;
}) {
  return (
    <View style={estilos.aviso}>
      <Ilustracion icono={icono} />
      <Text style={estilos.texto} accessibilityLiveRegion="polite">
        {mensaje}
      </Text>
      {children}
    </View>
  );
}

const irAExplorar = () => router.dismissTo("/");

/** El 404 de una compra: "No encontramos esta compra." con "Ir a Explorar". */
export function CompraNoEncontrada() {
  return (
    <AvisoDeLaCompra icono="search-outline" mensaje="No encontramos esta compra.">
      <Boton texto="Ir a Explorar" alPresionar={irAExplorar} />
    </AvisoDeLaCompra>
  );
}

const estilos = StyleSheet.create({
  aviso: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: tema.espacio.normal,
    padding: tema.espacio.amplio,
    backgroundColor: tema.colores.fondo,
  },
  texto: { ...tema.tipografia.mensaje, color: tema.colores.texto, textAlign: "center" },
});
