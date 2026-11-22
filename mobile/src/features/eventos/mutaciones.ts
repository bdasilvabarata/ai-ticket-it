import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

import {
  actualizarEvento,
  agregarTipoEntrada,
  crearEvento,
  editarTipoEntrada,
  eliminarEvento,
  quitarTipoEntrada,
  type CuerpoEvento,
  type CuerpoNuevoEvento,
  type CuerpoTipoEntrada,
} from "../../api";
import { claves } from "../../consultas/claves";
import { useClienteApi } from "../../consultas/cliente-api";
import { esNoEncontrado } from "./errores-de-formulario";

// Una mutation por escritura (research R15). Van en nombre del usuario **del formulario** (R12), no
// se reintentan solas (`mutations.retry: false` del QueryClient) y, con éxito o error, invalidan lo
// que pudo cambiar: la única fuente de verdad es el servidor (orden de Mis eventos, `realizado`).
// Todas invalidan además el catálogo de Explorar (feature 005, R15): un cambio de nombre, fecha,
// precio o cupo, o un evento nuevo o eliminado, cambia lo que se ve ahí.

/** El prefijo de todas las consultas del catálogo (`claves.catalogo`). */
const CATALOGO: QueryKey = ["catalogo"];

/** El prefijo de los favoritos de todos los usuarios (`claves.favoritos`, feature 014). */
const FAVORITOS: QueryKey = ["favoritos"];

function useInvalidar() {
  const queryClient = useQueryClient();
  return (clavesAInvalidar: QueryKey[], sinVolverAPedir: QueryKey[] = []) =>
    Promise.all([
      ...[...clavesAInvalidar, CATALOGO].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ...sinVolverAPedir.map((queryKey) => queryClient.invalidateQueries({ queryKey, refetchType: "none" })),
    ]);
}

/**
 * Lo que invalida una escritura sobre un evento existente. Ante un 404 el evento no se vuelve a
 * pedir: la pantalla avisa y vuelve a Mis eventos, que sí se actualiza (US3-11).
 */
function useInvalidarEvento(usuarioId: string, eventoId: string) {
  const invalidar = useInvalidar();
  return (error: unknown) =>
    invalidar(
      esNoEncontrado(error)
        ? [claves.misEventos(usuarioId)]
        : [claves.misEventos(usuarioId), claves.evento(usuarioId, eventoId)],
    );
}

/** Crear cambia también la cantidad de eventos del selector de usuario. */
export function useCrearEvento(usuarioId: string) {
  const cliente = useClienteApi();
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (datos: CuerpoNuevoEvento) => crearEvento(cliente, datos, { usuarioId }),
    onSettled: () => invalidar([claves.misEventos(usuarioId), claves.usuarios()]),
  });
}

export function useActualizarEvento(usuarioId: string, eventoId: string) {
  const cliente = useClienteApi();
  const invalidarEvento = useInvalidarEvento(usuarioId, eventoId);
  return useMutation({
    mutationFn: (datos: CuerpoEvento) => actualizarEvento(cliente, eventoId, datos, { usuarioId }),
    onSettled: (_datos, error) => invalidarEvento(error),
  });
}

/**
 * Eliminar cambia la cantidad de eventos del selector. El evento se marca invalidado sin volver a
 * pedirlo: ya no existe y la pantalla se va. El servidor lo saca de los favoritos de todos (feature
 * 014, FR-010): se invalidan, por prefijo, los de todos los usuarios de la caché.
 */
export function useEliminarEvento(usuarioId: string, eventoId: string) {
  const cliente = useClienteApi();
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: () => eliminarEvento(cliente, eventoId, { usuarioId }),
    onSettled: () =>
      invalidar(
        [claves.misEventos(usuarioId), claves.usuarios(), FAVORITOS],
        [claves.evento(usuarioId, eventoId)],
      ),
  });
}

export function useAgregarTipoEntrada(usuarioId: string, eventoId: string) {
  const cliente = useClienteApi();
  const invalidarEvento = useInvalidarEvento(usuarioId, eventoId);
  return useMutation({
    mutationFn: (datos: CuerpoTipoEntrada) => agregarTipoEntrada(cliente, eventoId, datos, { usuarioId }),
    onSettled: (_datos, error) => invalidarEvento(error),
  });
}

export function useEditarTipoEntrada(usuarioId: string, eventoId: string, tipoId: string) {
  const cliente = useClienteApi();
  const invalidarEvento = useInvalidarEvento(usuarioId, eventoId);
  return useMutation({
    mutationFn: (datos: CuerpoTipoEntrada) =>
      editarTipoEntrada(cliente, eventoId, tipoId, datos, { usuarioId }),
    onSettled: (_datos, error) => invalidarEvento(error),
  });
}

/** Recibe el id del tipo a quitar. */
export function useQuitarTipoEntrada(usuarioId: string, eventoId: string) {
  const cliente = useClienteApi();
  const invalidarEvento = useInvalidarEvento(usuarioId, eventoId);
  return useMutation({
    mutationFn: (tipoId: string) => quitarTipoEntrada(cliente, eventoId, tipoId, { usuarioId }),
    onSettled: (_datos, error) => invalidarEvento(error),
  });
}
