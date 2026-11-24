import type { EventoVista } from "@ai-ticket-it/shared";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Boton, PantallaDesplazable, SegunConsulta, tema } from "../../../componentes";
import { useSesion } from "../../sesion";
import { MarcaRealizado } from "../componentes/MarcaRealizado";
import { textoFechaHora } from "../formato";
import { useEvento } from "../useEvento";

/**
 * La ruta `/eventos/[eventoId]`: el hub del evento propio, con sus datos y los accesos a "Ver
 * compras", "Registrar ingreso" y la edición ("Editar evento", o "Ver detalle" si ya se realizó, según
 * el `realizado` del servidor). Las pantallas de compras se abren por la ruta tipada: `eventos` no
 * importa `compras` (sería un ciclo).
 */
export function HubDelEvento() {
  const { eventoId } = useLocalSearchParams<{ eventoId: string }>();
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null; // el guard ya no muestra esta ruta
  return <ContenidoDelHub usuarioId={estado.usuarioId} eventoId={eventoId} />;
}

function ContenidoDelHub({ usuarioId, eventoId }: { usuarioId: string; eventoId: string }) {
  const consulta = useEvento(usuarioId, eventoId);
  return (
    <SegunConsulta consulta={consulta} mensajeVacio="No existe el evento.">
      {(evento) => <Hub evento={evento} />}
    </SegunConsulta>
  );
}

function Hub({ evento }: { evento: EventoVista }) {
  const params = { eventoId: evento.id };
  return (
    <PantallaDesplazable separacion={tema.espacio.normal}>
      {evento.realizado ? <MarcaRealizado /> : null}
      <Text style={estilos.nombre} accessibilityRole="header">
        {evento.nombre}
      </Text>
      <View style={estilos.datos}>
        <Text style={estilos.dato}>{evento.categoria.nombre}</Text>
        <Text style={estilos.dato}>{textoFechaHora(evento.fechaHoraLocal)}</Text>
      </View>
      <View style={estilos.acciones}>
        <Boton
          texto="Ver compras"
          alPresionar={() => router.push({ pathname: "/eventos/[eventoId]/compras", params })}
        />
        <Boton
          variante="aviso"
          texto="Registrar ingreso"
          alPresionar={() => router.push({ pathname: "/eventos/[eventoId]/ingreso", params })}
        />
        <Boton
          variante="aviso"
          texto={evento.realizado ? "Ver detalle" : "Editar evento"}
          alPresionar={() => router.push({ pathname: "/eventos/[eventoId]/editar", params })}
        />
      </View>
    </PantallaDesplazable>
  );
}

const estilos = StyleSheet.create({
  nombre: { ...tema.tipografia.titulo, color: tema.colores.texto },
  datos: { gap: tema.espacio.minimo },
  dato: { ...tema.tipografia.cuerpo, color: tema.colores.textoSecundario },
  acciones: { gap: tema.espacio.medio },
});
