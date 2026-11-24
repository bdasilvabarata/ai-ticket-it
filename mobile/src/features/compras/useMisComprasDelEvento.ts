import { useQuery } from "@tanstack/react-query";

import { obtenerMisComprasDelEvento } from "../../api";
import { claves } from "../../consultas/claves";
import { useClienteApi } from "../../consultas/cliente-api";

/** Las compras pendientes del usuario en el evento y cuántas entradas más puede comprar de cada tipo. */
export function useMisComprasDelEvento(usuarioId: string, eventoId: string) {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: claves.misComprasDelEvento(usuarioId, eventoId),
    queryFn: ({ signal }) => obtenerMisComprasDelEvento(cliente, eventoId, { signal }),
  });
}
