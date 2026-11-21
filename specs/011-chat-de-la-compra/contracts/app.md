# Contrato de la app: Chat de la compra (011)

Pantallas, navegación, consultas y textos de la feature `compras`. Las decisiones están en
[research.md](../research.md) (R9 a R12).

## Ruta y navegación

| Ruta (`app/`) | Re-export | Título | Llega desde |
|---|---|---|---|
| `compras/[compraId]/index.tsx` (**movida** desde `compras/[compraId].tsx`) | `Compra` | "Tu compra" | sin cambios |
| `compras/[compraId]/chat.tsx` (**nueva**) | `ChatDeLaCompra` | "Chat de la compra" | "Tu compra" (comprador) y "Compras del evento" (organizador) |

Las dos pantallas se declaran en `LayoutRaiz` dentro del `Stack.Protected` de `con-usuario`. Se
llega con `router.push({ pathname: "/compras/[compraId]/chat", params: { compraId } })`, por la
ruta tipada.

## Accesos

| Pantalla | Control | Dónde | Cuándo |
|---|---|---|---|
| "Tu compra" (`Compra.tsx`) | `Boton variante="aviso"` "Chat con el organizador" | debajo de `ResumenCompra` | en todos los estados |
| "Compras del evento" (`FilaCompraDelEvento`) | `Boton variante="texto"` "Abrir chat", `accessibilityLabel` "Abrir el chat con Martín Benítez" | al pie de la tarjeta, **hermano** del bloque accesible (como "Confirmar reembolso") | en todas las filas y estados, también con el evento realizado |

## Consulta y mutation

| Hook | Clave | Pedido |
|---|---|---|
| `useChatDeLaCompra(usuarioId, compraId)` | `["chat-de-la-compra", usuarioId, compraId]` | `GET /compras/:compraId/mensajes` |
| `useEnviarMensaje(usuarioId, compraId)` | — | `POST /compras/:compraId/mensajes` `{ texto }` en nombre de `usuarioId`, sin reintentos |

- `useEnviarMensaje`, al terminar, con éxito o con error, invalida el chat de **esa compra** para
  todos los usuarios guardados en la caché (predicado: `["chat-de-la-compra", *, compraId]`). No
  invalida ninguna otra vista.
- `usePagarCompra`, `useCancelarCompra`, `useRegistrarUso` y `useConfirmarReembolso` suman la
  invalidación de `["chat-de-la-compra"]` por prefijo, porque cambian el estado que muestra el
  encabezado.
- La pantalla vuelve a pedir el chat al recuperar el foco (`useRefrescarAlFocalizar`), salvo la
  primera vez, porque al montarse ya lo pidió.

## Pantalla "Chat de la compra"

Se arma, de arriba hacia abajo, en `PantallaDesplazable` con `empezarAlFinal` (abre mostrando el
final de la conversación y el campo):

1. **Encabezado** (`EncabezadoDelChat`):
   - el nombre del evento, como título (`accessibilityRole="header"`);
   - la otra parte: "Con Lucía Álvarez · Organizador" o "Con Martín Benítez · Comprador";
   - "VIP · 2 entradas" y `EtiquetaEstadoCompra` con el estado.
2. **Mensajes** (`MensajeDelChat`, uno por mensaje, con clave `numero`), o "Todavía no hay
   mensajes" si la conversación está vacía.
3. **Campo**: `CampoDeTexto` multilínea con la etiqueta "Mensaje", `AvisoDeFormulario` y
   `Boton` "Enviar" ("Enviando…" mientras está en curso).

### Un mensaje

| | Propio (`autor.id === usuarioId`) | Del otro |
|---|---|---|
| Alineación | derecha | izquierda |
| Autor | "Vos" (el rol propio solo va en la etiqueta accesible, FR-017) | "Lucía Álvarez · Organizador" |
| Fondo | `resaltado`, con `texto` encima | `superficie` |
| Hora | `textoFechaHora(enviadoEnLocal)`: "vie 20 nov 2026 · 14:35" | ídem |
| `accessibilityLabel` | "Vos, comprador, vie 20 nov 2026 · 14:35: ¿A qué hora abren?" | "Lucía Álvarez, organizador, vie 20 nov 2026 · 16:00: Abren a las 18." |

El texto respeta sus saltos de línea. Cada mensaje es un solo elemento accesible (`accessible`)
con su etiqueta.

### Estados

| Estado | Qué se ve |
|---|---|
| Cargando | `Cargando` (de `SegunConsulta`) |
| Error 403 | `Ilustracion` con un candado y "No tenés permiso para ver este chat." |
| Error 404 | "No encontramos esta compra." y "Ir a Explorar" |
| Otro error | lo que muestra `SegunConsulta`: el mensaje y "Reintentar" (sin servidor, la franja global y sus reintentos) |
| Sin mensajes | el encabezado, "Todavía no hay mensajes" y el campo |
| Con mensajes | el encabezado, los mensajes y el campo |

### Enviar

- "Enviar" llama a `useEnviarMensaje` a través de `useEnvioUnico`: un doble toque manda un solo
  pedido. Mientras está en curso, el botón muestra "Enviando…".
- La app no valida: no hay `maxLength` y el botón no se deshabilita con el campo vacío.
- **Éxito**: el campo se vacía. El mensaje aparece cuando vuelve la conversación pedida de nuevo
  (al invalidarla).
- **400**: el `mensaje` del detalle `body.texto` se muestra como error del campo y el texto
  escrito se conserva.
- **Otro `ErrorDeApi`** (403, 404): su `mensaje` con `AvisoDeFormulario`.
- **Sin servidor**: "No se pudo enviar. Probá de nuevo." Además se ve la franja global. El texto
  se conserva.

## Textos (`features/compras/formato.ts`)

| Función | Ejemplos |
|---|---|
| `textoRolEnLaCompra(rol)` | `"comprador"` → "Comprador"; `"organizador"` → "Organizador" |
| `textoOtraParte(parte)` | "Con Lucía Álvarez · Organizador" |
| `textoAutorDelMensaje(mensaje, usuarioId)` | propio → "Vos"; ajeno → "Lucía Álvarez · Organizador" |
| `etiquetaDelMensaje(mensaje, usuarioId)` | "Vos, comprador, vie 20 nov 2026 · 14:35: <texto>" |
| `SIN_MENSAJES` | "Todavía no hay mensajes" |

## Helpers de test (`mobile/tests/helpers/compras.ts`)

Suma `chatDeEjemplo` (el chat del seed visto por Martín y por Lucía) y `mensajeDeEjemplo`.
`renderConDependencias` no cambia: el chat solo se pide al abrir la pantalla.
