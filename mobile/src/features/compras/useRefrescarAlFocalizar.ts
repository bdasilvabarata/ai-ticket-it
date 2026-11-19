import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

/**
 * Vuelve a pedir una consulta cada vez que la pantalla recupera el foco (R8), salvo el primero: el
 * montaje ya la pidió. Las pestañas y las pantallas de abajo en el Stack no se desmontan, y el
 * `focusManager` de TanStack solo mira el `AppState`. El callback de `useFocusEffect` es estable
 * (lee `refetch` de una ref): si cambiara su identidad estando enfocada, el hook lo volvería a correr
 * y pediría la consulta.
 */
export function useRefrescarAlFocalizar(refetch: () => unknown) {
  const refetchActual = useRef(refetch);
  useEffect(() => {
    refetchActual.current = refetch;
  }, [refetch]);
  const yaEnfocada = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (yaEnfocada.current) void refetchActual.current();
      yaEnfocada.current = true;
    }, []),
  );
}
