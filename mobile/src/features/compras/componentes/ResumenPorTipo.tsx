import type { ResumenTipoEntradaVista } from "@ai-ticket-it/shared";
import { StyleSheet, Text, View } from "react-native";

import { tema } from "../../../componentes";
import { textoResumenDeTipo } from "../formato";

export interface PropsResumenPorTipo {
  resumen: readonly ResumenTipoEntradaVista[];
}

/**
 * "Disponibilidad por tipo" de "Compras del evento" (feature 008, US2; contracts/app.md): por tipo,
 * en el orden que llega del servidor, su nombre y sus números al día; con 0 disponibles, la marca
 * "Agotado" en texto (FR-008). Cada tipo es un solo elemento accesible.
 */
export function ResumenPorTipo({ resumen }: PropsResumenPorTipo) {
  return (
    <View style={estilos.seccion}>
      <Text style={estilos.titulo} accessibilityRole="header">
        Disponibilidad por tipo
      </Text>
      {resumen.map((tipo) => {
        const numeros = textoResumenDeTipo(tipo);
        const agotado = tipo.disponibles === 0;
        const nombre = tipo.tipoEntrada.nombre;
        return (
          <View
            key={tipo.tipoEntrada.id}
            accessible
            accessibilityLabel={`${nombre}${agotado ? ", Agotado" : ""}: ${numeros}`}
            style={estilos.tipo}
          >
            <View style={estilos.encabezado}>
              <Text style={estilos.nombre}>{nombre}</Text>
              {agotado && (
                <View style={estilos.badge}>
                  <Text style={estilos.textoBadge}>Agotado</Text>
                </View>
              )}
            </View>
            <Text style={estilos.numeros}>{numeros}</Text>
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { gap: tema.espacio.medio },
  titulo: { ...tema.tipografia.subtitulo, color: tema.colores.texto },
  tipo: {
    gap: tema.espacio.minimo,
    padding: tema.espacio.normal,
    borderRadius: tema.radio.tarjeta,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.superficie,
  },
  // El nombre largo se parte antes que empujar la marca afuera; la marca baja de renglón si no entra.
  encabezado: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: tema.espacio.chico },
  nombre: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.texto, flexShrink: 1 },
  numeros: { ...tema.tipografia.secundario, color: tema.colores.textoSecundario, flexShrink: 1 },
  badge: {
    justifyContent: "center",
    height: tema.tamano.badge,
    paddingHorizontal: tema.espacio.chico,
    borderRadius: tema.radio.pildora,
    borderWidth: tema.grosor.fino,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.neutro,
  },
  textoBadge: { ...tema.tipografia.badge, color: tema.colores.sobreNeutro },
});
