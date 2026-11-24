import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Boton, tema } from "../../../componentes";
import { textoEntradasConfirmadas } from "../formato";
import { useMisComprasDelEvento } from "../useMisComprasDelEvento";

export interface PropsAccesoMisEntradas {
  usuarioId: string;
  eventoId: string;
}

/**
 * Con alguna compra CONFIRMADA en el evento: cuántas entradas tiene y "Ver mis entradas", que abre
 * sus compras de este evento. Sin confirmadas, o mientras carga o si falló, nada.
 */
export function AccesoMisEntradas({ usuarioId, eventoId }: PropsAccesoMisEntradas) {
  const { data } = useMisComprasDelEvento(usuarioId, eventoId);
  const confirmadas = data?.confirmadas ?? [];
  if (confirmadas.length === 0) return null;
  const entradas = confirmadas.reduce((suma, compra) => suma + compra.cantidad, 0);
  return (
    <View style={estilos.tarjeta}>
      <Text style={estilos.texto}>{textoEntradasConfirmadas(entradas)}</Text>
      <Boton
        variante="aviso"
        texto="Ver mis entradas"
        alPresionar={() =>
          router.push({ pathname: "/explorar/[eventoId]/mis-entradas", params: { eventoId } })
        }
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
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
  texto: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.texto, flexShrink: 1 },
});
