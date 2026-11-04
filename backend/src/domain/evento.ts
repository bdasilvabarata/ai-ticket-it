/** precio: pesos enteros ≥ 0; cupo: entradas disponibles, entero ≥ 0, decrece con cada compra. */
export interface TipoEntrada {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  cupo: number;
}

export interface Evento {
  id: string;
  nombre: string;
  descripcion: string;
  categoriaId: string;
  /** Instante UTC. */
  fechaHora: Date;
  /** URLs de imágenes. */
  multimedia: string[];
  organizadorId: string;
  tiposEntrada: TipoEntrada[];
}
