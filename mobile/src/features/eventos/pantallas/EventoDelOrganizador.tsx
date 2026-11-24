import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { SegunConsulta } from "../../../componentes";
import { useSesion } from "../../sesion";
import { useEvento } from "../useEvento";
import { EditarEvento } from "./EditarEvento";
import { VerEventoRealizado } from "./VerEventoRealizado";

const AVISO_REALIZADO = "El evento ya se realizó: no se puede modificar.";

/**
 * La ruta `/eventos/[eventoId]/editar` (research R16), que se abre desde el hub del evento: edita el
 * evento o lo muestra en solo lectura según el `realizado` del servidor, nunca según el reloj del
 * teléfono (FR-010a). Así, un 409 `EVENTO_REALIZADO` pasa a solo lectura sin navegar.
 */
export function EventoDelOrganizador() {
  const { eventoId } = useLocalSearchParams<{ eventoId: string }>();
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null; // el guard ya no muestra esta ruta
  return <EventoSegunEstado usuarioId={estado.usuarioId} eventoId={eventoId} />;
}

function EventoSegunEstado({ usuarioId, eventoId }: { usuarioId: string; eventoId: string }) {
  const consulta = useEvento(usuarioId, eventoId);
  const evento = consulta.data;

  // Si se abrió para editar y el servidor lo informa realizado (un 409 al guardar, o al volver de un
  // formulario de tipo), la solo lectura lleva el aviso de por qué ya no se puede modificar.
  const [abiertoParaEditar, setAbiertoParaEditar] = useState<boolean | null>(null);
  if (evento && abiertoParaEditar === null) setAbiertoParaEditar(!evento.realizado);

  const titulo = evento === undefined ? "Evento" : evento.realizado ? "Evento realizado" : "Editar evento";
  return (
    <>
      <Stack.Screen options={{ title: titulo }} />
      <SegunConsulta consulta={consulta} mensajeVacio="No existe el evento.">
        {(datos) =>
          datos.realizado ? (
            <VerEventoRealizado evento={datos} aviso={abiertoParaEditar ? AVISO_REALIZADO : null} />
          ) : (
            <EditarEvento evento={datos} usuarioId={usuarioId} />
          )
        }
      </SegunConsulta>
    </>
  );
}
