import { focusManager, MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { AppState } from "react-native";

/**
 * `QueryClient` de la app (R9). Sin reintentos propios: los reintentos son los de la secuencia
 * única (R7). Todo error de una query o una mutation se avisa a `alFallar` (R8).
 */
export function crearQueryClient({ alFallar }: { alFallar: (error: unknown) => void }): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30_000 },
      mutations: { retry: false },
    },
    queryCache: new QueryCache({ onError: (error) => alFallar(error) }),
    mutationCache: new MutationCache({ onError: (error) => alFallar(error) }),
  });
}

/** Revalida las queries al volver la app a primer plano. Devuelve la función de limpieza. */
export function conectarFocoDeLaApp(): () => void {
  focusManager.setEventListener((alCambiarFoco) => {
    const suscripcion = AppState.addEventListener("change", (estado) => alCambiarFoco(estado === "active"));
    return () => suscripcion.remove();
  });
  return () => focusManager.setEventListener(() => () => {});
}
