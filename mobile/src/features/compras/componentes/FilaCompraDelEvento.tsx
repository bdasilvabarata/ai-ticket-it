import type { CompraDelEventoVista } from "@ai-ticket-it/shared";
import { StyleSheet, Text, View } from "react-native";

import { Boton, EtiquetaEstadoCompra, tema, textoEtiquetaEstado } from "../../../componentes";
import { AvisoDeFormulario } from "../../eventos";
import { textoAvisoDeCompraDelEvento, textoCantidad, textoCompradaEl, textoTotal } from "../formato";

export interface PropsFilaCompraDelEvento {
  compra: CompraDelEventoVista;
  /** Abre la confirmación del reembolso (feature 009); solo se usa si el reembolso está pendiente. */
  alConfirmarReembolso?: (compra: CompraDelEventoVista) => void;
  /** El reembolso de esta fila está en curso. */
  enCurso?: boolean;
  /** El error del último intento de confirmar el reembolso de esta fila, o `null`. */
  error?: string | null;
}

/**
 * Una compra de "Compras del evento" (contracts/app.md): comprador, tipo · cantidad · total, fecha
 * de compra, estado y su aviso. No es tocable (no abre "Tu compra") ni tiene acción de uso (FR-017):
 * un solo elemento accesible que resume la fila. Con el reembolso pendiente (feature 009), debajo y
 * como hermano de ese bloque, "Confirmar reembolso" y el error de esa fila.
 */
export function FilaCompraDelEvento({
  compra,
  alConfirmarReembolso,
  enCurso = false,
  error = null,
}: PropsFilaCompraDelEvento) {
  const comprador = `${compra.comprador.nombre} ${compra.comprador.apellido}`;
  const tipo = compra.tipoEntrada.nombre;
  const cantidad = textoCantidad(compra.cantidad);
  const total = textoTotal(compra.total);
  const aviso = textoAvisoDeCompraDelEvento(compra);
  const etiqueta = [comprador, tipo, cantidad, total, textoEtiquetaEstado(compra.estado), aviso]
    .filter((parte) => parte !== null)
    .join(", ");
  return (
    <View style={estilos.tarjeta}>
      <View accessible accessibilityLabel={etiqueta} style={estilos.bloque}>
        <Text style={estilos.comprador}>{comprador}</Text>
        <Text style={estilos.resumen}>{`${tipo} · ${cantidad} · ${total}`}</Text>
        <Text style={estilos.detalle}>{textoCompradaEl(compra.creadaEnLocal)}</Text>
        <View style={estilos.estado}>
          <EtiquetaEstadoCompra estado={compra.estado} />
          {aviso !== null && <Text style={estilos.aviso}>{aviso}</Text>}
        </View>
      </View>
      {compra.reembolso?.estado === "pendiente" && alConfirmarReembolso ? (
        <View style={estilos.bloque}>
          <AvisoDeFormulario mensaje={error} />
          <Boton
            variante="aviso"
            texto="Confirmar reembolso"
            textoEnCurso="Confirmando…"
            enCurso={enCurso}
            alPresionar={() => alConfirmarReembolso(compra)}
          />
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    gap: tema.espacio.medio,
    padding: tema.espacio.normal,
    borderRadius: tema.radio.tarjeta,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.superficie,
    boxShadow: tema.sombra.nivel1,
  },
  bloque: { gap: tema.espacio.minimo },
  comprador: { ...tema.tipografia.subtitulo, color: tema.colores.texto, flexShrink: 1 },
  resumen: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.texto, flexShrink: 1 },
  detalle: { ...tema.tipografia.secundario, color: tema.colores.textoSecundario, flexShrink: 1 },
  // El aviso va al lado de la etiqueta (nunca la reemplaza) y baja de renglón si no entra.
  estado: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: tema.espacio.chico },
  aviso: { ...tema.tipografia.secundario, color: tema.colores.texto, flexShrink: 1 },
});
