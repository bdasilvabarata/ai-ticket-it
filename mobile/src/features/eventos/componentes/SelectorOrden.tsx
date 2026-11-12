import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ORDENES_CATALOGO,
  SENTIDO_INICIAL,
  type OrdenCatalogo,
  type SentidoCatalogo,
} from "@ai-ticket-it/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { tema } from "../../../componentes";
import { textoSentido } from "../formato";
import { estilosDeCampo } from "./CampoDeTexto";

export interface PropsSelectorOrden {
  orden: OrdenCatalogo;
  sentido: SentidoCatalogo;
  alCambiar: (orden: OrdenCatalogo, sentido: SentidoCatalogo) => void;
}

const NOMBRES: Record<OrdenCatalogo, string> = { fecha: "Fecha", precio: "Precio", puntaje: "Puntaje" };

/**
 * El orden del catálogo en una fila de chips. Tocar otro criterio lo elige en su sentido inicial
 * (`SENTIDO_INICIAL`); tocar el elegido invierte el sentido. El elegido lleva una flecha (↑
 * ascendente, ↓ descendente) y anuncia qué queda primero ("Más caros primero").
 */
export function SelectorOrden({ orden: elegido, sentido, alCambiar }: PropsSelectorOrden) {
  const tocar = (orden: OrdenCatalogo) => {
    if (orden !== elegido) alCambiar(orden, SENTIDO_INICIAL[orden]);
    else alCambiar(orden, sentido === "asc" ? "desc" : "asc");
  };
  return (
    <View style={estilos.contenedor}>
      <Text style={estilosDeCampo.etiqueta}>Ordenar por</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Ordenar por" style={estilos.opciones}>
        {ORDENES_CATALOGO.map((orden) => {
          const esElegido = orden === elegido;
          return (
            <Pressable
              key={orden}
              accessibilityRole="radio"
              accessibilityLabel={NOMBRES[orden]}
              accessibilityState={{ checked: esElegido }}
              accessibilityValue={esElegido ? { text: textoSentido(orden, sentido) } : undefined}
              accessibilityHint={esElegido ? "Tocá de nuevo para invertir el orden" : undefined}
              onPress={() => tocar(orden)}
              style={({ pressed }) => [
                estilos.opcion,
                pressed && estilos.presionada,
                esElegido && estilos.elegida,
              ]}
            >
              <Text style={[estilos.texto, esElegido && estilos.textoElegido]}>{NOMBRES[orden]}</Text>
              {esElegido && (
                <Ionicons
                  name={sentido === "asc" ? "arrow-up" : "arrow-down"}
                  size={tema.tamano.iconoChico}
                  color={tema.colores.sobrePrimario}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: tema.espacio.chico },
  opciones: { flexDirection: "row", flexWrap: "wrap", gap: tema.espacio.chico },
  opcion: {
    minHeight: tema.tamano.chip,
    flexDirection: "row",
    alignItems: "center",
    gap: tema.espacio.minimo,
    paddingHorizontal: tema.espacio.medio,
    borderRadius: tema.radio.pildora,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.superficie,
  },
  elegida: { backgroundColor: tema.colores.primario },
  presionada: { backgroundColor: tema.colores.neutro },
  texto: { ...tema.tipografia.botonChico, color: tema.colores.texto },
  textoElegido: { color: tema.colores.sobrePrimario },
});
