# Implementation Plan: Compras de un evento

**Branch**: `feature/008-compras-de-evento` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-compras-de-evento/spec.md`

## Summary

UC-02 y la transición `CONFIRMADA → UTILIZADA`. El organizador abre "Compras del evento" desde su
evento y ve todas las compras (comprador, tipo, cantidad, total, fecha y estado con texto y color),
la disponibilidad por tipo (disponibles, pendientes, vendidas y usadas) y la ventana de uso. Cada
compra tiene una **entrada por unidad** con su **código**, que solo ve el comprador. El organizador
ingresa el código, ve de quién es y confirma: esa entrada pasa a `UTILIZADA`, y con la primera,
también la compra. Todo lo decide el servidor con su reloj, al día y bajo el cerrojo del evento.

**Backend**:

- **Dominio**:
  - `Entrada` dentro del agregado `Compra`: el código y sus cambios propios; su estado se deriva
    del de la compra hasta la confirmación (R1).
  - `Compra.registrarUso`, y `esVigente` suma `UTILIZADA` (R9).
  - Módulos puros `codigo-de-entrada.ts` (R2), `ventana-de-uso.ts` (−4 h / +12 h inclusive, R8)
    y `compras-del-evento.ts` (resumen y orden, R7).
- **Repositorio**: `RepositorioCompras` suma `listarPorEvento`, `buscarPorCodigoDeEntrada` y
  `siguientesCodigosDeEntrada`: los códigos los da el repositorio (R2).
- **Services**:
  - `EventoService.leerDelOrganizador`: 404 → 403 → cupo al día sin guardar (R6).
  - `CompraService.comprasDelEvento`: lectura con cuatro lecturas fijas y compradores en lote
    (R6).
  - `EntradaService` nuevo, como `TipoEntradaService`: `obtener` (lectura) y `registrarUso` (bajo
    el cerrojo, materializa, relee, ventana → estado, un solo `guardar`; R4, R10).
- **API**: `GET /eventos/:id/compras`, `GET /eventos/:id/entradas/:codigo` y
  `POST /eventos/:id/entradas/:codigo/uso` (R3, R5). `CompraVista` suma `entradas` y
  `entradasUsadas`; `MiCompraVista`, `entradasUsadas` (R11). OpenAPI y Postman.
- **Seed**: el evento "Peña en La Rueda" (Lucía), con la ventana abierta al arrancar y dos compras,
  una ya `UTILIZADA` (R12).

**Mobile** (feature `compras`; `eventos` solo suma el botón que navega por ruta):

- `ComprasDelEvento` (`eventos/[eventoId]/compras`): ventana, resumen con "Agotado", lista con el
  aviso de cada estado y refetch por foco.
- `RegistrarIngreso` (`eventos/[eventoId]/ingreso`): buscar el código, ver la tarjeta, ver el
  motivo si no se puede usar y confirmar con `Alert`. La mutation sin reintentos invalida las
  vistas del organizador y del comprador (R13).
- Comprador: `ListaDeEntradas` con los códigos en "Tu compra" y "Ver mis entradas", y "N de M
  entradas usadas" también en "Mis compras" (R14).

Las decisiones están en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript strict (`~6.0`) en los tres paquetes; Node ≥ 22.12

**Primary Dependencies**:
- Backend: Express 5 y zod 4; `node:crypto` (`randomInt`) para los códigos.
- Mobile: Expo SDK 58, Expo Router (`useFocusEffect`, rutas tipadas) y TanStack Query v5.
- **Sin dependencias nuevas.**

**Storage**: repositorios en memoria (`Map` privado). `CompraRepository` suma tres métodos; las
entradas viajan dentro de cada `Compra` guardada.

**Testing**:
- Backend: Vitest y supertest: domain (bordes de la ventana, estado derivado, invariantes),
  repositories, services (reloj fijo y movible, repositorios espiados), concurrencia y api.
- Mobile: Jest, jest-expo y RNTL con `renderConDependencias` y `porRuta`.

**Target Platform**: servidor Node local; Android con Expo Go (compatible con iOS)

**Project Type**: mobile-app con API (monorepo `backend/`, `shared/`, `mobile/`)

**Performance Goals**:
- "Compras del evento": una consulta de la app y cuatro lecturas fijas en el servidor (FR-002).
- Registrar un uso: dos pedidos (buscar y usar), en menos de 15 s con el comprador delante
  (SC-004).

**Constraints**:
- El servidor decide el estado al día, la ventana (`antes` · `abierta` · `despues`) y si una
  entrada se puede usar; la app solo arma textos.
- La lectura no toma el cerrojo ni guarda. El uso corre bajo el cerrojo del evento y relee todo
  adentro.
- Los códigos solo llegan en las vistas del comprador.
- 360 px; nunca se muestran datos de otro usuario.
- Los contratos de la 006 y la 007 solo crecen (campos nuevos). Excepción: `confirmadas` de
  `mis-compras` ahora incluye las `UTILIZADA`.

**Scale/Scope**:
- Backend:
  - 3 endpoints y 1 service nuevo (`EntradaService`, con su controller y router hijo).
  - 3 módulos puros y 1 entidad (`Entrada`).
  - 3 métodos de repositorio, 2 métodos de service y 1 error.
  - 6 vistas compartidas nuevas y 2 ampliadas.
- Mobile:
  - 2 pantallas, 2 rutas, 4 componentes (`ResumenPorTipo`, `FilaCompraDelEvento`,
    `TarjetaEntrada`, `ListaDeEntradas`), 3 hooks y 3 funciones de API.
  - ~9 textos nuevos.
  - Cambios en "Tu compra", "Ver mis entradas", "Mis compras" y la pantalla del evento propio.
- Unos 20 archivos de test nuevos o ampliados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple el plan | Estado |
|---|---|---|
| Dominio · Entidades | Suma **Entrada** dentro de `Compra` (R1). La constitución no la lista: **enmienda MINOR 2.5.0** con `/speckit-constitution` como primera tarea (R15) | ⚠️ → enmienda |
| Dominio · Estados | `CONFIRMADA → UTILIZADA` con la primera entrada usada, con su `CambioEstadoCompra` (autor el organizador, hora del servidor). `UTILIZADA` no tiene transición a `CANCELADA` (R9) | ✅ |
| Dominio · Cancelación | Una `UTILIZADA` nunca se cancela: `cancelar` solo acepta `PENDIENTE`, con un test que lo cubre (FR-020) | ✅ |
| Dominio · Cupo | Usar no consume ni devuelve cupo (FR-009). La lectura muestra el cupo al día, el mismo del detalle (SC-003) | ✅ |
| Dominio · Operaciones atómicas | `registrarUso` corre bajo el cerrojo del evento: `ahora` adentro, materializa, relee la compra y verifica antes de guardar. Libera en `finally` y no anida. La lectura no lo usa (R10) | ✅ |
| I. Spec-Driven | Spec con 4 clarificaciones; plan → tasks → implement. Backlog: 008 → `plan` | ✅ |
| II. Test-First | Cada regla tiene su test y su borde: 4 h y 12 h exactas, 1 min afuera, cada estado inválido, N usos simultáneos (R16). TDD con stub de firma real | ✅ |
| III. Capas | `domain/` puro: ventana, código y resumen reciben `ahora` o datos. `EntradaService` escribe solo `Compra` (su agregado) y le pide el evento a `EventoService` y los compradores a `UsuarioService`, en lote y sin ciclos. Los ids y códigos los da el repositorio. Controllers sin reglas; 404/403 en `errors/` y 409 en el dominio | ✅ |
| IV. Persistencia en memoria | Las entradas viven en la `Compra` guardada en el `Map`; la búsqueda por código no expone la colección | ✅ |
| V. Contrato de API | Recursos plurales en kebab-case (`compras`, `entradas`, `uso`) y formato de error único con el orden documentado (R5). `contracts/api.md`, OpenAPI con su test de cobertura y Postman | ✅ |
| VI. Identidad simulada | Solo el organizador ve las compras y registra usos (403 aunque sea comprador). Los códigos solo los ve el comprador. Vistas explícitas | ✅ |
| VII. App Mobile | `fetch` solo en `src/api/`; cuatro estados con `SegunConsulta`; el estado de compra y de entrada con el único `EtiquetaEstadoCompra`; "Agotado" con texto; accesibilidad (labels de fila y código); 360 px | ✅ |
| VIII. Tipos compartidos | Las vistas nuevas en `shared/src/compra.ts`; vocabulario del dominio (`Entrada`, `codigo`, `uso`) | ✅ |
| IX. Calidad | `strict`, las cuatro verificaciones y el CI. Sin abstracciones de más: no hay repositorio de entradas ni índice por código (YAGNI, R1, data-model) | ✅ |

**Gate**: pasa con la enmienda MINOR de "Entidades" (R15). La pidió la spec (Assumptions), no
contradice ninguna regla y se hace antes del código.

**Post-design re-check (Phase 1)**: el diseño no agrega violaciones. Al cerrar la implementación se
registra en AGENTS.md:
- en el recurso `compras`, `GET /eventos/:id/compras` (organizador), y el recurso `entradas`
  (router hijo, `EntradaService`, orden de chequeos del uso);
- la `Entrada` en el agregado `Compra` y los tres módulos puros;
- `leerDelOrganizador` y los tres métodos del repositorio;
- en mobile, las dos pantallas, las claves `comprasDelEvento` y `entradaDelEvento`, y las
  invalidaciones por prefijo de `useRegistrarUso`;
- el evento del seed con la ventana abierta.

**Detalles que el plan fija y la spec dejó abiertos**:
- las rutas y la separación de "Registrar ingreso" en su propia pantalla (R3, R13);
- el formato del código: 8 caracteres Crockford, mostrado `XXXX-XXXX` (R2);
- `FUERA_DE_HORARIO_DE_USO` va antes que `TRANSICION_INVALIDA` (R5);
- el seed de la Peña (R12);
- `esVigente` y `confirmadas` incluyen `UTILIZADA` (R9).

## Project Structure

### Documentation (this feature)

```text
specs/008-compras-de-evento/
├── plan.md              # este archivo
├── research.md          # Phase 0 (R1–R16)
├── data-model.md        # Phase 1: Entrada, Compra, módulos, repositorio, services, vistas, seed, app
├── quickstart.md        # Phase 1: calidad, pedidos directos y recorrido de la demo
├── contracts/
│   ├── api.md           # 3 endpoints y cambios en CompraVista / MiCompraVista
│   └── app.md           # rutas, hooks, pantallas, textos y cambios del comprador
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
.specify/memory/constitution.md              # 2.5.0: Entrada en "Entidades" (R15)

shared/src/compra.ts                         # + EntradaVista, VentanaDeUsoVista, CompradorVista,
                                             #   ResumenTipoEntradaVista, CompraDelEventoVista,
                                             #   ComprasDelEventoVista, EntradaDelEventoVista;
                                             #   CompraVista + entradas/entradasUsadas; MiCompraVista

backend/src/
├── domain/
│   ├── compra.ts                            # + Entrada, entradas, registrarUso, esVigente con UTILIZADA
│   ├── codigo-de-entrada.ts                 # nuevo, puro
│   ├── ventana-de-uso.ts                    # nuevo, puro
│   ├── compras-del-evento.ts                # nuevo, puro (resumen y orden)
│   └── repositorios.ts                      # + listarPorEvento, buscarPorCodigoDeEntrada, siguientesCodigosDeEntrada
├── repositories/compra.repository.ts        # + los tres métodos
├── errors/index.ts                          # + EntradaNoEncontradaError
├── middlewares/traducir-error.ts            # + EntradaNoEncontradaError → 404
├── services/
│   ├── evento.service.ts                    # + leerDelOrganizador
│   ├── compra.service.ts                    # + usuarioService, códigos en crear, comprasDelEvento; confirmadas + UTILIZADA
│   ├── entrada.service.ts                   # nuevo
│   └── compra.vistas.ts                     # + vistas de entrada, ventana y compras del evento
├── controllers/
│   ├── compra.controller.ts                 # + comprasDelEvento
│   └── entrada.controller.ts                # nuevo
├── validations/
│   ├── compra.validation.ts                 # sin cambios: GET /:eventoId/compras reusa comprasDelEvento (params)
│   └── entrada.validation.ts                # nuevo (eventoId + codigo)
├── routes/eventos.routes.ts                 # + GET /:eventoId/compras, router hijo /:eventoId/entradas
├── app.ts                                   # + EntradaService, EntradaController; UsuarioService a CompraService
├── seed/datos-ejemplo.ts                    # + Peña en La Rueda y sus compras; entradas con códigos fijos
├── docs/openapi.json                        # + 3 rutas y esquemas
└── docs/ai-ticket-it.postman_collection.json  # + "Compras del evento"

backend/tests/
├── domain/{codigo-de-entrada,ventana-de-uso,compras-del-evento}.test.ts   # nuevos
├── domain/{compra,datos-ejemplo,tope-por-persona}.test.ts                 # + entradas, uso, UTILIZADA
├── repositories/{compra.repository,repositorios-de-ejemplo}.test.ts       # + métodos nuevos, seed
├── services/{compra,evento,entrada}.service.test.ts                       # + / nuevo
├── services/concurrencia-compras.test.ts                                  # + usos simultáneos
├── api/{compras,entradas,eventos}.test.ts                                 # + / nuevo; conteos del seed
└── helpers/                                                               # fábrica de compras con entradas

mobile/
├── app/eventos/[eventoId]/{compras,ingreso}.tsx   # re-exports
├── src/
│   ├── api/compras.ts                       # + obtenerComprasDelEvento, obtenerEntradaDelEvento, registrarUsoDeEntrada
│   ├── consultas/claves.ts                  # + comprasDelEvento, entradaDelEvento
│   └── features/
│       ├── compras/
│       │   ├── pantallas/{ComprasDelEvento,RegistrarIngreso}.tsx           # nuevas
│       │   ├── pantallas/{Compra,MisEntradasDelEvento}.tsx                 # entradas, UTILIZADA
│       │   ├── componentes/{ResumenPorTipo,FilaCompraDelEvento,TarjetaEntrada,ListaDeEntradas}.tsx  # nuevos
│       │   ├── componentes/{FilaCompraConfirmada,FilaMiCompra,AccesoMisEntradas}.tsx  # UTILIZADA
│       │   ├── useComprasDelEvento.ts · useEntradaDelEvento.ts             # nuevos
│       │   ├── mutaciones.ts                # + useRegistrarUso
│       │   ├── formato.ts                   # + textos de la 008
│       │   └── index.ts                     # + ComprasDelEvento, RegistrarIngreso
│       └── eventos/pantallas/{EditarEvento,VerEventoRealizado}.tsx         # + "Ver compras"
└── tests/
    ├── api/compras.test.ts
    ├── features/compras/formato.test.ts
    ├── pantallas/{compras-del-evento,registrar-ingreso}.test.tsx           # nuevos
    ├── pantallas/{compra,mis-entradas,mis-compras,evento-del-organizador}.test.tsx  # + casos
    └── helpers/                             # fixtures nuevas; CompraVista con entradas

docs/backlog.md                              # 008 → plan → … → en PR
AGENTS.md                                    # al cerrar (ver re-check)
```

**Structure Decision**: la de la 001 a la 007, sin carpetas nuevas:
- backend en capas, con `Entrada` dentro del agregado `Compra` y su service, controller y router
  hijo, como `TipoEntrada`;
- mobile con base, features y conectores; las pantallas nuevas viven en `compras`;
- `eventos` solo navega por ruta, para no formar un ciclo.

## Complexity Tracking

| Pieza | Por qué hace falta | Alternativa más simple descartada porque |
|---|---|---|
| Entidad `Entrada` (enmienda MINOR de la constitución) | El clarify decidió el uso por entrada con código propio (FR-012) | Usar la compra entera dejaría "2 de 4 entradas usadas" sin representar y obligaría a usar todas las entradas juntas |
| `EntradaService` nuevo | Las reglas de la ventana, la búsqueda por código y el uso son un caso de uso propio, como `TipoEntradaService` | Sumarlo a `CompraService` le daría diez casos de uso y mezclaría el rol del comprador con el del organizador |
