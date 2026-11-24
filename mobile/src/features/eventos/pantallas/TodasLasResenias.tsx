import type { PaginaDeReseniasVista } from "@ai-ticket-it/shared";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Paginador, PantallaDesplazable, SegunConsulta, tema, usePagina } from "../../../componentes";
import { useSesion } from "../../sesion";
import { nombreCompleto } from "../../usuarios";
import { FilaResenia } from "../componentes/FilaResenia";
import { SIN_RESENIAS, textoPuntaje } from "../formato";
import { usePaginaDeResenias } from "../usePaginaDeResenias";

/**
 * "Reseñas del organizador" (feature 013, US5, contracts/app.md): pública, se llega desde "Ver todas
 * las reseñas" del detalle. El organizador del evento con el puntaje y la cantidad de todas sus
 * reseñas, de a 10 en el orden del servidor, con el paginador común. Al cambiar de página vuelve
 * arriba; el puntaje no cambia (es el de todas).
 */
export function TodasLasResenias() {
  const { eventoId } = useLocalSearchParams<{ eventoId: string }>();
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null; // el guard ya no muestra esta ruta
  return <ReseniasPorPaginas usuarioId={estado.usuarioId} eventoId={eventoId} />;
}

function ReseniasPorPaginas({ usuarioId, eventoId }: { usuarioId: string; eventoId: string }) {
  const [pagina, cambiarPagina] = usePagina(eventoId);
  const consulta = usePaginaDeResenias(usuarioId, eventoId, pagina);
  return (
    <PantallaDesplazable separacion={tema.espacio.normal} volverArribaCon={pagina}>
      <SegunConsulta
        consulta={consulta}
        cargando={<Text style={estilos.aviso}>Cargando reseñas…</Text>}
        esVacio={(vista: PaginaDeReseniasVista | undefined) => vista?.resenias.length === 0}
        vacio={<Text style={estilos.aviso}>{SIN_RESENIAS}</Text>}
      >
        {(vista) => (
          <View style={estilos.lista}>
            <Text style={estilos.nombre} accessibilityRole="header">
              {nombreCompleto(vista.organizador)}
            </Text>
            <Text style={estilos.puntaje}>{textoPuntaje(vista.organizador)}</Text>
            {vista.resenias.map((resenia) => (
              <FilaResenia key={resenia.id} resenia={resenia} />
            ))}
            <Paginador pagina={vista.pagina} alCambiar={cambiarPagina} />
          </View>
        )}
      </SegunConsulta>
    </PantallaDesplazable>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: tema.espacio.minimo },
  nombre: { ...tema.tipografia.subtitulo, color: tema.colores.texto },
  puntaje: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.texto },
  aviso: { ...tema.tipografia.cuerpo, color: tema.colores.textoSecundario },
});
