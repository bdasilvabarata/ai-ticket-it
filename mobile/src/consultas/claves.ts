/**
 * Claves de TanStack Query, en un solo lugar (R9). Las que dependen del usuario llevan el
 * `usuarioId` en la posición 1: así la respuesta de un usuario nunca se lee con la clave de otro.
 */
export const claves = {
  usuarios: () => ["usuarios"] as const,
  usuarioActual: (usuarioId: string) => ["usuario-actual", usuarioId] as const,
  categorias: () => ["categorias"] as const,
  misEventos: (usuarioId: string) => ["mis-eventos", usuarioId] as const,
  evento: (usuarioId: string, eventoId: string) => ["evento", usuarioId, eventoId] as const,
};
