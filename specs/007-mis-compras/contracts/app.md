# Contrato de la app: Mis compras (007)

La pantalla, la ruta, los textos, los estados y los componentes de la feature. Sigue la skill
`nueva-pantalla` y `specs/006-comprar-entradas/contracts/app.md`. Los tests buscan los textos de
abajo.

## Ruta

| Ruta (`app/`) | Pantalla | Título |
|---|---|---|
| `(tabs)/mis-compras.tsx` (hoy `SeccionPendiente`) | `MisCompras` (feature `compras`) | "Mis compras" (ya está en `LayoutPestanas`) |

- El archivo pasa a ser un re-export de una línea:
  `export { MisCompras as default } from "../../src/features/compras";`.
- No hay rutas nuevas: "Tu compra" (`/compras/[compraId]`) ya existe.
- `LayoutRaiz` y `LayoutPestanas` no cambian.

Navegación:
- tocar una fila o "Pagar"/"Confirmar" → `router.push({ pathname: "/compras/[compraId]",
  params: { compraId } })`;
- "Ir a Explorar" (el vacío) → `router.navigate("/")`.

## Función de `src/api/compras.ts` (exportada por `src/api/index.ts`)

| Función | Pedido |
|---|---|
| `obtenerMisCompras(cliente, { signal })` | `GET /compras` → `MiCompraVista[]` |

## Hooks y claves (feature `compras`)

| Hook o clave | Efecto |
|---|---|
| `claves.misCompras(usuarioId)` | `["mis-compras", usuarioId]` |
| `useMisCompras(usuarioId)` | la query de la lista |
| `useRefrescarAlVencer(compras, refetch)` | con pendientes, un `setTimeout` de `esperaHastaElProximoVencimiento(compras, Date.now())` que llama a `refetch`; se reprograma con cada respuesta y se cancela al desmontar; sin pendientes, nada |
| `useComprarEntradas` · `usePagarCompra` · `useCancelarCompra` (**ampliados**) | además de lo de la 006, al terminar (con éxito o error) invalidan `claves.misCompras(usuarioId)` |

En la pantalla, `useFocusEffect` (de `expo-router`) llama a `refetch()` en cada foco de la
pestaña salvo el primero (el montaje ya pide la lista).

## Pantalla `MisCompras`

`SegunConsulta` con los cuatro estados:

| Estado | Qué se ve |
|---|---|
| cargando | `Cargando` (el de siempre) |
| error | `MensajeError` con reintento (y la franja, si el servidor no está disponible) |
| vacío (`[]`) | `ListaVacia` "Todavía no compraste entradas" con la acción "Ir a Explorar" |
| datos | `PantallaDesplazable` con una `FilaMiCompra` por compra, en el orden del servidor |

Sin filtro por estado ni agrupación (FR-007).

### `FilaMiCompra`

Un contenedor (`View`, sin rol de accesibilidad) con dos **hermanos**, nunca uno dentro del otro:

- **Los datos**: un `Pressable` con `accessibilityRole="button"` y `accessibilityLabel` "Ver la
  compra de {cantidad} {tipo} para {evento}". Contiene, en orden:
  1. el nombre del evento (`tipografia.subtitulo`, se parte en varias líneas antes de
     recortarse);
  2. `textoFechaHora(evento.fechaHoraLocal)`, por ejemplo "mar 1 dic 2026 · 20:00";
  3. "{tipo} · {textoCantidad} · {textoTotal}", por ejemplo "VIP · 2 entradas · $ 240.000" o
     "Carrera kids · 1 entrada · Gratis";
  4. `EtiquetaEstadoCompra` y, al lado, el aviso de `textoAvisoDeMiCompra(compra)` si lo hay.
- **La acción de pago**: solo en una `PENDIENTE`, **debajo y fuera** del `Pressable` de los
  datos, el `Boton` `textoAccionDePago(total)` ("Pagar" o "Confirmar"), con `accessibilityLabel`
  "Pagar la compra de {cantidad} {tipo}".

Así TalkBack enfoca y anuncia los dos por separado. Un botón anidado dentro de un `Pressable`
accesible no se puede enfocar en Android (research, R10).

### Avisos por estado (`textoAvisoDeMiCompra`)

| Estado | Condición | Aviso | Acción |
|---|---|---|---|
| `PENDIENTE` | — | "Podés pagar hasta las HH:MM" (`textoVencimiento(venceEnLocal)`) | "Pagar" o "Confirmar" (total 0) |
| `CONFIRMADA` | `evento.realizado` | "Evento realizado" | — |
| `CONFIRMADA` | `diasRestantes === 0` | "Hoy · HH:MM" (la hora de `evento.fechaHoraLocal`) | — |
| `CONFIRMADA` | `diasRestantes === 1` | "Mañana" | — |
| `CONFIRMADA` | `diasRestantes ≥ 2` | "Faltan N días" | — |
| `CANCELADA` | `canceladaPor === "sistema"` | "Venció sin pagarse" | — |
| `CANCELADA` | `canceladaPor === "usuario"` | "La cancelaste" | — |
| `UTILIZADA` · `REEMBOLSADA` | — | ninguno | — |

El texto del estado ("Pendiente", "Confirmada", "Cancelada", "Utilizada", "Reembolsada") y su
color los pone siempre `EtiquetaEstadoCompra`, que no cambia. El aviso va **junto** a la etiqueta
y nunca la reemplaza (FR-012).

## `formato.ts` (feature `compras`, ampliado)

| Función | Resultado |
|---|---|
| `textoDiasRestantes(dias, fechaHoraLocal)` | 0 → "Hoy · 21:00"; 1 → "Mañana"; 10 → "Faltan 10 días" |
| `textoAvisoDeMiCompra(compra: MiCompraVista)` | la tabla de arriba; `string \| null`. El aviso corto de la fila. `textoCancelada` (006), el aviso largo de "Tu compra", queda como está |
| `textoAccionDePago(total)` | 0 → "Confirmar"; si no, "Pagar". La usa también "Tu compra", que hoy tiene el texto suelto |

## `vencimientos.ts` (feature `compras`, nuevo)

| Función | Resultado |
|---|---|
| `esperaHastaElProximoVencimiento(compras, ahoraMs)` | sin `PENDIENTE` → `null`; si hay, `max(min(Date.parse(venceEn)) − ahoraMs + 1000, 5000)` |

## Tests (`mobile/tests/`)

- `helpers/render-con-dependencias.tsx`: si el test no registra `GET /compras`, responde `[]`.
- `helpers/compras.ts`: un fixture `miCompra(...)` armado con la `CompraVista` que ya existe.

## Reglas de dependencia

- Todo lo nuevo vive en `features/compras`. Afuera solo cambian `src/api/compras.ts` (+
  `index.ts`), `src/consultas/claves.ts` y la ruta de `app/`.
- `features/compras/index.ts` suma `MisCompras`.
