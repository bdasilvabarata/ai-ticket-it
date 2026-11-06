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

> Revisión 2026-11-06 (constitución v1.2.0): estructura alineada con `ddso-utn/ejercicio-megasuper-2026`
> — inyección de dependencias con composition root, dominio con comportamiento, registro y respuesta
> de errores separados, `validations/` propia y documentación OpenAPI. Ver research R16–R19.

```text
package.json                 # workspaces ["backend", "shared"]; scripts start/dev/seed/test/lint/typecheck
tsconfig.base.json           # strict, ESNext, Bundler, noEmit
eslint.config.js             # flat config para todo el repo

shared/src/                  # @ai-ticket-it/shared: EstadoCompra, ErrorApi, SaludVista, UsuarioVista

backend/
├── package.json · tsconfig.json · vitest.config.ts · .env.example
├── src/
│   ├── server.ts            # arranque: env → base → seed → listen → direcciones; señales
│   ├── app.ts               # COMPOSITION ROOT: crearApp({ almacenamiento, repositorios? })
│   │                        #   instancia repositories → services → controllers → routes
│   ├── config/              # env-esquema, env, db, destino-mongo, fallas-arranque, direcciones, logger
│   ├── routes/
│   │   ├── index.ts         # crearRouterApi(controllers, requerirUsuario)
│   │   ├── salud.routes.ts  # crearSaludRouter(controller)
│   │   ├── usuarios.routes.ts   # crearUsuariosRouter(controller, requerirUsuario)
│   │   └── docs.routes.ts   # /api/docs: Swagger UI + openapi.json
│   ├── controllers/         # clases con métodos flecha; reciben su service por constructor
│   │   ├── salud.controller.ts  # SaludController(almacenamiento)
│   │   └── usuario.controller.ts
│   ├── services/
│   │   └── usuario.service.ts   # UsuarioService({ usuarios, eventos }) — depende de interfaces
│   ├── repositories/        # clases que implementan las interfaces de domain/repositorios.ts
│   │   ├── models/          # usuario.model.ts, categoria.model.ts, evento.model.ts
│   │   ├── usuario.repository.ts   # mapea documentos → entidades de dominio (sin loadClass)
│   │   ├── evento.repository.ts    # contarPorOrganizador (lo amplían 003/004)
│   │   └── errores-persistencia.ts # Mongo/Mongoose → ErrorAplicacion
│   ├── domain/              # entidades con comportamiento, sin IO
│   │   ├── usuario.ts       # class Usuario + compararPorApellidoYNombre
│   │   ├── categoria.ts     # class Categoria
│   │   ├── evento.ts        # class Evento (tuPrecioEstaEntre) + class TipoEntrada (hayCupoPara)
│   │   ├── errores.ts       # DatosInvalidosError, ReglaDeNegocioError (sin HTTP)
│   │   ├── invariantes.ts   # junta violaciones → DatosInvalidosError con detalles
│   │   └── repositorios.ts  # interfaces RepositorioUsuarios, RepositorioEventos (puertos)
│   ├── validations/
│   │   ├── validacion.ts    # crearValidacion({ params?, query?, body? }) → { middleware, leer }
│   │   ├── comunes.ts       # idSchema, esIdValido
│   │   └── usuario.validation.ts   # usuarioPorId
│   ├── middlewares/
│   │   ├── requerir-usuario.ts     # crearRequerirUsuario(buscador) + usuarioActual(req)
│   │   ├── registrar-pedido.ts
│   │   ├── ruta-no-encontrada.ts
│   │   ├── traducir-error.ts       # aErrorAplicacion(error): propios, de dominio, parser, Mongo
│   │   ├── registrar-error.ts      # registra los inesperados (con stack)
│   │   └── manejar-errores.ts      # responde con ErrorApi
│   ├── errors/index.ts      # ErrorAplicacion y subclases 400/401/403/404/409/413
│   ├── docs/
│   │   ├── openapi.json     # especificación OpenAPI 3 (servida en /api/docs)
│   │   └── ai-ticket-it.postman_collection.json
│   ├── seed/                # datos-ejemplo.ts (entidades de dominio, puro) · cargar-seed.ts
│   ├── scripts/             # seed-opciones.ts (testeable) · seed.ts (cablea)
│   └── types/express.d.ts   # req.usuario
└── tests/
    ├── domain/              # entidades (usuario, evento), datos de ejemplo, env, seed-opciones,
    │                        # direcciones, fallas-arranque, tipos compartidos — sin base
    ├── fakes/               # repositorios en memoria (estado por instancia)
    ├── services/            # usuario.service.test.ts — con los fakes, sin base
    └── api/                 # supertest + Mongo en memoria por suite: salud, usuarios, errores,
                             # errores-persistencia, validacion, modelos, seed, db, docs y
                             # repositorios.contrato (fakes y Mongo cumplen el mismo contrato)

.prettierrc.json · .prettierignore   # Prettier (printWidth 110; no formatea Markdown)
.github/workflows/ci.yml             # CI: format:check, lint, typecheck y test en cada PR
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
| Carpeta `types/` (declaración de `req.usuario`) | Tipar lo que dejan los middlewares sin `any` (principio IX) | Castear en cada controller repite código y esconde errores |
| Clase `SinPermisoError` sin uso en esta feature | La constitución fija 403/409 y las usan 005–010 | Agregarlas después obligaría a tocar el error handler en cada feature |
| `domain/repositorios.ts` (interfaces) e inyección por constructor | Probar services sin base con repositorios falsos y armar todo en un solo lugar (R16) | Objetos globales espiados con `vi.spyOn`: dependencias ocultas en los imports y sin tests de services aislados |
| Swagger UI (`swagger-ui-express`) | Documentación navegable para la demo y para desarrollar la app (R19) | Solo el contrato en Markdown: no se prueba desde el navegador ni se importa en Postman |
