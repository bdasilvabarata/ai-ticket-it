# Data Model: Explorar eventos (005)

Entidades, operaciones, vistas y estado de la feature. Las decisiones están en
[research.md](./research.md); lo que no cambia está en `specs/004-crear-evento/data-model.md`.

## Dominio (backend `domain/`)

### Evento (existente): operaciones de consulta nuevas

| Operación | Devuelve | Regla |
|---|---|---|
| `precioDesde()` | `number` | menor `precio` entre **todos** los tipos, con o sin cupo (FR-004; R5) |
| `estaAgotado()` | `boolean` | todos los tipos con `cupo === 0` (FR-005). Agotado parcial → `false` |
| `coincideCon(palabras)` | `boolean` | cada palabra (ya normalizada) está en el nombre **o** en la descripción normalizados; `[]` → `true` (FR-011; R4) |
| `estaRealizado(ahora)` | `boolean` | sin cambios (004): `ahora ≥ fechaHora` |
| `tuPrecioEstaEntre(min, max)` | `boolean` | sin cambios; se corrige el comentario: el filtro por precio quedó fuera de alcance |

Ninguna operación modifica el evento ni lee el reloj: `ahora` llega del service.

### Búsqueda (`domain/busqueda.ts`, nuevo, puro)

| Función | Contrato |
|---|---|
| `normalizarParaBuscar(texto)` | NFD → quita U+0301 y U+0308 detrás de una vocal → NFC → minúsculas. `"BÁSQUET"` → `"basquet"`, `"Pingüino"` → `"pinguino"`, `"Año"` → `"año"` (R3) |
| `palabrasDeBusqueda(texto)` | `normalizarParaBuscar(texto).split(/\s+/)` sin vacíos. `"  club   ROCK "` → `["club", "rock"]`; `"   "` → `[]` |

Coincidencia literal con `includes` (sin expresiones regulares sobre la entrada). Coherente con
`mismoNombreDeTipo` en las equivalencias del español (test de tabla, R3).

### Orden del catálogo (`domain/orden-catalogo.ts`, nuevo, puro)

```ts
interface Ordenable { id: string; nombre: string; fechaHora: Date; precioDesde: number; puntaje: number | null }
function ordenarCatalogo<T extends Ordenable>(elementos: readonly T[], orden: OrdenCatalogo): T[]
```

| `orden` | Criterio principal | Desempates (en orden) |
|---|---|---|
| `fecha` | `fechaHora` ↑ | nombre (Collator `es`/`base`) → `id` |
| `precio` | `precioDesde` ↑ | `fechaHora` ↑ → nombre → `id` |
| `puntaje` | `puntaje` ↓ sin redondear, `null` al final | `fechaHora` ↑ → nombre → `id` |

Devuelve un arreglo nuevo; el de entrada no cambia.

### Resenia (`domain/resenia.ts`, nueva, mínima)

| Campo | Tipo | Invariante |
|---|---|---|
| `id` | `string` | — |
| `compradorId` | `string` | — |
| `eventoId` | `string` | — |
| `puntuacion` | `number` | entero de 1 a 5 → si no, `DatosInvalidosError` con detalle `puntuacion` ("Debe ser un entero de 1 a 5.") |

Sin `detalle`, sin endpoints y sin la regla de compra `UTILIZADA`: los agrega la 011.

### Puntaje (en `domain/resenia.ts`, derivado, no se guarda)

```ts
type Puntaje = { promedio: number | null; cantidad: number };
function calcularPuntaje(puntuaciones: readonly number[]): Puntaje;            // [] → { promedio: null, cantidad: 0 }
function puntajesPorOrganizador(eventos: readonly Evento[], resenias: readonly Resenia[]): Map<string, Puntaje>;
```

- `promedio` sin redondear (`[5, 4, 4]` → `4.333…`); el redondeo al décimo es de la app.
- `puntajesPorOrganizador` agrupa cada reseña por el `organizadorId` de su evento; una reseña de
  un evento que no está en `eventos` se ignora. Un organizador sin reseñas no aparece en el
  `Map` (el service usa `calcularPuntaje([])`).

### Interfaces de repositorio (`domain/repositorios.ts`)

```ts
/** Reseñas (mínimo de la 005): lo justo para el puntaje del organizador. La 011 lo amplía. */
interface RepositorioResenias {
  /** Las reseñas de esos eventos (posiblemente ninguna). */
  listarPorEventos(eventoIds: readonly string[]): Promise<Resenia[]>;
}
```

`RepositorioEventos`, `RepositorioUsuarios` y `RepositorioCategorias` no cambian
(`listar`, `listarPorOrganizador`, `buscarPorId` alcanzan).

## Repositorios (`repositories/`)

| Clase | Cambio |
|---|---|
| `ReseniaRepository` (nuevo) | `Map<string, Resenia>` privado, construido con `Resenia[]` (por defecto `[]`); `listarPorEventos` |
| `Repositorios` / `crearRepositoriosDeEjemplo()` | suman `resenias: new ReseniaRepository([])` (vacío en el seed) |

## Services

### EventoService (ampliado)

Dependencias: `eventos`, `categorias`, `compras`, **`usuarios`**, **`resenias`**, `cerrojo`,
`reloj`.

| Método | Cambio |
|---|---|
| `listar(consulta: ConsultaCatalogoValidada)` (nuevo) | `{ texto: string; categoriaId?: string; orden: OrdenCatalogo }` → `CatalogoVista`. Sin cerrojo. Un `ahora` por pedido. Lecturas fijas por pedido (R7): `eventos.listar`, `categorias.listar`, `usuarios.listar`, `resenias.listarPorEventos` |
| `obtener(id)` | suma `organizador` a la vista |
| `crear` / `actualizar` | su `EventoVista` también trae `organizador` (mismo tipo) |
| `#organizadorVista(organizadorId)` (privado) | usuario + `listarPorOrganizador` + `listarPorEventos` → `OrganizadorVista` |

Flujo de `listar`:

```text
ahora ─┐
eventos.listar() ──► proximos (no realizados) ──► filtrados (categoría ∧ palabras)
                         │                              │
                         └─ hayEventosProximos           ├─ organizadores ─► sus eventos (todos) ─► resenias.listarPorEventos ─► puntajes
                                                         └─► vistas ─► ordenarCatalogo ─► { eventos, hayEventosProximos }
```

### Vistas (`services/evento.vistas.ts`)

| Función | Vista |
|---|---|
| `aOrganizadorVista(usuario, puntaje)` (nueva) | `OrganizadorVista` |
| `aEventoCatalogoVista(evento, categoria, organizador, ahora)` (nueva) | `EventoCatalogoVista` |
| `aEventoVista(evento, categoria, organizador, ahora)` | suma el parámetro `organizador` |
| `aEventoResumenVista` / `aTipoEntradaVista` | sin cambios |

## Tipos compartidos (`shared/src/evento.ts`)

```ts
export const ORDENES_CATALOGO = ["fecha", "precio", "puntaje"] as const;
export type OrdenCatalogo = (typeof ORDENES_CATALOGO)[number];
export const LIMITES_BUSQUEDA = { texto: 100 } as const;

/** Lo que pide la app: los vacíos no se mandan. */
export interface ConsultaCatalogo { texto?: string; categoriaId?: string; orden?: OrdenCatalogo }

export interface OrganizadorVista {
  id: string;
  nombre: string;
  apellido: string;
  /** Promedio sin redondear; `null` = sin reseñas (nunca 0). */
  puntaje: number | null;
  cantidadResenias: number;
}

/** Evento en Explorar. */
export interface EventoCatalogoVista extends EventoResumenVista {
  /** Menor precio de todos sus tipos; 0 = gratis. */
  precioDesde: number;
  /** Todos sus tipos con cupo 0. */
  agotado: boolean;
  organizador: OrganizadorVista;
}

export interface CatalogoVista {
  eventos: EventoCatalogoVista[];
  /** Hay eventos no realizados, antes de aplicar texto y categoría (decide el vacío). */
  hayEventosProximos: boolean;
}

export interface EventoVista extends EventoResumenVista {
  descripcion: string;
  multimedia: string[];
  tiposEntrada: TipoEntradaVista[];
  organizador: OrganizadorVista;   // nuevo: nada se quita (FR-030)
}
```

`index.ts` exporta los nuevos (`ORDENES_CATALOGO`, `LIMITES_BUSQUEDA` como valores).

## Datos de ejemplo (FR-033; R9)

| Evento | Cambio | Para demostrar |
|---|---|---|
| `evento-hamlet` (Martín, +10 d) | Platea y Pullman con cupo **0** | "Agotado" en la tarjeta y en cada tipo del detalle |
| `evento-maraton-10k` (Lucía, +45 d) | + tipo `tipo-maraton-10k-carrera-kids` "Carrera kids", "Circuito de 2 km para menores de 12.", precio **0**, cupo 200 | "Gratis" en la tarjeta y primero al ordenar por precio |
| Reseñas | ninguna | todos "Sin reseñas" (FR-010) |

Siguen 8 eventos (6 próximos y 2 realizados) con 3, 3 y 2 por organizador.

Catálogo del seed (orden por fecha): Noche de Rock (+1 d) · Clásico de básquet (+5 d) · Hamlet
(+10 d, agotado) · Charla IA (+15 d) · Festival (+30 d) · Maratón (+45 d, gratis).

## Estado en la app (mobile)

| Estado | Dónde vive | Inicial | Se conserva |
|---|---|---|---|
| `texto` escrito | `useState` de `Explorar` | `""` | al apilar el detalle (la pestaña no se desmonta; FR-024) |
| `textoDemorado` | `useValorDemorado(texto.trim(), 500)` | `""` | — |
| `categoriaId` | `useState` de `Explorar` | `null` ("Todas") | ídem |
| `orden` | `useState` de `Explorar` | `"fecha"` | ídem |
| respuesta | caché de TanStack, `claves.catalogo({ texto, categoriaId, orden })` | — | por consulta (R14) |
| imágenes rotas | `useState` de `FilaImagenes` | `[]` | mientras el detalle está abierto |

Mostrar skeleton ⇔ `texto.trim() !== textoDemorado` **o** la query de la clave actual está
`isPending`.
