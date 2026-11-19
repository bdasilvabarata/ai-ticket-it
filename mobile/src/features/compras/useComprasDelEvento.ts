import { useQuery } from "@tanstack/react-query";

import { obtenerComprasDelEvento } from "../../api";
import { claves } from "../../consultas/claves";
import { useClienteApi } from "../../consultas/cliente-api";

/**
 * "Compras del evento" (feature 008): todas las compras del evento, al día según el servidor, para
 * su organizador. Clave por usuario: al cambiar de usuario nunca se ven las del anterior.
 */
export function useComprasDelEvento(usuarioId: string, eventoId: string) {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: claves.comprasDelEvento(usuarioId, eventoId),
    queryFn: ({ signal }) => obtenerComprasDelEvento(cliente, eventoId, { signal }),
  });
}
