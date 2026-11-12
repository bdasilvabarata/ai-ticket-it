import { EstadoCompra, type CambioEstadoCompraVista, type CompraVista } from "@ai-ticket-it/shared";
import type { CambioEstadoCompra, Compra } from "../domain/compra";
import type { Evento } from "../domain/evento";
import { horaDeBuenosAires } from "../domain/hora-buenos-aires";

// Vistas explícitas de compras (principio V): campos elegidos, nunca la entidad completa.

function aCambioEstadoCompraVista(cambio: CambioEstadoCompra): CambioEstadoCompraVista {
  return {
    estado: cambio.estado,
    autor:
      cambio.autor.tipo === "usuario"
        ? { tipo: "usuario", usuarioId: cambio.autor.usuarioId }
        : { tipo: "sistema" },
    fechaHora: cambio.fechaHora.toISOString(),
    fechaHoraLocal: horaDeBuenosAires(cambio.fechaHora),
  };
}

/**
 * La compra tal como llega (quien llama decide si va al día, con `alDia(ahora)`), con su evento. El
 * nombre del tipo sale del evento: un tipo con compras no se puede quitar. `venceEn` solo si está
 * PENDIENTE.
 */
export function aCompraVista(compra: Compra, evento: Evento, ahora: Date): CompraVista {
  const pendiente = compra.estado === EstadoCompra.PENDIENTE;
  return {
    id: compra.id,
    compradorId: compra.compradorId,
    evento: {
      id: evento.id,
      nombre: evento.nombre,
      fechaHora: evento.fechaHora.toISOString(),
      fechaHoraLocal: horaDeBuenosAires(evento.fechaHora),
      realizado: evento.estaRealizado(ahora),
    },
    tipoEntrada: {
      id: compra.tipoEntradaId,
      nombre: evento.buscarTipoEntrada(compra.tipoEntradaId)?.nombre ?? "",
    },
    cantidad: compra.cantidad,
    total: compra.total,
    estado: compra.estado,
    creadaEn: compra.creadaEn.toISOString(),
    venceEn: pendiente ? compra.venceEn.toISOString() : null,
    venceEnLocal: pendiente ? horaDeBuenosAires(compra.venceEn) : null,
    historial: compra.historial.map(aCambioEstadoCompraVista),
  };
}
