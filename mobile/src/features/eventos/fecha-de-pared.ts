// Fecha y hora de pared ⇄ el `Date` del selector nativo (research R11). El selector trabaja en la
// zona del teléfono; ida y vuelta usan esa misma zona, así que los componentes elegidos se
// conservan aunque el teléfono no esté en Buenos Aires. Nunca se convierten zonas: el servidor
// interpreta la hora de pared en Buenos Aires.

const dos = (n: number) => String(n).padStart(2, "0");

/** "2026-12-01T20:00" → `Date` con esos componentes en la hora local del teléfono. */
export function aFechaDelSelector(fechaHoraLocal: string): Date {
  const [anio = NaN, mes = NaN, dia = NaN, hora = NaN, minuto = NaN] = fechaHoraLocal
    .split(/[-T:]/)
    .map(Number);
  return new Date(anio, mes - 1, dia, hora, minuto);
}

/** `Date` del selector → "YYYY-MM-DDTHH:mm" con sus componentes locales (sin segundos ni zona). */
export function aFechaDePared(fecha: Date): string {
  return (
    `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}` +
    `T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`
  );
}
