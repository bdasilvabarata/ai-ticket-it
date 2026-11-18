import type { CompraVista } from "@ai-ticket-it/shared";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Boton, EtiquetaEstadoCompra, tema } from "../../../componentes";
import { textoCantidad, textoEntradasUsadas, textoTotal } from "../formato";
import { ListaDeEntradas } from "./ListaDeEntradas";

export interface PropsFilaCompraConfirmada {
  compra: CompraVista;
}

/**
 * Una compra confirmada o utilizada de "Mis entradas": qué es, su estado, cuántas entradas se usaron,
 * "Ver" (abre "Tu compra") y, debajo, sus entradas con código (feature 008).
 */
export function FilaCompraConfirmada({ compra }: PropsFilaCompraConfirmada) {
  const cantidad = textoCantidad(compra.cantidad);
  return (
    <View style={estilos.tarjeta}>
      <View style={estilos.fila}>
        <View style={estilos.textos}>
          <Text style={estilos.resumen}>
            {`${compra.tipoEntrada.nombre} · ${cantidad} · ${textoTotal(compra.total)}`}
          </Text>
          <EtiquetaEstadoCompra estado={compra.estado} />
          {compra.entradasUsadas > 0 ? (
            <Text style={estilos.usadas}>{textoEntradasUsadas(compra.entradasUsadas, compra.cantidad)}</Text>
          ) : null}
        </View>
        <Boton
          variante="aviso"
          texto="Ver"
          accessibilityLabel={`Ver la compra de ${cantidad} ${compra.tipoEntrada.nombre}`}
          alPresionar={() =>
            router.push({ pathname: "/compras/[compraId]", params: { compraId: compra.id } })
          }
        />
      </View>
      <ListaDeEntradas entradas={compra.entradas} />
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    gap: tema.espacio.medio,
    padding: tema.espacio.medio,
    borderRadius: tema.radio.tarjeta,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.superficie,
    boxShadow: tema.sombra.nivel1,
  },
  fila: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tema.espacio.chico,
  },
  textos: { flexShrink: 1, gap: tema.espacio.minimo },
  resumen: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.texto },
  usadas: { ...tema.tipografia.secundario, color: tema.colores.texto },
});
