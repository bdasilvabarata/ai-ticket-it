import { useQuery } from "@tanstack/react-query";

import { listarMisEventos } from "../../api";
import { claves } from "../../consultas/claves";
import { useClienteApi } from "../../consultas/cliente-api";

/** Eventos que organiza `usuarioId` (la clave lleva el usuario: al cambiarlo, se piden los del nuevo). */
export function useMisEventos(usuarioId: string) {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: claves.misEventos(usuarioId),
    queryFn: ({ signal }) => listarMisEventos(cliente, { signal }),
  });
}
