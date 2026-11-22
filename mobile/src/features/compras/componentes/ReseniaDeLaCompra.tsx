import type { CompraVista } from "@ai-ticket-it/shared";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Boton, tema } from "../../../componentes";
import { ReseniaPropia } from "./ReseniaPropia";

type CompraConResenia = Pick<CompraVista, "id" | "resenia" | "puedeReseniar">;

/** A "Reseñar evento" de esa compra (feature 012). */
const irAReseniar = (compraId: string) =>
  router.push({ pathname: "/compras/[compraId]/resenia", params: { compraId } });

/** "Reseñar evento", solo si el servidor dice `puedeReseniar`. En una fila va como hermano de los datos. */
export function BotonReseniar({ compra }: { compra: CompraConResenia }) {
  if (!compra.puedeReseniar) return null;
  return (
    <View style={estilos.acciones}>
      <Boton variante="aviso" texto="Reseñar evento" alPresionar={() => irAReseniar(compra.id)} />
    </View>
  );
}

/** "Tu reseña" con la puntuación y el comentario, si el servidor la trae (solo en una UTILIZADA). */
export function TuResenia({ compra }: { compra: CompraConResenia }) {
  if (!compra.resenia) return null;
  return (
    <View style={estilos.resenia}>
      <Text style={estilos.titulo} accessibilityRole="header">
        Tu reseña
      </Text>
      <ReseniaPropia resenia={compra.resenia} />
    </View>
  );
}

/**
 * La reseña en "Tu compra" (feature 012, contracts/app.md): "Reseñar evento" con `puedeReseniar`, "Tu
 * reseña" con `resenia` o nada; lo decide el servidor.
 */
export function ReseniaDeLaCompra({ compra }: { compra: CompraConResenia }) {
  return (
    <>
      <BotonReseniar compra={compra} />
      <TuResenia compra={compra} />
    </>
  );
}

const estilos = StyleSheet.create({
  acciones: { alignItems: "flex-start" },
  resenia: { gap: tema.espacio.chico },
  titulo: { ...tema.tipografia.subtitulo, color: tema.colores.texto },
});
