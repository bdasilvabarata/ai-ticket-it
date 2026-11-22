# Data Model: Reseñas de eventos (012)

Las decisiones están en [research.md](./research.md). Los contratos HTTP, en
[contracts/api.md](./contracts/api.md).

## `Resenia` (dominio, agregado propio; amplía la de la 005)

| Campo | Tipo | Regla |
|---|---|---|
| `id` | `string` | lo da `RepositorioResenias.siguienteId()` (UUID). En el seed, `resenia-<autor>-<evento>` |
| `compradorId` | `string` | el autor (usuario actual al reseñar) |
| `eventoId` | `string` | el evento reseñado |
| `puntuacion` | `number` | entero de 1 a 5 (`LIMITES_RESENIA`) |
| `comentario` | `string \| null` | recortado, de 1 a 500 caracteres, o `null` sin comentario |
| `creadaEn` | `Date` | reloj del servidor al recibirla |

- **Invariantes** (constructor, `Invariantes` → `DatosInvalidosError` con un detalle por campo):
  - puntuación entera de 1 a 5;
  - comentario `null` o de 1 a 500 caracteres sin espacios en los bordes.
- **`Resenia.crear({ id, compradorId, eventoId, puntuacion, comentario }, ahora)`**: normaliza el
  comentario (recorta; `""` → `null`) y pone `creadaEn = ahora`.
- Inmutable. No tiene operaciones de edición ni de borrado (FR-006b).
- Única por (`compradorId`, `eventoId`): la garantiza `ReseniaService.registrar` bajo el cerrojo del
  evento (R3), no el constructor.

### Funciones puras de `domain/resenia.ts`

| Función | Qué hace |
|---|---|
| `calcularPuntaje(puntuaciones)` | sin cambios (005): `{ promedio: null, cantidad: 0 }` sin reseñas |
| `puntajesPorOrganizador(eventos, resenias)` | sin cambios (005) |
| `exigirQuePuedeReseniar({ usuarioId, evento, compras })` | `ReglaDeNegocioError` `RESENIA_PROPIO_EVENTO` si `evento.esOrganizadoPor(usuarioId)`; `SIN_COMPRA_UTILIZADA` si ninguna de `compras` (las del usuario en el evento) tiene `estado === UTILIZADA`. Si no, nada |
| `exigirQueNoReseniO(existente)` | `ReglaDeNegocioError` `RESENIA_REPETIDA` si `existente !== null` |
| `compararResenias(a, b)` | `creadaEn` descendente → `id` ascendente |

"Compra `UTILIZADA`" es `compra.estado` (010): no se cuentan entradas ("1 de 3" alcanza). Tampoco se
mira si el evento está realizado (clarify).

## `RepositorioResenias` (puerto ampliado)

| Método | Devuelve |
|---|---|
| `siguienteId()` | UUID nuevo |
| `listarPorEventos(eventoIds)` | sin cambios (005) |
| `buscarPorEventoYComprador(eventoId, compradorId)` | la reseña o `null` |
| `listarPorComprador(compradorId)` | las de ese autor, de todos los eventos |
| `guardar(resenia)` | alta (o reemplazo por id, como los demás repositorios) |

`ReseniaRepository` es en memoria (`Map` por id, privado).

## `ReseniaService` (dueño de `Resenia`; sin dependencias nuevas de services)

| Método | Qué hace |
|---|---|
| `puntajesPorOrganizador(eventos)` · `puntajeDe(eventos)` | sin cambios (005) |
| `registrar({ eventoId, compradorId, puntuacion, comentario }, ahora)` | **dentro del cerrojo del que llama**, sin tomarlo: `buscarPorEventoYComprador` → `exigirQueNoReseniO` → `Resenia.crear` con `siguienteId()` → `guardar`. Devuelve la `Resenia` |
| `deCompradorEnEvento(compradorId, eventoId)` | la reseña o `null` (una lectura) |
| `deComprador(compradorId)` | `Map<eventoId, Resenia>` (una lectura) |
| `listarDeEventos(eventos)` | las reseñas de esos eventos, ordenadas con `compararResenias` (una lectura) |

## `CompraService` (cambios)

- Recibe además `reseniaService` (`app.ts`: se arma antes, como ahora). La dependencia nueva es
  `CompraService → ReseniaService`.
- **`reseniar(eventoId, usuarioId, datos)`**: bajo `cerrojo.ejecutar(eventoId, …)`.
  1. `ahora` del reloj;
  2. `eventoService.obtenerOFallar(eventoId)` (404);
  3. `compras.listarPorEventoYComprador(eventoId, usuarioId)`;
  4. `exigirQuePuedeReseniar` (409);
  5. `reseniaService.registrar(...)` (409 repetida, guarda).

  Responde `aReseniaVista(resenia)`. No guarda compras ni eventos (FR-007).
- **Vistas**: `obtener` y `misComprasDelEvento` leen `deCompradorEnEvento`; `misCompras` lee
  `deComprador`. Le pasan la reseña a `aCompraVista` / `aMiCompraVista`. `crear`, `pagar` y
  `cancelar` pasan `null`.

## `EventoService` (cambios)

- **`reseniasDelOrganizador(eventoId)`**: lectura sin cerrojo ni reloj, con cuatro lecturas fijas:
  1. `obtenerOFallar` (404);
  2. `eventos.listarPorOrganizador(organizadorId)`;
  3. `reseniaService.listarDeEventos(susEventos)`;
  4. `usuarioService.obtenerPorIds([organizadorId, ...autores])`.

  El puntaje es `calcularPuntaje` sobre esas reseñas: es el mismo conjunto que usa
  `#organizadorVista` (FR-018). Responde `aReseniasDelOrganizadorVista(...)`.

## Vistas (`shared/src/resenia.ts`, nuevo, y `shared/src/compra.ts`)

```ts
LIMITES_RESENIA = { puntuacionMinima: 1, puntuacionMaxima: 5, comentarioLargoMaximo: 500 } as const

DatosResenia { puntuacion: number; comentario?: string }

ReseniaVista {                     // la propia: en la compra y en la respuesta del alta
  id: string; eventoId: string;
  puntuacion: number; comentario: string | null;
  creadaEn: string;                // ISO UTC
  creadaEnLocal: string;           // "YYYY-MM-DDTHH:mm", Buenos Aires
}

ReseniaDelOrganizadorVista {
  id: string; puntuacion: number; comentario: string | null;
  autor: { nombre: string; apellido: string };   // sin id (FR-016)
  evento: { id: string; nombre: string };
  creadaEn: string; creadaEnLocal: string;
}

ReseniasDelOrganizadorVista {
  organizador: OrganizadorVista;   // id, nombre, apellido, puntaje (sin redondear | null), cantidadResenias
  resenias: ReseniaDelOrganizadorVista[];  // compararResenias
}
```

`CompraVista` (y por herencia `MiCompraVista`) suma:

| Campo | Valor |
|---|---|
| `resenia` | `ReseniaVista` del comprador en ese evento si la compra está `UTILIZADA`; si no, `null` |
| `puedeReseniar` | `estado === UTILIZADA && resenia === null` |

`CompraDelEventoVista`, `ChatDeLaCompraVista` y `EntradaDelEventoVista` no cambian.

`services/resenia.vistas.ts` (nuevo) tiene `aReseniaVista`, `aReseniaDelOrganizadorVista` y
`aReseniasDelOrganizadorVista`. `compra.vistas.ts` suma la pieza `reseniaDeLaCompra(compra,
resenia)`.

## Seed (R10)

| Evento (organizador) | Compras `UTILIZADA` nuevas (1 entrada c/u) | Reseñas |
|---|---|---|
| Jazz en el Patio (Martín, −10 días) | Lucía, Diego, Valentina | 5, 4, 5 → Martín ≈ 4,7 · 3 |
| Stand-up: Noche de risas (Sofía, −3 días) | Diego, Valentina | 3 (con comentario), 2 (sin comentario) → Sofía 2,5 · 2 |
| Peña en La Rueda (Lucía) | — (ya existe `compra-martin-pena-general`) | ninguna: demo de "Reseñar evento" |

- Los ids son fijos (`compra-<autor>-<evento>-general`, `resenia-<autor>-<evento>`), igual que los
  códigos de entrada.
- El uso de cada compra cae dentro de su ventana; la reseña es posterior al uso.
- Los cupos de Jazz (60) y Stand-up (80) descuentan las entradas nuevas.
- `crearRepositoriosDeEjemplo` le pasa las reseñas a `new ReseniaRepository([...])`.
