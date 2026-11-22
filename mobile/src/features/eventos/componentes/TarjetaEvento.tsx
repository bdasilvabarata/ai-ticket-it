import type { EventoCatalogoVista } from "@ai-ticket-it/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { hundido, tema } from "../../../componentes";
import { nombreCompleto } from "../../usuarios";
import { textoFechaHora, textoPrecioDesde, textoPuntaje } from "../formato";
import { MarcaFavorito } from "./MarcaFavorito";
import { MarcaRealizado } from "./MarcaRealizado";

export interface PropsTarjetaEvento {
  evento: EventoCatalogoVista;
  alPresionar?: () => void;
  /** Si es un favorito del usuario actual (feature 014): la estrella indicadora. */
  esFavorito?: boolean;
}

const enMinuscula = (texto: string) => texto.charAt(0).toLowerCase() + texto.slice(1);

/**
 * Una tarjeta de Explorar y de "Mis favoritos" (contracts/app.md, "TarjetaEvento"): lleva al detalle
 * público. Un favorito suma la estrella indicadora y ", en favoritos"; uno realizado (solo en "Mis
 * favoritos": el catálogo no los trae), "Realizado".
 */
export function TarjetaEvento({ evento, alPresionar, esFavorito = false }: PropsTarjetaEvento) {
  const fechaHora = textoFechaHora(evento.fechaHoraLocal);
  const precio = textoPrecioDesde(evento.precioDesde);
  const organizador = nombreCompleto(evento.organizador);
  const puntaje = textoPuntaje(evento.organizador);
  const etiqueta = [
    evento.nombre,
    evento.categoria.nombre,
    fechaHora,
    enMinuscula(precio),
    `organiza ${organizador}`,
    enMinuscula(puntaje),
    ...(evento.agotado ? ["agotado"] : []),
    ...(evento.realizado ? ["realizado"] : []),
    ...(esFavorito ? ["en favoritos"] : []),
  ].join(", ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={alPresionar}
      style={({ pressed }) => [estilos.tarjeta, pressed ? hundido : estilos.sombra]}
    >
      <View style={[estilos.textos, esFavorito && estilos.lugarParaLaMarca]}>
        <Text style={estilos.nombre}>{evento.nombre}</Text>
        <Text style={estilos.detalle}>{`${evento.categoria.nombre} · ${fechaHora}`}</Text>
        <View style={estilos.fila}>
          <Text style={estilos.precio}>{precio}</Text>
          {evento.agotado ? (
            <View style={estilos.badge}>
              <Text style={estilos.textoBadge}>Agotado</Text>
            </View>
          ) : null}
        </View>
        <Text style={estilos.detalle}>{`Organiza ${organizador} · ${puntaje}`}</Text>
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
  fila: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: tema.espacio.chico },
  precio: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.texto },
  // Como `MarcaRealizado`: la etiqueta escrita, no solo el color.
  badge: {
    justifyContent: "center",
    height: tema.tamano.badge,
    paddingHorizontal: tema.espacio.chico,
    borderRadius: tema.radio.pildora,
    borderWidth: tema.grosor.fino,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.neutro,
  },
  textoBadge: { ...tema.tipografia.badge, color: tema.colores.sobreNeutro },
});
