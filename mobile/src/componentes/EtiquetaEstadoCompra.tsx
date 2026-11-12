import { EstadoCompra } from "@ai-ticket-it/shared";
import { StyleSheet, Text, View } from "react-native";

import { tema } from "./tema";

/** Texto y colores de cada estado: un estado nuevo no compila sin los suyos. */
const ESTILO_DEL_ESTADO: Record<EstadoCompra, { texto: string; fondo: string; sobre: string }> = {
  [EstadoCompra.PENDIENTE]: {
    texto: "Pendiente",
    fondo: tema.colores.advertencia,
    sobre: tema.colores.sobreAdvertencia,
  },
  [EstadoCompra.CONFIRMADA]: {
    texto: "Confirmada",
    fondo: tema.colores.exito,
    sobre: tema.colores.sobreExito,
  },
  [EstadoCompra.UTILIZADA]: { texto: "Utilizada", fondo: tema.colores.exito, sobre: tema.colores.sobreExito },
  [EstadoCompra.CANCELADA]: {
    texto: "Cancelada",
    fondo: tema.colores.peligro,
    sobre: tema.colores.sobrePeligro,
  },
  [EstadoCompra.REEMBOLSADA]: {
    texto: "Reembolsada",
    fondo: tema.colores.peligro,
    sobre: tema.colores.sobrePeligro,
  },
};

/** El nombre de un estado de compra para la persona: "Pendiente", "Confirmada"… */
export function textoEtiquetaEstado(estado: EstadoCompra): string {
  return ESTILO_DEL_ESTADO[estado].texto;
}

export interface PropsEtiquetaEstadoCompra {
  estado: EstadoCompra;
}

/**
 * El estado de una compra como badge: la etiqueta escrita (no solo el color) sobre `advertencia`,
 * `exito` o `peligro`. Es el único componente de estado de compra (FR-017).
 */
export function EtiquetaEstadoCompra({ estado }: PropsEtiquetaEstadoCompra) {
  const { texto, fondo, sobre } = ESTILO_DEL_ESTADO[estado];
  return (
    <View
      style={[estilos.etiqueta, { backgroundColor: fondo }]}
      accessible
      accessibilityLabel={`Estado: ${texto}`}
    >
      <Text style={[estilos.texto, { color: sobre }]}>{texto}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  etiqueta: {
    alignSelf: "flex-start",
    justifyContent: "center",
    height: tema.tamano.badge,
    paddingHorizontal: tema.espacio.chico,
    borderRadius: tema.radio.pildora,
    borderWidth: tema.grosor.fino,
    borderColor: tema.colores.borde,
  },
  texto: { ...tema.tipografia.badge },
});
