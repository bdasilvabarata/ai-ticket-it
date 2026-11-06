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
      .verificar();
    this.id = id;
    this.nombre = nombre.trim();
    this.apellido = apellido.trim();
    this.favoritos = [...favoritos];
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
