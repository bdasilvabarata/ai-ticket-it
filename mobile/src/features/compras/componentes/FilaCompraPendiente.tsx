import type { CompraVista } from "@ai-ticket-it/shared";
import { router } from "expo-router";
import { useRef } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { ErrorDeApi, ServidorNoDisponibleError } from "../../../api";
import { Boton, EtiquetaEstadoCompra, tema } from "../../../componentes";
import { AvisoDeFormulario } from "../../eventos";
import { textoCantidad, textoTotal, textoVencimiento } from "../formato";
import { useCancelarCompra } from "../mutaciones";

export interface PropsFilaCompraPendiente {
  usuarioId: string;
  compra: CompraVista;
}

/**
 * El aviso de una cancelación fallida. Un 409 no avisa: la compra ya venció o cambió de estado, y
 * la relectura de `mis-compras` la saca de la lista.
 */
function mensajeDelError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ServidorNoDisponibleError) return "No se pudo cancelar. Probá de nuevo.";
  if (error instanceof ErrorDeApi) return error.status === 409 ? null : error.mensaje;
  return "Ocurrió un error inesperado.";
}

/**
 * Una compra de "Tus compras pendientes": qué es, hasta cuándo se puede pagar, su estado, "Pagar",
 * que abre "Tu compra" (también con el evento empezado: se paga hasta que vence, R9), y "Cancelar",
 * que, tras confirmarlo, la cancela sin esperar a que venza y devuelve sus entradas al cupo.
 */
export function FilaCompraPendiente({ usuarioId, compra }: PropsFilaCompraPendiente) {
  const cantidad = textoCantidad(compra.cantidad);
  const descripcion = `${cantidad} ${compra.tipoEntrada.nombre}`;
  const cancelar = useCancelarCompra(usuarioId, compra.id, compra.evento.id);
  // Marca sincrónica: un segundo toque antes de que se vuelva a dibujar no manda otro pedido.
  const enviando = useRef(false);
  const error = mensajeDelError(cancelar.error);

  const alCancelar = () => {
    if (enviando.current) return;
    enviando.current = true;
    cancelar.mutate(undefined, {
      onSettled: () => {
        enviando.current = false;
      },
    });
  };

  const confirmarCancelar = () =>
    Alert.alert(`¿Cancelar la compra de ${descripcion}?`, "Sus entradas vuelven a estar disponibles.", [
      { text: "Volver", style: "cancel" },
      { text: "Cancelar compra", style: "destructive", onPress: alCancelar },
    ]);

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
      <View style={estilos.acciones}>
        <Boton
          texto="Pagar"
          accessibilityLabel={`Pagar la compra de ${descripcion}`}
          deshabilitado={cancelar.isPending}
          alPresionar={() =>
            router.push({ pathname: "/compras/[compraId]", params: { compraId: compra.id } })
          }
        />
        <Boton
          variante="texto"
          texto="Cancelar"
          textoEnCurso="Cancelando…"
          accessibilityLabel={`Cancelar la compra de ${descripcion}`}
          enCurso={cancelar.isPending}
          alPresionar={confirmarCancelar}
        />
      </View>
      {error ? (
        <View style={estilos.aviso}>
          <AvisoDeFormulario mensaje={error} />
        </View>
      ) : null}
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
  acciones: { alignItems: "center", gap: tema.espacio.minimo },
  aviso: { width: "100%" },
  resumen: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.texto },
  dato: { ...tema.tipografia.secundario, color: tema.colores.textoSecundario },
});
