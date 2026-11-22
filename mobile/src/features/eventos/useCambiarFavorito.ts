import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { desmarcarFavorito, marcarFavorito } from "../../api";
import { claves } from "../../consultas/claves";
import { useClienteApi } from "../../consultas/cliente-api";

/** Lo que pide la estrella: marcar (`PUT`) o desmarcar (`DELETE`). */
export interface CambioDeFavorito {
  marcar: boolean;
}

/**
 * Marca o desmarca `eventoId` como favorito de `usuarioId` (feature 014, research R8), sin
 * reintentos y sin optimismo. Con éxito o error, `onSettled` **devuelve** la relectura de
 * `claves.favoritos(usuarioId)`: la mutation sigue en curso hasta que la estrella muestra el estado
 * del servidor. No invalida catálogo, detalle, "Mis compras" ni "Mis eventos" (FR-018).
 */
export function useCambiarFavorito(
  usuarioId: string,
  eventoId: string,
): UseMutationResult<void, Error, CambioDeFavorito> {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ marcar }: CambioDeFavorito) =>
      marcar ? marcarFavorito(cliente, usuarioId, eventoId) : desmarcarFavorito(cliente, usuarioId, eventoId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: claves.favoritos(usuarioId) }),
  });
}
