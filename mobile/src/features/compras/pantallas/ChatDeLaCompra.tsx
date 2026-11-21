import type { ChatDeLaCompraVista } from "@ai-ticket-it/shared";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ErrorDeApi, ServidorNoDisponibleError } from "../../../api";
import { Boton, PantallaDesplazable, SegunConsulta, tema } from "../../../componentes";
import { AvisoDeFormulario, CampoDeTexto } from "../../eventos";
import { useSesion } from "../../sesion";
import { AvisoDeLaCompra, CompraNoEncontrada } from "../componentes/AvisoDeLaCompra";
import { EncabezadoDelChat } from "../componentes/EncabezadoDelChat";
import { MensajeDelChat } from "../componentes/MensajeDelChat";
import { SIN_MENSAJES } from "../formato";
import { useEnviarMensaje } from "../mutaciones";
import { useChatDeLaCompra } from "../useChatDeLaCompra";
import { useEnvioUnico } from "../useEnvioUnico";
import { useRefrescarAlFocalizar } from "../useRefrescarAlFocalizar";

/**
 * "Chat de la compra" (feature 011, contracts/app.md): la conversación entre el comprador y el
 * organizador del evento. Una sola pantalla para las dos partes: se dibuja solo con la respuesta del
 * chat, y lo propio se distingue comparando el autor con el usuario actual.
 */
export function ChatDeLaCompra() {
  const { compraId } = useLocalSearchParams<{ compraId: string }>();
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null; // el guard ya no muestra esta ruta
  return <SegunElChat usuarioId={estado.usuarioId} compraId={compraId} />;
}

function SegunElChat({ usuarioId, compraId }: { usuarioId: string; compraId: string }) {
  const consulta = useChatDeLaCompra(usuarioId, compraId);
  // Sin sondeo: se pone al día al volver a la pantalla y cuando una escritura lo invalida (FR-019).
  useRefrescarAlFocalizar(consulta.refetch);
  const { error } = consulta;

  if (error instanceof ErrorDeApi && error.status === 403) {
    return <AvisoDeLaCompra icono="lock-closed-outline" mensaje="No tenés permiso para ver este chat." />;
  }
  if (error instanceof ErrorDeApi && error.status === 404) return <CompraNoEncontrada />;
  return (
    <SegunConsulta consulta={consulta} mensajeVacio="No encontramos esta compra.">
      {(chat) => <Conversacion usuarioId={usuarioId} chat={chat} />}
    </SegunConsulta>
  );
}

function Conversacion({ usuarioId, chat }: { usuarioId: string; chat: ChatDeLaCompraVista }) {
  return (
    <PantallaDesplazable separacion={tema.espacio.normal} empezarAlFinal>
      <EncabezadoDelChat chat={chat} />
      {chat.mensajes.length === 0 ? (
        <Text style={estilos.vacio}>{SIN_MENSAJES}</Text>
      ) : (
        <View style={estilos.mensajes}>
          {chat.mensajes.map((mensaje) => (
            <MensajeDelChat key={mensaje.numero} mensaje={mensaje} usuarioId={usuarioId} />
          ))}
        </View>
      )}
      <NuevoMensaje usuarioId={usuarioId} compraId={chat.compra.id} />
    </PantallaDesplazable>
  );
}

/**
 * El campo y "Enviar". La app no valida (sin `maxLength` y sin deshabilitar "Enviar" con el campo
 * vacío): lo decide el servidor. Un toque doble manda un solo pedido (`useEnvioUnico`); con éxito,
 * el campo se vacía y el mensaje aparece cuando vuelve el chat pedido de nuevo.
 */
function NuevoMensaje({ usuarioId, compraId }: { usuarioId: string; compraId: string }) {
  const [texto, setTexto] = useState("");
  const enviarMensaje = useEnviarMensaje(usuarioId, compraId);
  const enviarUnaVez = useEnvioUnico();

  const alEnviar = () =>
    enviarUnaVez((terminar) =>
      enviarMensaje.mutate({ texto }, { onSuccess: () => setTexto(""), onSettled: terminar }),
    );

  const errorDelTexto = errorDelCampoTexto(enviarMensaje.error);

  return (
    <View style={estilos.campo}>
      <CampoDeTexto
        etiqueta="Mensaje"
        valor={texto}
        alCambiar={setTexto}
        error={errorDelTexto ?? undefined}
        multiline
      />
      <AvisoDeFormulario mensaje={errorDelTexto ? null : mensajeDelEnvio(enviarMensaje.error)} />
      <Boton
        texto="Enviar"
        textoEnCurso="Enviando…"
        enCurso={enviarMensaje.isPending}
        alPresionar={alEnviar}
      />
    </View>
  );
}

/** Ante un 400, el detalle de `body.texto`: se muestra como error del campo (la app no valida). */
function errorDelCampoTexto(error: unknown): string | null {
  if (!(error instanceof ErrorDeApi) || error.status !== 400) return null;
  return error.detalles.find((detalle) => detalle.campo === "body.texto")?.mensaje ?? null;
}

/** El aviso de un envío fallido que no es de un campo; el texto escrito se conserva. */
function mensajeDelEnvio(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ServidorNoDisponibleError) return "No se pudo enviar. Probá de nuevo.";
  if (error instanceof ErrorDeApi) return error.mensaje;
  return "Ocurrió un error inesperado.";
}

const estilos = StyleSheet.create({
  mensajes: { gap: tema.espacio.medio },
  vacio: { ...tema.tipografia.cuerpo, color: tema.colores.textoSecundario },
  campo: { gap: tema.espacio.chico },
});
