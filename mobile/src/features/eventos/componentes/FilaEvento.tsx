import type { EventoResumenVista } from "@ai-ticket-it/shared";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { hundido, tema } from "../../../componentes";
import { textoCantidadTipos, textoFechaHora } from "../formato";
import { MarcaFavorito } from "./MarcaFavorito";
import { MarcaRealizado } from "./MarcaRealizado";

export interface PropsFilaEvento {
  evento: EventoResumenVista;
  /** Si es un favorito del usuario actual (feature 014): la estrella indicadora. */
  esFavorito?: boolean;
}

/**
 * Una fila de Mis eventos (contracts/app.md, "Mis eventos"): lleva al hub del evento. Un favorito
 * suma la estrella indicadora y ", en favoritos" (feature 014); se marca solo desde el detalle.
 */
export function FilaEvento({ evento, esFavorito = false }: PropsFilaEvento) {
  const fechaHora = textoFechaHora(evento.fechaHoraLocal);
  const base = evento.realizado
    ? `Abrir ${evento.nombre}, realizado, ${fechaHora}`
    : `Abrir ${evento.nombre}, ${fechaHora}`;
  const etiqueta = esFavorito ? `${base}, en favoritos` : base;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={() => router.push({ pathname: "/eventos/[eventoId]", params: { eventoId: evento.id } })}
      style={({ pressed }) => [estilos.tarjeta, pressed ? hundido : estilos.sombra]}
    >
      <View style={[estilos.textos, esFavorito && estilos.lugarParaLaMarca]}>
        <Text style={estilos.nombre}>{evento.nombre}</Text>
        <Text style={estilos.detalle}>{`${fechaHora} · ${evento.categoria.nombre}`}</Text>
        <Text style={estilos.detalle}>{textoCantidadTipos(evento.cantidadTiposEntrada)}</Text>
        {evento.realizado ? <MarcaRealizado /> : null}
      </View>
      {esFavorito ? <MarcaFavorito /> : null}
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
  // La estrella va en la esquina superior derecha: el texto no pasa por debajo.
  lugarParaLaMarca: { paddingRight: tema.tamano.pastillaAncho },
  nombre: { ...tema.tipografia.tituloTarjeta, color: tema.colores.texto },
  detalle: { ...tema.tipografia.secundario, color: tema.colores.textoSecundario },
});
