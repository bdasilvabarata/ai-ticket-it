import { StyleSheet, Text, View } from "react-native";

import { Boton, tema } from "../../../componentes";
import { textoCantidad } from "../formato";

export interface PropsSelectorCantidad {
  cantidad: number;
  /** El mayor valor elegible (≥ 1): `min(cupo, restantes)`. */
  maximo: number;
  alCambiar: (cantidad: number) => void;
}

/** "−" · la cantidad · "+", de 1 a `maximo`; cada botón se deshabilita en su límite. */
export function SelectorCantidad({ cantidad, maximo, alCambiar }: PropsSelectorCantidad) {
  return (
    <View style={estilos.selector}>
      <Boton
        variante="aviso"
        texto="−"
        accessibilityLabel="Una entrada menos"
        deshabilitado={cantidad <= 1}
        alPresionar={() => alCambiar(cantidad - 1)}
      />
      <Text style={estilos.cantidad} accessibilityLiveRegion="polite">
        {textoCantidad(cantidad)}
      </Text>
      <Boton
        variante="aviso"
        texto="+"
        accessibilityLabel="Una entrada más"
        deshabilitado={cantidad >= maximo}
        alPresionar={() => alCambiar(cantidad + 1)}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  selector: { flexDirection: "row", alignItems: "center", gap: tema.espacio.normal },
  cantidad: { ...tema.tipografia.subtitulo, color: tema.colores.texto, flexShrink: 1, textAlign: "center" },
});
