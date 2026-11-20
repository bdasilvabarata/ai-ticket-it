import { EstadoCompra } from "@ai-ticket-it/shared";
import { esCodigoValido } from "./codigo-de-entrada";
import { esEnteroNoNegativo } from "./invariantes";
// Solo tipos: se borran al compilar, así que no hay ciclo en tiempo de ejecución con `compra.ts` (R2).
import type { CambioEstadoCompra, PropiedadesCompra } from "./compra";

/**
 * Una invariante de `Compra` con nombre (feature 010, R2): si `cumple` da `false`, el constructor de
 * la compra informa un detalle con su `campo` y su `mensaje`. Cada regla escribe **su** condición:
 * ninguna reusa el resultado de otra, y todas se evalúan (se informan todas las que fallan).
 */
export interface ReglaDeCompra {
  /** Para los tests y la lectura. */
  nombre: string;
  campo: keyof PropiedadesCompra;
  mensaje: string;
  cumple(propiedades: PropiedadesCompra): boolean;
}

const ESTADOS = new Set<string>(Object.values(EstadoCompra));

/** El historial pasó por CONFIRMADA (feature 009). También lo usa la compra para `fueConfirmada`. */
export function pasoPorConfirmada(historial: readonly CambioEstadoCompra[]): boolean {
  return historial.some((cambio) => cambio.estado === EstadoCompra.CONFIRMADA);
}

const esCantidadValida = (cantidad: number): boolean => Number.isInteger(cantidad) && cantidad >= 1;

/** El estado del último cambio, o `undefined` si el historial está vacío (ya lo informa `historial-valido`). */
const ultimoEstado = (historial: readonly CambioEstadoCompra[]): EstadoCompra | undefined =>
  historial[historial.length - 1]?.estado;

/** CANCELADA o REEMBOLSADA después de haberse confirmado: sus entradas se cancelaron con ella (009, R3). */
const canceladaTrasConfirmar = (historial: readonly CambioEstadoCompra[]): boolean => {
  const estado = ultimoEstado(historial);
  return (
    (estado === EstadoCompra.CANCELADA || estado === EstadoCompra.REEMBOLSADA) && pasoPorConfirmada(historial)
  );
};

const codigosDe = ({ entradas }: PropiedadesCompra): string[] => entradas.map((entrada) => entrada.codigo);

/** Las invariantes de `Compra`, en el orden en que se informan (data-model, "Reglas de la compra"). */
export const REGLAS_DE_COMPRA: readonly ReglaDeCompra[] = [
  {
    nombre: "cantidad-valida",
    campo: "cantidad",
    mensaje: "Debe ser un entero mayor o igual a 1.",
    cumple: ({ cantidad }) => esCantidadValida(cantidad),
  },
  {
    nombre: "total-valido",
    campo: "total",
    mensaje: "Debe ser un entero mayor o igual a 0.",
    cumple: ({ total }) => esEnteroNoNegativo(total),
  },
  {
    nombre: "historial-valido",
    campo: "historial",
    mensaje: "Debe empezar en PENDIENTE, con estados válidos y fechas válidas no decrecientes.",
    cumple: ({ historial }) =>
      historial.length > 0 &&
      historial[0]?.estado === EstadoCompra.PENDIENTE &&
      historial.every(
        (cambio, i) =>
          ESTADOS.has(cambio.estado) &&
          cambio.fechaHora instanceof Date &&
          !Number.isNaN(cambio.fechaHora.getTime()) &&
          (i === 0 || cambio.fechaHora.getTime() >= historial[i - 1]!.fechaHora.getTime()),
      ),
  },
  {
    nombre: "reembolso-valido",
    campo: "historial",
    mensaje:
      "Un REEMBOLSADA es el último cambio, sigue a un CANCELADA y solo en una compra paga que se confirmó.",
    cumple: ({ historial, total }) =>
      historial.every(
        (cambio, i) =>
          cambio.estado !== EstadoCompra.REEMBOLSADA ||
          (i === historial.length - 1 &&
            historial[i - 1]?.estado === EstadoCompra.CANCELADA &&
            pasoPorConfirmada(historial) &&
            total > 0),
      ),
  },
  {
    nombre: "una-entrada-por-unidad",
    campo: "entradas",
    mensaje: "Debe haber una entrada por unidad comprada.",
    // Con una cantidad inválida no hay contra qué comparar: ya la informa `cantidad-valida`.
    cumple: ({ cantidad, entradas }) => !esCantidadValida(cantidad) || entradas.length === cantidad,
  },
  {
    nombre: "codigos-con-formato",
    campo: "entradas",
    mensaje: "Cada código debe tener 8 caracteres válidos.",
    cumple: (propiedades) => codigosDe(propiedades).every(esCodigoValido),
  },
  {
    nombre: "codigos-distintos",
    campo: "entradas",
    mensaje: "Los códigos de las entradas no se pueden repetir.",
    cumple: (propiedades) => {
      const codigos = codigosDe(propiedades);
      return new Set(codigos).size === codigos.length;
    },
  },
  {
    nombre: "sin-cambios-antes-de-confirmar",
    campo: "entradas",
    mensaje: "Una compra que no se confirmó no tiene entradas usadas ni canceladas.",
    cumple: ({ historial, entradas }) =>
      pasoPorConfirmada(historial) || entradas.every((entrada) => !entrada.usada && !entrada.cancelada),
  },
  {
    nombre: "usada-o-cancelada",
    campo: "entradas",
    mensaje: "Una entrada no puede estar usada y cancelada a la vez.",
    cumple: ({ entradas }) => entradas.every((entrada) => !(entrada.usada && entrada.cancelada)),
  },
  {
    nombre: "utilizada-si-alguna-usada",
    campo: "entradas",
    mensaje: "La compra está UTILIZADA si y solo si alguna de sus entradas se usó.",
    cumple: ({ historial, entradas }) =>
      (ultimoEstado(historial) === EstadoCompra.UTILIZADA) === entradas.some((entrada) => entrada.usada),
  },
  {
    nombre: "canceladas-con-la-compra",
    campo: "entradas",
    mensaje:
      "En una compra cancelada después de confirmada todas las entradas están canceladas, y en otro estado ninguna.",
    cumple: ({ historial, entradas }) =>
      canceladaTrasConfirmar(historial)
        ? entradas.every((entrada) => entrada.cancelada)
        : entradas.every((entrada) => !entrada.cancelada),
  },
];
