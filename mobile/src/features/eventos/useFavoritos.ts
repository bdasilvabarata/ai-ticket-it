import type { EventoCatalogoVista } from "@ai-ticket-it/shared";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { listarFavoritos } from "../../api";
import { claves } from "../../consultas/claves";
import { useClienteApi } from "../../consultas/cliente-api";
import { useSesion } from "../sesion";

const SIN_FAVORITOS: ReadonlySet<string> = new Set();

/** Estable (fuera del componente): así TanStack memoriza el `Set` mientras los datos no cambien. */
function aIds(favoritos: EventoCatalogoVista[]): ReadonlySet<string> {
  return new Set(favoritos.map((evento) => evento.id));
}

/** La misma query para los dos hooks: una sola consulta por usuario. */
function useOpcionesDeFavoritos() {
  const cliente = useClienteApi();
  const { estado } = useSesion();
  const usuarioId = estado.fase === "con-usuario" ? estado.usuarioId : null;
  return {
    queryKey: claves.favoritos(usuarioId ?? ""),
    queryFn: ({ signal }: { signal: AbortSignal }) => listarFavoritos(cliente, usuarioId ?? "", { signal }),
    enabled: usuarioId !== null,
  };
}

/** Los favoritos del usuario de la sesión (feature 014), en el orden del servidor. */
export function useFavoritos(): UseQueryResult<EventoCatalogoVista[]> {
  return useQuery(useOpcionesDeFavoritos());
}

/**
 * Los ids de los favoritos del usuario de la sesión, para las estrellas; vacío mientras carga o con
 * la consulta en error (FR-018b): las listas se ven igual, sin estrellas.
 */
export function useIdsDeFavoritos(): ReadonlySet<string> {
  const consulta = useQuery({ ...useOpcionesDeFavoritos(), select: aIds });
  return consulta.data ?? SIN_FAVORITOS;
}
