import type { DatosCompra } from "@ai-ticket-it/shared";
import { useMutation, useQueryClient, type Query } from "@tanstack/react-query";

import { cancelarCompra, comprarEntradas, ErrorDeApi, pagarCompra } from "../../api";
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

/**
 * Paga (simulado) una compra. Con éxito escribe la respuesta en la consulta de la compra; al
 * terminar, con éxito o error, invalida la compra (el estado real lo dice el servidor: vencida, ya
 * confirmada o con la respuesta perdida), las compras del usuario en el evento, el evento (todos los
 * usuarios: el cupo pudo volver) y el catálogo.
 */
export function usePagarCompra(usuarioId: string, compraId: string, eventoId: string) {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => pagarCompra(cliente, compraId, { usuarioId }),
    onSuccess: (compra) => {
      queryClient.setQueryData(claves.compra(usuarioId, compraId), compra);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: claves.compra(usuarioId, compraId) }),
        queryClient.invalidateQueries({ queryKey: claves.misComprasDelEvento(usuarioId, eventoId) }),
        queryClient.invalidateQueries({ predicate: delEvento(eventoId) }),
        queryClient.invalidateQueries({ queryKey: ["catalogo"] }),
      ]),
  });
}

/**
 * Cancela una compra pendiente (sin esperar a que venza). Al terminar, con éxito o error, invalida lo
 * mismo que el pago: la compra, las compras del usuario en el evento, el evento (todos los usuarios:
 * su cupo volvió) y el catálogo.
 */
export function useCancelarCompra(usuarioId: string, compraId: string, eventoId: string) {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cancelarCompra(cliente, compraId, { usuarioId }),
    onSuccess: (compra) => {
      queryClient.setQueryData(claves.compra(usuarioId, compraId), compra);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: claves.compra(usuarioId, compraId) }),
        queryClient.invalidateQueries({ queryKey: claves.misComprasDelEvento(usuarioId, eventoId) }),
        queryClient.invalidateQueries({ predicate: delEvento(eventoId) }),
        queryClient.invalidateQueries({ queryKey: ["catalogo"] }),
      ]),
  });
}
