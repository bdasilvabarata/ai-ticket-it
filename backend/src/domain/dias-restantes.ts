import { diaDeCalendarioDeBuenosAires } from "./hora-buenos-aires";

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Días de calendario (Buenos Aires) que faltan para un evento, o `null` si ya empezó
 * (`ahora ≥ fechaHoraEvento`, el mismo criterio que `Evento.estaRealizado`). Research R4: un
 * evento de mañana es 1 tanto a las 00:01 como a las 23:59.
 */
export function diasRestantes(fechaHoraEvento: Date, ahora: Date): number | null {
  if (ahora.getTime() >= fechaHoraEvento.getTime()) return null;
  return Math.round(
    (diaDeCalendarioDeBuenosAires(fechaHoraEvento) - diaDeCalendarioDeBuenosAires(ahora)) / MS_POR_DIA,
  );
}
