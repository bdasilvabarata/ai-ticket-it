import { LIMITES_EVENTO } from "@ai-ticket-it/shared";
import { StyleSheet, Text, View } from "react-native";

import { Boton, tema } from "../../../componentes";
import type { ValoresEvento } from "../formulario";
import { CampoDeTexto, estilosDeCampo } from "./CampoDeTexto";
import { MensajeDeCampo } from "./MensajeDeCampo";
import { SelectorCategoria } from "./SelectorCategoria";
import { SelectorFechaHora } from "./SelectorFechaHora";

export interface PropsCamposEvento {
  valores: ValoresEvento;
  alCambiar: (cambios: Partial<ValoresEvento>) => void;
  /** Errores por campo (`nombre`, `multimedia.0`…), de `erroresDeFormulario`. */
  errores: Record<string, string>;
}

/** Los datos de un evento: nombre, descripción, categoría, fecha y hora, e imágenes. */
export function CamposEvento({ valores, alCambiar, errores }: PropsCamposEvento) {
  const { multimedia } = valores;
  const conMaximo = multimedia.length >= LIMITES_EVENTO.multimedia;
  const cambiarImagen = (indice: number, url: string) =>
    alCambiar({ multimedia: multimedia.map((actual, i) => (i === indice ? url : actual)) });

  return (
    <View style={estilos.campos}>
      <CampoDeTexto
        etiqueta="Nombre"
        accessibilityLabel="Nombre del evento"
        valor={valores.nombre}
        alCambiar={(nombre) => alCambiar({ nombre })}
        maxLength={LIMITES_EVENTO.nombre}
        error={errores.nombre}
      />
      <CampoDeTexto
        etiqueta="Descripción (opcional)"
        accessibilityLabel="Descripción del evento"
        valor={valores.descripcion}
        alCambiar={(descripcion) => alCambiar({ descripcion })}
        maxLength={LIMITES_EVENTO.descripcion}
        multiline
        error={errores.descripcion}
      />
      <SelectorCategoria
        valor={valores.categoriaId}
        alCambiar={(categoriaId) => alCambiar({ categoriaId })}
        error={errores.categoriaId}
      />
      <SelectorFechaHora
        valor={valores.fechaHoraLocal}
        alCambiar={(fechaHoraLocal) => alCambiar({ fechaHoraLocal })}
        error={errores.fechaHora}
      />
      <View style={estilos.imagenes}>
        <Text style={estilosDeCampo.etiqueta}>Imágenes (opcional)</Text>
        {multimedia.map((url, i) => (
          // El índice es la identidad de la fila: el servidor informa los errores por índice.
          <View key={i} style={estilos.imagen}>
            <View style={estilos.url}>
              <CampoDeTexto
                etiqueta={`URL de la imagen ${i + 1}`}
                valor={url}
                alCambiar={(nueva) => cambiarImagen(i, nueva)}
                keyboardType="url"
                autoCapitalize="none"
                error={errores[`multimedia.${i}`]}
              />
            </View>
            <Boton
              variante="texto"
              texto="Quitar"
              accessibilityLabel={`Quitar imagen ${i + 1}`}
              alPresionar={() => alCambiar({ multimedia: multimedia.filter((_, j) => j !== i) })}
            />
          </View>
        ))}
        <MensajeDeCampo mensaje={errores.multimedia} />
        <View style={estilos.agregar}>
          <Boton
            variante="aviso"
            texto="Agregar imagen"
            deshabilitado={conMaximo}
            alPresionar={() => alCambiar({ multimedia: [...multimedia, ""] })}
          />
          {conMaximo ? <Text style={estilosDeCampo.nota}>Máximo 5 imágenes</Text> : null}
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  campos: { gap: tema.espacio.normal },
  imagenes: { gap: tema.espacio.chico },
  imagen: { flexDirection: "row", alignItems: "center", gap: tema.espacio.chico },
  url: { flex: 1 },
  agregar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: tema.espacio.medio },
});
