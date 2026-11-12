# Implementation Plan: Comprar entradas

**Branch**: `feature/006-comprar-entradas` | **Date**: 2026-11-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-comprar-entradas/spec.md`

## Summary

UC-12: desde el detalle público de un evento no realizado, la persona elige un tipo de entrada y
una cantidad y compra sin superar el cupo ni su tope (4 entradas pagas por evento, 1 por tipo
gratis). La compra nace `PENDIENTE` con el total que calcula el servidor y el cupo descontado
bajo el cerrojo del evento; el pago simulado la pasa a `CONFIRMADA`, y si no se paga en 15
minutos vence (`CANCELADA` por el sistema) y devuelve su cupo.

**Backend**:
- Endpoints nuevos: `POST /api/eventos/:eventoId/compras`, `GET /api/eventos/:eventoId/mis-compras`,
  `GET /api/compras/:compraId` y `POST /api/compras/:compraId/pago` (R1), con el orden de
  chequeos de R2.
- `Compra` con historial (`CambioEstadoCompra` con autor usuario o sistema); `estado` y
  `creadaEn` se derivan del historial (R5). Transiciones `PENDIENTE → CONFIRMADA` y
  `PENDIENTE → CANCELADA` (vencimiento).
- **Vencimiento perezoso** (R3): las lecturas muestran compras y cupos al día sin guardar nada;
  toda escritura sobre un evento (compras y también las ediciones de la 004) materializa antes
  los vencimientos bajo el cerrojo. Sin temporizadores.
- Services sin ciclos (R4): `CompraService` (dueño de `Compra`) se apoya en `EventoService` y
  `TipoEntradaService`; `VencimientoService` es la pieza que necesita el dueño del evento.
  `EventoService.obtenerAlDia`, `TipoEntradaService.buscarReferenciada` y `descontarCupo` se
  usan dentro del cerrojo del que llama.
- Dominio puro: `Evento.exigirQueSePuedeComprar`, `descontarCupo`, `devolverCupos`;
  `domain/tope-por-persona.ts` (R6). Códigos nuevos: `COMPRA_PROPIO_EVENTO`,
  `TOPE_POR_PERSONA`, `CUPO_INSUFICIENTE`, `COMPRA_VENCIDA`, `TRANSICION_INVALIDA`.
- Seed: las dos compras de la 004 con historial coherente, sin eventos nuevos (R10).

**Mobile**:
- Feature nueva `compras` que depende de `eventos` (no al revés): `DetalleEvento` suma
  `complementos` y la ruta del detalle muestra `DetalleEventoConCompras` (R12).
- Pantallas `ComprarEntradas` (selector de cantidad con máximo `min(cupo, restantes)`) y
  `Compra` (resumen, pago, confirmación y vencida), dibujada siempre desde el estado del
  servidor para resolver el reintento (R13, R16, R17).
- `EtiquetaEstadoCompra` en la base: el único componente de estado de compra (R14).
- Claves `misComprasDelEvento` y `compra`; las mutations invalidan el evento de todos los
  usuarios y el catálogo (R15).

Decisiones en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript strict (`~6.0`) en los tres paquetes; Node ≥ 22.12

**Primary Dependencies**:
- Backend: Express 5 y zod 4, sin dependencias nuevas.
- Mobile: Expo SDK 58, Expo Router, TanStack Query v5, sin dependencias nuevas.

**Storage**: repositorios en memoria (`Map` privado); `CompraRepository` se amplía (sin
repositorios nuevos)

**Testing**:
- Backend: Vitest y supertest, en domain (`Compra`, tope, `Evento`, seed), repositories
  (compras), services (reloj fijo y movible, repositorios armados por caso, concurrencia) y api.
- Mobile: Jest, jest-expo y RNTL con `renderConDependencias` y `porRuta`.

**Target Platform**: servidor Node local; Android con Expo Go (iOS compatible)

**Project Type**: mobile-app con API (monorepo `backend/`, `shared/`, `mobile/`)

**Performance Goals**:
- SC-001: comprar y pagar en ≤ 5 toques desde el detalle.
- SC-002: 50 compras simultáneas sobre cupo 10 → exactamente 10 registradas y cupo 0, en cada
  corrida.
- Las lecturas al día hacen una lectura en lote de compras pendientes por pedido (sin N+1).

**Constraints**:
- El servidor decide total, cupo, tope, "realizado" y "vencida" con su reloj; la app no envía
  precios ni totales y no repite las reglas.
- Toda verificación y modificación de cupo o de estado de compra, bajo el cerrojo del evento.
- Las pantallas y los contratos de la 004 y la 005 siguen funcionando (la forma de las vistas no
  cambia; el cupo pasa a estar al día).
- 360 px sin desplazamiento horizontal.

**Scale/Scope**:
- 4 endpoints nuevos; 2 que cambian de valor (cupo al día).
- 1 entidad ampliada (`Compra` + `CambioEstadoCompra`), 1 módulo puro nuevo (tope), 3
  operaciones nuevas de `Evento` y 2 de `TipoEntrada`.
- 2 services nuevos (`CompraService`, `VencimientoService`), 2 ampliados.
- 3 rutas (una se mueve), 3 pantallas, 1 componente base y 3 de feature nuevos, 2 ampliados.
- Unos 16 archivos de test nuevos o ampliados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple el plan | Estado |
|---|---|---|
| Dominio · Cupo | Se descuenta al registrar la compra (`PENDIENTE`), nunca por debajo de 0 (`TipoEntrada` exige cupo ≥ 0 y `descontarCupo` verifica `hayCupoPara`), bajo el cerrojo, con test de 50 compras simultáneas (R11) | ✅ |
| Dominio · Operaciones atómicas | Alta, pago y vencimiento corren bajo `cerrojo.ejecutar(eventoId, …)`, releen evento, compras y reloj adentro, sin cerrojos anidados (los métodos de los dueños que se llaman adentro no lo toman); las lecturas no lo usan y el orden de guardado nunca muestra cupo de más (R3, R4, R8) | ✅ |
| Dominio · Total | `Compra.registrar` calcula `precio × cantidad` con el precio vigente; el cuerpo no lleva precio ni total (las claves desconocidas se descartan) | ✅ |
| Dominio · Estados | Solo `PENDIENTE → CONFIRMADA` (pago) y `PENDIENTE → CANCELADA` (vencimiento), con `TRANSICION_INVALIDA` para el resto; cada cambio registra estado, autor (usuario o sistema) y fecha del servidor (R5) | ✅ |
| Dominio · Cancelación | La regla se mantiene para las compras confirmadas (009). Para una `PENDIENTE` prevalece el vencimiento a los 15 minutos, también con el evento empezado: refinamiento confirmado en la revisión del plan (R9, Clarifications de la spec). El inicio del evento corta el alta, no el pago | ✅ refinamiento |
| Dominio · zona horaria | `fechaHoraLocal` y `venceEnLocal` con `horaDeBuenosAires`; la app no usa la zona del teléfono | ✅ |
| I. Spec-Driven | Spec con 5 clarificaciones. Plan → tasks → implement. Backlog: 006 → `plan` | ✅ |
| II. Test-First | Cada regla (cupo justo, cupo nunca negativo, total del servidor, realizado, propio evento, tope acumulado y gratis, vencimiento a los 15 min exactos, cupo devuelto una vez, transiciones, solo el comprador paga, historial) con su test y caso borde (SC-005); cada test con su stub de firma real | ✅ |
| III. Capas | `domain/` sin Express ni `errors/`. `CompraService` es el dueño de `Compra` (`obtenerOFallar`); el evento se lo pide a `EventoService` y el tipo a `TipoEntradaService` (`buscarReferenciada` → 400 sobre `body.tipoEntradaId`); el cupo lo guarda el dueño del tipo. Sin ciclos gracias a `VencimientoService` (R4). Cada service escribe solo su agregado. Ids nuevos con `CompraRepository.siguienteId()`. Controllers sin reglas; la forma en `validations/` | ✅ |
| IV. Persistencia en memoria | `CompraRepository` sobre su `Map`, sin estado global; seed con ids legibles (`compra-martin-festival-vip`); UUID para las compras nuevas | ✅ |
| V. Contrato de API | Rutas plurales en kebab-case, formato único de error, 404/403/409 según la tabla; `contracts/api.md`, OpenAPI (tag Compras) con su test de cobertura y Postman | ✅ |
| VI. Identidad simulada | Las cuatro rutas requieren `X-Usuario-Id`; solo el comprador ve y paga su compra (403); `mis-compras` devuelve solo las propias. Vistas explícitas (`CompraVista`) | ✅ |
| VII. App Mobile | `fetch` solo en `src/api/compras.ts`. Cuatro estados con `SegunConsulta`. Estado de la compra con texto y color con **un** componente (`EtiquetaEstadoCompra`). Accesibilidad (labels de "−", "+", "Comprar VIP", "Pagar…", estado), 360 px, sin dependencias nuevas | ✅ |
| VIII. Tipos compartidos | `DatosCompra`, `CompraVista`, `CambioEstadoCompraVista`, `MisComprasDelEventoVista`, `LIMITES_COMPRA` en `shared/` | ✅ |
| IX. Calidad | `strict`, las cuatro verificaciones y el CI. Las piezas nuevas se justifican en R4 (`VencimientoService`) y R12 (`complementos`) | ✅ |

**Gate**: pasa sin violaciones. El vencimiento de una compra pendiente después de empezado el
evento es un refinamiento de la regla "Cancelación" confirmado en la revisión del plan (R9): la
constitución no se enmienda.

**Post-design re-check (Phase 1)**: el diseño no agrega violaciones. Puntos que se registran en
AGENTS.md al terminar la implementación (como hicieron la 004 y la 005):
- recurso `compras` (ya no "mínimo"): sus cuatro endpoints, `CompraService` dueño y
  `VencimientoService`;
- el vencimiento perezoso: lecturas al día sin guardar; toda escritura de un evento materializa
  antes (`EventoService.obtenerAlDia`), y `obtenerDelOrganizador` recibe `ahora`;
- los métodos para usar dentro del cerrojo del que llama (`obtenerAlDia`,
  `TipoEntradaService.buscarReferenciada` y `descontarCupo`);
- mobile: la feature `compras` (depende de `eventos`), `DetalleEvento` con `complementos`, las
  rutas nuevas, `EtiquetaEstadoCompra` en la base y las claves nuevas.

El plan fija detalles que la spec dejó abiertos:
- las rutas y el lugar de `eventoId` (ruta) y `tipoEntradaId` (cuerpo) (R1);
- el orden de chequeos, con tope antes que cupo como en FR-007, y los códigos (R2);
- el vencimiento perezoso y su fecha en `venceEn` (R3);
- que pagar dos veces es `409 TRANSICION_INVALIDA` y la app recupera el estado real (R7, R17);
- que el tope lo informa el servidor (`restantesPorTipo`) y el organizador recibe 0 (R6);
- los textos de la app ([contracts/app.md](./contracts/app.md)).

## Project Structure

### Documentation (this feature)

```text
specs/006-comprar-entradas/
├── plan.md              # este archivo
├── research.md          # Phase 0 (R1–R19)
├── data-model.md        # Phase 1: Compra con historial, Evento, tope, repositorio, services, seed, estado de la app
├── quickstart.md        # Phase 1: calidad, pedidos directos y recorrido de la demo
├── contracts/
│   ├── api.md           # 4 endpoints nuevos, lecturas al día, errores
│   └── app.md           # rutas, hooks, pantallas, textos y componentes
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
shared/src/
├── compra.ts                    # LIMITES_COMPRA, DatosCompra, CompraVista, CambioEstadoCompraVista,
│                                #   AutorCambioEstadoVista, MisComprasDelEventoVista (nuevo)
└── index.ts                     # + exports

backend/src/
├── domain/
│   ├── compra.ts                # + CambioEstadoCompra, historial, registrar, pagar, vencer, alDia,
│   │                            #   estaVencida, esVigente, cupoLiberadoPorTipo
│   ├── tope-por-persona.ts      # entradasRestantes, exigirTopePorPersona (nuevo)
│   ├── evento.ts                # + exigirQueSePuedeComprar, descontarCupo, devolverCupos;
│   │                            #   TipoEntrada + esGratis, descontar, devolver
│   └── repositorios.ts          # RepositorioCompras + siguienteId, buscarPorId,
│                                #   listarPorEventoYComprador, listarPendientesPorEventos
├── repositories/compra.repository.ts    # + los métodos nuevos
├── services/
│   ├── compra.service.ts        # CompraService (nuevo)
│   ├── compra.vistas.ts         # aCompraVista (nuevo)
│   ├── vencimiento.service.ts   # VencimientoService (nuevo)
│   ├── evento.service.ts        # + vencimientoService, obtenerAlDia; obtenerDelOrganizador(…, ahora);
│   │                            #   obtener/listar con cupo al día
│   └── tipo-entrada.service.ts  # + buscarReferenciada, descontarCupo; ahora antes de obtenerDelOrganizador
├── controllers/compra.controller.ts     # crear, misComprasDelEvento, obtener, pagar (nuevo)
├── routes/compras.routes.ts             # /compras/:compraId y /pago (nuevo)
├── routes/eventos.routes.ts             # + /:eventoId/compras (POST) y /:eventoId/mis-compras (GET)
├── routes/index.ts                      # + /compras y controller de compras
├── validations/compra.validation.ts     # compraNueva, comprasDelEvento, compraPorId (nuevo)
├── seed/datos-ejemplo.ts                # compras de la 004 con historial
├── docs/openapi.json                    # + tag Compras, 4 rutas y esquemas
├── docs/ai-ticket-it.postman_collection.json
└── app.ts                               # VencimientoService → EventoService → TipoEntradaService → CompraService

backend/tests/
├── domain/{compra,tope-por-persona}.test.ts      # compra ampliado, tope nuevo
├── domain/{evento,datos-ejemplo}.test.ts         # + cupo y compras del seed
├── repositories/compra.repository.test.ts        # + métodos nuevos
├── services/{compra,vencimiento}.service.test.ts # nuevos
├── services/{evento,tipo-entrada}.service.test.ts # + cupo al día y materialización en ediciones
├── services/concurrencia-compras.test.ts         # nuevo (SC-002)
├── helpers/{eventos,services-de-eventos}.ts      # + compras con historial, CompraService, reloj movible
└── api/{compras,docs}.test.ts                    # compras nuevo

mobile/
├── app/
│   ├── explorar/[eventoId]/index.tsx                    # re-export de DetalleEventoConCompras (se mueve)
│   ├── explorar/[eventoId]/comprar/[tipoEntradaId].tsx  # re-export de ComprarEntradas (nueva)
│   └── compras/[compraId].tsx                           # re-export de Compra (nueva)
├── src/
│   ├── api/compras.ts           # comprarEntradas, obtenerMisComprasDelEvento, obtenerCompra, pagarCompra (nuevo)
│   ├── api/index.ts             # + exports
│   ├── consultas/claves.ts      # + misComprasDelEvento, compra
│   ├── componentes/EtiquetaEstadoCompra.tsx  # nuevo (+ index.ts)
│   ├── navegacion/LayoutRaiz.tsx             # + 3 Stack.Screen (una reemplaza a explorar/[eventoId])
│   ├── features/eventos/
│   │   ├── pantallas/DetalleEvento.tsx       # + complementos
│   │   ├── componentes/ListaTiposEntrada.tsx # + accionDeTipo
│   │   └── index.ts                          # + useEvento, ComplementosDelDetalle
│   └── features/compras/                     # nueva
│       ├── pantallas/{DetalleEventoConCompras,ComprarEntradas,Compra}.tsx
│       ├── componentes/{SelectorCantidad,ResumenCompra,FilaCompraPendiente,AccionComprar,ComprasPendientes}.tsx
│       ├── useMisComprasDelEvento.ts · useCompra.ts · mutaciones.ts
│       ├── formato.ts           # textoTotal, textoVencimiento, textoCantidad
│       └── index.ts
└── tests/
    ├── api/compras.test.ts                          # nuevo
    ├── componentes/etiqueta-estado-compra.test.tsx  # nuevo
    ├── features/compras/formato.test.ts             # nuevo
    ├── pantallas/{comprar-entradas,compra}.test.tsx # nuevos
    ├── pantallas/detalle-evento.test.tsx            # + Comprar, organizador, tope, pendientes
    ├── helpers/{compras.ts,render-con-dependencias.tsx}  # fixtures; mis-compras vacío por defecto
    └── tipos/rutas-tipadas.ts                       # + las dos rutas nuevas

docs/backlog.md                  # 006 → plan (ahora) → … → en PR
AGENTS.md                        # al cerrar: compras, vencimiento, feature compras, rutas
```

**Structure Decision**: la estructura de la 001/004/005 (backend en capas; mobile en base,
features y conectores), sin carpetas nuevas de primer nivel:
- el tope es un módulo puro de `domain/` (como `busqueda.ts`), y la lógica de vencimiento vive en
  `Compra` (pura) y en `VencimientoService` (lecturas y guardado);
- `compras` es una feature nueva de mobile que depende de `eventos`; la composición del detalle
  evita el ciclo (R12);
- `EtiquetaEstadoCompra` va en la base porque la usan varias features (R14).

## Complexity Tracking

Sin violaciones de la constitución. Dos piezas nuevas que se justifican (principio IX):

| Pieza | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|
| `VencimientoService` | El dueño del evento necesita vencer compras antes de cada escritura, y `CompraService` depende de `EventoService` (R4) | Que `EventoService` escriba compras (agregado ajeno) o que use `CompraService` (ciclo) |
| `complementos` de `DetalleEvento` | El detalle de `eventos` tiene que mostrar piezas de `compras` sin importarla (R12) | Que `eventos` importe `compras` (ciclo) o meter las compras dentro de `eventos` |
