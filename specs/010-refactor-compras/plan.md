# Implementation Plan: Refactor de Mis compras, Compras del evento y Cancelación

**Branch**: `feature/010-refactor-compras` | **Date**: 2026-11-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-refactor-compras/spec.md`

## Summary

Refactor sin cambios visibles de lo que hicieron la 007, la 008 y la 009, antes del chat (011) y de
las reseñas (012). En el backend: la `Entrada` pasa a su propio módulo con su **uso** y su
**cancelación** explícitos (quién y cuándo, o `null`) en lugar de una lista de cambios y de
`estadoEn(compra)`; las invariantes de `Compra` se escriben como una lista de reglas con nombre,
una por regla, en su propio módulo; la compra expone `reembolso` (`"pendiente"` · `"confirmado"` ·
`null`) como único valor derivado; las vistas del organizador se arman con las mismas piezas que
las del comprador; y `CompraService` pasa a ser el único service de casos de uso que guarda compras:
`EntradaService.registrarUso` delega entero en `CompraService.registrarUso` (mismo cerrojo, mismo
orden de chequeos, un solo `guardar`). En la app: `useRegistrarUso` deja de invalidar el evento y
el catálogo, y "Registrar ingreso" se divide en `BuscadorDeCodigo` y `ResultadoDeIngreso`, sin
ternarios anidados. Opcionales en la última fase: `useEnvioUnico` y `diasRestantes` sin `split`.

La red de seguridad son los tests de `backend/tests/api/` y `mobile/tests/pantallas/`, que no se
tocan (con la única excepción acotada de las aserciones de invalidación de
`registrar-ingreso.test.tsx`, ver spec, Clarifications).

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 22 en el backend; React Native con Expo SDK 58
(React 19) en la app.

**Primary Dependencies**: Express 5 y zod (backend); Expo Router, TanStack Query 5 (app). Sin
dependencias nuevas.

**Storage**: repositorios en memoria (un `Map` por repositorio). La forma interna de `Entrada`
cambia; los repositorios guardan la instancia y no la serializan, así que no hay migración.

**Testing**: Vitest + supertest (backend), Jest + React Native Testing Library (app). TDD con stub
(AGENTS.md): `test:foco` por archivo en cada ciclo, suite completa al cerrar cada fase.

**Target Platform**: servidor Node local; app Android con Expo Go.

**Project Type**: mobile + API (monorepo con workspaces `backend`, `shared`, `mobile`).

**Performance Goals**: sin cambios (las lecturas siguen con la misma cantidad fija de lecturas al
repositorio; `comprasDelEvento` sigue en cuatro).

**Constraints**: sin cambios en `shared/`, rutas, respuestas, OpenAPI ni en la app visible (FR-001,
FR-002); `domain/compra.ts` ≤ 300 líneas (SC-005); sin ciclos entre services (FR-016).

**Scale/Scope**: ~12 archivos de producción en el backend, 4 en la app, los tests de dominio y de
services de compras y entradas, los ayudantes de tests, la semilla y la documentación.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / regla | Cumple | Cómo |
|---|---|---|
| Dominio: estados de compra, estado de una entrada, cancelación, reembolso | ✅ | Ninguna regla cambia (FR-005); cambia la representación. La redacción de "Entrada" se aclara con un PATCH (FR-024, R9) |
| Operaciones atómicas por evento | ✅ | `CompraService.registrarUso` toma el mismo cerrojo del evento, relee evento (al día) y compra adentro, un `ahora`, un `guardar` (R4) |
| Capas y `domain/` sin IO ni `errors/` | ✅ | `entrada.ts` y `reglas-de-compra.ts` son módulos puros de `domain/`; los 404/403 siguen en services |
| Services que se apoyan en el dueño de cada entidad | ✅ (mejora) | `CompraService` es el dueño de `Compra` y el único que la busca por código y lanza el 404 de entrada (`obtenerPorCodigoOFallar`); `EntradaService` deja de usar `RepositorioCompras` (R3) |
| Sin ciclos entre services, conectados en orden en `app.ts` | ✅ | Nueva arista `EntradaService → CompraService`; el orden `Vencimiento → Evento → TipoEntrada → Compra → Entrada` no cambia |
| Cada service escribe solo su agregado | ✅ (mejora) | Se elimina la escritura paralela de `EntradaService`; `VencimientoService` queda como excepción documentada (spec, Clarifications) |
| Vistas explícitas (principio V) | ✅ | Las piezas comunes devuelven campos elegidos; los tipos de `shared/` no cambian |
| Contrato de API y OpenAPI | ✅ | Sin cambios (SC-002) |
| App: features, base, conectores, lint de dependencias | ✅ | Las piezas nuevas viven en `features/compras/componentes/` y no se exportan por `index.ts` |
| TDD y verificación durante el desarrollo | ✅ | Tests de dominio por regla antes de reescribir; los de API/pantallas son la red (R10) |
| IX. Simplicidad | ✅ justificado | Dos módulos nuevos en `domain/` y dos componentes en la app; ver "Complexity Tracking" |

**Re-check post-diseño**: sin violaciones nuevas. Los dos archivos nuevos de `domain/` se justifican
abajo; el `import type` de `reglas-de-compra.ts` hacia `compra.ts` se borra al compilar y no forma
un ciclo en tiempo de ejecución (R2).

## Project Structure

### Documentation (this feature)

```text
specs/010-refactor-compras/
├── plan.md              # este archivo
├── research.md          # Phase 0: decisiones R1–R10
├── data-model.md        # Phase 1: Entrada, reglas de Compra, reembolso, services y vistas
├── quickstart.md        # Phase 1: cómo validar que nada cambió
├── contracts/
│   └── interno.md       # Phase 1: contratos externos sin cambios + interfaces internas nuevas
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/src/
├── domain/
│   ├── entrada.ts              # NUEVO: Entrada (codigo, uso, cancelacion), RegistroDeEntrada, motivoNoUsable
│   ├── reglas-de-compra.ts     # NUEVO: REGLAS_DE_COMPRA (una por regla) y sus predicados
│   ├── compra.ts               # Compra (≤ 300 líneas): transiciones, derivados, reembolso; re-exporta Entrada
│   ├── compras-del-evento.ts   # resumenPorTipo usa compra.entradasUsadas
│   ├── hora-buenos-aires.ts    # (opcional) diaDeCalendarioDeBuenosAires
│   └── dias-restantes.ts       # (opcional) sin split
├── services/
│   ├── compra.service.ts       # + obtenerPorCodigoOFallar, + registrarUso
│   ├── entrada.service.ts      # recibe CompraService; sin RepositorioCompras ni cerrojo
│   └── compra.vistas.ts        # piezas comunes; aCompraDelEventoVista recibe el evento
├── seed/datos-ejemplo.ts       # entradas con uso / cancelacion
└── app.ts                      # EntradaService({ compraService, eventoService, usuarioService, reloj })

backend/tests/
├── domain/compra.test.ts, entrada.test.ts (NUEVO), reglas-de-compra.test.ts (NUEVO),
│   compras-del-evento.test.ts, datos-ejemplo.test.ts, (opcional) dias-restantes / hora-buenos-aires
├── services/compra.service.test.ts, entrada.service.test.ts, concurrencia-compras.test.ts
└── helpers/eventos.ts, services-de-eventos.ts   # firmas conservadas

mobile/src/features/compras/
├── mutaciones.ts                         # useRegistrarUso sin evento ni catálogo
├── pantallas/RegistrarIngreso.tsx        # compone las dos piezas
├── componentes/BuscadorDeCodigo.tsx      # NUEVO
├── componentes/ResultadoDeIngreso.tsx    # NUEVO (incluye la acción: motivo o botón)
└── useEnvioUnico.ts                      # (opcional) NUEVO

mobile/tests/pantallas/registrar-ingreso.test.tsx   # solo las aserciones de invalidación (excepción)

AGENTS.md · docs/backlog.md · .specify/memory/constitution.md (PATCH 2.5.2)
```

**Structure Decision**: se respeta la estructura existente (backend en capas, app por features).
Lo nuevo son dos módulos puros en `backend/src/domain/` y dos componentes internos de la feature
`compras` (más un hook opcional).

## Orden de implementación (para `/speckit-tasks`)

Cada fase deja todo en verde y es un commit (AGENTS.md, "Implement por fases"):

1. **Setup**: rama al día, suite completa en verde como línea de base y snapshot de la semilla por
   la API (quickstart §1) para comparar al final.
2. **US1 – una sola "entrada usada"** (punto 1): `resumenPorTipo` usa `compra.entradasUsadas`.
3. **US1 – `Entrada` explícita y reglas una por regla** (punto 3): `entrada.ts` y
   `reglas-de-compra.ts` con sus tests primero; `compra.ts` las usa; semilla, ayudantes de tests y
   tests de dominio/services adaptados sin perder casos (R10).
4. **US1 – `compra.reembolso`** (punto 4): reemplaza a `tieneReembolsoPendiente`; vistas y
   `confirmarReembolso` lo usan.
5. **US2 – vistas compuestas** (punto 5).
6. **US2 – un solo dueño** (punto 6): `CompraService.obtenerPorCodigoOFallar` y `registrarUso`;
   `EntradaService` delega; `app.ts` y `services-de-eventos.ts`.
7. **US3 – app** (puntos 2 y 7): invalidaciones de `useRegistrarUso` (con la excepción del test) y
   "Registrar ingreso" en piezas.
8. **Documentación** (punto 8): AGENTS.md, skills si aplica, constitución PATCH, backlog.
9. **Opcional (US4)**: `useEnvioUnico` y `diasRestantes` sin `split`.

## Complexity Tracking

| Archivo nuevo | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|
| `domain/entrada.ts` (~70 líneas) | La entrada tiene comportamiento propio (`usar`, `cancelar`, `usada`, `estadoPropio`, `motivoNoUsable`) y la 012 la va a leer sola; separarla es lo que baja `compra.ts` de 536 a ≤ 300 (SC-005) | Dejarla en `compra.ts`: no se llega a ≤ 300 sin borrar documentación |
| `domain/reglas-de-compra.ts` (~110 líneas) | Once reglas con nombre, mensaje y predicado propio (FR-009) se leen y prueban una por una; el constructor de `Compra` solo las recorre | Reglas como métodos privados de `Compra`: vuelve a concentrar todo en el mismo archivo |
| `componentes/BuscadorDeCodigo.tsx`, `ResultadoDeIngreso.tsx` | Lo pide FR-019 (piezas con nombre propio, sin ternarios anidados) | Funciones internas en la pantalla: la pantalla sigue de 165+ líneas y mezcla los dos bloques |
| `useEnvioUnico.ts` (opcional) | Deduplica la marca sincrónica de doble envío de dos pantallas (FR-020) | Dejar el `useRef` repetido (es lo que pasa si no se hace la fase opcional) |
