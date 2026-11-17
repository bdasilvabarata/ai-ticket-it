import type { MiCompraVista } from "@ai-ticket-it/shared";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { EtiquetaEstadoCompra, hundido, tema } from "../../../componentes";
import { textoFechaHora } from "../../eventos";
import { textoAvisoDeMiCompra, textoCantidad, textoTotal } from "../formato";

export interface PropsFilaMiCompra {
  compra: MiCompraVista;
}

/**
 * Una compra de "Mis compras" (contracts/app.md, "`FilaMiCompra`"): un contenedor sin rol con los
 * datos tocables, que abren "Tu compra". La acción de pago (US3) va como **hermana** de los datos,
 * nunca adentro: un botón anidado en un `Pressable` accesible no se puede enfocar en Android (R10).
 */
export function FilaMiCompra({ compra }: PropsFilaMiCompra) {
  const tipo = compra.tipoEntrada.nombre;
  const aviso = textoAvisoDeMiCompra(compra);
  return (
    <View style={estilos.contenedor}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver la compra de ${compra.cantidad} ${tipo} para ${compra.evento.nombre}`}
        onPress={() => abrirCompra(compra.id)}
        style={({ pressed }) => [estilos.tarjeta, pressed ? hundido : estilos.sombra]}
      >
        <Text style={estilos.evento}>{compra.evento.nombre}</Text>
        <Text style={estilos.detalle}>{textoFechaHora(compra.evento.fechaHoraLocal)}</Text>
        <Text style={estilos.resumen}>
          {`${tipo} · ${textoCantidad(compra.cantidad)} · ${textoTotal(compra.total)}`}
        </Text>
        <View style={estilos.estado}>
          <EtiquetaEstadoCompra estado={compra.estado} />
          {aviso !== null && <Text style={estilos.aviso}>{aviso}</Text>}
        </View>
      </Pressable>
    </View>
  );
}

function abrirCompra(compraId: string) {
  router.push({ pathname: "/compras/[compraId]", params: { compraId } });
}

const estilos = StyleSheet.create({
  contenedor: { gap: tema.espacio.chico },
  tarjeta: {
    gap: tema.espacio.minimo,
    padding: tema.espacio.normal,
    borderRadius: tema.radio.tarjeta,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.superficie,
  },
  sombra: { boxShadow: tema.sombra.nivel1 },
  // Nombres largos se parten en varias líneas antes de recortarse (360 px, FR-020).
  evento: { ...tema.tipografia.subtitulo, color: tema.colores.texto, flexShrink: 1 },
  detalle: { ...tema.tipografia.secundario, color: tema.colores.textoSecundario, flexShrink: 1 },
  resumen: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.texto, flexShrink: 1 },
  // El aviso va al lado de la etiqueta (nunca la reemplaza, FR-012) y baja de renglón si no entra.
  estado: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: tema.espacio.chico },
  aviso: { ...tema.tipografia.secundario, color: tema.colores.texto, flexShrink: 1 },
});
