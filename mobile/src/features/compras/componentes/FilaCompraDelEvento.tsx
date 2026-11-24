import type { CompraDelEventoVista } from "@ai-ticket-it/shared";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Boton, EtiquetaEstadoCompra, tema, textoEtiquetaEstado } from "../../../componentes";
import { AvisoDeFormulario } from "../../eventos";
import { nombreCompleto } from "../../usuarios";
import {
  MARCA_SIN_RESPONDER,
  textoAvisoDeCompraDelEvento,
  textoCantidad,
  textoCompradaEl,
  textoTotal,
} from "../formato";

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
 * como hermano de ese bloque, "Confirmar reembolso" y el error de esa fila. Al pie (feature 011),
 * en todos los estados y también con el evento realizado, "Abrir chat": otro hermano del bloque, para
 * que TalkBack lo enfoque aparte, que abre "Chat de la compra" de esta compra. Si el último mensaje
 * del chat es del comprador (docs/mejoras-organizador.md, grupo 4), la marca "Mensaje sin responder",
 * que también lee el lector de pantalla.
 */
export function FilaCompraDelEvento({
  compra,
  alConfirmarReembolso,
  enCurso = false,
  error = null,
}: PropsFilaCompraDelEvento) {
  const comprador = nombreCompleto(compra.comprador);
  const tipo = compra.tipoEntrada.nombre;
  const cantidad = textoCantidad(compra.cantidad);
  const total = textoTotal(compra.total);
  const aviso = textoAvisoDeCompraDelEvento(compra);
  const sinResponder = compra.mensajeSinResponder ? MARCA_SIN_RESPONDER : null;
  const etiqueta = [comprador, tipo, cantidad, total, textoEtiquetaEstado(compra.estado), aviso, sinResponder]
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
        {sinResponder !== null && (
          <View style={estilos.marca}>
            <Text style={estilos.textoMarca}>{sinResponder}</Text>
          </View>
        )}
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
      <Boton
        variante="texto"
        texto="Abrir chat"
        accessibilityLabel={`Abrir el chat con ${comprador}`}
        alPresionar={() =>
          router.push({ pathname: "/compras/[compraId]/chat", params: { compraId: compra.id } })
        }
      />
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
  // Como un badge, pero sobre `avisoFondo`: no se confunde con el estado de la compra.
  marca: {
    alignSelf: "flex-start",
    justifyContent: "center",
    height: tema.tamano.badge,
    paddingHorizontal: tema.espacio.chico,
    borderRadius: tema.radio.pildora,
    borderWidth: tema.grosor.fino,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.avisoFondo,
  },
  textoMarca: { ...tema.tipografia.badge, color: tema.colores.avisoTexto },
});
