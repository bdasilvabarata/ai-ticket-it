import type {
  OrganizadorVista,
  PaginaDeReseniasVista,
  PaginaVista,
  ReseniaDelOrganizadorVista,
  ReseniasDelOrganizadorVista,
  ReseniaVista,
} from "@ai-ticket-it/shared";
import type { Evento } from "../domain/evento";
import { horaDeBuenosAires } from "../domain/hora-buenos-aires";
import type { Resenia } from "../domain/resenia";
import type { Usuario } from "../domain/usuario";

// Vistas explícitas de las reseñas (feature 012, R8; principio V). La lista del organizador no
// expone el id del autor, compras, códigos, totales ni estados (FR-016).

/** Las dos fechas de una reseña: el instante ISO UTC y la hora de pared de Buenos Aires. */
function fechasDe(resenia: Resenia): { creadaEn: string; creadaEnLocal: string } {
  return { creadaEn: resenia.creadaEn.toISOString(), creadaEnLocal: horaDeBuenosAires(resenia.creadaEn) };
}

/** La reseña propia: en la compra y en la respuesta del alta. */
export function aReseniaVista(resenia: Resenia): ReseniaVista {
  return {
    id: resenia.id,
    eventoId: resenia.eventoId,
    puntuacion: resenia.puntuacion,
    comentario: resenia.comentario,
    ...fechasDe(resenia),
  };
}

/** Una reseña en "Reseñas del organizador": el autor solo con su nombre y el evento reseñado. */
export function aReseniaDelOrganizadorVista(
  resenia: Resenia,
  autor: Usuario,
  evento: Evento,
): ReseniaDelOrganizadorVista {
  return {
    id: resenia.id,
    puntuacion: resenia.puntuacion,
    comentario: resenia.comentario,
    autor: { nombre: autor.nombre, apellido: autor.apellido },
    evento: { id: evento.id, nombre: evento.nombre },
    ...fechasDe(resenia),
  };
}

/** La entidad con esa clave del lote que pidió el service, o un error de programación. */
export function delLote<T>(lote: Map<string, T>, id: string, que: string): T {
  const valor = lote.get(id);
  if (valor === undefined) throw new Error(`Falta ${que} ${id} en el lote.`);
  return valor;
}

/**
 * "Reseñas del organizador": el organizador con su puntaje y las reseñas en el orden recibido (el
 * service ya las ordenó con `compararResenias`). `usuarios` trae a los autores y `eventos`, los del
 * organizador.
 */
export function aReseniasDelOrganizadorVista(
  organizador: OrganizadorVista,
  resenias: readonly Resenia[],
  usuarios: Map<string, Usuario>,
  eventos: Map<string, Evento>,
): ReseniasDelOrganizadorVista {
  return {
    organizador,
    resenias: resenias.map((resenia) =>
      aReseniaDelOrganizadorVista(
        resenia,
        delLote(usuarios, resenia.compradorId, "el usuario"),
        delLote(eventos, resenia.eventoId, "el evento"),
      ),
    ),
  };
}

/** Una página de "Reseñas del organizador" (feature 013): la vista de la 012 más su `pagina`. */
export function aPaginaDeReseniasVista(
  vista: ReseniasDelOrganizadorVista,
  pagina: PaginaVista,
): PaginaDeReseniasVista {
  return { ...vista, pagina };
}
