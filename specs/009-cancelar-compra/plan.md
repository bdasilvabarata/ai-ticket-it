# Implementation Plan: Cancelar compra con reembolso

**Branch**: `feature/009-cancelar-compra` | **Date**: 2026-11-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-cancelar-compra/spec.md`

## Summary

UC-07 y UC-08: la transición `CONFIRMADA → CANCELADA → REEMBOLSADA`. El comprador cancela desde
"Tu compra" una compra `CONFIRMADA` propia, sin entradas usadas, antes del inicio del evento: la
compra pasa a `CANCELADA`, cada entrada queda `CANCELADA` (ya no sirve en "Registrar ingreso"), el
cupo vuelve y el tope se libera. Si es paga, queda con el **reembolso pendiente**, que el
organizador confirma desde "Compras del evento" y la pasa a `REEMBOLSADA`, sin plazo. El servidor
decide, al día y con su reloj, si una compra se puede cancelar y por qué no; todo bajo el cerrojo
del evento.

**Backend**:

- **Dominio** (`domain/compra.ts`):
  - `Compra.cancelar(usuarioId, ahora, inicioDelEvento)` acepta también una `CONFIRMADA` y decide
    con `motivoNoCancelable` (R1, R6).
  - Cada `Entrada` suma su cambio propio a `CANCELADA` al cancelar una confirmada (R3).
  - El reembolso pendiente y `canceladaDesde` se **derivan del historial**, sin campos nuevos (R4).
  - `Compra.confirmarReembolso(organizadorId, ahora)` es nuevo (R5).
- **Services**:
  - `CompraService.cancelar` no cambia de forma (R2).
  - `CompraService.confirmarReembolso` es nuevo, bajo el cerrojo del evento y con
    `obtenerDelOrganizador` (R5).
- **API**:
  - `POST /compras/:compraId/cancelacion` se amplía.
  - `POST /compras/:compraId/reembolso` es nuevo y responde `CompraDelEventoVista`.
  - Las vistas suman `canceladaDesde`, `reembolso` y, en `CompraVista`, `cancelable` y
    `motivoNoCancelable` (R7).
  - OpenAPI y Postman.
- **Seed**: dos compras en "Maratón Ciudad 10K" (Lucía): Diego con el reembolso pendiente y
  Valentina con la compra `REEMBOLSADA` (R11).

**Mobile** (feature `compras`):

- "Tu compra": "Cancelar compra" o el motivo en una `CONFIRMADA`/`UTILIZADA`, con un `Alert` que
  dice el monto. Avisos de cancelada (con o sin reembolso) y reembolsada (R8).
- "Mis compras": los avisos nuevos, sin botón (R9).
- "Compras del evento": aviso de reembolso pendiente y el botón "Confirmar reembolso", que va
  aparte de la fila, con su `Alert` (R9).
- `useConfirmarReembolso` es nueva y `useCancelarCompra` suma las vistas del organizador a sus
  invalidaciones (R10).

**Constitución**: enmienda **PATCH 2.5.1** en "Roles" y en el principio VI: el organizador confirma
los reembolsos de las compras de sus eventos (R12).

Las decisiones están en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript strict (`~6.0`) en los tres paquetes; Node ≥ 22.12

**Primary Dependencies**:
- Backend: Express 5 y zod 4.
- Mobile: Expo SDK 58, Expo Router y TanStack Query v5.
- **Sin dependencias nuevas.**

**Storage**: repositorios en memoria (`Map` privado). Sin métodos ni campos nuevos: cancelar y
reembolsar son un `guardar` de la compra (con sus entradas); el cupo vuelve con
`TipoEntradaService.devolverCupo`.

**Testing**:
- Backend: Vitest y supertest, en domain (bordes de hora, estados, invariantes), services (reloj
  fijo, repositorios espiados para el orden de guardado), concurrencia y api.
- Mobile: Jest, jest-expo y RNTL con `renderConDependencias` y `porRuta`.

**Target Platform**: servidor Node local; Android con Expo Go (compatible con iOS)

**Project Type**: mobile-app con API (monorepo `backend/`, `shared/`, `mobile/`)

**Performance Goals**:
- Cancelar: 2 toques desde "Tu compra" (SC-001).
- Confirmar el reembolso: 2 toques (SC-002).
- Un pedido por acción. Las lecturas siguen con las mismas lecturas fijas de la 006 a la 008.

**Constraints**:
- El servidor decide si se puede cancelar (y por qué no) y si hay reembolso por confirmar; la app
  solo arma textos (SC-007).
- "Empezó" significa `ahora >= fechaHora`, inclusive.
- Las escrituras corren bajo el cerrojo del evento y releen reloj, evento y compra adentro. Al
  cancelar se guarda primero la compra y después el evento.
- Las lecturas siguen al día y sin guardar.
- Los contratos de la 006 a la 008 solo crecen. `canceladaPor` también llega en `REEMBOLSADA`
  (antes `null`), y ninguna pantalla lo leía ahí.
- 360 px; nunca se muestran datos de otro usuario.

**Scale/Scope**:
- Backend:
  - 1 endpoint nuevo y 1 ampliado.
  - 1 método de service nuevo y 1 método de dominio nuevo; `cancelar` y `estadoEn` cambian.
  - 2 invariantes ampliadas, 2 tipos compartidos nuevos y 3 vistas ampliadas.
  - 2 compras de seed.
- Mobile:
  - 1 función de API y 1 mutation nuevas; 1 mutation ampliada.
  - 3 pantallas o componentes cambiados (`Compra`, `FilaCompraDelEvento` y `ComprasDelEvento`) y
    ~8 textos.
- Unos 12 archivos de test nuevos o ampliados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple el plan | Estado |
|---|---|---|
| Dominio · Roles | El organizador confirma reembolsos, que hoy no figura entre sus acciones. **Enmienda PATCH 2.5.1** con `/speckit-constitution` como primera tarea (R12) | ⚠️ → enmienda |
| Dominio · Estados | Solo se suman `CONFIRMADA → CANCELADA` (comprador) y `CANCELADA → REEMBOLSADA` (organizador), cada una con su `CambioEstadoCompra` (quién y la hora del servidor). La invariante de historial impide un `REEMBOLSADA` que no venga de una confirmada paga (R4) | ✅ |
| Dominio · Estado de una entrada | Desde `CONFIRMADA`, cada entrada registra su propio cambio a `CANCELADA`. El reembolso no la cambia (R3) | ✅ |
| Dominio · Cancelación | Una `CONFIRMADA` no se cancela desde el inicio, inclusive (`EVENTO_REALIZADO`). Una `UTILIZADA` no se cancela nunca, y la `PENDIENTE` sigue igual. El cupo vuelve al cancelar (R1, R2) | ✅ |
| Dominio · Cupo | `devolverCupo` devuelve exactamente `cantidad`, una sola vez, bajo el cerrojo. Reembolsar no toca el cupo | ✅ |
| Dominio · Operaciones atómicas | Cancelar y reembolsar toman el cerrojo del evento y releen `ahora`, el evento (materializado) y la compra adentro. El cerrojo se libera en `finally`, sin anidar. Uso ‖ cancelación se serializan (US4) | ✅ |
| I. Spec-Driven | La spec tiene 5 clarificaciones; sigue plan → tasks → implement. Backlog: 009 → `plan` | ✅ |
| II. Test-First | Cada regla con su borde: hora exacta y −1 min, cada estado no cancelable con el evento empezado o no, la gratis, el doble reembolso y N carreras (R13). TDD con stub de firma real | ✅ |
| III. Capas | `domain/` sigue puro (recibe `ahora` e `inicioDelEvento`). `CompraService` escribe solo su agregado; el cupo lo devuelve `TipoEntradaService`, el 403 y la materialización vienen de `EventoService` y el comprador de `UsuarioService`, sin ciclos. Los 404/403 salen de `errors/` y los 409 del dominio | ✅ |
| IV. Persistencia en memoria | Sin estructuras nuevas; el reembolso pendiente se deriva, no se guarda | ✅ |
| V. Contrato de API | El sub-recurso `reembolso` sigue el patrón de `pago`, `cancelacion` y `uso`. Formato de error único y orden documentado (contracts/api.md). Se actualizan OpenAPI (con su test de cobertura) y Postman | ✅ |
| VI. Identidad simulada | Solo el comprador cancela (403 al organizador) y solo el organizador reembolsa (403 al comprador). Vistas explícitas, sin códigos para el organizador. La enmienda PATCH lo hace explícito (R12) | ✅ |
| VII. App Mobile | `fetch` solo en `src/api/`. Los cuatro estados siguen con `SegunConsulta`. El estado se muestra con `EtiquetaEstadoCompra` y los avisos al lado. Hay botones con texto, el botón va aparte de la fila y entra en 360 px | ✅ |
| VIII. Tipos compartidos | `MotivoNoCancelable` y `ReembolsoVista` van en `shared/src/compra.ts`, con vocabulario del dominio (`reembolso`, `cancelable`) | ✅ |
| IX. Calidad | `strict`, las cuatro verificaciones y el CI. Sin campos guardados, services ni contadores de más (R4, R5, R7: YAGNI) | ✅ |

**Gate**: pasa con la enmienda PATCH de "Roles" y del principio VI (R12). No es una violación,
porque la constitución permite que una spec refine las condiciones del reembolso. Es una aclaración
para que el principio VI no lea "el organizador solo ve las compras" como una prohibición.

**Re-check post-diseño**: los artefactos de la fase 1 (data-model, contracts y quickstart) no suman
nada que cambie la tabla. La tabla de complejidad queda vacía.

## Project Structure

### Documentation (this feature)

```text
specs/009-cancelar-compra/
├── spec.md
├── plan.md              # este archivo
├── research.md          # R1–R13
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md           # cancelación ampliada, reembolso nuevo, vistas
│   └── app.md           # pantallas, mutations, textos
├── checklists/
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
.specify/memory/constitution.md              # PATCH 2.5.1: Roles y principio VI (R12)

shared/src/compra.ts                         # MotivoNoCancelable, ReembolsoVista y campos nuevos

backend/src/
├── domain/compra.ts                         # cancelar (confirmada), motivoNoCancelable,
│                                            # confirmarReembolso, tieneReembolsoPendiente,
│                                            # canceladaDesde, Entrada.cancelar, estadoEn, invariantes
├── services/compra.service.ts               # cancelar (pasa inicioDelEvento), confirmarReembolso
├── services/compra.vistas.ts                # canceladaDesde, reembolso, cancelable, canceladaPor
├── controllers/compra.controller.ts         # confirmarReembolso
├── routes/compras.routes.ts                 # POST /:compraId/reembolso
├── seed/datos-ejemplo.ts                    # compras de Diego y Valentina en el Maratón
└── docs/{openapi.json, ai-ticket-it.postman_collection.json}

backend/tests/
├── domain/{compra, datos-ejemplo}.test.ts
├── repositories/repositorios-de-ejemplo.test.ts
├── services/{compra.service, concurrencia-compras}.test.ts
└── api/{compras, entradas, docs}.test.ts

mobile/src/
├── api/compras.ts                           # confirmarReembolso
└── features/compras/
    ├── mutaciones.ts                        # useConfirmarReembolso; useCancelarCompra amplía invalidaciones
    ├── formato.ts                           # motivos, avisos y textos de confirmación
    ├── pantallas/Compra.tsx                 # Cancelación de una confirmada
    ├── pantallas/ComprasDelEvento.tsx       # una mutation para todas las filas
    └── componentes/FilaCompraDelEvento.tsx  # "Confirmar reembolso" aparte de la fila

mobile/tests/
├── api/compras.test.ts
├── features/compras/formato.test.ts
├── helpers/compras.ts                       # vistas de ejemplo con los campos nuevos
└── pantallas/{compra, mis-compras, compras-del-evento}.test.tsx

AGENTS.md · docs/backlog.md                  # al cerrar la feature
```

**Structure Decision**: la del monorepo actual. No hay carpetas, rutas de `app/` ni services
nuevos. Todo entra en el agregado `Compra` y la feature `compras` de mobile.

## Complexity Tracking

Sin violaciones que justificar.
