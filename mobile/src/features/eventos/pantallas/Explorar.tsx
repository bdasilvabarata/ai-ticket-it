import { LIMITES_BUSQUEDA, type OrdenCatalogo, type SentidoCatalogo } from "@ai-ticket-it/shared";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, StyleSheet, TextInput, View } from "react-native";

import { ListaVacia, SegunConsulta, tema } from "../../../componentes";
import { BotonCategoria } from "../componentes/BotonCategoria";
import { SelectorCategoria } from "../componentes/SelectorCategoria";
import { SelectorOrden } from "../componentes/SelectorOrden";
import { TarjetaEvento } from "../componentes/TarjetaEvento";
import { TarjetaSkeleton } from "../componentes/TarjetaSkeleton";
import { useCatalogo } from "../useCatalogo";
import { useValorDemorado } from "../useValorDemorado";

/** La lista se actualiza este tiempo después de la última tecla (FR-014). */
const DEMORA_DEL_BUSCADOR_MS = 500;

/** El mismo detalle público para cualquier evento, también uno propio. */
const abrirDetalle = (eventoId: string) =>
  router.push({ pathname: "/explorar/[eventoId]", params: { eventoId } });

/** Tres tarjetas de relleno, anunciadas una sola vez. */
function CargandoEventos() {
  return (
    <View
      accessible
      accessibilityLabel="Cargando eventos"
      accessibilityLiveRegion="polite"
      style={estilos.lista}
    >
      <TarjetaSkeleton />
      <TarjetaSkeleton />
      <TarjetaSkeleton />
    </View>
  );
}

/**
 * Explorar: el catálogo de eventos próximos (contracts/app.md, "Explorar"). La consulta (texto,
 * categoría, orden y sentido) vive acá: la pestaña no se desmonta al apilar el detalle, así que se
 * conserva (FR-024). La categoría es un desplegable a la derecha del buscador: cerrado no ocupa lugar.
 */
export function Explorar() {
  const [texto, setTexto] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [categoriasAbiertas, setCategoriasAbiertas] = useState(false);
  const [{ orden, sentido }, setOrden] = useState<{ orden: OrdenCatalogo; sentido: SentidoCatalogo }>({
    orden: "fecha",
    sentido: "asc",
  });
  const textoDemorado = useValorDemorado(texto.trim(), DEMORA_DEL_BUSCADOR_MS);
  const consulta = useCatalogo({ texto: textoDemorado, categoriaId, orden, sentido });
  // Desde la primera tecla hasta que llega la respuesta del texto nuevo, el skeleton: nunca quedan a
  // la vista los resultados del texto anterior (FR-007).
  const escribiendo = texto.trim() !== textoDemorado;

  // Elegir una categoría cierra el desplegable.
  const elegirCategoria = (id: string | null) => {
    setCategoriaId(id);
    setCategoriasAbiertas(false);
  };

  // El orden queda: no es parte de la búsqueda.
  const limpiarBusqueda = () => {
    setTexto("");
    setCategoriaId(null);
  };

  return (
    <View style={estilos.pantalla}>
      {/* Los controles, fuera de los estados: no se desmontan ni pierden lo escrito. */}
      <View style={estilos.controles}>
        <View style={estilos.filaBuscador}>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder="Buscar por nombre o descripción"
            placeholderTextColor={tema.colores.textoSecundario}
            accessibilityLabel="Buscar eventos"
            maxLength={LIMITES_BUSQUEDA.texto}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
            style={estilos.buscador}
          />
          <BotonCategoria
            categoriaId={categoriaId}
            abierto={categoriasAbiertas}
            alPresionar={() => setCategoriasAbiertas((abiertas) => !abiertas)}
          />
        </View>
        {categoriasAbiertas && (
          <View style={estilos.desplegable}>
            <SelectorCategoria conTodas valor={categoriaId} alCambiar={elegirCategoria} />
          </View>
        )}
        <SelectorOrden
          orden={orden}
          sentido={sentido}
          alCambiar={(nuevoOrden, nuevoSentido) => setOrden({ orden: nuevoOrden, sentido: nuevoSentido })}
        />
      </View>
      <SegunConsulta
        consulta={{ ...consulta, isPending: consulta.isPending || escribiendo }}
        cargando={<CargandoEventos />}
        esVacio={(catalogo) => catalogo === undefined || catalogo.eventos.length === 0}
        vacio={
          consulta.data?.hayEventosProximos ? (
            <ListaVacia
              mensaje="Ningún evento coincide con tu búsqueda."
              icono="search-outline"
              accion={{ texto: "Limpiar búsqueda", alPresionar: limpiarBusqueda }}
            />
          ) : (
            <ListaVacia mensaje="Todavía no hay eventos próximos." icono="calendar-outline" />
          )
        }
      >
        {(catalogo) => (
          <FlatList
            data={catalogo.eventos}
            keyExtractor={(evento) => evento.id}
            contentContainerStyle={estilos.lista}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TarjetaEvento evento={item} alPresionar={() => abrirDetalle(item.id)} />
            )}
          />
        )}
      </SegunConsulta>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.colores.fondo },
  controles: {
    gap: tema.espacio.chico,
    paddingHorizontal: tema.espacio.normal,
    paddingTop: tema.espacio.minimo,
  },
  filaBuscador: { flexDirection: "row", gap: tema.espacio.chico },
  desplegable: {
    padding: tema.espacio.medio,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    borderRadius: tema.radio.normal,
    backgroundColor: tema.colores.superficie,
    boxShadow: tema.sombra.nivel1,
  },
  buscador: {
    flex: 1,
    ...tema.tipografia.cuerpo,
    minHeight: tema.tamano.campo,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    borderRadius: tema.radio.normal,
    paddingVertical: tema.espacio.chico,
    paddingHorizontal: tema.espacio.medio,
    color: tema.colores.texto,
    backgroundColor: tema.colores.superficie,
  },
  lista: {
    paddingHorizontal: tema.espacio.normal,
    paddingTop: tema.espacio.medio,
    paddingBottom: tema.espacio.amplio,
    gap: tema.espacio.medio,
  },
});
