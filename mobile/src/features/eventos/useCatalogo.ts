import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { listarEventos } from "../../api";
import { claves, type ClaveCatalogo } from "../../consultas/claves";
import { useClienteApi } from "../../consultas/cliente-api";

/**
 * El catálogo de Explorar para esa consulta y página (la clave no lleva usuario: es el mismo para
 * todos). Una página nueva es una consulta nueva (feature 013, R8).
 * Sin `placeholderData`: con una consulta nueva no hay datos y se ve el skeleton, nunca los
 * resultados del criterio anterior (FR-007).
 */
export function useCatalogo(consulta: ClaveCatalogo) {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: claves.catalogo(consulta),
    queryFn: ({ signal }) =>
      listarEventos(
        cliente,
        {
          texto: consulta.texto,
          categoriaId: consulta.categoriaId ?? undefined,
          orden: consulta.orden,
          sentido: consulta.sentido,
          pagina: consulta.pagina,
        },
        { signal },
      ),
  });
}

/** Invalida todas las consultas del catálogo (el prefijo `["catalogo"]`), por ejemplo ante un 404. */
export function useInvalidarCatalogo(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries({ queryKey: ["catalogo"] }), [queryClient]);
}
