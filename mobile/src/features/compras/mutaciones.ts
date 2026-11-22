import type {
  CompraDelEventoVista,
  DatosCompra,
  DatosMensaje,
  EntradaDelEventoVista,
  MensajeVista,
  ReseniaVista,
} from "@ai-ticket-it/shared";
import { useMutation, useQueryClient, type Query, type UseMutationResult } from "@tanstack/react-query";

import {
  cancelarCompra,
  comprarEntradas,
  confirmarReembolso,
  enviarMensaje,
  ErrorDeApi,
  pagarCompra,
  registrarUsoDeEntrada,
  reseniarEvento,
  type CuerpoResenia,
} from "../../api";
import { claves } from "../../consultas/claves";
import { useClienteApi } from "../../consultas/cliente-api";

// Las escrituras de compras van en nombre del usuario de la pantalla y no se reintentan solas
// (`mutations.retry: false` del QueryClient). Con éxito o error invalidan lo que pudo cambiar: la
// única fuente de verdad es el servidor (cupo, tope, estado). Las que cambian el estado de una compra
// invalidan también, por prefijo, `["chat-de-la-compra"]`: su encabezado lo muestra (feature 011, R10).

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
        queryClient.invalidateQueries({ queryKey: ["chat-de-la-compra"] }),
      ]),
  });
}

/**
 * Cancela una compra pendiente (sin esperar a que venza) o, desde la 009, una confirmada. Al terminar,
 * con éxito o error, invalida lo mismo que el pago: la compra, las compras del usuario en el evento y
 * en "Mis compras", el evento (todos los usuarios: su cupo volvió) y el catálogo; y, por prefijo, lo
 * que ve el organizador ("Compras del evento" y la entrada buscada en "Registrar ingreso"), que es
 * otro usuario y puede estar en la caché de este dispositivo (R10).
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
        queryClient.invalidateQueries({ queryKey: ["compras-del-evento"] }),
        queryClient.invalidateQueries({ queryKey: ["entrada-del-evento"] }),
        queryClient.invalidateQueries({ queryKey: ["chat-de-la-compra"] }),
      ]),
  });
}

/**
 * Registra el ingreso con una entrada (feature 008), en nombre del organizador de la pantalla. Sin
 * reintentos. Con éxito escribe la entrada en su consulta; al terminar, con éxito o error, invalida
 * "Compras del evento", la entrada y, por prefijo, las vistas del comprador de cualquier usuario
 * (`compra`, `mis-compras`, `mis-compras-del-evento`). No el evento ni el catálogo: usar una
 * entrada no cambia el cupo (feature 010, R8).
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
        // El comprador es otro usuario y puede estar en la caché de este dispositivo (R13).
        queryClient.invalidateQueries({ queryKey: ["compra"] }),
        queryClient.invalidateQueries({ queryKey: ["mis-compras"] }),
        queryClient.invalidateQueries({ queryKey: ["mis-compras-del-evento"] }),
        queryClient.invalidateQueries({ queryKey: ["chat-de-la-compra"] }),
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
        queryClient.invalidateQueries({ queryKey: ["chat-de-la-compra"] }),
      ]),
  });
}

/** Lo que una reseña nueva cambia: la reseña propia en las compras y el puntaje del organizador. */
const PREFIJOS_CON_RESENIAS = [
  "compra",
  "mis-compras",
  "mis-compras-del-evento",
  "evento",
  "catalogo",
  "resenias-del-organizador",
] as const;

/**
 * Reseña el evento de una compra UTILIZADA (feature 012, R11), en nombre del usuario de la pantalla y
 * sin reintentos. Con éxito invalida, por prefijo, lo que muestra la reseña propia (`["compra"]`,
 * `["mis-compras"]`, `["mis-compras-del-evento"]`) y lo que muestra el puntaje del organizador
 * (`["evento"]`, `["catalogo"]` y `["resenias-del-organizador"]`).
 */
export function useReseniarEvento(
  usuarioId: string,
  eventoId: string,
): UseMutationResult<ReseniaVista, Error, CuerpoResenia> {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: CuerpoResenia) => reseniarEvento(cliente, eventoId, datos, { usuarioId }),
    // Sin esperar las relecturas: la pantalla sale apenas responde el servidor (si esperara, la compra
    // releída ya no es reseñable y el formulario se desmontaría antes de volver).
    onSuccess: () => {
      for (const prefijo of PREFIJOS_CON_RESENIAS)
        void queryClient.invalidateQueries({ queryKey: [prefijo] });
    },
  });
}

/**
 * Envía un mensaje al chat de la compra (feature 011, R10), en nombre de `usuarioId` y sin
 * reintentos. Al terminar, con éxito o error, invalida **solo el chat de esa compra**, pero para
 * todos los usuarios de la caché (`["chat-de-la-compra", *, compraId]`): en la demo el comprador y
 * el organizador alternan en el mismo celular. Nada más cambia por un mensaje (FR-019).
 */
export function useEnviarMensaje(
  usuarioId: string,
  compraId: string,
): UseMutationResult<MensajeVista, Error, DatosMensaje> {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: DatosMensaje) => enviarMensaje(cliente, compraId, datos, { usuarioId }),
    onSettled: () =>
      queryClient.invalidateQueries({
        predicate: ({ queryKey }) => queryKey[0] === "chat-de-la-compra" && queryKey[2] === compraId,
      }),
  });
}
