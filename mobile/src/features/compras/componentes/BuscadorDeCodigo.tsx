import type { ComponentRef, RefObject } from "react";
import type { TextInput } from "react-native";

import { Boton } from "../../../componentes";
import { CampoDeTexto } from "../../eventos";
import { normalizarCodigo } from "../formato";

export interface PropsBuscadorDeCodigo {
  texto: string;
  alCambiar: (texto: string) => void;
  alBuscar: () => void;
  refCampo: RefObject<ComponentRef<typeof TextInput> | null>;
}

/**
 * El campo "Código de la entrada" de "Registrar ingreso" y su "Buscar", deshabilitado mientras el
 * código normalizado está vacío (feature 010, R8). El estado y el foco los maneja la pantalla.
 */
export function BuscadorDeCodigo({ texto, alCambiar, alBuscar, refCampo }: PropsBuscadorDeCodigo) {
  return (
    <>
      <CampoDeTexto
        ref={refCampo}
        etiqueta="Código de la entrada"
        valor={texto}
        alCambiar={alCambiar}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={32}
      />
      <Boton texto="Buscar" deshabilitado={normalizarCodigo(texto) === ""} alPresionar={alBuscar} />
    </>
  );
}
