# Contrato de la app: Compras de un evento (008)

Rutas, pantallas, hooks, textos y componentes. Sigue la skill `nueva-pantalla` y los contratos de
la 006 y la 007. Los tests buscan los textos de abajo.

## Rutas

| Ruta (`app/`) | Pantalla (feature `compras`) | Título |
|---|---|---|
| `eventos/[eventoId]/compras.tsx` | `ComprasDelEvento` | "Compras del evento" |
| `eventos/[eventoId]/ingreso.tsx` | `RegistrarIngreso` | "Registrar ingreso" |

Cada archivo es un re-export de una línea
(`export { ComprasDelEvento as default } from "../../../src/features/compras";`). Ambas están
detrás del guard "con usuario" de `LayoutRaiz` (como `eventos/[eventoId]/index`).

Navegación:

- `EditarEvento` y `VerEventoRealizado` (feature `eventos`) suman el botón **"Ver compras"** →
  `router.push({ pathname: "/eventos/[eventoId]/compras", params: { eventoId } })`. `eventos` no
  importa nada de `compras` (sería un ciclo): navega por la ruta tipada.
- "Registrar ingreso" (en `ComprasDelEvento`) → `router.push({ pathname:
  "/eventos/[eventoId]/ingreso", params: { eventoId } })`.
- Ante un 404 del evento en cualquiera de las dos: aviso "No existe el evento." y
  `router.dismissTo("/mis-eventos")` (FR-024).

## Funciones de `src/api/compras.ts` (exportadas por `src/api/index.ts`)

| Función | Pedido |
|---|---|
| `obtenerComprasDelEvento(cliente, eventoId, { signal })` | `GET /eventos/:eventoId/compras` → `ComprasDelEventoVista` |
| `obtenerEntradaDelEvento(cliente, eventoId, codigo, { signal })` | `GET /eventos/:eventoId/entradas/:codigo` (código con `encodeURIComponent`) → `EntradaDelEventoVista` |
| `registrarUsoDeEntrada(cliente, eventoId, codigo, { usuarioId })` | `POST /eventos/:eventoId/entradas/:codigo/uso`, sin cuerpo → `EntradaDelEventoVista`; no se reintenta sola |

## Claves y hooks

| Clave o hook | Efecto |
|---|---|
| `claves.comprasDelEvento(usuarioId, eventoId)` | `["compras-del-evento", usuarioId, eventoId]` |
| `claves.entradaDelEvento(usuarioId, eventoId, codigo)` | `["entrada-del-evento", usuarioId, eventoId, codigo]` (código normalizado: mayúsculas, sin espacios ni guiones) |
| `useComprasDelEvento(usuarioId, eventoId)` | la query de la pantalla; en la pantalla, `useFocusEffect` llama a `refetch()` en cada foco salvo el primero |
| `useEntradaDelEvento(usuarioId, eventoId, codigo \| null)` | `enabled: codigo !== null` |
| `useRegistrarUso(usuarioId, eventoId)` | mutation; `onSuccess` → `setQueryData(entradaDelEvento)`; `onSettled` (éxito o error) invalida `comprasDelEvento(usuarioId, eventoId)`, la entrada, `["evento", *, eventoId]`, `["catalogo"]` y, por prefijo, `["compra"]`, `["mis-compras"]` y `["mis-compras-del-evento"]` (FR-021) |

## `ComprasDelEvento`

Con `SegunConsulta` (cargando, error con reintento, datos). El vacío **no** reemplaza la pantalla:
sin compras se ven igual la ventana y el resumen, y la lista dice el texto vacío.

De arriba hacia abajo:

1. Título del evento (`accessibilityRole="header"`) y su fecha (`textoFechaHora`).
2. **Ventana de uso** (según `ventanaDeUso.estado`): `abierta` → "Ingresos habilitados hasta el 19/11 09:00"; `antes` → "Podés
   registrar ingresos desde el 18/11 17:00"; `despues` → "Los ingresos se registraron hasta el 19/11
   09:00" (`textoVentanaDeUso`). Botón **"Registrar ingreso"** (primario) siempre visible: la
   pantalla de ingreso explica si está cerrada.
3. **"Disponibilidad por tipo"** (`ResumenPorTipo`): por tipo, su nombre y "117 disponibles · 0
   pendientes · 3 vendidas · 1 usada" (`textoResumenDeTipo`); con 0 disponibles, la marca
   **"Agotado"** en texto (FR-008).
4. **"Compras"** (`FilaCompraDelEvento` por compra): "Martín Benítez", "General · 3 entradas ·
   $ 18.000", "Comprada el 18/11 15:20" y `EtiquetaEstadoCompra`, más el aviso del estado
   (`textoAvisoDeCompraDelEvento`):

   | Estado | Aviso |
   |---|---|
   | `PENDIENTE` | "Puede pagarla hasta las 15:35" |
   | `CANCELADA` (`canceladaPor: "sistema"`) | "Venció sin pagarse" |
   | `CANCELADA` (`canceladaPor: "usuario"`) | "La canceló el comprador" |
   | `UTILIZADA` | "1 de 3 entradas usadas" (`textoEntradasUsadas`) |
   | `CONFIRMADA` · `REEMBOLSADA` | — |

   La fila no es tocable (no abre "Tu compra", Assumptions) y no tiene acción de uso (FR-017).
   Su `accessibilityLabel` resume comprador, tipo, cantidad, total y estado.
5. Sin compras: "Todavía nadie compró entradas" (FR-022).

## `RegistrarIngreso`

Con `PantallaDesplazable` (el teclado no tapa el campo).

1. Campo **"Código de la entrada"** (`autoCapitalize="characters"`, `autoCorrect={false}`) y botón
   **"Buscar"** (deshabilitado con el campo vacío). "Buscar" fija el código de la consulta (o hace
   `refetch` si es el mismo).
2. Resultado de la búsqueda:
   - cargando: `Cargando`;
   - `404 ENTRADA_NO_ENCONTRADA`: "No hay ninguna entrada con ese código en este evento.";
   - otro error: `MensajeError` con reintento;
   - encontrada: **`TarjetaEntrada`** con el código ("7K3M-Q9TB"), el comprador, el tipo,
     `EtiquetaEstadoCompra` con el estado de la entrada y, si la compra ya tiene usadas, "1 de 3
     entradas usadas".
3. Si la entrada se puede usar (`estado === CONFIRMADA` y `ventanaDeUso.estado === "abierta"`): botón
   **"Registrar ingreso"** → `Alert.alert("¿Registrar el ingreso?", "Martín Benítez · General. No se
   puede deshacer.", [Cancelar, Registrar])` (FR-018). Si no, el motivo en lugar del botón
   (`textoMotivoNoUsable`, FR-019):

   | Caso | Texto |
   |---|---|
   | ventana cerrada | "El ingreso se registra desde el 18/11 17:00 hasta el 19/11 09:00." |
   | `UTILIZADA` | "Esta entrada ya se utilizó el 18/11 20:15." |
   | `PENDIENTE` | "La compra de esta entrada todavía no se pagó." |
   | `CANCELADA` | "La compra de esta entrada está cancelada." |
   | `REEMBOLSADA` | "La compra de esta entrada fue reembolsada." |

4. Al registrar: con éxito, "Ingreso registrado: Martín Benítez · General" y el campo se vacía y
   toma el foco para el próximo código (SC-004); con un 409, su `mensaje` (el servidor manda) y la
   entrada se vuelve a pedir (FR-021: ante una respuesta perdida se ve el estado real).

## Pantallas del comprador (cambios)

| Dónde | Cambio |
|---|---|
| "Tu compra" (`Compra`) | en `CONFIRMADA` o `UTILIZADA`, **"Tus entradas"** con `ListaDeEntradas`; en `UTILIZADA`, "N de M entradas usadas"; donde hoy pregunta por `CONFIRMADA`, también `UTILIZADA` |
| "Ver mis entradas" (`FilaCompraConfirmada`) | `ListaDeEntradas` debajo de la fila; "N de M entradas usadas" en `UTILIZADA` |
| "Mis compras" (`FilaMiCompra`) | `textoAvisoDeMiCompra` en `UTILIZADA` → "N de M entradas usadas" |
| `AccesoMisEntradas` (detalle) | cuenta también las compras `UTILIZADA` (vienen en `confirmadas`) |

`ListaDeEntradas`: una fila por entrada con "Entrada 1", el código "7K3M-Q9TB" (`textoCodigo`) y
`EtiquetaEstadoCompra`. `accessibilityLabel` de la fila: "Entrada 1, código 7 K 3 M Q 9 T B,
Confirmada" (`textoCodigoAccesible`).

## Textos (`features/compras/formato.ts`, puros)

| Función | Ejemplo |
|---|---|
| `textoCodigo(codigo)` | `"7K3MQ9TB"` → `"7K3M-Q9TB"` |
| `textoCodigoAccesible(codigo)` | → `"7 K 3 M Q 9 T B"` |
| `normalizarCodigo(texto)` | `" 7k3m-q9tb "` → `"7K3MQ9TB"` (solo para la clave; el servidor normaliza igual) |
| `textoEntradasUsadas(usadas, cantidad)` | `(1, 3)` → `"1 de 3 entradas usadas"`; `(1, 1)` → `"1 de 1 entrada usada"` |
| `textoResumenDeTipo(resumen)` | `"117 disponibles · 0 pendientes · 3 vendidas · 1 usada"` |
| `textoVentanaDeUso(ventana)` | según `ventana.estado`: la fila 2 de `ComprasDelEvento` |
| `textoAvisoDeCompraDelEvento(compra)` | la tabla de `ComprasDelEvento` |
| `textoMotivoNoUsable(entrada)` | la tabla de `RegistrarIngreso`, o `null` si se puede usar |
| `textoCompradaEl(creadaEnLocal)` | `"Comprada el 18/11 15:20"` |

La app no lee su reloj para decidir nada de la ventana: `ventanaDeUso.estado` lo dice el servidor.

## Tests

- `tests/api/compras.test.ts`: las tres funciones (ruta, método, `encodeURIComponent`, usuario).
- `tests/features/compras/formato.test.ts`: los textos nuevos y el caso `UTILIZADA` de
  `textoAvisoDeMiCompra`.
- `tests/pantallas/compras-del-evento.test.tsx`: cargando, error con reintento, vacío con resumen,
  datos con cada estado y su aviso, "Agotado", 404 → Mis eventos, refetch al volver a enfocar,
  "Ver compras" desde la edición y desde la solo lectura.
- `tests/pantallas/registrar-ingreso.test.tsx`: buscar (normalizado), 404, tarjeta, motivo según
  estado y ventana, confirmación, éxito (campo vacío), 409 con su mensaje, invalidaciones.
- `tests/pantallas/{compra,mis-entradas,mis-compras}.test.tsx`: códigos solo en confirmadas y
  utilizadas, "N de M entradas usadas".
- `tests/helpers/`: fixtures de `ComprasDelEventoVista` y `EntradaDelEventoVista`; `CompraVista` de
  ejemplo con `entradas` y `entradasUsadas`.
