import { EstadoCompra, type CompraVista } from "@ai-ticket-it/shared";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";

import { ErrorDeApi, ServidorNoDisponibleError } from "../../../api";
import { Boton, EtiquetaEstadoCompra, PantallaDesplazable, SegunConsulta, tema } from "../../../componentes";
import { AvisoDeFormulario } from "../../eventos";
import { useSesion } from "../../sesion";
import { AvisoDeLaCompra, CompraNoEncontrada } from "../componentes/AvisoDeLaCompra";
import { ListaDeEntradas } from "../componentes/ListaDeEntradas";
import { ResumenCompra } from "../componentes/ResumenCompra";
import {
  textoAccionDePago,
  textoCancelada,
  textoCantidad,
  textoConfirmarCancelacion,
  textoEntradasUsadas,
  textoMotivoNoCancelable,
  textoReembolsada,
  textoVencimiento,
} from "../formato";
import { useCancelarCompra, usePagarCompra } from "../mutaciones";
import { useCompra } from "../useCompra";
import { useEnvioUnico } from "../useEnvioUnico";

/**
 * "Tu compra" (contracts/app.md, "Tu compra"). Se dibuja **siempre** desde la compra que devuelve el
 * servidor (research R17): pagar no cambia nada a mano, la respuesta o la relectura lo hacen.
 */
export function Compra() {
  const { compraId } = useLocalSearchParams<{ compraId: string }>();
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null; // el guard ya no muestra esta ruta
  return <SegunLaCompra usuarioId={estado.usuarioId} compraId={compraId} />;
}

const irAExplorar = () => router.dismissTo("/");

/**
 * Al detalle del evento de la compra, venga de donde venga "Tu compra": si el detalle está en la pila
 * (se llegó desde él) vuelve a él; si no (desde "Mis compras"), reemplaza esta pantalla por el detalle.
 */
const irAlEvento = (eventoId: string) =>
  router.dismissTo({ pathname: "/explorar/[eventoId]", params: { eventoId } });

/** Al chat de la compra con el organizador (feature 011). */
const irAlChat = (compraId: string) =>
  router.push({ pathname: "/compras/[compraId]/chat", params: { compraId } });

function SegunLaCompra({ usuarioId, compraId }: { usuarioId: string; compraId: string }) {
  const consulta = useCompra(usuarioId, compraId);
  const { error } = consulta;

  if (error instanceof ErrorDeApi && error.status === 403) {
    return <AvisoDeLaCompra icono="lock-closed-outline" mensaje="No tenés permiso para ver esta compra." />;
  }
  if (error instanceof ErrorDeApi && error.status === 404) {
    return <CompraNoEncontrada />;
  }
  return (
    <SegunConsulta consulta={consulta} mensajeVacio="No encontramos esta compra.">
      {(compra) => <ContenidoDeLaCompra usuarioId={usuarioId} compra={compra} />}
    </SegunConsulta>
  );
}

function ContenidoDeLaCompra({ usuarioId, compra }: { usuarioId: string; compra: CompraVista }) {
  return (
    <PantallaDesplazable separacion={tema.espacio.normal}>
      <EtiquetaEstadoCompra estado={compra.estado} />
      {compra.estado === EstadoCompra.CONFIRMADA ? (
        <Text style={estilos.mensaje} accessibilityLiveRegion="polite">
          ¡Listo! Tu compra está confirmada.
        </Text>
      ) : null}
      {compra.estado === EstadoCompra.CANCELADA ? (
        <Text style={estilos.mensaje} accessibilityLiveRegion="polite">
          {textoCancelada(compra)}
        </Text>
      ) : null}
      {compra.estado === EstadoCompra.REEMBOLSADA ? (
        <Text style={estilos.mensaje} accessibilityLiveRegion="polite">
          {textoReembolsada(compra)}
        </Text>
      ) : null}
      <ResumenCompra compra={compra} />
      {/* El chat con el organizador, en cualquier estado (feature 011). */}
      <View style={estilos.acciones}>
        <Boton variante="aviso" texto="Chat con el organizador" alPresionar={() => irAlChat(compra.id)} />
      </View>
      {conEntradas(compra) ? <TusEntradas compra={compra} /> : null}
      {conEntradas(compra) ? <Cancelacion usuarioId={usuarioId} compra={compra} /> : null}
      {compra.estado === EstadoCompra.PENDIENTE ? (
        <Pago usuarioId={usuarioId} compra={compra} />
      ) : (
        <View style={estilos.acciones}>
          <Boton variante="aviso" texto="Volver al evento" alPresionar={() => irAlEvento(compra.evento.id)} />
          {conEntradas(compra) ? (
            <Boton variante="texto" texto="Ir a Explorar" alPresionar={irAExplorar} />
          ) : null}
        </View>
      )}
    </PantallaDesplazable>
  );
}

/** Una compra pagada (confirmada o con alguna entrada usada): la única que muestra sus códigos (R14). */
const conEntradas = (compra: CompraVista) =>
  compra.estado === EstadoCompra.CONFIRMADA || compra.estado === EstadoCompra.UTILIZADA;

function TusEntradas({ compra }: { compra: CompraVista }) {
  return (
    <View style={estilos.entradas}>
      <Text style={estilos.seccion} accessibilityRole="header">
        Tus entradas
      </Text>
      {compra.entradasUsadas > 0 ? (
        <Text style={estilos.dato}>{textoEntradasUsadas(compra.entradasUsadas, compra.cantidad)}</Text>
      ) : null}
      <ListaDeEntradas entradas={compra.entradas} />
    </View>
  );
}

/**
 * El aviso de un pago fallido (contracts/app.md, "Errores del pago"). Los 409 no avisan: la compra
 * se vuelve a pedir y su estado real (vencida o ya confirmada) reemplaza a esta parte de la pantalla.
 */
function mensajeDelError(error: unknown, sinServidor: string): string | null {
  if (!error) return null;
  if (error instanceof ServidorNoDisponibleError) return sinServidor;
  if (error instanceof ErrorDeApi) return error.status === 409 ? null : error.mensaje;
  return "Ocurrió un error inesperado.";
}

/**
 * Cancelar una compra pagada (feature 009, contracts/app.md): el botón solo si el servidor dice que
 * es `cancelable` (la app no calcula la regla). A diferencia del pago, un 409 sí avisa con el mensaje
 * del servidor; la compra se vuelve a pedir igual y su estado real redibuja la pantalla.
 */
function Cancelacion({ usuarioId, compra }: { usuarioId: string; compra: CompraVista }) {
  const cancelar = useCancelarCompra(usuarioId, compra.id, compra.evento.id);
  // Marca sincrónica: una segunda confirmación antes de que se vuelva a dibujar no manda otro pedido.
  const enviarUnaVez = useEnvioUnico();
  const error = mensajeDeCancelacion(cancelar.error);

  const enviar = () => enviarUnaVez((terminar) => cancelar.mutate(undefined, { onSettled: terminar }));
  const confirmar = () =>
    Alert.alert(
      `¿Cancelar la compra de ${textoCantidad(compra.cantidad)} ${compra.tipoEntrada.nombre}?`,
      textoConfirmarCancelacion(compra),
      [
        { text: "Volver", style: "cancel" },
        { text: "Cancelar compra", style: "destructive", onPress: enviar },
      ],
    );

  // El motivo lo decide el servidor (`motivoNoCancelable`) y va en lugar del botón (US3, SC-007).
  const motivo = compra.cancelable ? null : textoMotivoNoCancelable(compra.motivoNoCancelable);
  if (!compra.cancelable && !motivo && !error) return null;
  return (
    <View style={estilos.acciones}>
      <AvisoDeFormulario mensaje={error} />
      {compra.cancelable ? (
        <Boton
          variante="texto"
          texto="Cancelar compra"
          textoEnCurso="Cancelando…"
          enCurso={cancelar.isPending}
          alPresionar={confirmar}
        />
      ) : null}
      {motivo ? <Text style={estilos.motivo}>{motivo}</Text> : null}
    </View>
  );
}

/** El aviso de una cancelación fallida de una compra pagada: también el mensaje de un 409. */
function mensajeDeCancelacion(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ServidorNoDisponibleError) return "No se pudo cancelar. Probá de nuevo.";
  if (error instanceof ErrorDeApi) return error.mensaje;
  return "Ocurrió un error inesperado.";
}

/**
 * Hasta cuándo se puede pagar, "Pagar" ("Confirmar" si es gratis) y "Cancelar compra", que tras
 * confirmarlo la cancela sin esperar a que venza. Solo se muestra con la compra `PENDIENTE`, así que
 * el aviso de un pago o una cancelación fallidos desaparece apenas la relectura trae otro estado.
 */
function Pago({ usuarioId, compra }: { usuarioId: string; compra: CompraVista }) {
  const pagar = usePagarCompra(usuarioId, compra.id, compra.evento.id);
  const cancelar = useCancelarCompra(usuarioId, compra.id, compra.evento.id);
  // Marca sincrónica: un segundo toque antes de que se vuelva a dibujar no manda otro pedido (ni
  // pagar y cancelar a la vez).
  const enviarUnaVez = useEnvioUnico();
  const gratis = compra.total === 0;
  const error =
    mensajeDelError(pagar.error, "No se pudo pagar. Probá de nuevo.") ??
    mensajeDelError(cancelar.error, "No se pudo cancelar. Probá de nuevo.");
  const descripcion = `${textoCantidad(compra.cantidad)} ${compra.tipoEntrada.nombre}`;

  const enviar = (mutacion: typeof pagar | typeof cancelar) =>
    enviarUnaVez((terminar) => mutacion.mutate(undefined, { onSettled: terminar }));
  const alPagar = () => enviar(pagar);

  const confirmarCancelar = () =>
    Alert.alert(`¿Cancelar la compra de ${descripcion}?`, "Sus entradas vuelven a estar disponibles.", [
      { text: "Volver", style: "cancel" },
      { text: "Cancelar compra", style: "destructive", onPress: () => enviar(cancelar) },
    ]);

  return (
    <>
      {compra.venceEnLocal ? <Text style={estilos.dato}>{textoVencimiento(compra.venceEnLocal)}</Text> : null}
      <AvisoDeFormulario mensaje={error} />
      <View style={estilos.acciones}>
        <Boton
          texto={textoAccionDePago(compra.total)}
          textoEnCurso={gratis ? "Confirmando…" : "Pagando…"}
          enCurso={pagar.isPending}
          deshabilitado={cancelar.isPending}
          alPresionar={alPagar}
        />
        <Boton
          variante="texto"
          texto="Cancelar compra"
          textoEnCurso="Cancelando…"
          enCurso={cancelar.isPending}
          deshabilitado={pagar.isPending}
          alPresionar={confirmarCancelar}
        />
      </View>
    </>
  );
}

const estilos = StyleSheet.create({
  mensaje: { ...tema.tipografia.mensaje, color: tema.colores.texto },
  dato: { ...tema.tipografia.cuerpo, color: tema.colores.textoSecundario },
  motivo: { ...tema.tipografia.cuerpo, color: tema.colores.textoSecundario, flexShrink: 1 },
  entradas: { gap: tema.espacio.chico },
  seccion: { ...tema.tipografia.subtitulo, color: tema.colores.texto },
  acciones: { alignItems: "flex-start", gap: tema.espacio.chico },
});
