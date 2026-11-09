---

description: "Tareas de implementación de la feature 003 — Refactor de la arquitectura mobile"
---

# Tasks: Refactor de la arquitectura mobile

**Input**: documentos de diseño en `specs/003-refactor-mobile/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/estructura.md](./contracts/estructura.md),
[contracts/cliente-api.md](./contracts/cliente-api.md),
[contracts/componentes-base.md](./contracts/componentes-base.md), [quickstart.md](./quickstart.md)

**Tests**: obligatorios para lo **nuevo** (constitución II, plan "Constitution Check"):
formato, `Boton`, `SegunConsulta`, `useConexion` sin provider, `pedir`/atajos/204/cuerpo/401 en
escritura, mutation no repetida, reglas de lint y guarda de rutas. Lo que **se mueve** queda
cubierto por los tests de la 002 (sobre todo `tests/pantallas/`, que recorren la app entera con
`renderConDependencias`): se corren antes y después de cada movimiento y **no cambian lo que
verifican** (FR-003), solo su ubicación o sus imports.

**Organización**: las tareas se agrupan por historia de usuario (US1–US3). Los contratos de base
`useConexion` y `useClienteApi` van en Foundational porque los necesitan US1 (cortar ciclos) y
US2 (`SegunConsulta`).

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: puede hacerse en paralelo (archivo distinto, sin dependencias pendientes).
- **[Story]**: historia a la que pertenece (US1–US3).
- Rutas relativas a la raíz del repo.

## Convenciones para todas las tareas

- **Cero cambios visibles** (FR-001): textos, colores, tamaños, accesibilidad y navegación
  iguales a la 002. Si una tarea parece obligar a cambiar algo visible, se frena y se consulta.
- **Firmas intactas** (FR-002): `useSesion(): { estado, elegirUsuario, reintentar }`,
  `useClienteApi(): ClienteApi`, `useConexion(): EstadoConexion`.
- **Movimientos con `git mv`** (R11) para conservar la historia. Después de cada movimiento:
  `npm test -w mobile`, `npm run lint` y `npm run typecheck` en verde antes de seguir.
- **Test primero con stub en el mismo turno** (AGENTS.md): el hook `Stop` exige typecheck y lint
  en verde al cerrar cada turno. Al escribir un test, en el mismo turno se crea el módulo que
  importa como **stub con la firma real** que lanza `new Error("no implementado")` (o un
  componente que devuelve `null`). Se corre el test, **se lo ve fallar** por comportamiento, y
  recién entonces se implementa.
- Imports relativos, sin extensión, `import type` para tipos, sin alias `@/` (R1). Desde afuera
  de una feature solo se importa su `index.ts` (`../features/sesion`); adentro de la feature, por
  archivo (`./controlador-sesion`), nunca por el `index.ts` propio. Dentro de la base, un módulo
  importa otro de su carpeta por archivo y el de otra carpeta por su `index.ts` (R1, convención
  de imports en la base).
- Prohibidos `any`, `@ts-ignore` y `eslint-disable` sin descripción (principio IX). Todo `fetch`
  sigue en `mobile/src/api/` (y la referencia a `fetch` global en `mobile/src/composicion.ts`).
- Los tests de `mobile/tests/**` pueden importar archivos internos de una feature (el reducer,
  el controlador): quedan fuera de las zonas de `no-restricted-paths` (R4).
- Commits: Conventional Commits con scope `003-refactor-mobile` (por ejemplo,
  `refactor(003-refactor-mobile): feature sesion con dependencias por props`), uno por tarea o
  grupo coherente.

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: red de seguridad del refactor y dependencias de lint instaladas.

- [X] T001 Correr desde la raíz `npm test`, `npm run lint`, `npm run typecheck` y
  `npm run format:check` en el HEAD actual de `feature/003-refactor-mobile`, antes de tocar
  código (sobre `development` la rama solo tiene commits de documentación), y anotar en la
  sección **Notas** al final de `specs/003-refactor-mobile/tasks.md` la cantidad de suites y de
  tests de `mobile/` que pasan. Es la base contra la que se compara FR-003 / SC-001.
- [X] T002 Instalar en la raíz, como devDependencies, `eslint-plugin-import-x@^4` y
  `eslint-import-resolver-typescript` (`npm install -D ...`); verificar que el peer de
  `import-x` acepta `eslint ^10` sin `--legacy-peer-deps`. Archivos: `package.json`,
  `package-lock.json`. Sin uso todavía en `eslint.config.js`.

---

## Phase 2: Foundational (contratos de base)

**Purpose**: la base define `EstadoConexion`/`useConexion` y `useClienteApi`, y `SesionProvider`
los implementa (clarificación 3, R2). Corta los ciclos de carpetas `sesion ↔ conexion` y deja
listo el contrato que usa `SegunConsulta` (US2).

**⚠️ CRITICAL**: US1 y US2 dependen de esta fase.

- [X] T003 Test de contrato en `mobile/tests/conexion/conexion.test.tsx` y, en el mismo turno,
  stub de `mobile/src/conexion/conexion.tsx` con las firmas reales (`EstadoConexion` copiado
  tal cual de `mobile/src/conexion/useConexion.ts`: `servidor: "disponible" | "no-disponible"`,
  `enCurso`, `automaticosRestantes`, `reintentarAhora: () => Promise<void>`, `urlBase`;
  `ConexionProvider({ valor, children })`; `useConexion(): EstadoConexion`) y
  `mobile/src/conexion/index.ts` que los exporta. Casos: dentro de `ConexionProvider`,
  `useConexion()` devuelve el `valor` provisto; fuera, lanza un error cuyo mensaje dice que se
  usa dentro de `ConexionProvider`. Ver fallar.
- [X] T004 Implementar `mobile/src/conexion/conexion.tsx` (contexto `null` por defecto y el
  error de T003). En `mobile/src/sesion/SesionProvider.tsx`, armar el valor igual que el
  `useConexion` de hoy (`servidor` es `"no-disponible"` solo en fase `con-usuario` con
  `estado.servidor === "no-disponible"`; `enCurso` y `automaticosRestantes` de la secuencia;
  `reintentarAhora` = `controlador.reintentarAhora`; `urlBase` de las dependencias) y envolver a
  `children` en `<ConexionProvider valor={...}>`. Eliminar `useSecuenciaDeLaSesion` y
  `mobile/src/conexion/useConexion.ts` (`git rm`); actualizar los imports de `useConexion` en
  `mobile/src/navegacion/LayoutRaiz.tsx` y `mobile/app/seleccionar-usuario.tsx` a `../conexion`
  / `../src/conexion`. T003 y toda la suite en verde.
- [X] T005 Test de contrato en `mobile/tests/consultas/cliente-api.test.tsx` y, en el mismo
  turno, stub de `mobile/src/consultas/cliente-api.tsx` con `ClienteApiProvider({ cliente,
  children })` y `useClienteApi(): ClienteApi`. Casos: dentro del provider devuelve el
  `cliente` provisto; fuera, lanza un error cuyo mensaje dice que se usa dentro de
  `ClienteApiProvider`. Ver fallar e implementar (mismo patrón que T004). Después, en
  `mobile/src/sesion/SesionProvider.tsx`, envolver a `children` también en
  `<ClienteApiProvider cliente={controlador.cliente}>`, quitar `cliente` de `ValorSesion` y
  borrar el `useClienteApi` de ahí. Actualizar imports en `mobile/src/consultas/useUsuarios.ts`
  (`./cliente-api`) y `mobile/tests/pantallas/errores-en-uso.test.tsx`
  (`../../src/consultas/cliente-api`). Suite en verde sin cambiar lo que verifica.

**Checkpoint**: la sesión provee la conexión y el cliente por contratos de la base; ningún
módulo de `conexion/` ni de `consultas/` importa `sesion/`.

---

## Phase 3: User Story 1 - Encontrar y ubicar cada pieza de una pantalla por feature (Priority: P1) 🎯 MVP

**Goal**: `mobile/` organizado en base + `features/usuarios` + `features/sesion` + conectores,
`app/` con re-exports de una línea, lint que impide ciclos y cruces de límites, y rutas tipadas
que fallan en el typecheck (local y CI).

**Independent Test**: suite completa en verde con el mismo número de tests que T001 (más los
nuevos); cada archivo de `mobile/app/` es una sola sentencia; los cambios a propósito de
quickstart §2 hacen fallar lint o typecheck con la regla esperada.

### Lint de dependencias (antes de mover)

- [X] T006 [US1] Test de arquitectura en `mobile/tests/arquitectura/reglas-de-dependencia.test.ts`
  con docblock `/** @jest-environment node */` y timeout de 60 s. Helper
  `lintear(rutaRelativaALaRaiz, codigo)` que corre ESLint como proceso hijo
  (`execFileSync(process.execPath, [<raíz>/node_modules/eslint/bin/eslint.js, "--stdin",
  "--stdin-filename", ruta, "--format", "json"], { cwd: <raíz>, input: codigo })`, tolerando el
  exit code 1) y devuelve los `ruleId` de los mensajes. Casos de esta tarea: (a) el contenido
  real de `mobile/src/api/errores.ts` + `import "./cliente";` como
  `mobile/src/api/errores.ts` → incluye `import-x/no-cycle`; (e) `eslint mobile --format json`
  sobre el código real → cero errores. Ver fallar (a) (la regla todavía no existe).
- [X] T007 [US1] Configurar `eslint-plugin-import-x` en `eslint.config.js` para
  `mobile/**/*.{ts,tsx}` (R4): resolver `eslint-import-resolver-typescript` con
  `project: "mobile/tsconfig.json"`; `import-x/no-cycle` con `ignoreExternal: true`;
  `import-x/no-restricted-paths` con zonas **calculadas** por una función
  `zonasDeDependenciaMobile()` que usa `fs.readdirSync` (`import.meta.dirname` para la raíz):
  - una zona por entrada de `mobile/src` salvo `features`, `navegacion` y `composicion.ts`, con
    `from: "mobile/src/features"` y mensaje "La base no importa features (salvo composicion y
    navegacion)" → regla 2;
  - una zona por feature `F` de `mobile/src/features` (lista vacía si la carpeta no existe):
    `target: features/F`, `from: features`, `except: ["./F", ...["./G/index.ts" para G ≠ F]]`,
    mensaje "Entre features, solo por el index.ts" → regla 3;
  - una zona con targets `mobile/app`, `mobile/src/navegacion`, `mobile/src/composicion.ts`,
    `from: features`, `except` con cada `./F/index.ts` → regla 3 desde los conectores.
  Los tests (`mobile/tests/**`) quedan fuera de las zonas. T006 en verde y `npm run lint` en
  verde sobre el código actual.

### Rutas tipadas

- [X] T008 [US1] Guarda de rutas en `mobile/tests/tipos/rutas-tipadas.ts` (no matchea el
  `testMatch` de `mobile/jest.config.js`, solo lo compila `tsc`): `import type { Href } from
  "expo-router";`, `export const valida: Href = "/seleccionar-usuario";` y, con
  `// @ts-expect-error la ruta no existe: las rutas tipadas deben rechazarla (FR-009)`,
  `export const invalida: Href = "/seleccionar-usuarios";`. Correr `npx tsc --noEmit -p mobile`
  y **ver fallar** por la directiva sin uso. Como el hook `Stop` exige typecheck en verde, T009
  se hace en el mismo turno.
- [X] T009 [US1] Activar las rutas tipadas (R5): `"experiments": { "typedRoutes": true }` en
  `mobile/app.json`; `mobile/scripts/generar-tipos-rutas.js` (CommonJS, ~15 líneas) que define
  `process.env.EXPO_ROUTER_APP_ROOT = <mobile>/app`, crea `mobile/.expo/types/`, resuelve
  `@expo/router-server/build/typed-routes` desde `@expo/cli` (`require.resolve(..., { paths:
  [require.resolve("@expo/cli/package.json")] })`), llama a `regenerateDeclarations` y termina
  con `process.exit(1)` y un mensaje claro si el módulo no está o su `version` es < 52;
  `"typecheck": "node scripts/generar-tipos-rutas.js && tsc --noEmit"` en
  `mobile/package.json`; en `mobile/tsconfig.json`, `include` suma `.expo/types/**/*.ts` y
  `expo-env.d.ts` y `exclude` deja solo `node_modules`; `mobile/expo-env.d.ts` en `.gitignore`;
  en `eslint.config.js`, `mobile/scripts/**` con globals de node y `sourceType: "commonjs"`.
  `npm run typecheck` en verde (T008 incluido) y `router.push("/seleccionar-usuario")` /
  `router.replace("/")` del código actual siguen compilando.

### Movimientos (base → features → conectores → app/)

- [X] T010 [US1] Dependencias por props, **antes de mover** (R2): con los archivos todavía en
  `mobile/src/sesion/`, en `mobile/src/sesion/controlador-sesion.ts` definir y exportar
  `OpcionesCliente` (movida de `composicion`) y `DependenciasSesion { urlBase;
  usuarioRecordado: RepositorioUsuarioRecordado; queryClient: QueryClient;
  crearCliente(opciones: OpcionesCliente): ClienteApi; registrarOyenteDeErrores(oyente: (error:
  unknown) => void): () => void }`, y usarla en lugar de `Dependencias` (sin importar
  `../composicion`). `SesionProvider` recibe `dependencias: DependenciasSesion` por prop (sin
  `useDependencias`). `git mv mobile/src/composicion.tsx mobile/src/composicion.ts`: borrar
  `DependenciasProvider`, `useDependencias` y el contexto; `export type Dependencias =
  DependenciasSesion` (importado de `./sesion/controlador-sesion`). En `LayoutRaiz.tsx`, quitar
  `DependenciasProvider` y pasar `<SesionProvider dependencias={dependencias}>`. En
  `eslint.config.js`, el `ignores` de la regla de `fetch` pasa a `mobile/src/composicion.ts`.
  `mobile/tests/helpers/render-con-dependencias.tsx` sigue igual salvo el import. Suite en
  verde; `grep -rn "composicion" mobile/src/sesion` sin resultados.
- [X] T011 [US1] Feature `sesion`, archivos: `git mv` de `mobile/src/sesion/{estado-sesion,
  validacion,usuario-recordado,controlador-sesion}.ts` y `SesionProvider.tsx` a
  `mobile/src/features/sesion/`, y de `mobile/src/conexion/secuencia-reintentos.ts` a
  `mobile/src/features/sesion/secuencia-reintentos.ts` (R2: solo la usa el controlador). Crear
  `mobile/src/features/sesion/index.ts` con `SesionProvider`, `useSesion`,
  `crearRepositorioUsuarioRecordado` y los tipos `Almacenamiento`,
  `RepositorioUsuarioRecordado`, `DependenciasSesion` y `OpcionesCliente`. `composicion.ts`
  importa `crearRepositorioUsuarioRecordado`, `Almacenamiento`, `DependenciasSesion` y
  `OpcionesCliente` desde `./features/sesion`. Ajustar imports en
  `mobile/src/navegacion/LayoutRaiz.tsx`, `mobile/app/seleccionar-usuario.tsx` y
  `mobile/app/(tabs)/perfil.tsx` (todos por `features/sesion`, su `index.ts`). Tests: `git mv`
  de `mobile/tests/sesion/*.test.ts` y `mobile/tests/conexion/secuencia-reintentos.test.ts` a
  `mobile/tests/features/sesion/` con imports a `../../../src/...`; ajustar
  `mobile/tests/pantallas/errores-en-uso.test.tsx`. Borrar `mobile/src/sesion/`. Suite y lint en
  verde; `grep -rn "composicion" mobile/src/features` sin resultados.
- [X] T012 [US1] Feature `usuarios`: `git mv mobile/src/componentes/FilaUsuario.tsx
  mobile/src/features/usuarios/componentes/FilaUsuario.tsx` y `git mv
  mobile/src/consultas/useUsuarios.ts mobile/src/features/usuarios/useUsuarios.ts` (importa
  `useClienteApi` de `../../consultas/cliente-api`, `claves` de `../../consultas/claves` y
  `listarUsuarios` de `../../api`); `FilaUsuario` toma `colores` de `../../../componentes/estilos`
  hasta US2. Crear `mobile/src/features/usuarios/index.ts` con `useUsuarios` y `FilaUsuario`
  (`PropsFilaUsuario` como tipo). Ajustar `mobile/app/seleccionar-usuario.tsx` para importar de
  `../src/features/usuarios`. Suite y lint en verde.
- [X] T013 [US1] Conectores de navegación (R3): crear `mobile/src/navegacion/RaizDeLaApp.tsx`
  con `export function RaizDeLaApp()` (el `useState(crearDependenciasDeProduccion)` + `<LayoutRaiz
  dependencias={...} />` de hoy) y `git mv "mobile/app/(tabs)/_layout.tsx"
  mobile/src/navegacion/LayoutPestanas.tsx` con export con nombre `LayoutPestanas` (íconos,
  títulos y labels sin cambios). Reemplazar `mobile/app/_layout.tsx` por
  `export { RaizDeLaApp as default } from "../src/navegacion/RaizDeLaApp";` y crear
  `mobile/app/(tabs)/_layout.tsx` con `export { LayoutPestanas as default } from
  "../../src/navegacion/LayoutPestanas";`. `tests/pantallas/navegacion.test.tsx` y
  `guards.test.tsx` en verde.
- [X] T014 [US1] Pantallas de la feature `sesion`: `git mv mobile/app/seleccionar-usuario.tsx
  mobile/src/features/sesion/pantallas/SeleccionarUsuario.tsx` y `git mv
  "mobile/app/(tabs)/perfil.tsx" mobile/src/features/sesion/pantallas/Perfil.tsx`, con export
  con nombre (`SeleccionarUsuario`, `Perfil`) e imports relativos a su nueva ubicación (la
  sesión por archivo, `../SesionProvider`; usuarios por `../../usuarios`; base por
  `../../../api`, `../../../conexion`, `../../../componentes/...`). Exportarlas desde
  `features/sesion/index.ts`. Crear `mobile/app/seleccionar-usuario.tsx` (`export {
  SeleccionarUsuario as default } from "../src/features/sesion";`) y
  `mobile/app/(tabs)/perfil.tsx` (`export { Perfil as default } from
  "../../src/features/sesion";`). `tests/pantallas/{selector,perfil,cambiar-usuario,arranque}`
  en verde.
- [X] T015 [US1] Punto de entrada de componentes y rutas restantes: crear
  `mobile/src/componentes/index.ts` con `Cargando`, `MensajeError`, `ListaVacia`,
  `SeccionPendiente`, `FranjaServidorNoDisponible` (y `colores` hasta que T021 lo reemplace).
  `mobile/app/cargando.tsx` → `export { Cargando as default } from "../src/componentes";`.
  `mobile/app/(tabs)/{index,mis-compras,mis-eventos}.tsx` siguen renderizando
  `<SeccionPendiente nombre="…" />` (FR-006) pero importándolo de `../../src/componentes`, en
  una sola declaración `export default function ...` sin estilos. `LayoutRaiz.tsx` y las
  pantallas de `sesion` importan los componentes por `componentes/index` (convención de imports
  en la base).
- [X] T016 [US1] Regla 4 (`app/` sin lógica, SC-003): agregar al test de T006 el caso (d)
  `mobile/app/x.tsx` con `import { View } from "react-native";` → incluye
  `no-restricted-imports`; ver fallar. En el mismo turno, en `eslint.config.js`, bloque para
  `mobile/app/**` con `no-restricted-imports` sobre `react`, `react-native`,
  `@tanstack/react-query`, `@expo/vector-icons` y `expo-router`, mensaje "app/ solo expone una
  pantalla o layout de src/ (FR-006)". Test y `npm run lint` en verde.
- [X] T017 [US1] Completar el test de arquitectura con las reglas 2 y 3 ahora que existen las
  features: (b) `mobile/src/componentes/X.tsx` con `import "../features/sesion";` y (c)
  `mobile/src/features/sesion/pantallas/X.tsx` con `import "../../usuarios/useUsuarios";` →
  ambos incluyen `import-x/no-restricted-paths`; (f) control positivo:
  `mobile/src/features/sesion/pantallas/X.tsx` con `import "../../usuarios";` → sin errores.
  Si (b) o (c) no fallan, el resolver o las zonas de T007 están mal: corregir
  `eslint.config.js`, no el test.
- [X] T018 [US1] Cierre de US1: verificar que `mobile/src/sesion/` y
  `mobile/src/conexion/useConexion.ts` ya no existen, que cada archivo de `mobile/app/` tiene a
  lo sumo una sentencia propia sin contar los imports y sin estilos (SC-003; en las secciones
  pendientes, la función que renderiza `SeccionPendiente`) y que la suite tiene al menos los tests de
  T001. Probar a mano la tabla de quickstart §2 (ciclo, base → feature, interno entre features,
  `react-native` en `app/`, ruta `"/seleccionar-usuarios"` en `Perfil.tsx`) y deshacer cada
  cambio, con una diferencia: en el caso del import interno entre features, usar
  `../../usuarios/useUsuarios`, porque `formato` recién existe en T019 (un import que no se
  resuelve no lo marca `no-restricted-paths` y daría un verde falso). Las cuatro verificaciones en verde.

**Checkpoint**: US1 completa. La app se comporta igual que en la 002 y la estructura de
[contracts/estructura.md](./contracts/estructura.md) está en su lugar (salvo `tema`, `Boton`,
`SegunConsulta` y `formato`, que suma US2).

---

## Phase 4: User Story 2 - Armar una pantalla con piezas base (Priority: P2)

**Goal**: `tema`, `Boton`, `SegunConsulta` y formato puro de usuario, con el selector, Perfil,
`MensajeError`, la franja y "Cerrar" migrados sin cambios visibles.

**Independent Test**: tests nuevos de formato, `Boton` y `SegunConsulta` en verde; los de
pantalla y componentes de la 002 siguen pasando sin cambios; quickstart §3 (sin colores
sueltos, el selector sin su propio bloque `isPending/isError`).

### Formato de vista

- [X] T019 [P] [US2] Tests en `mobile/tests/features/usuarios/formato.test.ts` y, en el mismo
  turno, stub de `mobile/src/features/usuarios/formato.ts` con
  `nombreCompleto(usuario: Pick<UsuarioVista, "nombre" | "apellido">): string` y
  `textoEventosOrganizados(cantidad: number): string`. Casos de
  [contracts/componentes-base.md](./contracts/componentes-base.md#formato-de-vista-featuresusuariosformatots):
  `{ nombre: "Lucía", apellido: "Gómez" }` → `"Lucía Gómez"`; `0` → `"No organiza eventos"`;
  `1` → `"Organiza 1 evento"`; `3` → `"Organiza 3 eventos"`. Ver fallar.
- [X] T020 [US2] Implementar `formato.ts` (la lógica de `textoEventos` de hoy) y exportar ambas
  funciones desde `features/usuarios/index.ts`. Usarlas en `FilaUsuario.tsx` (texto y
  `accessibilityLabel`; borrar `textoEventos`) y en `features/sesion/pantallas/Perfil.tsx`
  (`nombreCompleto(usuario)`, importado de `../../usuarios`). FR-015.

### Tema

- [X] T021 [US2] Crear `mobile/src/componentes/tema.ts` con `export const tema = { ... } as
  const` y **exactamente** los valores de [data-model.md "Tema"](./data-model.md#tema):
  `colores` (`texto #1f2933`, `textoSecundario #52606d`, `primario #1d4ed8`, `sobrePrimario
  #ffffff`, `fondo #ffffff`, `borde #d9e2ec`, `avisoFondo #fff4ce`, `avisoTexto #5c3c00`),
  `espacio` (`minimo 2`, `chico 8`, `medio 12`, `fila 14`, `normal 16`, `grande 20`, `amplio
  24`), `texto` (`chico 14`, `aviso 15`, `normal 16`, `destacado 17`, `subtitulo 18`, `titulo
  22`), `peso` (`medio "500"`, `fuerte "600"`), `radio.normal 8` y `opacidadApagado 0.6`.
  Reemplazar `colores` y todo número suelto de color, espacio, tamaño de texto, peso, radio u
  opacidad por `tema.*` en `Cargando`, `ListaVacia`, `MensajeError`, `SeccionPendiente`,
  `FranjaServidorNoDisponible`, `FilaUsuario`, `SeleccionarUsuario`, `Perfil` y `LayoutRaiz`
  (se permiten `StyleSheet.hairlineWidth`, `borderWidth: 1` e insets). Si aparece un valor que
  no está en la tabla, agregarlo al tema con el mismo valor y anotarlo en `data-model.md`.
  `git rm mobile/src/componentes/estilos.ts`; en `componentes/index.ts`, `tema` reemplaza a
  `colores`. `grep -rn "#[0-9a-fA-F]\{6\}" mobile/src --include=*.tsx` sin resultados.

### Boton

- [X] T022 [P] [US2] Tests en `mobile/tests/componentes/boton.test.tsx` y, en el mismo turno,
  stub de `mobile/src/componentes/Boton.tsx` (devuelve `null`) con `PropsBoton` de
  [data-model.md "Boton"](./data-model.md#boton): `texto: string`, `alPresionar: () => void`,
  `variante?: "primario" | "aviso" | "texto"` (por defecto `"primario"`), `deshabilitado?`,
  `enCurso?`, `textoEnCurso?` (por defecto `texto`), `accessibilityLabel?`, `hitSlop?: number`,
  `style?: StyleProp<ViewStyle>`. Casos (tabla de
  [contracts/componentes-base.md](./contracts/componentes-base.md#boton)): normal → rol botón
  con nombre `texto`, al tocar llama `alPresionar`; con `accessibilityLabel` → ese es el nombre;
  `deshabilitado` → deshabilitado para el lector y tocarlo no llama; `enCurso` con
  `textoEnCurso="Reintentando…"` → muestra ese texto, `accessibilityState` `disabled` y `busy`,
  tocarlo no llama; `enCurso` sin `textoEnCurso` → muestra `texto`. Ver fallar.
- [X] T023 [US2] Implementar `Boton.tsx` (R7): `Pressable` con `accessibilityRole="button"`,
  `disabled={deshabilitado || enCurso}`, `accessibilityState={{ disabled: deshabilitado ||
  enCurso, busy: enCurso }}`, opacidad `tema.opacidadApagado` presionado, deshabilitado o en
  curso; estilos por variante tomados del código actual: `primario` = el botón de
  `MensajeError`/Perfil (padding vertical `medio`, horizontal `grande`, `radio.normal`, fondo
  `primario`, texto `sobrePrimario` `normal` `fuerte`); `aviso` = el "Reintentar" de la franja
  (con borde sobre el fondo de aviso, mismos valores de hoy); `texto` = "Cerrar" (`normal`,
  `fuerte`, color `primario`, sin fondo). Exportar desde `componentes/index.ts`.
- [X] T024 [US2] Migrar a `Boton` (FR-012, SC-005): `MensajeError.tsx` (`primario`,
  "Reintentar"/"Reintentando…"), Perfil "Cambiar usuario" (`primario`, `style` con
  `marginTop: tema.espacio.chico`), `FranjaServidorNoDisponible.tsx` (`aviso`, mantiene sus
  props `urlBase`, `reintentando`, `alReintentar`) y `BotonCerrar` de `LayoutRaiz.tsx`
  (`texto`, `accessibilityLabel="Cerrar sin cambiar de usuario"`, `hitSlop={8}`). Borrar los
  estilos de botón duplicados. `tests/componentes/{mensaje-error,franja}.test.tsx` y
  `tests/pantallas/{perfil,cambiar-usuario,errores-en-uso}.test.tsx` en verde sin cambios;
  `grep -rn "Pressable" mobile/src` solo en `Boton.tsx` y `FilaUsuario.tsx`.

### SegunConsulta

- [X] T025 [P] [US2] Tests en `mobile/tests/componentes/segun-consulta.test.tsx` y, en el mismo
  turno, stub de `mobile/src/componentes/SegunConsulta.tsx` (devuelve `null`) con
  `ConsultaMostrable<T>` (`isPending`, `isError`, `error: unknown`, `data: T | undefined`,
  `isFetching`, `refetch: () => unknown`) y `PropsSegunConsulta<T>` (`consulta`, `mensajeVacio`,
  `esVacio?`, `children: (datos: T) => React.ReactNode`), de
  [data-model.md](./data-model.md#segunconsulta). Renderiza dentro de `<ConexionProvider
  valor={...}>` con `urlBase` de prueba y `reintentarAhora: jest.fn()`, pasando consultas
  literales. Casos (orden de R8): pendiente → "Cargando…"; `ServidorNoDisponibleError` →
  "Servidor no disponible", "No se pudo conectar con {urlBase}." y "Reintentar" llama a
  `reintentarAhora` (no a `refetch`); con `conexion.enCurso` → "Reintentando…" deshabilitado;
  `ErrorDeApi` → su `mensaje` y "Reintentar" llama a `refetch`; con `isFetching` →
  "Reintentando…"; error de otro tipo → "Ocurrió un error inesperado."; `data` `[]`,
  `undefined` y `null` → `mensajeVacio`; `esVacio` propio respetado; datos → `children(datos)`.
  Más un caso con `useQuery` real (`QueryClient` nuevo, sin reintentos): con datos ya cargados,
  cancelar un refetch colgado (`queryClient.cancelQueries()`) sigue mostrando los datos, sin
  error (edge case). Ver fallar.
- [X] T026 [US2] Implementar `SegunConsulta.tsx` con `useConexion()` de `../conexion`, las
  clases de error de `../api`, `Cargando`, `MensajeError` y `ListaVacia` por archivo (misma
  carpeta). `esVacio` por defecto: `datos === undefined || datos === null || (Array.isArray(datos)
  && datos.length === 0)`. Exportar desde `componentes/index.ts`. T025 en verde.
- [X] T027 [US2] Migrar `features/sesion/pantallas/SeleccionarUsuario.tsx` a `<SegunConsulta
  consulta={consulta} mensajeVacio="No hay usuarios disponibles.">{(usuarios) => <FlatList
  .../>}</SegunConsulta>` (FR-014, SC-005): sin el bloque `isPending/isError/length === 0`,
  sin `useConexion` ni las clases de error importadas si ya no se usan; el aviso de usuario
  inexistente, el título "¿Con quién querés operar?" y `FilaUsuario` sin cambios.
  `tests/pantallas/{selector,arranque,cambiar-usuario,guards}.test.tsx` en verde sin cambios.

**Checkpoint**: US2 completa; quickstart §3 en verde.

---

## Phase 5: User Story 3 - Usar el servidor con cualquier método HTTP (Priority: P3)

**Goal**: `ClienteApi` con `pedir(metodo, ruta, { cuerpo, signal, usuarioId })` y
`get/post/put/patch/delete`, JSON + `Content-Type`, 204 → `undefined`, mismo manejo de errores,
tiempo límite y 401 que la 002, y escrituras que nunca se repiten solas.

**Independent Test**: `npm test -w mobile -- api` y `errores-en-uso` en verde; los tests de
lectura de la 002 sin cambios (quickstart §4).

- [ ] T028 [P] [US3] En `mobile/tests/helpers/fetch-falso.ts`, sumar `cuerpo?: string` a
  `PedidoRegistrado` (el `init.body` si es string, si no `undefined`). Agregado puro: ningún
  test existente cambia (FR-003, R10).
- [ ] T029 [US3] Tests en `mobile/tests/api/cliente.test.ts` (nuevo `describe("pedir y atajos")`)
  y, en el mismo turno, stub en `mobile/src/api/cliente.ts` con las firmas de
  [contracts/cliente-api.md](./contracts/cliente-api.md): `MetodoHttp = "GET" | "POST" | "PUT" |
  "PATCH" | "DELETE"`, `OpcionesPedidoConCuerpo extends OpcionesPedido { cuerpo?: unknown }` y
  en `ClienteApi` `pedir<T>(metodo, ruta, opciones?)`, `post/put/patch<T>(ruta, cuerpo?,
  opciones?)` y `delete<T>(ruta, opciones?)`; `pedir` lanza "no implementado" y `get` conserva
  su implementación actual. Exportar `MetodoHttp`, `OpcionesPedido` y `OpcionesPedidoConCuerpo`
  desde `mobile/src/api/index.ts`. Casos: cada atajo usa su método; `post` con cuerpo → `body`
  = `JSON.stringify(cuerpo)`, `Content-Type: application/json`, `Accept: application/json` y
  `X-Usuario-Id` del usuario actual; `post`/`delete` sin cuerpo → sin `Content-Type` ni `body`;
  `pedir("PUT", ...)` con `usuarioId: null` → sin `X-Usuario-Id`; `204` (en `delete` y en `get`)
  → resuelve `undefined`; 200 con cuerpo vacío → `ErrorDeApi` `RESPUESTA_INESPERADA`; 409 con
  `ErrorApi` en un `post` → `ErrorDeApi` con `status`, `codigo`, `mensaje` y `detalles`;
  `"colgar"` + `jest.advanceTimersByTimeAsync(8000)` en un `post` →
  `ServidorNoDisponibleError` `tiempo-agotado`; `"rechazar"` → `sin-conexion`; `signal` externo
  abortado → el error de cancelación tal cual; 401 `USUARIO_NO_IDENTIFICADO` en un `patch` con
  `usuarioId: "u2"` → `alUsuarioNoIdentificado("u2")`; en todos, `fetch` se llamó una sola vez.
  Ver fallar.
- [ ] T030 [US3] Implementar `pedir` en `mobile/src/api/cliente.ts` moviendo ahí el cuerpo del
  `get` actual (R10): `method: metodo`; si `opciones.cuerpo !== undefined`, `body:
  JSON.stringify(cuerpo)` y `Content-Type: application/json`; `status === 204` resuelve
  `undefined` antes de interpretar el cuerpo; tiempo límite, encadenado del `signal`,
  traducción de errores y aviso del 401 en nombre del usuario **del pedido** sin cambios. `get`,
  `post`, `put`, `patch` y `delete` solo llaman a `pedir`. `tests/api/*.test.ts` (los de la 002
  incluidos) en verde; `mobile/src/api/usuarios.ts` sin cambios (SC-006).
- [ ] T031 [US3] Test de FR-020 en `mobile/tests/pantallas/errores-en-uso.test.tsx`: ruta extra
  `"(tabs)/prueba-escritura"` (vía `rutasExtra`) con un `useMutation` que hace
  `cliente.post("/prueba-escritura", { x: 1 })` al montar; `porRuta` con `"/prueba-escritura":
  ["rechazar", { status: 201, json: {} }]` y `/usuarios/actual` respondiendo bien. Con usuario
  recordado: la mutation cae con servidor no disponible, aparece la franja, se avanzan los
  temporizadores hasta que la secuencia se recupera y la franja desaparece, y
  `falso.pedidosA("/prueba-escritura")` tiene **un** pedido `POST` con `cuerpo`
  `'{"x":1}'`. Pasa sin tocar código (lo garantizan `mutations.retry: false` y la secuencia);
  para comprobar que el test sirve, cambiar temporalmente `retry` de mutations a `1` en
  `mobile/src/consultas/query-client.ts`, verlo fallar y deshacer. Segundo caso, en el mismo
  archivo (US3 escenario 5): la misma ruta de prueba con `"/prueba-escritura"` respondiendo 401
  `{ error: { codigo: "USUARIO_NO_IDENTIFICADO", mensaje: "..." } }` en nombre del usuario
  recordado → la app olvida al usuario igual que con una lectura (se muestra el selector a
  pantalla completa y `CLAVE_RECORDADO` ya no está en AsyncStorage).

**Checkpoint**: US3 completa; quickstart §4 en verde.

---

## Phase 6: Polish & documentación

**Purpose**: guía para agentes, skill y backlog al día (FR-021, FR-022) y validación final.

- [ ] T032 [P] Actualizar `AGENTS.md`, sección "Mapa" de `mobile/`: `app/` como re-exports de
  una línea; base (`api/`, `consultas/` con `cliente-api`, `conexion/` como contrato,
  `componentes/` con `tema`, `Boton`, `SegunConsulta`); `features/<dominio>/` con `index.ts`
  público (`usuarios`, `sesion`); conectores (`composicion.ts` sin contexto,
  `navegacion/{RaizDeLaApp,LayoutRaiz,LayoutPestanas}`); las cuatro reglas de dependencia y que
  las verifica el lint (`import-x`); rutas tipadas y que `typecheck` genera los tipos antes de
  `tsc`; cómo agregar un endpoint de escritura (`cliente.post<T>(ruta, cuerpo)`) y que las
  escrituras no se reintentan solas; tests en `tests/features/<dominio>/`. Quitar las menciones
  a `composicion.tsx`, `DependenciasProvider`/`useDependencias` y `src/sesion/`.
- [ ] T033 [P] Actualizar `.claude/skills/nueva-pantalla/SKILL.md`: la pantalla va en
  `src/features/<dominio>/pantallas/` y `app/<ruta>.tsx` es `export { X as default } from
  ".../src/features/<dominio>";`; pestañas nuevas en `src/navegacion/LayoutPestanas.tsx` y
  pantallas apiladas en el `Stack.Protected` de `src/navegacion/LayoutRaiz.tsx`; los cuatro
  estados con `SegunConsulta`; botones con `Boton` y estilos con `tema`; textos derivados en
  `features/<dominio>/formato.ts` con tests; endpoint de escritura con `post/put/patch/delete`
  (borrar "Hoy `ClienteApi` solo tiene `get`"); rutas tipadas (`Href`), y que al agregar la
  primera ruta dinámica se suma a `mobile/tests/tipos/rutas-tipadas.ts` un caso con
  `@ts-expect-error` que navega sin el parámetro obligatorio (FR-009); hooks de consulta en la
  feature, no en `src/consultas/`; reglas de import entre features.
- [X] T034 [P] Actualizar `docs/backlog.md` (FR-022): nueva fila **003 Refactor mobile**
  (organización por feature, piezas base de pantalla, cliente HTTP con todos los métodos; P0;
  depende de 002; estado `en curso`); renumerar las features 003–011 a 004–012 en la tabla, en
  sus columnas "Depende de", en el grafo mermaid (nodos y aristas, con 003 entre 002 y las
  features de dominio), en "Oportunidades de paralelismo" y en "Decisiones abiertas"; agregar
  la sección **Deuda técnica** con "store externo para la sesión: hoy el estado de la sesión
  vive en el reducer de `SesionProvider` y en el controlador; unificarlo en un store externo
  (`useSyncExternalStore`) sin cambiar `useSesion`, `useClienteApi` ni `useConexion`. No
  bloquea ninguna feature".
- [ ] T035 Validar quickstart §1–§4 desde la raíz: `npm test && npm run lint && npm run
  typecheck && npm run format:check` en verde (y `npm run format` si Prettier marca algo);
  repetir la tabla completa de quickstart §2, ahora con `../../usuarios/formato` tal como está
  escrita; comparar el número de tests
  con T001 en **Notas**.
- [ ] T036 Validación en el celular (quickstart §5, SC-002; la hace la persona): con
  `npm start` y `npm run mobile`, repetir los recorridos del quickstart de la 002 (primer
  arranque, usuario recordado, cambio de usuario, servidor no disponible con franja y reintento,
  usuario inexistente con aviso) y confirmar que se ve igual. Después de `expo start`,
  `git status` limpio (sin cambios en `mobile/tsconfig.json` ni `expo-env.d.ts` versionado).
- [ ] T037 Abrir el PR de `feature/003-refactor-mobile` a `development` con el CI en verde y
  pasar la 003 a `en PR` en `docs/backlog.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de T001 (red de seguridad). Bloquea US1 y US2.
- **US1 (Phase 3)**: depende de Foundational y de T002 (dependencias de lint).
- **US2 (Phase 4)**: depende de US1 (las piezas y migraciones usan las rutas nuevas:
  `features/usuarios`, `features/sesion/pantallas`, `componentes/index.ts`).
- **US3 (Phase 5)**: independiente de US1 y US2 en `src/api/` (T028–T030 pueden hacerse
  apenas termina Setup, como sugiere el orden del plan). T031 usa `useClienteApi` de
  `consultas/cliente-api` (T005) y conviene hacerlo con US1 terminada para no volver a tocar
  sus imports.
- **Polish (Phase 6)**: T032–T033 después de US1–US3 (describen el resultado final). T034
  (backlog) no depende de nada y se hace **al empezar la implementación**, junto con Setup, así
  el backlog muestra la 003 como `en curso` mientras dura la rama; queda en esta fase solo por
  afinidad con los otros documentos. T035–T037 al final, en ese orden.

### Dentro de cada historia

- Test + stub en el mismo turno → ver fallar → implementar → suite en verde.
- US1: lint (T006–T007) y rutas tipadas (T008–T009) **antes** de mover, para que cada
  movimiento ya quede vigilado; movimientos en orden T010 → T011 → T012 → T013 → T014 → T015
  (T010 corta la dependencia `sesion → composicion` antes de mover, así `no-cycle` queda en
  verde en cada paso);
  T016–T017 cuando `app/` ya son re-exports y las features existen.
- US2: formato (T019–T020), tema (T021), `Boton` (T022–T024) y `SegunConsulta` (T025–T027).
  `Boton` usa `tema`, así que T023 va después de T021.

### Parallel Opportunities

- T019, T022 y T025 (tests + stubs de formato, `Boton` y `SegunConsulta`) tocan archivos
  distintos.
- T028 (helper) en paralelo con cualquier tarea de US1/US2.
- T032, T033 y T034 (tres documentos distintos).
- Los movimientos de US1 **no** son paralelizables: tocan los mismos imports.

---

## Parallel Example: User Story 2

```bash
# Tests + stubs de las tres piezas (archivos distintos):
Task: "T019 Tests de formato en mobile/tests/features/usuarios/formato.test.ts + stub formato.ts"
Task: "T022 Tests de Boton en mobile/tests/componentes/boton.test.tsx + stub Boton.tsx"
Task: "T025 Tests de SegunConsulta en mobile/tests/componentes/segun-consulta.test.tsx + stub"
```

## Parallel Example: User Story 3

```bash
# El helper puede adelantarse mientras se hace US1:
Task: "T028 cuerpo en PedidoRegistrado de mobile/tests/helpers/fetch-falso.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (red de seguridad + dependencias) y Phase 2 (contratos de base).
2. Phase 3 (US1): lint, rutas tipadas y movimientos.
3. **STOP and VALIDATE**: suite completa, quickstart §2 y un recorrido rápido en el celular.
   Con esto la 004 ya puede empezar a escribir su feature en el lugar correcto.

### Incremental Delivery

1. Setup + Foundational → contratos de base listos.
2. US1 → estructura por feature vigilada por el lint y el typecheck.
3. US2 → piezas base y selector migrado.
4. US3 → escrituras listas para la 004 (o antes, en paralelo, si conviene).
5. Documentación, validación en el celular y PR.

---

## Notes

- **Base de tests (T001)**: en `5f296e9`, `mobile/` tiene 19 suites y 128 tests en verde
  (backend: 16 archivos, 95 tests); lint, typecheck y format:check en verde.
- [P] = archivos distintos, sin dependencias pendientes.
- Cada tarea deja `test`, `lint`, `typecheck` y `format:check` en verde (plan, "Orden de
  implementación").
- Si un test de la 002 necesita cambiar algo más que su ubicación o sus imports, se frena: es
  señal de un cambio de comportamiento (FR-003).
