import { Pressable, StyleSheet, Text, View } from "react-native";

import { ErrorDeApi } from "../../../api";
import { Boton, tema } from "../../../componentes";
import { useCategorias } from "../../categorias";
import { estilosDeCampo } from "./CampoDeTexto";
import { MensajeDeCampo } from "./MensajeDeCampo";

/**
 * Dos modos: el de los formularios (una categoría obligatoria) y el de Explorar (`conTodas`), con
 * "Todas" primero (`null`).
 */
export type PropsSelectorCategoria =
  | { conTodas?: false; valor: string | null; alCambiar: (categoriaId: string) => void; error?: string }
  | { conTodas: true; valor: string | null; alCambiar: (categoriaId: string | null) => void; error?: string };

/** Categoría como grupo de opciones (sin biblioteca de picker; R16), con sus propios estados. */
export function SelectorCategoria(props: PropsSelectorCategoria) {
  const { valor, error } = props;
  const consulta = useCategorias();
  // "Todas" (null) solo en el modo de Explorar; en los formularios siempre se elige una categoría.
  const opciones: { id: string | null; nombre: string }[] = [
    ...(props.conTodas ? [{ id: null, nombre: "Todas" }] : []),
    ...(consulta.data ?? []),
  ];
  const elegir = (id: string | null) => {
    if (props.conTodas) props.alCambiar(id);
    else if (id !== null) props.alCambiar(id);
  };
  return (
    <View style={estilos.contenedor}>
      <Text style={estilosDeCampo.etiqueta}>Categoría</Text>
      {consulta.isPending ? (
        <Text style={estilosDeCampo.nota}>Cargando categorías…</Text>
      ) : consulta.isError ? (
        <View style={estilos.error}>
          <Text style={estilos.textoError}>
            {consulta.error instanceof ErrorDeApi
              ? consulta.error.mensaje
              : "No se pudieron cargar las categorías."}
          </Text>
          <Boton
            variante="aviso"
            texto="Reintentar"
            textoEnCurso="Reintentando…"
            enCurso={consulta.isFetching}
            alPresionar={() => void consulta.refetch()}
          />
        </View>
      ) : (
        <View accessibilityRole="radiogroup" accessibilityLabel="Categoría" style={estilos.opciones}>
          {opciones.map((categoria) => {
            const elegida = categoria.id === valor;
            return (
              <Pressable
                key={categoria.id ?? "todas"}
                accessibilityRole="radio"
                accessibilityLabel={categoria.nombre}
                accessibilityState={{ checked: elegida }}
                onPress={() => elegir(categoria.id)}
                style={({ pressed }) => [
                  estilos.opcion,
                  pressed && estilos.presionada,
                  elegida && estilos.elegida,
                ]}
              >
                <Text style={[estilos.textoOpcion, elegida && estilos.textoElegida]}>{categoria.nombre}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <MensajeDeCampo mensaje={error} />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: tema.espacio.chico },
  opciones: { flexDirection: "row", flexWrap: "wrap", gap: tema.espacio.chico },
  opcion: {
    minHeight: tema.tamano.chip,
    justifyContent: "center",
    paddingHorizontal: tema.espacio.medio,
    borderRadius: tema.radio.pildora,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.superficie,
  },
  elegida: { backgroundColor: tema.colores.primario },
  presionada: { backgroundColor: tema.colores.neutro },
  textoOpcion: { ...tema.tipografia.botonChico, color: tema.colores.texto },
  textoElegida: { color: tema.colores.sobrePrimario },
  error: { gap: tema.espacio.chico, alignItems: "flex-start" },
  textoError: { ...tema.tipografia.mensaje, color: tema.colores.texto },
});
