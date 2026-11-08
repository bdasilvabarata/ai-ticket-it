import {
  CODIGO_RESPUESTA_INESPERADA,
  ErrorDeApi,
  esErrorApi,
  MENSAJE_RESPUESTA_INESPERADA,
  ServidorNoDisponibleError,
} from "./errores";

const TIEMPO_LIMITE_POR_DEFECTO_MS = 8000;

export interface OpcionesPedido {
  signal?: AbortSignal;
  /** Si está (incluido `null`), reemplaza al usuario actual para este pedido. */
  usuarioId?: string | null;
}

export interface ClienteApi {
  readonly urlBase: string;
  get<T>(ruta: string, opciones?: OpcionesPedido): Promise<T>;
}

export interface DependenciasCliente {
  fetch: typeof fetch;
  urlBase: string;
  obtenerUsuarioId: () => string | null;
  /** Se llama con el id **del pedido** ante un 401 `USUARIO_NO_IDENTIFICADO`. */
  alUsuarioNoIdentificado: (usuarioId: string) => void;
  tiempoLimiteMs?: number;
}

type CuerpoLeido = { esJson: true; valor: unknown } | { esJson: false };

function interpretarCuerpo(texto: string): CuerpoLeido {
  try {
    return { esJson: true, valor: JSON.parse(texto) as unknown };
  } catch {
    return { esJson: false };
  }
}

/** Cliente HTTP de la app (contracts/cliente-api.md). Todo pedido al servidor pasa por acá. */
export function crearClienteApi({
  fetch: fetchInyectado,
  urlBase,
  obtenerUsuarioId,
  alUsuarioNoIdentificado,
  tiempoLimiteMs = TIEMPO_LIMITE_POR_DEFECTO_MS,
}: DependenciasCliente): ClienteApi {
  async function get<T>(ruta: string, opciones: OpcionesPedido = {}): Promise<T> {
    const url = `${urlBase}${ruta}`;
    const usuarioId = opciones.usuarioId !== undefined ? opciones.usuarioId : obtenerUsuarioId();
    const encabezados: Record<string, string> = { Accept: "application/json" };
    if (usuarioId !== null) encabezados["X-Usuario-Id"] = usuarioId;

    // Tiempo límite propio, encadenado a mano al signal externo (sin AbortSignal.any, R4).
    const controlador = new AbortController();
    const externo = opciones.signal;
    let vencio = false;
    const alAbortarExterno = () => controlador.abort();
    if (externo?.aborted) controlador.abort();
    else externo?.addEventListener("abort", alAbortarExterno);
    const temporizador = setTimeout(() => {
      vencio = true;
      controlador.abort();
    }, tiempoLimiteMs);

    const traducirFalla = (error: unknown): unknown => {
      if (externo?.aborted) return error; // cancelación: se relanza tal cual
      return new ServidorNoDisponibleError(url, vencio ? "tiempo-agotado" : "sin-conexion");
    };

    try {
      let respuesta: Response;
      let texto: string;
      try {
        respuesta = await fetchInyectado(url, {
          method: "GET",
          headers: encabezados,
          signal: controlador.signal,
        });
        texto = await respuesta.text();
      } catch (error) {
        throw traducirFalla(error);
      }

      const cuerpo = interpretarCuerpo(texto);
      if (respuesta.ok) {
        if (!cuerpo.esJson) {
          throw new ErrorDeApi(respuesta.status, CODIGO_RESPUESTA_INESPERADA, MENSAJE_RESPUESTA_INESPERADA);
        }
        return cuerpo.valor as T;
      }

      const error =
        cuerpo.esJson && esErrorApi(cuerpo.valor)
          ? new ErrorDeApi(
              respuesta.status,
              cuerpo.valor.error.codigo,
              cuerpo.valor.error.mensaje,
              cuerpo.valor.error.detalles ?? [],
            )
          : new ErrorDeApi(respuesta.status, CODIGO_RESPUESTA_INESPERADA, MENSAJE_RESPUESTA_INESPERADA);

      if (respuesta.status === 401 && error.codigo === "USUARIO_NO_IDENTIFICADO" && usuarioId !== null) {
        alUsuarioNoIdentificado(usuarioId);
      }
      throw error;
    } finally {
      clearTimeout(temporizador);
      externo?.removeEventListener("abort", alAbortarExterno);
    }
  }

  return { urlBase, get };
}
