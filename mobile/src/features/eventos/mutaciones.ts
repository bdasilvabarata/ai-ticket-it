import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

import { crearEvento, type CuerpoNuevoEvento } from "../../api";
import { claves } from "../../consultas/claves";
import { useClienteApi } from "../../consultas/cliente-api";

// Una mutation por escritura (research R15). Van en nombre del usuario **del formulario** (R12), no
// se reintentan solas (`mutations.retry: false` del QueryClient) y, con éxito o error, invalidan lo
// que pudo cambiar: la única fuente de verdad es el servidor (orden de Mis eventos, `realizado`).

function useInvalidar() {
  const queryClient = useQueryClient();
  return (...clavesAInvalidar: QueryKey[]) =>
    Promise.all(clavesAInvalidar.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

/** Crear cambia también la cantidad de eventos del selector de usuario. */
export function useCrearEvento(usuarioId: string) {
  const cliente = useClienteApi();
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (datos: CuerpoNuevoEvento) => crearEvento(cliente, datos, { usuarioId }),
    onSettled: () => invalidar(claves.misEventos(usuarioId), claves.usuarios()),
  });
}
