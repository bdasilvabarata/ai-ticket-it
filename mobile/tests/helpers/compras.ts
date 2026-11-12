import { EstadoCompra, type CompraVista, type MisComprasDelEventoVista } from "@ai-ticket-it/shared";

import { maratonCompleta } from "./eventos";

// Datos de compras para los tests de la feature 006.

/** Lo que responde `renderConDependencias` si un test no registra `mis-compras` (R19). */
export const sinCompras: MisComprasDelEventoVista = { pendientes: [], restantesPorTipo: [] };

/** `mis-compras` con esos restantes por tipo y sin pendientes. */
export function conRestantes(restantes: Record<string, number>): MisComprasDelEventoVista {
  return {
    pendientes: [],
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
