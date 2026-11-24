// Textos derivados de un evento, sin React y sin `Intl` (research R18): el resultado es el mismo
// en Node (tests) y en Hermes (teléfono), y no depende de la zona del teléfono.

import {
  LIMITES_RESENIA,
  type OrdenCatalogo,
  type ReseniaDelOrganizadorVista,
  type SentidoCatalogo,
} from "@ai-ticket-it/shared";

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"] as const;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;

/** "2026-12-01T20:00" (hora de pared de Buenos Aires, la `fechaHoraLocal` del servidor) → "mar 1 dic 2026 · 20:00". */
export function textoFechaHora(fechaHoraLocal: string): string {
  const [fecha = "", hora = ""] = fechaHoraLocal.split("T");
  const [anio = NaN, mes = NaN, dia = NaN] = fecha.split("-").map(Number);
  const diaDeLaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  return `${DIAS[diaDeLaSemana] ?? ""} ${dia} ${MESES[mes - 1] ?? ""} ${anio} · ${hora}`;
}

/** 0 → "Gratis"; 15000 → "$ 15.000". */
export function textoPrecio(precio: number): string {
  if (precio === 0) return "Gratis";
  return `$ ${String(precio).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

export function textoCantidadTipos(cantidad: number): string {
  return cantidad === 1 ? "1 tipo de entrada" : `${cantidad} tipos de entrada`;
}

/** Cupo disponible: 0 → "Agotado"; 30 → "30 disponibles". */
export function textoCupo(cupo: number): string {
  if (cupo === 0) return "Agotado";
  return cupo === 1 ? "1 disponible" : `${cupo} disponibles`;
}

/** El precio "desde" de una tarjeta: 0 → "Gratis"; 8000 → "desde $ 8.000". */
export function textoPrecioDesde(precio: number): string {
  return precio === 0 ? "Gratis" : `desde ${textoPrecio(precio)}`;
}

/**
 * El puntaje del organizador, redondeado al décimo con coma: `null` → "Sin reseñas" (nunca "0");
 * 4.5 y 12 → "4,5 · 12 reseñas"; 5 y 1 → "5,0 · 1 reseña".
 */
export function textoPuntaje({
  puntaje,
  cantidadResenias,
}: {
  puntaje: number | null;
  cantidadResenias: number;
}): string {
  if (puntaje === null) return "Sin reseñas";
  const redondeado = (Math.round(puntaje * 10) / 10).toFixed(1).replace(".", ",");
  return `${redondeado} · ${cantidadResenias === 1 ? "1 reseña" : `${cantidadResenias} reseñas`}`;
}

const TEXTOS_SENTIDO: Record<OrdenCatalogo, Record<SentidoCatalogo, string>> = {
  fecha: { asc: "Más próximos primero", desc: "Más lejanos primero" },
  precio: { asc: "Más baratos primero", desc: "Más caros primero" },
  puntaje: { asc: "Menor puntaje primero", desc: "Mejor puntaje primero" },
};

/** Qué queda primero con ese orden y sentido: ("precio", "desc") → "Más caros primero". */
export function textoSentido(orden: OrdenCatalogo, sentido: SentidoCatalogo): string {
  return TEXTOS_SENTIDO[orden][sentido];
}

/** La puntuación de una reseña (feature 012): 4 → "Puntuación: 4 de 5". */
export function textoPuntuacion(puntuacion: number): string {
  return `Puntuación: ${puntuacion} de ${LIMITES_RESENIA.puntuacionMaxima}`;
}

/** El vacío de "Reseñas del organizador" (feature 012): sin puntaje, ni "0" ni "Sin reseñas". */
export const SIN_RESENIAS = "Todavía no tiene reseñas";

/** "2026-11-15T21:00" (hora de pared de Buenos Aires) → "dom 15 nov 2026": el día, sin hora. */
export function textoFechaResenia(creadaEnLocal: string): string {
  return textoFechaHora(creadaEnLocal).split(" · ")[0] ?? "";
}

/** La etiqueta accesible de una fila de "Reseñas del organizador": un único elemento por reseña. */
export function etiquetaDeResenia(resenia: ReseniaDelOrganizadorVista): string {
  const { autor, evento, puntuacion, comentario, creadaEnLocal } = resenia;
  const encabezado = `${autor.nombre} ${autor.apellido}, ${evento.nombre}, ${textoFechaResenia(creadaEnLocal)}`;
  const cuerpo = `${textoPuntuacion(puntuacion)}.${comentario === null ? "" : ` ${comentario}`}`;
  return `${encabezado}: ${cuerpo}`;
}
