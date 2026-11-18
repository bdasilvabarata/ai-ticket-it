import type { MiCompraVista } from "@ai-ticket-it/shared";
import { useEffect, useRef, useState } from "react";

import { esperaHastaElProximoVencimiento } from "./vencimientos";

/**
 * Vuelve a pedir "Mis compras" cuando llega la hora límite más próxima de sus pendientes (R9,
 * FR-018): un único `setTimeout`, reprogramado con cada respuesta y cancelado al cambiar los datos o
 * al desmontar. Sin pendientes no programa nada. La app nunca decide que una compra venció: lo que
 * se muestra después es lo que responda el servidor.
 */
export function useRefrescarAlVencer(
  compras: readonly MiCompraVista[] | undefined,
  refetch: () => unknown,
): void {
  // El `refetch` más reciente, sin reprogramar el temporizador cuando cambia su identidad.
  const refetchActual = useRef(refetch);
  useEffect(() => {
    refetchActual.current = refetch;
  }, [refetch]);

  // Si el servidor todavía no da la pendiente por vencida, la respuesta es igual a la anterior y
  // TanStack conserva la misma referencia de `compras`: la ronda reprograma el pedido igual.
  const [ronda, setRonda] = useState(0);

  useEffect(() => {
    if (compras === undefined) return;
    const espera = esperaHastaElProximoVencimiento(compras, Date.now());
    if (espera === null) return;
    const temporizador = setTimeout(() => {
      void Promise.resolve(refetchActual.current()).finally(() => setRonda((r) => r + 1));
    }, espera);
    return () => clearTimeout(temporizador);
  }, [compras, ronda]);
}
