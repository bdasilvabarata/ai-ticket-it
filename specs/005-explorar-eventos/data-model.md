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
  `Map` (`ReseniaService` lo completa con `calcularPuntaje([])`).

**Nombres del puntaje** (el mismo dato en cada capa; el cambio de nombre es deliberado y se
comenta en `aOrganizadorVista`):

| Capa | Promedio | Cantidad | Por qué |
|---|---|---|---|
| `domain/resenia.ts` → `Puntaje` | `promedio` | `cantidad` | dentro de un `Puntaje`, "puntaje.puntaje" sería redundante |
| `shared` → `OrganizadorVista` | `puntaje` | `cantidadResenias` | el contrato habla del organizador: "su puntaje" y "cuántas reseñas" |
| `domain/orden-catalogo.ts` → `Ordenable` | `puntaje` | — | el criterio de orden se llama `puntaje` (`ORDENES_CATALOGO`) |

### Interfaces de repositorio (`domain/repositorios.ts`)

```ts
/** Reseñas (mínimo de la 005): lo justo para el puntaje del organizador. La 011 lo amplía. */
interface RepositorioResenias {
  /** Las reseñas de esos eventos (posiblemente ninguna). */
  listarPorEventos(eventoIds: readonly string[]): Promise<Resenia[]>;
}
```

```ts
interface RepositorioUsuarios {
  // … lo de antes
  /** Los que existen de esos ids (posiblemente ninguno), sin repetir: para `obtenerPorIds`. */
  listarPorIds(ids: readonly string[]): Promise<Usuario[]>;
}
```

`RepositorioEventos` (`listar`, `listarPorOrganizador`, `buscarPorId`, `siguienteId`) y
`RepositorioCategorias` (con el `listarPorIds` del refactor de la 004) no cambian.

## Repositorios (`repositories/`)

| Clase | Cambio |
|---|---|
| `ReseniaRepository` (nuevo) | `Map<string, Resenia>` privado, construido con `Resenia[]` (por defecto `[]`); `listarPorEventos` |
| `UsuarioRepository` | + `listarPorIds` |
| `Repositorios` / `crearRepositoriosDeEjemplo()` | suman `resenias: new ReseniaRepository([])` (vacío en el seed) |

## Services

Cada agregado tiene su service dueño (constitución 2.2.0, principio III). Dependencias, sin
ciclos: `TipoEntradaService` → `EventoService` → `CategoriaService`, `UsuarioService`,
`ReseniaService`.

### UsuarioService (ampliado)

| Método | Cambio |
|---|---|
| `obtenerOFallar(id)` | pasa a ser público (lo usa `EventoService` para el organizador del detalle) |
| `obtenerPorIds(ids)` (nuevo) | `Map<string, Usuario>` en una lectura (`listarPorIds`); si falta alguno, `404 USUARIO_NO_ENCONTRADO` |

### CategoriaService (ampliado)

| Método | Cambio |
|---|---|
| `buscarReferenciada(id, origen: OrigenDeReferencia = "datos")` | suma `origen`: el `categoriaId` de la consulta del catálogo es una referencia de la entrada; si no existe, `ReferenciaInvalidaError("categoriaId", "No existe la categoría.", origen)`. Con `"consulta"` → 400 sobre `query.categoriaId`; sin `origen`, igual que en la 004 (`body.categoriaId`) |

`errors/index.ts`: `type OrigenDeReferencia = "datos" | "consulta"` (de qué parte de la entrada
del caso de uso vino la referencia, sin vocabulario HTTP) y `ReferenciaInvalidaError` suma
`readonly origen: OrigenDeReferencia` (por defecto `"datos"`). `aErrorAplicacion`
(`middlewares/traducir-error.ts`) lo traduce con `{ datos: "body", consulta: "query" }` y arma el
detalle como `body.categoriaId` / `query.categoriaId`.

### ReseniaService (nuevo)

Dependencias: `resenias: RepositorioResenias`. No depende de otros services.

| Método | Devuelve |
|---|---|
| `puntajesPorOrganizador(eventos)` | `Map<string, Puntaje>` con **todos** los organizadores de `eventos` (los sin reseñas, con `calcularPuntaje([])`); **un** `listarPorEventos` |
| `puntajeDe(eventosDelOrganizador)` | el `Puntaje` de las reseñas de esos eventos; un `listarPorEventos` |

### EventoService (ampliado)

Dependencias: `eventos`, `compras`, `categoriaService`, **`usuarioService`**,
**`reseniaService`**, `cerrojo`, `reloj`.

| Método | Cambio |
|---|---|
| `listar(consulta: ConsultaCatalogoValidada)` (nuevo) | `{ texto: string; categoriaId?: string; orden: OrdenCatalogo }` → `CatalogoVista`. Sin cerrojo. Si viene `categoriaId`, primero `categoriaService.buscarReferenciada(categoriaId, "consulta")` (400 si no existe). Un `ahora` por pedido. Lecturas fijas por pedido (R7): `eventos.listar` y una llamada en lote a cada dueño: `categoriaService.obtenerPorIds`, `usuarioService.obtenerPorIds`, `reseniaService.puntajesPorOrganizador` (ninguna si la lista filtrada queda vacía). Ordena elementos `Ordenable & { vista }`, no las vistas |
| `obtener(id)` | suma `organizador` a la vista |
| `crear` / `actualizar` | su `EventoVista` también trae `organizador` (mismo tipo) |
| `#organizadorVista(organizadorId)` (privado) | `usuarioService.obtenerOFallar` + `eventos.listarPorOrganizador` + `reseniaService.puntajeDe` → `OrganizadorVista` |

Flujo de `listar`:

```text
categoriaId? ──► categoriaService.buscarReferenciada(categoriaId, "consulta") ──► (no existe → 400 query.categoriaId)
ahora ─┐
eventos.listar() ──► proximos (no realizados) ──► filtrados (categoría ∧ palabras)
                         │                              │
                         └─ hayEventosProximos           ├─ filtrados = [] ─► { eventos: [], hayEventosProximos } (sin pedir lotes)
                                                         ├─ categoriaService.obtenerPorIds ─► categorías
                                                         ├─ usuarioService.obtenerPorIds ─► organizadores
                                                         ├─ sus eventos (todos) ─► reseniaService.puntajesPorOrganizador ─► puntajes
                                                         └─► elementos { ordenables + vista } ─► ordenarCatalogo ─► .map(vista) ─► { eventos, hayEventosProximos }
```

- **Lista filtrada vacía**: `listar` responde enseguida `{ eventos: [], hayEventosProximos }` y
  **no** pide los lotes (ni categorías, ni organizadores, ni puntajes): no hay nada que armar.
  Las lecturas siguen siendo fijas por pedido (a lo sumo una por dueño).
- **Qué se ordena**: `EventoCatalogoVista` no cumple `Ordenable` (su `fechaHora` es un `string`
  ISO y el puntaje está en `organizador.puntaje`), así que no se ordenan las vistas. Por cada
  evento filtrado, el service arma un elemento privado, los ordena con `ordenarCatalogo` y
  responde `elementos.map((e) => e.vista)`. El tipo vive en `services/evento.service.ts` (no se
  exporta) y `domain/orden-catalogo.ts` no conoce vistas:

  ```ts
  type ElementoDelCatalogo = Ordenable & { vista: EventoCatalogoVista };
  // por evento filtrado:
  { id: evento.id, nombre: evento.nombre, fechaHora: evento.fechaHora /* Date de la entidad */,
    precioDesde: evento.precioDesde(), puntaje: puntaje.promedio /* sin redondear */,
    vista: aEventoCatalogoVista(evento, categoria, organizador, ahora) }
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
