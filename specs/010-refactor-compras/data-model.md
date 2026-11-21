# Data Model: Refactor de Mis compras, Compras del evento y Cancelación

Formas **internas** del backend y de la app. Los contratos de `shared/` y de la API no cambian
(ver `contracts/interno.md`). Comportamiento de referencia: `specs/007-mis-compras/`,
`specs/008-compras-de-evento/` y `specs/009-cancelar-compra/`.

## Entrada (`backend/src/domain/entrada.ts`, nuevo)

```ts
export interface RegistroDeEntrada {
  usuarioId: string; // el organizador (uso) o el comprador (cancelación)
  fechaHora: Date;
}

export interface PropiedadesEntrada {
  codigo: string;
  uso?: RegistroDeEntrada | null;         // por defecto, null
  cancelacion?: RegistroDeEntrada | null; // por defecto, null
}

export class Entrada {
  readonly codigo: string;
  readonly uso: RegistroDeEntrada | null;          // congelado
  readonly cancelacion: RegistroDeEntrada | null;  // congelado
  get usada(): boolean;                 // uso !== null — ÚNICA definición de "entrada usada"
  get cancelada(): boolean;             // cancelacion !== null
  get usadaEn(): Date | null;           // uso?.fechaHora ?? null
  get estadoPropio(): EstadoCompra;     // UTILIZADA | CANCELADA | CONFIRMADA (desde la confirmación)
  usar(organizadorId: string, ahora: Date): Entrada;
  cancelar(compradorId: string, ahora: Date): Entrada;
}

/** El mensaje del TRANSICION_INVALIDA al usar una entrada en ese estado (008, R5). Se mueve tal cual. */
export function motivoNoUsable(estado: EstadoCompra | null): string;
```

- La entrada **no** valida su coherencia con la compra (lo hacen las reglas de la compra) ni recibe
  su compra.
- `usar` y `cancelar` no deciden si se puede: lo decide la compra (como hoy).
- `compra.ts` re-exporta `Entrada` y `RegistroDeEntrada` para que los imports existentes
  (`import { Compra, Entrada } from "../domain/compra"`) sigan funcionando.

### Estado visible de una entrada (`Compra.estadoDe(entrada)`)

| La compra… | Estado de la entrada |
|---|---|
| nunca pasó por `CONFIRMADA` (pendiente, cancelada desde pendiente, vencida) | el de la compra |
| pasó por `CONFIRMADA` | `entrada.estadoPropio`: `UTILIZADA` si se usó, `CANCELADA` si se canceló (también en una `REEMBOLSADA`), si no `CONFIRMADA` |

`Compra.estadoDeEntrada(codigo)` se conserva (`null` si el código no es de la compra) y usa
`estadoDe`.

### Transiciones de la entrada

| Operación de la compra | Efecto en las entradas |
|---|---|
| `registrarUso(codigo, organizadorId, ahora)` | la del código: `uso = { organizadorId, ahora }`; con la primera usada, la compra suma `UTILIZADA` (mismo autor y fecha); con las siguientes, no |
| `cancelar(compradorId, ahora, inicio)` de una `CONFIRMADA` | todas: `cancelacion = { compradorId, ahora }` |
| `cancelar` de una `PENDIENTE`, `vencer`, `pagar`, `confirmarReembolso` | ninguno |

## Compra (`backend/src/domain/compra.ts`, ≤ 300 líneas)

Sin cambios en `PropiedadesCompra` salvo la forma de `entradas` (ahora con `uso`/`cancelacion`).
Cambios en la superficie:

| Antes | Después |
|---|---|
| `entrada.estadoEn(compra)` | `compra.estadoDe(entrada)` |
| `entradasUsadas` filtraba por `estadoEn === UTILIZADA` | `entradas.filter((e) => e.usada).length` |
| `tieneReembolsoPendiente(): boolean` | **se borra**; `get reembolso(): EstadoDeReembolso \| null` |
| invariantes en el constructor (5 `exigir`, uno combinado para `entradas`) | recorre `REGLAS_DE_COMPRA` |
| `sonEntradasValidas`, `entradasCoherentes`, `esReembolsoValido`, `esHistorialValido`, `pasoPorConfirmada` | se mueven a `reglas-de-compra.ts` (las dos primeras se reemplazan por reglas sueltas) |
| `motivoNoUsable` | se mueve a `entrada.ts` |

Se conservan sin cambios de comportamiento: `registrar`, `pagar`, `cancelar`, `vencer`,
`registrarUso`, `confirmarReembolso`, `alDia`, `motivoNoCancelable`, `estado`, `creadaEn`,
`venceEn`, `estaVencida`, `fueVencida`, `esVigente`, `esGratis`, `fueConfirmada`,
`canceladaDesde`, `cambioDeCancelacion`, `cupoLiberadoPorTipo`; mismos códigos, mensajes y orden
de los errores (FR-013).

Si `compra.ts` pasa de 300 líneas, `cupoLiberadoPorTipo` se mueve a `domain/vencimiento.ts` sin
cambiar su firma (plan, Complexity Tracking).

### Reembolso (valor derivado)

```ts
export type EstadoDeReembolso = "pendiente" | "confirmado";
```

| Estado de la compra | ¿Pasó por `CONFIRMADA`? | `total` | `reembolso` |
|---|---|---|---|
| `REEMBOLSADA` | sí (lo exige la regla 4) | > 0 | `"confirmado"` |
| `CANCELADA` | sí | > 0 | `"pendiente"` |
| `CANCELADA` | sí | 0 | `null` |
| `CANCELADA` | no (desde pendiente o vencida) | cualquiera | `null` |
| `PENDIENTE`, `CONFIRMADA`, `UTILIZADA` | — | cualquiera | `null` |

`confirmarReembolso`: `reembolso === "confirmado"` → 409 «El reembolso de esta compra ya se
confirmó.»; `reembolso === null` → 409 «Esta compra no tiene un reembolso pendiente.»; si no,
`REEMBOLSADA` por el organizador.

## Reglas de la compra (`backend/src/domain/reglas-de-compra.ts`, nuevo)

```ts
export interface ReglaDeCompra {
  nombre: string;   // para los tests y la lectura
  campo: keyof PropiedadesCompra;
  mensaje: string;
  cumple(propiedades: PropiedadesCompra): boolean;
}
export const REGLAS_DE_COMPRA: readonly ReglaDeCompra[];
export function pasoPorConfirmada(historial: readonly CambioEstadoCompra[]): boolean;
```

Sea `estado` el del último cambio del historial (o ninguno si está vacío), `confirmada` =
`pasoPorConfirmada(historial)` y `canceladaTrasConfirmar` = `estado ∈ {CANCELADA, REEMBOLSADA} ∧
confirmada`.

| # | `nombre` | `campo` | Se cumple si… | `mensaje` |
|---|---|---|---|---|
| 1 | `cantidad-valida` | `cantidad` | entero ≥ 1 (`esCantidadValida`) | Debe ser un entero mayor o igual a 1. |
| 2 | `total-valido` | `total` | entero ≥ 0 | Debe ser un entero mayor o igual a 0. |
| 3 | `historial-valido` | `historial` | no vacío, empieza en `PENDIENTE`, estados y fechas válidos, fechas no decrecientes | Debe empezar en PENDIENTE, con estados válidos y fechas válidas no decrecientes. |
| 4 | `reembolso-valido` | `historial` | cada `REEMBOLSADA` es el último cambio, sigue a un `CANCELADA`, en una compra que se confirmó y es paga | Un REEMBOLSADA es el último cambio, sigue a un CANCELADA y solo en una compra paga que se confirmó. |
| 5 | `una-entrada-por-unidad` | `entradas` | si la cantidad no es válida, se cumple (ya la informa la regla 1); si no, `entradas.length === cantidad` | Debe haber una entrada por unidad comprada. |
| 6 | `codigos-con-formato` | `entradas` | todo código cumple `esCodigoValido` | Cada código debe tener 8 caracteres válidos. |
| 7 | `codigos-distintos` | `entradas` | no hay códigos repetidos | Los códigos de las entradas no se pueden repetir. |
| 8 | `sin-cambios-antes-de-confirmar` | `entradas` | si no `confirmada`: ninguna entrada usada ni cancelada | Una compra que no se confirmó no tiene entradas usadas ni canceladas. |
| 9 | `usada-o-cancelada` | `entradas` | ninguna entrada está usada y cancelada a la vez | Una entrada no puede estar usada y cancelada a la vez. |
| 10 | `utilizada-si-alguna-usada` | `entradas` | `estado === UTILIZADA` ⇔ alguna entrada usada | La compra está UTILIZADA si y solo si alguna de sus entradas se usó. |
| 11 | `canceladas-con-la-compra` | `entradas` | si `canceladaTrasConfirmar`: todas canceladas; si no: ninguna cancelada | En una compra cancelada después de confirmada todas las entradas están canceladas, y en otro estado ninguna. |

Equivalencia con las invariantes actuales (ningún caso se pierde):

| Hoy | Ahora |
|---|---|
| `cantidad`, `total`, `historial`, reembolso | reglas 1–4, mismos mensajes |
| `!cantidadValida \|\| entradas.length === cantidad` | regla 5 (la condición vive en la regla) |
| códigos con formato y distintos | reglas 6 y 7 |
| no confirmada → ninguna entrada con cambios | regla 8 |
| `CONFIRMADA` → ninguna usada ni cancelada | reglas 10 (ninguna usada) y 11 (ninguna cancelada) |
| `UTILIZADA` → alguna usada y ninguna cancelada | reglas 10 y 11 |
| `CANCELADA`/`REEMBOLSADA` tras confirmar → cada una con un único cambio `CANCELADA` | regla 11 (todas canceladas) + reglas 9 y 10 (ninguna usada) |
| (implícito) un `UTILIZADA` en una compra cancelada sin confirmar | regla 8 |

Varias reglas pueden fallar a la vez (por ejemplo, una `PENDIENTE` con una entrada usada viola la 8
y la 10): `Invariantes` las informa todas, cada una con su detalle.

## Services

### `CompraService` (dueño de `Compra`)

| Método | Nuevo | Qué hace |
|---|---|---|
| `obtenerPorCodigoOFallar(eventoId, codigoCanonico): Promise<Compra>` | sí | formato inválido, código inexistente o de otro evento → `EntradaNoEncontradaError`; único que busca por código |
| `registrarUso(eventoId, codigo, usuarioId): Promise<EntradaDelEventoVista>` | sí | bajo el cerrojo del evento, en el orden de research R4; un `guardar` |
| `confirmarReembolso` | — | usa `compra.reembolso` (vía la compra) y `aCompraDelEventoVista(compra, comprador, evento)` |
| `comprasDelEvento` | — | `aCompraDelEventoVista(compra, comprador, evento)` |

Dependencias sin cambios: `{ compras, eventoService, tipoEntradaService, usuarioService, cerrojo,
reloj }`.

### `EntradaService`

```ts
export interface DependenciasEntradaService {
  compraService: CompraService;
  eventoService: EventoService;
  usuarioService: UsuarioService;
  reloj: Reloj;
}
```

- `obtener(eventoId, codigo, usuarioId)`: lectura, sin cerrojo: `leerDelOrganizador` (404 → 403) →
  `compraService.obtenerPorCodigoOFallar` (404) → `compra.alDia(ahora)` → vista. Sin cambios de
  comportamiento.
- `registrarUso(eventoId, codigo, usuarioId)`: `return this.#compraService.registrarUso(…)`.
- Ya no recibe `compras` ni `cerrojo` y nunca llama a `guardar`.

### Grafo de dependencias (sin ciclos)

| Service | Depende de |
|---|---|
| `EntradaService` | `CompraService` (**nuevo**), `EventoService`, `UsuarioService` |
| `CompraService` | `EventoService`, `TipoEntradaService`, `UsuarioService` |
| `TipoEntradaService` | `EventoService` |
| `EventoService` | `VencimientoService`, `CategoriaService`, `UsuarioService`, `ReseniaService` |
| `VencimientoService` | — (solo `RepositorioCompras`) |

Orden de construcción en `app.ts` (sin cambios): `VencimientoService → EventoService →
TipoEntradaService → CompraService → EntradaService`.

## Vistas (`backend/src/services/compra.vistas.ts`)

Piezas privadas (research R6): `aTipoDeLaCompra(compra, evento)`, `aCompradorVista(usuario)`,
`vencimiento(compra)`, `estadoDeLaCompra(compra)`, `canceladaPor(compra)`. Composición:

| Vista (tipo de `shared/`, sin cambios) | Se arma con |
|---|---|
| `CompraVista` (`aCompraVista`) | `datosComunes` + `compradorId`, `historial`, `entradas`, `cancelable`, `motivoNoCancelable` |
| `MiCompraVista` (`aMiCompraVista`) | `datosComunes` + `diasRestantes`, `canceladaPor` |
| `CompraDelEventoVista` (`aCompraDelEventoVista(compra, comprador, evento)`) | `id`, `aCompradorVista`, `aTipoDeLaCompra`, `cantidad`, `total`, `creadaEn(Local)`, `vencimiento`, `canceladaPor`, `estadoDeLaCompra` |
| `EntradaDelEventoVista` (`aEntradaDelEventoVista`) | `aEntradaVista` + `compra: { id, aCompradorVista, aTipoDeLaCompra, cantidad, estado y entradasUsadas de estadoDeLaCompra }` + `aVentanaDeUsoVista` |

`datosComunes` = `id`, `evento`, `aTipoDeLaCompra`, `cantidad`, `total`, `creadaEn`, `vencimiento`,
`estadoDeLaCompra`. `aEntradaVista(entrada, compra)` usa `compra.estadoDe(entrada)` y
`entrada.usadaEn`.

## Semilla (`backend/src/seed/datos-ejemplo.ts`)

Mismas compras, códigos, fechas y autores:

| Compra | Entradas |
|---|---|
| Martín, Peña General (`UTILIZADA`) | `PRGM3A01` con `uso: { usuarioId: lucia, fechaHora: ahora − 30 min }`; `PRGM3A02`, `PRGM3A03` sin nada |
| Diego, Maratón (`CANCELADA` tras confirmar) | `MZDF1C01` con `cancelacion: { usuarioId: diego, fechaHora: ahora − 1 día }` |
| Valentina, Maratón (`REEMBOLSADA`) | `MZVG2R01`, `MZVG2R02` con `cancelacion: { usuarioId: valentina, fechaHora: ahora − 2 días }` |
| las demás | sin uso ni cancelación |

## App (`mobile/src/features/compras/`)

### `useRegistrarUso(usuarioId, eventoId)` — invalidaciones al terminar

| Clave | Antes | Después |
|---|---|---|
| `comprasDelEvento(usuarioId, eventoId)` | ✔ | ✔ |
| `entradaDelEvento(usuarioId, eventoId, codigo)` | ✔ | ✔ |
| prefijo `["compra"]`, `["mis-compras"]`, `["mis-compras-del-evento"]` | ✔ | ✔ |
| `["evento", *, eventoId]` (predicate `delEvento`) | ✔ | ✘ |
| `["catalogo"]` | ✔ | ✘ |

`onSuccess` sigue guardando la entrada devuelta con `setQueryData`.

### "Registrar ingreso"

```text
RegistrarIngreso (pantalla: sesión → Ingreso)
└── Ingreso (estado: texto, código buscado, aviso; useEntradaDelEvento, useRegistrarUso, Alert)
    ├── BuscadorDeCodigo { texto, alCambiar, alBuscar, refCampo }      ← componentes/BuscadorDeCodigo.tsx
    ├── aviso && <Text …>                                              (éxito o error, polite)
    └── codigo !== null && ResultadoDeIngreso { consulta, enCurso, alRegistrar }  ← componentes/ResultadoDeIngreso.tsx
        ├── no encontrada → "No hay ninguna entrada con ese código en este evento."
        └── SegunConsulta → TarjetaEntrada + AccionDeIngreso (motivo o "Registrar ingreso")
```

### Opcional: `useEnvioUnico()` (`mobile/src/features/compras/useEnvioUnico.ts`)

```ts
export function useEnvioUnico(): (enviar: (alTerminar: () => void) => void) => void;
```
