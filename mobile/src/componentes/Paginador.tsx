import type { PaginaVista } from "@ai-ticket-it/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { botonesDelPaginador } from "./botones-del-paginador";
import { tema } from "./tema";

export interface PropsPaginador {
  /** La página de la **respuesta**: la actual es `pagina.numero`, no la pedida (FR-005). */
  pagina: PaginaVista;
  alCambiar: (numero: number) => void;
}

/**
 * El paginador común de la app (feature 013, FR-007 a FR-011, research R6): hasta 5 botones según
 * `botonesDelPaginador`, sin "…" ni anterior/siguiente. Con una página o ninguna no se dibuja. La
 * actual se distingue sin color (sombra dura y Archivo Black) y se anuncia "seleccionado"; tocarla
 * no hace nada, pero no está deshabilitada.
 */
export function Paginador({ pagina, alCambiar }: PropsPaginador) {
  if (pagina.totalPaginas <= 1) return null;
  return (
    <View style={estilos.fila}>
      {botonesDelPaginador(pagina.totalPaginas, pagina.numero).map((numero) => {
        const actual = numero === pagina.numero;
        return (
          <Pressable
            key={numero}
            accessibilityRole="button"
            accessibilityLabel={`Página ${numero}`}
            accessibilityState={{ selected: actual }}
            onPress={actual ? undefined : () => alCambiar(numero)}
            style={({ pressed }) => [
              estilos.boton,
              actual ? estilos.actual : estilos.otra,
              actual && estilos.sombra,
              !actual && pressed && estilos.presionada,
            ]}
          >
            <Text style={actual ? estilos.textoActual : estilos.texto}>{numero}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: "row",
    justifyContent: "center",
    gap: tema.espacio.chico,
    paddingVertical: tema.espacio.normal,
  },
  boton: {
    minWidth: tema.tamano.tactil,
    minHeight: tema.tamano.tactil,
    paddingHorizontal: tema.espacio.chico,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tema.radio.normal,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
  },
  actual: { backgroundColor: tema.colores.resaltado },
  otra: { backgroundColor: tema.colores.superficie },
  sombra: { boxShadow: tema.sombra.nivel1 },
  presionada: { backgroundColor: tema.colores.neutro },
  textoActual: { ...tema.tipografia.botonChico, fontFamily: tema.fuente.display, color: tema.colores.texto },
  texto: { ...tema.tipografia.botonChico, fontFamily: tema.fuente.regular, color: tema.colores.texto },
});
