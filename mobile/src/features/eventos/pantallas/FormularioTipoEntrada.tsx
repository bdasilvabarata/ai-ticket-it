import type { TipoEntradaVista } from "@ai-ticket-it/shared";
import type { UseMutationResult } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet } from "react-native";

import type { CuerpoTipoEntrada } from "../../../api";
import { Boton, tema } from "../../../componentes";
import { AvisoDeFormulario } from "../componentes/AvisoDeFormulario";
import { CamposTipoEntrada } from "../componentes/CamposTipoEntrada";
import {
  erroresDeFormulario,
  esEventoRealizado,
  esNoEncontrado,
  SIN_ERRORES,
  type ErroresDeFormulario,
} from "../errores-de-formulario";
import { aCuerpoTipo, type ValoresTipoEntrada } from "../formulario";
import { useConfirmarDescarte } from "../useConfirmarDescarte";

export interface PropsFormularioTipoEntrada {
  inicial: ValoresTipoEntrada;
  mutacion: UseMutationResult<TipoEntradaVista, Error, CuerpoTipoEntrada>;
  textoBoton: string;
  textoEnCurso: string;
  etiquetaCupo?: string;
}

/**
 * Formulario de un tipo de entrada, para agregar y para editar (contracts/app.md). Con éxito vuelve a
 * Editar evento; un `EVENTO_REALIZADO` vuelve a la ruta del evento, que pasa a solo lectura, y un
 * 404 del tipo o del evento avisa y vuelve a Mis eventos (R15).
 */
export function FormularioTipoEntrada({
  inicial,
  mutacion,
  textoBoton,
  textoEnCurso,
  etiquetaCupo,
}: PropsFormularioTipoEntrada) {
  const [valores, setValores] = useState(inicial);
  const [errores, setErrores] = useState<ErroresDeFormulario>(SIN_ERRORES);
  const { salirSinConfirmar } = useConfirmarDescarte();

  function guardar() {
    setErrores(SIN_ERRORES);
    mutacion.mutate(aCuerpoTipo(valores), {
      onSuccess: () => salirSinConfirmar(() => router.back()),
      onError: (error) => {
        if (esNoEncontrado(error)) {
          Alert.alert(error.mensaje);
          salirSinConfirmar(() => router.dismissTo("/mis-eventos"));
        } else if (esEventoRealizado(error)) {
          salirSinConfirmar(() => router.back());
        } else {
          setErrores(erroresDeFormulario(error, "tipo"));
        }
      },
    });
  }

  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido}>
      <CamposTipoEntrada
        valores={valores}
        alCambiar={(cambios) => setValores((actuales) => ({ ...actuales, ...cambios }))}
        errores={errores.campos}
        etiquetaCupo={etiquetaCupo}
      />
      <AvisoDeFormulario mensaje={errores.mensajeGeneral} />
      <Boton
        texto={textoBoton}
        textoEnCurso={textoEnCurso}
        enCurso={mutacion.isPending}
        alPresionar={guardar}
      />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.colores.fondo },
  contenido: { padding: tema.espacio.normal, gap: tema.espacio.amplio },
});
