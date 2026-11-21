import type { EntradaDelEventoVista } from "@ai-ticket-it/shared";
import type { UseQueryResult } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";

import { ErrorDeApi } from "../../../api";
import { Boton, SegunConsulta, tema } from "../../../componentes";
import { textoMotivoNoUsable } from "../formato";
import { TarjetaEntrada } from "./TarjetaEntrada";

export interface PropsResultadoDeIngreso {
  consulta: UseQueryResult<EntradaDelEventoVista>;
  enCurso: boolean;
  alRegistrar: (entrada: EntradaDelEventoVista) => void;
}

const NO_ENCONTRADA = "ENTRADA_NO_ENCONTRADA";
const MENSAJE_NO_ENCONTRADA = "No hay ninguna entrada con ese código en este evento.";

/**
 * Lo que se ve en "Registrar ingreso" después de buscar un código (feature 010, R8): un código que
 * no es de este evento se informa en el lugar del resultado; si no, los cuatro estados de la consulta
 * con la entrada encontrada y su acción.
 */
export function ResultadoDeIngreso({ consulta, enCurso, alRegistrar }: PropsResultadoDeIngreso) {
  if (consulta.error instanceof ErrorDeApi && consulta.error.codigo === NO_ENCONTRADA) {
    return (
      <Text style={estilos.error} accessibilityLiveRegion="polite">
        {MENSAJE_NO_ENCONTRADA}
      </Text>
    );
  }
  return (
    <SegunConsulta consulta={consulta} mensajeVacio={MENSAJE_NO_ENCONTRADA}>
      {(entrada) => (
        <View style={estilos.resultado}>
          <TarjetaEntrada entrada={entrada} />
          <AccionDeIngreso entrada={entrada} enCurso={enCurso} alRegistrar={alRegistrar} />
        </View>
      )}
    </SegunConsulta>
  );
}

/** "Registrar ingreso" si la entrada se puede usar; si no, el motivo en su lugar (FR-019). */
function AccionDeIngreso({
  entrada,
  enCurso,
  alRegistrar,
}: {
  entrada: EntradaDelEventoVista;
  enCurso: boolean;
  alRegistrar: (entrada: EntradaDelEventoVista) => void;
}) {
  const motivo = textoMotivoNoUsable(entrada);
  if (motivo !== null) {
    return (
      <Text style={estilos.motivo} accessibilityLiveRegion="polite">
        {motivo}
      </Text>
    );
  }
  return (
    <Boton
      texto="Registrar ingreso"
      textoEnCurso="Registrando…"
      enCurso={enCurso}
      alPresionar={() => alRegistrar(entrada)}
    />
  );
}

const estilos = StyleSheet.create({
  resultado: { gap: tema.espacio.normal },
  motivo: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.texto },
  error: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.error },
});
