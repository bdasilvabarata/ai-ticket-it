# Implementation Plan: Mis compras

**Branch**: `feature/007-mis-compras` | **Date**: 2026-11-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-mis-compras/spec.md`

## Summary

UC-01: en la pestaña "Mis compras", el usuario actual ve en una sola lista todas sus compras como
comprador, de todos los eventos. Cada fila muestra el estado con texto y color, los días que
faltan si está confirmada, hasta cuándo pagar y "Pagar" si está pendiente, y por qué está
cancelada si lo está. Todo lo calcula el servidor al consultar, con su reloj y en hora de Buenos
Aires.

**Backend** (lectura pura, se apoya en la 006):
- `GET /api/compras` en `compras.routes.ts`, con usuario. Devuelve `MiCompraVista[]` ordenado
  (R1, R5).
- `CompraService.misCompras`:
  - `RepositorioCompras.listarPorComprador` y `compra.alDia(ahora)`, sin cerrojo y sin guardar
    (R2, decidido con el autor);
  - los eventos en lote con `EventoService.obtenerPorIds` (+ `RepositorioEventos.listarPorIds`):
    dos lecturas por pedido (R3).
- Dominio puro: `diasRestantes(fechaHoraEvento, ahora)` (días de calendario con
  `horaDeBuenosAires`, R4) y `compararMisCompras` (R5). El `ahora` lo da el `Reloj` inyectado en
  el service.
- `MiCompraVista` en `shared/` = `CompraVista` sin `compradorId` ni `historial`, más
  `diasRestantes` y `canceladaPor`. `compra.vistas.ts` comparte los campos comunes con
  `aCompraVista` (R6). Se documenta en el contrato, OpenAPI y Postman.

**Mobile** (todo en `features/compras`, salvo la API, la clave y la ruta):
- `MisCompras` con `SegunConsulta` y `FilaMiCompra`; `(tabs)/mis-compras` pasa a ser un
  re-export (R10).
- `useMisCompras` con `claves.misCompras(usuarioId)`; las tres mutations de la 006 la invalidan
  (R7).
- La lista se vuelve a pedir al enfocar la pestaña (`useFocusEffect`, R8) y al llegar la hora
  límite más próxima (`useRefrescarAlVencer` y la función pura `esperaHastaElProximoVencimiento`,
  R9). La app nunca decide que una compra venció.
- Textos en `formato.ts`: `textoDiasRestantes`, `textoAvisoDeMiCompra` y `textoAccionDePago`. El
  estado lo muestra `EtiquetaEstadoCompra`, sin cambios.

Las decisiones están en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript strict (`~6.0`) en los tres paquetes; Node ≥ 22.12

**Primary Dependencies**:
- Backend: Express 5 y zod 4.
- Mobile: Expo SDK 58, Expo Router (`useFocusEffect`) y TanStack Query v5.
- **Sin dependencias nuevas.**

**Storage**: repositorios en memoria (`Map` privado). `CompraRepository` y `EventoRepository`
suman un método de lectura cada uno.

**Testing**:
- Backend: Vitest y supertest: domain (días restantes, orden), repositories, services (reloj fijo
  y movible, repositorios espiados para contar lecturas) y api.
- Mobile: Jest, jest-expo y RNTL con `renderConDependencias`, `porRuta` y timers falsos.

**Target Platform**: servidor Node local; Android con Expo Go (compatible con iOS)

**Project Type**: mobile-app con API (monorepo `backend/`, `shared/`, `mobile/`)

**Performance Goals**: SC-007, es decir, una consulta de la app, y el servidor hace dos lecturas
(compras y eventos) con cualquier cantidad de compras.

**Constraints**:
- El servidor decide el estado al día, los días restantes, "realizado" y el motivo de la
  cancelación con su reloj. La app solo arma textos.
- La lectura no toma el cerrojo ni guarda nada (006, R3 y R8).
- Pantalla usable a 360 px; nunca se muestran compras de otro usuario.
- Los contratos de la 006 no cambian: la salida de `aCompraVista` es la misma.

**Scale/Scope**:
- Backend: 1 endpoint nuevo, 1 vista compartida, 2 módulos puros del dominio, 2 métodos de
  repositorio y 2 de service.
- Mobile: 1 pantalla, 1 componente, 2 hooks, 1 módulo puro, 3 textos nuevos y 3 mutations
  ampliadas.
- Unos 12 archivos de test nuevos o ampliados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple el plan | Estado |
|---|---|---|
| Dominio · Días restantes | Se calculan al consultar (`diasRestantes` con el `ahora` del pedido), no se persisten, en `America/Argentina/Buenos_Aires` vía `hora-buenos-aires.ts` (R4) | ✅ |
| Dominio · Estados | No cambia la máquina de estados; la lista muestra el estado al día con `Compra.alDia` (R2) | ✅ |
| Dominio · Operaciones atómicas | La lista es una lectura: sin cerrojo y sin guardar, como las lecturas de la 006 | ✅ |
| I. Spec-Driven | Spec con 5 clarificaciones. Plan → tasks → implement. Backlog: 007 → `plan` | ✅ |
| II. Test-First | Cada regla tiene su test y su borde (R11, SC-008); TDD con stub de firma real en cada tarea (AGENTS.md) | ✅ |
| III. Capas | `domain/` puro (sin reloj ni Express). `CompraService` es dueño de `Compra` y le pide los eventos en lote al dueño (`EventoService.obtenerPorIds`, sin N+1 ni ciclos, porque la dependencia ya existe). Controller sin reglas. `listarPorComprador` y `listarPorIds` siguen la convención de nombres | ✅ |
| IV. Persistencia en memoria | Filtros sobre el `Map` de cada repositorio, sin estado global | ✅ |
| V. Contrato de API | `GET /api/compras` en plural, formato de error único (401), `contracts/api.md`, OpenAPI con su test de cobertura y Postman | ✅ |
| VI. Identidad simulada | El comprador es el usuario de `X-Usuario-Id`; solo sus compras. Vista explícita sin historial ni comprador (FR-005) | ✅ |
| VII. App Mobile | `fetch` solo en `src/api/compras.ts`; cuatro estados con `SegunConsulta`; estado con texto y color con el único componente (`EtiquetaEstadoCompra`); accesibilidad (label de la fila y de "Pagar"); 360 px; sin dependencias | ✅ |
| VIII. Tipos compartidos | `MiCompraVista` en `shared/src/compra.ts`, derivada de `CompraVista` | ✅ |
| IX. Calidad | `strict`, las cuatro verificaciones y el CI. Ninguna abstracción nueva que no pida la spec (YAGNI): `VencimientoService` no se toca (R2) | ✅ |

**Gate**: pasa sin violaciones.

**Post-design re-check (Phase 1)**: el diseño no agrega violaciones. Al cerrar la
implementación se registra en AGENTS.md:
- en el recurso `compras`, `GET /compras` (las del usuario actual, al día, ordenadas);
- `listarPorComprador` y `EventoService.obtenerPorIds` / `RepositorioEventos.listarPorIds`;
- los módulos `domain/dias-restantes.ts` y `domain/orden-mis-compras.ts`;
- en mobile, la clave `misCompras`, la pantalla `MisCompras` y el refresco por foco y por
  vencimiento.

Detalles que el plan fija y la spec dejó abiertos:
- la ruta y la forma de la respuesta (un arreglo, R1);
- `canceladaPor` derivado de `fueVencida()` (R6);
- la espera mínima de 5 s y el margen de 1 s del refresco por vencimiento (R9);
- que "Confirmar" (gratis) sale de `textoAccionDePago`, compartida con "Tu compra" (R10).

**Decisión consultada con el autor**: el input del plan pedía resolver la lectura al día con
`VencimientoService`. Eso choca con el código de la 006, donde una compra al día es
`Compra.alDia` y `VencimientoService` solo maneja cupo y materialización. El autor eligió
`Compra.alDia` (R2).

## Project Structure

### Documentation (this feature)

```text
specs/007-mis-compras/
├── plan.md              # este archivo
├── research.md          # Phase 0 (R1–R11)
├── data-model.md        # Phase 1: vista, dominio, repositorios, services, estado de la app
├── quickstart.md        # Phase 1: calidad, pedidos directos y recorrido de la demo
├── contracts/
│   ├── api.md           # GET /api/compras y MiCompraVista
│   └── app.md           # ruta, hooks, pantalla, fila y textos
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
shared/src/
└── compra.ts                          # + MiCompraVista

backend/src/
├── domain/
│   ├── dias-restantes.ts              # diasRestantes (nuevo, puro)
│   ├── orden-mis-compras.ts           # OrdenableMiCompra, compararMisCompras (nuevo, puro)
│   └── repositorios.ts                # + RepositorioCompras.listarPorComprador, RepositorioEventos.listarPorIds
├── repositories/
│   ├── compra.repository.ts           # + listarPorComprador
│   └── evento.repository.ts           # + listarPorIds
├── services/
│   ├── compra.service.ts              # + misCompras
│   ├── compra.vistas.ts               # datosComunes (privada), aMiCompraVista; aCompraVista igual
│   └── evento.service.ts              # + obtenerPorIds
├── controllers/compra.controller.ts   # + misCompras
├── routes/compras.routes.ts           # + GET /
├── docs/openapi.json                  # + /compras get, MiCompraVista
└── docs/ai-ticket-it.postman_collection.json  # + "Mis compras"

backend/tests/
├── domain/{dias-restantes,orden-mis-compras}.test.ts   # nuevos
├── repositories/{compra,evento}.repository.test.ts     # + métodos nuevos
├── services/{compra,evento}.service.test.ts            # + misCompras, obtenerPorIds
└── api/compras.test.ts                                 # + GET /compras

mobile/
├── app/(tabs)/mis-compras.tsx         # re-export de MisCompras
├── src/
│   ├── api/compras.ts                 # + obtenerMisCompras (+ index.ts)
│   ├── consultas/claves.ts            # + misCompras
│   └── features/compras/
│       ├── pantallas/MisCompras.tsx   # nueva
│       ├── componentes/FilaMiCompra.tsx  # nuevo
│       ├── pantallas/Compra.tsx       # usa textoAccionDePago
│       ├── useMisCompras.ts · useRefrescarAlVencer.ts  # nuevos
│       ├── vencimientos.ts            # esperaHastaElProximoVencimiento (nuevo, puro)
│       ├── formato.ts                 # + textoDiasRestantes, textoAvisoDeMiCompra, textoAccionDePago
│       ├── mutaciones.ts              # + invalidar claves.misCompras
│       └── index.ts                   # + MisCompras
└── tests/
    ├── api/compras.test.ts                          # + obtenerMisCompras
    ├── features/compras/{formato,vencimientos}.test.ts  # + / nuevo
    ├── pantallas/mis-compras.test.tsx               # nuevo
    └── helpers/{compras.ts,render-con-dependencias.tsx}  # fixture miCompra; GET /compras → [] por defecto

docs/backlog.md                        # 007 → plan → … → en PR
AGENTS.md                              # al cerrar (ver re-check)
```

**Structure Decision**: la estructura de la 001 a la 006 (backend en capas; mobile con base,
features y conectores), sin carpetas nuevas:
- los días y el orden son módulos puros de `domain/`, como `busqueda.ts` y `orden-catalogo.ts`;
- toda la pantalla vive en la feature `compras`;
- fuera de ella solo cambian la función de API, la clave y la ruta de `app/`, que son los lugares
  que la arquitectura fija para eso.

## Complexity Tracking

Sin violaciones de la constitución ni piezas nuevas que justificar: la feature reusa la `Compra`,
las vistas, las mutations y `EtiquetaEstadoCompra` de la 006, y suma lecturas y funciones puras.
