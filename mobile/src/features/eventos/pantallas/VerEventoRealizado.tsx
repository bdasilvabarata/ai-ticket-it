import type { EventoVista } from "@ai-ticket-it/shared";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { tema } from "../../../componentes";
import { AvisoDeFormulario } from "../componentes/AvisoDeFormulario";
import { ListaTiposEntrada } from "../componentes/ListaTiposEntrada";
import { MarcaRealizado } from "../componentes/MarcaRealizado";
import { textoFechaHora } from "../formato";

/** Un evento realizado, en solo lectura (FR-006a): sin acciones y sin confirmar al salir. */
export function VerEventoRealizado({ evento, aviso }: { evento: EventoVista; aviso: string | null }) {
  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido}>
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
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.colores.fondo },
  contenido: { padding: tema.espacio.normal, gap: tema.espacio.normal },
  nombre: { fontSize: tema.texto.titulo, fontWeight: tema.peso.fuerte, color: tema.colores.texto },
  datos: { gap: tema.espacio.minimo },
  dato: { fontSize: tema.texto.normal, color: tema.colores.textoSecundario },
  descripcion: { fontSize: tema.texto.normal, color: tema.colores.texto },
  titulo: { fontSize: tema.texto.subtitulo, fontWeight: tema.peso.fuerte, color: tema.colores.texto },
});
