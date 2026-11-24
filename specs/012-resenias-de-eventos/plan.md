# Implementation Plan: Reseñas de eventos

**Branch**: `feature/012-resenias-de-eventos` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/012-resenias-de-eventos/spec.md`

## Summary

UC-09 y UC-10.

- Quien tiene una compra `UTILIZADA` de un evento lo reseña **una vez**: una puntuación entera de
  1 a 5 y un comentario opcional de hasta 500 caracteres. No hace falta que el evento esté
  realizado, y no se edita ni se borra.
- El detalle público de todo evento muestra "Reseñas del organizador": el puntaje, la cantidad y
  todas las reseñas de sus eventos.
- El puntaje de la 005 no cambia de cálculo: deja de estar vacío.

**Backend**:

- **Dominio**:
  - `Resenia` amplía la mínima de la 005 con `comentario` (`string | null`), `creadaEn` y
    `Resenia.crear` (R1).
  - Reglas puras: `exigirQuePuedeReseniar` (409 propio evento, sin compra `UTILIZADA`),
    `exigirQueNoReseniO` (409 repetida) y `compararResenias` (R4, R8).
- **Repositorio**: `RepositorioResenias` suma `siguienteId`, `buscarPorEventoYComprador`,
  `listarPorComprador` y `guardar` (R9).
- **Services**:
  - El alta es `CompraService.reseniar`, bajo el **cerrojo del evento**. Relee el evento y las
    compras del comprador, y delega la escritura en `ReseniaService.registrar`, que verifica la
    unicidad y guarda (R2, R3). La dependencia nueva es `CompraService → ReseniaService`, sin ciclos.
  - `EventoService.reseniasDelOrganizador` hace cuatro lecturas fijas (R7).
- **API**:
  - `POST /eventos/:eventoId/resenias` → `201 ReseniaVista`, con orden 401 → 400 → 404 → 409 ×3.
  - `GET /eventos/:eventoId/resenias-del-organizador`, público.
  - `CompraVista` y `MiCompraVista` suman `resenia` y `puedeReseniar` (R6).
  - Se actualizan la OpenAPI y Postman.
- **Seed**: reseñas de Jazz (Martín ≈ 4,7) y Stand-up (Sofía 2,5), con sus compras `UTILIZADA`.
  Lucía queda sin reseñas, y la Peña de Martín sin reseñar es la demo (R10).

**Mobile**:

- **Feature `compras`**:
  - la pantalla "Reseñar evento" en `compras/[compraId]/resenia`, con `SelectorPuntuacion` accesible,
    "Comentario (opcional)", `useEnvioUnico`, errores por campo y descarte;
  - los accesos en "Tu compra" y en `FilaMiCompra` (como hermano);
  - `useReseniarEvento`, que invalida por prefijo (R11).
- **Feature `eventos`**: la sección `ReseniasDelOrganizador` al final de `DetalleEvento`, con sus
  propios estados, y `Puntuacion` exportada.

**Constitución**: sin enmiendas. "Reseñas" y "Puntaje del organizador" ya están. Que el `detalle` de
la consigna se llame `comentario` (R1) se puede alinear con un PATCH opcional al cerrar la feature.

Las decisiones están en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript strict (`~6.0`) en los tres paquetes; Node ≥ 22.12

**Primary Dependencies**:
- Backend: Express 5 y zod 4.
- Mobile: Expo SDK 58, Expo Router y TanStack Query v5.
- **Sin dependencias nuevas.**

**Storage**: repositorios en memoria (`Map` privado). `ReseniaRepository` pasa de solo lectura a alta
(4 métodos nuevos). Los demás repositorios no cambian.

**Testing**:
- Backend: Vitest y supertest, en domain (`Resenia`, reglas, orden), repositories, services (reloj
  fijo, cerrojo, compra y cupo intactos), concurrencia (dos reseñas a la vez → una), api y seed.
- Mobile: Jest, jest-expo y RNTL con `renderConDependencias` y `porRuta`.

**Target Platform**: servidor Node local; Android con Expo Go (compatible con iOS)

**Project Type**: mobile-app con API (monorepo `backend/`, `shared/`, `mobile/`)

**Performance Goals**:
- Reseñar desde "Mis compras": 3 toques más el texto (SC-001).
- Lecturas fijas por pedido:
  - `reseniasDelOrganizador`: 4.
  - `obtener` y `misComprasDelEvento`: +1.
  - `misCompras`: +1, sin N+1 por compra.
- Un pedido por toque de "Enviar".

**Constraints**:
- Una reseña por comprador y evento, también ante pedidos simultáneos (cerrojo del evento).
- La fecha sale del reloj del servidor. El comentario se recorta y va hasta 500 caracteres, o queda
  `null`.
- La reseña no cambia la compra ni el cupo.
- La lista no expone ids de autor, compras ni códigos.
- El puntaje es el mismo en la tarjeta, el detalle y la sección.
- 360 px y TalkBack (cada puntuación es un `radio`; el acceso va como hermano en la fila).

**Scale/Scope**:
- Backend: 2 endpoints, 1 entidad ampliada, 3 funciones puras, 4 métodos de repositorio, 4 de
  `ReseniaService`, 1 de `CompraService` y 1 de `EventoService`, 1 archivo de vistas, ~5 tipos
  compartidos, 2 campos en `CompraVista` y 5 compras con 5 reseñas en el seed.
- Mobile:
  - 2 funciones de API, 1 clave, 1 consulta y 1 mutation;
  - 1 pantalla y ~5 componentes;
  - 1 ruta nueva y ~8 textos.
- Unos 16 archivos de test nuevos o ampliados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple el plan | Estado |
|---|---|---|
| Dominio · Entidades | `Resenia` (comprador, evento, puntuación y el "detalle" como `comentario`), agregado propio, más `creadaEn` (R1) | ✅ |
| Dominio · Reseñas | Solo con una compra `UTILIZADA` del evento (`exigirQuePuedeReseniar`), una vez por evento (`exigirQueNoReseniO` bajo el cerrojo) y puntuación entera de 1 a 5 (zod y el constructor). Cada una con su borde (R12) | ✅ |
| Dominio · Puntaje del organizador | `calcularPuntaje` sin cambios. Sin reseñas, `null` (nunca 0). El mismo conjunto en la tarjeta, el detalle y la sección (R7) | ✅ |
| Dominio · Operaciones atómicas | `reseniar` corre en `cerrojo.ejecutar(eventoId)`: relee reloj, evento, compras y reseña existente, y guarda. Se libera en `finally`, sin anidar (`registrar` no toma el cerrojo; R3) | ✅ |
| Dominio · Estados y cupo | No agrega cambios de estado ni toca el cupo (FR-007). Una `UTILIZADA` es terminal: sin materializar vencimientos (R3) | ✅ |
| I. Spec-Driven | La spec tiene 5 clarificaciones; sigue tasks → implement. El backlog se actualiza al cerrar la feature | ✅ |
| II. Test-First | Bordes: 0, 1, 5, 6 y 4,5; 500 y 501 caracteres; solo espacios; "1 de 3"; dos compras `UTILIZADA`; cada estado no `UTILIZADA`; organizador; repetida y simultánea (R12). TDD con stub de firma real | ✅ |
| III. Capas | `domain/` puro, con los 409 como `ReglaDeNegocioError`. `ReseniaService` es el dueño y escribe la reseña, sin depender de otros services. `CompraService` orquesta el alta porque la regla es de sus compras, y `EventoService → ReseniaService` sigue sin ciclo (R2). El 404 lo da `EventoService.obtenerOFallar` y los usuarios llegan en lote | ✅ |
| IV. Persistencia en memoria | `Map` privado. Ids nuevos de `siguienteId()` (UUID) y fijos en el seed (`resenia-…`) | ✅ |
| V. Contrato de API | `/api/eventos/:eventoId/resenias` y `/resenias-del-organizador`, en plural y kebab-case. Formato de error único, orden documentado (contracts/api.md), OpenAPI con su test y Postman | ✅ |
| VI. Identidad simulada | El autor sale de `X-Usuario-Id`. Vistas explícitas: sin id de autor ni datos de compras en la lista (FR-016). El detalle de reseñas es público, como el del evento | ✅ |
| VII. App Mobile | `fetch` solo en `src/api/`. Los cuatro estados con `SegunConsulta`, también en la sección. Puntuación accesible (`radio`, "N de 5") y elegida con algo más que el color. Acceso como hermano en la fila. 360 px | ✅ |
| VIII. Tipos compartidos | `LIMITES_RESENIA`, `DatosResenia`, `ReseniaVista`, `ReseniaDelOrganizadorVista` y `ReseniasDelOrganizadorVista` en `shared/src/resenia.ts`; `CompraVista` ampliada | ✅ |
| IX. Calidad | `strict`, las cuatro verificaciones y el CI. Sin services, controllers ni routers nuevos: el alta va en `CompraController` y la lista en `EventoController`, como `POST /eventos/:eventoId/compras` (YAGNI) | ✅ |

**Gate**: pasa sin violaciones ni enmiendas.

**Re-check post-diseño**: data-model, los contratos y quickstart no cambian la tabla. Hay dos cambios
de piezas compartidas, aditivos y con test:
- `CompraVista` suma dos campos y `aCompraVista` recibe la reseña. Todos sus llamadores la pasan
  (`null` donde la compra no puede estar `UTILIZADA`).
- `eventos/index.ts` exporta `Puntuacion`, `useConfirmarDescarte` y lo que el formulario usa de
  `errores-de-formulario.ts`. La dependencia sigue siendo `compras → eventos`.

## Project Structure

### Documentation (this feature)

```text
specs/012-resenias-de-eventos/
├── spec.md
├── plan.md              # este archivo
├── research.md          # R1–R12
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md           # POST /eventos/:eventoId/resenias, GET …/resenias-del-organizador, CompraVista
│   └── app.md           # pantalla, accesos, sección, consultas, textos
├── checklists/
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
shared/src/{resenia.ts (nuevo), compra.ts, index.ts}   # LIMITES_RESENIA, vistas; resenia y puedeReseniar

backend/src/
├── domain/resenia.ts                          # comentario, creadaEn, crear, reglas, compararResenias
├── domain/repositorios.ts                     # RepositorioResenias ampliado
├── repositories/resenia.repository.ts         # siguienteId, buscarPorEventoYComprador, listarPorComprador, guardar
├── services/resenia.service.ts                # registrar, deCompradorEnEvento, deComprador, listarDeEventos
├── services/resenia.vistas.ts (nuevo)         # aReseniaVista, aReseniaDelOrganizadorVista, aReseniasDelOrganizadorVista
├── services/compra.service.ts                 # reseniar; vistas con la reseña
├── services/compra.vistas.ts                  # reseniaDeLaCompra en aCompraVista / aMiCompraVista
├── services/evento.service.ts                 # reseniasDelOrganizador
├── validations/resenia.validation.ts (nuevo)  # reseniaNueva
├── controllers/{compra, evento}.controller.ts # reseniar, reseniasDelOrganizador
├── routes/eventos.routes.ts                   # POST /:eventoId/resenias, GET /:eventoId/resenias-del-organizador
├── app.ts                                     # reseniaService → CompraService
├── seed/{datos-ejemplo, repositorios-de-ejemplo}.ts
└── docs/{openapi.json, ai-ticket-it.postman_collection.json}

backend/tests/
├── domain/{resenia, datos-ejemplo}.test.ts
├── repositories/resenia.repository.test.ts
├── services/{resenia.service, compra.service, evento.service, concurrencia-compras}.test.ts
└── api/{resenias (nuevo), compras, docs}.test.ts

mobile/
├── app/compras/[compraId]/resenia.tsx (nueva)
└── src/
    ├── api/resenias.ts (nuevo) (+ index.ts)
    ├── consultas/claves.ts                    # reseniasDelOrganizador
    ├── navegacion/LayoutRaiz.tsx              # compras/[compraId]/resenia
    └── features/
        ├── eventos/
        │   ├── useReseniasDelOrganizador.ts (nuevo)
        │   ├── formato.ts                     # textoPuntuacion, textoFechaResenia, etiquetaDeResenia
        │   ├── index.ts                       # Puntuacion, useConfirmarDescarte, …
        │   ├── pantallas/DetalleEvento.tsx    # sección al final
        │   └── componentes/{Puntuacion, ReseniasDelOrganizador, FilaResenia (nuevos)}.tsx
        └── compras/
            ├── mutaciones.ts                  # useReseniarEvento
            ├── formato.ts                     # textoAvisoResenia
            ├── index.ts                       # ReseniarEvento
            ├── pantallas/ReseniarEvento.tsx (nueva)
            ├── pantallas/Compra.tsx           # ReseniaDeLaCompra
            └── componentes/{SelectorPuntuacion, ReseniaDeLaCompra (nuevos), FilaMiCompra}.tsx

mobile/tests/
├── api/resenias.test.ts (nuevo)
├── features/{eventos, compras}/formato.test.ts
├── helpers/compras.ts                         # resenia y puedeReseniar en las compras de ejemplo
├── tipos/rutas-tipadas.ts                     # /compras/[compraId]/resenia sin parámetro
└── pantallas/{reseniar-evento (nuevo), compra, mis-compras, detalle-evento}.test.tsx

AGENTS.md · docs/backlog.md                    # al cerrar la feature
```

**Structure Decision**: la del monorepo actual. La reseña es su propio agregado (dominio, repositorio y
service ya existentes, ampliados). El alta la orquesta `CompraService` y la lista, `EventoService`.
No hay services, controllers ni routers nuevos. En mobile, la pantalla cuelga de la compra (feature
`compras`) y la sección, del detalle (feature `eventos`).

## Complexity Tracking

Sin violaciones que justificar.
