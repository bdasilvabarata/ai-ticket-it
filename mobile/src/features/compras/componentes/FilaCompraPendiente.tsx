import type { CompraVista } from "@ai-ticket-it/shared";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Boton, EtiquetaEstadoCompra, tema } from "../../../componentes";
import { textoCantidad, textoTotal, textoVencimiento } from "../formato";

export interface PropsFilaCompraPendiente {
  compra: CompraVista;
}

/**
 * Una compra de "Tus compras pendientes": qué es, hasta cuándo se puede pagar, su estado y "Pagar",
 * que abre "Tu compra". También con el evento empezado: se paga hasta que vence (R9).
 */
export function FilaCompraPendiente({ compra }: PropsFilaCompraPendiente) {
  const cantidad = textoCantidad(compra.cantidad);
  return (
    <View style={estilos.fila}>
      <View style={estilos.textos}>
        <Text style={estilos.resumen}>
          {`${compra.tipoEntrada.nombre} · ${cantidad} · ${textoTotal(compra.total)}`}
        </Text>
        {compra.venceEnLocal ? (
          <Text style={estilos.dato}>{textoVencimiento(compra.venceEnLocal)}</Text>
        ) : null}
        <EtiquetaEstadoCompra estado={compra.estado} />
      </View>
      <Boton
        texto="Pagar"
        accessibilityLabel={`Pagar la compra de ${cantidad} ${compra.tipoEntrada.nombre}`}
        alPresionar={() => router.push({ pathname: "/compras/[compraId]", params: { compraId: compra.id } })}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tema.espacio.chico,
    padding: tema.espacio.medio,
    borderRadius: tema.radio.tarjeta,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.superficie,
    boxShadow: tema.sombra.nivel1,
  },
  textos: { flexShrink: 1, gap: tema.espacio.minimo },
  resumen: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.texto },
  dato: { ...tema.tipografia.secundario, color: tema.colores.textoSecundario },
});
