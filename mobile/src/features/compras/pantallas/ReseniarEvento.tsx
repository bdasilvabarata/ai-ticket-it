import { LIMITES_RESENIA, type CompraVista } from "@ai-ticket-it/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ErrorDeApi } from "../../../api";
import { Boton, PantallaDesplazable, SegunConsulta, tema } from "../../../componentes";
import {
  AvisoDeFormulario,
  CampoDeTexto,
  erroresDeFormulario,
  SIN_ERRORES,
  useConfirmarDescarte,
} from "../../eventos";
import { useSesion } from "../../sesion";
import { AvisoDeLaCompra, CompraNoEncontrada } from "../componentes/AvisoDeLaCompra";
import { ReseniaPropia } from "../componentes/ReseniaPropia";
import { SelectorPuntuacion } from "../componentes/SelectorPuntuacion";
import { textoAvisoResenia } from "../formato";
import { useReseniarEvento } from "../mutaciones";
import { useCompra } from "../useCompra";
import { useEnvioUnico } from "../useEnvioUnico";

/**
 * "Reseñar evento" (feature 012, contracts/app.md): la reseña del evento de una compra UTILIZADA. Se
 * dibuja desde la compra que devuelve el servidor: el formulario solo si `puedeReseniar`; si no, el
 * motivo (ya reseñado, con la reseña, o la compra no está UTILIZADA).
 */
export function ReseniarEvento() {
  const { compraId } = useLocalSearchParams<{ compraId: string }>();
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null; // el guard ya no muestra esta ruta
  return <SegunLaCompra usuarioId={estado.usuarioId} compraId={compraId} />;
}

function SegunLaCompra({ usuarioId, compraId }: { usuarioId: string; compraId: string }) {
  const consulta = useCompra(usuarioId, compraId);
  const { error } = consulta;

  if (error instanceof ErrorDeApi && error.status === 403) {
    return <AvisoDeLaCompra icono="lock-closed-outline" mensaje="No tenés permiso para ver esta compra." />;
  }
  if (error instanceof ErrorDeApi && error.status === 404) return <CompraNoEncontrada />;
  return (
    <SegunConsulta consulta={consulta} mensajeVacio="No encontramos esta compra.">
      {(compra) => (
        <PantallaDesplazable separacion={tema.espacio.normal}>
          <Text style={estilos.titulo} accessibilityRole="header">
            {compra.evento.nombre}
          </Text>
          {compra.puedeReseniar ? (
            <Formulario usuarioId={usuarioId} compra={compra} />
          ) : (
            <SinFormulario compra={compra} />
          )}
        </PantallaDesplazable>
      )}
    </SegunConsulta>
  );
}

/** Ya la reseñó (la pantalla estaba desactualizada) o la compra no está UTILIZADA. */
function SinFormulario({ compra }: { compra: CompraVista }) {
  return (
    <View style={estilos.seccion}>
      <Text style={estilos.aviso} accessibilityLiveRegion="polite">
        {textoAvisoResenia(compra)}
      </Text>
      {compra.resenia ? <ReseniaPropia resenia={compra.resenia} /> : null}
    </View>
  );
}

/**
 * La puntuación, el comentario y "Enviar". La app no valida: manda lo elegido y lo escrito, y el
 * servidor responde un 400 por campo (junto a cada uno) o un 409 (con su mensaje). Un toque doble
 * manda un solo pedido; con éxito vuelve a la pantalla anterior sin preguntar.
 */
function Formulario({ usuarioId, compra }: { usuarioId: string; compra: CompraVista }) {
  const [puntuacion, setPuntuacion] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const reseniar = useReseniarEvento(usuarioId, compra.evento.id);
  const enviarUnaVez = useEnvioUnico();
  const { salirSinConfirmar } = useConfirmarDescarte({
    hayCambios: puntuacion !== null || comentario.trim() !== "",
  });

  const errores = reseniar.error ? erroresDeFormulario(reseniar.error, "resenia") : SIN_ERRORES;

  const alEnviar = () =>
    enviarUnaVez((terminar) =>
      reseniar.mutate(
        { puntuacion, comentario },
        { onSuccess: () => salirSinConfirmar(() => router.back()), onSettled: terminar },
      ),
    );

  return (
    <View style={estilos.seccion}>
      <SelectorPuntuacion valor={puntuacion} alElegir={setPuntuacion} error={errores.campos.puntuacion} />
      <CampoDeTexto
        etiqueta="Comentario (opcional)"
        valor={comentario}
        alCambiar={setComentario}
        error={errores.campos.comentario}
        maxLength={LIMITES_RESENIA.comentarioLargoMaximo}
        multiline
      />
      <AvisoDeFormulario mensaje={errores.mensajeGeneral} />
      <Boton texto="Enviar" textoEnCurso="Enviando…" enCurso={reseniar.isPending} alPresionar={alEnviar} />
    </View>
  );
}

const estilos = StyleSheet.create({
  titulo: { ...tema.tipografia.titulo, color: tema.colores.texto },
  seccion: { gap: tema.espacio.normal },
  aviso: { ...tema.tipografia.mensaje, color: tema.colores.texto },
});
