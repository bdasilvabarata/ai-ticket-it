import { useQuery } from "@tanstack/react-query";

import { obtenerChatDeLaCompra } from "../../api";
import { claves } from "../../consultas/claves";
import { useClienteApi } from "../../consultas/cliente-api";

/**
 * El chat de una compra visto por una de sus dos partes (feature 011, R10): el encabezado con el
 * estado al día, la otra parte y los mensajes, según el servidor.
 */
export function useChatDeLaCompra(usuarioId: string, compraId: string) {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: claves.chatDeLaCompra(usuarioId, compraId),
    queryFn: ({ signal }) => obtenerChatDeLaCompra(cliente, compraId, { signal }),
  });
}
