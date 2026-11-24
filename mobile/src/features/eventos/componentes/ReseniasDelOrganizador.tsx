import { LIMITES_PAGINACION, type ReseniasDelOrganizadorVista } from "@ai-ticket-it/shared";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Boton, SegunConsulta, tema } from "../../../componentes";
import { SIN_RESENIAS, textoPuntaje } from "../formato";
import { useReseniasDelOrganizador } from "../useReseniasDelOrganizador";
import { FilaResenia } from "./FilaResenia";

/**
 * La sección "Reseñas del organizador" al final del detalle (feature 012, contracts/app.md): el
 * puntaje (el mismo texto de la tarjeta) y, desde la 013, las 3 reseñas más recientes del resumen,
 * en el orden del servidor, con "Ver todas las reseñas" si tiene más (FR-022). Tiene sus propios
 * estados: cargando y error quedan en la sección, sin tapar el detalle.
 */
export function ReseniasDelOrganizador({ usuarioId, eventoId }: { usuarioId: string; eventoId: string }) {
  const consulta = useReseniasDelOrganizador(usuarioId, eventoId);
  return (
    <View style={estilos.seccion}>
      <Text style={estilos.titulo} accessibilityRole="header">
        Reseñas del organizador
      </Text>
      <SegunConsulta
        consulta={consulta}
        cargando={<Text style={estilos.aviso}>Cargando reseñas…</Text>}
        esVacio={(vista: ReseniasDelOrganizadorVista | undefined) => vista?.resenias.length === 0}
        vacio={<Text style={estilos.aviso}>{SIN_RESENIAS}</Text>}
      >
        {(vista) => (
          <View style={estilos.lista}>
            <Text style={estilos.puntaje}>{textoPuntaje(vista.organizador)}</Text>
            {vista.resenias.map((resenia) => (
              <FilaResenia key={resenia.id} resenia={resenia} />
            ))}
            {vista.organizador.cantidadResenias > LIMITES_PAGINACION.reseniasEnElDetalle ? (
              <Boton
                texto="Ver todas las reseñas"
                variante="texto"
                alPresionar={() =>
                  router.push({ pathname: "/explorar/[eventoId]/resenias", params: { eventoId } })
                }
              />
            ) : null}
          </View>
        )}
      </SegunConsulta>
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { gap: tema.espacio.minimo },
  titulo: { ...tema.tipografia.subtitulo, color: tema.colores.texto },
  lista: { gap: tema.espacio.minimo },
  puntaje: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.texto },
  aviso: { ...tema.tipografia.cuerpo, color: tema.colores.textoSecundario },
});
