import { useState } from "react";

/**
 * La página de una lista paginada (feature 013, research R7). Empieza en la 1 y vuelve a la 1 cada
 * vez que cambia el `criterio` (búsqueda, filtro, orden: FR-013, FR-017), en el mismo render y sin
 * efectos, así nunca se pide la página vieja con el criterio nuevo.
 */
export function usePagina(criterio: string): [numero: number, cambiar: (numero: number) => void] {
  const [estado, setEstado] = useState({ criterio, numero: 1 });
  const numero = estado.criterio === criterio ? estado.numero : 1;
  const cambiar = (nuevo: number) => setEstado({ criterio, numero: nuevo });
  return [numero, cambiar];
}
