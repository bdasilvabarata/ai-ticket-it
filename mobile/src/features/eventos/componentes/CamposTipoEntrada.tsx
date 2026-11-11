import { LIMITES_TIPO_ENTRADA } from "@ai-ticket-it/shared";
import { StyleSheet, View } from "react-native";

import { tema } from "../../../componentes";
import type { ValoresTipoEntrada } from "../formulario";
import { CampoDeTexto } from "./CampoDeTexto";

export interface PropsCamposTipoEntrada {
  valores: ValoresTipoEntrada;
  alCambiar: (cambios: Partial<ValoresTipoEntrada>) => void;
  errores: Partial<Record<keyof ValoresTipoEntrada, string>>;
  /** En el formulario de creación, el número de la tarjeta: las etiquetas lo llevan ("Precio del tipo 2"). */
  numero?: number;
  /** Al editar, "Cupo disponible" (FR-014). */
  etiquetaCupo?: string;
}

/** Nombre, descripción, precio y cupo de un tipo de entrada. */
export function CamposTipoEntrada({
  valores,
  alCambiar,
  errores,
  numero,
  etiquetaCupo = "Cupo",
}: PropsCamposTipoEntrada) {
  const etiqueta = (base: string) => (numero === undefined ? base : `${base} del tipo ${numero}`);
  return (
    <View style={estilos.campos}>
      <CampoDeTexto
        etiqueta="Nombre"
        accessibilityLabel={etiqueta("Nombre")}
        valor={valores.nombre}
        alCambiar={(nombre) => alCambiar({ nombre })}
        maxLength={LIMITES_TIPO_ENTRADA.nombre}
        error={errores.nombre}
      />
      <CampoDeTexto
        etiqueta="Descripción (opcional)"
        accessibilityLabel={etiqueta("Descripción")}
        valor={valores.descripcion}
        alCambiar={(descripcion) => alCambiar({ descripcion })}
        maxLength={LIMITES_TIPO_ENTRADA.descripcion}
        multiline
        error={errores.descripcion}
      />
      <View style={estilos.numeros}>
        <View style={estilos.numero}>
          <CampoDeTexto
            etiqueta="Precio"
            accessibilityLabel={etiqueta("Precio")}
            valor={valores.precio}
            alCambiar={(precio) => alCambiar({ precio })}
            keyboardType="number-pad"
            nota="0 = gratis"
            error={errores.precio}
          />
        </View>
        <View style={estilos.numero}>
          <CampoDeTexto
            etiqueta={etiquetaCupo}
            accessibilityLabel={etiqueta(etiquetaCupo)}
            valor={valores.cupo}
            alCambiar={(cupo) => alCambiar({ cupo })}
            keyboardType="number-pad"
            error={errores.cupo}
          />
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  campos: { gap: tema.espacio.medio },
  numeros: { flexDirection: "row", flexWrap: "wrap", gap: tema.espacio.medio },
  numero: { flexGrow: 1, flexBasis: 0, minWidth: "40%" },
});
