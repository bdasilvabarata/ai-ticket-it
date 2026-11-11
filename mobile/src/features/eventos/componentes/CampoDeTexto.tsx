import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { tema } from "../../../componentes";
import { MensajeDeCampo } from "./MensajeDeCampo";

export interface PropsCampoDeTexto {
  /** Etiqueta visible. */
  etiqueta: string;
  /** Por defecto, la misma `etiqueta`. */
  accessibilityLabel?: string;
  valor: string;
  alCambiar: (valor: string) => void;
  error?: string;
  nota?: string;
  maxLength?: number;
  multiline?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
}

/** Campo de texto con su etiqueta visible, una nota opcional y el error del servidor debajo. */
export function CampoDeTexto({
  etiqueta,
  accessibilityLabel = etiqueta,
  valor,
  alCambiar,
  error,
  nota,
  maxLength,
  multiline = false,
  keyboardType,
  autoCapitalize,
}: PropsCampoDeTexto) {
  return (
    <View style={estilos.campo}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={valor}
        onChangeText={alCambiar}
        maxLength={maxLength}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        textAlignVertical={multiline ? "top" : "center"}
        style={[estilos.entrada, error ? estilos.conError : null]}
      />
      {nota ? <Text style={estilos.nota}>{nota}</Text> : null}
      <MensajeDeCampo mensaje={error} />
    </View>
  );
}

export const estilosDeCampo = StyleSheet.create({
  etiqueta: { fontSize: tema.texto.chico, fontWeight: tema.peso.fuerte, color: tema.colores.texto },
  nota: { fontSize: tema.texto.chico, color: tema.colores.textoSecundario },
});

const estilos = StyleSheet.create({
  campo: { gap: tema.espacio.minimo, flexShrink: 1 },
  etiqueta: estilosDeCampo.etiqueta,
  nota: estilosDeCampo.nota,
  entrada: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tema.colores.textoSecundario,
    borderRadius: tema.radio.normal,
    paddingVertical: tema.espacio.chico,
    paddingHorizontal: tema.espacio.medio,
    fontSize: tema.texto.normal,
    color: tema.colores.texto,
    backgroundColor: tema.colores.fondo,
  },
  conError: { borderColor: tema.colores.peligro },
});
