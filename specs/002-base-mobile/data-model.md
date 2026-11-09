# Data Model: Base mobile (002)

La app no define entidades de negocio nuevas: consume `UsuarioVista` y `ErrorApi` de
`@ai-ticket-it/shared` (definidas en 001). Este documento modela el **estado del cliente**:
sesión, usuario recordado, conexión, errores y dependencias. Decisiones en
[research.md](./research.md).

## UsuarioVista (de `shared`, sin cambios)

| Campo | Tipo | Nota |
|---|---|---|
| `id` | `string` | id legible del seed (`usuario-lucia`) o UUID |
| `nombre` | `string` | |
| `apellido` | `string` | |
| `cantidadEventosOrganizados` | `number` | se muestra en el selector |

## UsuarioRecordado (AsyncStorage, R6)

- Clave: `ai-ticket-it/usuario-recordado`.
- Valor: JSON `{ "version": 1, "usuarioId": string }`.
- Reglas de lectura: si falta la clave → `null`. Si el JSON es inválido, `version !== 1`,
  `usuarioId` no es un string no vacío o la lectura falla → se borra la clave y se devuelve
  `null`. Nunca lanza.
- Se escribe al elegir un usuario y se borra al olvidarlo (401 en la validación o durante el
  uso).

## EstadoSesion (reducer puro, R5)

```text
EstadoSesion =
  | { fase: "iniciando" }
  | { fase: "sin-usuario"; aviso: "usuario-anterior-inexistente" | null }
  | { fase: "con-usuario";
      usuarioId: string;
      usuario: UsuarioVista | null;          // null = conservado sin confirmar
      servidor: "disponible" | "no-disponible" }
```

Transiciones (eventos del reducer):

| Desde | Evento | Hacia |
|---|---|---|
| `iniciando` | `sin-recordado` | `sin-usuario` (aviso `null`) |
| `iniciando` | `validado(usuarioId, confirmado, usuario)` | `con-usuario`, `usuario`, `servidor: disponible` |
| `iniciando` | `validado(usuarioId, olvidar)` | `sin-usuario`, aviso `usuario-anterior-inexistente` |
| `iniciando` | `validado(usuarioId, conservar-sin-servidor)` | `con-usuario`, `usuario: null`, `servidor: no-disponible` |
| `con-usuario` | `validado(usuarioId, confirmado, usuario)` | mismo `usuarioId`, `usuario`, `servidor: disponible` |
| `con-usuario` | `validado(usuarioId, conservar-sin-servidor)` / `servidor-no-disponible` | `servidor: no-disponible` (conserva `usuario`) |
| `con-usuario` | `validado(usuarioId, olvidar)` / `usuario-no-identificado(id)` con `id === usuarioId` | `sin-usuario`, aviso `usuario-anterior-inexistente` |
| `con-usuario` | `usuario-no-identificado(id)` con otro `id` | sin cambios (respuesta de un usuario anterior) |
| `sin-usuario` / `con-usuario` | `elegido(usuario)` | `con-usuario`, `usuario`, `servidor: disponible`; el provider detiene la secuencia (A1) |
| `sin-usuario` | `validado(...)` / `usuario-no-identificado(...)` | sin cambios (olvidar es idempotente, U2) |

Un `validado` que llega para un `usuarioId` distinto del actual se descarta (cambio de
usuario durante una validación en curso).

## DecisionValidacion (regla de FR-013, función pura)

`decidirValidacion(resultado: { ok: true; usuario: UsuarioVista } | { ok: false; error: unknown })`

| Resultado | Decisión |
|---|---|
| `ok: true` | `{ tipo: "confirmado", usuario }` |
| `ErrorDeApi` status 401 y `codigo === "USUARIO_NO_IDENTIFICADO"` | `{ tipo: "olvidar" }` |
| `ServidorNoDisponibleError` (sin conexión o tiempo agotado) | `{ tipo: "conservar-sin-servidor" }` |
| cualquier otro `ErrorDeApi` (500, 404, `RESPUESTA_INESPERADA`…) | `{ tipo: "conservar-sin-servidor" }` |
| cualquier otra excepción | `{ tipo: "conservar-sin-servidor" }` |

## SecuenciaDeReintentos (R7)

| Campo | Tipo | Regla |
|---|---|---|
| `esperasMs` | `readonly number[]` | `[1000, 2000, 4000, 8000, 16000, 32000]` |
| `enCurso` | `boolean` | nunca hay dos intentos simultáneos |
| `automaticosRestantes` | `number` (6 → 0) | al llegar a 0, solo queda el manual |

Estados: `inactiva` → (`iniciar`) → `esperando(i)` → (vence la espera) → `intentando` →
éxito: `inactiva` · fallo con `i < 5`: `esperando(i+1)` · fallo con `i = 5`: `agotada`.
`reintentarAhora()` desde `esperando` o `agotada` → `intentando` → si falla, `esperando(0)`.
Desde `intentando` se ignora. `detener()` → `inactiva` desde cualquier estado.

## EstadoConexion (derivado, para la UI)

No se guarda aparte: se deriva de `EstadoSesion` (`servidor`) y de la **única** secuencia de
la app (`enCurso`, `automaticosRestantes`), más la `urlBase` de las dependencias. Se expone
con `useConexion()`. Lo consumen
`FranjaServidorNoDisponible` y el estado de error del selector.

## Errores de la app (R4)

| Clase | Campos | Cuándo |
|---|---|---|
| `ErrorDeApi` | `status: number`, `codigo: string`, `mensaje: string`, `detalles: DetalleError[]` | el servidor respondió status ≥ 400, o un cuerpo que no se pudo interpretar (`codigo: "RESPUESTA_INESPERADA"`) |
| `ServidorNoDisponibleError` | `url: string`, `motivo: "sin-conexion" \| "tiempo-agotado"` | `fetch` rechazado o sin respuesta en 8 s |

`mensaje` de `ServidorNoDisponibleError`: "No se pudo conectar con el servidor." Una
cancelación del pedido (abort externo) no es ninguno de los dos: se relanza el `AbortError`.

## Dependencias (composition root, R10)

```text
Dependencias = {
  urlBase: string;
  usuarioRecordado: RepositorioUsuarioRecordado;   // leer, guardar, olvidar
  queryClient: QueryClient;
  crearCliente(opciones: { obtenerUsuarioId; alUsuarioNoIdentificado }): ClienteApi;
  // El QueryClient se crea antes que la sesión: la sesión se suscribe con esto para
  // enterarse de los errores de queries y mutations (R8). Devuelve la función para desuscribirse.
  registrarOyenteDeErrores(oyente: (error: unknown) => void): () => void;
}
```

`crearDependencias({ fetch, almacenamiento, urlEntorno, hostUri })` en `src/composicion.tsx`.
Es el único lugar que instancia piezas. La sesión crea su cliente con `crearCliente`
(necesita leer su propio estado) y lo comparte por contexto con las pantallas.

## Claves de consulta (R9)

| Clave | Depende del usuario | Uso |
|---|---|---|
| `["usuarios"]` | no | lista del selector |
| `["usuario-actual", usuarioId]` | sí | reservada; la validación de la sesión no usa Query |

Convención para 003+: toda clave de datos que dependan del usuario lleva `usuarioId` en la
posición 1.
