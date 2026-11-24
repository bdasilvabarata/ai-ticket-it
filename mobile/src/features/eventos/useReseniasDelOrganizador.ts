import { useQuery } from "@tanstack/react-query";

import { obtenerResumenDeResenias } from "../../api";
import { claves } from "../../consultas/claves";
import { useClienteApi } from "../../consultas/cliente-api";

/**
 * "Reseñas del organizador" del detalle (feature 012; desde la 013, el resumen): el organizador con el
 * puntaje y la cantidad de todas sus reseñas y las 3 más recientes. La clave lleva el usuario aunque
 * el endpoint sea público (como el evento).
 */
export function useReseniasDelOrganizador(usuarioId: string, eventoId: string) {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: claves.reseniasDelOrganizador(usuarioId, eventoId),
    queryFn: ({ signal }) => obtenerResumenDeResenias(cliente, eventoId, { signal }),
  });
}
