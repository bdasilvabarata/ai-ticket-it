// Textos derivados de una compra, puros (sin React ni `Intl`), como los de `eventos`.

import {
  EstadoCompra,
  type CompraDelEventoVista,
  type CompraVista,
  type EntradaDelEventoVista,
  type MensajeVista,
  type MiCompraVista,
  type MotivoNoCancelable,
  type ParteDeLaCompraVista,
  type ResumenTipoEntradaVista,
  type RolEnLaCompra,
  type VentanaDeUsoVista,
} from "@ai-ticket-it/shared";

import { textoFechaHora, textoPrecio } from "../eventos";
import { nombreCompleto } from "../usuarios";

/** 0 → "Gratis"; 240000 → "$ 240.000". */
export function textoTotal(total: number): string {
  return textoPrecio(total);
}

/** 1 → "1 entrada"; 2 → "2 entradas". */
export function textoCantidad(cantidad: number): string {
  return cantidad === 1 ? "1 entrada" : `${cantidad} entradas`;
}

/** "2026-11-12T15:35" (hora de pared de Buenos Aires) → "Podés pagar hasta las 15:35". */
export function textoVencimiento(venceEnLocal: string): string {
  return `Podés pagar hasta las ${venceEnLocal.slice(11, 16)}`;
}

/**
 * El aviso de una compra CANCELADA. Si se canceló después de confirmada (feature 009), con el
 * reembolso pendiente si es paga; si no, según quién la canceló (el último cambio de su historial):
 * el sistema, al vencer, o su comprador, antes de pagarla.
 */
export function textoCancelada(compra: CompraVista): string {
  if (compra.reembolso?.estado === "pendiente") {
    return `Cancelaste esta compra. El organizador tiene que confirmar el reembolso de ${textoTotal(compra.reembolso.monto)}`;
  }
  if (compra.canceladaDesde === "CONFIRMADA") return "Cancelaste esta compra";
  const ultimo = compra.historial[compra.historial.length - 1];
  return ultimo?.autor.tipo === "usuario"
    ? "Cancelaste esta compra: sus entradas volvieron a estar disponibles."
    : "Esta compra venció: sus entradas volvieron a estar disponibles.";
}

/** El mensaje del `Alert` que confirma la cancelación de una compra confirmada (feature 009). */
export function textoConfirmarCancelacion(compra: CompraVista): string {
  const cuales =
    compra.cantidad === 1 ? "Se cancela tu entrada" : `Se cancelan tus ${compra.cantidad} entradas`;
  if (compra.total > 0) {
    return `${cuales}. El organizador tiene que confirmar el reembolso de ${textoTotal(compra.total)}. No se puede deshacer.`;
  }
  const vuelven = compra.cantidad === 1 ? "vuelve a estar disponible" : "vuelven a estar disponibles";
  return `${cuales} y ${vuelven}. No se puede deshacer.`;
}

/** Una REEMBOLSADA, para su comprador (feature 009): "Te devolvimos $ 240.000". */
export function textoReembolsada(compra: Pick<CompraVista, "total" | "reembolso">): string {
  return `Te devolvimos ${textoTotal(compra.reembolso?.monto ?? compra.total)}`;
}

/** El mensaje del `Alert` con el que el organizador confirma un reembolso (feature 009). */
export function textoConfirmarReembolso(compra: CompraDelEventoVista): string {
  return `Confirmás que le devolviste ${textoTotal(compra.reembolso?.monto ?? compra.total)}. No se puede deshacer.`;
}

/** 1 → "Tenés 1 entrada confirmada para este evento"; 3 → "Tenés 3 entradas confirmadas…". */
export function textoEntradasConfirmadas(cantidad: number): string {
  return cantidad === 1
    ? "Tenés 1 entrada confirmada para este evento"
    : `Tenés ${cantidad} entradas confirmadas para este evento`;
}

/** Días que faltan para un evento confirmado: 0 → "Hoy · 21:00"; 1 → "Mañana"; 10 → "Faltan 10 días". */
export function textoDiasRestantes(dias: number, fechaHoraLocal: string): string {
  if (dias === 0) return `Hoy · ${fechaHoraLocal.slice(11, 16)}`;
  if (dias === 1) return "Mañana";
  return `Faltan ${dias} días`;
}

/** La acción de pago de una pendiente: 0 → "Confirmar" (gratis); con precio → "Pagar". */
export function textoAccionDePago(total: number): string {
  return total === 0 ? "Confirmar" : "Pagar";
}

/** El aviso que va junto al estado de una fila de "Mis compras", o `null` si no lleva (contracts/app.md). */
export function textoAvisoDeMiCompra(compra: MiCompraVista): string | null {
  switch (compra.estado) {
    case EstadoCompra.CONFIRMADA:
      if (compra.evento.realizado) return "Evento realizado";
      return compra.diasRestantes === null
        ? null
        : textoDiasRestantes(compra.diasRestantes, compra.evento.fechaHoraLocal);
    case EstadoCompra.PENDIENTE:
      return compra.venceEnLocal === null ? null : textoVencimiento(compra.venceEnLocal);
    case EstadoCompra.CANCELADA:
      if (compra.reembolso?.estado === "pendiente") {
        return `El organizador tiene que confirmar el reembolso de ${textoTotal(compra.reembolso.monto)}`;
      }
      if (compra.canceladaDesde === "CONFIRMADA") return "Cancelaste esta compra";
      if (compra.canceladaPor === "sistema") return "Venció sin pagarse";
      return compra.canceladaPor === "usuario" ? "La cancelaste" : null;
    case EstadoCompra.UTILIZADA:
      return textoEntradasUsadas(compra.entradasUsadas, compra.cantidad);
    case EstadoCompra.REEMBOLSADA:
      return textoReembolsada(compra);
  }
}

// Feature 008: "Compras del evento" (organizador).

/** "2026-11-18T15:20" → "18/11 15:20" (fecha y hora de pared, sin convertir zonas). */
function diaYHora(fechaHoraLocal: string): string {
  return `${fechaHoraLocal.slice(8, 10)}/${fechaHoraLocal.slice(5, 7)} ${fechaHoraLocal.slice(11, 16)}`;
}

/** "2026-11-18T15:20" (hora de pared de Buenos Aires) → "Comprada el 18/11 15:20". */
export function textoCompradaEl(creadaEnLocal: string): string {
  return `Comprada el ${diaYHora(creadaEnLocal)}`;
}

/** Cuándo se pueden registrar ingresos, según el estado que decidió el servidor (contracts/app.md). */
export function textoVentanaDeUso(ventana: VentanaDeUsoVista): string {
  switch (ventana.estado) {
    case "antes":
      return `Podés registrar ingresos desde el ${diaYHora(ventana.desdeLocal)}`;
    case "abierta":
      return `Ingresos habilitados hasta el ${diaYHora(ventana.hastaLocal)}`;
    case "despues":
      return `Los ingresos se registraron hasta el ${diaYHora(ventana.hastaLocal)}`;
  }
}

/** (1, 3) → "1 de 3 entradas usadas"; (1, 1) → "1 de 1 entrada usada". */
export function textoEntradasUsadas(usadas: number, cantidad: number): string {
  return cantidad === 1 ? `${usadas} de 1 entrada usada` : `${usadas} de ${cantidad} entradas usadas`;
}

/** El aviso que va junto al estado de una fila de "Compras del evento", o `null` si no lleva. */
export function textoAvisoDeCompraDelEvento(compra: CompraDelEventoVista): string | null {
  switch (compra.estado) {
    case EstadoCompra.PENDIENTE:
      return compra.venceEnLocal === null
        ? null
        : `Puede pagarla hasta las ${compra.venceEnLocal.slice(11, 16)}`;
    case EstadoCompra.CANCELADA:
      if (compra.reembolso?.estado === "pendiente") {
        return `La canceló el comprador · Reembolso pendiente de ${textoTotal(compra.reembolso.monto)}`;
      }
      if (compra.canceladaPor === "sistema") return "Venció sin pagarse";
      return compra.canceladaPor === "usuario" ? "La canceló el comprador" : null;
    case EstadoCompra.UTILIZADA:
      return textoEntradasUsadas(compra.entradasUsadas, compra.cantidad);
    case EstadoCompra.REEMBOLSADA:
      return "Reembolso confirmado";
    default:
      return null;
  }
}

/** Cómo viene la venta de un tipo: "117 disponibles · 0 pendientes · 3 vendidas · 1 usada". */
export function textoResumenDeTipo(resumen: ResumenTipoEntradaVista): string {
  const contar = (n: number, singular: string) => `${n} ${n === 1 ? singular : `${singular}s`}`;
  return [
    contar(resumen.disponibles, "disponible"),
    contar(resumen.pendientes, "pendiente"),
    contar(resumen.vendidas, "vendida"),
    contar(resumen.usadas, "usada"),
  ].join(" · ");
}

/** "7K3MQ9TB" → "7K3M-Q9TB": el código en dos grupos, para leerlo y dictarlo. */
export function textoCodigo(codigo: string): string {
  return `${codigo.slice(0, 4)}-${codigo.slice(4)}`;
}

/** "7K3MQ9TB" → "7 K 3 M Q 9 T B": TalkBack lo lee de a un carácter, no como una palabra. */
export function textoCodigoAccesible(codigo: string): string {
  return codigo.split("").join(" ");
}

/** " 7k3m-q9tb " → "7K3MQ9TB" (solo para la clave de la consulta; el servidor normaliza igual). */
export function normalizarCodigo(texto: string): string {
  return texto.replace(/[\s-]/g, "").toUpperCase();
}

/** Por qué no se puede registrar el ingreso con esa entrada, o `null` si se puede (contracts/app.md). */
export function textoMotivoNoUsable(entrada: EntradaDelEventoVista): string | null {
  const { ventanaDeUso } = entrada;
  // La ventana va primero, como en el servidor (409 FUERA_DE_HORARIO_DE_USO antes que el estado).
  if (ventanaDeUso.estado !== "abierta") {
    return `El ingreso se registra desde el ${diaYHora(ventanaDeUso.desdeLocal)} hasta el ${diaYHora(ventanaDeUso.hastaLocal)}.`;
  }
  switch (entrada.estado) {
    case EstadoCompra.UTILIZADA:
      return entrada.usadaEnLocal === null
        ? "Esta entrada ya se utilizó."
        : `Esta entrada ya se utilizó el ${diaYHora(entrada.usadaEnLocal)}.`;
    case EstadoCompra.PENDIENTE:
      return "La compra de esta entrada todavía no se pagó.";
    case EstadoCompra.CANCELADA:
      return "La compra de esta entrada está cancelada.";
    case EstadoCompra.REEMBOLSADA:
      return "La compra de esta entrada fue reembolsada.";
    default:
      return null;
  }
}

/**
 * Por qué el comprador ya no puede cancelar la compra, para mostrar en lugar del botón, o `null` si
 * no hay nada que decir: una cancelada o reembolsada ya lo dice su aviso (contracts/app.md).
 */
export function textoMotivoNoCancelable(motivo: MotivoNoCancelable | null): string | null {
  switch (motivo) {
    case "evento-empezado":
      return "El evento ya empezó";
    case "entrada-usada":
      return "Ya usaste una entrada";
    default:
      return null;
  }
}

// Chat de la compra (feature 011, R12).

/** El chat sin mensajes: el encabezado y el campo siguen a la vista. */
export const SIN_MENSAJES = "Todavía no hay mensajes";

/** "comprador" → "Comprador"; "organizador" → "Organizador". */
export function textoRolEnLaCompra(rol: RolEnLaCompra): string {
  return rol === "comprador" ? "Comprador" : "Organizador";
}

/** "Lucía Álvarez · Organizador". */
function textoParte(parte: ParteDeLaCompraVista): string {
  return `${nombreCompleto(parte)} · ${textoRolEnLaCompra(parte.rol)}`;
}

/** "Con Lucía Álvarez · Organizador". */
export function textoOtraParte(parte: ParteDeLaCompraVista): string {
  return `Con ${textoParte(parte)}`;
}

/** "Vos" si lo escribió `usuarioId`; si no, "Lucía Álvarez · Organizador". */
export function textoAutorDelMensaje(mensaje: MensajeVista, usuarioId: string): string {
  return mensaje.autor.id === usuarioId ? "Vos" : textoParte(mensaje.autor);
}

/**
 * La etiqueta accesible de un mensaje, que TalkBack lee como una unidad (FR-021): "Vos, comprador,
 * vie 20 nov 2026 · 14:35: ¿A qué hora abren?" o "Lucía Álvarez, organizador, …: …". El rol propio
 * solo se anuncia acá (en pantalla, el propio dice "Vos").
 */
export function etiquetaDelMensaje(mensaje: MensajeVista, usuarioId: string): string {
  const autor = mensaje.autor.id === usuarioId ? "Vos" : nombreCompleto(mensaje.autor);
  return `${autor}, ${mensaje.autor.rol}, ${textoFechaHora(mensaje.enviadoEnLocal)}: ${mensaje.texto}`;
}
