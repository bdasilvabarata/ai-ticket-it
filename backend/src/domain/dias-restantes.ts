import { horaDeBuenosAires } from "./hora-buenos-aires";

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Medianoche UTC de la fecha de pared de Buenos Aires de un instante: sirve para restar días. */
function diaDeCalendario(instante: Date): number {
  const [anio = NaN, mes = NaN, dia = NaN] = horaDeBuenosAires(instante).slice(0, 10).split("-").map(Number);
  return Date.UTC(anio, mes - 1, dia);
}

/**
 * Días de calendario (Buenos Aires) que faltan para un evento, o `null` si ya empezó
 * (`ahora ≥ fechaHoraEvento`, el mismo criterio que `Evento.estaRealizado`). Research R4: un
 * evento de mañana es 1 tanto a las 00:01 como a las 23:59.
 */
export function diasRestantes(fechaHoraEvento: Date, ahora: Date): number | null {
  if (ahora.getTime() >= fechaHoraEvento.getTime()) return null;
  return Math.round((diaDeCalendario(fechaHoraEvento) - diaDeCalendario(ahora)) / MS_POR_DIA);
}
