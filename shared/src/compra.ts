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
  /** Sus entradas con código (feature 008): solo en CONFIRMADA o UTILIZADA; si no, []. Solo la ve su comprador. */
  entradas: EntradaVista[];
  /** Cuántas de sus entradas se usaron (feature 008). */
  entradasUsadas: number;
}

/**
 * Una fila de "Mis compras" (feature 007): la compra al día con su evento y su tipo actuales, sin
 * historial ni entradas (conserva `entradasUsadas`, feature 008).
 */
export type MiCompraVista = Omit<CompraVista, "compradorId" | "historial" | "entradas"> & {
  /** Días de calendario (Buenos Aires) hasta el evento; solo en CONFIRMADA de un evento no realizado; si no, null. */
  diasRestantes: number | null;
  /** Solo en CANCELADA: "sistema" si venció sin pagarse, "usuario" si la canceló su comprador; si no, null. */
  canceladaPor: "sistema" | "usuario" | null;
};

/** Respuesta de `GET /eventos/:eventoId/mis-compras` (del usuario actual). */
export interface MisComprasDelEventoVista {
  /** Sus compras PENDIENTE no vencidas de ese evento, de la más vieja a la más nueva. */
  pendientes: CompraVista[];
  /** Sus compras CONFIRMADA y UTILIZADA de ese evento (sus entradas), de la más nueva a la más vieja. */
  confirmadas: CompraVista[];
  /** Cuántas entradas más puede comprar de cada tipo según su tope (todos los tipos; 0 si es el organizador). */
  restantesPorTipo: { tipoEntradaId: string; restantes: number }[];
}

/** Una entrada de una compra (feature 008): una por unidad comprada. */
export interface EntradaVista {
  /** Canónico, 8 caracteres (la app lo muestra "XXXX-XXXX"). */
  codigo: string;
  estado: EstadoCompra;
  /** Cuándo se registró su uso (ISO UTC); `null` si no se usó. */
  usadaEn: string | null;
  /** `usadaEn` en hora de Buenos Aires ("YYYY-MM-DDTHH:mm"); `null` si no se usó. */
  usadaEnLocal: string | null;
}

/** Ventana en la que el organizador puede registrar el uso de las entradas de un evento. */
export interface VentanaDeUsoVista {
  /** Instante ISO UTC: 4 horas antes del inicio. */
  desde: string;
  /** Instante ISO UTC: 12 horas después del inicio. */
  hasta: string;
  /** `desde` en hora de Buenos Aires ("YYYY-MM-DDTHH:mm"). */
  desdeLocal: string;
  /** `hasta` en hora de Buenos Aires ("YYYY-MM-DDTHH:mm"). */
  hastaLocal: string;
  /** Según el reloj del servidor al responder; "abierta" con ambos extremos inclusive. */
  estado: "antes" | "abierta" | "despues";
}

/** El comprador de una compra, como lo ve el organizador del evento. */
export interface CompradorVista {
  id: string;
  nombre: string;
  apellido: string;
}

/** Cómo viene la venta de un tipo de entrada, al día. */
export interface ResumenTipoEntradaVista {
  tipoEntrada: { id: string; nombre: string };
  /** El cupo disponible del tipo (el mismo que muestra el detalle). */
  disponibles: number;
  /** Entradas de compras PENDIENTE no vencidas. */
  pendientes: number;
  /** Entradas de compras CONFIRMADA o UTILIZADA. */
  vendidas: number;
  /** Entradas UTILIZADA. */
  usadas: number;
}

/** Una fila de "Compras del evento" (la ve el organizador): sin códigos de entrada ni historial. */
export interface CompraDelEventoVista {
  id: string;
  comprador: CompradorVista;
  tipoEntrada: { id: string; nombre: string };
  cantidad: number;
  /** Pesos enteros fijados al comprar; 0 = gratis. */
  total: number;
  estado: EstadoCompra;
  /** Instante ISO UTC del alta. */
  creadaEn: string;
  /** `creadaEn` en hora de Buenos Aires ("YYYY-MM-DDTHH:mm"). */
  creadaEnLocal: string;
  /** Hasta cuándo se puede pagar (ISO UTC); solo en PENDIENTE, si no, `null`. */
  venceEn: string | null;
  /** `venceEn` en hora de Buenos Aires; solo en PENDIENTE, si no, `null`. */
  venceEnLocal: string | null;
  /** Solo en CANCELADA: "sistema" si venció sin pagarse, "usuario" si la canceló su comprador; si no, `null`. */
  canceladaPor: "sistema" | "usuario" | null;
  /** Cuántas de sus entradas ya se usaron. */
  entradasUsadas: number;
}

/** Respuesta de `GET /eventos/:eventoId/compras` (solo el organizador). */
export interface ComprasDelEventoVista {
  evento: { id: string; nombre: string; fechaHoraLocal: string; realizado: boolean };
  ventanaDeUso: VentanaDeUsoVista;
  /** Todos los tipos, en el orden del evento. */
  resumenPorTipo: ResumenTipoEntradaVista[];
  /** Todas, de la más nueva a la más vieja (desempate por id). */
  compras: CompraDelEventoVista[];
}

/** Respuesta de `GET /eventos/:eventoId/entradas/:codigo` y de `POST …/uso` (solo el organizador). */
export interface EntradaDelEventoVista extends EntradaVista {
  compra: {
    id: string;
    comprador: CompradorVista;
    tipoEntrada: { id: string; nombre: string };
    cantidad: number;
    estado: EstadoCompra;
    entradasUsadas: number;
  };
  ventanaDeUso: VentanaDeUsoVista;
}
