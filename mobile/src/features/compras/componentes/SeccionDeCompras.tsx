import type { EventoVista } from "@ai-ticket-it/shared";
import { StyleSheet, Text, View } from "react-native";

import { tema } from "../../../componentes";
import { ComprasPendientes } from "./ComprasPendientes";

export interface PropsSeccionDeCompras {
  usuarioId: string;
  evento: EventoVista;
}

/**
 * Lo que el detalle muestra del usuario antes de "Tipos de entrada" (contracts/app.md, "Sección
 * propia"): si organiza el evento, que no compra en él; si no, sus compras pendientes de pago.
 */
export function SeccionDeCompras({ usuarioId, evento }: PropsSeccionDeCompras) {
  if (evento.organizador.id === usuarioId) {
    return (
      <View style={estilos.organizador}>
        <Text style={estilos.textoOrganizador}>Sos el organizador de este evento</Text>
      </View>
    );
  }
  return <ComprasPendientes usuarioId={usuarioId} eventoId={evento.id} />;
}

const estilos = StyleSheet.create({
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
