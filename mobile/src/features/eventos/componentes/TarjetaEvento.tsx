import type { EventoCatalogoVista } from "@ai-ticket-it/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { hundido, tema } from "../../../componentes";
import { nombreCompleto } from "../../usuarios";
import { textoFechaHora, textoPrecioDesde, textoPuntaje } from "../formato";

export interface PropsTarjetaEvento {
  evento: EventoCatalogoVista;
  alPresionar?: () => void;
}

const enMinuscula = (texto: string) => texto.charAt(0).toLowerCase() + texto.slice(1);

/** Una tarjeta de Explorar (contracts/app.md, "TarjetaEvento"): lleva al detalle público. */
export function TarjetaEvento({ evento, alPresionar }: PropsTarjetaEvento) {
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
  ].join(", ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={alPresionar}
      style={({ pressed }) => [estilos.tarjeta, pressed ? hundido : estilos.sombra]}
    >
      <View style={estilos.textos}>
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
