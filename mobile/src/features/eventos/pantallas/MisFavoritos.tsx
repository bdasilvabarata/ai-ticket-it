import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import {
  ListaVacia,
  PantallaDesplazable,
  SegunConsulta,
  tema,
  useRefrescarAlFocalizar,
} from "../../../componentes";
import { TarjetaEvento } from "../componentes/TarjetaEvento";
import { useFavoritos } from "../useFavoritos";

const irAExplorar = () => router.navigate("/");

const abrirDetalle = (eventoId: string) =>
  router.push({ pathname: "/explorar/[eventoId]", params: { eventoId } });

/**
 * "Mis favoritos" (feature 014, US2): los favoritos del usuario actual con la tarjeta del catálogo,
 * en el orden del servidor (primero los próximos, después los realizados). Se vuelve a pedir en cada
 * foco salvo el primero, así desmarcar en el detalle y volver muestra la lista nueva (US2-5).
 */
export function MisFavoritos() {
  const consulta = useFavoritos();
  useRefrescarAlFocalizar(consulta.refetch);

  return (
    <View style={estilos.pantalla}>
      <SegunConsulta
        consulta={consulta}
        vacio={
          <ListaVacia
            mensaje="Todavía no tenés favoritos"
            icono="star-outline"
            accion={{ texto: "Ir a Explorar", alPresionar: irAExplorar }}
          />
        }
      >
        {(favoritos) => (
          <PantallaDesplazable separacion={tema.espacio.medio}>
            {favoritos.map((evento) => (
              <TarjetaEvento
                key={evento.id}
                evento={evento}
                esFavorito
                alPresionar={() => abrirDetalle(evento.id)}
              />
            ))}
          </PantallaDesplazable>
        )}
      </SegunConsulta>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.colores.fondo },
});
