import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text } from "react-native";

import { tema } from "../../../componentes";
import { useCategorias } from "../../categorias";

export interface PropsBotonCategoria {
  /** `null` = "Todas". */
  categoriaId: string | null;
  abierto: boolean;
  alPresionar: () => void;
}

/**
 * El botón del filtro de categoría de Explorar, a la derecha del buscador: abre y cierra el
 * desplegable. Con "Todas" es solo el ícono; con una categoría elegida se rellena y dice cuál.
 */
export function BotonCategoria({ categoriaId, abierto, alPresionar }: PropsBotonCategoria) {
  const { data: categorias } = useCategorias();
  const nombre =
    categoriaId === null ? null : (categorias?.find((c) => c.id === categoriaId)?.nombre ?? null);
  const activo = categoriaId !== null;
  const color = activo ? tema.colores.sobrePrimario : tema.colores.texto;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Categoría: ${nombre ?? "Todas"}`}
      accessibilityState={{ expanded: abierto }}
      onPress={alPresionar}
      style={({ pressed }) => [estilos.boton, pressed && estilos.presionado, activo && estilos.activo]}
    >
      <Ionicons
        name={activo ? "funnel" : "funnel-outline"}
        size={tema.tamano.icono}
        color={color}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      {nombre !== null && (
        <Text numberOfLines={1} style={[estilos.texto, { color }]}>
          {nombre}
        </Text>
      )}
      <Ionicons
        name={abierto ? "chevron-up" : "chevron-down"}
        size={tema.tamano.iconoChico}
        color={color}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  boton: {
    minHeight: tema.tamano.campo,
    maxWidth: tema.anchoMaximoFiltro,
    flexDirection: "row",
    alignItems: "center",
    gap: tema.espacio.minimo,
    paddingHorizontal: tema.espacio.medio,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    borderRadius: tema.radio.normal,
    backgroundColor: tema.colores.superficie,
  },
  activo: { backgroundColor: tema.colores.primario },
  presionado: { backgroundColor: tema.colores.neutro },
  texto: { ...tema.tipografia.botonChico, flexShrink: 1 },
});
