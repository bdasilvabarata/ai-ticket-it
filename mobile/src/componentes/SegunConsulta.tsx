import type { ReactNode } from "react";

import { ErrorDeApi, ServidorNoDisponibleError } from "../api";
import { useConexion } from "../conexion";
import { Cargando } from "./Cargando";
import { ListaVacia } from "./ListaVacia";
import { MensajeError } from "./MensajeError";

/** La parte de un `UseQueryResult` que usa `SegunConsulta` (data-model "SegunConsulta"). */
export interface ConsultaMostrable<T> {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data: T | undefined;
  isFetching: boolean;
  refetch: () => unknown;
}

export interface PropsSegunConsulta<T> {
  consulta: ConsultaMostrable<T>;
  mensajeVacio: string;
  /** Por defecto: `undefined`, `null` o un arreglo vacío. */
  esVacio?: (datos: T | undefined) => boolean;
  children: (datos: T) => ReactNode;
}

function esVacioPorDefecto(datos: unknown): boolean {
  return datos === undefined || datos === null || (Array.isArray(datos) && datos.length === 0);
}

/**
 * Los cuatro estados de una pantalla con datos del servidor (FR-013, research R8): cargando, error
 * (servidor no disponible → la secuencia única; otro → `refetch`), vacío y datos.
 */
export function SegunConsulta<T>({
  consulta,
  mensajeVacio,
  esVacio = esVacioPorDefecto,
  children,
}: PropsSegunConsulta<T>) {
  const conexion = useConexion();

  if (consulta.isPending) return <Cargando />;

  if (consulta.isError) {
    const { error } = consulta;
    if (error instanceof ServidorNoDisponibleError) {
      return (
        <MensajeError
          titulo="Servidor no disponible"
          mensaje={`No se pudo conectar con ${conexion.urlBase}.`}
          alReintentar={() => void conexion.reintentarAhora()}
          reintentando={conexion.enCurso}
        />
      );
    }
    return (
      <MensajeError
        mensaje={error instanceof ErrorDeApi ? error.mensaje : "Ocurrió un error inesperado."}
        alReintentar={() => void consulta.refetch()}
        reintentando={consulta.isFetching}
      />
    );
  }

  const { data } = consulta;
  if (esVacio(data) || data === undefined) return <ListaVacia mensaje={mensajeVacio} />;
  return children(data);
}
