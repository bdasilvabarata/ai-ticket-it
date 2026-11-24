import { useState, type ComponentRef, type Ref } from "react";
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
  autoCorrect?: boolean;
  /** Para darle el foco desde la pantalla (por ejemplo, después de registrar un ingreso). */
  ref?: Ref<ComponentRef<typeof TextInput>>;
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
  autoCorrect,
  ref,
}: PropsCampoDeTexto) {
  const [enfocado, setEnfocado] = useState(false);
  return (
    <View style={estilos.campo}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={accessibilityLabel}
        value={valor}
        onChangeText={alCambiar}
        maxLength={maxLength}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        textAlignVertical={multiline ? "top" : "center"}
        placeholderTextColor={tema.colores.textoSecundario}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        style={[
          estilos.entrada,
          multiline && estilos.multilinea,
          enfocado && estilos.enfocado,
          error ? estilos.conError : null,
        ]}
      />
      {nota ? <Text style={estilos.nota}>{nota}</Text> : null}
      <MensajeDeCampo mensaje={error} />
    </View>
  );
}

export const estilosDeCampo = StyleSheet.create({
  etiqueta: { ...tema.tipografia.etiqueta, color: tema.colores.texto },
  nota: { ...tema.tipografia.secundario, color: tema.colores.textoSecundario },
});

const estilos = StyleSheet.create({
  campo: { gap: tema.espacio.chico, flexShrink: 1 },
  etiqueta: estilosDeCampo.etiqueta,
  nota: estilosDeCampo.nota,
  entrada: {
    ...tema.tipografia.cuerpo,
    minHeight: tema.tamano.campo,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    borderRadius: tema.radio.normal,
    paddingVertical: tema.espacio.chico,
    paddingHorizontal: tema.espacio.medio,
    color: tema.colores.texto,
    backgroundColor: tema.colores.superficie,
  },
  multilinea: { minHeight: tema.tamano.campo * 2, paddingVertical: tema.espacio.medio },
  enfocado: { borderColor: tema.colores.primario, boxShadow: tema.sombra.nivel1 },
  conError: { borderColor: tema.colores.error },
});
