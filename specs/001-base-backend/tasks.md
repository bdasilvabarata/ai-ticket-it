---

description: "Tareas de implementación de la feature 001 — Base backend"
---

# Tasks: Base backend

**Input**: documentos de diseño en `specs/001-base-backend/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md),
[quickstart.md](./quickstart.md)

**Tests**: obligatorios. La constitución (principio II, NON-NEGOTIABLE) exige TDD estricto en
el backend: cada test se escribe primero, **se lo ve fallar** y recién entonces se implementa.
`tests/domain/` no usa base de datos; `tests/api/` usa supertest contra `crearApp()` (sin
`listen`) y un MongoDB en memoria propio por archivo.

**Organización**: las tareas se agrupan por historia de usuario de la spec (US1, US2, US3).

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: puede hacerse en paralelo (archivo distinto, sin dependencias pendientes).
- **[Story]**: historia a la que pertenece (US1, US2, US3).
- Rutas relativas a la raíz del repo.

## Convenciones para todas las tareas

- Todos los paquetes son `"type": "module"`; imports **sin** extensión `.js`
  (`moduleResolution: Bundler`, R2). Imports de tipos con `import type` (`verbatimModuleSyntax`).
- Prohibido `any`, `@ts-ignore` y `eslint-disable` sin descripción (principio IX).
- `backend/src/domain/` es puro: no importa `express`, `mongoose`, `mongodb` ni módulos de Node
  con IO.
- Controllers sin `try/catch`: Express 5 propaga los rechazos de handlers `async` al error
  handler (R9).
- Los repositories consultan con `.lean()` y devuelven entidades de dominio vía `aDominio()`
  (`_id` → `id: string`, sin `__v`); nunca documentos de Mongoose (R12).
- Mensajes al usuario y nombres de dominio en español.
- Commits: Conventional Commits con scope `001-base-backend` (por ejemplo,
  `feat(001-base-backend): middleware de validación`), uno por tarea o grupo coherente.

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: monorepo, paquetes, TypeScript, lint y Vitest configurados.

- [X] T001 Crear `package.json` en la raíz: `"private": true`, `"type": "module"`,
  `"workspaces": ["backend", "shared"]`, `"engines": { "node": ">=22.12" }`. Scripts:
  `start` = `npm run start -w backend`, `dev` = `npm run dev -w backend`,
  `seed` = `npm run seed -w backend --` (para que `npm run seed -- --forzar` llegue al script),
  `test` = `npm run test --workspaces --if-present`, `lint` = `eslint .`,
  `typecheck` = `npm run typecheck --workspaces --if-present`. devDependencies:
  `typescript` `~6.0`, `eslint` `^10`, `@eslint/js`, `typescript-eslint` `^8`,
  `@eslint-community/eslint-plugin-eslint-comments`, `globals` (R1, R14).
- [X] T002 Crear `tsconfig.base.json` en la raíz con `strict: true`, `target: "ES2023"`,
  `module: "ESNext"`, `moduleResolution: "Bundler"`, `noEmit: true`,
  `verbatimModuleSyntax: true`, `esModuleInterop: true`, `skipLibCheck: true`,
  `isolatedModules: true`, `resolveJsonModule: true` (R2).
- [X] T003 [P] Crear `shared/package.json` (`"name": "@ai-ticket-it/shared"`, `"private": true`,
  `"type": "module"`, `"exports": { ".": "./src/index.ts" }`, `"types": "./src/index.ts"`,
  script `typecheck` = `tsc --noEmit`, sin paso de build) y `shared/tsconfig.json` que extiende
  `../tsconfig.base.json` e incluye `src/**/*.ts` (R2).
- [X] T004 [P] Crear `backend/package.json` (`"type": "module"`, `"private": true`).
  dependencies: `express` `^5.3`, `mongoose` `^9`, `zod` `^4`, `mongodb-memory-server` `^11`,
  `@ai-ticket-it/shared` `"*"`. devDependencies: `tsx` `^4`, `vitest` `^5`, `supertest` `^7`,
  `@types/express` `^5` (los de Express 4 tipan distinto los handlers async y `req.query`),
  `@types/supertest`, `@types/node` `^22` (alineado con `engines`). Scripts: `start` = `tsx src/server.ts`,
  `dev` = `tsx watch src/server.ts`, `seed` = `tsx src/scripts/seed.ts`, `test` = `vitest run`,
  `typecheck` = `tsc --noEmit`. Crear `backend/tsconfig.json` que extiende
  `../tsconfig.base.json`, con `types: ["node"]` e `include: ["src/**/*.ts", "tests/**/*.ts",
  "vitest.config.ts"]` (R3, R13: incluir `tests/` hace que un cambio en `shared` rompa el
  typecheck del backend).
- [X] T005 [P] Crear `backend/vitest.config.ts` con `test.environment: "node"`,
  `test.include: ["tests/**/*.test.ts"]`, `test.hookTimeout: 60000` (primera descarga del
  binario de MongoDB), `test.testTimeout: 10000` y `test.env: { NODE_ENV: "test" }` (R13).
  `NODE_ENV` se fija explícitamente porque Vitest solo lo pone en `test` si no viene definido:
  con un `NODE_ENV=development` en la terminal, los tests leerían `backend/.env` y el logger
  no quedaría en `silent` (R4).
- [X] T006 [P] Crear `eslint.config.js` (flat config) en la raíz: ignora `node_modules/` y
  `**/dist/`; aplica `@eslint/js` recommended y `typescript-eslint` recommended a `**/*.ts`;
  globals de Node; reglas `@typescript-eslint/no-explicit-any: "error"`,
  `@typescript-eslint/ban-ts-comment` con `ts-ignore: "allow-with-description"` y
  `ts-expect-error: "allow-with-description"`,
  `@eslint-community/eslint-comments/require-description: "error"`; y un bloque para
  `backend/src/domain/**/*.ts` con `no-restricted-imports` que prohíbe `express`, `mongoose`,
  `mongodb`, `node:fs`, `fs`, `node:fs/promises`, `node:http`, `http`, `node:net`, `net`,
  `node:child_process`, `child_process`, `node:os`, `os` con mensaje
  "domain/ es puro: sin Express, Mongoose ni IO (principio III)" (R14).
- [X] T007 [P] Crear `backend/.env.example` con `PORT=3000`, `HOST=0.0.0.0`, `# MONGO_URI=`
  (comentada, con un ejemplo `mongodb://localhost:27017/ai-ticket-it`) y `LOG_LEVEL=info`, cada
  una con un comentario de una línea en español; el de `LOG_LEVEL` aclara que en los tests es
  siempre `silent` (FR-004, R4). Verificar que `.gitignore` ignora `.env`, `node_modules/` y la
  caché de binarios de mongodb-memory-server; agregar lo que falte.
- [X] T008 Ejecutar `npm install` en la raíz y verificar que `node_modules/@ai-ticket-it/shared`
  es un enlace al workspace `shared/` y que se generó un único `package-lock.json` en la raíz.

---

## Phase 2: Foundational (prerrequisitos bloqueantes)

**Purpose**: tipos compartidos, errores, configuración, tipos de dominio y el esqueleto de la
app sobre los que se apoyan todas las historias.

**⚠️ CRITICAL**: ninguna historia empieza hasta terminar esta fase.

- [X] T009 [P] Crear `shared/src/estado-compra.ts`: `export const EstadoCompra = { PENDIENTE:
  "PENDIENTE", CONFIRMADA: "CONFIRMADA", UTILIZADA: "UTILIZADA", CANCELADA: "CANCELADA",
  REEMBOLSADA: "REEMBOLSADA" } as const;` y `export type EstadoCompra = (typeof
  EstadoCompra)[keyof typeof EstadoCompra];` (FR-003, data-model "EstadoCompra").
- [X] T010 [P] Crear `shared/src/errores.ts` con `interface DetalleError { campo: string;
  mensaje: string }` e `interface ErrorApi { error: { codigo: string; mensaje: string;
  detalles?: DetalleError[] } }` (contracts/api.md "Tipos").
- [X] T011 [P] Crear `shared/src/salud.ts` con `type Almacenamiento = "memoria" | "externo"` e
  `interface SaludVista { estado: "ok"; almacenamiento: Almacenamiento }`.
- [X] T012 [P] Crear `shared/src/usuario.ts` con `interface UsuarioVista { id: string; nombre:
  string; apellido: string; cantidadEventosOrganizados: number }` (comentario: cuenta todos
  sus eventos, pasados y futuros).
- [X] T013 Crear `shared/src/index.ts` que reexporta todo lo de T009–T012 (valores con
  `export`, tipos con `export type`).
- [X] T014 Crear `backend/src/errors/index.ts` (depende de T013): clase base
  `ErrorAplicacion extends Error` con `status: number`, `codigo: string`, `mensaje: string`,
  `detalles?: DetalleError[]` (tipo de `@ai-ticket-it/shared`), y subclases con sus defaults
  (R9): `EntradaInvalidaError` (400, `ENTRADA_INVALIDA`, "Los datos enviados no son válidos.",
  recibe `detalles`), `UsuarioNoIdentificadoError` (401, `USUARIO_NO_IDENTIFICADO`,
  "Tenés que indicar un usuario válido."), `SinPermisoError` (403, `SIN_PERMISO`),
  `NoEncontradoError` (404, recibe `codigo` y `mensaje`, por ejemplo `USUARIO_NO_ENCONTRADO`),
  `ConflictoError` (409, recibe `codigo` y `mensaje`).
- [X] T015 [P] Escribir `backend/tests/domain/env.test.ts` (debe fallar) sobre
  `parsearEnv(fuente)`, importada de `backend/src/config/env-esquema.ts` (no de `env.ts`, que
  tiene efectos al importarse): con un objeto vacío devuelve `PORT 3000`, `HOST "0.0.0.0"`,
  `MONGO_URI undefined` y `LOG_LEVEL "info"`; con `NODE_ENV: "test"` y sin `LOG_LEVEL` devuelve
  `"silent"`; con `{ NODE_ENV: "test", LOG_LEVEL: "info" }` devuelve `"silent"` (en test es
  siempre `silent`); con `PORT: "abc"` o `LOG_LEVEL: "debug"` lanza un error cuyo mensaje
  nombra la variable; `MONGO_URI: ""` se trata como ausente.
- [X] T016 Implementar `backend/src/config/env-esquema.ts` (puro, sin IO): `parsearEnv(fuente)`
  con un esquema zod — `PORT` entero 1–65535 default 3000 con coerción, `HOST` default
  `"0.0.0.0"`, `MONGO_URI` opcional con `""` → `undefined`, `LOG_LEVEL` `"info" | "silent"`
  default `"info"` — y, si `fuente.NODE_ENV === "test"`, `LOG_LEVEL` es `"silent"` aunque venga
  otro valor. Un valor inválido lanza un error en español con el nombre de la variable (R4).
  Hace pasar T015.
- [X] T017 Implementar `backend/src/config/env.ts` (depende de T016): si
  `process.env.NODE_ENV !== "test"` y existe el archivo
  `path.resolve(import.meta.dirname, "../../.env")`, llama a `process.loadEnvFile(ruta)`
  (**nunca** resolver desde `process.cwd()`); después `export const env =
  parsearEnv(process.env)`. Así los tests no dependen del `.env` local (R4).
- [X] T018 Crear `backend/src/config/logger.ts` (depende de T017): objeto `logger` con
  `info(mensaje)` y `error(mensaje, error?)` que escriben con `console.log` / `console.error`, y
  no escriben nada cuando `env.LOG_LEVEL === "silent"`. Exportado como objeto para que los
  tests puedan espiarlo con `vi.spyOn` (R11).
- [X] T019 [P] Crear los tipos de dominio puros (data-model.md): `backend/src/domain/usuario.ts`
  (`interface Usuario { id: string; nombre: string; apellido: string; favoritos: string[] }`),
  `backend/src/domain/categoria.ts` (`interface Categoria { id: string; nombre: string;
  descripcion: string }`) y `backend/src/domain/evento.ts` (`interface TipoEntrada { id:
  string; nombre: string; descripcion: string; precio: number; cupo: number }` con comentario
  "precio: pesos enteros ≥ 0; cupo: entradas disponibles, entero ≥ 0, decrece con cada compra";
  `interface Evento { id: string; nombre: string; descripcion: string; categoriaId: string;
  fechaHora: Date; multimedia: string[]; organizadorId: string; tiposEntrada: TipoEntrada[] }`).
- [X] T020 [P] Crear `backend/src/types/express.d.ts`: declaración de módulo de
  `express-serve-static-core` que agrega a `Request` `usuario?: Usuario` (de
  `domain/usuario.ts`) y `validado?: { params?: unknown; query?: unknown; body?: unknown }`
  (R7, R8), sin `any`.
- [X] T021 Crear `backend/src/routes/index.ts` que exporta `crearRouterApi()` devolviendo un
  `express.Router()` vacío (las historias le montan sus rutas).
- [X] T022 Crear `backend/src/app.ts` con `crearApp(opciones: { almacenamiento:
  Almacenamiento })` (tipo de `shared`): crea la app de Express, guarda
  `app.locals.almacenamiento`, desactiva el encabezado `X-Powered-By`
  (`app.disable("x-powered-by")`, para no anunciar el framework en la red), aplica
  `express.json({ limit: "100kb" })` (R10) y monta
  `crearRouterApi()` en `/api`. **No** llama a `listen` (depende de T021).

**Checkpoint**: `npm run typecheck` y `npm run lint` pasan; `npm test` corre `env.test.ts` en
verde.

---

## Phase 3: User Story 1 — Arrancar el servidor con datos de ejemplo (Priority: P1) 🎯 MVP

**Goal**: `npm install` + `npm start` levantan el servidor en memoria con el seed determinista,
accesible desde la red local; `GET /api/salud` responde; existe `npm run seed -- --forzar` para
una base real. Incluye el modelo de persistencia (FR-012), que el seed es el primero en usar.

**Independent Test**: `npm test` pasa `datos-ejemplo`, `seed-opciones`, `direcciones`,
`fallas-arranque`, `modelos`, `seed`, `salud` y `db`; `npm start` imprime las direcciones Local
y Red y "MongoDB en memoria con datos de ejemplo"; `curl http://localhost:3000/api/salud`
devuelve `{"estado":"ok","almacenamiento":"memoria"}`, también desde otro dispositivo de la red.
El listado de usuarios precargados se verifica al completar US2 (clarificación de la spec).

### Tests for User Story 1 ⚠️

> Escribirlos primero y verlos fallar antes de implementar.

- [X] T023 [P] [US1] Escribir `backend/tests/domain/datos-ejemplo.test.ts` sobre
  `crearDatosEjemplo(ahora)` con un `ahora` fijo (FR-008, FR-009, data-model "Datos de
  ejemplo"): ≥ 5 categorías (son 6); ≥ 4 usuarios con ≥ 2 que organizan y ≥ 1 que no organiza
  (son 5: 101–103 organizan 3, 3 y 2; 104 y 105 ninguno); ≥ 8 eventos de ≥ 2 organizadores y
  distintas categorías, cada uno con ≥ 1 tipo de entrada; ≥ 2 eventos con `fechaHora < ahora`;
  ≥ 1 en `(ahora, ahora + 48 h]`; ≥ 1 con varios tipos; ≥ 1 tipo con `cupo <= 3`;
  `max(precio) / min(precio) >= 10`; todos los precios y cupos son enteros ≥ 0; todos los ids
  son de 24 hex, únicos y siguen los prefijos (`…0001xx` usuarios, `…0002xx` categorías,
  `…0003xx` eventos, `…0004xx` tipos); dos llamadas con el mismo `ahora` devuelven los mismos
  ids y datos; con `ahora` desplazado 7 días las fechas se desplazan 7 días; todo
  `organizadorId` y `categoriaId` referencia un id existente; los `favoritos` están vacíos.
- [X] T024 [P] [US1] Escribir `backend/tests/domain/seed-opciones.test.ts` sobre
  `planificarSeed(argv, mongoUri)` (R6): sin `mongoUri` → `{ accion: "abortar" }` con mensaje
  que explica que hace falta `MONGO_URI`; con `mongoUri` y sin `--forzar` → `"abortar"` con un
  mensaje que incluye host y nombre de la base, nombra `categorias`, `usuarios` y `eventos` y
  explica `npm run seed -- --forzar`; el mensaje **no** contiene usuario ni contraseña de una
  URI `mongodb+srv://usr:clave@cluster0.x.mongodb.net/ticket`; con `--forzar` →
  `{ accion: "cargar", destino }`.
- [X] T025 [P] [US1] Ampliar `backend/tests/domain/seed-opciones.test.ts` con `ejecutarSeed(deps)`,
  donde `deps = { argv, mongoUri, conectar, cargar, desconectar, escribir, escribirError }` y
  todas las funciones son `vi.fn()`: sin `--forzar` o sin `mongoUri` → devuelve `1` y **no**
  llama a `conectar`, `cargar` ni `desconectar`, y `escribirError` recibe el mensaje; con
  `--forzar` → llama en orden a `conectar(mongoUri)`, `cargar()` y `desconectar()` y devuelve
  `0`; si `cargar` rechaza → igual llama a `desconectar`, devuelve `1` y avisa por
  `escribirError` (FR-007: sin confirmación no modifica nada).
- [X] T026 [P] [US1] Escribir `backend/tests/domain/direcciones.test.ts` sobre
  `direccionesDeRed(interfaces)` (recibe un objeto con la forma de `os.networkInterfaces()`):
  devuelve solo las IPv4 no internas (descarta `127.0.0.1`, IPv6 y `internal: true`), sin
  duplicados; con un objeto vacío devuelve `[]`.
- [X] T027 [P] [US1] Escribir `backend/tests/domain/fallas-arranque.test.ts` sobre
  `mensajeFallaArranque(error: unknown, puerto: number)` (FR-011): un error con
  `code: "EADDRINUSE"` → "El puerto 3000 ya está en uso"; un `ErrorArranque` → su propio
  mensaje; cualquier otro `Error` → "No se pudo arrancar el servidor: <message>"; un valor que
  no es `Error` (por ejemplo, un string) no rompe la función.
- [X] T028 [US1] Crear `backend/tests/api/helpers/base-de-prueba.ts` con
  `usarBaseDePrueba(opciones: { sembrar?: boolean } = {})` (`sembrar` default `true`) que
  registra: `beforeAll` → crea su propio `MongoMemoryServer` y `mongoose.connect(uri)`;
  `beforeEach` → si `sembrar`, `cargarSeed()`; si no, vacía todas las colecciones;
  `afterAll` → `mongoose.disconnect()` y `servidor.stop()`. `cargarSeed` se importa con
  `await import("../../../src/seed/cargar-seed")` **dentro** del `beforeEach` y solo si
  `sembrar`: así un test con `{ sembrar: false }` no depende de que exista el seed (evita el
  ciclo T029 → T033 → T035). Cada archivo de `tests/api/` lo llama una vez (R13).
- [X] T029 [P] [US1] Escribir `backend/tests/api/modelos.test.ts` (usa T028 con
  `usarBaseDePrueba({ sembrar: false })`, porque los modelos se prueban antes de que exista el
  seed; antes de los casos, `await CategoriaModel.init()` para que exista el índice único):
  `EventoModel.create(...)` con un evento válido funciona y variantes con `precio: 1.5`,
  `precio: -1`, `cupo: -1`, `cupo: 2.5`, `tiposEntrada: []`, sin `categoria` o sin
  `organizador` se rechazan con `ValidationError`; un evento válido guardado no tiene `__v` y
  cada tipo de entrada tiene `_id` propio; crear dos categorías con `nombre: "Música"` (la
  segunda es el duplicado; ambas creadas en el test) falla con código `11000`; `UsuarioModel.create` sin `nombre` falla y con
  `nombre: "  Ana  "` guarda `"Ana"` (FR-012, data-model).
- [X] T030 [P] [US1] Escribir `backend/tests/api/seed.test.ts` (usa T028): después de
  `cargarSeed()` las colecciones `categorias`, `usuarios` y `eventos` tienen exactamente 6, 5 y
  8 documentos con los ids de `crearDatosEjemplo`; correrlo dos veces seguidas no duplica nada;
  un usuario y una categoría extra insertados a mano antes de `cargarSeed()` desaparecen
  (clarificación 1); los documentos no tienen `__v`.
- [X] T031 [P] [US1] Escribir `backend/tests/api/salud.test.ts` (usa T028):
  `GET /api/salud` contra `supertest(crearApp({ almacenamiento: "memoria" }))` responde 200
  `{ estado: "ok", almacenamiento: "memoria" }` con `Content-Type` JSON; con
  `almacenamiento: "externo"` responde `"externo"`; con un `X-Usuario-Id` inválido responde
  igual 200 (endpoint público, edge case); la respuesta **no** incluye el encabezado
  `X-Powered-By`.
- [X] T032 [P] [US1] Escribir `backend/tests/api/db.test.ts` (no usa el helper: maneja su
  propia conexión y llama a `desconectarBase()` en `afterEach`) (FR-005, FR-006, FR-011):
  `conectarBase("mongodb://usr:clave@127.0.0.1:1/x", { timeoutMs: 500 })` rechaza con un
  `ErrorArranque` cuyo mensaje contiene "No se pudo conectar a MONGO_URI" y "127.0.0.1" y **no**
  contiene "clave" ni "usr", y `mongoose.connection.readyState` queda en `0` (no cayó a
  memoria); con `vi.spyOn(MongoMemoryServer, "create").mockRejectedValue(new Error("download
  failed"))`, `conectarBase(undefined)` rechaza con un mensaje que contiene "la primera
  ejecución necesita internet"; `conectarBase(undefined)` resuelve
  `{ almacenamiento: "memoria" }` y `desconectarBase()` deja `readyState` en `0`.

### Implementation for User Story 1

- [X] T033 [US1] Crear los modelos de Mongoose en `backend/src/repositories/models/` con
  `versionKey: false` y colección explícita (depende de T019 y T029):
  - `usuario.model.ts` → colección `usuarios`: `nombre` "`String`, requerido, trim",
    `apellido` "`String`, requerido, trim", `favoritos` "`[ObjectId]`, ref `Evento`, default
    `[]`".
  - `categoria.model.ts` → colección `categorias`: `nombre` "`String`, requerido, trim,
    **único**", `descripcion` "`String`, requerido".
  - `evento.model.ts` → colección `eventos`: `nombre` "`String`, requerido, trim",
    `descripcion` "`String`, requerido", `categoria` "`ObjectId`, ref `Categoria`, requerido",
    `fechaHora` "`Date`, requerido", `multimedia` "`[String]`, default `[]`", `organizador`
    "`ObjectId`, ref `Usuario`, requerido", `tiposEntrada` subdocumentos embebidos (con `_id`
    propio) con validador de "al menos 1". Subesquema TipoEntrada: `nombre` "`String`,
    requerido, trim", `descripcion` "`String`, default `""`", `precio` "`Number`, requerido,
    **entero**, `min: 0`", `cupo` "`Number`, requerido, entero, `min: 0`" (enteros con
    validador `Number.isInteger`). Índices `{ organizador: 1 }` y `{ categoria: 1 }`.
  Hace pasar T029.
- [X] T034 [P] [US1] Implementar `backend/src/seed/datos-ejemplo.ts`: función pura
  `crearDatosEjemplo(ahora: Date): { categorias: Categoria[]; usuarios: Usuario[]; eventos:
  Evento[] }` con exactamente los datos de la tabla de data-model.md "Datos de ejemplo": ids
  "18 ceros + 4 dígitos de tipo + 2 de número" (usuario 1 = `000000000000000000000101`, tipos
  de entrada numerados en orden de aparición `…000401`, `…000402`, …); usuarios Lucía Álvarez,
  Martín Benítez, Sofía Castro, Diego Fernández y Valentina Gómez; categorías Música, Teatro,
  Deportes, Conferencias, Festivales y Stand-up (cada una con descripción); los 8 eventos con
  categoría, organizador, tipos (precio / cupo) y fecha de la tabla. Fecha: día de `ahora` en
  `America/Argentina/Buenos_Aires` (obtenerlo con `Intl.DateTimeFormat`) + N días a la hora
  local indicada (Argentina es UTC−3 sin horario de verano); el evento 01 va a `ahora + 24 h`
  redondeado a la hora. Cada evento con 1 o 2 URLs `https://picsum.photos/seed/<slug>/800/450`.
  Sin IO. Hace pasar T023.
- [X] T035 [US1] Implementar `backend/src/seed/cargar-seed.ts`: `cargarSeed(ahora = new Date())`
  hace `deleteMany({})` en los modelos de usuarios, categorías y eventos y luego `insertMany`
  con lo de `crearDatosEjemplo(ahora)`, mapeando `id` → `_id`, `categoriaId` → `categoria` y
  `organizadorId` → `organizador` (ObjectId). Hace pasar T030.
- [X] T036 [P] [US1] Implementar `backend/src/scripts/seed-opciones.ts` (sin importar `env` ni
  Mongoose): función pura `planificarSeed(argv: string[], mongoUri: string | undefined)` que
  devuelve `{ accion: "abortar"; mensaje: string } | { accion: "cargar"; destino: string }`,
  donde `destino` es `host/base` extraído con `new URL()` sin credenciales; y
  `ejecutarSeed(deps): Promise<number>` que usa `planificarSeed`, solo conecta/carga/desconecta
  si la acción es `"cargar"`, informa cuántas categorías, usuarios y eventos cargó, desconecta
  también si falla la carga (`finally`) y devuelve el código de salida. Hace pasar T024 y T025.
- [X] T037 [US1] Implementar `backend/src/scripts/seed.ts` (comando `npm run seed`), sin lógica
  propia: `process.exitCode = await ejecutarSeed({ argv: process.argv.slice(2), mongoUri:
  env.MONGO_URI, conectar: (uri) => mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 }),
  cargar: () => cargarSeed(), desconectar: () => mongoose.disconnect(), escribir: console.log,
  escribirError: console.error })` (FR-007).
- [X] T038 [P] [US1] Implementar `backend/src/config/direcciones.ts`: `direccionesDeRed(
  interfaces = os.networkInterfaces())` según T026. Hace pasar T026.
- [X] T039 [P] [US1] Implementar `backend/src/config/fallas-arranque.ts`: clase
  `ErrorArranque extends Error` (no es un `ErrorAplicacion`: no es HTTP) y
  `mensajeFallaArranque(error, puerto)` según T027. Hace pasar T027.
- [X] T040 [US1] Implementar `backend/src/config/db.ts` (R5, depende de T039):
  `conectarBase(mongoUri: string | undefined = env.MONGO_URI, opciones: { timeoutMs?: number }
  = {}): Promise<{ almacenamiento: Almacenamiento }>` (`timeoutMs` default `5000`). Con
  `mongoUri` conecta con `serverSelectionTimeoutMS: timeoutMs` y devuelve `"externo"`; sin ella
  crea el servidor en memoria con `MongoMemoryServer.create()` (estático, para que el test pueda
  espiarlo) en modo standalone, conecta y devuelve `"memoria"`. Las fallas se lanzan como
  `ErrorArranque` con mensaje en español: "No se pudo conectar a MONGO_URI (<host>)" sin
  credenciales, y "No se pudo preparar MongoDB en memoria; la primera ejecución necesita
  internet para descargarlo". **Nunca** cae a memoria si hay `mongoUri`.
  `desconectarBase()` cierra Mongoose y detiene el servidor en memoria si existe. Hace pasar
  T032.
- [X] T041 [US1] Implementar `backend/src/controllers/salud.controller.ts` (`obtenerSalud(req,
  res)` responde `SaludVista` con `req.app.locals.almacenamiento`) y
  `backend/src/routes/salud.routes.ts` (`GET /` → controller), y montarlo en `/salud` dentro de
  `crearRouterApi()` en `backend/src/routes/index.ts`. Hace pasar T031.
- [X] T042 [US1] Implementar `backend/src/server.ts` (R5, FR-005, FR-006, FR-010, FR-011):
  `conectarBase()` → si `"memoria"`, `cargarSeed()` → `crearApp({ almacenamiento })` →
  `app.listen(env.PORT, env.HOST)` → imprime con `console.log` (no con el logger, para que se
  vea aunque `LOG_LEVEL=silent`) "AI Ticket It API escuchando", `Local: http://localhost:<PORT>/api`,
  una línea `Red:   http://<ip>:<PORT>/api` por cada `direccionesDeRed()` y
  "Almacenamiento: MongoDB en memoria con datos de ejemplo" o "Almacenamiento: MongoDB externo".
  Ante cualquier falla de arranque (incluido el evento `error` del servidor HTTP, por ejemplo
  `EADDRINUSE`) → `console.error(mensajeFallaArranque(error, env.PORT))`, `desconectarBase()` y
  `process.exit(1)`. `SIGINT`/`SIGTERM` cierran el servidor HTTP y llaman a `desconectarBase()`.
- [X] T043 [US1] Verificar a mano US1 con `npm start` desde la raíz: salida de arranque como en
  contracts/api.md, `curl http://localhost:3000/api/salud`, consulta desde el celular a la
  dirección `Red`, y tres reinicios con los mismos datos (quickstart §1–§3, SC-005).

**Checkpoint**: el servidor arranca con datos de ejemplo y responde `/api/salud` local y en la
red; las pruebas de US1 están en verde.

---

## Phase 4: User Story 2 — Base de servidor predecible para construir features (Priority: P1)

**Goal**: comportamiento transversal (identificación, validación, registro de pedidos, 404,
error handler con formato único, 413 y JSON inválido) y el recurso Usuarios recorriendo todas
las capas como referencia.

**Independent Test**: `npm test` pasa `usuario.test.ts`, `usuarios.test.ts` y
`errores.test.ts`: listado ordenado, usuario por id, usuario actual, 400/401/404/413/500 y JSON
inválido con el formato único, y registro de cada pedido.

> Depende de US1 por el seed y los modelos (`cargarSeed` en el helper de tests) y por
> `/api/salud`, que usan los tests de JSON inválido y 413.

### Tests for User Story 2 ⚠️

> Escribirlos primero y verlos fallar antes de implementar.

- [X] T044 [P] [US2] Escribir `backend/tests/domain/usuario.test.ts` sobre
  `compararPorApellidoYNombre` (clarificación 3, R12): ordena por apellido y luego por nombre;
  "Álvarez" queda antes que "Benítez" y "alvarez" empata con "Álvarez" en el apellido (sin
  distinguir mayúsculas ni tildes); con igual apellido decide el nombre; no muta el arreglo si
  se usa con `toSorted`.
- [X] T045 [P] [US2] Escribir `backend/tests/api/usuarios.test.ts` (usa el helper de T028,
  `supertest(crearApp({ almacenamiento: "memoria" }))`), contra contracts/api.md:
  - `GET /api/usuarios` → 200 con los 5 usuarios en orden Álvarez, Benítez, Castro, Fernández,
    Gómez y `cantidadEventosOrganizados` 3, 3, 2, 0, 0; cada elemento tiene **exactamente** las
    claves `id`, `nombre`, `apellido`, `cantidadEventosOrganizados`; `id` es string; no aparecen
    `_id`, `__v` ni `favoritos` (FR-014, FR-022).
  - Un evento extra en el pasado para Diego (insertado en el test) suma 1 a su cantidad
    (clarificación 4).
  - `GET /api/usuarios/000000000000000000000101` → 200 Lucía Álvarez con 3.
  - `GET /api/usuarios/0000000000000000000009ff` → 404 `USUARIO_NO_ENCONTRADO`.
  - `GET /api/usuarios/123` → 400 `ENTRADA_INVALIDA` con un detalle `campo: "params.id"`.
  - `GET /api/usuarios/actual` con `X-Usuario-Id: 000000000000000000000101` → 200 Lucía.
  - `GET /api/usuarios/actual` sin encabezado, con encabezado vacío, con `abc` y con
    `0000000000000000000009ff` → 401 `USUARIO_NO_IDENTIFICADO` en los cuatro casos.
  - `GET /api/usuarios` con `X-Usuario-Id: abc` → 200 (público, ignora el encabezado).
  - Todo cuerpo de error cumple `ErrorApi`: `error.codigo` y `error.mensaje` strings no vacíos.
- [X] T046 [P] [US2] Escribir `backend/tests/api/errores.test.ts` (usa el helper de T028),
  contra contracts/api.md "Errores":
  - `GET /api/no-existe` → 404 `RUTA_NO_ENCONTRADA`; `DELETE /api/salud` → 404
    `RUTA_NO_ENCONTRADA`.
  - `POST /api/salud` con `Content-Type: application/json` y cuerpo `{mal` → 400
    `JSON_INVALIDO`.
  - `POST /api/salud` con un JSON de más de 100 kB → 413 `CUERPO_DEMASIADO_GRANDE`.
  - Con `vi.spyOn(usuarioService, "listar").mockRejectedValue(new Error("secreto interno"))`,
    `GET /api/usuarios` → 500 `ERROR_INTERNO`, mensaje "Ocurrió un error inesperado.", y el
    cuerpo no contiene "secreto interno" ni `stack`; `logger.error` se llamó con el error.
  - Con `vi.spyOn(logger, "info")`, un `GET /api/salud` registra una línea con `GET`,
    `/api/salud`, `200` y una duración terminada en `ms` (FR-021).
  - Restaurar los espías en `afterEach` (`vi.restoreAllMocks()`).

### Implementation for User Story 2

- [X] T047 [US2] Agregar `compararPorApellidoYNombre(a, b)` a `backend/src/domain/usuario.ts`
  usando un `Intl.Collator("es", { sensitivity: "base" })` a nivel de módulo: compara
  `apellido` y, si empatan, `nombre`. Hace pasar T044.
- [X] T048 [P] [US2] Crear `backend/src/routes/schemas/comunes.ts` con `idSchema` (zod: string
  de exactamente 24 caracteres hexadecimales, mensaje "Debe ser un identificador válido.") y la
  función `esIdValido(valor: string): boolean` que lo reutiliza (R7).
- [X] T049 [P] [US2] Crear `backend/src/middlewares/validar.ts` (FR-017, R7):
  - `validar({ params?, query?, body? })` recibe esquemas zod, parsea cada parte presente de
    `req` con `safeParse`, junta todos los problemas como
    `{ campo: "<parte>.<ruta.con.puntos>", mensaje }` y lanza `EntradaInvalidaError(detalles)`
    si hay alguno; si no, guarda los valores parseados en `req.validado` (no muta `req.query`,
    que en Express 5 es solo lectura).
  - `leerValidado<T>(req, parte: "params" | "query" | "body", esquema: z.ZodType<T>): T`, que
    devuelve `esquema.parse(req.validado?.[parte])`, con el comentario "re-parsea lo ya
    validado para recuperar el tipo sin casts; si falla, es un error de programación (ruta sin
    `validar`) → 500".
- [X] T050 [P] [US2] Crear `backend/src/middlewares/registrar-pedido.ts`: toma
  `process.hrtime.bigint()` al entrar y en `res.on("finish")` llama a
  `logger.info("<MÉTODO> <req.originalUrl> <status> <ms con 1 decimal>ms")` (FR-021, R11).
- [X] T051 [P] [US2] Crear `backend/src/middlewares/ruta-no-encontrada.ts`: lanza
  `NoEncontradoError("RUTA_NO_ENCONTRADA", "No existe la ruta <MÉTODO> <ruta>.")` (FR-020).
- [X] T052 [P] [US2] Crear `backend/src/middlewares/manejar-errores.ts` (error handler de 4
  argumentos, respuesta tipada como `ErrorApi` de `shared`) (FR-018, FR-019, R9):
  `ErrorAplicacion` → su `status` y `{ error: { codigo, mensaje, detalles? } }` (sin
  `detalles` si no hay); error con `type === "entity.parse.failed"` → 400 `JSON_INVALIDO`
  "El cuerpo del pedido no es JSON válido."; `type === "entity.too.large"` → 413
  `CUERPO_DEMASIADO_GRANDE` "El cuerpo del pedido supera el máximo de 100 kB."; cualquier otro
  → `logger.error(...)` con el error completo y 500 `ERROR_INTERNO` "Ocurrió un error
  inesperado." sin trazas. Si `res.headersSent`, delega en `next(error)`.
- [X] T053 [US2] Cablear en `backend/src/app.ts` (depende de T050–T052): `registrarPedido`
  **antes** de `express.json` (para registrar también los 400/413 del parser), después el
  router `/api`, luego `rutaNoEncontrada` y por último `manejarErrores`.
- [X] T054 [P] [US2] Crear `backend/src/repositories/usuario.repository.ts` como objeto
  `usuarioRepository` con `listar(): Promise<Usuario[]>` y `buscarPorId(id): Promise<Usuario |
  null>`, ambos con `.lean()` y `aDominio()` (`_id` → `id`, `favoritos` → `string[]`).
- [X] T055 [P] [US2] Crear `backend/src/repositories/evento.repository.ts` como objeto
  `eventoRepository` con `contarPorOrganizador(ids: string[]): Promise<Map<string, number>>`
  usando **una** agregación (`$match` por `organizador: { $in }` + `$group` por organizador);
  los ids sin eventos no aparecen (el service usa 0). Los ids se convierten con
  `new Types.ObjectId(id)` antes del `$match`, y la clave del `Map` vuelve a string:
  `aggregate()` **no** aplica el casteo del esquema y con strings no matchearía nada (R12). Cuenta todos los eventos, pasados y
  futuros (clarificación 4). Comentario: lo amplían 003/004.
- [X] T056 [US2] Crear `backend/src/services/usuario.service.ts` como objeto `usuarioService`
  (exportado como objeto para poder espiarlo, R13) con: `listar(): Promise<UsuarioVista[]>`
  (trae usuarios, cuenta eventos en una sola llamada, ordena con
  `toSorted(compararPorApellidoYNombre)` y mapea con una función explícita `aVista(usuario,
  cantidad)`, nunca `{ ...usuario }`); `obtenerVista(id): Promise<UsuarioVista>` (lanza
  `NoEncontradoError("USUARIO_NO_ENCONTRADO", "No existe el usuario.")` si no existe); y
  `buscarPorId(id): Promise<Usuario | null>` (dominio, para el middleware).
- [X] T057 [US2] Crear `backend/src/middlewares/requerir-usuario.ts` (FR-016, R8):
  - `requerirUsuario` lee `req.get("X-Usuario-Id")` y recorta espacios; si falta, está vacío,
    `!esIdValido(...)` o `usuarioService.buscarPorId` devuelve `null` → lanza
    `UsuarioNoIdentificadoError`; si no, deja el usuario en `req.usuario`.
  - `usuarioActual(req): Usuario` devuelve `req.usuario` o lanza `UsuarioNoIdentificadoError`
    si falta.
- [X] T058 [P] [US2] Crear `backend/src/routes/usuarios.schemas.ts` con
  `export const usuarioPorIdSchema = { params: z.object({ id: idSchema }) }`.
- [X] T059 [US2] Crear `backend/src/controllers/usuario.controller.ts` (handlers `async`, sin
  `try/catch`, respuestas tipadas con `UsuarioVista` de `shared`, **sin `as` ni `!`**):
  `listar` → 200 con `usuarioService.listar()`; `obtenerPorId` → responde
  `usuarioService.obtenerVista(leerValidado(req, "params", usuarioPorIdSchema.params).id)`;
  `obtenerActual` → responde `usuarioService.obtenerVista(usuarioActual(req).id)`.
- [X] T060 [US2] Crear `backend/src/routes/usuarios.routes.ts` en este orden: `GET /` →
  `listar`; `GET /actual` → `requerirUsuario`, `obtenerActual` (declarada **antes** que `/:id`);
  `GET /:id` → `validar(usuarioPorIdSchema)`, `obtenerPorId`. Montarlo en `/usuarios` dentro de
  `crearRouterApi()` en `backend/src/routes/index.ts`. Hace pasar T045 y T046.

**Checkpoint**: `npm test` en verde con US1 y US2; los curl de quickstart §4 dan los códigos
esperados y la consola muestra una línea por pedido.

---

## Phase 5: User Story 3 — Verificar calidad con tres comandos (Priority: P2)

**Goal**: `npm test`, `npm run lint` y `npm run typecheck` desde la raíz cubren `backend` y
`shared`, terminan en verde y fallan ante errores introducidos a propósito.

**Independent Test**: los tres comandos terminan en verde desde la raíz; un `any` en
`backend/src/` hace fallar el lint, un import de `mongoose` en `backend/src/domain/` también, y
un cambio incompatible en `EstadoCompra` hace fallar el typecheck del backend.

### Tests for User Story 3 ⚠️

- [X] T061 [P] [US3] Escribir `backend/tests/domain/tipos-compartidos.test.ts` (US3-2, R13):
  importa `EstadoCompra` de `@ai-ticket-it/shared`; `expect(Object.values(EstadoCompra))`
  igual a `["PENDIENTE", "CONFIRMADA", "UTILIZADA", "CANCELADA", "REEMBOLSADA"]`, y
  `expectTypeOf<EstadoCompra>().toEqualTypeOf<"PENDIENTE" | "CONFIRMADA" | "UTILIZADA" |
  "CANCELADA" | "REEMBOLSADA">()`; además asigna un `UsuarioVista` y un `ErrorApi` literales
  tipados para que un cambio de forma en `shared` rompa `npm run typecheck`.

### Implementation for User Story 3

- [X] T062 [US3] Comprobación negativa, revirtiendo cada cambio después (quickstart §7):
  agregar `const x: any = 1` en `backend/src/app.ts` → `npm run lint` falla; agregar
  `import mongoose from "mongoose"` en `backend/src/domain/usuario.ts` → `npm run lint` falla
  con el mensaje de `no-restricted-imports`; agregar `// eslint-disable-next-line` sin
  descripción → `npm run lint` falla; renombrar `REEMBOLSADA` en
  `shared/src/estado-compra.ts` → `npm run typecheck` falla en el backend. Ajustar
  `eslint.config.js` o `backend/tsconfig.json` si alguna no falla.
- [X] T063 [US3] Correr `npm test`, `npm run lint` y `npm run typecheck` desde la raíz:
  los tres en verde, `typecheck` recorre `backend` y `shared`, y la suite del backend tarda
  menos de 1 minuto con el binario ya descargado (SC-004). Corregir lo que falle.

**Checkpoint**: las tres historias funcionan y los comandos de calidad están en verde.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T064 [P] Actualizar `README.md` (FR-024): requisitos previos (Node ≥ 22.12, npm ≥ 10,
  internet la primera vez para descargar MongoDB ~100 MB); instalar (`npm install`); arrancar en
  memoria (`npm start`, `npm run dev`); usar una base real (`backend/.env` desde
  `backend/.env.example` con `MONGO_URI`); cargar datos de ejemplo con
  `npm run seed -- --forzar`, **advirtiendo** que vacía `categorias`, `usuarios` y `eventos` y
  que sin `--forzar` no hace nada; advertencia de que en una base real las fechas de los
  eventos envejecen y conviene volver a sembrar antes de una demo; consultar desde otro
  dispositivo con la dirección `Red` y paso a paso del Firewall de Windows Defender (permitir
  Node.js en redes privadas, red Wi-Fi marcada como privada); y `npm test`, `npm run lint`,
  `npm run typecheck` (aclarando que los tests no leen `backend/.env`).
- [X] T065 [P] Completar la sección "Comandos" de `AGENTS.md` con la tabla de comandos de
  contracts/api.md, la nota de que `npm run seed` exige `--forzar` y `MONGO_URI`, y el
  recordatorio de correr `npm test`, `npm run lint` y `npm run typecheck` antes de cerrar una
  tarea (FR-024).
- [X] T066 Revisar que `specs/001-base-backend/contracts/api.md` coincide con lo implementado
  (rutas, códigos, mensajes, salida de arranque); si algo cambió, actualizar el contrato
  (FR-025).
- [X] T067 Validar `specs/001-base-backend/quickstart.md` de punta a punta, incluidas §5 (con un
  MongoDB real: `npm run seed` sin `--forzar` sale con 1 sin borrar; con `--forzar` dos veces
  no duplica; `npm start` informa "MongoDB externo"; una `MONGO_URI` inaccesible termina en
  ~5 s con mensaje y código ≠ 0) y §6 (segundo `npm start` → "El puerto 3000 ya está en uso").
- [X] T068 Al abrir el PR de `feature/001-base-backend` a `development` con tests, lint y
  typecheck en verde, actualizar el estado de la feature 001 en `docs/backlog.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T008 (`npm install`) va después de T001–T007.
- **Foundational (Phase 2)**: depende de Setup; **bloquea** todas las historias.
- **US1 (Phase 3)**: depende de Foundational. Incluye los modelos de persistencia.
- **US2 (Phase 4)**: depende de Foundational y de US1 (modelos, `cargarSeed` en el helper de
  tests y `/api/salud`, que usan los tests de JSON inválido y 413).
- **US3 (Phase 5)**: depende de US1 y US2 (verifica la base completa).
- **Polish (Phase 6)**: depende de las tres historias.

### Within Each User Story

- Tests primero, verlos fallar, después implementar (principio II).
- Dominio y datos puros → modelos y repositories → services → middlewares → controllers →
  routes.
- `app.ts` y `routes/index.ts` se tocan en secuencia (T022 → T041 → T053 → T060), nunca en
  paralelo.

### Dependencias puntuales

- Foundational: T013 ← T009–T012 · T014 ← T013 · T016 ← T015 · T017 ← T016 · T018 ← T017 ·
  T022 ← T021.
- US1: T029, T030, T031 ← T028 · T033 ← T019, T029 · T034 ← T023 · T035 ← T030, T033, T034 ·
  T036 ← T024, T025 · T037 ← T035, T036 · T038 ← T026 · T039 ← T027 · T040 ← T032, T039 ·
  T041 ← T031 · T042 ← T035, T038, T039, T040, T041.
- US2: T047 ← T044 · T053 ← T050, T051, T052 · T056 ← T047, T054, T055 · T057 ← T048, T056 ·
  T059 ← T049, T056, T057, T058 · T060 ← T045, T046, T049, T057, T059.

### Parallel Opportunities

- Setup: T003–T007 en paralelo después de T001–T002.
- Foundational: T009–T012, T015, T019 y T020 en paralelo.
- US1: tests T023–T027 y T032 en paralelo; T029–T031 en paralelo una vez creado T028;
  T034, T036, T038 y T039 en paralelo con T033.
- US2: tests T044–T046 en paralelo; T048–T052, T054, T055 y T058 en paralelo.
- Polish: T064 y T065 en paralelo.

---

## Parallel Example: User Story 2

```bash
# Tests de US2 (escribir y ver fallar juntos):
Task: "Test de compararPorApellidoYNombre en backend/tests/domain/usuario.test.ts"
Task: "Tests de usuarios en backend/tests/api/usuarios.test.ts"
Task: "Tests de errores transversales en backend/tests/api/errores.test.ts"

# Piezas independientes de US2:
Task: "idSchema en backend/src/routes/schemas/comunes.ts"
Task: "Middleware validar y leerValidado en backend/src/middlewares/validar.ts"
Task: "Middleware registrarPedido en backend/src/middlewares/registrar-pedido.ts"
Task: "Middleware rutaNoEncontrada en backend/src/middlewares/ruta-no-encontrada.ts"
Task: "Error handler en backend/src/middlewares/manejar-errores.ts"
Task: "usuarioRepository en backend/src/repositories/usuario.repository.ts"
Task: "eventoRepository.contarPorOrganizador en backend/src/repositories/evento.repository.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1: Setup.
2. Phase 2: Foundational.
3. Phase 3: US1 → el servidor arranca con datos de ejemplo y responde `/api/salud`.
4. **Parar y validar** con T043 (quickstart §1–§3).

### Incremental Delivery

1. Setup + Foundational → base tipada, lint y tests corriendo.
2. US1 → servidor demostrable con seed (MVP).
3. US2 → contrato de API completo y recurso Usuarios de referencia; la feature 002 ya puede
   consumir el selector de usuario.
4. US3 → comandos de calidad verificados, incluidas las comprobaciones negativas.
5. Polish → README, AGENTS.md, contrato y quickstart al día; PR a `development`.

---

## Notes

- [P] = archivo distinto y sin dependencias pendientes.
- [USn] traza cada tarea con su historia de la spec.
- Commit por tarea o grupo coherente, con scope `001-base-backend`.
- Si aparece algo no especificado durante la implementación, se actualiza la spec (o sus
  clarificaciones) antes de seguir (principio I).

## Ajustes posteriores a la implementación (revisión)

- [X] R1 `crearValidacion` reemplaza `validar` + `leerValidado`: `leer` devuelve el valor ya
  transformado sin re-validarlo (con esquemas que transforman, la re-validación daba 500).
  Test: `backend/tests/api/validar.test.ts`.
- [X] R2 `repositories/errores-persistencia.ts` traduce `ValidationError`/`CastError` → 400 y
  duplicado `11000` → 409 `RECURSO_DUPLICADO`; el error handler lo usa antes del 500. Test:
  `backend/tests/api/errores-persistencia.test.ts`. Contrato actualizado.
- [X] R3 `idSchema` pasa a `middlewares/esquemas-comunes.ts` y la validación de usuarios a
  `controllers/usuario.schemas.ts`: ningún middleware ni controller importa de `routes/`.
- [X] R4 La salida de arranque muestra el nombre de la interfaz de cada dirección `Red`.

## Refactor estructural (revisión contra `ddso-utn/ejercicio-megasuper-2026`, constitución v1.2.0)

- [X] S1 Inyección de dependencias: clases `UsuarioRepository`/`EventoRepository` (implementan
  `domain/repositorios.ts`), `UsuarioService({ usuarios, eventos })`, `UsuarioController`,
  `SaludController(almacenamiento)`, `crearRequerirUsuario(buscador)` y rutas como fábricas;
  `app.ts` como composition root con `repositorios?` inyectables (R16). Test nuevo:
  `tests/services/usuario.service.test.ts`; errores y errores-persistencia inyectan un
  repositorio que falla en lugar de `vi.spyOn`.
- [X] S2 Dominio con comportamiento: clases `Usuario`, `Categoria`, `Evento`
  (`tuPrecioEstaEntre`) y `TipoEntrada` (`hayCupoPara`) con invariantes; repositories y seed
  construyen instancias (R17). Tests: `tests/domain/evento.test.ts`, `usuario.test.ts`,
  `datos-ejemplo.test.ts`.
- [X] S3 `registrarError` separado de `manejarErrores`, clasificación común en
  `traducir-error.ts`; `JsonInvalidoError` y `CuerpoDemasiadoGrandeError`; carpeta
  `validations/` (R18). Test: los 4xx no se registran como error inesperado.
- [X] S4 OpenAPI en `/api/docs` (Swagger UI) y `/api/docs/openapi.json`, colección de Postman
  (R19). Test: `tests/api/docs.test.ts`.

## Refactor estructural (revisión contra `ddso-utn/2026-2c-lu-sa-grupo-1`, constitución v1.3.0)

- [X] G1 Errores de dominio sin HTTP: `domain/errores.ts` (`DatosInvalidosError`,
  `ReglaDeNegocioError`), traducción en `traducir-error.ts` (400 / 409) y regla de lint que
  impide importar `errors/` desde `domain/` (R20). Tests: `tests/domain/errores.test.ts` y
  casos nuevos en `tests/api/errores.test.ts`.
- [X] G2 Repositorios en memoria en `tests/fakes/`, test de contrato
  `tests/api/repositorios.contrato.test.ts` y convención de nombres (`obtenerVista` →
  `obtener`, `#obtenerOFallar`) documentada en AGENTS.md y en la skill `nuevo-endpoint` (R21).
- [X] G3 Prettier (`format`, `format:check`) y CI en `.github/workflows/ci.yml` (R22).

## Persistencia en memoria pura (constitución v2.0.0, research R23)

### F3. Repositorios en memoria en producción (TDD)

- [X] M01 Tests de `idSchema` (validations): acepta UUID v4 e ids legibles `<tipo>-<slug>`;
  rechaza `123`, `actual`, mayúsculas y 24 hex.
- [X] M02 `datos-ejemplo.test.ts`: ids legibles (`usuario-lucia`, `categoria-musica`,
  `evento-noche-de-rock`, `tipo-<evento>-<tipo>`), únicos y con su prefijo.
- [X] M03 `tests/repositories/`: `UsuarioRepository`, `CategoriaRepository` y
  `EventoRepository` en memoria (listar, buscarPorId → entidad o null, contarPorOrganizador) y
  `crearRepositoriosDeEjemplo` (5/6/8 entidades; cada llamada crea repositorios independientes).
- [X] M04 Implementar `validations/comunes.ts` (UUID o `<tipo>-<slug>`), ids legibles en
  `seed/datos-ejemplo.ts`, repositorios en memoria en `src/repositories/` y
  `seed/repositorios-de-ejemplo.ts`.
- [X] M05 `crearApp({ repositorios? })`: por defecto `crearRepositoriosDeEjemplo()`, cada uno
  reemplazable; `SaludController` sin almacenamiento y `SaludVista` = `{ estado: "ok" }`.
  Tests de API sin base (ids legibles, `usuario-inexistente` para el 404).
- [X] M06 Tests de services con los repositorios de `src/repositories/` (sin `tests/fakes/`).

### F4. Eliminar MongoDB

- [X] M07 Borrar modelos, `config/db.ts`, `config/destino-mongo.ts`, `ErrorArranque`,
  `repositories/errores-persistencia.ts`, `seed/cargar-seed.ts`, `scripts/`, `tests/fakes/`,
  el test de contrato, el helper de base y los tests de modelos, db, seed, seed-opciones y
  errores-persistencia.
- [X] M08 `server.ts` sin base (arranca con `crearApp()`), `MONGO_URI` fuera de
  `env-esquema.ts` y `.env.example`, sin la traducción de errores de Mongo, sin `mongoose` ni
  `mongodb-memory-server` en dependencias ni en la regla de lint, sin script `seed`.
- [X] M09 CI sin caché del binario; `vitest.config.ts` sin el `hookTimeout` de la descarga;
  `.gitignore` sin la caché de mongodb-memory-server.

### F5. Documentación de uso y cierre

- [X] M10 OpenAPI y colección de Postman con ids legibles y `SaludVista` sin almacenamiento.
- [X] M11 README, AGENTS.md y skill `nuevo-endpoint` sin MongoDB; backlog (decisiones abiertas
  que mencionaban Mongo).
- [X] M12 `npm test`, `lint`, `typecheck` y `format:check` en verde; prueba manual de
  quickstart §1–§4 y §6.
