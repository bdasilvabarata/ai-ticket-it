import type { TipoEntradaVista } from "@ai-ticket-it/shared";
import { StyleSheet, Text, View } from "react-native";

import { Boton, tema } from "../../../componentes";
import { textoCupo, textoPrecio } from "../formato";

export interface PropsListaTiposEntrada {
  tipos: readonly TipoEntradaVista[];
  /** Sin acciones, la lista es de solo lectura (evento realizado). */
  acciones?: {
    alEditar: (tipo: TipoEntradaVista) => void;
    alQuitar: (tipo: TipoEntradaVista) => void;
    alAgregar: () => void;
    /** Mientras se quita un tipo, las acciones quedan deshabilitadas. */
    ocupada: boolean;
  };
}

/** Los tipos de entrada de un evento, con precio y cupo disponible. */
export function ListaTiposEntrada({ tipos, acciones }: PropsListaTiposEntrada) {
  return (
    <View style={estilos.lista}>
      {tipos.map((tipo) => (
        <View key={tipo.id} style={estilos.fila}>
          <View style={estilos.textos}>
            <Text style={estilos.nombre}>{tipo.nombre}</Text>
            {tipo.descripcion ? <Text style={estilos.detalle}>{tipo.descripcion}</Text> : null}
            <Text style={estilos.detalle}>{`${textoPrecio(tipo.precio)} · ${textoCupo(tipo.cupo)}`}</Text>
          </View>
          {acciones ? (
            <View style={estilos.botones}>
              <Boton
                variante="texto"
                texto="Editar"
                accessibilityLabel={`Editar ${tipo.nombre}`}
                deshabilitado={acciones.ocupada}
                alPresionar={() => acciones.alEditar(tipo)}
              />
              <Boton
                variante="texto"
                texto="Quitar"
                accessibilityLabel={`Quitar ${tipo.nombre}`}
                deshabilitado={acciones.ocupada}
                alPresionar={() => acciones.alQuitar(tipo)}
              />
            </View>
          ) : null}
        </View>
      ))}
      {acciones ? (
        <View style={estilos.agregar}>
          <Boton variante="aviso" texto="Agregar tipo de entrada" alPresionar={acciones.alAgregar} />
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: tema.espacio.chico },
  fila: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: tema.espacio.chico,
    paddingVertical: tema.espacio.chico,
    borderBottomWidth: tema.grosor.fino,
    borderBottomColor: tema.colores.borde,
  },
  textos: { flex: 1, gap: tema.espacio.minimo },
  nombre: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.texto },
  detalle: { ...tema.tipografia.secundario, color: tema.colores.textoSecundario },
  botones: { flexDirection: "row", gap: tema.espacio.minimo },
  agregar: { alignItems: "flex-start", marginTop: tema.espacio.chico },
});
