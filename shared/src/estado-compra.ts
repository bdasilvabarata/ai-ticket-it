/** Estados posibles de una compra (constitución, "Dominio"). */
export const EstadoCompra = {
  PENDIENTE: "PENDIENTE",
  CONFIRMADA: "CONFIRMADA",
  UTILIZADA: "UTILIZADA",
  CANCELADA: "CANCELADA",
  REEMBOLSADA: "REEMBOLSADA",
} as const;

export type EstadoCompra = (typeof EstadoCompra)[keyof typeof EstadoCompra];
