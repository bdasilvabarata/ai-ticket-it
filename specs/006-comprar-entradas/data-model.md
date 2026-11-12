# Data Model: Comprar entradas (006)

Amplía el modelo de la 004 y la 005 (`specs/005-explorar-eventos/data-model.md`). Decisiones en
[research.md](./research.md).

## Tipos compartidos (`shared/src/compra.ts`, exportados por `index.ts`)

```ts
/** Límites de una compra: los usan la validación, el dominio y los textos de la app. */
export const LIMITES_COMPRA = {
  /** Entradas de tipos pagos por persona y por evento, sumando sus compras vigentes; también el máximo por pedido. */
  entradasPorEvento: 4,
  /** Entradas de cada tipo gratis por persona (aparte de las 4). */
  entradasPorTipoGratis: 1,
  /** Una compra PENDIENTE vence a los 15 minutos de su alta. */
  minutosParaPagar: 15,
} as const;

/** Cuerpo de `POST /eventos/:eventoId/compras`: nunca lleva precio ni total. */
export interface DatosCompra {
  tipoEntradaId: string;
  cantidad: number;
}

/** Quién hizo un cambio de estado: un usuario o el sistema (vencimiento). */
export type AutorCambioEstadoVista = { tipo: "usuario"; usuarioId: string } | { tipo: "sistema" };

export interface CambioEstadoCompraVista {
  estado: EstadoCompra;
  autor: AutorCambioEstadoVista;
  /** Instante ISO UTC (reloj del servidor). */
  fechaHora: string;
  /** "YYYY-MM-DDTHH:mm", hora de Buenos Aires. */
  fechaHoraLocal: string;
}

/** Una compra, con su estado al día (una pendiente vencida ya se ve CANCELADA). */
export interface CompraVista {
  id: string;
  compradorId: string;
  evento: { id: string; nombre: string; fechaHora: string; fechaHoraLocal: string; realizado: boolean };
  tipoEntrada: { id: string; nombre: string };
  cantidad: number;
  /** Pesos enteros fijados al comprar; 0 = gratis. */
  total: number;
  estado: EstadoCompra;
  /** Instante ISO UTC del alta. */
  creadaEn: string;
  /** Hasta cuándo se puede pagar (ISO UTC); `null` si no está PENDIENTE. */
  venceEn: string | null;
  /** `venceEn` en hora de Buenos Aires ("YYYY-MM-DDTHH:mm"); `null` si no está PENDIENTE. */
  venceEnLocal: string | null;
  /** En orden cronológico; el primero es siempre PENDIENTE. */
  historial: CambioEstadoCompraVista[];
}

/** Respuesta de `GET /eventos/:eventoId/mis-compras` (del usuario actual). */
export interface MisComprasDelEventoVista {
  /** Sus compras PENDIENTE no vencidas de ese evento, de la más vieja a la más nueva. */
  pendientes: CompraVista[];
  /** Cuántas entradas más puede comprar de cada tipo según su tope (todos los tipos; 0 si es el organizador). */
  restantesPorTipo: { tipoEntradaId: string; restantes: number }[];
}
```

`EstadoCompra` (de la 001) no cambia. `EventoVista` y `TipoEntradaVista` no cambian de forma:
el `cupo` que muestran pasa a estar **al día** (cuenta como disponibles las entradas de las
compras pendientes vencidas; R3).

## Dominio (`backend/src/domain/`)

### `CambioEstadoCompra` y `Compra` (`compra.ts`, ampliados)

```ts
export type AutorDelCambio = { tipo: "usuario"; usuarioId: string } | { tipo: "sistema" };

export interface CambioEstadoCompra {
  estado: EstadoCompra;
  autor: AutorDelCambio;
  fechaHora: Date;
}

export interface PropiedadesCompra {
  id: string;
  compradorId: string;
  eventoId: string;
  tipoEntradaId: string;
  cantidad: number;   // entero ≥ 1
  total: number;      // entero ≥ 0, fijo
  historial: CambioEstadoCompra[];
}
```

| Miembro | Qué es / hace |
|---|---|
| `constructor(propiedades)` | Invariantes (`DatosInvalidosError`): `cantidad` entero ≥ 1; `total` entero ≥ 0; `historial` no vacío, el primero `PENDIENTE`, estados válidos, fechas válidas y no decrecientes. **Sin** `estado` en las propiedades (R5) |
| `estado` (getter) | El del último cambio |
| `creadaEn` (getter) | La fecha del primer cambio |
| `venceEn` (getter) | `creadaEn + 15 min` (`LIMITES_COMPRA.minutosParaPagar`) |
| `static registrar({ id, compradorId, eventoId, tipo, cantidad, ahora })` | Fábrica de alta: `total = tipo.precio × cantidad`, historial `[PENDIENTE por el comprador en ahora]` |
| `estaVencida(ahora)` | `estado === PENDIENTE && ahora ≥ venceEn` (a los 15 min exactos, sí) |
| `fueVencida()` | `estado === CANCELADA` y el último cambio es del sistema |
| `esVigente(ahora)` | `PENDIENTE` no vencida, o `CONFIRMADA` (cuenta para el tope) |
| `esGratis()` | `total === 0` |
| `vencer()` | `PENDIENTE → CANCELADA` con autor sistema y fecha `venceEn`; si no está `PENDIENTE`, `TRANSICION_INVALIDA` |
| `alDia(ahora)` | `estaVencida(ahora) ? vencer() : this` (para mostrar sin guardar) |
| `pagar(usuarioId, ahora)` | En orden: vencida (`estaVencida(ahora)` o `fueVencida()`) → `COMPRA_VENCIDA`; no `PENDIENTE` → `TRANSICION_INVALIDA`; si no, `CONFIRMADA` por `usuarioId` en `ahora`. El permiso (403) lo verifica el service antes. Que el evento haya empezado no importa (R9) |

Transiciones de esta feature (las demás de la constitución llegan con la 008 y la 009):

```text
            pagar (comprador)                 
PENDIENTE ──────────────────────► CONFIRMADA
    │
    │ vencer (sistema, a los 15 min del alta)
    ▼
CANCELADA
```

Funciones puras en el mismo módulo:

- `cupoLiberadoPorTipo(compras, ahora): Map<tipoEntradaId, number>` — suma la `cantidad` de las
  compras con `estaVencida(ahora)`, por tipo. La usan la lectura al día y la materialización.

### `TipoEntrada` y `Evento` (`evento.ts`, ampliados)

| Miembro | Qué hace |
|---|---|
| `TipoEntrada.esGratis()` | `precio === 0` |
| `TipoEntrada.descontar(cantidad)` | Tipo nuevo con `cupo − cantidad` (el constructor exige cupo ≥ 0) |
| `TipoEntrada.devolver(cantidad)` | Tipo nuevo con `cupo + cantidad` |
| `Evento.exigirQueSePuedeComprar(compradorId, ahora)` | `EVENTO_REALIZADO` ("El evento ya se realizó: no se pueden comprar entradas.") → `COMPRA_PROPIO_EVENTO` |
| `Evento.descontarCupo(tipoId, cantidad, ahora)` | Realizado → tipo (red de seguridad) → `tipo.hayCupoPara(cantidad)` o `CUPO_INSUFICIENTE` con las que quedan → `Evento` nuevo con el tipo descontado |
| `Evento.devolverCupos(porTipo: Map<string, number>)` | `Evento` nuevo con cada tipo devuelto (los ids ausentes se ignoran). Sin chequeo de "realizado": el vencimiento devuelve igual (R9) |

`#exigirNoRealizado` de la 004 conserva su mensaje ("no se puede modificar") para las ediciones;
la compra usa su propio mensaje con el mismo código `EVENTO_REALIZADO`. El pago no lo usa (R9).

### Tope por persona (`tope-por-persona.ts`, nuevo, puro)

| Función | Qué hace |
|---|---|
| `entradasRestantes(tipo, vigentes)` | Gratis: `1 −` Σ `cantidad` de las vigentes de **ese tipo** con `esGratis()`. Pago: `4 −` Σ `cantidad` de las vigentes del evento sin `esGratis()`. Mínimo 0. `vigentes` son las compras del comprador en ese evento que cumplen `esVigente(ahora)` |
| `exigirTopePorPersona(tipo, cantidad, vigentes)` | `cantidad > entradasRestantes(…)` → `409 TOPE_POR_PERSONA` |

### Errores de dominio nuevos (todos `ReglaDeNegocioError` → 409)

| Código | Mensaje |
|---|---|
| `EVENTO_REALIZADO` (alta) | "El evento ya se realizó: no se pueden comprar entradas." |
| `COMPRA_PROPIO_EVENTO` | "No podés comprar entradas de un evento que organizás." |
| `TOPE_POR_PERSONA` | pago, quedan N > 1: "Podés comprar N entradas más de tipos pagos de este evento." · pago, 1: "Podés comprar 1 entrada más de tipos pagos de este evento." · pago, 0: "Ya tenés el máximo de 4 entradas de tipos pagos de este evento." · gratis: "Ya tenés tu entrada gratis de «Carrera kids»." / pidió más de 1: "Podés tener 1 sola entrada de «Carrera kids»." |
| `CUPO_INSUFICIENTE` | N > 1: "Quedan N entradas de «VIP»." · 1: "Queda 1 entrada de «VIP»." · 0: "No quedan entradas de «VIP»." |
| `COMPRA_VENCIDA` | "La compra venció: pasaron 15 minutos sin pagarla." |
| `TRANSICION_INVALIDA` | "La compra no está pendiente de pago." (otras transiciones, en la 008 y la 009, con su propio mensaje) |

## Repositorios

`RepositorioCompras` (en `domain/repositorios.ts`) suma:

| Método | Devuelve |
|---|---|
| `siguienteId()` | un UUID v4 nuevo |
| `buscarPorId(id)` | la compra o `null` |
| `listarPorEventoYComprador(eventoId, compradorId)` | las compras de esa persona en ese evento (cualquier estado) |
| `listarPendientesPorEventos(eventoIds)` | las compras `PENDIENTE` (guardadas así) de esos eventos, vencidas o no |

`existePorEvento`, `existePorTipoEntrada` y `guardar` no cambian: **toda** compra, en cualquier
estado (también la vencida), sigue impidiendo quitar el tipo y eliminar el evento (edge case
"Compra vencida y reglas de la 004").

`CompraRepository` los implementa sobre su `Map` privado.

## Services

| Service | Dependencias | Métodos nuevos o cambiados |
|---|---|---|
| `VencimientoService` (nuevo) | `compras` | `cupoLiberadoPorTipo(eventoIds, ahora)` (lectura) · `vencerPendientes(eventoId, ahora)` (bajo el cerrojo del que llama: guarda las vencidas `CANCELADA` y devuelve el cupo liberado por tipo) |
| `EventoService` | + `vencimientoService` | `obtenerAlDia(id, ahora)` (dentro del cerrojo: 404 → vence → guarda el evento con el cupo devuelto si cambió) · `obtenerDelOrganizador(id, usuarioId, ahora)` (404 → 403 → `obtenerAlDia`) · `obtener` y `listar` con el cupo al día (sin guardar) · `actualizar` y `eliminar` leen `ahora` antes de `obtenerDelOrganizador` |
| `TipoEntradaService` | sin cambios | `buscarReferenciada(evento, tipoId)` (400 `body.tipoEntradaId`) · `descontarCupo(evento, tipoId, cantidad, ahora)` (dentro del cerrojo del que llama; guarda) · sus escrituras pasan `ahora` a `obtenerDelOrganizador` |
| `CompraService` (nuevo) | `compras`, `eventoService`, `tipoEntradaService`, `cerrojo`, `reloj` | `obtenerOFallar(id)` (404 `COMPRA_NO_ENCONTRADA`) · `crear(eventoId, usuarioId, datos)` · `obtener(compraId, usuarioId)` · `pagar(compraId, usuarioId)` · `misComprasDelEvento(eventoId, usuarioId)` |

### `CompraService.crear(eventoId, compradorId, { tipoEntradaId, cantidad })`

Bajo `cerrojo.ejecutar(eventoId, …)`:

1. `ahora = reloj.ahora()`.
2. `evento = eventoService.obtenerAlDia(eventoId, ahora)` — 404; materializa los vencimientos.
3. `tipo = tipoEntradaService.buscarReferenciada(evento, tipoEntradaId)` — 400.
4. `evento.exigirQueSePuedeComprar(compradorId, ahora)` — 409 realizado, 409 propio.
5. `vigentes = (compras.listarPorEventoYComprador(eventoId, compradorId)).filter(esVigente(ahora))`;
   `exigirTopePorPersona(tipo, cantidad, vigentes)` — 409 tope.
6. `tipoEntradaService.descontarCupo(evento, tipoEntradaId, cantidad, ahora)` — 409 cupo; guarda
   el evento.
7. `compra = Compra.registrar({ id: compras.siguienteId(), compradorId, eventoId, tipo, cantidad,
   ahora })`; `compras.guardar(compra)`.
8. Devuelve `aCompraVista(compra, evento, ahora)`.

### `CompraService.pagar(compraId, usuarioId)`

1. `{ eventoId } = obtenerOFallar(compraId)` (404), fuera del cerrojo, solo para saber qué
   cerrojo tomar (el `eventoId` de una compra no cambia).
2. Bajo `cerrojo.ejecutar(eventoId, …)`: `ahora`; `evento = eventoService.obtenerAlDia(eventoId,
   ahora)`; **relee** la compra (`obtenerOFallar`); 403 si `compradorId !== usuarioId`;
   `pagada = compra.pagar(usuarioId, ahora)` (también con el evento empezado; R9);
   `compras.guardar(pagada)`; devuelve su vista.

### `CompraService.obtener(compraId, usuarioId)` y `misComprasDelEvento(eventoId, usuarioId)`

Lecturas, sin cerrojo, con un `ahora` por pedido y las compras **al día** (`alDia(ahora)`):

- `obtener`: 404 → 403 (solo el comprador) → `aCompraVista(compra.alDia(ahora), evento, ahora)`.
- `misComprasDelEvento`: `eventoService.obtenerOFallar` (404); las compras de la persona en ese
  evento; `pendientes` = las que siguen `PENDIENTE` al día, por `creadaEn` ascendente;
  `restantesPorTipo` = `entradasRestantes(tipo, vigentes)` de cada tipo, o 0 en todos si es el
  organizador.

### Vistas (`services/compra.vistas.ts`, nuevo)

`aCompraVista(compra, evento, ahora)`: campos de `CompraVista`; el nombre del tipo sale del
evento (un tipo con compras no se puede quitar); `venceEn`/`venceEnLocal` solo si está
`PENDIENTE` (`horaDeBuenosAires`); cada cambio con `fechaHora` ISO y `fechaHoraLocal`.

## Validaciones (`validations/compra.validation.ts`, nuevo)

| Esquema | Partes | Reglas (mensaje) |
|---|---|---|
| `compraNueva` | `params: { eventoId }`, `body` | `tipoEntradaId`: `idSchema`; `cantidad`: entero de 1 a `LIMITES_COMPRA.entradasPorEvento` ("Debe ser un entero entre 1 y 4.", faltante → "Es obligatorio."). Claves desconocidas (por ejemplo `precio` o `total`) se descartan |
| `comprasDelEvento` | `params: { eventoId }` | `idSchema` |
| `compraPorId` | `params: { compraId }` | `idSchema` |

## Datos de ejemplo (`seed/datos-ejemplo.ts`)

| Compra | Comprador | Tipo | Cant. | Total | Historial |
|---|---|---|---|---|---|
| `compra-martin-festival-vip` | Martín | Festival · VIP | 2 | 240.000 | `PENDIENTE` (Martín, `ahora − 2 días`) → `CONFIRMADA` (Martín, `+5 min`) |
| `compra-diego-festival-general` | Diego | Festival · General | 1 | 45.000 | `PENDIENTE` (Diego, `ahora − 1 día`) → `CANCELADA` (sistema, `+15 min`) |

Eventos y cupos sin cambios (los de la 005): VIP 50, Backstage 3 (cupo justo y agotado), Hamlet
agotado, Maratón con "Carrera kids" gratis.

## Estado de la app (mobile)

| Pieza | Dónde | Qué guarda |
|---|---|---|
| `useMisComprasDelEvento(usuarioId, eventoId)` | `features/compras` | `claves.misComprasDelEvento(usuarioId, eventoId)` |
| `useCompra(usuarioId, compraId)` | `features/compras` | `claves.compra(usuarioId, compraId)` |
| `useComprarEntradas(usuarioId, eventoId)` | `features/compras/mutaciones.ts` | sin estado propio; invalida evento (todos los usuarios), mis-compras y catálogo |
| `usePagarCompra(usuarioId, compraId, eventoId)` | `features/compras/mutaciones.ts` | escribe la respuesta en `claves.compra`; invalida compra, mis-compras, evento y catálogo |
| Cantidad elegida | estado local de `ComprarEntradas` | `number`, de 1 a `min(cupo, restantes)`; se recorta si el máximo baja |

Textos derivados (`features/compras/formato.ts`, puros): `textoTotal(total)` ("Gratis" o el precio
de `textoPrecio`), `textoVencimiento(venceEnLocal)` ("Podés pagar hasta las 14:35"),
`textoCantidad(cantidad)` ("1 entrada" / "2 entradas"), `textoEtiquetaEstado(estado)` (en la base,
junto a `EtiquetaEstadoCompra`).
