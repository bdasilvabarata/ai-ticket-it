import {
  EstadoCompra,
  type CambioEstadoCompraVista,
  type CompraDelEventoVista,
  type CompraVista,
  type EntradaDelEventoVista,
  type EntradaVista,
  type MiCompraVista,
  type ReembolsoVista,
  type ResumenTipoEntradaVista,
  type VentanaDeUsoVista,
} from "@ai-ticket-it/shared";
import type { CambioEstadoCompra, Compra, Entrada } from "../domain/compra";
import type { ResumenDeTipo } from "../domain/compras-del-evento";
import { diasRestantes } from "../domain/dias-restantes";
import type { Evento, TipoEntrada } from "../domain/evento";
import { horaDeBuenosAires } from "../domain/hora-buenos-aires";
import type { Usuario } from "../domain/usuario";
import { estadoDeVentana, ventanaDeUso } from "../domain/ventana-de-uso";

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

/** Una entrada con su estado en `compra` (que llega al día) y cuándo se usó (feature 008). */
export function aEntradaVista(entrada: Entrada, compra: Compra): EntradaVista {
  const usadaEn = entrada.usadaEn;
  return {
    codigo: entrada.codigo,
    estado: compra.estadoDe(entrada),
    usadaEn: usadaEn ? usadaEn.toISOString() : null,
    usadaEnLocal: usadaEn ? horaDeBuenosAires(usadaEn) : null,
  };
}

/**
 * El reembolso de la compra (feature 009, R7): `pendiente` si falta que el organizador lo confirme,
 * `confirmado` en una REEMBOLSADA y, si no (también en una gratis), `null`. El monto es el total.
 */
export function aReembolsoVista(compra: Compra): ReembolsoVista | null {
  if (compra.tieneReembolsoPendiente()) return { estado: "pendiente", monto: compra.total };
  if (compra.estado === EstadoCompra.REEMBOLSADA) return { estado: "confirmado", monto: compra.total };
  return null;
}

/** Quién la canceló, según el cambio a CANCELADA (también en una REEMBOLSADA, 009); si no hay, `null`. */
function canceladaPor(compra: Compra): "sistema" | "usuario" | null {
  const cambio = compra.cambioDeCancelacion;
  if (!cambio) return null;
  return cambio.autor.tipo === "sistema" ? "sistema" : "usuario";
}

type DatosComunes = Omit<
  CompraVista,
  "compradorId" | "historial" | "entradas" | "cancelable" | "motivoNoCancelable"
>;

/**
 * Lo que comparten `CompraVista` y `MiCompraVista`: la compra tal como llega (quien llama decide si
 * va al día, con `alDia(ahora)`) con su evento y su tipo actuales. El nombre del tipo sale del
 * evento: un tipo con compras no se puede quitar. `venceEn` solo si está PENDIENTE; desde dónde se
 * canceló y el reembolso, derivados del historial (feature 009).
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
    entradasUsadas: compra.entradasUsadas,
    canceladaDesde: compra.canceladaDesde,
    reembolso: aReembolsoVista(compra),
  };
}

/**
 * La compra con su evento, su comprador y su historial (feature 006), más sus entradas con código
 * solo si está CONFIRMADA o UTILIZADA (feature 008, R11: es una vista para su comprador) y si se
 * puede cancelar en `ahora` (feature 009, R6).
 */
export function aCompraVista(compra: Compra, evento: Evento, ahora: Date): CompraVista {
  const { id, ...resto } = datosComunes(compra, evento, ahora);
  const conCodigos = compra.estado === EstadoCompra.CONFIRMADA || compra.estado === EstadoCompra.UTILIZADA;
  const motivoNoCancelable = compra.motivoNoCancelable(evento.fechaHora, ahora);
  return {
    id,
    compradorId: compra.compradorId,
    ...resto,
    historial: compra.historial.map(aCambioEstadoCompraVista),
    entradas: conCodigos ? compra.entradas.map((entrada) => aEntradaVista(entrada, compra)) : [],
    cancelable: motivoNoCancelable === null,
    motivoNoCancelable,
  };
}

/**
 * Una fila de "Mis compras" (feature 007): los datos comunes, sin historial ni comprador, más quién
 * la canceló (en CANCELADA o REEMBOLSADA: el sistema si venció sin pagarse, si no, su comprador) y
 * los días de calendario que faltan para el evento (solo si está CONFIRMADA; `null` si ya empezó).
 */
export function aMiCompraVista(compra: Compra, evento: Evento, ahora: Date): MiCompraVista {
  const confirmada = compra.estado === EstadoCompra.CONFIRMADA;
  return {
    ...datosComunes(compra, evento, ahora),
    diasRestantes: confirmada ? diasRestantes(evento.fechaHora, ahora) : null,
    canceladaPor: canceladaPor(compra),
  };
}

/**
 * Una fila de "Compras del evento" (feature 008): la compra tal como llega (al día), su comprador y
 * su tipo actual, **sin códigos** de entrada ni historial (FR-012b). `venceEn` solo si está
 * PENDIENTE; `canceladaPor`, `canceladaDesde` y `reembolso` en CANCELADA o REEMBOLSADA (009).
 */
export function aCompraDelEventoVista(
  compra: Compra,
  comprador: Usuario,
  tipo: TipoEntrada | null,
): CompraDelEventoVista {
  const pendiente = compra.estado === EstadoCompra.PENDIENTE;
  return {
    id: compra.id,
    comprador: { id: comprador.id, nombre: comprador.nombre, apellido: comprador.apellido },
    tipoEntrada: { id: compra.tipoEntradaId, nombre: tipo?.nombre ?? "" },
    cantidad: compra.cantidad,
    total: compra.total,
    estado: compra.estado,
    creadaEn: compra.creadaEn.toISOString(),
    creadaEnLocal: horaDeBuenosAires(compra.creadaEn),
    venceEn: pendiente ? compra.venceEn.toISOString() : null,
    venceEnLocal: pendiente ? horaDeBuenosAires(compra.venceEn) : null,
    canceladaPor: canceladaPor(compra),
    entradasUsadas: compra.entradasUsadas,
    canceladaDesde: compra.canceladaDesde,
    reembolso: aReembolsoVista(compra),
  };
}

/** La ventana de uso de un evento que empieza en `fechaHora`, con su estado en `ahora` (FR-016). */
export function aVentanaDeUsoVista(fechaHora: Date, ahora: Date): VentanaDeUsoVista {
  const ventana = ventanaDeUso(fechaHora);
  return {
    desde: ventana.desde.toISOString(),
    hasta: ventana.hasta.toISOString(),
    desdeLocal: horaDeBuenosAires(ventana.desde),
    hastaLocal: horaDeBuenosAires(ventana.hasta),
    estado: estadoDeVentana(ventana, ahora),
  };
}

/** Cómo viene la venta de un tipo (feature 008, FR-007): el tipo con su id y nombre, y los números. */
export function aResumenTipoEntradaVista(resumen: ResumenDeTipo): ResumenTipoEntradaVista {
  return {
    tipoEntrada: { id: resumen.tipoEntrada.id, nombre: resumen.tipoEntrada.nombre },
    disponibles: resumen.disponibles,
    pendientes: resumen.pendientes,
    vendidas: resumen.vendidas,
    usadas: resumen.usadas,
  };
}

/**
 * Una entrada buscada por el organizador (feature 008): la entrada con su estado en la compra (que
 * llega al día), los datos de la compra con su comprador y su tipo actual, y la ventana de uso del
 * evento con su estado en `ahora`. Es la única vista del organizador con un código: el que ingresó.
 */
export function aEntradaDelEventoVista(
  compra: Compra,
  codigo: string,
  comprador: Usuario,
  evento: Evento,
  ahora: Date,
): EntradaDelEventoVista {
  // El service ya encontró la compra por ese código.
  const entrada = compra.entradas.find((e) => e.codigo === codigo)!;
  return {
    ...aEntradaVista(entrada, compra),
    compra: {
      id: compra.id,
      comprador: { id: comprador.id, nombre: comprador.nombre, apellido: comprador.apellido },
      tipoEntrada: {
        id: compra.tipoEntradaId,
        nombre: evento.buscarTipoEntrada(compra.tipoEntradaId)?.nombre ?? "",
      },
      cantidad: compra.cantidad,
      estado: compra.estado,
      entradasUsadas: compra.entradasUsadas,
    },
    ventanaDeUso: aVentanaDeUsoVista(evento.fechaHora, ahora),
  };
}
