import { useQuery } from "@tanstack/react-query";

import { obtenerCompra } from "../../api";
import { claves } from "../../consultas/claves";
import { useClienteApi } from "../../consultas/cliente-api";

/** Una compra del usuario, con su estado al día según el servidor (research R17). */
export function useCompra(usuarioId: string, compraId: string) {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: claves.compra(usuarioId, compraId),
    queryFn: ({ signal }) => obtenerCompra(cliente, compraId, { signal }),
  });
}
