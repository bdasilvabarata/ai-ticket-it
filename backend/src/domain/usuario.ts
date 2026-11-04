export interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  /** Ids de eventos favoritos. */
  favoritos: string[];
}
