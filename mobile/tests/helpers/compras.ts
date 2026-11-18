import {
  EstadoCompra,
  type CompraDelEventoVista,
  type ComprasDelEventoVista,
  type CompraVista,
  type MiCompraVista,
  type MisComprasDelEventoVista,
  type VentanaDeUsoVista,
} from "@ai-ticket-it/shared";

import { festivalCompleto, maratonCompleta } from "./eventos";

// Datos de compras para los tests de la feature 006.

/** Lo que responde `renderConDependencias` si un test no registra `mis-compras` (R19). */
export const sinCompras: MisComprasDelEventoVista = { pendientes: [], confirmadas: [], restantesPorTipo: [] };

/** `mis-compras` con esos restantes por tipo y sin pendientes. */
export function conRestantes(restantes: Record<string, number>): MisComprasDelEventoVista {
  return {
    pendientes: [],
    confirmadas: [],
    restantesPorTipo: Object.entries(restantes).map(([tipoEntradaId, cantidad]) => ({
      tipoEntradaId,
      restantes: cantidad,
    })),
  };
}

/** Una compra PENDIENTE de Martín: 2 inscripciones a la Maratón. */
export const compraPendiente: CompraVista = {
  id: "compra-nueva",
  compradorId: "usuario-martin",
  evento: {
    id: maratonCompleta.id,
    nombre: maratonCompleta.nombre,
    fechaHora: maratonCompleta.fechaHora,
    fechaHoraLocal: maratonCompleta.fechaHoraLocal,
    realizado: false,
  },
  tipoEntrada: { id: "tipo-maraton-inscripcion", nombre: "Inscripción" },
  cantidad: 2,
  total: 60000,
  estado: EstadoCompra.PENDIENTE,
  creadaEn: "2026-11-12T18:20:00.000Z",
  venceEn: "2026-11-12T18:35:00.000Z",
  venceEnLocal: "2026-11-12T15:35",
  historial: [
    {
      estado: EstadoCompra.PENDIENTE,
      autor: { tipo: "usuario", usuarioId: "usuario-martin" },
      fechaHora: "2026-11-12T18:20:00.000Z",
      fechaHoraLocal: "2026-11-12T15:20",
    },
  ],
};

/** La misma compra, pagada por Martín. */
export const compraConfirmada: CompraVista = {
  ...compraPendiente,
  estado: EstadoCompra.CONFIRMADA,
  venceEn: null,
  venceEnLocal: null,
  historial: [
    ...compraPendiente.historial,
    {
      estado: EstadoCompra.CONFIRMADA,
      autor: { tipo: "usuario", usuarioId: "usuario-martin" },
      fechaHora: "2026-11-12T18:25:00.000Z",
      fechaHoraLocal: "2026-11-12T15:25",
    },
  ],
};

/** La misma compra, vencida: CANCELADA por el sistema a los 15 minutos. */
export const compraCancelada: CompraVista = {
  ...compraPendiente,
  estado: EstadoCompra.CANCELADA,
  venceEn: null,
  venceEnLocal: null,
  historial: [
    ...compraPendiente.historial,
    {
      estado: EstadoCompra.CANCELADA,
      autor: { tipo: "sistema" },
      fechaHora: "2026-11-12T18:35:00.000Z",
      fechaHoraLocal: "2026-11-12T15:35",
    },
  ],
};

/** La misma compra, cancelada por Martín antes de pagarla. */
export const compraCanceladaPorElComprador: CompraVista = {
  ...compraPendiente,
  estado: EstadoCompra.CANCELADA,
  venceEn: null,
  venceEnLocal: null,
  historial: [
    ...compraPendiente.historial,
    {
      estado: EstadoCompra.CANCELADA,
      autor: { tipo: "usuario", usuarioId: "usuario-martin" },
      fechaHora: "2026-11-12T18:25:00.000Z",
      fechaHoraLocal: "2026-11-12T15:25",
    },
  ],
};

/** Una compra PENDIENTE de 1 entrada gratis ("Carrera kids" de la Maratón). */
export const compraGratis: CompraVista = {
  ...compraPendiente,
  tipoEntrada: { id: "tipo-maraton-kids", nombre: "Carrera kids" },
  cantidad: 1,
  total: 0,
};

/**
 * Una fila de "Mis compras" (feature 007) armada con una `CompraVista` (por defecto, la pendiente de
 * la Maratón): sin `compradorId` ni `historial`, con `diasRestantes` y `canceladaPor` en `null` salvo
 * que se cambien.
 */
export function miCompra(
  base: CompraVista = compraPendiente,
  cambios: Partial<MiCompraVista> = {},
): MiCompraVista {
  const { id, evento, tipoEntrada, cantidad, total, estado, creadaEn, venceEn, venceEnLocal } = base;
  return {
    id,
    evento,
    tipoEntrada,
    cantidad,
    total,
    estado,
    creadaEn,
    venceEn,
    venceEnLocal,
    diasRestantes: null,
    canceladaPor: null,
    ...cambios,
  };
}

// Datos de "Compras del evento" (feature 008): el Festival de Lucía (10/12 14:00).

/** Una fila de "Compras del evento": Martín, 3 General del Festival, CONFIRMADA, salvo que se cambie. */
export function compraDelEvento(cambios: Partial<CompraDelEventoVista> = {}): CompraDelEventoVista {
  return {
    id: "compra-martin-general",
    comprador: { id: "usuario-martin", nombre: "Martín", apellido: "Benítez" },
    tipoEntrada: { id: "tipo-festival-general", nombre: "General" },
    cantidad: 3,
    total: 18000,
    estado: EstadoCompra.CONFIRMADA,
    creadaEn: "2026-11-18T18:20:00.000Z",
    creadaEnLocal: "2026-11-18T15:20",
    venceEn: null,
    venceEnLocal: null,
    canceladaPor: null,
    entradasUsadas: 0,
    ...cambios,
  };
}

/** La ventana de uso del Festival: de las 10:00 del 10/12 a las 02:00 del 11/12 (hora de Buenos Aires). */
export function ventanaDelFestival(estado: VentanaDeUsoVista["estado"] = "antes"): VentanaDeUsoVista {
  return {
    desde: "2026-12-10T13:00:00.000Z",
    hasta: "2026-12-11T05:00:00.000Z",
    desdeLocal: "2026-12-10T10:00",
    hastaLocal: "2026-12-11T02:00",
    estado,
  };
}

/** `GET /eventos/evento-festival/compras` con esas compras (por defecto, ninguna). */
export function comprasDelFestival(
  compras: CompraDelEventoVista[] = [],
  cambios: Partial<ComprasDelEventoVista> = {},
): ComprasDelEventoVista {
  return {
    evento: {
      id: festivalCompleto.id,
      nombre: festivalCompleto.nombre,
      fechaHoraLocal: festivalCompleto.fechaHoraLocal,
      realizado: false,
    },
    ventanaDeUso: ventanaDelFestival(),
    resumenPorTipo: [],
    compras,
    ...cambios,
  };
}
