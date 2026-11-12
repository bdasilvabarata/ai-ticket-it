import { EstadoCompra, type CompraVista } from "@ai-ticket-it/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ErrorDeApi, ServidorNoDisponibleError } from "../../../api";
import {
  Boton,
  EtiquetaEstadoCompra,
  Ilustracion,
  PantallaDesplazable,
  SegunConsulta,
  tema,
  type PropsIlustracion,
} from "../../../componentes";
import { AvisoDeFormulario } from "../../eventos";
import { useSesion } from "../../sesion";
import { ResumenCompra } from "../componentes/ResumenCompra";
import { textoCancelada, textoVencimiento } from "../formato";
import { usePagarCompra } from "../mutaciones";
import { useCompra } from "../useCompra";

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

function SegunLaCompra({ usuarioId, compraId }: { usuarioId: string; compraId: string }) {
  const consulta = useCompra(usuarioId, compraId);
  const { error } = consulta;

  if (error instanceof ErrorDeApi && error.status === 403) {
    return <Aviso icono="lock-closed-outline" mensaje="No tenés permiso para ver esta compra." />;
  }
  if (error instanceof ErrorDeApi && error.status === 404) {
    return (
      <Aviso icono="search-outline" mensaje="No encontramos esta compra.">
        <Boton texto="Ir a Explorar" alPresionar={irAExplorar} />
      </Aviso>
    );
  }
  return (
    <SegunConsulta consulta={consulta} mensajeVacio="No encontramos esta compra.">
      {(compra) => <ContenidoDeLaCompra usuarioId={usuarioId} compra={compra} />}
    </SegunConsulta>
  );
}

function Aviso({
  icono,
  mensaje,
  children,
}: {
  icono: PropsIlustracion["icono"];
  mensaje: string;
  children?: ReactNode;
}) {
  return (
    <View style={estilos.aviso}>
      <Ilustracion icono={icono} />
      <Text style={estilos.textoAviso} accessibilityLiveRegion="polite">
        {mensaje}
      </Text>
      {children}
    </View>
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
      <ResumenCompra compra={compra} />
      {compra.estado === EstadoCompra.PENDIENTE ? (
        <Pago usuarioId={usuarioId} compra={compra} />
      ) : (
        <View style={estilos.acciones}>
          <Boton variante="aviso" texto="Volver al evento" alPresionar={() => router.back()} />
          {compra.estado === EstadoCompra.CONFIRMADA ? (
            <Boton variante="texto" texto="Ir a Explorar" alPresionar={irAExplorar} />
          ) : null}
        </View>
      )}
    </PantallaDesplazable>
  );
}

/**
 * El aviso de un pago fallido (contracts/app.md, "Errores del pago"). Los 409 no avisan: la compra
 * se vuelve a pedir y su estado real (vencida o ya confirmada) reemplaza a esta parte de la pantalla.
 */
function mensajeDelError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ServidorNoDisponibleError) return "No se pudo pagar. Probá de nuevo.";
  if (error instanceof ErrorDeApi) return error.status === 409 ? null : error.mensaje;
  return "Ocurrió un error inesperado.";
}

/**
 * Hasta cuándo se puede pagar y "Pagar" ("Confirmar" si es gratis). Solo se muestra con la compra
 * `PENDIENTE`, así que el aviso de un pago fallido desaparece apenas la relectura trae otro estado.
 */
function Pago({ usuarioId, compra }: { usuarioId: string; compra: CompraVista }) {
  const pagar = usePagarCompra(usuarioId, compra.id, compra.evento.id);
  // Marca sincrónica: un segundo toque antes de que se vuelva a dibujar no manda otro pedido.
  const enviando = useRef(false);
  const gratis = compra.total === 0;
  const error = mensajeDelError(pagar.error);

  const alPagar = () => {
    if (enviando.current) return;
    enviando.current = true;
    pagar.mutate(undefined, {
      onSettled: () => {
        enviando.current = false;
      },
    });
  };

  return (
    <>
      {compra.venceEnLocal ? <Text style={estilos.dato}>{textoVencimiento(compra.venceEnLocal)}</Text> : null}
      <AvisoDeFormulario mensaje={error} />
      <View style={estilos.acciones}>
        <Boton
          texto={gratis ? "Confirmar" : "Pagar"}
          textoEnCurso={gratis ? "Confirmando…" : "Pagando…"}
          enCurso={pagar.isPending}
          alPresionar={alPagar}
        />
      </View>
    </>
  );
}

const estilos = StyleSheet.create({
  aviso: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: tema.espacio.normal,
    padding: tema.espacio.amplio,
    backgroundColor: tema.colores.fondo,
  },
  textoAviso: { ...tema.tipografia.mensaje, color: tema.colores.texto, textAlign: "center" },
  mensaje: { ...tema.tipografia.mensaje, color: tema.colores.texto },
  dato: { ...tema.tipografia.cuerpo, color: tema.colores.textoSecundario },
  acciones: { alignItems: "flex-start", gap: tema.espacio.chico },
});
