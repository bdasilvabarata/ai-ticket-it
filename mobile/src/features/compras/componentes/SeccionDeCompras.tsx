import type { EventoVista } from "@ai-ticket-it/shared";
import { StyleSheet, Text, View } from "react-native";

import { tema } from "../../../componentes";
import { AccesoMisEntradas } from "./AccesoMisEntradas";
import { ComprasPendientes } from "./ComprasPendientes";

export interface PropsSeccionDeCompras {
  usuarioId: string;
  evento: EventoVista;
}

/**
 * Lo que el detalle muestra del usuario antes de "Tipos de entrada" (contracts/app.md, "Sección
 * propia"): si organiza el evento, que no compra en él; si no, el acceso a sus entradas confirmadas
 * y sus compras pendientes de pago.
 */
export function SeccionDeCompras({ usuarioId, evento }: PropsSeccionDeCompras) {
  if (evento.organizador.id === usuarioId) {
    return (
      <View style={estilos.organizador}>
        <Text style={estilos.textoOrganizador}>Sos el organizador de este evento</Text>
      </View>
    );
  }
  return (
    <View style={estilos.compras}>
      <AccesoMisEntradas usuarioId={usuarioId} eventoId={evento.id} />
      <ComprasPendientes usuarioId={usuarioId} eventoId={evento.id} />
    </View>
  );
}

const estilos = StyleSheet.create({
  compras: { gap: tema.espacio.normal },
  organizador: {
    alignSelf: "flex-start",
    paddingHorizontal: tema.espacio.chico,
    paddingVertical: tema.espacio.minimo,
    backgroundColor: tema.colores.resaltado,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    borderRadius: tema.radio.normal,
  },
  textoOrganizador: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.texto },
});
