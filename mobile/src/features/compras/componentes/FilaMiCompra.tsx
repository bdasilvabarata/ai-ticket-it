import { EstadoCompra, type MiCompraVista } from "@ai-ticket-it/shared";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Boton, EtiquetaEstadoCompra, hundido, tema } from "../../../componentes";
import { MarcaFavorito, textoFechaHora } from "../../eventos";
import {
  textoAccionDePago,
  textoAvisoDeMiCompra,
  textoCantidad,
  textoReseniaPropia,
  textoTotal,
} from "../formato";
import { BotonReseniar } from "./ReseniaDeLaCompra";
import { ReseniaPropia } from "./ReseniaPropia";

export interface PropsFilaMiCompra {
  compra: MiCompraVista;
  /** Si su evento es un favorito del usuario actual (feature 014): la estrella indicadora. */
  esFavorito?: boolean;
}

/**
 * Una compra de "Mis compras" (contracts/app.md, "`FilaMiCompra`"): un contenedor sin rol con los
 * datos tocables, que abren "Tu compra". En una `PENDIENTE`, "Pagar" ("Confirmar" si es gratis) va
 * como **hermana** de los datos, nunca adentro: un botón anidado en un `Pressable` accesible no se
 * puede enfocar en Android (R10). También abre "Tu compra", donde se paga. Si su evento es favorito,
 * la estrella indicadora va adentro de los datos y ", en favoritos" en su etiqueta (feature 014).
 */
export function FilaMiCompra({ compra, esFavorito = false }: PropsFilaMiCompra) {
  const tipo = compra.tipoEntrada.nombre;
  const aviso = textoAvisoDeMiCompra(compra);
  const etiqueta = `Ver la compra de ${compra.cantidad} ${tipo} para ${compra.evento.nombre}${
    esFavorito ? ", en favoritos" : ""
  }`;
  return (
    <View style={estilos.contenedor}>
      <Pressable
        accessibilityRole="button"
        // La reseña propia se lee con la fila (feature 012): va adentro de sus datos.
        accessibilityLabel={compra.resenia ? `${etiqueta}. ${textoReseniaPropia(compra.resenia)}` : etiqueta}
        onPress={() => abrirCompra(compra.id)}
        style={({ pressed }) => [
          estilos.tarjeta,
          esFavorito && estilos.lugarParaLaMarca,
          pressed ? hundido : estilos.sombra,
        ]}
      >
        <Text style={estilos.evento}>{compra.evento.nombre}</Text>
        <Text style={estilos.detalle}>{textoFechaHora(compra.evento.fechaHoraLocal)}</Text>
        <Text style={estilos.resumen}>
          {`${tipo} · ${textoCantidad(compra.cantidad)} · ${textoTotal(compra.total)}`}
        </Text>
        <View style={estilos.estado}>
          <EtiquetaEstadoCompra estado={compra.estado} />
          {aviso !== null && <Text style={estilos.aviso}>{aviso}</Text>}
        </View>
        {compra.resenia ? <ReseniaPropia resenia={compra.resenia} /> : null}
        {esFavorito ? <MarcaFavorito /> : null}
      </Pressable>
      {/* Como "Pagar": hermano de los datos, para que TalkBack lo enfoque por separado (FR-012). */}
      <BotonReseniar compra={compra} />
      {compra.estado === EstadoCompra.PENDIENTE && (
        <View style={estilos.acciones}>
          <Boton
            texto={textoAccionDePago(compra.total)}
            accessibilityLabel={`Pagar la compra de ${compra.cantidad} ${tipo}`}
            alPresionar={() => abrirCompra(compra.id)}
          />
        </View>
      )}
    </View>
  );
}

function abrirCompra(compraId: string) {
  router.push({ pathname: "/compras/[compraId]", params: { compraId } });
}

const estilos = StyleSheet.create({
  contenedor: { gap: tema.espacio.chico },
  tarjeta: {
    gap: tema.espacio.minimo,
    padding: tema.espacio.normal,
    borderRadius: tema.radio.tarjeta,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.superficie,
  },
  sombra: { boxShadow: tema.sombra.nivel1 },
  // La estrella va en la esquina superior derecha: el texto no pasa por debajo.
  lugarParaLaMarca: { paddingRight: tema.espacio.normal + tema.tamano.pastillaAncho },
  // Nombres largos se parten en varias líneas antes de recortarse (360 px, FR-020).
  evento: { ...tema.tipografia.subtitulo, color: tema.colores.texto, flexShrink: 1 },
  detalle: { ...tema.tipografia.secundario, color: tema.colores.textoSecundario, flexShrink: 1 },
  resumen: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.texto, flexShrink: 1 },
  // El aviso va al lado de la etiqueta (nunca la reemplaza, FR-012) y baja de renglón si no entra.
  estado: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: tema.espacio.chico },
  aviso: { ...tema.tipografia.secundario, color: tema.colores.texto, flexShrink: 1 },
  acciones: { alignItems: "flex-start" },
});
