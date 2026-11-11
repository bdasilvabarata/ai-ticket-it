import type { Evento } from "./evento";
import { Invariantes } from "./invariantes";

export interface PropiedadesResenia {
  id: string;
  compradorId: string;
  eventoId: string;
  /** Entero de 1 a 5. */
  puntuacion: number;
}

const esPuntuacion = (valor: number): boolean => Number.isInteger(valor) && valor >= 1 && valor <= 5;

/**
 * Reseña mínima (feature 005): lo justo para el puntaje del organizador. La 011 le suma el
 * `detalle`, el alta y la regla "solo con una compra `UTILIZADA`, una vez por evento".
 */
export class Resenia {
  readonly id: string;
  readonly compradorId: string;
  readonly eventoId: string;
  readonly puntuacion: number;

  constructor(propiedades: PropiedadesResenia) {
    new Invariantes()
      .exigir(esPuntuacion(propiedades.puntuacion), "puntuacion", "Debe ser un entero de 1 a 5.")
      .verificar();
    this.id = propiedades.id;
    this.compradorId = propiedades.compradorId;
    this.eventoId = propiedades.eventoId;
    this.puntuacion = propiedades.puntuacion;
  }
}

/** Puntaje derivado (no se guarda): el promedio **sin redondear** y en cuántas reseñas se basa. */
export type Puntaje = { promedio: number | null; cantidad: number };

/** Sin puntuaciones no hay puntaje: `promedio: null`, nunca 0. El redondeo es de la app. */
export function calcularPuntaje(puntuaciones: readonly number[]): Puntaje {
  if (puntuaciones.length === 0) return { promedio: null, cantidad: 0 };
  const suma = puntuaciones.reduce((total, puntuacion) => total + puntuacion, 0);
  return { promedio: suma / puntuaciones.length, cantidad: puntuaciones.length };
}

/**
 * El puntaje de cada organizador con las reseñas de sus eventos (próximos y realizados). Una reseña
 * de un evento que no está en `eventos` se ignora; un organizador sin reseñas no aparece.
 */
export function puntajesPorOrganizador(
  eventos: readonly Evento[],
  resenias: readonly Resenia[],
): Map<string, Puntaje> {
  const organizadorDe = new Map(eventos.map((evento) => [evento.id, evento.organizadorId]));
  const puntuaciones = new Map<string, number[]>();
  for (const resenia of resenias) {
    const organizadorId = organizadorDe.get(resenia.eventoId);
    if (organizadorId === undefined) continue;
    puntuaciones.set(organizadorId, [...(puntuaciones.get(organizadorId) ?? []), resenia.puntuacion]);
  }
  return new Map([...puntuaciones].map(([organizadorId, lista]) => [organizadorId, calcularPuntaje(lista)]));
}
