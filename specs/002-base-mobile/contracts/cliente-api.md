# Contrato: cliente HTTP de la app (`mobile/src/api/`)

Interfaz que usan las pantallas y las features 003+. Consume los endpoints de
[`specs/001-base-backend/contracts/api.md`](../../001-base-backend/contracts/api.md); esta
feature no agrega endpoints. Decisiones en [research.md](../research.md) (R4, R10).

## Construcción

```ts
crearClienteApi(dependencias: {
  fetch: typeof fetch;
  urlBase: string;                                   // ej.: "http://192.168.0.23:3000/api"
  obtenerUsuarioId: () => string | null;             // usuario actual
  alUsuarioNoIdentificado: (usuarioId: string) => void;
  tiempoLimiteMs?: number;                           // por defecto 8000
}): ClienteApi

interface ClienteApi {
  readonly urlBase: string;
  get<T>(ruta: string, opciones?: { signal?: AbortSignal; usuarioId?: string | null }): Promise<T>;
}
```

- `ruta` empieza con `/` y es relativa a `urlBase` (`/usuarios` → `GET {urlBase}/usuarios`).
- `opciones.usuarioId`: si está (incluido `null`), reemplaza a `obtenerUsuarioId()` para ese
  pedido. Lo usa la validación del usuario recordado antes de que sea el actual.
- Encabezados: `Accept: application/json`. `X-Usuario-Id: <id>` solo si hay usuario.

## Resultado

| Situación | Resultado |
|---|---|
| status 2xx con JSON | resuelve con el cuerpo tipado `T` |
| status 2xx con cuerpo no JSON | rechaza `ErrorDeApi(status, "RESPUESTA_INESPERADA")` |
| status ≥ 400 con cuerpo `ErrorApi` | rechaza `ErrorDeApi(status, codigo, mensaje, detalles ?? [])` |
| status ≥ 400 sin formato `ErrorApi` | rechaza `ErrorDeApi(status, "RESPUESTA_INESPERADA", "El servidor respondió de forma inesperada.")` |
| 401 `USUARIO_NO_IDENTIFICADO` en un pedido **con** usuario | llama `alUsuarioNoIdentificado(idDelPedido)` y rechaza el `ErrorDeApi` |
| `fetch` rechaza (red, DNS, conexión rechazada) | rechaza `ServidorNoDisponibleError(url, "sin-conexion")` |
| sin respuesta en `tiempoLimiteMs` | aborta el pedido y rechaza `ServidorNoDisponibleError(url, "tiempo-agotado")` |
| `opciones.signal` abortado | rechaza con el `AbortError` original (cancelación, no falla) |

## Funciones por recurso (`mobile/src/api/usuarios.ts`)

| Función | Pedido | Usuario | Devuelve |
|---|---|---|---|
| `listarUsuarios(cliente, { signal? })` | `GET /usuarios` | no se envía (`usuarioId: null`) | `UsuarioVista[]` en el orden del servidor |
| `obtenerUsuarioActual(cliente, usuarioId, { signal? })` | `GET /usuarios/actual` | el `usuarioId` recibido | `UsuarioVista` |

## Dirección del servidor (`mobile/src/api/direccion.ts`)

```ts
resolverUrlBase(entrada: { urlEntorno?: string; hostUri?: string | null }): string
```

| `urlEntorno` | `hostUri` | Resultado |
|---|---|---|
| `"http://10.0.0.5:3000/api/"` | cualquiera | `"http://10.0.0.5:3000/api"` |
| vacía o ausente | `"192.168.0.23:8081"` | `"http://192.168.0.23:3000/api"` |
| vacía o ausente | ausente | `"http://localhost:3000/api"` |

## Exportaciones de `mobile/src/api/index.ts`

`crearClienteApi`, `ClienteApi`, `ErrorDeApi`, `ServidorNoDisponibleError`, `resolverUrlBase`,
`listarUsuarios`, `obtenerUsuarioActual`. Fuera de `src/api/` y `src/composicion.tsx`, el
lint prohíbe usar `fetch`.
