import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet } from "react-native";

import { tema, useEnvioUnico } from "../../../componentes";
import { useSesion } from "../../sesion";
import { useCambiarFavorito } from "../useCambiarFavorito";
import { useFavoritos, useIdsDeFavoritos } from "../useFavoritos";

/**
 * La estrella del detalle (feature 014): el **único** lugar donde se marca o desmarca un favorito
 * (FR-014). No se dibuja hasta tener los favoritos (FR-018b) y su estado sale solo de ellos (R8):
 * mientras el cambio no se relee, queda ocupada con el estado anterior. Un segundo toque durante el
 * envío no manda otro pedido (FR-016).
 */
export function EstrellaFavorito({ eventoId }: { eventoId: string }) {
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null;
  return <Estrella usuarioId={estado.usuarioId} eventoId={eventoId} />;
}

function Estrella({ usuarioId, eventoId }: { usuarioId: string; eventoId: string }) {
  const favoritos = useFavoritos();
  const ids = useIdsDeFavoritos();
  const cambio = useCambiarFavorito(usuarioId, eventoId);
  const enviarUnaVez = useEnvioUnico();
  if (favoritos.data === undefined) return null;

  const esFavorito = ids.has(eventoId);
  const enCurso = cambio.isPending;
  const tocar = () =>
    enviarUnaVez((terminar) => cambio.mutate({ marcar: !esFavorito }, { onSettled: terminar }));

  return (
    <Pressable
      onPress={tocar}
      disabled={enCurso}
      accessibilityRole="button"
      accessibilityLabel={esFavorito ? "Quitar de favoritos" : "Agregar a favoritos"}
      accessibilityState={{ selected: esFavorito, busy: enCurso, disabled: enCurso }}
      hitSlop={tema.espacio.minimo}
      style={[estilos.estrella, enCurso && estilos.enCurso]}
    >
      <Ionicons
        name={esFavorito ? "star" : "star-outline"}
        size={tema.tamano.iconoGrande}
        color={tema.colores.texto}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  estrella: {
    minWidth: tema.tamano.tactil,
    minHeight: tema.tamano.tactil,
    alignItems: "center",
    justifyContent: "center",
  },
  enCurso: { opacity: tema.opacidadApagado },
});
