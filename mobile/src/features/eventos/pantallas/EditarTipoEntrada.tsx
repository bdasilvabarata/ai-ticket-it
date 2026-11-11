import type { TipoEntradaVista } from "@ai-ticket-it/shared";
import { useLocalSearchParams } from "expo-router";

import { MensajeError, SegunConsulta } from "../../../componentes";
import { useSesion } from "../../sesion";
import { valoresDeTipo } from "../formulario";
import { useEditarTipoEntrada } from "../mutaciones";
import { useEvento } from "../useEvento";
import { FormularioTipoEntrada } from "./FormularioTipoEntrada";

/** Editar un tipo de entrada (US3): precargado, con el cupo **disponible** (FR-014). */
export function EditarTipoEntrada() {
  const { eventoId, tipoEntradaId } = useLocalSearchParams<{ eventoId: string; tipoEntradaId: string }>();
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null; // el guard ya no muestra esta ruta
  return <TipoDelEvento usuarioId={estado.usuarioId} eventoId={eventoId} tipoId={tipoEntradaId} />;
}

interface PropsTipoDelEvento {
  usuarioId: string;
  eventoId: string;
  tipoId: string;
}

function TipoDelEvento({ usuarioId, eventoId, tipoId }: PropsTipoDelEvento) {
  const consulta = useEvento(usuarioId, eventoId);
  return (
    <SegunConsulta consulta={consulta} mensajeVacio="No existe el evento.">
      {(evento) => {
        const tipo = evento.tiposEntrada.find((t) => t.id === tipoId);
        return tipo ? (
          <Formulario usuarioId={usuarioId} eventoId={eventoId} tipo={tipo} />
        ) : (
          <MensajeError mensaje="No existe el tipo de entrada en este evento." />
        );
      }}
    </SegunConsulta>
  );
}

function Formulario({
  usuarioId,
  eventoId,
  tipo,
}: Omit<PropsTipoDelEvento, "tipoId"> & { tipo: TipoEntradaVista }) {
  const editar = useEditarTipoEntrada(usuarioId, eventoId, tipo.id);
  return (
    <FormularioTipoEntrada
      inicial={valoresDeTipo(tipo)}
      mutacion={editar}
      textoBoton="Guardar cambios"
      textoEnCurso="Guardando…"
      etiquetaCupo="Cupo disponible"
    />
  );
}
