import { StyleSheet, View } from "react-native";

import { tema } from "../../../componentes";

/** Relleno con la forma de una `TarjetaEvento` mientras carga el catálogo (sin animación: la 014). */
export function TarjetaSkeleton() {
  return (
    <View style={estilos.tarjeta}>
      <View style={[estilos.linea, estilos.titulo]} />
      <View style={[estilos.linea, estilos.detalle]} />
      <View style={[estilos.linea, estilos.corto]} />
      <View style={[estilos.linea, estilos.detalle]} />
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    padding: tema.espacio.normal,
    gap: tema.espacio.chico,
    borderRadius: tema.radio.tarjeta,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.superficie,
  },
  linea: {
    height: tema.tamano.lineaSkeleton,
    borderRadius: tema.radio.imagen,
    backgroundColor: tema.colores.neutro,
  },
  titulo: { height: tema.tamano.lineaSkeletonTitulo, width: tema.anchoSkeleton.titulo },
  detalle: { width: tema.anchoSkeleton.detalle },
  corto: { width: tema.anchoSkeleton.corto },
});
