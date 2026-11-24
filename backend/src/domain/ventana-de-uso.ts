import { ReglaDeNegocioError } from "./errores";
import { horaDeBuenosAires } from "./hora-buenos-aires";

/** Ventana fija para registrar el ingreso (FR-016, research R8). */
export const HORAS_ANTES_DEL_INICIO = 4;
export const HORAS_DESPUES_DEL_INICIO = 12;

const MS_POR_HORA = 60 * 60 * 1000;

export interface VentanaDeUso {
  desde: Date;
  hasta: Date;
}

export type EstadoDeVentana = "antes" | "abierta" | "despues";

/** Desde 4 horas antes hasta 12 horas después del inicio del evento. */
export function ventanaDeUso(fechaHora: Date): VentanaDeUso {
  return {
    desde: new Date(fechaHora.getTime() - HORAS_ANTES_DEL_INICIO * MS_POR_HORA),
    hasta: new Date(fechaHora.getTime() + HORAS_DESPUES_DEL_INICIO * MS_POR_HORA),
  };
}

/** `"abierta"` si `desde ≤ ahora ≤ hasta` (ambos inclusive); si no, `"antes"` o `"despues"`. */
export function estadoDeVentana({ desde, hasta }: VentanaDeUso, ahora: Date): EstadoDeVentana {
  if (ahora.getTime() < desde.getTime()) return "antes";
  if (ahora.getTime() > hasta.getTime()) return "despues";
  return "abierta";
}

/** "DD/MM HH:mm" en hora de Buenos Aires. */
function diaYHora(instante: Date): string {
  const pared = horaDeBuenosAires(instante); // "YYYY-MM-DDTHH:mm"
  return `${pared.slice(8, 10)}/${pared.slice(5, 7)} ${pared.slice(11, 16)}`;
}

/** Fuera de la ventana del evento → `FUERA_DE_HORARIO_DE_USO`, con desde y hasta en hora de Buenos Aires. */
export function exigirVentanaAbierta(fechaHora: Date, ahora: Date): void {
  const ventana = ventanaDeUso(fechaHora);
  if (estadoDeVentana(ventana, ahora) === "abierta") return;
  throw new ReglaDeNegocioError(
    "FUERA_DE_HORARIO_DE_USO",
    `El ingreso se registra desde el ${diaYHora(ventana.desde)} hasta el ${diaYHora(ventana.hasta)}.`,
  );
}
