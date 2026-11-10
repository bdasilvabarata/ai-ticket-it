# Implementation Plan: Crear evento

**Branch**: `feature/004-crear-evento` | **Date**: 2026-11-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-crear-evento/spec.md`

## Summary

UC-04 de punta a punta: el usuario actual crea, edita y elimina los eventos que organiza y
administra sus tipos de entrada de a uno, desde la pestaña **Mis eventos**.

**Backend**:
- `Evento` tiene sus capas completas (routes → controller → service → repository).
- `TipoEntrada` tiene controller y service propios, pero vive dentro del agregado `Evento`: se
  lee y se guarda con `RepositorioEventos`.
- Las reglas de tipos son operaciones de `Evento` en `domain/` (agregar, editar, quitar,
  nombre único sin mayúsculas ni tildes, al menos uno). Cada operación **devuelve un `Evento`
  nuevo**; lo guardado nunca se modifica en el lugar.
- Se suman `Categoria` (solo lectura) y una `Compra` **mínima**: entidad y repositorio en
  memoria con `existePorEvento` / `existePorTipoEntrada`, sin endpoints.
- Las operaciones que verifican y modifican un evento corren bajo un **cerrojo por evento**
  (`CerrojoPorClave`), que serializa los pedidos sobre un mismo evento y deja correr en
  paralelo los de eventos distintos (FR-029, SC-008).
- Un **reloj inyectable** es la única referencia de "ahora": decide si una fecha es futura y
  si un evento está realizado (FR-010a). La app envía la fecha y hora de pared sin zona
  (`"2026-12-01T20:00"`), el servidor la interpreta en hora de Buenos Aires y la vista
  devuelve el instante y también la hora de pared ya armada.

**Mobile**:
- Features nuevas `eventos` y `categorias`, con funciones de endpoint en `src/api/` y claves
  por usuario.
- Cinco pantallas: Mis eventos, Crear evento, Editar evento, Formulario de tipo de entrada
  (agregar y editar) y Ver evento realizado.
- La fecha se elige con `@react-native-community/datetimepicker` (viene en Expo Go del
  SDK 58) y se arma como hora de pared, sin convertir zonas.
- Al salir de un formulario se pide confirmación con `usePreventRemove` de Expo Router.
- La app no duplica las reglas: muestra junto a cada campo los detalles del 400 del servidor.

El cerrojo cumple el objetivo de "Cupo atómico" pero no su letra. Antes de implementar hay que
aplicar una enmienda **MINOR** de la constitución (ver Complexity Tracking y research R1).
Decisiones en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript strict (`~6.0`) en los tres paquetes; Node ≥ 22.12

**Primary Dependencies**:
- Backend: Express 5 y zod 4, sin dependencias nuevas.
- Mobile: Expo SDK 58, Expo Router, TanStack Query v5. **Nueva**:
  `@react-native-community/datetimepicker` 9.2.1, la versión de
  `expo/bundledNativeModules.json` para el SDK 58 (incluida en Expo Go; R11).

**Storage**: repositorios en memoria (`Map` privado); se suma `CompraRepository`

**Testing**:
- Backend: Vitest y supertest, en domain, repositories, services (con reloj fijo y tests de
  concurrencia con `Promise.all`) y api.
- Mobile: Jest, jest-expo y RNTL con `renderConDependencias`. Los tests de fecha de pared
  corren con `process.env.TZ` cambiado.

**Target Platform**: servidor Node local; Android con Expo Go (iOS compatible)

**Project Type**: mobile-app con API (monorepo `backend/`, `shared/`, `mobile/`)

**Performance Goals**: sin metas propias. Las operaciones sobre eventos distintos no se
esperan entre sí (FR-029).

**Constraints**:
- Ningún pedido que viola una regla deja algo modificado (SC-004).
- Ante pedidos simultáneos sobre un evento, el resultado es igual a procesarlos de a uno
  (SC-008).
- La fecha no depende del reloj ni de la zona del teléfono (SC-006).
- Las pantallas se usan en 360 px de ancho (SC-007).

**Scale/Scope**:
- 9 endpoints nuevos.
- 4 entidades de dominio tocadas o nuevas, y 2 piezas nuevas (cerrojo y reloj).
- 5 pantallas y 4 rutas nuevas en `app/` (la 5.ª pantalla reemplaza la sección pendiente).
- Unos 25 archivos de test nuevos.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple el plan | Estado |
|---|---|---|
| Dominio · Cupo / Total / Estados | Esta feature no descuenta cupo ni crea compras. Al editar, el cupo es el disponible (≥ 0). El total de `Compra` queda fijo, y cambiar un precio no lo toca (FR-015) | ✅ |
| Dominio · **Cupo atómico** | Verificar y modificar un evento corre **bajo el cerrojo del evento**, con `await` adentro. Cumple el objetivo (nada se intercala sobre el mismo evento) pero **no la letra** ("sin ningún `await`") | ⚠️ enmienda MINOR (Complexity Tracking) |
| Dominio · Días restantes / zona | "Realizado" y "fecha futura" se calculan al consultar y al operar, con el reloj del servidor, en `America/Argentina/Buenos_Aires` (no se persisten) | ✅ |
| I. Spec-Driven | Spec con 6 clarificaciones. Plan → tasks → implement. El backlog se ajusta (la 006 depende de la 004) | ✅ |
| II. Test-First | Cada regla tiene su test con caso borde, en domain, repositories, services (con concurrencia) y api. En mobile: api, formato, fecha de pared y pantallas. Cada test va con su stub de firma real | ✅ |
| III. Capas | `domain/` (Evento, TipoEntrada, Compra, interfaces `Reloj` y de repositorio) sin Express ni `errors/`. Los services orquestan, verifican permisos y usan el cerrojo. Los controllers no tienen reglas. Las validaciones de forma van en `validations/`. `app.ts` es el único que instancia. Ningún service depende de otro | ✅ |
| IV. Persistencia en memoria | `CompraRepository` con `Map` privado. Seed con compras de ids legibles. UUID para lo creado. Estado por instancia de app y de test. Las entidades son inmutables y `guardar` reemplaza | ✅ (atomicidad: ver arriba) |
| V. Contrato de API | Rutas en plural y kebab-case bajo `/api`, formato único de error y códigos 409 propios. Todo se valida en el servidor. `contracts/api.md` y OpenAPI, con el test de cobertura y la colección de Postman | ✅ |
| VI. Identidad simulada | `X-Usuario-Id`. Los services verifican que el usuario sea el organizador (403). El organizador es siempre el usuario actual (FR-009). Las respuestas son vistas explícitas | ✅ |
| VII. App Mobile | `fetch` solo en `src/api/`. Cuatro estados con `SegunConsulta`. `accessibilityLabel` y roles. 360 px. Una sola dependencia nueva y liviana (R11). Sin librerías de UI ni de estado | ✅ |
| VIII. Tipos compartidos | `EventoVista`, `EventoResumenVista`, `TipoEntradaVista`, `CategoriaVista`, los datos de entrada y los límites de texto viven en `shared/` | ✅ |
| IX. Calidad | `strict`, las cuatro verificaciones y el CI. Complejidad nueva solo donde la spec la pide (cerrojo y reloj), justificada abajo | ✅ |

**Gate**: pasa con **una violación justificada**: la letra de "Cupo atómico". La enmienda
(texto propuesto en research R1) se aplica con `/speckit-constitution` como **primera tarea**,
antes de cualquier código.

**Post-design re-check (Phase 1)**: el diseño no agrega violaciones. Cambios menores de
convención que se registran en AGENTS.md:
- `listarPor<Criterio>` en repositories (R6);
- `Reloj` como pieza inyectada (R3).

El plan fija detalles que la spec dejó abiertos:
- fecha no futura → `409 FECHA_NO_FUTURA` (R4);
- orden de los chequeos: 404 → 403 → 404 del tipo → 400 de categoría → 409 (R5);
- `GET /api/eventos/:eventoId` público y compartido con la 005 (R8);
- `PUT` con reemplazo completo de los datos (R9);
- sin validación duplicada en la app (R13).

## Project Structure

### Documentation (this feature)

```text
specs/004-crear-evento/
├── plan.md              # este archivo
├── research.md          # Phase 0 (R1–R18)
├── data-model.md        # Phase 1: entidades, operaciones, vistas, cerrojo, reloj, seed
├── quickstart.md        # Phase 1: cómo validar de punta a punta
├── contracts/
│   ├── api.md           # endpoints, cuerpos, vistas y errores
│   └── app.md           # pantallas, rutas, textos, estados y diálogos
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
shared/src/
├── evento.ts                    # EventoVista, EventoResumenVista, TipoEntradaVista, Datos*, LIMITES_*
├── categoria.ts                 # CategoriaVista
└── index.ts                     # + exports

backend/src/
├── domain/
│   ├── evento.ts                # Evento.crear / actualizar / agregar|editar|quitarTipoEntrada /
│   │                            #   verificarQueSePuedeEliminar / estaRealizado; TipoEntrada; nombres
│   ├── compra.ts                # Compra mínima (EstadoCompra de shared)
│   ├── reloj.ts                 # interfaz Reloj { ahora(): Date }
│   ├── hora-buenos-aires.ts     # pared "YYYY-MM-DDTHH:mm" ⇄ instante (UTC−3 fijo)
│   ├── repositorios.ts          # + RepositorioEventos ampliado, RepositorioCompras
│   └── errores.ts / invariantes.ts (sin cambios de forma)
├── repositories/
│   ├── evento.repository.ts     # + listarPorOrganizador, guardar, eliminarPorId
│   └── compra.repository.ts     # existePorEvento, existePorTipoEntrada, guardar
├── services/
│   ├── cerrojo-por-clave.ts     # interfaz Cerrojo + CerrojoPorClave
│   ├── evento.vistas.ts         # aEventoVista / aEventoResumenVista / aTipoEntradaVista
│   ├── evento.service.ts
│   ├── tipo-entrada.service.ts
│   └── categoria.service.ts
├── controllers/{evento,tipo-entrada,categoria}.controller.ts
├── routes/{eventos,categorias}.routes.ts   # tipos-entrada se monta dentro de eventos
├── validations/{evento,tipo-entrada}.validation.ts  (+ fechaDeParedSchema en comunes.ts)
├── config/reloj.ts              # relojDelSistema
├── seed/                        # + compras de ejemplo; Repositorios + compras
├── docs/openapi.json            # + Categorías, Eventos, Tipos de entrada
├── docs/ai-ticket-it.postman_collection.json
└── app.ts                       # OpcionesApp { repositorios?, reloj? }; un cerrojo compartido

backend/tests/
├── domain/{evento,compra,hora-buenos-aires}.test.ts
├── services/{cerrojo-por-clave,evento.service,tipo-entrada.service,categoria.service,concurrencia}.test.ts
├── repositories/{evento,compra}.repository.test.ts (+ repositorios-de-ejemplo)
└── api/{categorias,eventos,tipos-entrada}.test.ts (+ docs)

mobile/
├── package.json                 # + @react-native-community/datetimepicker (npx expo install)
├── app/
│   ├── (tabs)/mis-eventos.tsx   # re-export de MisEventos
│   └── eventos/
│       ├── nuevo.tsx                            # CrearEvento
│       └── [eventoId]/
│           ├── index.tsx                        # EventoDelOrganizador (editar o ver)
│           └── tipos-entrada/
│               ├── nuevo.tsx                    # AgregarTipoEntrada
│               └── [tipoEntradaId].tsx          # EditarTipoEntrada
├── src/
│   ├── api/{eventos,categorias}.ts (+ index.ts)
│   ├── consultas/claves.ts      # + categorias(), misEventos(u), evento(u, e)
│   ├── componentes/tema.ts      # + neutro/sobreNeutro (marca "Realizado")
│   ├── navegacion/LayoutRaiz.tsx # + Stack.Screen de las 4 rutas, en el guard con-usuario
│   └── features/
│       ├── categorias/          # useCategorias, index
│       └── eventos/
│           ├── pantallas/       # MisEventos, CrearEvento, EventoDelOrganizador (EditarEvento /
│           │                    #   VerEventoRealizado), AgregarTipoEntrada, EditarTipoEntrada
│           ├── componentes/     # FilaEvento, MarcaRealizado, CamposEvento, CamposTipoEntrada,
│           │                    #   SelectorCategoria, SelectorFechaHora, ListaTiposEntrada
│           ├── useMisEventos.ts · useEvento.ts · mutaciones.ts
│           ├── useConfirmarDescarte.ts          # usePreventRemove + Alert
│           ├── fecha-de-pared.ts                # Date del selector ⇄ "YYYY-MM-DDTHH:mm"
│           ├── errores-de-formulario.ts         # detalles 400 → errores por campo
│           ├── formato.ts
│           └── index.ts
└── tests/
    ├── api/{eventos,categorias}.test.ts
    ├── features/eventos/{formato,fecha-de-pared,errores-de-formulario}.test.ts
    ├── pantallas/{mis-eventos,crear-evento,editar-evento,tipo-entrada,evento-realizado}.test.tsx
    └── tipos/rutas-tipadas.ts   # + caso de ruta dinámica sin parámetro

docs/backlog.md                  # 006 depende también de 004; estado de 004
AGENTS.md                        # recursos nuevos, cerrojo, reloj, features eventos y categorias
.specify/memory/constitution.md  # enmienda MINOR (vía /speckit-constitution)
```

**Structure Decision**: se usa la estructura de la 001 (backend en capas) y de la 003 (mobile
en base, features y conectores) sin carpetas nuevas de primer nivel:
- el cerrojo va en `services/`, porque es la coordinación de los casos de uso;
- la interfaz `Reloj` va en `domain/` y su implementación del sistema, en `config/`;
- `tipos-entrada` es un router hijo de `eventos` (`mergeParams`).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| "Cupo atómico" exige "sin ningún `await` entre la verificación y el descuento"; el plan verifica y modifica **bajo un cerrojo por evento**, con `await` adentro | Los repositorios devuelven `Promise` (R23 de la 001). Eliminar un evento verifica en `RepositorioCompras` y modifica en `RepositorioEventos`, y editar un tipo es leer el agregado, operar y guardarlo: entre medio otro pedido puede intercalarse (verificar-y-modificar, y actualización perdida). FR-029 / SC-008 piden que no pase | **Repositorios sincrónicos**: rompen las interfaces async de R23. **Operación combinada en un repositorio**: mezcla eventos y compras en una pieza. **Versión optimista**: cumple la letra, pero ante concurrencia uno de los pedidos recibe 409 o hay que reintentar, y se prioriza que no haya errores ni incongruencias (research R1). Se resuelve con la **enmienda MINOR** propuesta en R1, aplicada antes de implementar |
| Pieza nueva `CerrojoPorClave` (una cola de promesas por clave) | Es el mecanismo de la fila de arriba. La 006 la reutiliza para el cupo y los estados | Un cerrojo global serializaría también los eventos distintos (FR-029: no se esperan entre sí) |
| Pieza nueva `Reloj` inyectada | FR-010a: el servidor es la única referencia de "ahora", y los tests necesitan fijar el instante exacto de "realizado" y de "fecha futura" | `new Date()` suelto en dominio o services: los tests no podrían fijar el borde |
