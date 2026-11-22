# Data Model: Favoritos (014)

No hay entidades nuevas: los favoritos son parte del agregado `Usuario` (research R1).

## Usuario (backend, `domain/usuario.ts`) — cambia

| Campo | Tipo | Regla |
|---|---|---|
| `id`, `nombre`, `apellido` | — | sin cambios |
| `favoritos` | `readonly string[]` (ids de eventos) | **sin repetir** (nueva invariante: `DatosInvalidosError` sobre `favoritos`, "No puede repetir eventos."); en el orden en que se marcaron (no se usa para ordenar la lista) |

Comportamiento nuevo (inmutable: devuelve un `Usuario` nuevo o `this`):

| Método | Efecto |
|---|---|
| `tieneFavorito(eventoId)` | `boolean` |
| `marcarFavorito(eventoId)` | agrega `eventoId` al final; si ya estaba, `this` (FR-003) |
| `desmarcarFavorito(eventoId)` | lo saca; si no estaba, `this` (FR-003) |

`Usuario` no sabe si el evento existe: lo verifica `EventoService` antes (404, FR-004).

### Ciclo de vida de un favorito

```text
(no favorito) --PUT--> (favorito) --DELETE--> (no favorito)
      ^  PUT repetido: igual          |  DELETE repetido: igual
      |                               |
      +----- el organizador elimina el evento (quitarFavoritoDeTodos) -----+
```

Sin estados intermedios ni fecha de marcado (spec, Key Entities).

## RepositorioUsuarios (`domain/repositorios.ts`) — suma

| Método | Devuelve / hace |
|---|---|
| `guardar(usuario)` | alta o reemplazo por id (reemplaza la instancia) |
| `listarPorFavorito(eventoId)` | los usuarios que tienen ese evento en `favoritos` (posiblemente ninguno) |

`UsuarioRepository` los implementa sobre su `Map`. No hay `eliminarPorId` (no se borran usuarios).

## Services

| Service | Método nuevo | Hace |
|---|---|---|
| `UsuarioService` | `marcarFavorito(usuarioId, eventoId)` | bajo el cerrojo con la clave `usuario:<id>` (R4): relee (404 del usuario), marca y guarda si cambió |
| `UsuarioService` | `desmarcarFavorito(usuarioId, eventoId)` | ídem con `desmarcarFavorito` |
| `UsuarioService` | `quitarFavoritoDeTodos(eventoId)` | `listarPorFavorito` y, de a uno, bajo el cerrojo de cada usuario, relee, desmarca y guarda (R5) |
| `EventoService` | `marcarFavorito(eventoId, usuarioId)` · `desmarcarFavorito(eventoId, usuarioId)` | `obtenerOFallar(eventoId)` (404) → `usuarioService.…`; sin cerrojo del evento (FR-007) |
| `EventoService` | `favoritosDe(usuarioId)` | la lista (R6): `EventoCatalogoVista[]` de los favoritos que existen, en el orden de `ordenDeMisEventos` |
| `EventoService` | `eliminar(id, usuarioId)` (cambia) | después del cerrojo del evento y solo si eliminó: `usuarioService.quitarFavoritoDeTodos(id)` (R5) |

`ordenDeMisEventos(ahora)` (`domain/evento.ts`) suma el desempate nombre → id (FR-009).

`UsuarioService` recibe además `cerrojo`: la **misma** instancia que comparten los services de
eventos (una sola por app), con claves `usuario:<id>`.

## Vistas (`shared/`)

Sin tipos nuevos: la lista es `EventoCatalogoVista[]` (feature 005), con `realizado` ya incluido
en `EventoResumenVista`. `EventoVista`, `EventoCatalogoVista` y `CatalogoVista` **no** suman nada
de favoritos (FR-013).

## Seed (`seed/datos-ejemplo.ts`)

| Usuario | `favoritos` |
|---|---|
| `usuario-diego` | `evento-festival-sonidos-del-sur`, `evento-clasico-de-basquet`, `evento-noche-de-risas` |
| `usuario-valentina` | `evento-noche-de-rock`, `evento-jazz-en-el-patio` |
| `usuario-sofia` | `evento-clasico-de-basquet` (propio), `evento-maraton-10k` |
| `usuario-lucia`, `usuario-martin` | `[]` |

## App (mobile)

| Pieza | Dónde | Forma |
|---|---|---|
| Clave | `src/consultas/claves.ts` | `favoritos(usuarioId)` → `["favoritos", usuarioId]` |
| Query | `eventos/useFavoritos.ts` | `EventoCatalogoVista[]` del usuario actual |
| Derivado | `eventos/useFavoritos.ts` | `useIdsDeFavoritos(): ReadonlySet<string>` (vacío sin datos) |
| Mutation | `eventos/useCambiarFavorito.ts` | `variables: { marcar: boolean }`; `onSettled` espera la relectura de `["favoritos", usuarioId]` |
