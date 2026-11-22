import type { CompraDelEventoVista, ComprasDelEventoVista } from "@ai-ticket-it/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { ErrorDeApi, ServidorNoDisponibleError } from "../../../api";
import {
  Boton,
  Paginador,
  PantallaDesplazable,
  SegunConsulta,
  tema,
  useEnvioUnico,
  usePagina,
  useRefrescarAlFocalizar,
} from "../../../componentes";
import { textoFechaHora } from "../../eventos";
import { useSesion } from "../../sesion";
import { FilaCompraDelEvento } from "../componentes/FilaCompraDelEvento";
import { FiltroPorEstado } from "../componentes/FiltroPorEstado";
import { ResumenPorTipo } from "../componentes/ResumenPorTipo";
import { useSalirSiNoExisteElEvento } from "../evento-inexistente";
import { SIN_COMPRAS, textoSinComprasDelFiltro, type FiltroDeCompras } from "../filtro-de-compras";
import { textoComprasSinResponder, textoConfirmarReembolso, textoVentanaDeUso } from "../formato";
import { useConfirmarReembolso } from "../mutaciones";
import { useComprasDelEvento } from "../useComprasDelEvento";

/**
 * "Compras del evento" (feature 008, UC-02): las compras de un evento propio, al día, con la ventana
 * de uso y la disponibilidad por tipo; desde la 013, de a 10 y filtradas por el servidor. Solo se
 * llega desde un evento del organizador ("Ver compras"); el permiso lo decide el servidor.
 */
export function ComprasDelEvento() {
  const { eventoId } = useLocalSearchParams<{ eventoId: string }>();
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null; // el guard ya no muestra esta ruta
  // La `key`: con otro usuario la lista arranca de cero, sin la respuesta anterior como placeholder.
  return (
    <ListaDeComprasDelEvento
      key={`${estado.usuarioId}/${eventoId}`}
      usuarioId={estado.usuarioId}
      eventoId={eventoId}
    />
  );
}

function ListaDeComprasDelEvento({ usuarioId, eventoId }: { usuarioId: string; eventoId: string }) {
  // Acá y no en `Contenido`: el filtro y la página sobreviven a las relecturas de la lista.
  const [filtro, setFiltro] = useState<FiltroDeCompras>("todas");
  // Cambiar el filtro vuelve a la página 1 (feature 013, FR-017, research R7).
  const [pagina, cambiarPagina] = usePagina(filtro);
  const consulta = useComprasDelEvento(usuarioId, eventoId, filtro, pagina);
  // Al volver (de "Registrar ingreso" u otra pantalla) refleja compras, usos y vencimientos (FR-023),
  // en la misma página y con el mismo filtro (FR-018).
  useRefrescarAlFocalizar(consulta.refetch);
  useSalirSiNoExisteElEvento(consulta.error);
  return (
    <View style={estilos.pantalla}>
      {/*
        La vista es un objeto, así que `SegunConsulta` nunca la da por vacía: sin compras se ven igual
        el evento y la ventana, y la lista dice el vacío (FR-022).
      */}
      <SegunConsulta consulta={consulta} mensajeVacio={SIN_COMPRAS}>
        {(vista) => (
          <Contenido
            usuarioId={usuarioId}
            vista={vista}
            filtro={filtro}
            alCambiarFiltro={setFiltro}
            pagina={pagina}
            alCambiarPagina={cambiarPagina}
            cargandoLista={consulta.isPlaceholderData}
          />
        )}
      </SegunConsulta>
    </View>
  );
}

interface PropsContenido {
  usuarioId: string;
  vista: ComprasDelEventoVista;
  filtro: FiltroDeCompras;
  alCambiarFiltro: (filtro: FiltroDeCompras) => void;
  /** La página pedida: al cambiar, la pantalla vuelve arriba (research R9). */
  pagina: number;
  alCambiarPagina: (numero: number) => void;
  /**
   * La vista es la de la página o el filtro anterior mientras llega la nueva (research R8): el
   * resumen sigue a la vista y, en lugar de las filas y del paginador, "Cargando compras…".
   */
  cargandoLista: boolean;
}

function Contenido({
  usuarioId,
  vista,
  filtro,
  alCambiarFiltro,
  pagina,
  alCambiarPagina,
  cargandoLista,
}: PropsContenido) {
  // Una sola mutation para todas las filas (feature 009): la fila en curso y su error salen de ella.
  const reembolso = useConfirmarReembolso(usuarioId, vista.evento.id);
  // Marca sincrónica: una segunda confirmación antes de que se vuelva a dibujar no manda otro pedido.
  const enviarUnaVez = useEnvioUnico();
  const error = mensajeDeReembolso(reembolso.error);

  const enviar = (compraId: string) =>
    enviarUnaVez((terminar) => reembolso.mutate(compraId, { onSettled: terminar }));
  const confirmar = (compra: CompraDelEventoVista) =>
    Alert.alert(
      `¿Confirmar el reembolso a ${compra.comprador.nombre} ${compra.comprador.apellido}?`,
      textoConfirmarReembolso(compra),
      [
        { text: "Volver", style: "cancel" },
        { text: "Confirmar reembolso", onPress: () => enviar(compra.id) },
      ],
    );
  const deEstaFila = (compra: CompraDelEventoVista) => reembolso.variables === compra.id;
  // La página ya llega filtrada (feature 013): el resumen por tipo sigue contando todas las compras.
  const { compras } = vista;
  // El contador va acá y no en el hub, que solo lee el evento (docs/mejoras-organizador.md, grupo 4).
  const sinResponder = textoComprasSinResponder(vista.comprasConMensajesSinResponder);

  return (
    <PantallaDesplazable separacion={tema.espacio.normal} volverArribaCon={pagina}>
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
        {sinResponder !== null && <Text style={estilos.ventana}>{sinResponder}</Text>}
        {/* Sin ninguna compra en el evento no hay nada que filtrar (no si solo el filtro la vació). */}
        {vista.cantidadCompras === 0 ? (
          <Text style={estilos.dato}>{SIN_COMPRAS}</Text>
        ) : (
          <FiltroPorEstado filtro={filtro} alCambiar={alCambiarFiltro} />
        )}
        {/* Nunca las filas de la página anterior: mientras llega la nueva, solo el aviso. */}
        {cargandoLista ? (
          <Text style={estilos.dato}>Cargando compras…</Text>
        ) : (
          <>
            {vista.cantidadCompras > 0 && compras.length === 0 && (
              <Text style={estilos.dato}>{textoSinComprasDelFiltro(filtro)}</Text>
            )}
            {compras.map((compra) => (
              <FilaCompraDelEvento
                key={compra.id}
                compra={compra}
                alConfirmarReembolso={confirmar}
                enCurso={reembolso.isPending && deEstaFila(compra)}
                error={deEstaFila(compra) ? error : null}
              />
            ))}
            <Paginador pagina={vista.pagina} alCambiar={alCambiarPagina} />
          </>
        )}
      </View>
    </PantallaDesplazable>
  );
}

/** El aviso de un reembolso fallido, en su fila: el mensaje del servidor (también los 403 y 409). */
function mensajeDeReembolso(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ServidorNoDisponibleError) return "No se pudo confirmar el reembolso. Probá de nuevo.";
  if (error instanceof ErrorDeApi) return error.mensaje;
  return "Ocurrió un error inesperado.";
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
