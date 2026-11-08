---

description: "Tareas de implementación de la feature 002 — Base mobile"
---

# Tasks: Base mobile

**Input**: documentos de diseño en `specs/002-base-mobile/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/cliente-api.md](./contracts/cliente-api.md),
[contracts/app.md](./contracts/app.md), [quickstart.md](./quickstart.md)

**Tests**: obligatorios. La constitución (principio II) y FR-024 piden tests de la lógica con
comportamiento y de los componentes con comportamiento. Cada test se escribe primero, **se lo
ve fallar** y recién entonces se implementa. Los tests no usan servidor ni celular: `fetch`
falso inyectado, mock oficial de AsyncStorage y un `QueryClient` nuevo por test (FR-025).

**Organización**: las tareas se agrupan por historia de usuario de la spec (US1–US5). La capa
`src/api/`, la sesión pura y la secuencia de reintentos van en Foundational porque las usan
todas las historias. Por eso la fase de US4 solo verifica lo que esa historia promete.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: puede hacerse en paralelo (archivo distinto, sin dependencias pendientes).
- **[Story]**: historia a la que pertenece (US1–US5).
- Rutas relativas a la raíz del repo.

## Convenciones para todas las tareas

- `mobile/` **no** es `"type": "module"` (R2). Los archivos de configuración (`jest.config.js`)
  son CommonJS. El código fuente es TypeScript con imports sin extensión, e `import type` para
  los tipos.
- Prohibidos `any`, `@ts-ignore` y `eslint-disable` sin descripción (principio IX).
- Todo `fetch` vive en `mobile/src/api/` (y la referencia a `fetch` global en
  `mobile/src/composicion.tsx`); el lint lo controla (R13).
- Los tipos de contrato (`UsuarioVista`, `ErrorApi`, `DetalleError`) se importan de
  `@ai-ticket-it/shared`; nunca se redefinen en la app (FR-007).
- Toda dependencia ligada al SDK se agrega con `npx expo install <paquete>` desde `mobile/`
  (R1). Nada de librerías de UI ni de estado global (principio VII).
- Textos visibles en español y exactamente como en [contracts/app.md](./contracts/app.md).
  Controles sin texto con `accessibilityLabel`. Estilos con `StyleSheet` y flex, sin anchos
  fijos (360 px, FR-022).
- Sin `typedRoutes`: las rutas se escriben como strings literales (R11).
- **Test primero con stub en el mismo turno** (P1). El hook `Stop` exige typecheck y lint en
  verde al cerrar cada turno, y `mobile/tsconfig.json` incluye `tests/**`. Por eso, al escribir
  un test se crea en el mismo turno el módulo que importa, como **stub con la firma real** que
  lanza `new Error("no implementado")` (o un componente que devuelve `null`). El typecheck queda
  en verde y el test falla por comportamiento, que es la fase roja de TDD. La implementación
  reemplaza el stub después.
- Tests en `mobile/tests/` (nunca dentro de `mobile/app/`, R12). Con temporizadores:
  `jest.useFakeTimers()` y `await act(() => jest.advanceTimersByTimeAsync(ms))`.
- Commits: Conventional Commits con scope `002-base-mobile` (por ejemplo,
  `feat(002-base-mobile): cliente HTTP con tiempo límite`), uno por tarea o grupo coherente.

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: workspace `mobile/` creado, con dependencias, TypeScript, Jest, lint y formato
configurados.

- [X] T001 **(persona)** Verificar en el celular (Expo Go → Ajustes → "Supported SDK") qué
  SDK de Expo soporta el Expo Go de Android instalado y anotarlo en
  `specs/002-base-mobile/research.md` (R1, "SDK fijado: NN"). Ninguna tarea siguiente empieza
  sin este dato. **Resultado: SDK 58** (Expo Go 58.0.5, verificado el 2026-11-08).
- [X] T002 Generar `mobile/` desde la raíz con la plantilla mínima de TypeScript del SDK de
  T001 (`npx create-expo-app@latest mobile --template blank-typescript@sdk-NN --no-install`).
  Borrar lo que trae la plantilla y no se usa: `mobile/.git/` (si lo crea),
  `mobile/package-lock.json`, `mobile/App.tsx`, `mobile/index.ts` y `mobile/.gitignore`. El
  `.gitignore` de la raíz ya cubre `mobile/.expo/`, `ios/`, `android/` y `.env`, (R2).
- [X] T003 Editar `mobile/package.json`: `"name": "@ai-ticket-it/mobile"`, `"private": true`,
  **sin** `"type"`, `"main": "expo-router/entry"`. Scripts: `start` = `expo start`,
  `test` = `jest` (Jest activa `--ci` solo cuando detecta CI), `typecheck` = `tsc --noEmit`.
  En `dependencies`, `"@ai-ticket-it/shared": "*"` (R2, R13).
- [X] T004 Editar `package.json` de la raíz: `"workspaces": ["backend", "shared", "mobile"]` y
  script `"mobile": "npm run start -w mobile"` (FR-001, FR-002).
- [X] T005 Instalar dependencias desde `mobile/`:
  - `npx expo install expo-router react-native-safe-area-context react-native-screens
    expo-linking expo-constants expo-status-bar @react-native-async-storage/async-storage
    @expo/vector-icons`;
  - `npm install @tanstack/react-query@^5 -w mobile`;
  - `npx expo install typescript jest-expo jest @types/jest -- --save-dev`;
  - `npm install -D @testing-library/react-native -w mobile`.

  TypeScript queda como `devDependency` de `mobile/` en la versión que fija el SDK (R1, R9, R12).
- [X] T006 [P] Escribir `mobile/app.json`: `name` "AI Ticket It", `slug` "ai-ticket-it",
  `scheme` "ai-ticket-it", `orientation` "portrait", `plugins: ["expo-router"]`, **sin**
  `experiments.typedRoutes` y sin `web` (R2, R11).
- [X] T007 [P] Escribir `mobile/tsconfig.json`: `"extends": "expo/tsconfig.base"`,
  `compilerOptions: { "strict": true, "noEmit": true }`, `include: ["**/*.ts", "**/*.tsx"]`,
  `exclude: ["node_modules", ".expo"]`. No hereda `tsconfig.base.json` de la raíz. Sin
  `expo-env.d.ts`: Expo SDK 58 lo borra al correr `expo start` (R11).
- [X] T008 [P] Escribir `mobile/jest.config.js` (CommonJS): `preset: "jest-expo"`,
  `testMatch: ["<rootDir>/tests/**/*.test.ts?(x)"]`, `setupFilesAfterEnv:
  ["<rootDir>/jest.setup.ts"]`, **sin** `transformIgnorePatterns` propio. Escribir
  `mobile/jest.setup.ts`: `jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"))` y un
  `beforeEach` con `await AsyncStorage.clear()` y `jest.useRealTimers()` (R12, FR-025).
- [X] T009 [P] Crear `mobile/.env.example` con un comentario en español y
  `EXPO_PUBLIC_API_URL=http://192.168.0.23:3000/api`: dirección base con `/api`, prioridad
  sobre la detección por host (FR-005, R10).
- [X] T010 Actualizar `eslint.config.js` e instalar `eslint-plugin-react-hooks` (versión con
  peer `eslint ^10`; si no la hay, la última compatible, registrada en research R13) como
  devDependency de la raíz:
  - `ignores` suma `mobile/.expo/`;
  - el bloque de `tseslint.configs.recommended` y el de `no-explicit-any`/`ban-ts-comment`
    pasan a `files: ["**/*.ts", "**/*.tsx"]`;
  - `reactHooks.configs.flat.recommended` (o el equivalente de la versión) para
    `mobile/**/*.{ts,tsx}`;
  - globals de `mobile/**`: `globals.browser` + `__DEV__: "readonly"`. Para `mobile/*.config.js`
    y `mobile/jest.setup.ts`: `globals.node`, y además `sourceType: "commonjs"` en los `.js`.
    Para `mobile/tests/**` y `mobile/jest.setup.ts`: `globals.jest`;
  - `no-restricted-globals` con `{ name: "fetch", message: "Todo pedido al servidor vive en
    src/api (principio VII)" }` para `mobile/**`, salvo `mobile/src/api/**` y
    `mobile/src/composicion.tsx` (FR-006, R13).
- [X] T011 [P] Sumar `mobile/.expo/` a `.prettierignore` (R13).
- [X] T012 Correr `npm install` desde la raíz y verificar:
  - `mobile` usa su propio TypeScript: `npm exec -w mobile -- tsc -v` muestra la versión del
    SDK y la raíz sigue en `~6.0`;
  - `npm run lint` y `npm run format:check` en verde (correr `npm run format` si la plantilla
    trae otro formato);
  - `npx expo install --check` sin advertencias, desde `mobile/` (R1);
  - `git check-ignore mobile/.env` lo informa como ignorado y `mobile/.env.example` no
    (FR-005).

**Checkpoint**: `mobile/` instalado como workspace y con lint, formato y tipos en verde.

---

## Phase 2: Foundational (prerequisitos bloqueantes)

**Purpose**: la capa `src/api/`, la sesión pura, la secuencia de reintentos, el `QueryClient`,
el composition root y los componentes base. Son las piezas que usan todas las historias.

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

### Tests (escribir primero y verlos fallar) ⚠️

- [X] T013 [P] Test `mobile/tests/shared.test.ts`: importa el **valor** `EstadoCompra` de
  `@ai-ticket-it/shared` y verifica uno de sus miembros. Si Jest no transformara el TypeScript
  del workspace, fallaría al parsear, así que el test deja verificado que no hace falta
  `transformIgnorePatterns` (R12, US4-7).
- [X] T014 [P] Helper `mobile/tests/helpers/fetch-falso.ts`: `crearFetchFalso(respuestas)`
  devuelve un `typeof fetch` y un registro de los pedidos (url, método, encabezados). Cada
  respuesta puede ser `{ status, json }`, `{ status, texto }` (cuerpo no JSON), `"rechazar"`
  (`TypeError` de red) o `"colgar"` (nunca resuelve, pero rechaza con `AbortError` al abortarse
  su `signal`). También puede ser una función `(url, init) => respuesta` para elegir por ruta.
  Sin `any`.
- [X] T015 [P] Test `mobile/tests/api/errores.test.ts`: `ErrorDeApi` y
  `ServidorNoDisponibleError` extienden `Error`, se distinguen con `instanceof` y exponen sus
  campos (`status`, `codigo`, `mensaje`, `detalles` · `url`, `motivo`). El `mensaje` de
  `ServidorNoDisponibleError` es "No se pudo conectar con el servidor." (data-model "Errores de
  la app").
- [X] T016 [P] Test `mobile/tests/api/direccion.test.ts` con las tres filas de
  `resolverUrlBase` de [contracts/cliente-api.md](./contracts/cliente-api.md):
  - `"http://10.0.0.5:3000/api/"` → `"http://10.0.0.5:3000/api"`, con `hostUri` o sin él;
  - `urlEntorno` vacía o ausente con `hostUri` `"192.168.0.23:8081"` →
    `"http://192.168.0.23:3000/api"`;
  - ninguno → `"http://localhost:3000/api"`.

  Además, una `urlEntorno` de solo espacios cuenta como vacía (FR-004, FR-005, US4-6).
- [X] T017 [P] Test `mobile/tests/api/cliente.test.ts` con `crearFetchFalso`. Cubre cada fila
  de la tabla "Resultado" de [contracts/cliente-api.md](./contracts/cliente-api.md):
  - 2xx JSON → cuerpo tipado. 2xx no JSON → `ErrorDeApi(status, "RESPUESTA_INESPERADA")`;
  - ≥ 400 con `ErrorApi` → `ErrorDeApi` con `codigo`, `mensaje` y `detalles` (o `[]` si
    faltan), por ejemplo un 409 con detalles por campo (US4-3);
  - ≥ 400 sin formato (HTML, JSON ajeno, cuerpo vacío) → `codigo: "RESPUESTA_INESPERADA"` y
    "El servidor respondió de forma inesperada." (US4-4);
  - `fetch` rechazado → `ServidorNoDisponibleError(url, "sin-conexion")`;
  - `"colgar"` con fake timers: a los 8000 ms → `ServidorNoDisponibleError(url,
    "tiempo-agotado")`; a los 7999 ms todavía no rechazó. Un `tiempoLimiteMs` propio se
    respeta;
  - `signal` externo abortado → rechaza con el `AbortError` original (no es
    `ServidorNoDisponibleError`);
  - encabezados: `Accept: application/json` siempre. `X-Usuario-Id` con el valor de
    `obtenerUsuarioId()` si no es `null`, y ausente si es `null` (US4-1, US4-2).
    `opciones.usuarioId` (incluido `null`) reemplaza a `obtenerUsuarioId()`;
  - 401 `USUARIO_NO_IDENTIFICADO` en un pedido **con** usuario → llama una sola vez a
    `alUsuarioNoIdentificado` con el id **del pedido** y rechaza el `ErrorDeApi`. En un pedido
    sin usuario no la llama;
  - `get("/usuarios")` pide `{urlBase}/usuarios`, y `cliente.urlBase` expone la base.
- [X] T018 [P] Test `mobile/tests/api/usuarios.test.ts`:
  - `listarUsuarios(cliente)` hace `GET /usuarios` **sin** `X-Usuario-Id` aunque haya usuario
    actual, y devuelve los `UsuarioVista[]` en el orden del servidor;
  - `obtenerUsuarioActual(cliente, "usuario-lucia")` hace `GET /usuarios/actual` con
    `X-Usuario-Id: usuario-lucia`;
  - ambas pasan el `signal` al cliente.
- [X] T019 [P] Test `mobile/tests/sesion/estado-sesion.test.ts`: una prueba por fila de la
  tabla de transiciones de [data-model.md](./data-model.md) ("EstadoSesion"). Incluye:
  - `usuario-no-identificado(id)` con otro `id` → sin cambios;
  - un `validado` para un `usuarioId` distinto del actual → se descarta;
  - `elegido` desde `sin-usuario` y desde `con-usuario`;
  - `servidor-no-disponible` conserva `usuario`.
- [X] T020 [P] Test `mobile/tests/sesion/validacion.test.ts`: las cinco filas de
  "DecisionValidacion" de [data-model.md](./data-model.md):
  - `ok: true` → `confirmado`;
  - 401 `USUARIO_NO_IDENTIFICADO` → `olvidar`;
  - lo demás → `conservar-sin-servidor`: `ServidorNoDisponibleError` (`sin-conexion` y
    `tiempo-agotado`), otro `ErrorDeApi` (500, 404, 401 con otro código,
    `RESPUESTA_INESPERADA`) y una excepción cualquiera.

  Cubre SC-005.
- [X] T021 [P] Test `mobile/tests/sesion/usuario-recordado.test.ts` sobre el mock de
  AsyncStorage:
  - `guardar("usuario-lucia")` escribe en la clave `ai-ticket-it/usuario-recordado` el JSON
    `{ "version": 1, "usuarioId": "usuario-lucia" }`, y `leer()` lo devuelve;
  - sin clave → `null`;
  - devuelven `null` **y borran la clave**: JSON inválido, `version !== 1`, `usuarioId`
    vacío o no string, y un `getItem` que rechaza. `leer()` nunca lanza;
  - `olvidar()` borra la clave (R6).
- [X] T022 [P] Test `mobile/tests/conexion/secuencia-reintentos.test.ts` con fake timers y un
  `intentar` falso. Cubre SC-005 y FR-021a:
  - `iniciar()` intenta a los 1000 ms y no antes; con fallos sigue a los 2000, 4000, 8000,
    16000 y 32000 ms;
  - después del sexto fallo no programa más y `automaticosRestantes === 0`;
  - un éxito cancela lo pendiente;
  - `reintentarAhora()` intenta en el acto y, si falla, reinicia desde 1000 ms con
    `automaticosRestantes === 6`. Desde `agotada` también funciona;
  - mientras un intento está `enCurso`, `reintentarAhora()` se ignora (nunca hay dos
    intentos a la vez);
  - `iniciar()` con la secuencia ya corriendo no la reinicia;
  - `detener()` cancela todo;
  - el callback de cambios avisa `enCurso` y `automaticosRestantes`.
- [X] T023 [P] Test `mobile/tests/consultas/query-client.test.ts`: `crearQueryClient({
  alFallar })` tiene `retry: false` en queries y mutations y `staleTime: 30_000`. Una query
  y una mutation que fallan llaman `alFallar(error)` una vez con el error original. Las claves
  de `claves.ts` cumplen `claves.usuarios() → ["usuarios"]` y
  `claves.usuarioActual("u1") → ["usuario-actual", "u1"]`: el `usuarioId` va en la posición 1
  (R9).
- [X] T024 [P] Test `mobile/tests/componentes/mensaje-error.test.tsx`: `MensajeError` muestra
  el mensaje. Con `alReintentar`, muestra el botón "Reintentar" y lo llama al tocarlo; sin
  `alReintentar`, no muestra botón. Con `reintentando`, muestra "Reintentando…" deshabilitado
  (`accessibilityState.disabled`) y no llama.

### Implementación

- [X] T025 [P] Implementar `mobile/src/api/errores.ts`: clases `ErrorDeApi(status, codigo,
  mensaje, detalles: DetalleError[] = [])` y `ServidorNoDisponibleError(url, motivo:
  "sin-conexion" | "tiempo-agotado")` con `name` propio. Además, el type guard `esErrorApi(valor):
  valor is ErrorApi` y la constante del mensaje de respuesta inesperada (T015).
- [X] T026 [P] Implementar `mobile/src/api/direccion.ts`: función pura `resolverUrlBase({
  urlEntorno, hostUri })` según R10. Toma el host de `hostUri` sin el puerto y le agrega
  `:3000/api`, y le saca la `/` final a `urlEntorno` (T016).
- [X] T027 Implementar `mobile/src/api/cliente.ts` (depende de T025): `crearClienteApi({
  fetch, urlBase, obtenerUsuarioId, alUsuarioNoIdentificado, tiempoLimiteMs = 8000 })` →
  `ClienteApi { urlBase, get<T>(ruta, opciones?) }`. Detalles:
  - tiempo límite con un `AbortController` propio y `setTimeout`, encadenado a mano al
    `signal` externo (sin `AbortSignal.any` ni `AbortSignal.timeout`). Distingue qué abortó
    para relanzar el `AbortError` original o devolver `"tiempo-agotado"`;
  - limpia el temporizador y el listener en `finally`;
  - lee el cuerpo como texto y lo parsea con `JSON.parse` en un `try` (R4, T017).
- [X] T028 Implementar `mobile/src/api/usuarios.ts` (`listarUsuarios(cliente, { signal })`
  con `usuarioId: null`, `obtenerUsuarioActual(cliente, usuarioId, { signal })`) y
  `mobile/src/api/index.ts`. `index.ts` exporta exactamente `crearClienteApi`, `ClienteApi`,
  `ErrorDeApi`, `ServidorNoDisponibleError`, `resolverUrlBase`, `listarUsuarios` y
  `obtenerUsuarioActual` (T018).
- [X] T029 [P] Implementar `mobile/src/sesion/estado-sesion.ts`: tipos `EstadoSesion` y
  `EventoSesion` (uniones discriminadas, exactamente las de data-model), `estadoInicial = {
  fase: "iniciando" }` y el reducer puro `reducirSesion(estado, evento)`. Ante una
  combinación no listada en la tabla, devuelve el mismo estado (T019).
- [X] T030 [P] Implementar `mobile/src/sesion/validacion.ts` (depende de T025):
  `decidirValidacion(resultado)` → `{ tipo: "confirmado", usuario } | { tipo: "olvidar" } | {
  tipo: "conservar-sin-servidor" }` (T020).
- [X] T031 [P] Implementar `mobile/src/sesion/usuario-recordado.ts`: interfaz `Almacenamiento
  { getItem; setItem; removeItem }` y `crearRepositorioUsuarioRecordado(almacenamiento)` →
  `{ leer(): Promise<string | null>; guardar(id): Promise<void>; olvidar(): Promise<void> }`,
  con la clave `ai-ticket-it/usuario-recordado` y la versión `1`. La forma se valida con un
  type guard escrito a mano, sin zod (R6, T021).
- [X] T032 [P] Implementar `mobile/src/conexion/secuencia-reintentos.ts`: clase
  `SecuenciaDeReintentos({ intentar: () => Promise<boolean>, alCambiar, temporizador? })` con
  `esperasMs = [1000, 2000, 4000, 8000, 16000, 32000]`, `iniciar()`, `reintentarAhora()`,
  `detener()` y los getters `enCurso` y `automaticosRestantes`. El temporizador por defecto es
  `setTimeout`/`clearTimeout`. Una excepción de `intentar` cuenta como fallo. Sin React (R7,
  T022).
- [X] T033 Implementar `mobile/src/consultas/claves.ts` (`claves.usuarios()`,
  `claves.usuarioActual(usuarioId)`) y `mobile/src/consultas/query-client.ts`:
  - `crearQueryClient({ alFallar })` con `defaultOptions: { queries: { retry: false,
    staleTime: 30_000 }, mutations: { retry: false } }`,
    `queryCache: new QueryCache({ onError: alFallar })` y
    `mutationCache: new MutationCache({ onError: alFallar })`;
  - `conectarFocoDeLaApp()`: `focusManager.setEventListener` con `AppState`
    (`active` → foco) que devuelve la función de limpieza. Sin `onlineManager` (R9, T023).
- [X] T034 Implementar el composition root `mobile/src/composicion.tsx` (depende de T026–T028,
  T031, T033):
  - `crearDependencias({ fetch, almacenamiento, urlEntorno, hostUri })` → `Dependencias`:
    `urlBase`, `usuarioRecordado`, `queryClient`, `crearCliente({ obtenerUsuarioId,
    alUsuarioNoIdentificado })` y `registrarOyenteDeErrores(oyente) → desuscribir`. El
    `alFallar` del `QueryClient` delega en el oyente registrado; así la sesión se entera de
    los errores de cualquier query o mutation (R8);
  - `crearDependenciasDeProduccion()`: lee `process.env.EXPO_PUBLIC_API_URL` **literalmente**
    y usa `fetch` global, `AsyncStorage` y `Constants.expoConfig?.hostUri` (R10);
  - `DependenciasProvider` y `useDependencias()`, que lanza un error claro fuera del provider.

  Es el único lugar que instancia piezas (data-model "Dependencias").
- [X] T035 [P] Implementar `mobile/src/componentes/Cargando.tsx` (`ActivityIndicator` +
  "Cargando…"), `mobile/src/componentes/MensajeError.tsx` (props `mensaje`, `titulo?`,
  `alReintentar?`, `reintentando?`, T024) y `mobile/src/componentes/ListaVacia.tsx` (prop
  `mensaje`). Todos centrados con flex y sin anchos fijos (R14).

**Checkpoint**: `npm test -w mobile` corre en verde la lógica pura y los componentes base.

---

## Phase 3: User Story 1 - Abrir la app en el celular y elegir un usuario (Priority: P1) 🎯 MVP

**Goal**: en el primer arranque, la app muestra el selector con los usuarios del servidor
(cargando, error con reintentos, vacío, éxito) y, al elegir uno, entra a las pestañas
recordando la elección.

**Independent Test**: con el servidor y la app corriendo, abrir la app en un celular de la
misma red sin configurar nada. Aparece la lista de usuarios y elegir uno lleva a Explorar
(quickstart §2 y §6). Automatizado: `tests/pantallas/selector.test.tsx` y `guards.test.tsx`.

### Tests for User Story 1 ⚠️

- [X] T035a [US1] Crear los stubs de las rutas, para que T036–T038 compilen (P1, U1):
  - `mobile/src/navegacion/LayoutRaiz.tsx` con `LayoutRaiz({ dependencias })`, que por ahora renderiza solo un `Stack`;
  - `mobile/app/_layout.tsx` con **solo** el export por defecto, que renderiza `LayoutRaiz`
    con las dependencias reales (R3);
  - `cargando.tsx`, `seleccionar-usuario.tsx`, `(tabs)/_layout.tsx` y las cuatro pestañas, cada
    una devolviendo `null`.

  T039–T048 los reemplazan por la implementación real.
- [X] T036 [US1] Helper `mobile/tests/helpers/render-con-dependencias.tsx`:
  `renderConDependencias({ respuestas, usuarioRecordado?, initialUrl? })` arma
  `crearDependencias` con `crearFetchFalso(respuestas)`, el mock de AsyncStorage (precargando
  `{ version: 1, usuarioId }` si se pide), `urlEntorno: "http://servidor-de-prueba:3000/api"`
  y un `QueryClient` nuevo. Renderiza con `renderRouter` de `expo-router/testing-library`
  usando un mapa de rutas con:
  - `_layout`: `() => <LayoutRaiz dependencias={deps} />`, importado de
    `src/navegacion/LayoutRaiz` (nunca de `app/`);
  - los módulos reales de `app/`;
  - las rutas extra que reciba el test.

  Devuelve el resultado del render, el registro de pedidos y `deps` (R12).
- [X] T037 [P] [US1] Test `mobile/tests/pantallas/selector.test.tsx` (sin usuario recordado):
  - "Cargando…" mientras `GET /usuarios` está colgado (US1-3);
  - éxito: "¿Con quién querés operar?" y los usuarios en el orden de la respuesta, con
    "{nombre} {apellido}" y "Organiza 2 eventos", "Organiza 1 evento" o "No organiza
    eventos". Cada fila tiene `accessibilityLabel` "Elegir a {nombre} {apellido}" (US1-1);
  - el pedido de la lista sale sin `X-Usuario-Id` (US4-2);
  - lista vacía → "No hay usuarios disponibles." (US1-5);
  - `"rechazar"` → "Servidor no disponible", "No se pudo conectar con
    http://servidor-de-prueba:3000/api." y "Reintentar". Con fake timers y la segunda
    respuesta OK, la lista aparece sola a los 1000 ms. Tocar "Reintentar" pide en el acto
    (US1-4, FR-021a);
  - `ErrorDeApi` 500 → su mensaje y "Reintentar", **sin** pedido automático al avanzar 60 s
    (FR-021a);
  - elegir a Lucía → se ve Explorar, y AsyncStorage tiene
    `{"version":1,"usuarioId":"usuario-lucia"}` (US1-2, FR-012);
  - doble toque sobre la fila → `setItem` una sola vez y navegación consistente (edge case);
  - `setItem` que rechaza → se ve Explorar igual, AsyncStorage queda sin la clave y hubo un
    `console.warn` (CHK004).
- [X] T038 [P] [US1] Test `mobile/tests/pantallas/guards.test.tsx`: sin usuario recordado y
  con `initialUrl: "/"` o `"/perfil"`, se ve el selector y no las pestañas (FR-011). Después
  de elegir, la ruta es `/` (Explorar).

### Implementation for User Story 1

- [X] T039 [P] [US1] Implementar `mobile/src/componentes/FilaUsuario.tsx`. Props `usuario:
  UsuarioVista`, `esActual: boolean`, `deshabilitada: boolean`, `alElegir`. Es un `Pressable`
  con `accessibilityRole="button"`, que muestra "{nombre} {apellido}" y "Organiza {n}
  evento(s)" ("No organiza eventos" si es 0). `accessibilityLabel`: "Elegir a {nombre}
  {apellido}". La marca "Actual" y su etiqueta se agregan en US3 (contracts/app.md).
- [X] T040 [P] [US1] Implementar `mobile/src/componentes/SeccionPendiente.tsx` (prop `nombre`):
  título con el nombre y "Esta sección todavía no está disponible." (FR-018).
- [X] T041 [US1] Implementar `mobile/src/sesion/SesionProvider.tsx` (parte de US1, depende de
  T029–T034):
  - estado con `useReducer(reducirSesion, estadoInicial)` y un ref con el `usuarioId` actual.
    El cliente de la sesión se crea con `deps.crearCliente({ obtenerUsuarioId: () =>
    ref.current, alUsuarioNoIdentificado })`;
  - al montar, `usuarioRecordado.leer()`: si es `null`, despacha `sin-recordado` (la
    validación del recordado es US2);
  - `elegirUsuario(usuario)` es idempotente: un ref "procesando" ignora una segunda llamada.
    Hace `secuencia.detener()`, `await queryClient.cancelQueries()`, `queryClient.clear()`,
    `await usuarioRecordado.guardar(usuario.id)` y despacha `elegido(usuario)` (FR-016, A1).
    Si `guardar` rechaza, entra igual con el elegido, sin recordarlo, y registra un
    `console.warn` (CHK004, cubierto en T037);
  - una **única** `SecuenciaDeReintentos`, creada una vez. En `sin-usuario`, `intentar` hace
    `refetchQueries({ queryKey: claves.usuarios() })` y es éxito si el error ya no es
    `ServidorNoDisponibleError`. Ante un éxito, `refetchQueries({ type: "active", predicate:
    (q) => q.state.status === "error" })`. `detener()` al desmontar;
  - registra con `registrarOyenteDeErrores` un oyente que, ante un `ServidorNoDisponibleError`,
    llama `secuencia.iniciar()`. Un `ErrorDeApi` no hace nada global (R7, R8);
  - expone `useSesion()` → `{ estado, elegirUsuario, olvidarUsuario, reintentar }` y
    `useClienteApi()`.
- [X] T042 [US1] Implementar `mobile/src/conexion/useConexion.ts`: lee la secuencia y el estado
  del `SesionProvider` y devuelve `{ servidor, enCurso, automaticosRestantes, reintentarAhora,
  urlBase }` (data-model "EstadoConexion").
- [X] T043 [US1] Implementar `mobile/src/consultas/useUsuarios.ts`: `useQuery({ queryKey:
  claves.usuarios(), queryFn: ({ signal }) => listarUsuarios(cliente, { signal }) })`, con el
  cliente de `useClienteApi()` (R9).
- [X] T044 [P] [US1] Implementar `mobile/app/cargando.tsx`: solo `<Cargando />`, sin selector ni
  datos de usuario (US2-6).
- [X] T045 [US1] Implementar `mobile/app/seleccionar-usuario.tsx`, a pantalla completa, con los
  estados de la tabla de [contracts/app.md](./contracts/app.md):
  - `isPending` → `Cargando`;
  - error `ServidorNoDisponibleError` → `MensajeError` con título "Servidor no disponible",
    "No se pudo conectar con {urlBase}." y `alReintentar = reintentarAhora` de
    `useConexion()`, con `reintentando = enCurso`;
  - error `ErrorDeApi` → su `mensaje` y "Reintentar" = `refetch()`;
  - lista vacía → `ListaVacia` "No hay usuarios disponibles.";
  - éxito → título "¿Con quién querés operar?" y un `FlatList` de `FilaUsuario`.

  Mientras procesa la elección, deshabilita las filas (FR-020).
- [X] T046 [US1] Implementar `mobile/src/navegacion/LayoutRaiz.tsx` y `mobile/app/_layout.tsx`:
  - `LayoutRaiz({ dependencias })` en `mobile/src/navegacion/LayoutRaiz.tsx`: `SafeAreaProvider` →
    `DependenciasProvider` → `QueryClientProvider` → `SesionProvider` → `Stack` con
    `Stack.Protected guard={fase === "iniciando"}` (`cargando`),
    `guard={fase === "sin-usuario"}` (`seleccionar-usuario`, sin header ni gesto atrás) y
    `guard={fase === "con-usuario"}` (`(tabs)`, `headerShown: false`);
  - conecta `conectarFocoDeLaApp()` en un efecto;
  - `mobile/app/_layout.tsx` queda con **solo** el export por defecto: crea las dependencias
    con `useState(() => crearDependenciasDeProduccion())` y renderiza `LayoutRaiz` (R3, R10).
    Las rutas de `app/` no exportan nada más que su componente por defecto.

  Si el SDK de T001 no trae `Stack.Protected`, se usa el plan B de R3 (`<Redirect>`) y se
  registra en research.
- [X] T047 [US1] Implementar `mobile/app/(tabs)/_layout.tsx` (`Tabs` con la pestaña `index`,
  título y `tabBarLabel` "Explorar", ícono Ionicons `compass-outline`) y
  `mobile/app/(tabs)/index.tsx` (`<SeccionPendiente nombre="Explorar" />`). Las otras tres
  pestañas se suman en US3 (FR-017).
- [X] T048 [US1] **(persona)** Validar en el celular quickstart §2 y §6 con `npm start` y `npm
  run mobile`. Si Metro no resuelve `@ai-ticket-it/shared`, agregar el `mobile/metro.config.js`
  mínimo de la guía de monorepos de Expo y registrarlo en research R2.

**Checkpoint**: MVP. La app abre en el celular, lista los usuarios y entra a Explorar al
elegir uno.

---

## Phase 4: User Story 2 - Volver a la app con el usuario recordado (Priority: P1)

**Goal**: al reabrir la app, el usuario recordado se valida con `GET /api/usuarios/actual`
según FR-013. Sin servidor, entra igual y muestra la franja con reintentos automáticos; ante
un 401, olvida al usuario y avisa.

**Independent Test**: elegir un usuario, cerrar y reabrir → entra directo. Con el servidor
detenido → entra y muestra la franja. Con un usuario que el servidor no reconoce → selector
con aviso (quickstart §3). Automatizado: `tests/pantallas/arranque.test.tsx`,
`errores-en-uso.test.tsx` y `tests/componentes/franja.test.tsx`.

### Tests for User Story 2 ⚠️

- [X] T049 [P] [US2] Test `mobile/tests/componentes/franja.test.tsx`:
  `FranjaServidorNoDisponible({ urlBase, reintentando, alReintentar })` muestra "Servidor no
  disponible · {urlBase}" y "Reintentar". Con `reintentando`, muestra "Reintentando…"
  deshabilitado. Tiene `accessibilityRole="alert"` y `accessibilityLiveRegion="polite"`. Al
  montarse, llama `AccessibilityInfo.announceForAccessibility("Servidor no disponible")` una
  vez (espiado con `jest.spyOn`) (FR-021, FR-022).
- [X] T050 [P] [US2] Test `mobile/tests/pantallas/arranque.test.tsx` con `usuarioRecordado:
  "usuario-lucia"`:
  - mientras `GET /usuarios/actual` está colgado: "Cargando…", sin selector y sin pedido a
    `/usuarios` (US2-6);
  - 200 → Explorar sin pasar por el selector, sin franja, con el pedido con `X-Usuario-Id:
    usuario-lucia` (US2-1);
  - `"rechazar"` → Explorar con la franja y la dirección. AsyncStorage conserva el id
    (US2-2);
  - con fake timers: franja visible → reintentos a 1, 2, 4… s. Con la siguiente respuesta OK,
    la franja desaparece y no hay más pedidos (US2-3). "Reintentar" pide en el acto;
  - 401 `USUARIO_NO_IDENTIFICADO` → selector con "El usuario con el que estabas operando ya
    no existe. Elegí otro.", la clave borrada y el anuncio al lector de pantalla (US2-4);
  - 500 → conserva y muestra la franja (US2-5). Con fake timers, un reintento automático que
    vuelve a recibir 500 deja la franja visible y programa el siguiente intento (2 s); un 200
    posterior la oculta (I1, FR-021a);
  - valor dañado en AsyncStorage → selector sin aviso, sin cerrarse (edge case);
  - un reintento automático que recibe 401 → selector con el aviso, y la clave se borra una
    sola vez aunque el 401 llegue por el cliente y por la validación (FR-021a, U2);
  - secuencia única: con la franja visible, un fallo de otra query no reinicia la secuencia, y
    nunca hay dos pedidos de validación simultáneos (registro del fetch falso) (FR-021a);
  - con la franja visible, un cambio de `AppState` a `active` pide la validación en el acto
    (CHK005).
- [X] T051 [P] [US2] Test `mobile/tests/pantallas/errores-en-uso.test.tsx`. Usa una ruta
  extra de prueba dentro de `(tabs)` que hace `useQuery` de `cliente.get("/prueba")` con clave
  `["prueba", usuarioId]`, con usuario recordado confirmado:
  - `/prueba` → `"rechazar"`: aparece la franja y la secuencia arranca. Al recuperarse,
    `/prueba` se vuelve a pedir (R7);
  - `/prueba` → 500: no hay franja ni pedidos extra (CHK013);
  - `/prueba` → 401 `USUARIO_NO_IDENTIFICADO`: selector con el aviso (FR-014);
  - una respuesta 401 que llega con el id de un usuario anterior → se ignora.
- [X] T052 [US2] *(Fusionada en T050, que escribe el mismo archivo. Se conserva el número para
  no renumerar.)*

### Implementation for User Story 2

- [X] T053 [P] [US2] Implementar `mobile/src/componentes/FranjaServidorNoDisponible.tsx`
  (props `urlBase`, `reintentando`, `alReintentar`). Va arriba, con fondo de aviso **y**
  texto, y ocupa `useSafeAreaInsets().top` como `paddingTop`. Anuncia en un efecto al
  montarse. El botón tiene texto (T049, R8).
- [X] T054 [US2] Completar `mobile/src/sesion/SesionProvider.tsx` (depende de T041):
  - al montar con un id recordado: `obtenerUsuarioActual(cliente, id)` con `usuarioId`
    explícito → `decidirValidacion` → despacha `validado` con el `usuarioId`. En `olvidar`,
    llama `usuarioRecordado.olvidar()`. En `conservar-sin-servidor`, `secuencia.iniciar()`;
  - en `con-usuario`, `intentar` valida al usuario actual con la misma regla. Es éxito **solo**
    si la decisión es `confirmado` u `olvidar`; `conservar-sin-servidor`, por cualquier causa
    (incluido un 500), es fallo y la secuencia sigue (I1);
  - `olvidarUsuario({ aviso })`: `cancelQueries` + `clear` + `usuarioRecordado.olvidar()` +
    despacha `usuario-no-identificado`/`validado(olvidar)`. Es **idempotente**: si la fase ya no
    es `con-usuario` o el `usuarioId` cambió, no hace nada (U2);
  - `alUsuarioNoIdentificado(id)` del cliente → si `id === ref.current`, `olvidarUsuario`;
  - el oyente de errores también despacha `servidor-no-disponible` en `con-usuario`;
  - al volver la app a primer plano (`AppState` `active`) con la franja visible (`con-usuario`
    y `servidor: "no-disponible"`), llama `secuencia.reintentarAhora()`. Sin pausa manual en
    segundo plano (CHK005; test en T050);
  - un `validado` que llega para otro `usuarioId` se descarta (lo hace el reducer). La
    secuencia ya se detiene en `elegirUsuario` (T041, A1) (R5, R7, R8).
- [X] T055 [US2] En `mobile/src/navegacion/LayoutRaiz.tsx`, montar la franja encima del `Stack` cuando
  `fase === "con-usuario"`, `servidor === "no-disponible"` y `useSegments()[0] !==
  "seleccionar-usuario"` (condición por exclusión, R8). Mientras está visible, envolver el
  `Stack` en un `SafeAreaInsetsContext.Provider` con `top: 0`, para que los headers no dupliquen
  el espacio.
- [X] T056 [US2] En `mobile/app/seleccionar-usuario.tsx`, mostrar sobre la lista el aviso "El
  usuario con el que estabas operando ya no existe. Elegí otro." cuando `estado.aviso ===
  "usuario-anterior-inexistente"`. Lleva `accessibilityLiveRegion="polite"` y lo anuncia con
  `announceForAccessibility` al aparecer (FR-013, FR-022).
- [X] T057 [US2] **(persona)** Validar en el celular quickstart §3 (reabrir, servidor
  detenido, recuperación sola y con "Reintentar"), con el aviso en < 10 s (SC-003) y la
  reapertura en < 3 s (SC-002).

**Checkpoint**: US1 y US2 andan solas; la app sobrevive a reinicios y a cortes del servidor.

---

## Phase 5: User Story 3 - Navegar entre secciones y cambiar de usuario desde Perfil (Priority: P1)

**Goal**: cuatro pestañas con texto e ícono, tres pendientes y Perfil con el usuario actual y
"Cambiar usuario", que abre el selector como modal con el actual marcado.

**Independent Test**: recorrer las cuatro pestañas. En Perfil, ver el nombre, cambiar a otro
usuario y comprobar que al reabrir se recuerda el nuevo (quickstart §4). Automatizado:
`tests/pantallas/navegacion.test.tsx`, `perfil.test.tsx` y `cambiar-usuario.test.tsx`.

### Tests for User Story 3 ⚠️

- [X] T058 [P] [US3] Test `mobile/tests/pantallas/navegacion.test.tsx` con un usuario
  confirmado:
  - las pestañas "Explorar", "Mis compras", "Mis eventos" y "Perfil" aparecen en ese orden y
    con texto, y abre Explorar (US3-1, FR-017);
  - cada una de las tres primeras muestra su nombre y "Esta sección todavía no está
    disponible." (US3-2).
- [X] T059 [P] [US3] Test `mobile/tests/pantallas/perfil.test.tsx`:
  - confirmado → "Lucía Álvarez" y "Cambiar usuario" (US3-3);
  - conservado sin servidor → "Usuario usuario-lucia" y "No se pudieron cargar los datos del
    usuario."; tras un reintento exitoso con fake timers, pasa a "Lucía Álvarez" (FR-019).
- [X] T060 [P] [US3] Test `mobile/tests/pantallas/cambiar-usuario.test.tsx`:
  - Perfil → "Cambiar usuario" abre el selector. La fila de Lucía muestra "Actual", con
    `accessibilityLabel` "Lucía Álvarez, usuario actual" y `accessibilityState.selected`
    (US3-6, FR-022);
  - "Cerrar" (`accessibilityLabel` "Cerrar sin cambiar de usuario") → Perfil sigue con Lucía
    (US3-5);
  - elegir a Diego → Perfil muestra "Diego Fernández", AsyncStorage guarda `usuario-diego` y
    la caché quedó vacía antes del cambio (`queryClient.getQueryCache().getAll()` sin datos de
    Lucía) (US3-4, FR-016). Son 2 toques desde Perfil (SC-004);
  - con la franja visible, el modal la oculta, y al cerrarlo vuelve con el estado vigente.
    La secuencia sigue corriendo mientras tanto (FR-021, FR-021a);
  - 401 `USUARIO_NO_IDENTIFICADO` de la validación con el modal abierto → selector a
    pantalla completa, sin "Cerrar" y con el aviso (FR-014, CHK020);
  - modal abierto desde Perfil y `GET /usuarios` en `"rechazar"` → estado de error del selector
    y arranca la secuencia única. Con fake timers, el reintento valida al usuario actual
    (`GET /usuarios/actual`) y, al tener éxito, vuelve a pedir la lista, que aparece (FR-021a,
    SC-005, C1).
  - `GET /usuarios/actual` responde siempre 500 (franja visible, secuencia corriendo) y
    `GET /usuarios` responde 200: abrir el modal y elegir a Diego → Perfil muestra "Diego
    Fernández", sin franja. Con fake timers, al avanzar 60 s no hay más pedidos a
    `/usuarios/actual` (la secuencia se detuvo al elegir, A1, FR-021a).

### Implementation for User Story 3

- [X] T061 [US3] Completar `mobile/app/(tabs)/_layout.tsx` con las cuatro pestañas, en orden y
  con `tabBarLabel`: `index` "Explorar" (`compass-outline`), `mis-compras` "Mis compras"
  (`ticket-outline`), `mis-eventos` "Mis eventos" (`calendar-outline`) y `perfil` "Perfil"
  (`person-circle-outline`). Las etiquetas no se recortan en 360 px (FR-017, FR-022).
- [X] T062 [P] [US3] Crear `mobile/app/(tabs)/mis-compras.tsx` y
  `mobile/app/(tabs)/mis-eventos.tsx` con `<SeccionPendiente nombre="…" />` (FR-018).
- [X] T063 [P] [US3] Crear `mobile/app/(tabs)/perfil.tsx`. Con `usuario`, muestra "{nombre}
  {apellido}"; con `usuario: null`, "Usuario {usuarioId}" y "No se pudieron cargar los datos
  del usuario.". El botón "Cambiar usuario" hace `router.push("/seleccionar-usuario")`
  (FR-019).
- [X] T064 [US3] Sumar a `mobile/src/componentes/FilaUsuario.tsx` la marca para `esActual`:
  texto visible "Actual", `accessibilityLabel` "{nombre} {apellido}, usuario actual" y
  `accessibilityState={{ selected: true }}` (FR-015, FR-022).
- [X] T065 [US3] Modo modal del selector:
  - en `mobile/src/navegacion/LayoutRaiz.tsx`, dentro del grupo `con-usuario`, la pantalla
    `seleccionar-usuario` va con `presentation: "modal"` y un `headerRight` "Cerrar"
    (`accessibilityLabel` "Cerrar sin cambiar de usuario") que hace `router.back()`;
  - en `mobile/app/seleccionar-usuario.tsx`, `esActual` se calcula con el `usuarioId` de la
    sesión. Si la fase era `con-usuario`, después de `elegirUsuario` hace `router.back()`. El
    gesto y el botón "atrás" de Android cierran el modal sin cambios (comportamiento por
    defecto del modal). A pantalla completa no hay "Cerrar" (FR-015, contracts/app.md).
- [X] T066 [US3] **(persona)** Validar en el celular quickstart §4. Además, verificar a mano el
  botón "atrás" de Android: en el modal vuelve a Perfil sin cambios, y a pantalla completa sale
  de la app. También, que las pantallas se ven sin cortes en 360 px (edge cases).

**Checkpoint**: las tres historias P1 andan; se pueden demostrar los dos roles en un mismo
celular.

---

## Phase 6: User Story 4 - Base predecible para hablar con el servidor (Priority: P2)

**Goal**: comprobar que la capa `src/api/` de Foundational cumple lo que promete a las
features siguientes: un solo lugar para los pedidos, tipos compartidos, errores traducidos y
dirección configurable.

**Independent Test**: `tests/api/*` y `tests/shared.test.ts` en verde (T013–T018), más las
verificaciones de esta fase.

- [X] T067 [US4] Verificar que ninguna pantalla, hook ni componente importa archivos internos
  de `src/api/` salvo `src/api/index.ts` (o mover los imports), y que `index.ts` exporta
  exactamente lo que lista [contracts/cliente-api.md](./contracts/cliente-api.md).
- [X] T068 [US4] Verificación negativa del lint (FR-006): agregar temporalmente `fetch("x")` a
  `mobile/app/(tabs)/index.tsx` y comprobar que `npm run lint` falla con "Todo pedido al
  servidor vive en src/api (principio VII)". Revertir.
- [X] T069 [US4] Verificación negativa de tipos (US4-7): renombrar temporalmente un campo de
  `UsuarioVista` en `shared/src/` y comprobar que `npm run typecheck` falla en `mobile`.
  Revertir.
- [X] T070 [US4] **(persona)** Validar en el celular quickstart §5 (`EXPO_PUBLIC_API_URL` con
  un valor válido y con uno inválido; la franja o el selector muestran esa dirección). Borrar
  `mobile/.env` al terminar.

**Checkpoint**: las features 003+ pueden agregar llamadas al servidor sin tocar la base.

---

## Phase 7: User Story 5 - La app entra en los comandos de calidad y en el CI (Priority: P2)

**Goal**: los cuatro comandos de la raíz y el CI recorren `mobile`.

**Independent Test**: en un clon limpio, `npm ci` y los cuatro comandos en verde incluyendo
`mobile`. Un error introducido a propósito en `mobile/` hace fallar el comando
correspondiente.

- [X] T071 [US5] En `.github/workflows/ci.yml`, renombrar el paso "Tests (Vitest)" a "Tests
  (Vitest y Jest)". Los demás pasos no cambian: `npm ci` instala `mobile` por estar en
  `workspaces` (R13, FR-023).
- [X] T072 [US5] Verificar desde la raíz que `npm test`, `npm run lint`, `npm run typecheck` y
  `npm run format:check` recorren `backend`, `shared` y `mobile` y terminan en verde, y que la
  suite de `mobile` tarda < 1 min (SC-006). `npm run typecheck` se corre con `mobile/.expo/`
  borrado, para comprobar que no depende de `expo start` (R11).
- [X] T073 [US5] Verificaciones negativas en `mobile/`: un error de tipos, una regla de lint
  (`any`), un archivo mal formateado y un test que falla hacen fallar, cada uno, su comando.
  Revertir cada cambio (US5-1, US5-2).
- [X] T074 [US5] Verificar la instalación limpia: en una copia del repo sin `node_modules`,
  `npm ci` instala también `mobile` con un solo comando (US5-3).

**Checkpoint**: `mobile` queda bajo el mismo control de calidad que el backend.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: documentación, validación de punta a punta y skill para las features siguientes.

- [X] T075 [P] Actualizar `README.md`:
  - SDK de Expo y Expo Go requerido (FR-003);
  - `npm install`, `npm start` y `npm run mobile`, y cómo abrir con el QR;
  - `EXPO_PUBLIC_API_URL` y `mobile/.env.example`, y por qué `localhost` falla en el celular;
  - diagnóstico de "servidor no disponible": misma red, aislamiento de clientes, firewall de
    Windows con los puertos 3000 y 8081, y `REACT_NATIVE_PACKAGER_HOSTNAME` con el comando de
    PowerShell y el de bash para VirtualBox;
  - calidad de la app (FR-026, R10).
- [X] T076 [P] Actualizar `AGENTS.md`:
  - mapa de `mobile/` (`app/`, `src/navegacion` con `LayoutRaiz`, `src/api`, `src/sesion`,
    `src/conexion`, `src/consultas`, `src/componentes`, `src/composicion.tsx` como composition
    root, `tests/`). Aclarar que las rutas de `app/` solo exportan su componente por defecto y
    que la lógica testeable de la navegación vive en `src/navegacion/`;
  - comando `npm run mobile`;
  - `npm install` instala también `mobile`;
  - quitar la nota de que `mobile/` lo crea la 002;
  - mencionar la skill `nueva-pantalla` (FR-026).
- [X] T077 Correr desde `mobile/` `npx expo install --check` (sin advertencias) y, desde la
  raíz, `npm test`, `npm run lint`, `npm run typecheck` y `npm run format:check`, los cuatro
  en verde (R1, principio IX).
- [ ] T078 **(persona)** Recorrer [quickstart.md](./quickstart.md) completo en el celular
  (§1–§6) y anotar cualquier desvío en research.
- [ ] T079 Actualizar `docs/backlog.md`: la 002 pasa a "en PR" al abrir el PR a `development`
  (FR-026).
- [ ] T080 Crear `.claude/skills/nueva-pantalla/SKILL.md` (última tarea, R14), con frontmatter
  `name` y `description` (en el estilo de `.claude/skills/nuevo-endpoint/SKILL.md`), que
  explique:
  - dónde va la ruta: dentro de `app/(tabs)/` o apilada en el grupo `con-usuario`;
  - la función de `src/api/<recurso>.ts` exportada por `index.ts`, y el hook de query en
    `src/consultas/` con la clave de `claves.ts`, con `usuarioId` en la posición 1 si depende
    del usuario;
  - los cuatro estados con `Cargando`, `MensajeError`, `ListaVacia` y el éxito;
  - que no se usa `fetch` fuera de `src/api` y que la franja ya cubre "servidor no
    disponible";
  - accesibilidad y 360 px;
  - los tests con `renderConDependencias` y `crearFetchFalso`, escritos primero;
  - los comandos de calidad.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 (persona) antes de todo. T002 → T003 → T004 → T005, después
  T006–T011 y por último T012.
- **Foundational (Phase 2)**: depende de Setup y **bloquea** todas las historias.
- **US1 (Phase 3)**: depende de Foundational. Es el MVP.
- **US2 (Phase 4)**: depende de US1 (completa `SesionProvider`, `LayoutRaiz.tsx` y el selector, y
  usa `renderConDependencias`).
- **US3 (Phase 5)**: depende de US1. Los tests de Perfil y del modal con la franja (T059,
  T060) dependen también de US2.
- **US4 (Phase 6)**: depende de Foundational. T070 depende de US1 y US2 (franja y selector).
- **US5 (Phase 7)**: depende de que estén las historias que se quieran incluir. Conviene
  hacerla después de US3.
- **Polish (Phase 8)**: depende de todo; T080 va última.

### Within Each User Story

- Tests primero, verlos fallar, después implementar (principio II).
- Lógica pura → composition root → provider y hooks → componentes → pantallas y layouts.
- `mobile/src/navegacion/LayoutRaiz.tsx` se toca en secuencia (T035a → T046 → T055 → T065), igual que
  `SesionProvider.tsx` (T041 → T054), `seleccionar-usuario.tsx` (T045 → T056 → T065) y
  `FilaUsuario.tsx` (T039 → T064). Nunca en paralelo.

### Dependencias puntuales

- Foundational: T027 ← T025 · T028 ← T027 · T030 ← T025 · T034 ← T026, T027, T028, T031,
  T033 · cada implementación ← su test (T025←T015, T026←T016, T027←T017, T028←T018,
  T029←T019, T030←T020, T031←T021, T032←T022, T033←T023, T035←T024).
- US1: T035a ← T034 · T036 ← T035a · T041 ← T029–T034 · T042, T043 ←
  T041 · T045 ← T035, T039, T042, T043 · T046 ← T041, T044, T045 · T047 ← T040, T046 · T048 ←
  T047.
- US2: T054 ← T041 · T055 ← T053, T054 · T056 ← T054.
- US3: T061 ← T047 · T063 ← T054 · T064 ← T039 · T065 ← T055, T056, T064.

### Parallel Opportunities

- Setup: T006–T009 y T011 en paralelo después de T005.
- Foundational: los tests T013–T024 en paralelo. Las implementaciones T025, T026, T029, T031,
  T032 y T035 en paralelo, y T030 en cuanto termina T025.
- US1: T037 y T038 en paralelo, después de T036. T039, T040 y T044 en paralelo con T041.
- US2: tests T049–T051 en paralelo (T052 quedó fusionada en T050). T053 en paralelo con T054.
- US3: tests T058–T060 en paralelo. T062 y T063 en paralelo.
- Polish: T075 y T076 en paralelo.

---

## Parallel Example: Foundational

```bash
# Tests (escribir y ver fallar juntos):
Task: "Test de errores en mobile/tests/api/errores.test.ts"
Task: "Test de resolverUrlBase en mobile/tests/api/direccion.test.ts"
Task: "Test del cliente en mobile/tests/api/cliente.test.ts"
Task: "Test del reducer en mobile/tests/sesion/estado-sesion.test.ts"
Task: "Test de decidirValidacion en mobile/tests/sesion/validacion.test.ts"
Task: "Test del usuario recordado en mobile/tests/sesion/usuario-recordado.test.ts"
Task: "Test de la secuencia en mobile/tests/conexion/secuencia-reintentos.test.ts"

# Piezas puras independientes:
Task: "ErrorDeApi y ServidorNoDisponibleError en mobile/src/api/errores.ts"
Task: "resolverUrlBase en mobile/src/api/direccion.ts"
Task: "reducirSesion en mobile/src/sesion/estado-sesion.ts"
Task: "Repositorio del usuario recordado en mobile/src/sesion/usuario-recordado.ts"
Task: "SecuenciaDeReintentos en mobile/src/conexion/secuencia-reintentos.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Test de pestañas en mobile/tests/pantallas/navegacion.test.tsx"
Task: "Test de Perfil en mobile/tests/pantallas/perfil.test.tsx"
Task: "Test del modal en mobile/tests/pantallas/cambiar-usuario.test.tsx"
Task: "Mis compras y Mis eventos en mobile/app/(tabs)/"
Task: "Perfil en mobile/app/(tabs)/perfil.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (Setup), con el SDK confirmado en el celular (T001).
2. Phase 2 (Foundational): toda la lógica pura testeada.
3. Phase 3 (US1): selector y entrada a Explorar.
4. **STOP and VALIDATE**: quickstart §2 y §6 en el celular.

### Incremental Delivery

1. Setup + Foundational → base testeada sin UI.
2. US1 → la app abre y se elige usuario (MVP).
3. US2 → recuerda al usuario y sobrevive a cortes del servidor.
4. US3 → pestañas completas, Perfil y cambio de usuario.
5. US4 + US5 → verificaciones de la base y del CI.
6. Polish → documentación, validación completa y skill `nueva-pantalla`.

---

## Notes

- Las tareas **(persona)** necesitan el celular o una decisión de la persona; el agente no las
  da por hechas.
- Si una versión del SDK obliga a desviarse de research (por ejemplo, sin `Stack.Protected`,
  con `metro.config.js` o sin `eslint-plugin-react-hooks` compatible), se registra en research
  antes de seguir.
- Commit después de cada tarea o grupo coherente; cada checkpoint deja la suite en verde.
