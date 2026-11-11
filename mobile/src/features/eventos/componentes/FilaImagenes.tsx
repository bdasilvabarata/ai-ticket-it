import { useState } from "react";
import { Image, ScrollView, StyleSheet } from "react-native";

import { tema } from "../../../componentes";

export interface PropsFilaImagenes {
  urls: readonly string[];
  nombreDelEvento: string;
}

/**
 * Las imágenes del evento en una fila horizontal (la única parte de la app que se desliza de
 * costado). Una imagen que no carga se quita sin dejar hueco; si no queda ninguna, no hay fila.
 */
export function FilaImagenes({ urls, nombreDelEvento }: PropsFilaImagenes) {
  const [fallidas, setFallidas] = useState<readonly string[]>([]);
  const visibles = urls.filter((url) => !fallidas.includes(url));
  if (visibles.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.fila}>
      {visibles.map((url, i) => (
        <Image
          key={url}
          source={{ uri: url }}
          accessible
          accessibilityLabel={`Imagen ${i + 1} de ${visibles.length} de ${nombreDelEvento}`}
          onError={() => setFallidas((anteriores) => [...anteriores, url])}
          style={estilos.imagen}
        />
      ))}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  fila: { gap: tema.espacio.chico },
  imagen: {
    width: tema.tamano.imagenDetalle.ancho,
    height: tema.tamano.imagenDetalle.alto,
    borderRadius: tema.radio.imagen,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.neutro,
  },
});
