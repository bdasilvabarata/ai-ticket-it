# Implementation Plan: Chat de la compra

**Branch**: `feature/011-chat-de-la-compra` | **Date**: 2026-11-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-chat-de-la-compra/spec.md`

## Summary

UC-05 y UC-06: cada compra tiene un chat entre su comprador y el organizador del evento. Las dos
partes, y solo ellas, leen y escriben en cualquier estado de la compra y en cualquier momento. Los
mensajes viven **dentro del agregado `Compra`**, como las entradas. Enviar uno corre bajo el
cerrojo del evento, con un solo `guardar`, y no cambia nada más de la compra. Leer no toma el
cerrojo y muestra la compra al día sin guardar.

**Backend**:

- **Dominio**:
  - `Mensaje` es una clase nueva (`autorId`, `texto`, `enviadoEn`; R1).
  - `Compra` suma `mensajes`, `enviarMensaje(autorId, texto, ahora)` y `rolDe(usuarioId,
    organizadorId)` (R1, R2).
  - Las transiciones conservan los mensajes.
  - `REGLAS_DE_COMPRA` suma `mensajes-en-orden`.
- **Service**: `CompraService.chat` hace tres lecturas fijas, sin cerrojo, y responde 404 → 403
  (R5). `CompraService.enviarMensaje` corre bajo el cerrojo: relee, 403, materializa el vencimiento
  y hace un `guardar` (R4). No hay services nuevos (R7).
- **API**:
  - `GET` y `POST /compras/:compraId/mensajes`, en `compras.routes.ts`.
  - El texto se valida con `textoObligatorio(500)`.
  - El `GET` responde `ChatDeLaCompraVista` (encabezado, la otra parte y los mensajes) y el `POST`,
    `201 MensajeVista` (R6).
  - Se actualizan la OpenAPI y Postman.
- **Seed**: tres mensajes de Martín y Lucía en `compra-martin-festival-vip` (R8).

**Mobile** (feature `compras`):

- La pantalla "Chat de la compra" va en `compras/[compraId]/chat`, y "Tu compra" pasa a
  `compras/[compraId]/index` (R9).
- Tiene encabezado, mensajes propios y ajenos diferenciados con algo más que el color, el vacío
  "Todavía no hay mensajes" y el campo con "Enviar" (`useEnvioUnico`, el 400 junto al campo; R11).
- Se refresca al volver a la pantalla. `PantallaDesplazable` suma `empezarAlFinal`.
- Accesos: "Chat con el organizador" en "Tu compra" y "Abrir chat" en cada `FilaCompraDelEvento`.
- Consultas: la clave nueva `chatDeLaCompra`, `useEnviarMensaje`, que invalida solo el chat de esa
  compra, y las mutations que cambian el estado, que también invalidan el chat (R10).

**Constitución**: sin enmiendas. El chat y el `Mensaje` ya están en "Entidades", en "Chat" y en el
principio VI.

Las decisiones están en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript strict (`~6.0`) en los tres paquetes; Node ≥ 22.12

**Primary Dependencies**:
- Backend: Express 5 y zod 4.
- Mobile: Expo SDK 58, Expo Router y TanStack Query v5.
- **Sin dependencias nuevas.**

**Storage**: repositorios en memoria (`Map` privado). Sin métodos nuevos en los repositorios: un
mensaje es un `guardar` de la compra, que ahora lleva sus mensajes.

**Testing**:
- Backend: Vitest y supertest, en domain (`Mensaje`, `enviarMensaje`, `rolDe`, la regla nueva,
  transiciones que conservan los mensajes), services (reloj fijo, repositorios espiados), concurrencia
  (mensaje ‖ pago, cancelación, uso y reembolso) y api.
- Mobile: Jest, jest-expo y RNTL con `renderConDependencias` y `porRuta`.

**Target Platform**: servidor Node local; Android con Expo Go (compatible con iOS)

**Project Type**: mobile-app con API (monorepo `backend/`, `shared/`, `mobile/`)

**Performance Goals**:
- Llegar al chat: 1 toque. Enviar un mensaje ya escrito: 1 toque más (SC-001).
- Leer: tres lecturas fijas por pedido, sin N+1 por mensaje ni por autor.
- Enviar: un pedido por toque.

**Constraints**:
- Solo las dos partes, en cualquier estado y momento: sin 409.
- La fecha de envío sale del reloj del servidor. El texto se recorta y va de 1 a 500 caracteres.
- Los mensajes no se editan ni se borran.
- La vista no trae códigos de entradas, historial ni total.
- Las escrituras van bajo el cerrojo del evento. Las lecturas, al día y sin guardar.
- Sin tiempo real.
- 360 px, TalkBack y teclado abierto.

**Scale/Scope**:
- Backend: 2 endpoints, 1 clase de dominio y 2 métodos de `Compra`, 1 invariante, 2 métodos de
  service, 1 archivo de vistas, 6 tipos compartidos y 3 mensajes de seed.
- Mobile:
  - 2 funciones de API, 1 clave, 1 consulta, 1 mutation y 4 mutations ampliadas;
  - 1 pantalla, 2 componentes, 2 accesos y 1 prop nueva de `PantallaDesplazable`;
  - 1 ruta movida y 1 nueva, y ~5 textos.
- Unos 14 archivos de test nuevos o ampliados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple el plan | Estado |
|---|---|---|
| Dominio · Entidades | `Mensaje` (usuario, texto, enviado) vive dentro de `Compra`, como dice "Entidades" (R1) | ✅ |
| Dominio · Chat | Solo el comprador y el organizador del evento leen y escriben (`rolDe` → 403), en cualquier estado (sin 409; R2) | ✅ |
| Dominio · Estados | Enviar no agrega `CambioEstadoCompra` ni cambia el estado. Las transiciones conservan los mensajes (R1) | ✅ |
| Dominio · Operaciones atómicas | `enviarMensaje` toma el cerrojo del evento, relee el reloj, el evento y la compra adentro, materializa el vencimiento y hace un `guardar`. Se libera en `finally`, sin anidar. Mensaje ‖ pago, cancelación, uso o reembolso nunca se pisan (R4) | ✅ |
| Dominio · Cupo | El mensaje no lo toca. Solo lo cambia la materialización de un vencimiento, con el orden de guardado de la 006 | ✅ |
| I. Spec-Driven | La spec tiene 3 clarificaciones; sigue tasks → implement. Backlog: 011 → `plan` | ✅ |
| II. Test-First | Cada regla con su borde: 500 y 501 caracteres, solo espacios, cada estado, la pendiente vencida, el organizador de otro evento, N mensajes simultáneos y cada carrera con otra operación (R13). TDD con stub de firma real | ✅ |
| III. Capas | `domain/` sigue puro: recibe `ahora` y `organizadorId`. `CompraService` es el único que guarda compras; le pide el evento a `EventoService` y los usuarios en lote a `UsuarioService`, sin ciclos ni services nuevos. Los 404/403 salen de `errors/` y la forma, de `validations/` (R7) | ✅ |
| IV. Persistencia en memoria | Sin estructuras nuevas: los mensajes se guardan con la compra. Sin ids nuevos, porque `numero` se deriva (R6) | ✅ |
| V. Contrato de API | `/api/compras/:compraId/mensajes` es el ejemplo de la constitución. Formato de error único, orden documentado (contracts/api.md), OpenAPI con su test de cobertura y Postman | ✅ |
| VI. Identidad simulada | El autor sale de `X-Usuario-Id`, nunca del cuerpo. Vistas explícitas, sin códigos ni datos de la compra que el organizador no deba ver (R6) | ✅ |
| VII. App Mobile | `fetch` solo en `src/api/`. Los cuatro estados con `SegunConsulta`. El estado con `EtiquetaEstadoCompra`. Propios y ajenos con posición y texto, además del color. Accesibilidad por mensaje y 360 px (R11, R12) | ✅ |
| VIII. Tipos compartidos | `LIMITES_MENSAJE`, `DatosMensaje`, `RolEnLaCompra`, `ParteDeLaCompraVista`, `MensajeVista` y `ChatDeLaCompraVista` en `shared/src/mensaje.ts`, con vocabulario del dominio | ✅ |
| IX. Calidad | `strict`, las cuatro verificaciones y el CI. Sin services, ids, repositorios ni sondeos de más (R1, R7, R11: YAGNI) | ✅ |

**Gate**: pasa sin violaciones ni enmiendas.

**Re-check post-diseño**: data-model, los contratos y quickstart no suman nada que cambie la tabla.
Hay dos cambios de piezas compartidas, ambos aditivos y con test:
- la prop opcional `empezarAlFinal` de `PantallaDesplazable`, en la base de la app;
- la ruta "Tu compra", que se mueve a `compras/[compraId]/index` sin cambiar su `href`.

## Project Structure

### Documentation (this feature)

```text
specs/011-chat-de-la-compra/
├── spec.md
├── plan.md              # este archivo
├── research.md          # R1–R13
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md           # GET y POST /compras/:compraId/mensajes
│   └── app.md           # pantalla, accesos, consulta, textos
├── checklists/
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
shared/src/{mensaje.ts (nuevo), index.ts}      # LIMITES_MENSAJE y las vistas del chat

backend/src/
├── domain/mensaje.ts (nuevo)                  # Mensaje
├── domain/compra.ts                           # mensajes, enviarMensaje, rolDe, #propiedades
├── domain/reglas-de-compra.ts                 # mensajes-en-orden
├── services/compra.service.ts                 # chat, enviarMensaje
├── services/mensaje.vistas.ts (nuevo)         # aChatDeLaCompraVista, aMensajeVista
├── services/compra.vistas.ts                  # exporta aTipoDeLaCompra
├── validations/compra.validation.ts           # mensajeNuevo
├── controllers/compra.controller.ts           # chat, enviarMensaje
├── routes/compras.routes.ts                   # GET y POST /:compraId/mensajes
├── seed/datos-ejemplo.ts                      # conversación de Martín y Lucía
└── docs/{openapi.json, ai-ticket-it.postman_collection.json}

backend/tests/
├── domain/{mensaje (nuevo), compra, reglas-de-compra, datos-ejemplo}.test.ts
├── services/{mensaje.vistas (nuevo), compra.service, concurrencia-compras}.test.ts
└── api/{mensajes (nuevo), docs}.test.ts

mobile/
├── app/compras/[compraId]/index.tsx           # movida desde compras/[compraId].tsx
├── app/compras/[compraId]/chat.tsx (nueva)
└── src/
    ├── api/compras.ts                         # obtenerChatDeLaCompra, enviarMensaje (+ index.ts)
    ├── consultas/claves.ts                    # chatDeLaCompra
    ├── componentes/PantallaDesplazable.tsx    # empezarAlFinal
    ├── navegacion/LayoutRaiz.tsx              # compras/[compraId]/index y /chat
    └── features/compras/
        ├── useChatDeLaCompra.ts (nuevo)
        ├── mutaciones.ts                      # useEnviarMensaje; 4 mutations invalidan el chat
        ├── formato.ts                         # textos del chat
        ├── index.ts                           # ChatDeLaCompra
        ├── pantallas/ChatDeLaCompra.tsx (nueva)
        ├── pantallas/Compra.tsx               # "Chat con el organizador"
        └── componentes/{EncabezadoDelChat, MensajeDelChat (nuevos), FilaCompraDelEvento}.tsx

mobile/tests/
├── api/compras.test.ts
├── componentes/pantalla-desplazable.test.tsx
├── features/compras/formato.test.ts
├── helpers/compras.ts                         # chat y mensaje de ejemplo
├── tipos/rutas-tipadas.ts                     # /compras/[compraId]/chat sin parámetro
└── pantallas/{chat-de-la-compra (nuevo), compra, compras-del-evento}.test.tsx

AGENTS.md · docs/backlog.md                    # al cerrar la feature
```

**Structure Decision**: la del monorepo actual. Todo va en el agregado `Compra` y en la feature
`compras` de mobile. No hay services, controllers, routers ni repositorios nuevos. Lo único nuevo de
estructura es la carpeta de rutas `app/compras/[compraId]/`.

## Complexity Tracking

Sin violaciones que justificar.
