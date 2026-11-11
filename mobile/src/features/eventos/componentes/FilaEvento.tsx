import type { EventoResumenVista } from "@ai-ticket-it/shared";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { hundido, tema } from "../../../componentes";
import { textoCantidadTipos, textoFechaHora } from "../formato";
import { MarcaRealizado } from "./MarcaRealizado";

export interface PropsFilaEvento {
  evento: EventoResumenVista;
}

/** Una fila de Mis eventos (contracts/app.md, "Mis eventos"): lleva al evento, para editarlo o verlo. */
export function FilaEvento({ evento }: PropsFilaEvento) {
  const fechaHora = textoFechaHora(evento.fechaHoraLocal);
  const etiqueta = evento.realizado
    ? `Ver ${evento.nombre}, realizado, ${fechaHora}`
    : `Editar ${evento.nombre}, ${fechaHora}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={() => router.push({ pathname: "/eventos/[eventoId]", params: { eventoId: evento.id } })}
      style={({ pressed }) => [estilos.tarjeta, pressed ? hundido : estilos.sombra]}
    >
      <View style={estilos.textos}>
        <Text style={estilos.nombre}>{evento.nombre}</Text>
        <Text style={estilos.detalle}>{`${fechaHora} · ${evento.categoria.nombre}`}</Text>
        <Text style={estilos.detalle}>{textoCantidadTipos(evento.cantidadTiposEntrada)}</Text>
        {evento.realizado ? <MarcaRealizado /> : null}
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    padding: tema.espacio.normal,
    borderRadius: tema.radio.tarjeta,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.superficie,
  },
  sombra: { boxShadow: tema.sombra.nivel1 },
  textos: { gap: tema.espacio.minimo },
  nombre: { ...tema.tipografia.tituloTarjeta, color: tema.colores.texto },
  detalle: { ...tema.tipografia.secundario, color: tema.colores.textoSecundario },
});
