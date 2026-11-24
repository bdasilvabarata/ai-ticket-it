# Data Model: Cancelar compra con reembolso

Cambios sobre el modelo de la 006 a la 008. No hay entidades nuevas ni campos guardados nuevos: todo
se deriva del historial de la compra y de los cambios propios de sus entradas.

## Dominio (`backend/src/domain/`)

### `Entrada` (cambia; R3)

| Miembro | Cambio |
|---|---|
| `cancelar(compradorId, ahora): Entrada` | **nuevo**: la entrada con su cambio `{ CANCELADA, autor: comprador, ahora }` (la compra decide si se puede) |
| `estadoEn(compra)` | si la compra **nunca llegó a `CONFIRMADA`**, el estado de la compra; si llegó, `ultimoEstadoPropio ?? CONFIRMADA`. En una `CANCELADA` o `REEMBOLSADA` después de confirmada, `CANCELADA` |

### `Compra` (cambia; R1, R4, R5, R6)

Transiciones (constitución, "Estados de una compra"):

```text
PENDIENTE ──pagar──▶ CONFIRMADA ──registrarUso (1ª)──▶ UTILIZADA
    │                    │
    │ cancelar / vencer  │ cancelar (antes del inicio)          (009)
    ▼                    ▼
CANCELADA            CANCELADA ──confirmarReembolso (si total > 0)──▶ REEMBOLSADA   (009)
(final)              (final si es gratis)                              (final)
```

| Miembro | Qué hace |
|---|---|
| `cancelar(usuarioId, ahora, inicioDelEvento)` | **cambia la firma** (suma `inicioDelEvento: Date`). Vencida → `COMPRA_VENCIDA`; `PENDIENTE` → `CANCELADA` (como en la 006); si no, según `motivoNoCancelable`: `"evento-empezado"` → `EVENTO_REALIZADO`; otro motivo → `TRANSICION_INVALIDA` (mensaje por motivo); `null` (confirmada antes del inicio) → `CANCELADA` por el comprador en `ahora` y cada entrada con `Entrada.cancelar` |
| `motivoNoCancelable(inicioDelEvento, ahora): MotivoNoCancelable \| null` | **nuevo**, puro; tabla de R6. Se llama sobre la compra al día |
| `confirmarReembolso(organizadorId, ahora)` | **nuevo**: `CANCELADA → REEMBOLSADA` por el organizador si `tieneReembolsoPendiente()`; si no, `TRANSICION_INVALIDA`. No toca entradas ni recibe la fecha del evento (sin plazo) |
| `tieneReembolsoPendiente(): boolean` | **nuevo**: `CANCELADA` ∧ pasó por `CONFIRMADA` ∧ `total > 0` |
| `get canceladaDesde(): "PENDIENTE" \| "CONFIRMADA" \| null` | **nuevo**: en `CANCELADA`/`REEMBOLSADA`, `CONFIRMADA` si el historial pasó por ella, si no `PENDIENTE`; en otro estado, `null` |
| `get cambioDeCancelacion(): CambioEstadoCompra \| null` | **nuevo**: el cambio a `CANCELADA` del historial (para `canceladaPor` también en una `REEMBOLSADA`) |
| `get fueConfirmada(): boolean` | **nuevo**: el historial tiene un `CONFIRMADA` (lo usan `estadoEn`, `canceladaDesde` y las invariantes) |
| `esVigente(ahora)` | sin cambios: `CANCELADA` y `REEMBOLSADA` ya no cuentan para el tope (FR-004) |

Mensajes de los rechazos (409, `ReglaDeNegocioError`):

| Caso | Código | Mensaje |
|---|---|---|
| `CONFIRMADA` desde el inicio | `EVENTO_REALIZADO` | El evento ya empezó: ya no se puede cancelar la compra. |
| `UTILIZADA` | `TRANSICION_INVALIDA` | Ya se usó una entrada de esta compra: no se puede cancelar. |
| `CANCELADA` | `TRANSICION_INVALIDA` | La compra ya está cancelada. |
| `REEMBOLSADA` | `TRANSICION_INVALIDA` | La compra ya fue reembolsada. |
| Reembolso de una `REEMBOLSADA` | `TRANSICION_INVALIDA` | El reembolso de esta compra ya se confirmó. |
| Reembolso de otra (pendiente, confirmada, utilizada, cancelada sin pagar o gratis) | `TRANSICION_INVALIDA` | Esta compra no tiene un reembolso pendiente. |
| Pendiente vencida (006, sin cambios) | `COMPRA_VENCIDA` | La compra venció: pasaron 15 minutos sin pagarla. |

Invariantes nuevas (constructor, `DatosInvalidosError`):

- **historial**: un `REEMBOLSADA` es el último cambio, sigue inmediatamente a un `CANCELADA`, la
  compra pasó por `CONFIRMADA` y su `total > 0`.
- **entradas** (`usoCoherente` → `entradasCoherentes`): si la compra no pasó por `CONFIRMADA`,
  ninguna entrada tiene cambios (como hoy). Si pasó: `CONFIRMADA` → ninguna usada ni cancelada;
  `UTILIZADA` → alguna usada, ninguna cancelada; `CANCELADA`/`REEMBOLSADA` → cada entrada tiene un
  único cambio propio, `CANCELADA`.

### Tipos del dominio

`MotivoNoCancelable` se importa de `shared` (como `EstadoCompra`).

## Repositorios

Sin cambios: la cancelación y el reembolso son un `guardar` de la compra (con sus entradas); el
cupo se devuelve con `RepositorioEventos.guardar` a través de `TipoEntradaService.devolverCupo`.

## Services

### `CompraService` (cambia)

| Método | Cambio |
|---|---|
| `cancelar(compraId, usuarioId)` | llama a `compra.cancelar(usuarioId, ahora, evento.fechaHora)`; el resto igual (cerrojo, materializa, relee, 403, guarda compra → evento con `devolverCupo`) |
| `confirmarReembolso(compraId, usuarioId): CompraDelEventoVista` | **nuevo**: `obtenerOFallar` (404) → cerrojo del evento → `ahora` → `eventoService.obtenerDelOrganizador(eventoId, usuarioId, ahora)` (403 + materializa) → relee → `confirmarReembolso(usuarioId, ahora)` → `guardar` → `usuarioService.obtenerOFallar(compradorId)` → `aCompraDelEventoVista` |
| `obtener`, `misComprasDelEvento`, `misCompras`, `comprasDelEvento` | sin cambios de forma; las vistas suman los campos de abajo, calculados con `ahora` y la fecha del evento, sin guardar |

### `services/compra.vistas.ts` (cambia)

- `datosComunes(compra, evento, ahora)` suma `canceladaDesde` y `reembolso`
  (`aReembolsoVista(compra)`: `pendiente` si `tieneReembolsoPendiente()`, `confirmado` si
  `REEMBOLSADA`, si no `null`; `monto: compra.total`).
- `aCompraVista` suma `cancelable` y `motivoNoCancelable` (`compra.motivoNoCancelable(evento.fechaHora, ahora)`).
- `aMiCompraVista` y `aCompraDelEventoVista`: `canceladaPor` desde `cambioDeCancelacion` (también
  en `REEMBOLSADA`); `aCompraDelEventoVista` suma `canceladaDesde` y `reembolso`.

`EventoService`, `TipoEntradaService`, `EntradaService` y `VencimientoService`: sin cambios.

## Vistas compartidas (`shared/src/compra.ts`)

```ts
/** Por qué una compra no se puede cancelar (lo decide el servidor al consultar; feature 009). */
export type MotivoNoCancelable = "evento-empezado" | "entrada-usada" | "cancelada" | "reembolsada";

/** El reembolso de una compra paga cancelada después de confirmada (feature 009). */
export interface ReembolsoVista {
  /** "pendiente" hasta que el organizador lo confirma; "confirmado" en una REEMBOLSADA. */
  estado: "pendiente" | "confirmado";
  /** Pesos enteros: el total fijado al comprar. */
  monto: number;
}
```

| Vista | Campo nuevo | Valor |
|---|---|---|
| `CompraVista`, `MiCompraVista`, `CompraDelEventoVista` | `canceladaDesde: "PENDIENTE" \| "CONFIRMADA" \| null` | solo en `CANCELADA`/`REEMBOLSADA` |
| `CompraVista`, `MiCompraVista`, `CompraDelEventoVista` | `reembolso: ReembolsoVista \| null` | `pendiente` / `confirmado` / `null` |
| `CompraVista` | `cancelable: boolean` | `motivoNoCancelable === null` |
| `CompraVista` | `motivoNoCancelable: MotivoNoCancelable \| null` | tabla de R6 |
| `MiCompraVista`, `CompraDelEventoVista` | `canceladaPor` (amplía) | también en `REEMBOLSADA`: el autor del cambio a `CANCELADA` |

`MiCompraVista` pasa a `Omit<CompraVista, "compradorId" | "historial" | "entradas" | "cancelable" | "motivoNoCancelable">`.
`CompraVista.entradas` sigue vacía fuera de `CONFIRMADA`/`UTILIZADA` (clarificación 5).
`MisComprasDelEventoVista` no cambia (sus `CompraVista` traen los campos nuevos).

## Seed (`backend/src/seed/datos-ejemplo.ts`; R11)

Dos compras nuevas en "Maratón Ciudad 10K" (Lucía), tipo Inscripción ($ 30.000):

| Id | Comprador | Cant. | Total | Historial | Entradas |
|---|---|---|---|---|---|
| `compra-diego-maraton-inscripcion` | Diego | 1 | 30.000 | PENDIENTE (hace 3 días) → CONFIRMADA (+5 min) → CANCELADA por Diego (hace 1 día) | `MZDF1C01` con su cambio `CANCELADA` |
| `compra-valentina-maraton-inscripcion` | Valentina | 2 | 60.000 | PENDIENTE (hace 4 días) → CONFIRMADA (+5 min) → CANCELADA por Valentina (hace 2 días) → REEMBOLSADA por Lucía (hace 1 día) | `MZVG2R01`, `MZVG2R02`, cada una con su cambio `CANCELADA` |

El cupo de Inscripción sigue en 1000. Las demás compras no cambian.

## Estado de la app (`mobile/`)

Sin estado propio nuevo: todo sale de las consultas existentes (`compra`, `misCompras`,
`comprasDelEvento`). Lo único local es la marca sincrónica `enviando` de cada acción (doble toque) y
el `Alert` de confirmación. Detalle en [contracts/app.md](./contracts/app.md).
