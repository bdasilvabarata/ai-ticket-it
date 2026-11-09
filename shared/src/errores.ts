/** Un problema puntual de validación sobre un campo del pedido. */
export interface DetalleError {
  /** Ruta del valor: `params.<x>`, `query.<x>` o `body.<ruta.del.campo>`. */
  campo: string;
  mensaje: string;
}

/** Formato único de toda respuesta de error de la API (status ≥ 400). */
export interface ErrorApi {
  error: {
    /** Legible por máquina, MAYÚSCULAS_CON_GUION_BAJO. */
    codigo: string;
    /** En español, para mostrar al usuario. */
    mensaje: string;
    detalles?: DetalleError[];
  };
}
