import type {
  ChatDeLaCompraVista,
  CompraDelEventoVista,
  ComprasDelEventoVista,
  CompraVista,
  DatosCompra,
  DatosMensaje,
  EntradaDelEventoVista,
  MensajeVista,
  MiCompraVista,
  MisComprasDelEventoVista,
} from "@ai-ticket-it/shared";

import type { ClienteApi } from "./cliente";

const rutaDelEvento = (eventoId: string) => `/eventos/${encodeURIComponent(eventoId)}`;
const rutaDeLaCompra = (compraId: string) => `/compras/${encodeURIComponent(compraId)}`;
const rutaDeLaEntrada = (eventoId: string, codigo: string) =>
  `${rutaDelEvento(eventoId)}/entradas/${encodeURIComponent(codigo)}`;

/**
 * `POST /eventos/:eventoId/compras`: solo el tipo y la cantidad (el total lo calcula el servidor). Va
 * en nombre del usuario de la pantalla y no se reintenta solo.
 */
export function comprarEntradas(
  cliente: ClienteApi,
  eventoId: string,
  { tipoEntradaId, cantidad }: DatosCompra,
  { usuarioId }: { usuarioId: string },
): Promise<CompraVista> {
  const datos: DatosCompra = { tipoEntradaId, cantidad };
  return cliente.post<CompraVista>(`${rutaDelEvento(eventoId)}/compras`, datos, { usuarioId });
}

/** `GET /eventos/:eventoId/mis-compras`: las pendientes y el tope restante del usuario actual. */
export function obtenerMisComprasDelEvento(
  cliente: ClienteApi,
  eventoId: string,
  opciones: { signal?: AbortSignal } = {},
): Promise<MisComprasDelEventoVista> {
  return cliente.get<MisComprasDelEventoVista>(`${rutaDelEvento(eventoId)}/mis-compras`, {
    signal: opciones.signal,
  });
}

/**
 * `GET /eventos/:eventoId/compras` (feature 008): todas las compras del evento, al día, con la
 * ventana de uso y el resumen por tipo. Solo para su organizador (si no, 403).
 */
export function obtenerComprasDelEvento(
  cliente: ClienteApi,
  eventoId: string,
  opciones: { signal?: AbortSignal } = {},
): Promise<ComprasDelEventoVista> {
  return cliente.get<ComprasDelEventoVista>(`${rutaDelEvento(eventoId)}/compras`, {
    signal: opciones.signal,
  });
}

/**
 * `GET /eventos/:eventoId/entradas/:codigo` (feature 008): la entrada de ese evento con ese código
 * (el servidor lo normaliza), con su compra y la ventana de uso. Solo para el organizador.
 */
export function obtenerEntradaDelEvento(
  cliente: ClienteApi,
  eventoId: string,
  codigo: string,
  opciones: { signal?: AbortSignal } = {},
): Promise<EntradaDelEventoVista> {
  return cliente.get<EntradaDelEventoVista>(rutaDeLaEntrada(eventoId, codigo), { signal: opciones.signal });
}

/**
 * `POST /eventos/:eventoId/entradas/:codigo/uso` (feature 008), sin cuerpo: registra el ingreso con
 * esa entrada, en nombre del usuario de la pantalla. No se reintenta solo.
 */
export function registrarUsoDeEntrada(
  cliente: ClienteApi,
  eventoId: string,
  codigo: string,
  { usuarioId }: { usuarioId: string },
): Promise<EntradaDelEventoVista> {
  return cliente.post<EntradaDelEventoVista>(`${rutaDeLaEntrada(eventoId, codigo)}/uso`, undefined, {
    usuarioId,
  });
}

/** `GET /compras/:compraId`: la compra al día (solo la ve su comprador). */
export function obtenerCompra(
  cliente: ClienteApi,
  compraId: string,
  opciones: { signal?: AbortSignal } = {},
): Promise<CompraVista> {
  return cliente.get<CompraVista>(rutaDeLaCompra(compraId), { signal: opciones.signal });
}

/**
 * `GET /compras` (feature 007): las compras del usuario actual como comprador, de todos los eventos,
 * al día y en el orden del servidor.
 */
export function obtenerMisCompras(
  cliente: ClienteApi,
  opciones: { signal?: AbortSignal } = {},
): Promise<MiCompraVista[]> {
  return cliente.get<MiCompraVista[]>("/compras", { signal: opciones.signal });
}

/** `POST /compras/:compraId/pago`, sin cuerpo: pago simulado. No se reintenta solo. */
export function pagarCompra(
  cliente: ClienteApi,
  compraId: string,
  { usuarioId }: { usuarioId: string },
): Promise<CompraVista> {
  return cliente.post<CompraVista>(`${rutaDeLaCompra(compraId)}/pago`, undefined, { usuarioId });
}

/**
 * `POST /compras/:compraId/cancelacion`, sin cuerpo: el comprador cancela su compra pendiente y sus
 * entradas vuelven al cupo. No se reintenta solo.
 */
export function cancelarCompra(
  cliente: ClienteApi,
  compraId: string,
  { usuarioId }: { usuarioId: string },
): Promise<CompraVista> {
  return cliente.post<CompraVista>(`${rutaDeLaCompra(compraId)}/cancelacion`, undefined, { usuarioId });
}

/**
 * `POST /compras/:compraId/reembolso` (feature 009), sin cuerpo: el organizador confirma que devolvió
 * la plata de una compra cancelada. No se reintenta solo.
 */
export function confirmarReembolso(
  cliente: ClienteApi,
  compraId: string,
  { usuarioId }: { usuarioId: string },
): Promise<CompraDelEventoVista> {
  return cliente.post<CompraDelEventoVista>(`${rutaDeLaCompra(compraId)}/reembolso`, undefined, {
    usuarioId,
  });
}

/**
 * `GET /compras/:compraId/mensajes` (feature 011): el chat de la compra, con su encabezado y la otra
 * parte. Solo para su comprador y el organizador del evento (si no, 403).
 */
export function obtenerChatDeLaCompra(
  cliente: ClienteApi,
  compraId: string,
  opciones: { signal?: AbortSignal } = {},
): Promise<ChatDeLaCompraVista> {
  return cliente.get<ChatDeLaCompraVista>(`${rutaDeLaCompra(compraId)}/mensajes`, {
    signal: opciones.signal,
  });
}

/**
 * `POST /compras/:compraId/mensajes` (feature 011): solo el texto (el autor y la fecha los pone el
 * servidor). Va en nombre del usuario de la pantalla y no se reintenta solo.
 */
export function enviarMensaje(
  cliente: ClienteApi,
  compraId: string,
  { texto }: DatosMensaje,
  { usuarioId }: { usuarioId: string },
): Promise<MensajeVista> {
  const datos: DatosMensaje = { texto };
  return cliente.post<MensajeVista>(`${rutaDeLaCompra(compraId)}/mensajes`, datos, { usuarioId });
}
