import type { EstadoCompra } from "./estado-compra";

/** Límite del texto de un mensaje del chat (clarify): lo usan la validación y el dominio. */
export const LIMITES_MENSAJE = { largoMaximo: 500 } as const;

/** Cuerpo de `POST /compras/:compraId/mensajes`: solo el texto (autor y fecha los pone el servidor). */
export interface DatosMensaje {
  texto: string;
}

/** El rol de un usuario en una compra: su comprador o el organizador de su evento. */
export type RolEnLaCompra = "comprador" | "organizador";

/** Una de las dos partes del chat de una compra. */
export interface ParteDeLaCompraVista {
  id: string;
  nombre: string;
  apellido: string;
  rol: RolEnLaCompra;
}

/** Un mensaje del chat, en orden de envío. */
export interface MensajeVista {
  /** Su posición en la conversación, desde 1 (los mensajes solo se agregan al final). */
  numero: number;
  autor: ParteDeLaCompraVista;
  texto: string;
  /** Instante ISO UTC (reloj del servidor). */
  enviadoEn: string;
  /** "YYYY-MM-DDTHH:mm", hora de Buenos Aires. */
  enviadoEnLocal: string;
}

/** Respuesta de `GET /compras/:compraId/mensajes` (solo las dos partes). */
export interface ChatDeLaCompraVista {
  /** El encabezado: sin códigos de entrada, historial ni total. */
  compra: {
    id: string;
    evento: { id: string; nombre: string };
    tipoEntrada: { id: string; nombre: string };
    cantidad: number;
    /** Al día con el reloj del servidor (una pendiente vencida se ve CANCELADA). */
    estado: EstadoCompra;
  };
  /** La otra parte respecto del usuario que pide. */
  otraParte: ParteDeLaCompraVista;
  /** Todos, del más viejo al más nuevo. */
  mensajes: MensajeVista[];
}
