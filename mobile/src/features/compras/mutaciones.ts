import type { DatosCompra } from "@ai-ticket-it/shared";
import { useMutation, useQueryClient, type Query } from "@tanstack/react-query";

import { comprarEntradas, ErrorDeApi } from "../../api";
import { claves } from "../../consultas/claves";
import { useClienteApi } from "../../consultas/cliente-api";

// Las escrituras de compras van en nombre del usuario de la pantalla y no se reintentan solas
// (`mutations.retry: false` del QueryClient). Con éxito o error invalidan lo que pudo cambiar: la
// única fuente de verdad es el servidor (cupo, tope, estado).

/** `["evento", *, eventoId]`: el cupo cambió para todos los usuarios, no solo para el de la pantalla. */
const delEvento =
  (eventoId: string) =>
  ({ queryKey }: Query): boolean =>
    queryKey[0] === "evento" && queryKey[2] === eventoId;

/**
 * Registra una compra. Al terminar invalida el evento (todos los usuarios; ante un 404 sin volver a
 * pedirlo), las compras del usuario en ese evento y el catálogo.
 */
export function useComprarEntradas(usuarioId: string, eventoId: string) {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: DatosCompra) => comprarEntradas(cliente, eventoId, datos, { usuarioId }),
    onSettled: (_compra, error) => {
      const noEncontrado = error instanceof ErrorDeApi && error.status === 404;
      return Promise.all([
        queryClient.invalidateQueries({
          predicate: delEvento(eventoId),
          refetchType: noEncontrado ? "none" : "active",
        }),
        queryClient.invalidateQueries({ queryKey: claves.misComprasDelEvento(usuarioId, eventoId) }),
        queryClient.invalidateQueries({ queryKey: ["catalogo"] }),
      ]);
    },
  });
}
