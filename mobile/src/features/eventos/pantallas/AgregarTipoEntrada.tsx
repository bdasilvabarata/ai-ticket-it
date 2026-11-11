import { useLocalSearchParams } from "expo-router";

import { useSesion } from "../../sesion";
import { VALORES_TIPO_VACIO } from "../formulario";
import { useAgregarTipoEntrada } from "../mutaciones";
import { FormularioTipoEntrada } from "./FormularioTipoEntrada";

/** Agregar un tipo de entrada a un evento (US3). El cupo inicial es ≥ 1 (lo valida el servidor). */
export function AgregarTipoEntrada() {
  const { eventoId } = useLocalSearchParams<{ eventoId: string }>();
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null; // el guard ya no muestra esta ruta
  return <Formulario usuarioId={estado.usuarioId} eventoId={eventoId} />;
}

function Formulario({ usuarioId, eventoId }: { usuarioId: string; eventoId: string }) {
  const agregar = useAgregarTipoEntrada(usuarioId, eventoId);
  return (
    <FormularioTipoEntrada
      inicial={VALORES_TIPO_VACIO}
      mutacion={agregar}
      textoBoton="Agregar tipo de entrada"
      textoEnCurso="Agregando…"
    />
  );
}
