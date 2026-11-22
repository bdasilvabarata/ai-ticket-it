import { esTextoConContenido, Invariantes } from "./invariantes";

export interface DatosUsuario {
  id: string;
  nombre: string;
  apellido: string;
  /** Ids de eventos favoritos. */
  favoritos: string[];
}

/** Persona que usa el sistema: es comprador u organizador según su relación con cada recurso. */
export class Usuario {
  readonly id: string;
  readonly nombre: string;
  readonly apellido: string;
  readonly favoritos: readonly string[];

  constructor({ id, nombre, apellido, favoritos }: DatosUsuario) {
    new Invariantes()
      .exigir(esTextoConContenido(nombre), "nombre", "Es obligatorio.")
      .exigir(esTextoConContenido(apellido), "apellido", "Es obligatorio.")
      .exigir(new Set(favoritos).size === favoritos.length, "favoritos", "No puede repetir eventos.")
      .verificar();
    this.id = id;
    this.nombre = nombre.trim();
    this.apellido = apellido.trim();
    this.favoritos = [...favoritos];
  }

  tieneFavorito(eventoId: string): boolean {
    return this.favoritos.includes(eventoId);
  }

  /** Un `Usuario` nuevo con el evento al final; si ya lo tenía, este mismo (idempotente). */
  marcarFavorito(eventoId: string): Usuario {
    if (this.tieneFavorito(eventoId)) return this;
    return this.#conFavoritos([...this.favoritos, eventoId]);
  }

  /** Un `Usuario` nuevo sin el evento; si no lo tenía, este mismo (idempotente). */
  desmarcarFavorito(eventoId: string): Usuario {
    if (!this.tieneFavorito(eventoId)) return this;
    return this.#conFavoritos(this.favoritos.filter((id) => id !== eventoId));
  }

  #conFavoritos(favoritos: string[]): Usuario {
    return new Usuario({ id: this.id, nombre: this.nombre, apellido: this.apellido, favoritos });
  }
}

const comparador = new Intl.Collator("es", { sensitivity: "base" });

/** Orden alfabético por apellido y luego nombre, sin distinguir mayúsculas ni tildes. */
export function compararPorApellidoYNombre(
  a: Pick<Usuario, "nombre" | "apellido">,
  b: Pick<Usuario, "nombre" | "apellido">,
): number {
  return comparador.compare(a.apellido, b.apellido) || comparador.compare(a.nombre, b.nombre);
}
