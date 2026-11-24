/**
 * Lo que hace falta para ordenar una compra de "Mis compras" (feature 007, FR-006), con los datos
 * ya calculados (si el evento está realizado lo decide el service con su `ahora`). Los elementos
 * pueden traer campos de más (por ejemplo, su vista).
 */
export interface OrdenableMiCompra {
  id: string;
  creadaEn: Date;
  fechaHoraEvento: Date;
  eventoRealizado: boolean;
}

/**
 * Primero las compras de eventos no realizados (fecha del evento ascendente), después las de
 * realizados (fecha del evento descendente, el más reciente primero); con la misma fecha del
 * evento desempatan `creadaEn` descendente y después `id` ascendente, así el orden no depende del
 * de entrada.
 */
export function compararMisCompras(a: OrdenableMiCompra, b: OrdenableMiCompra): number {
  if (a.eventoRealizado !== b.eventoRealizado) return a.eventoRealizado ? 1 : -1;
  const porFecha = a.fechaHoraEvento.getTime() - b.fechaHoraEvento.getTime();
  if (porFecha !== 0) return a.eventoRealizado ? -porFecha : porFecha;
  const porCreacion = b.creadaEn.getTime() - a.creadaEn.getTime();
  if (porCreacion !== 0) return porCreacion;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
