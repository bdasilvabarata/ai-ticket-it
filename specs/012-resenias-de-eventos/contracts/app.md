# Contrato de la app: Reseñas de eventos (012)

Las decisiones están en [research.md](../research.md) (R11). La API, en [api.md](./api.md).

## Rutas

| Ruta (`app/`) | Re-export | Título |
|---|---|---|
| `compras/[compraId]/resenia.tsx` (nueva) | `ReseniarEvento` de `features/compras` | "Reseñar evento" |

`LayoutRaiz` registra la pantalla en el `Stack`, en la misma fase de la sesión que
`compras/[compraId]/index` y `/chat`. `tests/tipos/rutas-tipadas.ts` suma la guarda de
`/compras/[compraId]/resenia` sin parámetro.

## Cliente (`src/api/resenias.ts`, nuevo; exportado por `index.ts`)

| Función | Pedido |
|---|---|
| `reseniarEvento(cliente, eventoId, datos: DatosResenia)` | `POST /eventos/:eventoId/resenias` → `ReseniaVista` |
| `obtenerReseniasDelOrganizador(cliente, eventoId, signal?)` | `GET /eventos/:eventoId/resenias-del-organizador` → `ReseniasDelOrganizadorVista` |

## Consultas

- **Clave**: `claves.reseniasDelOrganizador(usuarioId, eventoId)` →
  `["resenias-del-organizador", usuarioId, eventoId]`. No comparte prefijo con `["evento"]`.
- **`useReseniasDelOrganizador(usuarioId, eventoId)`** (feature `eventos`).
- **`useReseniarEvento(usuarioId, eventoId)`** (feature `compras`, `mutaciones.ts`): no reintenta.
  Al terminar con éxito invalida por prefijo:
  - `["compra"]`, `["mis-compras"]` y `["mis-compras-del-evento"]`: la reseña propia en todas sus
    compras del evento;
  - `["evento"]` y `["catalogo"]`: el puntaje del organizador;
  - `["resenias-del-organizador"]`.

## Pantalla "Reseñar evento" (`ReseniarEvento`)

Se dibuja desde `useCompra(usuarioId, compraId)`, con `SegunConsulta`. Un 403/404 lo muestra
`AvisoDeLaCompra`.

- **Encabezado**: el nombre del evento.
- **Si `compra.puedeReseniar`**, el formulario:
  - `SelectorPuntuacion`: cinco botones en fila, `accessibilityRole="radio"`. Cada uno se etiqueta
    "N de 5" y lleva `accessibilityState={{ checked }}`. Ninguno arranca elegido. El elegido se
    distingue con algo más que el color (relleno y marca).
  - `CampoDeTexto` "Comentario (opcional)", multilínea, con `maxLength` =
    `LIMITES_RESENIA.comentarioLargoMaximo`.
  - "Enviar" (`Boton` primario) con `useEnvioUnico`: un segundo toque no manda otro pedido.
  - Un 400 pone los detalles junto a cada campo (`body.puntuacion`, `body.comentario`) y conserva lo
    elegido y lo escrito. La app no valida por su cuenta.
  - Un 409 (`RESENIA_REPETIDA`, `SIN_COMPRA_UTILIZADA`, `RESENIA_PROPIO_EVENTO`) muestra el
    `mensaje` del servidor en un `AvisoDeFormulario`.
  - Al enviar con éxito: `salirSinConfirmar(() => router.back())`.
  - `useConfirmarDescarte`: "¿Descartar los cambios?" al salir solo si hay puntuación elegida o
    comentario no vacío.
- **Si `compra.resenia`** (la abrió desactualizada): "Ya reseñaste este evento" y la reseña propia,
  sin formulario.
- **Si no** (la compra no está `UTILIZADA`): "Solo podés reseñar un evento al que asististe.", sin
  formulario.

## Accesos

- **"Tu compra"** (`Compra`): la sección `ReseniaDeLaCompra`, después de las entradas.
  - Con `puedeReseniar`: `Boton` "Reseñar evento" → `/compras/[compraId]/resenia`.
  - Con `resenia`: "Tu reseña" con `Puntuacion` y el comentario, si tiene (sin texto de relleno).
  - Si no, nada.
- **"Mis compras"** (`FilaMiCompra`): lo mismo.
  - "Reseñar evento" va **como hermano** del `Pressable` de los datos de la fila, no adentro, como
    "Pagar" (FR-012).
  - La reseña propia va dentro del bloque accesible de la fila, en su etiqueta.

## Sección "Reseñas del organizador" (en `DetalleEvento`, feature `eventos`)

Va al final del detalle, para cualquier usuario (también el organizador). Tiene sus propios estados
con `SegunConsulta`: cargando y error **solo en la sección**, sin tapar el detalle.

- **Título** "Reseñas del organizador".
- **Con reseñas**:
  - `textoPuntaje({ puntaje, cantidadResenias })`, el mismo de la tarjeta ("4,7 · 3 reseñas");
  - una `FilaResenia` por reseña, en el orden del servidor, con `Puntuacion`, el comentario (si
    tiene), "Nombre Apellido", el nombre del evento y la fecha (`textoFechaResenia(creadaEnLocal)`:
    el día, con el formato de fechas de la app).
  - Cada fila es **un** elemento accesible, con `etiquetaDeResenia`.
- **Sin reseñas**: "Todavía no tiene reseñas", sin puntaje.

## Componentes y textos nuevos

| Pieza | Feature | Exportada por `index.ts` |
|---|---|---|
| `Puntuacion` (solo lectura; "Puntuación: N de 5") | `eventos` | sí (la usa `compras`) |
| `ReseniasDelOrganizador`, `FilaResenia`, `useReseniasDelOrganizador` | `eventos` | no (las usa `DetalleEvento`) |
| `useConfirmarDescarte`, `salirSinConfirmar` / lo de `errores-de-formulario.ts` que use el formulario | `eventos` | sí (nuevo export) |
| `SelectorPuntuacion`, `ReseniaDeLaCompra`, `ReseniarEvento` | `compras` | `ReseniarEvento` |
| `textoPuntuacion`, `textoFechaResenia`, `etiquetaDeResenia` | `eventos/formato.ts` | `textoPuntuacion` |
| `textoAvisoResenia` (los dos avisos sin formulario) | `compras/formato.ts` | — |

Las pantallas usan `tema` (sin valores sueltos), `tipografia` para los textos y 360 px de ancho.
