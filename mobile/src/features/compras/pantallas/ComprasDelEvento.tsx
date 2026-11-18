import type { ComprasDelEventoVista } from "@ai-ticket-it/shared";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Boton, PantallaDesplazable, SegunConsulta, tema } from "../../../componentes";
import { textoFechaHora } from "../../eventos";
import { useSesion } from "../../sesion";
import { FilaCompraDelEvento } from "../componentes/FilaCompraDelEvento";
import { ResumenPorTipo } from "../componentes/ResumenPorTipo";
import { textoVentanaDeUso } from "../formato";
import { useComprasDelEvento } from "../useComprasDelEvento";

/**
 * "Compras del evento" (feature 008, UC-02): todas las compras de un evento propio, al día, con la
 * ventana de uso y la disponibilidad por tipo. Solo se llega desde un evento del organizador ("Ver compras"); el permiso lo
 * decide el servidor.
 */
export function ComprasDelEvento() {
  const { eventoId } = useLocalSearchParams<{ eventoId: string }>();
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null; // el guard ya no muestra esta ruta
  return <ListaDeComprasDelEvento usuarioId={estado.usuarioId} eventoId={eventoId} />;
}

const SIN_COMPRAS = "Todavía nadie compró entradas";

function ListaDeComprasDelEvento({ usuarioId, eventoId }: { usuarioId: string; eventoId: string }) {
  const consulta = useComprasDelEvento(usuarioId, eventoId);
  return (
    <View style={estilos.pantalla}>
      {/*
        La vista es un objeto, así que `SegunConsulta` nunca la da por vacía: sin compras se ven igual
        el evento y la ventana, y la lista dice el vacío (FR-022).
      */}
      <SegunConsulta consulta={consulta} mensajeVacio={SIN_COMPRAS}>
        {(vista) => <Contenido vista={vista} />}
      </SegunConsulta>
    </View>
  );
}

function Contenido({ vista }: { vista: ComprasDelEventoVista }) {
  return (
    <PantallaDesplazable separacion={tema.espacio.normal}>
      <View style={estilos.datos}>
        <Text style={estilos.nombre} accessibilityRole="header">
          {vista.evento.nombre}
        </Text>
        <Text style={estilos.dato}>{textoFechaHora(vista.evento.fechaHoraLocal)}</Text>
      </View>
      <Text style={estilos.ventana}>{textoVentanaDeUso(vista.ventanaDeUso)}</Text>
      {/* Siempre visible: si la ventana está cerrada, la pantalla de ingreso explica por qué. */}
      <Boton
        texto="Registrar ingreso"
        alPresionar={() =>
          router.push({ pathname: "/eventos/[eventoId]/ingreso", params: { eventoId: vista.evento.id } })
        }
      />
      <ResumenPorTipo resumen={vista.resumenPorTipo} />
      <View style={estilos.seccion}>
        <Text style={estilos.titulo} accessibilityRole="header">
          Compras
        </Text>
        {vista.compras.length === 0 ? (
          <Text style={estilos.dato}>{SIN_COMPRAS}</Text>
        ) : (
          vista.compras.map((compra) => <FilaCompraDelEvento key={compra.id} compra={compra} />)
        )}
      </View>
    </PantallaDesplazable>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.colores.fondo },
  datos: { gap: tema.espacio.minimo },
  nombre: { ...tema.tipografia.titulo, color: tema.colores.texto },
  dato: { ...tema.tipografia.cuerpo, color: tema.colores.textoSecundario },
  ventana: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.texto },
  seccion: { gap: tema.espacio.medio },
  titulo: { ...tema.tipografia.subtitulo, color: tema.colores.texto },
});
