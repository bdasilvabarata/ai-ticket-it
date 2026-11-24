import { SENTIDO_INICIAL, type OrdenCatalogo, type SentidoCatalogo } from "@ai-ticket-it/shared";

/**
 * Lo que hace falta para ordenar un evento del catálogo, con los datos ya calculados (el puntaje lo
 * calcula el service con las reseñas: este módulo no las conoce). Los elementos pueden traer campos
 * de más (por ejemplo, su vista): salen los mismos objetos, sin copiarlos.
 */
export interface Ordenable {
  id: string;
  nombre: string;
  fechaHora: Date;
  /** Menor precio de sus tipos; 0 = gratis. */
  precioDesde: number;
  /** Promedio sin redondear del organizador; `null` sin reseñas. */
  puntaje: number | null;
}

type Comparador = (a: Ordenable, b: Ordenable) => number;

// Mismo criterio que `mismoNombreDeTipo` y `compararPorApellidoYNombre`: sin mayúsculas ni tildes.
const comparadorDeNombres = new Intl.Collator("es", { sensitivity: "base" });

const porFecha: Comparador = (a, b) => a.fechaHora.getTime() - b.fechaHora.getTime();
/** Por nombre, sin mayúsculas ni tildes: el desempate del catálogo y de Mis eventos (feature 014). */
export const porNombre = (a: Pick<Ordenable, "nombre">, b: Pick<Ordenable, "nombre">): number =>
  comparadorDeNombres.compare(a.nombre, b.nombre);
/** Por id: el último desempate, así dos elementos empatados salen siempre igual. */
export const porId = (a: Pick<Ordenable, "id">, b: Pick<Ordenable, "id">): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const porPrecio: Comparador = (a, b) => a.precioDesde - b.precioDesde;

/** Sin puntaje (`null`) siempre al final, nunca como 0, en cualquier sentido. */
const sinPuntajeAlFinal: Comparador = (a, b) => (a.puntaje === null ? 1 : 0) - (b.puntaje === null ? 1 : 0);

/** De menor a mayor, sin redondear; solo entre dos con puntaje (va después de `sinPuntajeAlFinal`). */
const porPuntaje: Comparador = (a, b) => (a.puntaje ?? 0) - (b.puntaje ?? 0);

const invertir =
  (comparar: Comparador): Comparador =>
  (a, b) =>
    comparar(b, a);

/** El criterio principal de cada orden, ascendente (FR-018–FR-020). */
const CRITERIO_PRINCIPAL: Record<OrdenCatalogo, Comparador> = {
  fecha: porFecha,
  precio: porPrecio,
  puntaje: porPuntaje,
};

function encadenar(...comparadores: Comparador[]): Comparador {
  return (a, b) => {
    for (const comparar of comparadores) {
      const resultado = comparar(a, b);
      if (resultado !== 0) return resultado;
    }
    return 0;
  };
}

/**
 * El catálogo en el orden pedido. `sentido` invierte solo el criterio principal (sin él, el inicial
 * de cada criterio: `SENTIDO_INICIAL`); los eventos sin puntaje van al final en los dos sentidos.
 * Desempates, en orden y nunca invertidos: fecha ascendente → nombre (sin mayúsculas ni tildes) →
 * id, así dos eventos empatados salen siempre igual (FR-020). Devuelve un arreglo nuevo; el de
 * entrada no cambia.
 */
export function ordenarCatalogo<T extends Ordenable>(
  elementos: readonly T[],
  orden: OrdenCatalogo,
  sentido: SentidoCatalogo = SENTIDO_INICIAL[orden],
): T[] {
  const principal = sentido === "asc" ? CRITERIO_PRINCIPAL[orden] : invertir(CRITERIO_PRINCIPAL[orden]);
  const primero = orden === "puntaje" ? [sinPuntajeAlFinal] : [];
  return elementos.toSorted(encadenar(...primero, principal, porFecha, porNombre, porId));
}
