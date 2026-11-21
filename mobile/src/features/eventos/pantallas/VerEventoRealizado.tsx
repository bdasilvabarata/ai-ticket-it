import type { EventoVista } from "@ai-ticket-it/shared";
import { StyleSheet, Text, View } from "react-native";

import { PantallaDesplazable, tema } from "../../../componentes";
import { AvisoDeFormulario } from "../componentes/AvisoDeFormulario";
import { ListaTiposEntrada } from "../componentes/ListaTiposEntrada";
import { MarcaRealizado } from "../componentes/MarcaRealizado";
import { textoFechaHora } from "../formato";

/**
 * Un evento realizado, en solo lectura (FR-006a): sin acciones de edición y sin confirmar al salir.
 * "Ver compras" está en el hub del evento.
 */
export function VerEventoRealizado({ evento, aviso }: { evento: EventoVista; aviso: string | null }) {
  return (
    <PantallaDesplazable separacion={tema.espacio.normal}>
      <AvisoDeFormulario mensaje={aviso} />
      <MarcaRealizado />
      <Text style={estilos.nombre} accessibilityRole="header">
        {evento.nombre}
      </Text>
      <View style={estilos.datos}>
        <Text style={estilos.dato}>{evento.categoria.nombre}</Text>
        <Text style={estilos.dato}>{textoFechaHora(evento.fechaHoraLocal)}</Text>
      </View>
      {evento.descripcion ? <Text style={estilos.descripcion}>{evento.descripcion}</Text> : null}
      {evento.multimedia.length > 0 ? (
        <View style={estilos.datos}>
          <Text style={estilos.titulo} accessibilityRole="header">
            Imágenes
          </Text>
          {evento.multimedia.map((url) => (
            <Text key={url} style={estilos.dato}>
              {url}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={estilos.datos}>
        <Text style={estilos.titulo} accessibilityRole="header">
          Tipos de entrada
        </Text>
        <ListaTiposEntrada tipos={evento.tiposEntrada} />
      </View>
    </PantallaDesplazable>
  );
}

const estilos = StyleSheet.create({
  nombre: { ...tema.tipografia.titulo, color: tema.colores.texto },
  datos: { gap: tema.espacio.minimo },
  dato: { ...tema.tipografia.cuerpo, color: tema.colores.textoSecundario },
  descripcion: { ...tema.tipografia.cuerpo, color: tema.colores.texto },
  titulo: { ...tema.tipografia.subtitulo, color: tema.colores.texto },
});
