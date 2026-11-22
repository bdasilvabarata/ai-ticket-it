import { useQuery } from "@tanstack/react-query";

import { obtenerReseniasDelOrganizador } from "../../api";
import { claves } from "../../consultas/claves";
import { useClienteApi } from "../../consultas/cliente-api";

/**
 * "Reseñas del organizador" del evento (feature 012): el organizador con su puntaje y las reseñas de
 * todos sus eventos. La clave lleva el usuario aunque el endpoint sea público (como el evento).
 */
export function useReseniasDelOrganizador(usuarioId: string, eventoId: string) {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: claves.reseniasDelOrganizador(usuarioId, eventoId),
    queryFn: ({ signal }) => obtenerReseniasDelOrganizador(cliente, eventoId, { signal }),
  });
}
