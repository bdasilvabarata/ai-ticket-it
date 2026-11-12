import type { CompraVista } from "@ai-ticket-it/shared";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Boton, EtiquetaEstadoCompra, tema } from "../../../componentes";
import { textoCantidad, textoTotal } from "../formato";

export interface PropsFilaCompraConfirmada {
  compra: CompraVista;
}

/** Una compra confirmada de "Mis entradas": qué es, su estado y "Ver", que abre "Tu compra". */
export function FilaCompraConfirmada({ compra }: PropsFilaCompraConfirmada) {
  const cantidad = textoCantidad(compra.cantidad);
  return (
    <View style={estilos.fila}>
      <View style={estilos.textos}>
        <Text style={estilos.resumen}>
          {`${compra.tipoEntrada.nombre} · ${cantidad} · ${textoTotal(compra.total)}`}
        </Text>
        <EtiquetaEstadoCompra estado={compra.estado} />
      </View>
      <Boton
        variante="aviso"
        texto="Ver"
        accessibilityLabel={`Ver la compra de ${cantidad} ${compra.tipoEntrada.nombre}`}
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
});
