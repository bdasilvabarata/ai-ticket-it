import type { CompraDelEventoVista, DatosCompra, EntradaDelEventoVista } from "@ai-ticket-it/shared";
import { useMutation, useQueryClient, type Query, type UseMutationResult } from "@tanstack/react-query";

import {
  cancelarCompra,
  comprarEntradas,
  confirmarReembolso,
  ErrorDeApi,
  pagarCompra,
  registrarUsoDeEntrada,
} from "../../api";
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
 * pedirlo), las compras del usuario en ese evento, todas sus compras ("Mis compras") y el catálogo.
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
        queryClient.invalidateQueries({ queryKey: claves.misCompras(usuarioId) }),
        queryClient.invalidateQueries({ queryKey: ["catalogo"] }),
      ]);
    },
  });
}

/**
 * Paga (simulado) una compra. Con éxito escribe la respuesta en la consulta de la compra; al
 * terminar, con éxito o error, invalida la compra (el estado real lo dice el servidor: vencida, ya
 * confirmada o con la respuesta perdida), las compras del usuario en el evento y en "Mis compras", el
 * evento (todos los usuarios: el cupo pudo volver) y el catálogo.
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
        queryClient.invalidateQueries({ queryKey: claves.misCompras(usuarioId) }),
        queryClient.invalidateQueries({ predicate: delEvento(eventoId) }),
        queryClient.invalidateQueries({ queryKey: ["catalogo"] }),
      ]),
  });
}

/**
 * Cancela una compra pendiente (sin esperar a que venza). Al terminar, con éxito o error, invalida lo
 * mismo que el pago: la compra, las compras del usuario en el evento y en "Mis compras", el evento
 * (todos los usuarios: su cupo volvió) y el catálogo.
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
        queryClient.invalidateQueries({ queryKey: claves.misCompras(usuarioId) }),
        queryClient.invalidateQueries({ predicate: delEvento(eventoId) }),
        queryClient.invalidateQueries({ queryKey: ["catalogo"] }),
      ]),
  });
}

/**
 * Registra el ingreso con una entrada (feature 008), en nombre del organizador de la pantalla. Sin
 * reintentos. Con éxito escribe la entrada en su consulta; al terminar, con éxito o error, invalida
 * "Compras del evento", la entrada, el evento (todos los usuarios), el catálogo y, por prefijo, las
 * vistas del comprador de cualquier usuario (`compra`, `mis-compras`, `mis-compras-del-evento`).
 */
export function useRegistrarUso(
  usuarioId: string,
  eventoId: string,
): UseMutationResult<EntradaDelEventoVista, Error, string> {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (codigo: string) => registrarUsoDeEntrada(cliente, eventoId, codigo, { usuarioId }),
    onSuccess: (entrada, codigo) => {
      queryClient.setQueryData(claves.entradaDelEvento(usuarioId, eventoId, codigo), entrada);
    },
    onSettled: (_entrada, _error, codigo) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: claves.comprasDelEvento(usuarioId, eventoId) }),
        queryClient.invalidateQueries({ queryKey: claves.entradaDelEvento(usuarioId, eventoId, codigo) }),
        queryClient.invalidateQueries({ predicate: delEvento(eventoId) }),
        queryClient.invalidateQueries({ queryKey: ["catalogo"] }),
        // El comprador es otro usuario y puede estar en la caché de este dispositivo (R13).
        queryClient.invalidateQueries({ queryKey: ["compra"] }),
        queryClient.invalidateQueries({ queryKey: ["mis-compras"] }),
        queryClient.invalidateQueries({ queryKey: ["mis-compras-del-evento"] }),
      ]),
  });
}

/**
 * El organizador confirma el reembolso de una compra cancelada (feature 009), en su nombre; la
 * variable es el id de la compra. Sin reintentos. Al terminar, con éxito o error, invalida "Compras
 * del evento" y, por prefijo, las vistas del comprador de cualquier usuario (`entrada-del-evento`,
 * `compra`, `mis-compras`, `mis-compras-del-evento`). No el evento ni el catálogo: el cupo no
 * cambia (R10).
 */
export function useConfirmarReembolso(
  usuarioId: string,
  eventoId: string,
): UseMutationResult<CompraDelEventoVista, Error, string> {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (compraId: string) => confirmarReembolso(cliente, compraId, { usuarioId }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: claves.comprasDelEvento(usuarioId, eventoId) }),
        queryClient.invalidateQueries({ queryKey: ["entrada-del-evento"] }),
        queryClient.invalidateQueries({ queryKey: ["compra"] }),
        queryClient.invalidateQueries({ queryKey: ["mis-compras"] }),
        queryClient.invalidateQueries({ queryKey: ["mis-compras-del-evento"] }),
      ]),
  });
}
