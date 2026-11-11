import { useQuery } from "@tanstack/react-query";

import { obtenerEvento } from "../../api";
import { claves } from "../../consultas/claves";
import { useClienteApi } from "../../consultas/cliente-api";

/** Un evento con sus tipos de entrada, para editarlo o verlo (la clave lleva el usuario). */
export function useEvento(usuarioId: string, eventoId: string) {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: claves.evento(usuarioId, eventoId),
    queryFn: ({ signal }) => obtenerEvento(cliente, eventoId, { signal }),
  });
}
