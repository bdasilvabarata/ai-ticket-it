import type { EntradaDelEventoVista } from "@ai-ticket-it/shared";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { obtenerEntradaDelEvento } from "../../api";
import { claves } from "../../consultas/claves";
import { useClienteApi } from "../../consultas/cliente-api";

/**
 * "Registrar ingreso" (feature 008): la entrada de ese evento con ese código (ya normalizado), para
 * su organizador. Habilitada solo con un código enviado (`codigo !== null`).
 */
export function useEntradaDelEvento(
  usuarioId: string,
  eventoId: string,
  codigo: string | null,
): UseQueryResult<EntradaDelEventoVista> {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: claves.entradaDelEvento(usuarioId, eventoId, codigo ?? ""),
    queryFn: ({ signal }) => obtenerEntradaDelEvento(cliente, eventoId, codigo ?? "", { signal }),
    enabled: codigo !== null,
  });
}
