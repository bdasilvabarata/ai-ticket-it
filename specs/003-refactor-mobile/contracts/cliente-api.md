# Contrato: cliente HTTP de la app (`mobile/src/api/`), versión 003

Reemplaza la sección "Construcción" de
[`specs/002-base-mobile/contracts/cliente-api.md`](../../002-base-mobile/contracts/cliente-api.md).
Todo lo demás de ese contrato sigue vigente para **todo** método: la tabla de resultados, las
funciones de `usuarios.ts` y `resolverUrlBase`. Decisiones en
[research.md R10](../research.md#r10-cliente-http-con-todos-los-métodos).

## Construcción

```ts
crearClienteApi(dependencias: {
  fetch: typeof fetch;
  urlBase: string;
  obtenerUsuarioId: () => string | null;
  alUsuarioNoIdentificado: (usuarioId: string) => void;
  tiempoLimiteMs?: number;                       // por defecto 8000
}): ClienteApi

type MetodoHttp = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface OpcionesPedido {
  signal?: AbortSignal;
  /** Si está (incluido `null`), reemplaza al usuario actual para este pedido. */
  usuarioId?: string | null;
}

interface OpcionesPedidoConCuerpo extends OpcionesPedido {
  cuerpo?: unknown;
}

interface ClienteApi {
  readonly urlBase: string;
  pedir<T>(metodo: MetodoHttp, ruta: string, opciones?: OpcionesPedidoConCuerpo): Promise<T>;
  get<T>(ruta: string, opciones?: OpcionesPedido): Promise<T>;
  post<T>(ruta: string, cuerpo?: unknown, opciones?: OpcionesPedido): Promise<T>;
  put<T>(ruta: string, cuerpo?: unknown, opciones?: OpcionesPedido): Promise<T>;
  patch<T>(ruta: string, cuerpo?: unknown, opciones?: OpcionesPedido): Promise<T>;
  delete<T>(ruta: string, opciones?: OpcionesPedido): Promise<T>;
}
```

Los atajos solo llaman a `pedir` con su método. `get` sigue con la misma firma que en la 002,
así `listarUsuarios` y `obtenerUsuarioActual` no cambian.

## Encabezados y cuerpo

| Pedido | `Accept` | `X-Usuario-Id` | `Content-Type` | `body` |
|---|---|---|---|---|
| sin `cuerpo` (`undefined`) | `application/json` | si hay usuario | — | — |
| con `cuerpo` | `application/json` | si hay usuario | `application/json` | `JSON.stringify(cuerpo)` |

## Resultados que se agregan

| Situación | Resultado |
|---|---|
| status `204` (cualquier método) | resuelve `undefined`, sin interpretar el cuerpo |
| status 2xx distinto de 204 con cuerpo vacío o no JSON | rechaza `ErrorDeApi(status, "RESPUESTA_INESPERADA")` (como en la 002) |

## Reintentos

El cliente **nunca** repite un pedido. `QueryClient` tiene `retry: false` para queries y
mutations. Después de recuperarse, la secuencia de reintentos solo vuelve a pedir las
**queries** activas que estaban en error. Una escritura que venció el tiempo límite no se
repite sola: lo decide la pantalla que la envió (features 004+).

## Agregar un endpoint de escritura (ejemplo para 004+)

En el archivo del recurso (`src/api/eventos.ts`), una función de pocas líneas, sin tocar
`cliente.ts`:

```ts
/** `POST /eventos` en nombre del usuario actual. */
export function crearEvento(cliente: ClienteApi, datos: DatosNuevoEvento): Promise<EventoVista> {
  return cliente.post<EventoVista>("/eventos", datos);
}
```

…y su export en `src/api/index.ts`.
