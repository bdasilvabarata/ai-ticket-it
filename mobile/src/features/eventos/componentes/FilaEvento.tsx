import type { EventoResumenVista } from "@ai-ticket-it/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { tema } from "../../../componentes";
import { textoCantidadTipos, textoFechaHora } from "../formato";
import { MarcaRealizado } from "./MarcaRealizado";

export interface PropsFilaEvento {
  evento: EventoResumenVista;
}

/** Una fila de Mis eventos (contracts/app.md, "Mis eventos"). */
export function FilaEvento({ evento }: PropsFilaEvento) {
  const fechaHora = textoFechaHora(evento.fechaHoraLocal);
  const etiqueta = evento.realizado
    ? `Ver ${evento.nombre}, realizado, ${fechaHora}`
    : `Editar ${evento.nombre}, ${fechaHora}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      style={({ pressed }) => [estilos.fila, pressed && estilos.presionada]}
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
  fila: {
    paddingVertical: tema.espacio.fila,
    paddingHorizontal: tema.espacio.normal,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.colores.borde,
    backgroundColor: tema.colores.fondo,
  },
  presionada: { opacity: tema.opacidadApagado },
  textos: { gap: tema.espacio.minimo },
  nombre: { fontSize: tema.texto.destacado, fontWeight: tema.peso.fuerte, color: tema.colores.texto },
  detalle: { fontSize: tema.texto.chico, color: tema.colores.textoSecundario },
});
