/**
 * `fetch` falso para los tests: sin red ni servidor (FR-025).
 *
 * Cada pedido consume la siguiente respuesta de la lista; cuando se acaba, repite la última.
 * Una respuesta también puede ser una función que elige según la URL (por ejemplo, por ruta).
 */

export type RespuestaFalsa =
  { status: number; json: unknown } | { status: number; texto: string } | "rechazar" | "colgar";

export type FuncionRespuesta = (url: string, init: RequestInit | undefined) => RespuestaFalsa;

export type Respuestas = FuncionRespuesta | ReadonlyArray<RespuestaFalsa | FuncionRespuesta>;

export interface PedidoRegistrado {
  url: string;
  metodo: string;
  encabezados: Record<string, string>;
  /** El `init.body` si es un string (los pedidos con cuerpo JSON); si no, `undefined`. */
  cuerpo?: string;
}

export interface FetchFalso {
  fetch: typeof fetch;
  pedidos: PedidoRegistrado[];
  /** Pedidos cuya URL termina en `ruta` (por ejemplo, `"/usuarios/actual"`). */
  pedidosA(ruta: string): PedidoRegistrado[];
}

function crearAbortError(): Error {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

function normalizarEncabezados(encabezados: HeadersInit | undefined): Record<string, string> {
  if (!encabezados) return {};
  if (Array.isArray(encabezados)) return Object.fromEntries(encabezados);
  if (typeof Headers !== "undefined" && encabezados instanceof Headers) {
    const resultado: Record<string, string> = {};
    encabezados.forEach((valor, clave) => {
      resultado[clave] = valor;
    });
    return resultado;
  }
  return { ...(encabezados as Record<string, string>) };
}

function crearRespuesta(status: number, cuerpo: string): Response {
  const respuesta = {
    status,
    ok: status >= 200 && status < 300,
    text: async () => cuerpo,
    json: async () => JSON.parse(cuerpo) as unknown,
  };
  return respuesta as unknown as Response;
}

export function crearFetchFalso(respuestas: Respuestas): FetchFalso {
  const pedidos: PedidoRegistrado[] = [];
  let indice = 0;

  function siguiente(url: string, init: RequestInit | undefined): RespuestaFalsa {
    if (typeof respuestas === "function") return respuestas(url, init);
    if (respuestas.length === 0) throw new Error("crearFetchFalso: no hay respuestas configuradas");
    const elegida = respuestas[Math.min(indice, respuestas.length - 1)];
    indice += 1;
    return typeof elegida === "function" ? elegida(url, init) : elegida;
  }

  const fetchFalso = (entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof entrada === "string" ? entrada : entrada.toString();
    pedidos.push({
      url,
      metodo: init?.method ?? "GET",
      encabezados: normalizarEncabezados(init?.headers),
      cuerpo: typeof init?.body === "string" ? init.body : undefined,
    });
    const respuesta = siguiente(url, init);
    const signal = init?.signal ?? undefined;
    if (signal?.aborted) return Promise.reject(crearAbortError());

    if (respuesta === "rechazar") return Promise.reject(new TypeError("Network request failed"));
    if (respuesta === "colgar") {
      return new Promise<Response>((_resolver, rechazar) => {
        signal?.addEventListener("abort", () => rechazar(crearAbortError()));
      });
    }
    const cuerpo = "json" in respuesta ? JSON.stringify(respuesta.json) : respuesta.texto;
    return Promise.resolve(crearRespuesta(respuesta.status, cuerpo));
  };

  return {
    fetch: fetchFalso as typeof fetch,
    pedidos,
    pedidosA: (ruta) => pedidos.filter((pedido) => pedido.url.endsWith(ruta)),
  };
}

/**
 * Respuestas por ruta: cada ruta consume su propia lista y, cuando se acaba, repite la última.
 * La ruta se compara con el final de la URL (`"/usuarios"` no matchea `"/usuarios/actual"`).
 */
export function porRuta(mapa: Record<string, ReadonlyArray<RespuestaFalsa>>): FuncionRespuesta {
  const indices = new Map<string, number>();
  return (url) => {
    const ruta = Object.keys(mapa).find((candidata) => url.endsWith(candidata));
    if (ruta === undefined) throw new Error(`porRuta: no hay respuestas para ${url}`);
    const lista = mapa[ruta];
    const indice = indices.get(ruta) ?? 0;
    indices.set(ruta, indice + 1);
    return lista[Math.min(indice, lista.length - 1)];
  };
}
