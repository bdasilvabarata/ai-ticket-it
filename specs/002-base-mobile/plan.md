# Implementation Plan: Base mobile

**Branch**: `feature/002-base-mobile` | **Date**: 2026-11-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-base-mobile/spec.md`

## Summary

Sumar al monorepo el workspace `mobile/`: una app Expo + Expo Router en TypeScript que corre en
Expo Go (el SDK es el que soporte el Expo Go de Android del celular, R1). El layout raíz monta
los providers, la franja de "servidor no disponible" y un `Stack` con `Stack.Protected` según la
fase de la sesión: `iniciando`, `sin-usuario` o `con-usuario`. La sesión es un React Context
sobre un reducer puro. Recuerda solo el id en AsyncStorage (`{ version: 1, usuarioId }`) y lo
valida con `GET /api/usuarios/actual` según la regla de FR-013, que es una función pura. El
cliente de `src/api/` recibe sus dependencias inyectadas: `fetch`, dirección y usuario. Tiene
tiempo límite de 8 s, traduce a `ErrorDeApi` o `ServidorNoDisponibleError` y avisa el 401 a la
sesión. TanStack Query maneja el estado del servidor: `retry: false`, `usuarioId` en las
claves, y al cambiar de usuario cancela y limpia la caché. Los reintentos de FR-021a son una
clase pura testeada con fake timers. La dirección sale de `hostUri:3000`, salvo que
`EXPO_PUBLIC_API_URL` esté definida. Calidad: jest-expo + RNTL, ESLint de la raíz con
react-hooks y prohibición de `fetch` fuera de `src/api`, y typecheck sin `expo start`. La última
tarea es la skill `nueva-pantalla`. Decisiones en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript strict. En `mobile/`, la versión que fija `npx expo install
typescript` para el SDK elegido; la raíz sigue con `~6.0` (R1)

**Primary Dependencies**: Expo SDK = el soportado por el Expo Go de Android del celular (lo
verificado en T001: **SDK 58**, Expo Go 58.0.5) · Expo Router · React Native
y React del SDK · `@tanstack/react-query` v5 · `@react-native-async-storage/async-storage` ·
`expo-constants` · `@expo/vector-icons` · `react-native-safe-area-context`. Todo lo ligado
al SDK se instala con `npx expo install`

**Storage**: AsyncStorage del celular, solo para el usuario recordado (R6). Sin estado propio
en el servidor

**Testing**: Jest con `jest-expo` + React Native Testing Library (`renderRouter` de Expo
Router), mock oficial de AsyncStorage, `fetch` falso inyectado, fake timers (R12)

**Target Platform**: celular físico Android (iOS compatible) con Expo Go, en la misma red que
la PC con el servidor de 001. Sin web

**Project Type**: mobile-app dentro del monorepo (`backend/`, `shared/`, `mobile/`)

**Performance Goals**: reapertura con usuario recordado en < 3 s (SC-002); aviso de servidor
no disponible en < 10 s (tiempo límite 8 s, SC-003); suite de mobile < 1 min (SC-006)

**Constraints**: sin compilar app nativa (Expo Go, FR-002); solo herramientas gratuitas;
pantallas de 360 px; sin librerías de UI ni de estado global (principio VII); textos en
español; typecheck del CI sin correr Expo

**Scale/Scope**: 8 archivos en `app/` (2 layouts, cargando, selector y 4 pestañas), 2 endpoints
consumidos, 5 usuarios del seed

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple el plan | Estado |
|---|---|---|
| I. Spec-Driven | Spec clarificada (3 decisiones, más las revisiones del checklist `sesion-y-ux` y de `/speckit-analyze`); este plan → tasks → implement | ✅ |
| II. Test-First | Tests primero de la lógica (cliente, dirección, regla FR-013, reducer, usuario recordado, secuencia de reintentos con fake timers) y de los componentes con comportamiento (selector, franja, Perfil, guards con `renderRouter`); sin servidor ni celular, estado propio por test | ✅ |
| III. Capas | Aplica al backend; no se toca. En mobile se respeta el espíritu: `app/` (rutas) → `src/consultas` y `src/sesion` → `src/api`, con un composition root (`src/composicion.tsx`) que inyecta dependencias | N/A |
| IV. Persistencia en memoria | Servidor sin cambios. AsyncStorage guarda solo una preferencia del dispositivo (el id elegido), no datos del dominio | ✅ |
| V. Contrato de API | Consume `GET /api/usuarios` y `/api/usuarios/actual` tal como están en 001; traduce el formato único `ErrorApi`; sin endpoints nuevos | ✅ |
| VI. Identidad simulada | Selector de usuarios precargados y `X-Usuario-Id` en cada pedido con usuario; 401 → olvidar | ✅ |
| VII. App Mobile | Expo + Expo Router + TS en Expo Go; URL por `EXPO_PUBLIC_API_URL`; todo `fetch` en `src/api/` (controlado por lint); selector con cargando/error/vacío/éxito; `accessibilityLabel` en controles sin texto; layouts flexibles para 360 px. Sin componente de estado de compra (no hay compras todavía). TanStack Query justificado como estado del servidor (R9, Complexity Tracking) | ✅ |
| VIII. Tipos compartidos | `UsuarioVista`, `ErrorApi`, `DetalleError` de `@ai-ticket-it/shared`; test que verifica que Jest transforma `shared` | ✅ |
| IX. Calidad | `strict`; mismo ESLint (sin `any`, comentarios de disable justificados) y Prettier de la raíz; `mobile` entra a `test`, `lint`, `typecheck`, `format:check` y al CI; `npx expo install --check` limpio | ✅ |

**Post-design re-check (Phase 1)**: sin violaciones. Hay dos puntos a registrar: TanStack Query,
porque el principio VII exige justificar librerías de estado, y la convivencia de dos versiones
de TypeScript en el monorepo (R1). No hay contradicciones con la spec. El plan fija tres detalles
que la spec dejó abiertos:
- el tiempo límite de 8 s (FR-010);
- qué muestra Perfil si el usuario se conservó sin confirmar (solo el id);
- que la franja se muestre en toda pantalla con usuario salvo en el selector abierto como modal,
  para que no se duplique con su estado de error. La condición es por exclusión, así cubre
  también las pantallas que las features siguientes apilen fuera de `(tabs)`.

Después del checklist `sesion-y-ux` se ajustaron la spec y R7/R8: FR-014 (solo el 401 olvida),
FR-019 (Perfil con el id), una única secuencia de reintentos para toda la app, `MutationCache`,
el botón "atrás" de Android y los anuncios al lector de pantalla.

Después de `/speckit-analyze` se ajustaron la spec, R3, R7 y las tareas:
- en la validación, un error inesperado cuenta como fallo y la secuencia sigue (I1);
- elegir un usuario detiene la secuencia (A1);
- olvidar al usuario es idempotente (U2);
- `LayoutRaiz` se movió a `src/navegacion/` para que las rutas de `app/` solo exporten su
  componente y los tests no importen desde `app/` (U1);
- test y stub se escriben en el mismo turno, por el hook `Stop` (P1).

## Project Structure

### Documentation (this feature)

```text
specs/002-base-mobile/
├── spec.md
├── plan.md              # este archivo
├── research.md          # decisiones técnicas (R1–R14)
├── data-model.md        # sesión, usuario recordado, reintentos, errores, dependencias
├── quickstart.md        # validación de punta a punta
├── contracts/
│   ├── cliente-api.md   # interfaz de src/api/ y dirección del servidor
│   └── app.md           # rutas, pantallas, textos, comandos y variables
├── checklists/
│   ├── requirements.md
│   └── sesion-y-ux.md
└── tasks.md             # lo genera /speckit-tasks
```

### Source Code (repository root)

```text
package.json                 # workspaces ["backend", "shared", "mobile"]; script "mobile"
eslint.config.js             # + tsx, react-hooks y globals para mobile/**, fetch restringido,
                             #   ignora mobile/.expo
.prettierignore              # + mobile/.expo/
.github/workflows/ci.yml     # mismos pasos; "Tests (Vitest y Jest)"

mobile/
├── package.json             # @ai-ticket-it/mobile; main "expo-router/entry";
│                            #   start/test/typecheck; dep "@ai-ticket-it/shared": "*"
├── app.json                 # nombre, slug, scheme, plugin expo-router (sin typedRoutes)
├── tsconfig.json            # extends expo/tsconfig.base, strict
├── expo-env.d.ts            # versionado (R11)
├── jest.config.js · jest.setup.ts   # preset jest-expo; mock oficial de AsyncStorage
├── .env.example             # EXPO_PUBLIC_API_URL
├── app/
│   ├── _layout.tsx          # solo export por defecto: dependencias reales → LayoutRaiz
│   ├── cargando.tsx
│   ├── seleccionar-usuario.tsx
│   └── (tabs)/
│       ├── _layout.tsx      # Tabs con ícono y texto
│       ├── index.tsx        # Explorar
│       ├── mis-compras.tsx
│       ├── mis-eventos.tsx
│       └── perfil.tsx
├── src/
│   ├── composicion.tsx      # COMPOSITION ROOT: crearDependencias + DependenciasProvider
│   ├── navegacion/
│   │   └── LayoutRaiz.tsx   # providers + franja + Stack.Protected por fase (testeable)
│   ├── api/
│   │   ├── cliente.ts       # crearClienteApi (timeout 8 s, X-Usuario-Id, traducción, 401)
│   │   ├── errores.ts       # ErrorDeApi, ServidorNoDisponibleError
│   │   ├── direccion.ts     # resolverUrlBase
│   │   ├── usuarios.ts      # listarUsuarios, obtenerUsuarioActual
│   │   └── index.ts
│   ├── sesion/
│   │   ├── estado-sesion.ts       # tipos + reducer puro
│   │   ├── validacion.ts          # decidirValidacion (FR-013)
│   │   ├── usuario-recordado.ts   # { version: 1, usuarioId } sobre Almacenamiento
│   │   └── SesionProvider.tsx     # Context, useSesion, cliente de la sesión, reintentos
│   ├── conexion/
│   │   ├── secuencia-reintentos.ts    # clase pura (FR-021a)
│   │   └── useConexion.ts             # lee la secuencia única del SesionProvider
│   ├── consultas/
│   │   ├── query-client.ts  # crearQueryClient (retry false, Query/MutationCache.onError), focusManager
│   │   ├── claves.ts        # claves con usuarioId
│   │   └── useUsuarios.ts
│   └── componentes/         # Cargando, MensajeError, ListaVacia, SeccionPendiente,
│                            #   FranjaServidorNoDisponible, FilaUsuario
└── tests/
    ├── api/                 # cliente, errores, dirección, usuarios
    ├── sesion/              # reducer, validación, usuario recordado
    ├── conexion/            # secuencia de reintentos (fake timers)
    ├── consultas/           # query-client (retry, Query/MutationCache.onError)
    ├── componentes/         # franja, MensajeError
    ├── pantallas/           # selector, Perfil, guards, arranque, errores en uso y cambio
    │                        #   de usuario (renderRouter)
    ├── helpers/             # renderConDependencias, fetch falso
    └── shared.test.ts       # @ai-ticket-it/shared se transforma sin transformIgnorePatterns

.claude/skills/nueva-pantalla/SKILL.md   # última tarea: convenciones de pantallas (R14)
```

Además: README (cómo arrancar, SDK de Expo Go, abrir en el celular, `EXPO_PUBLIC_API_URL`,
`REACT_NATIVE_PACKAGER_HOSTNAME` por la interfaz de VirtualBox, firewall, calidad), `AGENTS.md`
(mapa de `mobile/`, comando `npm run mobile`, skill) y `docs/backlog.md` (estado), según FR-026.
`.gitignore` ya cubre `mobile/.expo/` y `.env`.

**Structure Decision**: tercer workspace `mobile/` con las rutas en `app/` (Expo Router) y la
lógica en `src/`, separada por responsabilidad (`api`, `sesion`, `conexion`, `consultas`,
`componentes`) y conectada en un único composition root. Los tests van en `mobile/tests/`
porque Expo Router interpretaría como rutas los archivos dentro de `app/`.

## Complexity Tracking

| Desviación | Por qué hace falta | Alternativa más simple descartada porque |
|---|---|---|
| `@tanstack/react-query` (principio VII: librerías de estado solo justificadas) | Es estado **del servidor**, no estado global: caché, deduplicación, cancelación por `signal`, los cuatro estados de pantalla y limpieza total al cambiar de usuario (FR-016), que van a necesitar todas las pantallas de 003–011 (R9) | `useEffect` + `useState` por pantalla: repite carga, error, cancelación y el caso del usuario cambiado en cada feature, y es fácil equivocarse |
| Dos versiones de TypeScript en el monorepo (raíz `~6.0`, `mobile` la del SDK) | Expo soporta una versión de TypeScript por SDK y typescript-eslint de la raíz limita la otra (R1) | Una sola versión: rompe el lint (001 R1) o queda fuera de lo que soporta el SDK |
| Ruta `cargando` | Que el selector no se monte ni pida la lista mientras se valida el usuario recordado (US2-6), con `Stack.Protected` siempre montado (R3) | No montar el `Stack` (Expo Router lo exige) o un overlay (el selector igual se montaría debajo) |
