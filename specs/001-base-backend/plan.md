# Implementation Plan: Base backend

**Branch**: `feature/001-base-backend` | **Date**: 2026-11-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-base-backend/spec.md`

## Summary

Crear el monorepo con npm workspaces (`backend`, `shared`) y un servidor Express 5 en
TypeScript con las capas de la constitución. Arranca con MongoDB en memoria
(mongodb-memory-server) y un seed determinista, o con `MONGO_URI`. Resuelve lo transversal:
identificación por `X-Usuario-Id`, validación con zod, registro de pedidos, 404 y error
handler con formato único (incluidos 413 y JSON inválido). El recurso Usuarios queda como
referencia completa de las capas (`GET /api/usuarios`, `/:id`, `/actual`), más
`GET /api/salud`. Además deja el modelo de Categoria, Evento y TipoEntrada, y los comandos de
tests, lint y typecheck en verde desde la raíz. Decisiones en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict) sobre Node ≥ 22.12 (se desarrolla con 24)

**Primary Dependencies**: Express 5.3, Mongoose 9, zod 4, mongodb-memory-server 11 (MongoDB
8.2); tsx 4 para ejecutar

**Storage**: MongoDB: en memoria por defecto, `MONGO_URI` opcional (externo)

**Testing**: Vitest 5 + supertest 7; Mongo en memoria propio por archivo de test

**Target Platform**: PC de desarrollo (Windows/macOS/Linux) en la red local; la consume la
app Expo desde un celular en la misma red

**Project Type**: web-service (API REST) dentro de un monorepo que en 002 suma la app móvil

**Performance Goals**: no hay metas de throughput (demo local); suite del backend < 1 min
(SC-004)

**Constraints**: solo herramientas gratuitas; sin internet después de la primera descarga
del binario; sin build a JavaScript; cuerpo ≤ 100 kB

**Scale/Scope**: un usuario a la vez en demo; seed de 5 usuarios, 6 categorías y 8 eventos;
4 endpoints

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple el plan | Estado |
|---|---|---|
| I. Spec-Driven | Spec clarificada (4 decisiones); este plan → tasks → implement | ✅ |
| II. Test-First | TDD; `tests/domain/` (orden, datos de ejemplo, tipos compartidos) sin base; `tests/api/` con supertest y Mongo en memoria por suite | ✅ |
| III. Capas | `routes → controllers → services → repositories → domain`; regla de lint que impide importar Express/Mongoose/IO en `domain/`; controllers sin `try/catch` (Express 5 propaga rechazos) | ✅ |
| IV. Mongo en memoria | Memoria por defecto, `MONGO_URI` opcional, mismo código; seed al arrancar en memoria; tests con instancia propia. Cupo atómico sin transacciones: `cupo` es un contador decreciente en `TipoEntrada`, descontado con `$inc` condicional sobre un solo documento (R15, constitución v1.1.0) | ✅ |
| V. Contrato de API | `/api`, JSON, plural kebab-case, `id` string, formato único de error; contrato en `contracts/api.md`. 413 es un refinamiento registrado en la spec (clarificación 2), no una contradicción | ✅ |
| VI. Identidad simulada | `requerirUsuario` lee `X-Usuario-Id`; vistas explícitas (`UsuarioVista`) | ✅ |
| VII. Mobile | Fuera de alcance (002) | N/A |
| VIII. Tipos compartidos | `@ai-ticket-it/shared` con `EstadoCompra`, `ErrorApi`, `UsuarioVista`, `SaludVista`; nombres en español | ✅ |
| IX. Calidad | `strict`; ESLint prohíbe `any`, `@ts-ignore` sin descripción y `eslint-disable` sin justificación; `test`, `lint` y `typecheck` en la raíz; sin dependencias de más (logger y carga de `.env` nativos) | ✅ |

**Post-design re-check (Phase 1)**: sin violaciones. Revisión 2026-11-03: se corrige la
justificación de atomicidad (R5 → R15: `cupo` como contador decreciente), precios enteros, protección
`--forzar` del seed y lectura de `.env` independiente del directorio de trabajo. Dos carpetas no figuran en el árbol de
capas del principio III: `seed/` y `scripts/`. No son capas nuevas, sino datos de ejemplo y
el punto de entrada de un comando. Ninguna capa de producto depende de ellas, y `seed/`
accede a los modelos igual que un repository. Se dejan registradas en Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-base-backend/
├── spec.md
├── plan.md              # este archivo
├── research.md          # decisiones técnicas (R1–R15)
├── data-model.md        # entidades, persistencia y datos de ejemplo
├── quickstart.md        # validación de punta a punta
├── contracts/
│   └── api.md           # endpoints, errores, tipos y comandos
├── checklists/
│   └── requirements.md
└── tasks.md             # lo genera /speckit-tasks
```

### Source Code (repository root)

```text
package.json                 # workspaces ["backend", "shared"]; scripts start/dev/seed/test/lint/typecheck
tsconfig.base.json           # strict, ESNext, Bundler, noEmit
eslint.config.js             # flat config para todo el repo

shared/
├── package.json             # @ai-ticket-it/shared, exports ./src/index.ts
├── tsconfig.json
└── src/
    ├── index.ts
    ├── estado-compra.ts     # EstadoCompra
    ├── errores.ts           # ErrorApi, DetalleError
    ├── salud.ts             # SaludVista, Almacenamiento
    └── usuario.ts           # UsuarioVista

backend/
├── package.json
├── tsconfig.json            # incluye src/ y tests/
├── vitest.config.ts
├── .env.example             # PORT, HOST, MONGO_URI, LOG_LEVEL
├── src/
│   ├── server.ts            # arranque: env → base → seed → listen → direcciones; señales
│   ├── app.ts               # crearApp(): json, registro, rutas, 404, error handler (sin listen)
│   ├── config/
│   │   ├── env-esquema.ts   # parsearEnv(fuente): esquema zod, puro
│   │   ├── env.ts           # loadEnvFile (ruta desde import.meta.dirname; no en test) + parsearEnv
│   │   ├── db.ts            # conectarBase(uri?, { timeoutMs }) / desconectarBase(): memoria o MONGO_URI
│   │   ├── fallas-arranque.ts # ErrorArranque + mensajeFallaArranque(error, puerto), puro
│   │   ├── destino-mongo.ts # host/base de una URI sin credenciales, puro (lo usan db.ts y seed-opciones.ts)
│   │   ├── direcciones.ts   # IPv4 locales para el mensaje de arranque
│   │   └── logger.ts
│   ├── routes/
│   │   ├── index.ts         # router /api
│   │   ├── salud.routes.ts
│   │   ├── usuarios.routes.ts
│   │   ├── usuarios.schemas.ts
│   │   └── schemas/comunes.ts   # idSchema
│   ├── controllers/
│   │   ├── salud.controller.ts
│   │   └── usuario.controller.ts
│   ├── services/
│   │   └── usuario.service.ts
│   ├── repositories/
│   │   ├── models/          # usuario.model.ts, categoria.model.ts, evento.model.ts
│   │   ├── usuario.repository.ts
│   │   └── evento.repository.ts  # contarPorOrganizador (lo amplían 003/004)
│   ├── domain/
│   │   ├── usuario.ts       # tipo + compararPorApellidoYNombre
│   │   ├── categoria.ts
│   │   └── evento.ts        # Evento + TipoEntrada
│   ├── middlewares/
│   │   ├── requerir-usuario.ts
│   │   ├── validar.ts
│   │   ├── registrar-pedido.ts
│   │   ├── ruta-no-encontrada.ts
│   │   └── manejar-errores.ts
│   ├── errors/
│   │   └── index.ts         # ErrorAplicacion y subclases 400/401/403/404/409
│   ├── seed/
│   │   ├── datos-ejemplo.ts # crearDatosEjemplo(ahora), puro
│   │   └── cargar-seed.ts   # vacía y carga
│   ├── scripts/
│   │   ├── seed-opciones.ts # planificarSeed + ejecutarSeed(deps), testeables sin base
│   │   └── seed.ts          # npm run seed -- --forzar (requiere MONGO_URI); solo cablea
│   └── types/
│       └── express.d.ts     # req.usuario, req.validado
└── tests/
    ├── domain/
    │   ├── usuario.test.ts          # orden por apellido y nombre (tildes, mayúsculas)
    │   ├── datos-ejemplo.test.ts    # mínimos de FR-009, ids fijos, fechas relativas
    │   ├── env.test.ts              # defaults, validación, silent en test
    │   ├── seed-opciones.test.ts    # --forzar, destino sin credenciales, no conecta sin confirmar
    │   ├── direcciones.test.ts      # IPv4 no internas
    │   ├── fallas-arranque.test.ts  # mensajes de EADDRINUSE y ErrorArranque
    │   └── tipos-compartidos.test.ts
    └── api/
        ├── helpers/base-de-prueba.ts
        ├── modelos.test.ts          # validadores de precio, cupo, tiposEntrada, únicos
        ├── db.test.ts               # MONGO_URI inaccesible sin caer a memoria; falta de binario
        ├── salud.test.ts
        ├── usuarios.test.ts         # listado, por id, actual, 400/401/404
        ├── errores.test.ts          # 404 de ruta, JSON inválido, 413, 500, registro de pedidos
        └── seed.test.ts             # cargarSeed idempotente y destructivo
```

Además se actualizan `README.md` y `AGENTS.md` (sección Comandos, FR-024) y `.gitignore`
ya cubre `.env` y la caché de binarios.

**Structure Decision**: monorepo con workspaces `backend/` y `shared/` (se suma `mobile/` en
002). El backend sigue literalmente el árbol del principio III; `seed/`, `scripts/` y
`types/` son de soporte (ver Complexity Tracking).

## Complexity Tracking

| Desviación | Por qué hace falta | Alternativa más simple descartada porque |
|---|---|---|
| Carpetas `seed/` y `scripts/` fuera del árbol de capas | El seed es dato de ejemplo con una función pura testeable y un comando propio (FR-007) | Meterlo en `repositories/` mezclaría datos de demo con acceso a datos de producto; en `config/` no corresponde |
| Carpeta `types/` (declaración de `req.usuario` / `req.validado`) | Tipar lo que dejan los middlewares sin `any` (principio IX) | Castear en cada controller repite código y esconde errores |
| Clases `SinPermisoError` y `ConflictoError` sin uso en esta feature | La constitución fija 403/409 y las usan 005–010 | Agregarlas después obligaría a tocar el error handler en cada feature |
