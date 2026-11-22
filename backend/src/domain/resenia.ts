import { EstadoCompra, LIMITES_RESENIA } from "@ai-ticket-it/shared";
import type { Compra } from "./compra";
import { ReglaDeNegocioError } from "./errores";
import type { Evento } from "./evento";
import { Invariantes } from "./invariantes";

export interface PropiedadesResenia {
  id: string;
  compradorId: string;
  eventoId: string;
  /** Entero de 1 a 5. */
  puntuacion: number;
  /** Ya recortado, de 1 a 500 caracteres, o `null` sin comentario. */
  comentario: string | null;
  /** La fija el servidor con su reloj al recibirla. */
  creadaEn: Date;
}

/** Lo que da el que reseña: el id lo da el repositorio y la fecha, el reloj. */
export interface DatosDeAltaDeResenia {
  id: string;
  compradorId: string;
  eventoId: string;
  puntuacion: number;
  /** Sin recortar: `crear` lo normaliza (`""` o solo espacios → `null`). */
  comentario: string | null;
}

const esPuntuacion = (valor: number): boolean =>
  Number.isInteger(valor) &&
  valor >= LIMITES_RESENIA.puntuacionMinima &&
  valor <= LIMITES_RESENIA.puntuacionMaxima;

const esComentario = (valor: string | null): boolean =>
  valor === null ||
  (valor === valor.trim() && valor.length >= 1 && valor.length <= LIMITES_RESENIA.comentarioLargoMaximo);

/**
 * Reseña de un evento (feature 012; la 005 la creó mínima para el puntaje): la puntuación de 1 a 5,
 * un `comentario` opcional y la fecha del servidor. Agregado propio e inmutable: no se edita ni se
 * borra. Que el autor tenga una compra `UTILIZADA` del evento, no lo organice y no lo haya reseñado
 * antes lo verifican `exigirQuePuedeReseniar` y `exigirQueNoReseniO`, bajo el cerrojo del evento.
 */
export class Resenia {
  readonly id: string;
  readonly compradorId: string;
  readonly eventoId: string;
  readonly puntuacion: number;
  readonly comentario: string | null;
  readonly creadaEn: Date;

  /** El alta: recorta el comentario (vacío → `null`) y la fecha es `ahora`. */
  static crear({ comentario, ...datos }: DatosDeAltaDeResenia, ahora: Date): Resenia {
    const recortado = comentario?.trim() ?? "";
    return new Resenia({ ...datos, comentario: recortado === "" ? null : recortado, creadaEn: ahora });
  }

  constructor(propiedades: PropiedadesResenia) {
    new Invariantes()
      .exigir(esPuntuacion(propiedades.puntuacion), "puntuacion", "Debe ser un entero de 1 a 5.")
      .exigir(
        esComentario(propiedades.comentario),
        "comentario",
        `Debe tener entre 1 y ${LIMITES_RESENIA.comentarioLargoMaximo} caracteres, sin espacios al principio ni al final.`,
      )
      .exigir(
        propiedades.creadaEn instanceof Date && !Number.isNaN(propiedades.creadaEn.getTime()),
        "creadaEn",
        "Debe ser una fecha válida.",
      )
      .verificar();
    this.id = propiedades.id;
    this.compradorId = propiedades.compradorId;
    this.eventoId = propiedades.eventoId;
    this.puntuacion = propiedades.puntuacion;
    this.comentario = propiedades.comentario;
    this.creadaEn = new Date(propiedades.creadaEn);
    Object.freeze(this);
  }
}

/** Puntaje derivado (no se guarda): el promedio **sin redondear** y en cuántas reseñas se basa. */
export type Puntaje = { promedio: number | null; cantidad: number };

/** Sin puntuaciones no hay puntaje: `promedio: null`, nunca 0. El redondeo es de la app. */
export function calcularPuntaje(puntuaciones: readonly number[]): Puntaje {
  if (puntuaciones.length === 0) return { promedio: null, cantidad: 0 };
  const suma = puntuaciones.reduce((total, puntuacion) => total + puntuacion, 0);
  return { promedio: suma / puntuaciones.length, cantidad: puntuaciones.length };
}

/**
 * El puntaje de cada organizador con las reseñas de sus eventos (próximos y realizados). Una reseña
 * de un evento que no está en `eventos` se ignora; un organizador sin reseñas no aparece.
 */
export function puntajesPorOrganizador(
  eventos: readonly Evento[],
  resenias: readonly Resenia[],
): Map<string, Puntaje> {
  const organizadorDe = new Map(eventos.map((evento) => [evento.id, evento.organizadorId]));
  const puntuaciones = new Map<string, number[]>();
  for (const resenia of resenias) {
    const organizadorId = organizadorDe.get(resenia.eventoId);
    if (organizadorId === undefined) continue;
    puntuaciones.set(organizadorId, [...(puntuaciones.get(organizadorId) ?? []), resenia.puntuacion]);
  }
  return new Map([...puntuaciones].map(([organizadorId, lista]) => [organizadorId, calcularPuntaje(lista)]));
}

/**
 * Quién puede reseñar un evento (R4), en orden: el organizador nunca (`RESENIA_PROPIO_EVENTO`, aunque
 * tuviera compras); los demás, solo con alguna compra `UTILIZADA` de ese evento
 * (`SIN_COMPRA_UTILIZADA`). Una "1 de 3" alcanza, y no se mira si el evento ya se realizó.
 * `compras` son las del usuario en ese evento.
 */
export function exigirQuePuedeReseniar({
  usuarioId,
  evento,
  compras,
}: {
  usuarioId: string;
  evento: Evento;
  compras: readonly Compra[];
}): void {
  if (evento.esOrganizadoPor(usuarioId)) {
    throw new ReglaDeNegocioError("RESENIA_PROPIO_EVENTO", "No podés reseñar un evento que organizás.");
  }
  if (!compras.some((compra) => compra.estado === EstadoCompra.UTILIZADA)) {
    throw new ReglaDeNegocioError(
      "SIN_COMPRA_UTILIZADA",
      "Solo podés reseñar un evento al que asististe (con una compra utilizada).",
    );
  }
}

/** Una reseña por comprador y evento: con una previa, `RESENIA_REPETIDA`. */
export function exigirQueNoReseniO(existente: Resenia | null): void {
  if (existente !== null) {
    throw new ReglaDeNegocioError("RESENIA_REPETIDA", "Ya reseñaste este evento.");
  }
}

/** Orden de "Reseñas del organizador" (R8): la más reciente primero; con la misma fecha, por `id`. */
export function compararResenias(a: Resenia, b: Resenia): number {
  const porFecha = b.creadaEn.getTime() - a.creadaEn.getTime();
  if (porFecha !== 0) return porFecha;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
