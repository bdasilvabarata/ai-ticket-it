import type { EventoVista, TipoEntradaVista } from "@ai-ticket-it/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, type ComponentType } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Boton, Ilustracion, PantallaDesplazable, SegunConsulta, tema } from "../../../componentes";
import { useSesion } from "../../sesion";
import { nombreCompleto } from "../../usuarios";
import { EstrellaFavorito } from "../componentes/EstrellaFavorito";
import { FilaImagenes } from "../componentes/FilaImagenes";
import { ListaTiposEntrada } from "../componentes/ListaTiposEntrada";
import { MarcaRealizado } from "../componentes/MarcaRealizado";
import { ReseniasDelOrganizador } from "../componentes/ReseniasDelOrganizador";
import { esNoEncontrado } from "../errores-de-formulario";
import { textoFechaHora, textoPuntaje } from "../formato";
import { useInvalidarCatalogo } from "../useCatalogo";
import { useEvento } from "../useEvento";

/**
 * El detalle público de un evento (contracts/app.md, "Detalle del evento"), el mismo para un evento
 * propio. Sin `complementos`, de solo lectura; la compra la suma la feature `compras` con ellos.
 */
/** Lo que otra feature (compras) suma al detalle sin que `eventos` la conozca (research R12). */
export interface ComplementosDelDetalle {
  /** A la derecha de cada tipo de entrada. */
  AccionDeTipo?: ComponentType<{ evento: EventoVista; tipo: TipoEntradaVista }>;
  /** Antes de "Tipos de entrada". */
  SeccionPropia?: ComponentType<{ evento: EventoVista }>;
}

export function DetalleEvento({ complementos = {} }: { complementos?: ComplementosDelDetalle }) {
  const { eventoId } = useLocalSearchParams<{ eventoId: string }>();
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null; // el guard ya no muestra esta ruta
  return (
    <DetalleSegunConsulta usuarioId={estado.usuarioId} eventoId={eventoId} complementos={complementos} />
  );
}

function DetalleSegunConsulta({
  usuarioId,
  eventoId,
  complementos,
}: {
  usuarioId: string;
  eventoId: string;
  complementos: ComplementosDelDetalle;
}) {
  const consulta = useEvento(usuarioId, eventoId);
  const invalidarCatalogo = useInvalidarCatalogo();
  const noEncontrado = esNoEncontrado(consulta.error);

  // El evento ya no existe: al volver, Explorar lo vuelve a pedir y deja de mostrarlo (R15).
  useEffect(() => {
    if (noEncontrado) void invalidarCatalogo();
  }, [noEncontrado, invalidarCatalogo]);

  if (noEncontrado) {
    return (
      <View style={estilos.noEncontrado}>
        <Ilustracion icono="search-outline" />
        <Text style={estilos.textoNoEncontrado} accessibilityLiveRegion="polite">
          No encontramos este evento.
        </Text>
        <Boton texto="Volver a Explorar" alPresionar={() => router.back()} />
      </View>
    );
  }
  return (
    <SegunConsulta consulta={consulta} mensajeVacio="No encontramos este evento.">
      {(evento) => <ContenidoDelDetalle usuarioId={usuarioId} evento={evento} complementos={complementos} />}
    </SegunConsulta>
  );
}

function ContenidoDelDetalle({
  usuarioId,
  evento,
  complementos: { AccionDeTipo, SeccionPropia },
}: {
  usuarioId: string;
  evento: EventoVista;
  complementos: ComplementosDelDetalle;
}) {
  return (
    <PantallaDesplazable separacion={tema.espacio.normal}>
      {evento.realizado ? (
        <View style={estilos.datos}>
          <MarcaRealizado />
          <Text style={estilos.aviso}>Este evento ya se realizó</Text>
        </View>
      ) : null}
      <View style={estilos.encabezado}>
        <Text style={estilos.nombre} accessibilityRole="header">
          {evento.nombre}
        </Text>
        <EstrellaFavorito eventoId={evento.id} />
      </View>
      <View style={estilos.datos}>
        <Text style={estilos.dato}>{evento.categoria.nombre}</Text>
        <Text style={estilos.dato}>{textoFechaHora(evento.fechaHoraLocal)}</Text>
      </View>
      {evento.descripcion ? <Text style={estilos.descripcion}>{evento.descripcion}</Text> : null}
      <FilaImagenes urls={evento.multimedia} nombreDelEvento={evento.nombre} />
      <View style={estilos.datos}>
        <Text style={estilos.titulo} accessibilityRole="header">
          Organiza
        </Text>
        <Text style={estilos.descripcion}>
          {`${nombreCompleto(evento.organizador)} · ${textoPuntaje(evento.organizador)}`}
        </Text>
      </View>
      {SeccionPropia ? <SeccionPropia evento={evento} /> : null}
      <View style={estilos.datos}>
        <Text style={estilos.titulo} accessibilityRole="header">
          Tipos de entrada
        </Text>
        <ListaTiposEntrada
          tipos={evento.tiposEntrada}
          accionDeTipo={AccionDeTipo ? (tipo) => <AccionDeTipo evento={evento} tipo={tipo} /> : undefined}
        />
      </View>
      <ReseniasDelOrganizador usuarioId={usuarioId} eventoId={evento.id} />
    </PantallaDesplazable>
  );
}

const estilos = StyleSheet.create({
  // El nombre ocupa lo que deja la estrella y baja de línea si no entra: la estrella no lo tapa.
  encabezado: { flexDirection: "row", alignItems: "flex-start", gap: tema.espacio.chico },
  nombre: { ...tema.tipografia.titulo, color: tema.colores.texto, flex: 1 },
  datos: { gap: tema.espacio.minimo },
  dato: { ...tema.tipografia.cuerpo, color: tema.colores.textoSecundario },
  descripcion: { ...tema.tipografia.cuerpo, color: tema.colores.texto },
  aviso: { ...tema.tipografia.mensaje, color: tema.colores.texto },
  titulo: { ...tema.tipografia.subtitulo, color: tema.colores.texto },
  noEncontrado: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: tema.espacio.amplio,
    gap: tema.espacio.normal,
    backgroundColor: tema.colores.fondo,
  },
  textoNoEncontrado: { ...tema.tipografia.cuerpo, textAlign: "center", color: tema.colores.textoSecundario },
});
