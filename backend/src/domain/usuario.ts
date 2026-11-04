export interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  /** Ids de eventos favoritos. */
  favoritos: string[];
}

const comparador = new Intl.Collator("es", { sensitivity: "base" });

/** Orden alfabético por apellido y luego nombre, sin distinguir mayúsculas ni tildes. */
export function compararPorApellidoYNombre(
  a: Pick<Usuario, "nombre" | "apellido">,
  b: Pick<Usuario, "nombre" | "apellido">,
): number {
  return comparador.compare(a.apellido, b.apellido) || comparador.compare(a.nombre, b.nombre);
}
