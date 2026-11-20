import {
  EstadoCompra,
  type CompraDelEventoVista,
  type ComprasDelEventoVista,
  type CompraVista,
  type EntradaDelEventoVista,
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
  entradas: [],
  entradasUsadas: 0,
  canceladaDesde: null,
  reembolso: null,
  cancelable: true,
  motivoNoCancelable: null,
};

/** Los códigos de las 2 entradas de la compra de la Maratón, una vez pagada. */
export const CODIGOS_DE_LA_MARATON = ["7K3MQ9TB", "4HXP2RVA"] as const;

/** La misma compra, pagada por Martín: con sus 2 entradas y sus códigos. */
export const compraConfirmada: CompraVista = {
  ...compraPendiente,
  estado: EstadoCompra.CONFIRMADA,
  venceEn: null,
  venceEnLocal: null,
  entradas: CODIGOS_DE_LA_MARATON.map((codigo) => ({
    codigo,
    estado: EstadoCompra.CONFIRMADA,
    usadaEn: null,
    usadaEnLocal: null,
  })),
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

/** La misma compra, con la primera entrada ya usada (feature 008): la compra queda UTILIZADA. */
export const compraUtilizada: CompraVista = {
  ...compraConfirmada,
  estado: EstadoCompra.UTILIZADA,
  entradasUsadas: 1,
  cancelable: false,
  motivoNoCancelable: "entrada-usada",
  entradas: [
    {
      codigo: CODIGOS_DE_LA_MARATON[0],
      estado: EstadoCompra.UTILIZADA,
      usadaEn: "2026-12-27T10:40:00.000Z",
      usadaEnLocal: "2026-12-27T07:40",
    },
    { codigo: CODIGOS_DE_LA_MARATON[1], estado: EstadoCompra.CONFIRMADA, usadaEn: null, usadaEnLocal: null },
  ],
  historial: [
    ...compraConfirmada.historial,
    {
      estado: EstadoCompra.UTILIZADA,
      autor: { tipo: "usuario", usuarioId: "usuario-lucia" },
      fechaHora: "2026-12-27T10:40:00.000Z",
      fechaHoraLocal: "2026-12-27T07:40",
    },
  ],
};

/** La misma compra, vencida: CANCELADA por el sistema a los 15 minutos. */
export const compraCancelada: CompraVista = {
  ...compraPendiente,
  estado: EstadoCompra.CANCELADA,
  venceEn: null,
  venceEnLocal: null,
  canceladaDesde: "PENDIENTE",
  cancelable: false,
  motivoNoCancelable: "cancelada",
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
  canceladaDesde: "PENDIENTE",
  cancelable: false,
  motivoNoCancelable: "cancelada",
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
 * la Maratón): sin `compradorId`, `historial`, `entradas`, `cancelable` ni `motivoNoCancelable`, con
 * `diasRestantes` y `canceladaPor` en `null` salvo que se cambien.
 */
export function miCompra(
  base: CompraVista = compraPendiente,
  cambios: Partial<MiCompraVista> = {},
): MiCompraVista {
  const {
    id,
    evento,
    tipoEntrada,
    cantidad,
    total,
    estado,
    creadaEn,
    venceEn,
    venceEnLocal,
    entradasUsadas,
    canceladaDesde,
    reembolso,
  } = base;
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
    entradasUsadas,
    canceladaDesde,
    reembolso,
    diasRestantes: null,
    canceladaPor: null,
    ...cambios,
  };
}

// Datos de "Compras del evento" (feature 008): el Festival de Lucía (10/12 14:00).

/**
 * Una fila de "Compras del evento": Martín, 3 General del Festival, CONFIRMADA, salvo que se cambie.
 * Si no se dan, `canceladaDesde` y `reembolso` siguen al estado (feature 009): una CANCELADA, desde
 * PENDIENTE y sin reembolso; una REEMBOLSADA, desde CONFIRMADA con el reembolso confirmado.
 */
export function compraDelEvento(cambios: Partial<CompraDelEventoVista> = {}): CompraDelEventoVista {
  const estado = cambios.estado ?? EstadoCompra.CONFIRMADA;
  const total = cambios.total ?? 18000;
  const reembolsada = estado === EstadoCompra.REEMBOLSADA;
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
    canceladaDesde: reembolsada ? "CONFIRMADA" : estado === EstadoCompra.CANCELADA ? "PENDIENTE" : null,
    reembolso: reembolsada ? { estado: "confirmado", monto: total } : null,
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

/**
 * `GET /eventos/evento-festival/entradas/7K3MQ9TB`: una entrada de Martín, 3 General del Festival,
 * CONFIRMADA y con la ventana abierta, salvo que se cambie (`compra` se mezcla).
 */
export function entradaDelEvento(
  cambios: Omit<Partial<EntradaDelEventoVista>, "compra"> & {
    compra?: Partial<EntradaDelEventoVista["compra"]>;
  } = {},
): EntradaDelEventoVista {
  const { compra, ...resto } = cambios;
  return {
    codigo: "7K3MQ9TB",
    estado: EstadoCompra.CONFIRMADA,
    usadaEn: null,
    usadaEnLocal: null,
    ventanaDeUso: ventanaDelFestival("abierta"),
    ...resto,
    compra: {
      id: "compra-martin-general",
      comprador: { id: "usuario-martin", nombre: "Martín", apellido: "Benítez" },
      tipoEntrada: { id: "tipo-festival-general", nombre: "General" },
      cantidad: 3,
      estado: EstadoCompra.CONFIRMADA,
      entradasUsadas: 0,
      ...compra,
    },
  };
}
