# Contrato de la app: Cancelar compra con reembolso (009)

Todo vive en `mobile/src/features/compras/` (la feature `eventos` no cambia). Sin rutas nuevas.

## Funciones de `src/api/compras.ts` (exportadas por `src/api/index.ts`)

| Función | Pedido | Devuelve |
|---|---|---|
| `cancelarCompra(cliente, compraId, { usuarioId })` | (existe) `POST /compras/:id/cancelacion` | `CompraVista` |
| `confirmarReembolso(cliente, compraId, { usuarioId })` | **nueva**: `POST /compras/:id/reembolso`, sin cuerpo | `CompraDelEventoVista` |

## Mutations (`mutaciones.ts`; sin reintentos)

| Hook | Variable | Al terminar (éxito o error) invalida |
|---|---|---|
| `useCancelarCompra(usuarioId, compraId, eventoId)` (cambia) | — | lo de la 006 (la compra, `misComprasDelEvento`, `misCompras`, el evento de todos los usuarios, `["catalogo"]`) **+** por prefijo `["compras-del-evento"]` y `["entrada-del-evento"]` |
| `useConfirmarReembolso(usuarioId, eventoId)` (nuevo) | `compraId` | `comprasDelEvento(usuarioId, eventoId)`, por prefijo `["entrada-del-evento"]`, `["compra"]`, `["mis-compras"]` y `["mis-compras-del-evento"]` |

Con éxito, `useCancelarCompra` sigue escribiendo la respuesta en `claves.compra(usuarioId, compraId)`.
El reembolso no invalida el evento ni el catálogo: no cambia el cupo (research R10).

## "Tu compra" (`pantallas/Compra.tsx`)

| Estado (servidor) | Se muestra |
|---|---|
| `PENDIENTE` | sin cambios (006): vencimiento, "Pagar"/"Confirmar" y "Cancelar compra" |
| `CONFIRMADA`, `cancelable` | "¡Listo! Tu compra está confirmada.", resumen, "Tus entradas", **"Cancelar compra"** (variante `texto`), "Volver al evento", "Ir a Explorar" |
| `CONFIRMADA` no cancelable / `UTILIZADA` | lo mismo, con **el motivo** (`textoMotivoNoCancelable`) en lugar del botón |
| `CANCELADA` | etiqueta + `textoCancelada(compra)` (ampliado), resumen, sin entradas, "Volver al evento" |
| `REEMBOLSADA` | etiqueta + `textoReembolsada(compra)`, resumen, sin entradas, "Volver al evento" |

"Cancelar compra" (confirmada) abre un `Alert`:

- título: `¿Cancelar la compra de ${textoCantidad(cantidad)} ${tipoEntrada.nombre}?`;
- mensaje: `textoConfirmarCancelacion(compra)`;
- botones: "Volver" (`cancel`) y "Cancelar compra" (`destructive`, manda el pedido).

Mientras el pedido está en curso, el botón muestra "Cancelando…" (`enCurso`) y la marca sincrónica
`enviando` ignora otro toque. Ante un error, `AvisoDeFormulario` muestra el mensaje del servidor
(**también los 409**), "No se pudo cancelar. Probá de nuevo." sin servidor o "Ocurrió un error
inesperado."; la pantalla se redibuja desde `useCompra` (estado real).

## "Mis compras" (`componentes/FilaMiCompra.tsx`)

Sin botón nuevo. Solo cambia `textoAvisoDeMiCompra` (tabla de textos).

## "Compras del evento" (`componentes/FilaCompraDelEvento.tsx`, `pantallas/ComprasDelEvento.tsx`)

- El bloque accesible de la fila (comprador, tipo · cantidad · total, fecha, estado y aviso) no
  cambia de estructura y sigue sin ser tocable; su `accessibilityLabel` suma el aviso si hay.
- Con `reembolso?.estado === "pendiente"`, debajo y **como hermano** del bloque: el botón
  **"Confirmar reembolso"** (variante `aviso`), y el `AvisoDeFormulario` con el error de esa fila.
- El `Alert`: título `¿Confirmar el reembolso a ${nombre} ${apellido}?`, mensaje
  `textoConfirmarReembolso(compra)`, botones "Volver" y "Confirmar reembolso".
- `ComprasDelEvento` crea **una** `useConfirmarReembolso(usuarioId, eventoId)` y se la pasa a las
  filas (`alConfirmarReembolso(compraId)`, `enCurso` = `isPending && variables === compra.id`). Una
  marca sincrónica en la pantalla evita dos pedidos a la vez. Al terminar, la relectura redibuja la
  fila (el botón desaparece, el aviso pasa a "Reembolso confirmado").
- Errores: el mensaje del servidor (409 incluidos), "No se pudo confirmar el reembolso. Probá de
  nuevo." sin servidor; un 404 del evento sigue saliendo a "Mis eventos" (008).

## Textos (`features/compras/formato.ts`, puros)

| Función | Caso | Texto |
|---|---|---|
| `textoMotivoNoCancelable(motivo)` | `"evento-empezado"` | El evento ya empezó |
| | `"entrada-usada"` | Ya usaste una entrada |
| | `"cancelada"` / `"reembolsada"` | `null` (el aviso del estado ya lo dice) |
| `textoConfirmarCancelacion(compra)` | paga | Se cancelan tus 2 entradas. El organizador tiene que confirmar el reembolso de $ 240.000. No se puede deshacer. |
| | gratis | Se cancela tu entrada y vuelve a estar disponible. No se puede deshacer. (`Se cancelan tus N entradas y vuelven…` si N > 1) |
| `textoCancelada(compra)` (amplía) | `reembolso.pendiente` | Cancelaste esta compra. El organizador tiene que confirmar el reembolso de $ 240.000 |
| | `canceladaDesde === "CONFIRMADA"`, gratis | Cancelaste esta compra |
| | pendiente cancelada / vencida | (los de la 006, sin cambios) |
| `textoReembolsada(compra)` | `REEMBOLSADA` | Te devolvimos $ 240.000 |
| `textoAvisoDeMiCompra(compra)` (amplía) | `CANCELADA` + `reembolso.pendiente` | El organizador tiene que confirmar el reembolso de $ 240.000 |
| | `CANCELADA` desde `CONFIRMADA`, gratis | Cancelaste esta compra |
| | `REEMBOLSADA` | Te devolvimos $ 240.000 |
| | los demás | (los de la 007/008, sin cambios) |
| `textoAvisoDeCompraDelEvento(compra)` (amplía) | `CANCELADA` + `reembolso.pendiente` | La canceló el comprador · Reembolso pendiente de $ 240.000 |
| | `REEMBOLSADA` | Reembolso confirmado |
| | los demás | (los de la 008, sin cambios) |
| `textoConfirmarReembolso(compra)` | | Confirmás que le devolviste $ 240.000. No se puede deshacer. |

Los montos con `textoTotal` (formato de la 006). Los avisos van siempre al lado de
`EtiquetaEstadoCompra` (texto y color), nunca la reemplazan.

## Accesibilidad y 360 px

- "Cancelar compra" y "Confirmar reembolso" son `Boton` con su texto (rol `button`, `busy` en curso).
- El motivo y los avisos son `Text` (se leen como texto); el aviso de "Tu compra" con
  `accessibilityLiveRegion="polite"`, como el de la 006.
- "Confirmar reembolso" se enfoca aparte del bloque de la fila (hermano, no hijo).
- Los textos largos envuelven (`flexShrink: 1`); ningún ancho fijo.

## Tests

- `tests/features/compras/formato.test.ts`: cada fila de la tabla de textos.
- `tests/api/compras.test.ts`: `confirmarReembolso` (método, ruta, `X-Usuario-Id`, sin cuerpo).
- `tests/pantallas/compra.test.tsx`: confirmada cancelable (botón → `Alert` con monto → pedido → se
  ve "Cancelada" con el aviso del reembolso pendiente), gratis (sin monto), motivo en lugar del botón
  ("El evento ya empezó", "Ya usaste una entrada"), "Volver" no manda nada, doble toque = un pedido,
  409 con el mensaje y el estado releído, servidor caído, reembolsada ("Te devolvimos $ X"), y las
  claves del organizador invalidadas.
- `tests/pantallas/mis-compras.test.tsx`: avisos de cancelada con reembolso, gratis y reembolsada;
  ninguna fila tiene "Cancelar".
- `tests/pantallas/compras-del-evento.test.tsx`: "Confirmar reembolso" solo en las filas con
  reembolso pendiente, `Alert` con comprador y monto, un solo pedido, la fila releída con
  "Reembolso confirmado", 403/409 con su mensaje, invalidación de las vistas del comprador por
  prefijo, el botón enfocable aparte de la fila.
