# Data Model: Paginación (013)

No hay entidades nuevas ni cambios en las que se guardan: una página es una **vista** que se arma
al consultar y no se guarda. Los repositorios no cambian.

## Página (`shared/src/paginacion.ts`, nuevo)

```ts
/** Tamaños fijos que decide el servidor (FR-006, FR-020). */
export const LIMITES_PAGINACION = { tamanoDePagina: 10, reseniasEnElDetalle: 3 } as const;

/** Lo que acompaña a los elementos de una lista paginada (FR-002). */
export interface PaginaVista {
  /** La página entregada, desde 1: la pedida o, si no existe, la última (FR-005). */
  numero: number;
  /** Siempre `LIMITES_PAGINACION.tamanoDePagina`. */
  tamano: number;
  /** Elementos de la lista completa, con los filtros aplicados. */
  totalElementos: number;
  /** `ceil(totalElementos / tamano)`; 0 con la lista vacía. */
  totalPaginas: number;
}
```

Invariantes, que garantiza `paginar` (`backend/src/domain/paginacion.ts`):

- `1 ≤ numero ≤ max(totalPaginas, 1)`.
- `elementos.length ≤ tamano`. Es `tamano` en toda página menos la última y `0` solo con la lista
  vacía.
- Concatenar las páginas 1…`totalPaginas` de una misma lista da la lista completa en su orden
  (FR-003, SC-002).

## Pedido de página (entrada)

| Campo (query) | Listas | Regla |
|---|---|---|
| `pagina` | las tres | entero ≥ 1; ausente = 1; otro valor → 400 `query.pagina` (R2) |
| `estado` | Compras del evento | uno de `EstadoCompra`; ausente = todos; otro valor → 400 `query.estado` |
| `sinResponder` | Compras del evento | `"true"` o `"false"`; ausente = `false`; otro valor → 400 `query.sinResponder` |
| `texto`, `categoriaId`, `orden`, `sentido` | Catálogo | sin cambios (005) |

Tipos compartidos (en `shared/`):

```ts
// shared/src/evento.ts
export interface ConsultaCatalogo {
  texto?: string;
  categoriaId?: string;
  orden?: OrdenCatalogo;
  sentido?: SentidoCatalogo;
  pagina?: number; // nuevo
}

// shared/src/compra.ts (nuevo)
export interface ConsultaComprasDelEvento {
  pagina?: number;
  estado?: EstadoCompra;
  sinResponder?: boolean;
}
```

## Vistas que cambian

### `CatalogoVista` (`shared/src/evento.ts`)

```ts
export interface CatalogoVista {
  /** La página pedida del catálogo filtrado y ordenado (hasta 10). */
  eventos: EventoCatalogoVista[];
  pagina: PaginaVista; // nuevo
  /** Sin cambios: sobre todos los eventos próximos, antes del texto, la categoría y la página (FR-014). */
  hayEventosProximos: boolean;
}
```

### `ComprasDelEventoVista` (`shared/src/compra.ts`)

```ts
export interface ComprasDelEventoVista {
  evento: { id: string; nombre: string; fechaHoraLocal: string; realizado: boolean };
  /** De todas las compras: no depende de la página ni del filtro (FR-016). */
  ventanaDeUso: VentanaDeUsoVista;
  resumenPorTipo: ResumenTipoEntradaVista[];
  comprasConMensajesSinResponder: number;
  /** Nuevo: cuántas compras tiene el evento, sin filtro (decide los chips y el vacío, FR-017). */
  cantidadCompras: number;
  /** La página pedida de las compras filtradas, de la más nueva a la más vieja (008). */
  compras: CompraDelEventoVista[];
  pagina: PaginaVista; // nuevo
}
```

`CompraDelEventoVista` no cambia (sin códigos, FR-019).

### Reseñas del organizador (`shared/src/resenia.ts`)

```ts
/** `GET …/resenias-del-organizador/resumen`: la forma de la 012, con las 3 más recientes. */
export interface ReseniasDelOrganizadorVista {
  /** Puntaje y cantidad de **todas** sus reseñas (FR-021). */
  organizador: OrganizadorVista;
  /** Hasta `LIMITES_PAGINACION.reseniasEnElDetalle`, de la más reciente a la más vieja. */
  resenias: ReseniaDelOrganizadorVista[];
}

/** `GET …/resenias-del-organizador?pagina=N` (nuevo): "Ver todas las reseñas". */
export interface PaginaDeReseniasVista extends ReseniasDelOrganizadorVista {
  /** Hasta 10 por página, en el orden de la 012. */
  pagina: PaginaVista;
}
```

`ReseniaDelOrganizadorVista` no cambia.

## Funciones puras nuevas (backend)

| Módulo | Función | Qué hace |
|---|---|---|
| `domain/paginacion.ts` | `paginar(elementos, numeroPedido)` | corta la lista ya ordenada y calcula `PaginaVista` (R1) |
| `domain/compras-del-evento.ts` | `filtrarComprasDelEvento(compras, { estado?, sinResponder })` | sobre compras **al día**: `estado` compara `compra.estado`; `sinResponder`, `compra.mensajeSinResponder`; los dos juntos, y (R4) |

## Lógica de la app (mobile, sin estado del servidor)

| Módulo | Pieza | Qué hace |
|---|---|---|
| `componentes/botones-del-paginador.ts` | `botonesDelPaginador(totalPaginas, actual)` | los botones de FR-008, ascendentes, ≤ 5 (R6) |
| `componentes/usePagina.ts` | `usePagina(criterio)` | `[numero, cambiar]`; vuelve a 1 si cambia el criterio (R7) |
| `features/compras/filtro-de-compras.ts` | `consultaDelFiltro(filtro)` | `"todas"` → `{}`; `"sin-responder"` → `{ sinResponder: true }`; un estado → `{ estado }`. Reemplaza a `filtrarCompras`, que deja de existir: filtra el servidor |

## Datos de ejemplo (R11)

Los ids existentes no cambian. Lo nuevo usa ids legibles con el prefijo de su tipo.

| Qué | Cuánto | Para ver |
|---|---|---|
| Eventos próximos nuevos (organizadores y categorías variados, sin compras) | 5 → 12 próximos | 2 páginas en Explorar sin filtros (10 + 2) |
| Compras nuevas en `evento-festival-sonidos-del-sur`, de una entrada (`CONFIRMADA` y `CANCELADA`, sin `PENDIENTE`; al menos una con un mensaje del comprador sin responder fuera de la página 1) | 10 → 12 compras | 2 páginas en Compras del evento; el contador cuenta la de la página 2 |
| Eventos realizados nuevos de Martín, cada uno con 4 compras `UTILIZADA` (Lucía, Sofía, Diego y Valentina) y su reseña | 2 eventos, 8 compras, 8 reseñas (38 puntos) | 11 reseñas de Martín (≈ 4,73, se ve "4,7"): 3 en el detalle, 2 páginas en "Ver todas" |

Reglas que se siguen cumpliendo:

- Los cupos descuentan las compras vigentes.
- Nadie pasa el tope de 4 entradas pagas por evento.
- Toda reseña es de una compra `UTILIZADA`, posterior al uso, y hay una por comprador y evento.
- Los códigos de entrada son únicos.
- Los mensajes van en orden y son posteriores al alta de su compra.
