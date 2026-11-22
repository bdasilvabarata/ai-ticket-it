import { useQuery } from "@tanstack/react-query";

import { obtenerReseniasDelOrganizador } from "../../api";
import { claves } from "../../consultas/claves";
import { useClienteApi } from "../../consultas/cliente-api";

/**
 * "Reseñas del organizador", por páginas (feature 013, US5): el organizador del evento con el puntaje
 * y la cantidad de todas sus reseñas y la página `pagina`. La clave lleva el usuario aunque el
 * endpoint sea público (como el resumen, `useReseniasDelOrganizador`). Sin `placeholderData`
 * (research R8): al cambiar de página se ve "Cargando reseñas…".
 */
export function usePaginaDeResenias(usuarioId: string, eventoId: string, pagina: number) {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: claves.paginaDeResenias(usuarioId, eventoId, pagina),
    queryFn: ({ signal }) => obtenerReseniasDelOrganizador(cliente, eventoId, pagina, { signal }),
  });
}
