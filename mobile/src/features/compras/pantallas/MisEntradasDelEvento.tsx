import type { CompraVista } from "@ai-ticket-it/shared";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { PantallaDesplazable, SegunConsulta, tema } from "../../../componentes";
import { useSesion } from "../../sesion";
import { FilaCompraConfirmada } from "../componentes/FilaCompraConfirmada";
import { useMisComprasDelEvento } from "../useMisComprasDelEvento";

/**
 * "Mis entradas": las compras confirmadas del usuario en un evento, de la más nueva a la más vieja
 * (como las manda el servidor), cada una con "Ver" para abrir "Tu compra". Hasta que exista "Mis
 * compras" (007), es el camino desde el detalle a las entradas compradas.
 */
export function MisEntradasDelEvento() {
  const { eventoId } = useLocalSearchParams<{ eventoId: string }>();
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null; // el guard ya no muestra esta ruta
  return <ListaDeEntradas usuarioId={estado.usuarioId} eventoId={eventoId} />;
}

function ListaDeEntradas({ usuarioId, eventoId }: { usuarioId: string; eventoId: string }) {
  const consulta = useMisComprasDelEvento(usuarioId, eventoId);
  return (
    <SegunConsulta
      consulta={consulta}
      esVacio={(datos) => !datos || datos.confirmadas.length === 0}
      mensajeVacio="Todavía no tenés entradas confirmadas para este evento."
    >
      {(datos) => <Entradas confirmadas={datos.confirmadas} />}
    </SegunConsulta>
  );
}

function Entradas({ confirmadas }: { confirmadas: readonly CompraVista[] }) {
  return (
    <PantallaDesplazable separacion={tema.espacio.chico}>
      <Text style={estilos.nombre} accessibilityRole="header">
        {confirmadas[0]?.evento.nombre}
      </Text>
      {confirmadas.map((compra) => (
        <FilaCompraConfirmada key={compra.id} compra={compra} />
      ))}
    </PantallaDesplazable>
  );
}

const estilos = StyleSheet.create({
  nombre: { ...tema.tipografia.titulo, color: tema.colores.texto },
});
