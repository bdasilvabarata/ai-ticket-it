import type { EventoVista, MisComprasDelEventoVista, TipoEntradaVista } from "@ai-ticket-it/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ErrorDeApi, ServidorNoDisponibleError } from "../../../api";
import {
  Boton,
  PantallaDesplazable,
  SegunConsulta,
  tema,
  type ConsultaMostrable,
} from "../../../componentes";
import { textoFechaHora, textoPrecio, useEvento } from "../../eventos";
import { useSesion } from "../../sesion";
import { SelectorCantidad } from "../componentes/SelectorCantidad";
import { textoTotal } from "../formato";
import { useComprarEntradas } from "../mutaciones";
import { useMisComprasDelEvento } from "../useMisComprasDelEvento";

/** Comprar entradas de un tipo (contracts/app.md, "Comprar entradas"). */
export function ComprarEntradas() {
  const { eventoId, tipoEntradaId } = useLocalSearchParams<{ eventoId: string; tipoEntradaId: string }>();
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null; // el guard ya no muestra esta ruta
  return <SegunLasConsultas usuarioId={estado.usuarioId} eventoId={eventoId} tipoEntradaId={tipoEntradaId} />;
}

interface Datos {
  evento: EventoVista;
  misCompras: MisComprasDelEventoVista;
}

/** Las dos consultas como una sola para `SegunConsulta`: carga si falta alguna y falla si falla alguna. */
function combinar(
  evento: ConsultaMostrable<EventoVista>,
  misCompras: ConsultaMostrable<MisComprasDelEventoVista>,
): ConsultaMostrable<Datos> {
  const conError = evento.isError ? evento : misCompras.isError ? misCompras : null;
  return {
    isPending: !conError && (evento.isPending || misCompras.isPending),
    isError: conError !== null,
    error: conError?.error ?? null,
    data: evento.data && misCompras.data ? { evento: evento.data, misCompras: misCompras.data } : undefined,
    isFetching: evento.isFetching || misCompras.isFetching,
    refetch: () => {
      if (evento.isError) void evento.refetch();
      if (misCompras.isError) void misCompras.refetch();
    },
  };
}

function SegunLasConsultas({
  usuarioId,
  eventoId,
  tipoEntradaId,
}: {
  usuarioId: string;
  eventoId: string;
  tipoEntradaId: string;
}) {
  const evento = useEvento(usuarioId, eventoId);
  const misCompras = useMisComprasDelEvento(usuarioId, eventoId);
  return (
    <SegunConsulta consulta={combinar(evento, misCompras)} mensajeVacio="No encontramos este evento.">
      {({ evento: datosEvento, misCompras: datosMisCompras }) => {
        const tipo = datosEvento.tiposEntrada.find((t) => t.id === tipoEntradaId);
        if (!tipo) return <SinCompra mensaje="Este tipo de entrada ya no está disponible." />;
        const restantes =
          datosMisCompras.restantesPorTipo.find((r) => r.tipoEntradaId === tipo.id)?.restantes ?? tipo.cupo;
        return <Formulario usuarioId={usuarioId} evento={datosEvento} tipo={tipo} restantes={restantes} />;
      }}
    </SegunConsulta>
  );
}

/** Cuando no hay nada para comprar: el motivo y "Volver al evento". */
function SinCompra({ mensaje, encabezado }: { mensaje: string; encabezado?: ReactNode }) {
  return (
    <PantallaDesplazable separacion={tema.espacio.normal}>
      {encabezado}
      <Text style={estilos.aviso} accessibilityLiveRegion="polite">
        {mensaje}
      </Text>
      <View style={estilos.acciones}>
        <Boton variante="aviso" texto="Volver al evento" alPresionar={() => router.back()} />
      </View>
    </PantallaDesplazable>
  );
}

function Encabezado({ evento, tipo }: { evento: EventoVista; tipo: TipoEntradaVista }) {
  return (
    <View style={estilos.encabezado}>
      <Text style={estilos.nombre} accessibilityRole="header">
        {evento.nombre}
      </Text>
      <Text style={estilos.dato}>{textoFechaHora(evento.fechaHoraLocal)}</Text>
      <View style={estilos.tipo}>
        <Text style={estilos.nombreTipo}>{tipo.nombre}</Text>
        <Text style={estilos.dato}>{tipo.precio === 0 ? "Gratis" : `${textoPrecio(tipo.precio)} c/u`}</Text>
      </View>
    </View>
  );
}

function mensajeDelError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ServidorNoDisponibleError) return "No se pudo registrar la compra. Probá de nuevo.";
  if (error instanceof ErrorDeApi) return error.mensaje;
  return "Ocurrió un error inesperado.";
}

function Formulario({
  usuarioId,
  evento,
  tipo,
  restantes,
}: {
  usuarioId: string;
  evento: EventoVista;
  tipo: TipoEntradaVista;
  restantes: number;
}) {
  const comprar = useComprarEntradas(usuarioId, evento.id);
  const [elegida, setElegida] = useState(1);
  // Marca sincrónica: un segundo toque antes de que se vuelva a dibujar (con `isPending` todavía en
  // false) no manda otro pedido.
  const enviando = useRef(false);
  const maximo = Math.min(tipo.cupo, restantes);
  // Si el máximo baja (otra compra, el tope), la cantidad se recorta sin dejar de ser ≥ 1.
  const cantidad = Math.max(1, Math.min(elegida, maximo));
  const encabezado = <Encabezado evento={evento} tipo={tipo} />;

  if (evento.realizado) return <SinCompra encabezado={encabezado} mensaje="Este evento ya se realizó" />;
  if (tipo.cupo === 0)
    return <SinCompra encabezado={encabezado} mensaje="No quedan entradas de este tipo." />;
  if (maximo === 0) {
    return <SinCompra encabezado={encabezado} mensaje="Ya tenés el máximo de entradas para este evento" />;
  }

  const confirmar = () => {
    if (enviando.current) return;
    enviando.current = true;
    comprar.mutate(
      { tipoEntradaId: tipo.id, cantidad },
      {
        onSettled: () => {
          enviando.current = false;
        },
        onSuccess: (compra) =>
          router.replace({ pathname: "/compras/[compraId]", params: { compraId: compra.id } }),
      },
    );
  };
  const error = mensajeDelError(comprar.error);

  return (
    <PantallaDesplazable separacion={tema.espacio.normal}>
      {encabezado}
      <SelectorCantidad cantidad={cantidad} maximo={maximo} alCambiar={setElegida} />
      {maximo < tipo.cupo ? (
        <Text style={estilos.dato}>{`Podés comprar hasta ${maximo} entradas de este evento`}</Text>
      ) : null}
      <Text style={estilos.total}>{`Total: ${textoTotal(tipo.precio * cantidad)}`}</Text>
      {error ? (
        <Text style={estilos.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <View style={estilos.acciones}>
        <Boton
          texto="Confirmar compra"
          textoEnCurso="Comprando…"
          enCurso={comprar.isPending}
          alPresionar={confirmar}
        />
      </View>
    </PantallaDesplazable>
  );
}

const estilos = StyleSheet.create({
  encabezado: { gap: tema.espacio.minimo },
  nombre: { ...tema.tipografia.titulo, color: tema.colores.texto },
  dato: { ...tema.tipografia.cuerpo, color: tema.colores.textoSecundario },
  tipo: { gap: tema.espacio.minimo, marginTop: tema.espacio.chico },
  nombreTipo: { ...tema.tipografia.subtitulo, color: tema.colores.texto },
  total: { ...tema.tipografia.subtitulo, color: tema.colores.texto },
  aviso: { ...tema.tipografia.mensaje, color: tema.colores.texto },
  error: { ...tema.tipografia.cuerpo, color: tema.colores.error },
  acciones: { alignItems: "flex-start" },
});
