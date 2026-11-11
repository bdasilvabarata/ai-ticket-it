// Textos derivados de un evento, sin React y sin `Intl` (research R18): el resultado es el mismo
// en Node (tests) y en Hermes (teléfono), y no depende de la zona del teléfono.

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
