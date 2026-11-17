import {
  EstadoCompra,
  type CambioEstadoCompraVista,
  type CompraVista,
  type MiCompraVista,
} from "@ai-ticket-it/shared";
import type { CambioEstadoCompra, Compra } from "../domain/compra";
import { diasRestantes } from "../domain/dias-restantes";
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

type DatosComunes = Omit<CompraVista, "compradorId" | "historial">;

/**
 * Lo que comparten `CompraVista` y `MiCompraVista`: la compra tal como llega (quien llama decide si
 * va al día, con `alDia(ahora)`) con su evento y su tipo actuales. El nombre del tipo sale del
 * evento: un tipo con compras no se puede quitar. `venceEn` solo si está PENDIENTE.
 */
function datosComunes(compra: Compra, evento: Evento, ahora: Date): DatosComunes {
  const pendiente = compra.estado === EstadoCompra.PENDIENTE;
  return {
    id: compra.id,
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
  };
}

/** La compra con su evento, su comprador y su historial (feature 006). */
export function aCompraVista(compra: Compra, evento: Evento, ahora: Date): CompraVista {
  const { id, ...resto } = datosComunes(compra, evento, ahora);
  return {
    id,
    compradorId: compra.compradorId,
    ...resto,
    historial: compra.historial.map(aCambioEstadoCompraVista),
  };
}

/**
 * Una fila de "Mis compras" (feature 007): los datos comunes, sin historial ni comprador, más quién
 * la canceló (solo si está CANCELADA: el sistema si venció sin pagarse, si no, su comprador) y los
 * días de calendario que faltan para el evento (solo si está CONFIRMADA; `null` si ya empezó).
 */
export function aMiCompraVista(compra: Compra, evento: Evento, ahora: Date): MiCompraVista {
  const cancelada = compra.estado === EstadoCompra.CANCELADA;
  const confirmada = compra.estado === EstadoCompra.CONFIRMADA;
  return {
    ...datosComunes(compra, evento, ahora),
    diasRestantes: confirmada ? diasRestantes(evento.fechaHora, ahora) : null,
    canceladaPor: cancelada ? (compra.fueVencida() ? "sistema" : "usuario") : null,
  };
}
