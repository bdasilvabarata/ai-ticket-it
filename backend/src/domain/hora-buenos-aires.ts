// Hora de pared de Buenos Aires ⇄ instante (research R10). Argentina es UTC−3 todo el año (sin
// horario de verano vigente), así que el desfase es fijo y no hay horas ambiguas. Este es el
// único lugar que lo conoce: si cambiara, se toca solo acá.
const DESFASE_UTC_HORAS = 3;

const dos = (n: number) => String(n).padStart(2, "0");

/**
 * Instante de una fecha y hora de pared de Buenos Aires ("YYYY-MM-DDTHH:mm"). No valida el
 * formato: lo hace `fechaDeParedSchema` (validations/comunes.ts) antes de llamarla.
 */
export function instanteDesdeHoraDeBuenosAires(pared: string): Date {
  const [anio = NaN, mes = NaN, dia = NaN, hora = NaN, minuto = NaN] = pared.split(/[-T:]/).map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia, hora + DESFASE_UTC_HORAS, minuto));
}

/** Hora de pared de Buenos Aires ("YYYY-MM-DDTHH:mm") de un instante, sin depender de la zona del proceso. */
export function horaDeBuenosAires(instante: Date): string {
  const local = new Date(instante.getTime() - DESFASE_UTC_HORAS * 60 * 60 * 1000);
  return (
    `${local.getUTCFullYear()}-${dos(local.getUTCMonth() + 1)}-${dos(local.getUTCDate())}` +
    `T${dos(local.getUTCHours())}:${dos(local.getUTCMinutes())}`
  );
}

/**
 * Medianoche UTC de la fecha de pared de Buenos Aires de un instante (en milisegundos): sirve para
 * restar días de calendario.
 */
export function diaDeCalendarioDeBuenosAires(instante: Date): number {
  const local = new Date(instante.getTime() - DESFASE_UTC_HORAS * 60 * 60 * 1000);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
}
