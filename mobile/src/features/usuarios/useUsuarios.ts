import { useQuery } from "@tanstack/react-query";

import { listarUsuarios } from "../../api";
import { claves } from "../../consultas/claves";
import { useClienteApi } from "../../consultas/cliente-api";

/** Lista de usuarios del selector (pública: su clave no lleva usuarioId). */
export function useUsuarios() {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: claves.usuarios(),
    queryFn: ({ signal }) => listarUsuarios(cliente, { signal }),
  });
}
