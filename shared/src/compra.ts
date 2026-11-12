import type { EstadoCompra } from "./estado-compra";

/** Límites de una compra: los usan la validación, el dominio y los textos de la app. */
export const LIMITES_COMPRA = {
  /** Entradas de tipos pagos por persona y por evento, sumando sus compras vigentes; también el máximo por pedido. */
  entradasPorEvento: 4,
  /** Entradas de cada tipo gratis por persona (aparte de las 4). */
  entradasPorTipoGratis: 1,
  /** Una compra PENDIENTE vence a los 15 minutos de su alta. */
  minutosParaPagar: 15,
} as const;

/** Cuerpo de `POST /eventos/:eventoId/compras`: nunca lleva precio ni total. */
export interface DatosCompra {
  tipoEntradaId: string;
  cantidad: number;
}

/** Quién hizo un cambio de estado: un usuario o el sistema (vencimiento). */
export type AutorCambioEstadoVista = { tipo: "usuario"; usuarioId: string } | { tipo: "sistema" };

/** Un cambio de estado del historial de una compra. */
export interface CambioEstadoCompraVista {
  estado: EstadoCompra;
  autor: AutorCambioEstadoVista;
  /** Instante ISO UTC (reloj del servidor). */
  fechaHora: string;
  /** "YYYY-MM-DDTHH:mm", hora de Buenos Aires. */
  fechaHoraLocal: string;
}

/** Una compra, con su estado al día (una pendiente vencida ya se ve CANCELADA). */
export interface CompraVista {
  id: string;
  compradorId: string;
  evento: {
    id: string;
    nombre: string;
    fechaHora: string;
    fechaHoraLocal: string;
    realizado: boolean;
  };
  tipoEntrada: { id: string; nombre: string };
  cantidad: number;
  /** Pesos enteros fijados al comprar; 0 = gratis. */
  total: number;
  estado: EstadoCompra;
  /** Instante ISO UTC del alta. */
  creadaEn: string;
  /** Hasta cuándo se puede pagar (ISO UTC); `null` si no está PENDIENTE. */
  venceEn: string | null;
  /** `venceEn` en hora de Buenos Aires ("YYYY-MM-DDTHH:mm"); `null` si no está PENDIENTE. */
  venceEnLocal: string | null;
  /** En orden cronológico; el primero es siempre PENDIENTE. */
  historial: CambioEstadoCompraVista[];
}

/** Respuesta de `GET /eventos/:eventoId/mis-compras` (del usuario actual). */
export interface MisComprasDelEventoVista {
  /** Sus compras PENDIENTE no vencidas de ese evento, de la más vieja a la más nueva. */
  pendientes: CompraVista[];
  /** Sus compras CONFIRMADA de ese evento (sus entradas), de la más nueva a la más vieja. */
  confirmadas: CompraVista[];
  /** Cuántas entradas más puede comprar de cada tipo según su tope (todos los tipos; 0 si es el organizador). */
  restantesPorTipo: { tipoEntradaId: string; restantes: number }[];
}
