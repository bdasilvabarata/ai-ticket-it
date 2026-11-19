# Data Model: Compras de un evento

Qué cambia en el dominio, los repositorios, los services, las vistas compartidas y el estado de la
app. Las decisiones están en [research.md](./research.md) (R1–R16).

## Dominio (`backend/src/domain/`)

### `Entrada` (nueva, dentro del agregado `Compra`; R1)

| Campo | Tipo | Regla |
|---|---|---|
| `codigo` | `string` | 8 caracteres de `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (canónico, R2); único en el sistema |
| `cambios` | `readonly CambioEstadoCompra[]` | sus cambios propios, posteriores a la confirmación de la compra; hoy, a lo sumo `[{ UTILIZADA, organizador, ahora }]` |

Inmutable (las operaciones devuelven una nueva). Comportamiento:

- `estadoEn(compra)`: si `compra.estado` es `CONFIRMADA` o `UTILIZADA` → el estado del último
  cambio propio o `CONFIRMADA`; si no → `compra.estado`.
- `usar(organizadorId, ahora)`: suma el cambio `UTILIZADA`.
- `usadaEn`: la fecha del cambio `UTILIZADA` o `null`.

### `Compra` (cambia; R1, R9)

| Cambio | Detalle |
|---|---|
| `entradas: readonly Entrada[]` | nuevo campo de `PropiedadesCompra` |
| invariantes | `entradas.length === cantidad`; códigos con formato y distintos; entradas con cambios solo si el historial llegó a `CONFIRMADA`; `estado === UTILIZADA` ⇔ alguna entrada usada |
| `Compra.registrar` | `DatosDeAlta` suma `codigos: readonly string[]` (los da el repositorio); crea una `Entrada` sin cambios por código |
| `entradasUsadas` | getter: cuántas entradas están `UTILIZADA` |
| `estadoDeEntrada(codigo)` | el estado derivado de esa entrada, o `null` si no es de esta compra |
| `registrarUso(codigo, organizadorId, ahora)` | entrada no `CONFIRMADA` → `TRANSICION_INVALIDA` (mensaje según el estado, R5); la entrada pasa a `UTILIZADA`; si la compra estaba `CONFIRMADA`, suma el cambio `UTILIZADA` (mismo autor y fecha); si ya estaba `UTILIZADA`, su historial no cambia |
| `esVigente(ahora)` | suma `UTILIZADA` (cuenta para el tope) |
| `alDia`, `vencer`, `pagar`, `cancelar` | conservan las entradas (`#conCambio` las copia); su estado sigue derivándose del de la compra |

Transiciones de la compra después de la 008:

```text
PENDIENTE ──pagar──▶ CONFIRMADA ──1.ª entrada usada──▶ UTILIZADA
    │                    (009: CONFIRMADA → CANCELADA → REEMBOLSADA)
    └──vencer / cancelar──▶ CANCELADA
```

Estado de cada entrada:

```text
igual al de la compra mientras esté PENDIENTE o CANCELADA (también al día)
CONFIRMADA ──registrarUso (organizador, dentro de la ventana)──▶ UTILIZADA   (por entrada)
```

### Módulos puros nuevos

| Módulo | Exporta |
|---|---|
| `codigo-de-entrada.ts` | `ALFABETO_DE_CODIGO`, `LARGO_DE_CODIGO = 8`, `esCodigoValido(codigo)`, `normalizarCodigo(texto)` (mayúsculas, sin espacios ni guiones) |
| `ventana-de-uso.ts` | `HORAS_ANTES_DEL_INICIO = 4`, `HORAS_DESPUES_DEL_INICIO = 12`, `ventanaDeUso(fechaHora)` → `{ desde, hasta }`, `estadoDeVentana(ventana, ahora)` → `"antes"` · `"abierta"` (inclusive) · `"despues"`, `exigirVentanaAbierta(fechaHora, ahora)` → 409 `FUERA_DE_HORARIO_DE_USO` |
| `compras-del-evento.ts` | `ResumenDeTipo`, `resumenPorTipo(tipos, comprasAlDia)`, `compararComprasDelEvento(a, b)` (`creadaEn` desc → `id`) |

## Repositorios

`RepositorioCompras` (interfaz en `domain/repositorios.ts`, implementación en
`repositories/compra.repository.ts`) suma:

| Método | Devuelve |
|---|---|
| `listarPorEvento(eventoId)` | todas las compras del evento, en cualquier estado (posiblemente ninguna) |
| `buscarPorCodigoDeEntrada(codigo)` | la compra que tiene una entrada con ese código (canónico), o `null` |
| `siguientesCodigosDeEntrada(cantidad)` | `cantidad` códigos nuevos, distintos entre sí y de todos los guardados |

El `Map` sigue siendo por id de compra; la búsqueda por código recorre las compras (pocos datos en
el TP; un índice sería YAGNI).

## Services

| Service | Cambio |
|---|---|
| `EventoService` | + `leerDelOrganizador(id, usuarioId, ahora)`: 404 → 403 ("Solo el organizador del evento puede ver sus compras.") → el evento con el cupo al día **sin guardar** (R6) |
| `CompraService` | recibe `usuarioService`. `crear` pide los códigos con `siguientesCodigosDeEntrada(cantidad)`. + `comprasDelEvento(eventoId, usuarioId)` → `ComprasDelEventoVista` (R6, R7). `misComprasDelEvento.confirmadas` incluye `UTILIZADA` (R9) |
| `EntradaService` (nuevo) | dependencias `compras`, `eventoService`, `usuarioService`, `cerrojo`, `reloj`. `obtener(eventoId, codigo, usuarioId)` (lectura, R5) y `registrarUso(eventoId, codigo, usuarioId)` (cerrojo del evento, R10) → `EntradaDelEventoVista` |

`app.ts`: `VencimientoService → EventoService → TipoEntradaService → CompraService →
EntradaService`, más `EntradaController` y el router hijo `eventos/:eventoId/entradas`.

Errores: `EntradaNoEncontradaError` en `errors/` (`ENTRADA_NO_ENCONTRADA`, "No hay ninguna entrada
con ese código en este evento.") → 404 en la tabla de `traducir-error.ts`.

Vistas (`services/compra.vistas.ts`): `aEntradaVista`, `aVentanaDeUsoVista`,
`aCompraDelEventoVista`, `aEntradaDelEventoVista`; `aCompraVista` suma `entradas` y
`entradasUsadas`, y `aMiCompraVista`, `entradasUsadas`.

## Vistas compartidas (`shared/src/compra.ts`)

```ts
/** Una entrada de una compra (feature 008). */
interface EntradaVista {
  /** Canónico, 8 caracteres (la app lo muestra "XXXX-XXXX"). */
  codigo: string;
  estado: EstadoCompra;
  /** Cuándo se registró su uso (ISO UTC y "YYYY-MM-DDTHH:mm" de Buenos Aires); null si no se usó. */
  usadaEn: string | null;
  usadaEnLocal: string | null;
}

interface CompraVista {            // 006, suma:
  /** Solo en CONFIRMADA o UTILIZADA; si no, []. Solo la ve su comprador. */
  entradas: EntradaVista[];
  entradasUsadas: number;
}

type MiCompraVista =               // 007: omite también `entradas`; conserva `entradasUsadas`
  Omit<CompraVista, "compradorId" | "historial" | "entradas"> & { diasRestantes; canceladaPor };

interface VentanaDeUsoVista {
  desde: string; hasta: string;              // ISO UTC
  desdeLocal: string; hastaLocal: string;    // "YYYY-MM-DDTHH:mm", Buenos Aires
  /** Según el reloj del servidor al responder; "abierta" con ambos extremos inclusive. */
  estado: "antes" | "abierta" | "despues";
}

interface CompradorVista { id: string; nombre: string; apellido: string }

interface ResumenTipoEntradaVista {
  tipoEntrada: { id: string; nombre: string };
  disponibles: number; pendientes: number; vendidas: number; usadas: number;
}

/** Una fila de "Compras del evento": sin códigos. */
interface CompraDelEventoVista {
  id: string;
  comprador: CompradorVista;
  tipoEntrada: { id: string; nombre: string };
  cantidad: number;
  total: number;
  estado: EstadoCompra;
  creadaEn: string; creadaEnLocal: string;
  venceEn: string | null; venceEnLocal: string | null;     // solo PENDIENTE
  canceladaPor: "sistema" | "usuario" | null;              // solo CANCELADA
  entradasUsadas: number;
}

/** Respuesta de GET /eventos/:eventoId/compras. */
interface ComprasDelEventoVista {
  evento: { id: string; nombre: string; fechaHoraLocal: string; realizado: boolean };
  ventanaDeUso: VentanaDeUsoVista;
  /** Todos los tipos, en el orden del evento. */
  resumenPorTipo: ResumenTipoEntradaVista[];
  /** Todas, de la más nueva a la más vieja (desempate por id). */
  compras: CompraDelEventoVista[];
}

/** Respuesta de GET y POST /eventos/:eventoId/entradas/:codigo(/uso). */
interface EntradaDelEventoVista extends EntradaVista {
  compra: {
    id: string;
    comprador: CompradorVista;
    tipoEntrada: { id: string; nombre: string };
    cantidad: number;
    estado: EstadoCompra;
    entradasUsadas: number;
  };
  ventanaDeUso: VentanaDeUsoVista;
}
```

## Seed (`backend/src/seed/datos-ejemplo.ts`; R12)

| Dato | Detalle |
|---|---|
| evento nuevo | `evento-pena-en-la-rueda`, Lucía, Música, a la hora en punto más cercana a `ahora + 2 h`; tipos `tipo-pena-en-la-rueda-general` (6.000, cupo 120) y `…-con-cena` (15.000, cupo 40) |
| `compra-martin-pena-general` | 3 General, `CONFIRMADA` → `UTILIZADA` (1 entrada usada por Lucía); cupo ya descontado en el seed |
| `compra-sofia-pena-con-cena` | 2 Con cena, `CONFIRMADA` |
| compras del Festival | suman sus entradas: Martín, 2 VIP; Diego, 1 General (cancelada) |

Todos los códigos son fijos y válidos (R2), y el `cupo` de los tipos del seed ya descuenta las
compras vigentes, como hoy.

## Estado de la app (`mobile/`)

| Pieza | Clave / ruta | Detalle |
|---|---|---|
| `useComprasDelEvento(usuarioId, eventoId)` | `claves.comprasDelEvento` → `["compras-del-evento", u, e]` | `GET /eventos/:id/compras`; se vuelve a pedir al enfocar (salvo la primera vez) |
| `useEntradaDelEvento(usuarioId, eventoId, codigo \| null)` | `claves.entradaDelEvento` → `["entrada-del-evento", u, e, codigoNormalizado]` | habilitada solo con un código enviado |
| `useRegistrarUso(usuarioId, eventoId)` | mutation | sin reintentos; `onSuccess` escribe la entrada; `onSettled` invalida lo de R13 |
| `ComprasDelEvento` | `app/eventos/[eventoId]/compras.tsx` | pantalla (R13) |
| `RegistrarIngreso` | `app/eventos/[eventoId]/ingreso.tsx` | pantalla (R13) |
| `ListaDeEntradas` | componente | códigos y estados en "Tu compra" y "Ver mis entradas" (R14) |
| `ResumenPorTipo`, `FilaCompraDelEvento`, `TarjetaEntrada` | componentes | de las dos pantallas nuevas |
