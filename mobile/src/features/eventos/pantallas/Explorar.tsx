import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";

import { ListaVacia, SegunConsulta, tema } from "../../../componentes";
import { TarjetaEvento } from "../componentes/TarjetaEvento";
import { TarjetaSkeleton } from "../componentes/TarjetaSkeleton";
import { useCatalogo } from "../useCatalogo";

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

/** Explorar: el catálogo de eventos próximos (contracts/app.md, "Explorar"). */
export function Explorar() {
  const consulta = useCatalogo({ texto: "", categoriaId: null, orden: "fecha" });
  return (
    <View style={estilos.pantalla}>
      {/* Los controles de búsqueda, fuera de los estados: no se desmontan (US3 y US4). */}
      <View />
      <SegunConsulta
        consulta={consulta}
        cargando={<CargandoEventos />}
        esVacio={(catalogo) => catalogo === undefined || catalogo.eventos.length === 0}
        vacio={<ListaVacia mensaje="Todavía no hay eventos próximos." icono="calendar-outline" />}
      >
        {(catalogo) => (
          <FlatList
            data={catalogo.eventos}
            keyExtractor={(evento) => evento.id}
            contentContainerStyle={estilos.lista}
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
  lista: { padding: tema.espacio.normal, paddingBottom: tema.espacio.amplio, gap: tema.espacio.medio },
});
