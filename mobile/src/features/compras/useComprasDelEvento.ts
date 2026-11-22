import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { obtenerComprasDelEvento } from "../../api";
import { claves } from "../../consultas/claves";
import { useClienteApi } from "../../consultas/cliente-api";
import { consultaDelFiltro, type FiltroDeCompras } from "./filtro-de-compras";

/**
 * "Compras del evento" (features 008 y 013): una página de las compras del evento, filtradas y al
 * día según el servidor, para su organizador. Clave por usuario: al cambiar de usuario nunca se ven
 * las del anterior. Con `keepPreviousData` (research R8): al cambiar de página o de filtro, el resumen
 * de la respuesta anterior sigue a la vista mientras llega la nueva (`isPlaceholderData`).
 */
export function useComprasDelEvento(
  usuarioId: string,
  eventoId: string,
  filtro: FiltroDeCompras,
  pagina: number,
) {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: claves.comprasDelEvento(usuarioId, eventoId, { filtro, pagina }),
    queryFn: ({ signal }) =>
      obtenerComprasDelEvento(cliente, eventoId, { pagina, ...consultaDelFiltro(filtro) }, { signal }),
    placeholderData: keepPreviousData,
  });
}
