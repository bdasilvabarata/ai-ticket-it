# Contrato: componentes base de pantalla (`mobile/src/componentes/`)

Props y tipos en [data-model.md](../data-model.md#boton). Decisiones en
[research.md R6–R8](../research.md#r6-tema-único).

## `Boton`

| Caso | Se ve | Lector de pantalla | Al tocar |
|---|---|---|---|
| normal | `texto`, estilo de la variante | botón, `texto` (o `accessibilityLabel`) | llama `alPresionar` |
| presionado | opacidad apagada | — | — |
| `deshabilitado` | opacidad apagada | botón, deshabilitado | nada |
| `enCurso` | `textoEnCurso`, opacidad apagada | botón, deshabilitado, ocupado | nada |

Uso en las pantallas actuales (sin cambios visibles):

| Lugar | Variante | Texto | En curso |
|---|---|---|---|
| `MensajeError` | `primario` | "Reintentar" | "Reintentando…" |
| Perfil | `primario` | "Cambiar usuario" | — |
| Franja | `aviso` | "Reintentar" | "Reintentando…" |
| Encabezado del modal | `texto` | "Cerrar" (label "Cerrar sin cambiar de usuario") | — |

## `SegunConsulta`

| Estado de la consulta | Muestra |
|---|---|
| pendiente | `Cargando` ("Cargando…") |
| error `ServidorNoDisponibleError` | `MensajeError` "Servidor no disponible" / "No se pudo conectar con {urlBase}." / "Reintentar" → `useConexion().reintentarAhora()` (secuencia única) |
| error `ErrorDeApi` | `MensajeError` con `error.mensaje` / "Reintentar" → `consulta.refetch()` |
| error de otro tipo | `MensajeError` "Ocurrió un error inesperado." / "Reintentar" → `consulta.refetch()` |
| éxito y `esVacio(datos)` (por defecto `undefined`, `null` o `[]`) | `ListaVacia` con `mensajeVacio` |
| éxito con datos | `children(datos)` |

En el selector de usuario: `mensajeVacio = "No hay usuarios disponibles."`. Los datos se
muestran con la `FlatList` de siempre ("¿Con quién querés operar?" y una `FilaUsuario` por
usuario).

## `tema`

Un único objeto `tema` con `colores`, `espacio`, `texto`, `peso`, `radio` y
`opacidadApagado` (valores en [data-model.md](../data-model.md#tema)). Ningún componente de
`src/` define colores ni tamaños sueltos.

## Formato de vista (`features/usuarios/formato.ts`)

| Función | Entrada | Salida |
|---|---|---|
| `nombreCompleto` | `{ nombre: "Lucía", apellido: "Gómez" }` | `"Lucía Gómez"` |
| `textoEventosOrganizados` | `0` · `1` · `3` | `"No organiza eventos"` · `"Organiza 1 evento"` · `"Organiza 3 eventos"` |
