# Contrato de la app: Comprar entradas (006)

Pantallas, rutas, textos, estados y componentes de la feature. Sigue la skill `nueva-pantalla`
y los patrones de `specs/005-explorar-eventos/contracts/app.md`. Los textos de abajo son los que
buscan los tests.

## Rutas

| Ruta (`app/`) | Pantalla | Título del header |
|---|---|---|
| `explorar/[eventoId]/index.tsx` **(se mueve** desde `explorar/[eventoId].tsx`) | `DetalleEventoConCompras` (feature `compras`) | "Evento" |
| `explorar/[eventoId]/comprar/[tipoEntradaId].tsx` **(nueva)** | `ComprarEntradas` (feature `compras`) | "Comprar entradas" |
| `compras/[compraId].tsx` **(nueva)** | `Compra` (feature `compras`) | "Tu compra" |

- Los tres archivos son un re-export de una línea.
- `LayoutRaiz` los declara en el `Stack.Protected` de `con-usuario`
  (`explorar/[eventoId]/index` reemplaza a `explorar/[eventoId]`).
- La URL del detalle (`/explorar/[eventoId]`) no cambia.
- Navegación:
  - "Comprar" de un tipo → `router.push({ pathname: "/explorar/[eventoId]/comprar/[tipoEntradaId]", params })`;
  - compra registrada → `router.replace({ pathname: "/compras/[compraId]", params })`;
  - "Pagar" de una compra pendiente del detalle → `router.push` a `/compras/[compraId]`;
  - "Volver al evento" → `router.back()`; "Ir a Explorar" y "Volver a Explorar" → `router.dismissTo("/")`.
- `tests/tipos/rutas-tipadas.ts` suma `/explorar/[eventoId]/comprar/[tipoEntradaId]` y
  `/compras/[compraId]`.

## Funciones de `src/api/compras.ts` (exportadas por `src/api/index.ts`)

| Función | Pedido |
|---|---|
| `comprarEntradas(cliente, eventoId, { tipoEntradaId, cantidad }, { usuarioId })` | `POST /eventos/:eventoId/compras` (solo esos dos campos) |
| `obtenerMisComprasDelEvento(cliente, eventoId, { signal })` | `GET /eventos/:eventoId/mis-compras` |
| `obtenerCompra(cliente, compraId, { signal })` | `GET /compras/:compraId` |
| `pagarCompra(cliente, compraId, { usuarioId })` | `POST /compras/:compraId/pago` sin cuerpo |

Los ids van con `encodeURIComponent`, como en `eventos.ts`.

## Hooks y claves (feature `compras`)

| Hook | Clave / efecto |
|---|---|
| `useMisComprasDelEvento(usuarioId, eventoId)` | `claves.misComprasDelEvento(usuarioId, eventoId)` = `["mis-compras-del-evento", usuarioId, eventoId]` |
| `useCompra(usuarioId, compraId)` | `claves.compra(usuarioId, compraId)` = `["compra", usuarioId, compraId]` |
| `useComprarEntradas(usuarioId, eventoId)` | al terminar (éxito o error) invalida `["evento", *, eventoId]` (todos los usuarios), `misComprasDelEvento` y `["catalogo"]`; ante un 404, el evento se invalida sin volver a pedirlo |
| `usePagarCompra(usuarioId, compraId, eventoId)` | con éxito, escribe la respuesta en `claves.compra`; al terminar invalida la compra, `misComprasDelEvento`, `["evento", *, eventoId]` y `["catalogo"]` |

Las mutations van en nombre del usuario de la pantalla y no se reintentan solas.

## Detalle del evento (`DetalleEventoConCompras`)

Es el `DetalleEvento` de la 005 con dos complementos (research R12). Todo lo de la 005 se ve
igual (incluido "Este evento ya se realizó" y "No encontramos este evento.").

**Sección propia** (antes de "Tipos de entrada"):

| Condición | Se ve |
|---|---|
| el usuario es el organizador | "Sos el organizador de este evento" |
| tiene compras pendientes no vencidas | título "Tus compras pendientes" y, por compra: "VIP · 2 entradas · $ 240.000" (o "Gratis"), "Podés pagar hasta las 15:35", `EtiquetaEstadoCompra` "Pendiente" y el botón "Pagar" (`accessibilityLabel` "Pagar la compra de 2 entradas VIP") |
| sin pendientes, o la consulta falló o carga | nada |

Las compras pendientes se muestran con "Pagar" también si el evento ya empezó: se pueden pagar
hasta que vencen (research R9). Lo que desaparece con el evento empezado es "Comprar".

**Acción de cada tipo** (a la derecha de la fila de `ListaTiposEntrada`):

| Condición (en este orden) | Se ve |
|---|---|
| evento realizado · usuario organizador · tipo con cupo 0 | nada (el cupo ya dice "Agotado") |
| `restantes` del tipo = 0 | "Ya tenés el máximo de entradas para este evento" |
| si no (también mientras carga `mis-compras`) | botón "Comprar" (`accessibilityLabel` "Comprar VIP") |

## Comprar entradas (`ComprarEntradas`)

Lee `useEvento(usuarioId, eventoId)` y `useMisComprasDelEvento(usuarioId, eventoId)` con
`SegunConsulta` (los dos; el error de cualquiera muestra `MensajeError` con "Reintentar").

| Elemento | Texto / comportamiento |
|---|---|
| encabezado | nombre del evento, fecha y hora (`textoFechaHora`), nombre del tipo y su precio ("$ 120.000 c/u" o "Gratis") |
| selector de cantidad | "−" (`accessibilityLabel` "Una entrada menos") · la cantidad ("2 entradas", `accessibilityLiveRegion="polite"`) · "+" ("Una entrada más"). Arranca en 1, no baja de 1 ni sube de `máximo = min(cupo, restantes)`; los botones se deshabilitan en el límite |
| aviso del máximo | si `máximo < cupo`: "Podés comprar hasta N entradas de este evento" |
| total estimado | "Total: $ 240.000" o "Total: Gratis" (precio × cantidad, se actualiza con cada cambio) |
| botón | "Confirmar compra"; en curso: "Comprando…" y deshabilitado |
| tipo inexistente en el evento leído | "Este tipo de entrada ya no está disponible." + "Volver al evento" |
| evento realizado | "Este evento ya se realizó" + "Volver al evento" (sin selector) |
| tipo agotado o `máximo = 0` | "No quedan entradas de este tipo." o "Ya tenés el máximo de entradas para este evento" + "Volver al evento" |

Errores del alta (el mensaje va arriba del botón, con `accessibilityLiveRegion="polite"`; tipo y
cantidad se conservan):

| Error | Mensaje | Además |
|---|---|---|
| `409 CUPO_INSUFICIENTE` · `409 TOPE_POR_PERSONA` | el del servidor | el evento y `mis-compras` se vuelven a pedir; la cantidad se recorta al nuevo máximo |
| `409 EVENTO_REALIZADO` | el del servidor | el evento se vuelve a pedir → "Este evento ya se realizó" |
| `409 COMPRA_PROPIO_EVENTO` | el del servidor | — |
| `400` con detalle en `body.tipoEntradaId` | "Este tipo de entrada ya no está disponible." | "Volver al evento" |
| `404 EVENTO_NO_ENCONTRADO` | "No encontramos este evento." | "Volver a Explorar"; se invalida el catálogo |
| servidor no disponible | "No se pudo registrar la compra. Probá de nuevo." | el botón queda disponible para reintentar a mano |

## Tu compra (`Compra`)

Se dibuja siempre desde `useCompra` (el estado del servidor; research R17), con `SegunConsulta`.

| Estado de la compra | Se ve |
|---|---|
| `PENDIENTE` | `EtiquetaEstadoCompra` "Pendiente"; resumen: nombre del evento, fecha y hora, tipo, "2 entradas", "Total: $ 240.000" / "Total: Gratis"; "Podés pagar hasta las 15:35"; botón "Pagar" (total > 0) o "Confirmar" (total 0); en curso: "Pagando…" / "Confirmando…" y deshabilitado |
| `CONFIRMADA` | `EtiquetaEstadoCompra` "Confirmada"; "¡Listo! Tu compra está confirmada."; el mismo resumen; botones "Volver al evento" e "Ir a Explorar" |
| `CANCELADA` (vencida) | `EtiquetaEstadoCompra` "Cancelada"; "Esta compra venció: sus entradas volvieron a estar disponibles."; "Volver al evento" |

Errores del pago:

| Error | Se ve |
|---|---|
| `409 COMPRA_VENCIDA` | la compra se vuelve a pedir → estado `CANCELADA` (fila de arriba) |
| `409 TRANSICION_INVALIDA` o respuesta perdida | la compra se vuelve a pedir; si llega `CONFIRMADA`, la confirmación **sin** error (FR-021) |
| servidor no disponible | "No se pudo pagar. Probá de nuevo." arriba de "Pagar", que queda disponible |
| `403` al leer (otro usuario actual) | "No tenés permiso para ver esta compra." sin acciones |
| `404` al leer | "No encontramos esta compra." + "Ir a Explorar" |

## Componentes

| Componente | Dónde | Props / comportamiento |
|---|---|---|
| `EtiquetaEstadoCompra` **(nuevo, base)** | `src/componentes/` | `{ estado: EstadoCompra }`. Texto "Pendiente" / "Confirmada" / "Utilizada" / "Cancelada" / "Reembolsada" sobre `advertencia` / `exito` / `exito` / `peligro` / `peligro` con su `sobre…`; `accessibilityLabel` "Estado: Pendiente". Único componente de estado de compra (FR-017) |
| `SelectorCantidad` **(nuevo)** | `features/compras/componentes/` | `{ cantidad, maximo, alCambiar }`; botones "−" y "+" con `accessibilityLabel` y `accessibilityState.disabled` |
| `ResumenCompra` **(nuevo)** | `features/compras/componentes/` | evento, fecha, tipo, cantidad y total de una `CompraVista` |
| `FilaCompraPendiente` **(nuevo)** | `features/compras/componentes/` | una compra de "Tus compras pendientes", con "Pagar" |
| `DetalleEvento` **(ampliado)** | `features/eventos/pantallas/` | prop opcional `complementos?: { AccionDeTipo?: ComponentType<{ evento; tipo }>; SeccionPropia?: ComponentType<{ evento }> }`; sin ella, igual que en la 005 |
| `ListaTiposEntrada` **(ampliado)** | `features/eventos/componentes/` | prop opcional `accionDeTipo?: (tipo) => ReactNode`; sin ella, igual que antes |

Todo usa `tema` (colores, espacios, tipografía), funciona a 360 px y los controles sin texto
llevan `accessibilityLabel`.

## Reglas de dependencia

- `features/compras` importa de `features/eventos`, `features/sesion` y la base, siempre por su
  `index.ts`. `features/eventos` no importa `features/compras` (sin ciclos).
- `features/eventos/index.ts` suma lo que usa `compras`: `useEvento` y el tipo
  `ComplementosDelDetalle` (`textoFechaHora` y `textoPrecio` ya se exportan).
- `EtiquetaEstadoCompra` vive en la base: no importa features.
