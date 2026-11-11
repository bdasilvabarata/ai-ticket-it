import type { OrdenCatalogo } from "@ai-ticket-it/shared";

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
const porNombre: Comparador = (a, b) => comparadorDeNombres.compare(a.nombre, b.nombre);
const porId: Comparador = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** El criterio principal de cada orden (FR-018–FR-020). */
const CRITERIO_PRINCIPAL: Record<OrdenCatalogo, Comparador> = {
  fecha: porFecha,
  precio: () => {
    throw new Error("no implementado");
  },
  puntaje: () => {
    throw new Error("no implementado");
  },
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
 * El catálogo en el orden pedido. Desempates, en orden: fecha ascendente → nombre (sin mayúsculas
 * ni tildes) → id, así dos eventos empatados salen siempre igual (FR-020). Devuelve un arreglo
 * nuevo; el de entrada no cambia.
 */
export function ordenarCatalogo<T extends Ordenable>(elementos: readonly T[], orden: OrdenCatalogo): T[] {
  return elementos.toSorted(encadenar(CRITERIO_PRINCIPAL[orden], porFecha, porNombre, porId));
}
