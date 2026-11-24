import { useQuery } from "@tanstack/react-query";

import { listarCategorias } from "../../api";
import { claves } from "../../consultas/claves";
import { useClienteApi } from "../../consultas/cliente-api";

/** Catálogo de categorías (público: su clave no lleva usuarioId). */
export function useCategorias() {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: claves.categorias(),
    queryFn: ({ signal }) => listarCategorias(cliente, { signal }),
  });
}
