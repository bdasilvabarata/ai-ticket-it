import { useQuery } from "@tanstack/react-query";

import { obtenerMisCompras } from "../../api";
import { claves } from "../../consultas/claves";
import { useClienteApi } from "../../consultas/cliente-api";

/**
 * Todas las compras del usuario como comprador, al día según el servidor (feature 007). Sin
 * `placeholderData`: al cambiar de usuario es otra clave y nunca se ven las del anterior (FR-019).
 */
export function useMisCompras(usuarioId: string) {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: claves.misCompras(usuarioId),
    queryFn: ({ signal }) => obtenerMisCompras(cliente, { signal }),
  });
}
