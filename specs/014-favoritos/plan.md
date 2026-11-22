# Implementation Plan: Favoritos

**Branch**: `feature/014-favoritos` | **Date**: 2026-11-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/014-favoritos/spec.md`

## Summary

Sin caso de uso propio (contexto de la consigna: "guardan favoritos"; constitución, "Usuario:
eventos favoritos"); se apoya en UC-03 (005). El usuario actual marca y desmarca un evento como
favorito **solo desde el detalle**, ve una estrella indicadora en los eventos favoritos de las
listas (Explorar, Mis compras, Mis eventos, Mis favoritos) y abre "Mis favoritos" desde Perfil.

**Backend**:

- **Dominio**: `Usuario.favoritos` (ya existía, vacío) es la única fuente. `Usuario` suma
  `tieneFavorito`, `marcarFavorito` y `desmarcarFavorito`, inmutables e idempotentes, y la
  invariante "sin repetir" (R1). `ordenDeMisEventos` suma el desempate nombre → id (R6).
- **Repositorio**: `RepositorioUsuarios` suma `guardar` y `listarPorFavorito(eventoId)`.
- **Contrato** (R2): `GET`, `PUT` y `DELETE /api/usuarios/actual/favoritos[/:eventoId]`. Las tres
  con usuario; `PUT` y `DELETE` son idempotentes y responden `204`; la lista,
  `EventoCatalogoVista[]` sin páginas. Rechazos 401 → 400 → 404, sin 409.
- **Services** (R3, R4):
  - `UsuarioService` (dueño de `Usuario`) hace las escrituras bajo un **cerrojo por usuario**
    (`cerrojoDeUsuarios`, instancia propia).
  - `EventoService` orquesta: 404 del evento con su `obtenerOFallar` y después pide la escritura a
    `UsuarioService`, sin tomar el cerrojo del evento (FR-007).
  - La lista reusa el armado de tarjetas del catálogo, extraído a un método privado, en lote y con
    lecturas fijas (R6).
- **Eliminar un evento** (R5): después del cerrojo del evento y solo si eliminó,
  `usuarioService.quitarFavoritoDeTodos(eventoId)`. Un id huérfano (carrera con un marcar) lo omite
  la lista.
- **Seed** (R10): Diego (2 próximos + 1 realizado), Valentina, Sofía (uno propio); Lucía y Martín
  sin favoritos.
- Se actualizan la OpenAPI (tag "Favoritos") y Postman.

**Mobile**:

- **Base**:
  - `src/api/usuarios.ts` suma las tres funciones;
  - `claves.favoritos(usuarioId)`;
  - `useEnvioUnico` y `useRefrescarAlFocalizar` se mueven de `compras` a `src/componentes/` (R7).
- **`eventos`** (dueña de todo; R7–R9):
  - `useFavoritos`, `useIdsDeFavoritos` (un `Set`, vacío sin datos) y `useCambiarFavorito` (sin
    reintentos, pendiente hasta releer los favoritos, sin optimismo);
  - `EstrellaFavorito` en el detalle (botón con `selected`/`busy`, única forma de marcar);
  - `MarcaFavorito`, indicadora y no accesible aparte, con la prop `esFavorito` en `TarjetaEvento`
    y `FilaEvento` (la etiqueta suma "en favoritos"); `TarjetaEvento` suma "Realizado";
  - la pantalla `MisFavoritos` en `app/favoritos.tsx`, apilada, con los cuatro estados;
  - `useEliminarEvento` invalida `["favoritos"]`.
- **`compras`**: `FilaMiCompra` suma `esFavorito` y "Mis compras" le pasa
  `useIdsDeFavoritos().has(compra.evento.id)`.
- **`sesion`**: Perfil suma el botón "Mis favoritos" (ruta tipada).

## Technical Context

**Language/Version**: TypeScript 5 (`strict`), Node 22+.

**Primary Dependencies**: Express 5, zod (backend); Expo SDK 58, Expo Router, TanStack Query,
`@expo/vector-icons` (Ionicons, ya usado por `Puntuacion`) (mobile). Sin dependencias nuevas.

**Storage**: repositorios en memoria (`Map`); los favoritos viajan dentro de cada `Usuario`.

**Testing**: Vitest + supertest (backend: `domain/usuario`, `domain/evento` para el orden,
`repositories/` para `guardar`/`listarPorFavorito`, `services/` para el cerrojo y la limpieza al
eliminar, `api/usuarios` o un `api/favoritos` nuevo, `docs`, `datos-ejemplo`); Jest + RNTL (mobile).

**Target Platform**: servidor Node local; app Android/iOS con Expo Go.

**Project Type**: mobile + API (monorepo `backend/`, `mobile/`, `shared/`).

**Performance Goals**: la lista con un número fijo de lecturas (6), sin N+1 (FR-011); SC-001 (<10 s
de marcar a ver en la lista) se cumple con la relectura inmediata.

**Constraints**: el catálogo y el detalle no cambian ni dependen del usuario (FR-013); marcar no
toma el cerrojo del evento (FR-007); sin cerrojos anidados; `eventos` no importa otras features.

**Scale/Scope**: 5 usuarios y ~20 eventos en el seed; 3 endpoints, 1 pantalla nueva, 2
componentes, 3 hooks.

## Constitution Check

*GATE: pasa antes del Phase 0 y se vuelve a verificar después del diseño.*

| Principio / regla | Cumple | Cómo |
|---|---|---|
| I. SDD | ✅ | spec con 6 clarificaciones; plan → tasks → implement por fases |
| II. Test-First | ✅ | TDD con stubs de firma real; cada regla (idempotencia, sin repetir, 404, limpieza al eliminar, orden, huérfano omitido) con su test |
| III. Capas | ✅ | dominio sin IO (`Usuario` con comportamiento); `UsuarioService` único que escribe usuarios; 404 del evento solo en `EventoService`; sin ciclos (`EventoService → UsuarioService`, ya existente); controllers sin reglas; lote sin N+1 |
| III. Cada agregado lo escribe su dueño | ✅ | eliminar un evento pide la limpieza a `UsuarioService` (R5) |
| IV. Memoria / cerrojo | ✅ | un cerrojo por usuario, instancia única inyectada desde `app.ts` (R4); sin anidar: la limpieza corre después del cerrojo del evento (R5) |
| IV. Operaciones atómicas por evento | ✅ | marcar no modifica el evento, sus tipos ni sus compras: no necesita su cerrojo |
| V. Contrato | ✅ | `/api/usuarios/actual/favoritos`, plural y kebab-case; errores con el formato único; OpenAPI + test de cobertura de rutas; `contracts/api.md` |
| VI. Identidad simulada | ✅ | las tres rutas con `X-Usuario-Id`; cada usuario solo opera sus favoritos (el recurso es "actual"); vista explícita `EventoCatalogoVista` |
| VII. App | ✅ | `fetch` solo en `src/api/`; cuatro estados en "Mis favoritos"; estrella por forma (llena/vacía), no solo color; `accessibilityLabel` y `selected` |
| VIII. Tipos compartidos | ✅ | sin tipos nuevos: reusa `EventoCatalogoVista` |
| IX. Calidad / YAGNI | ✅ | sin entidad, repositorio ni service nuevos; la única pieza extra (el segundo cerrojo) se justifica en R4 |
| Reglas de dependencia de mobile | ✅ | todo en `eventos`; `compras` lo usa por su `index.ts`; Perfil navega por ruta tipada; dos hooks genéricos bajan a la base (R7) |

**Post-diseño**: sin cambios; ninguna violación que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/014-favoritos/
├── plan.md              # este archivo
├── research.md          # R1–R10
├── data-model.md        # Usuario, repositorio, services, seed, piezas de la app
├── quickstart.md        # cómo verificar de punta a punta
├── contracts/
│   ├── api.md           # GET/PUT/DELETE /usuarios/actual/favoritos y el cambio en DELETE /eventos/:id
│   └── app.md           # hooks, EstrellaFavorito, MarcaFavorito, MisFavoritos, Perfil
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
backend/src/
├── domain/
│   ├── usuario.ts              # cambia: tieneFavorito, marcarFavorito, desmarcarFavorito, invariante
│   ├── evento.ts               # cambia: ordenDeMisEventos con desempate nombre → id
│   └── repositorios.ts         # cambia: RepositorioUsuarios.guardar y listarPorFavorito
├── repositories/usuario.repository.ts   # cambia
├── services/
│   ├── usuario.service.ts      # cambia: cerrojo + marcar/desmarcar/quitarFavoritoDeTodos
│   └── evento.service.ts       # cambia: marcarFavorito, desmarcarFavorito, favoritosDe,
│                               #         #tarjetasDelCatalogo (extraído de listar), eliminar limpia
├── controllers/evento.controller.ts      # cambia: favoritos, marcarFavorito, desmarcarFavorito
├── routes/usuarios.routes.ts   # cambia: recibe también EventoController; /actual/favoritos[/:eventoId]
├── routes/index.ts             # cambia: pasa los dos controllers
├── app.ts                      # cambia: cerrojoDeUsuarios → UsuarioService
├── seed/datos-ejemplo.ts       # cambia: favoritos de Diego, Valentina y Sofía
└── docs/openapi.json · ai-ticket-it.postman_collection.json   # cambian

backend/tests/
├── domain/usuario.test.ts · evento.test.ts · datos-ejemplo.test.ts
├── repositories/usuario.repository.test.ts     # nuevo
├── services/usuario.service.test.ts            # nuevo (cerrojo, limpieza)
├── services/evento.service.test.ts             # favoritosDe, eliminar limpia
└── api/favoritos.test.ts · docs.test.ts        # nuevo / cambia

mobile/
├── app/favoritos.tsx                           # nuevo (re-export)
├── src/api/usuarios.ts · index.ts              # cambian
├── src/consultas/claves.ts                     # cambia
├── src/componentes/useEnvioUnico.ts · useRefrescarAlFocalizar.ts · index.ts   # movidos desde compras
├── src/navegacion/LayoutRaiz.tsx               # cambia: Stack.Screen "favoritos"
├── src/features/eventos/
│   ├── useFavoritos.ts · useCambiarFavorito.ts # nuevos
│   ├── componentes/EstrellaFavorito.tsx · MarcaFavorito.tsx   # nuevos
│   ├── componentes/TarjetaEvento.tsx · FilaEvento.tsx         # cambian (esFavorito, Realizado)
│   ├── pantallas/MisFavoritos.tsx              # nuevo
│   ├── pantallas/DetalleEvento.tsx · Explorar.tsx · MisEventos.tsx   # cambian
│   ├── mutaciones.ts                           # cambia: useEliminarEvento invalida ["favoritos"]
│   └── index.ts                                # exporta MarcaFavorito, useIdsDeFavoritos, MisFavoritos
├── src/features/compras/                       # FilaMiCompra + MisCompras; imports de los hooks movidos
├── src/features/sesion/pantallas/Perfil.tsx    # cambia: botón "Mis favoritos"
└── tests/
    ├── helpers/                                # GET /usuarios/actual/favoritos → [] por defecto
    ├── features/eventos/                       # useIdsDeFavoritos, EstrellaFavorito
    └── pantallas/mis-favoritos.test.tsx (nuevo) · detalle-evento · explorar · mis-compras · mis-eventos · perfil
```

**Structure Decision**: el monorepo existente (`backend/`, `mobile/`, `shared/`), sin paquetes ni
carpetas nuevas. `shared/` no cambia.

## Fases sugeridas para `/speckit-tasks`

1. **Dominio y repositorio**: `Usuario` (métodos e invariante), `ordenDeMisEventos`,
   `RepositorioUsuarios.guardar`/`listarPorFavorito`.
2. **US1 backend — marcar y desmarcar**: cerrojo por usuario en `UsuarioService`, casos de uso en
   `EventoService`, controller, rutas, OpenAPI; tests de API con el orden de rechazos e idempotencia.
3. **US2 backend — la lista y la limpieza**: `#tarjetasDelCatalogo` (refactor de `listar` con su
   suite en verde), `favoritosDe`, `GET`; `eliminar` limpia (FR-010) y el huérfano se omite.
4. **US4 — seed** (y Postman).
5. **Base mobile**: api, clave, mover los dos hooks, helper de tests.
6. **US1 mobile — la estrella del detalle**.
7. **US2 mobile — "Mis favoritos"** y el botón de Perfil.
8. **US3 mobile — estrellas indicadoras** en Explorar, Mis eventos y Mis compras.
9. **Cierre**: AGENTS.md, backlog, suite completa.

## Complexity Tracking

Sin violaciones de la constitución. La única pieza que no existía —un segundo `CerrojoPorClave`
para los usuarios— se justifica en research R4 (cambios concurrentes del mismo usuario y "sin
cerrojos anidados" al limpiar después de eliminar).
