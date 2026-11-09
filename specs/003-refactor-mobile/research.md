# Research: Refactor de la arquitectura mobile (003)

Decisiones técnicas del plan. Todo lo de la 002 (`specs/002-base-mobile/research.md`, R1–R12)
sigue vigente salvo lo que se dice acá. No quedan "NEEDS CLARIFICATION".

## R1. Organización: base compartida + `src/features/<dominio>/`

- **Decision**: `mobile/src/` queda dividido en:
  - **Base**: `api/` (HTTP, sin React), `consultas/` (`QueryClient`, claves, contexto del
    cliente), `conexion/` (contrato de conexión), `componentes/` (genéricos y tema).
  - **Features**: `features/usuarios/` y `features/sesion/` (clarificación 2), cada una con un
    `index.ts` como **único punto de entrada público**. Adentro: `pantallas/`, `componentes/`
    y, en la raíz de la feature, hooks de consulta, formato y lógica.
  - **Conectores**: `composicion.ts` (arma las dependencias) y `navegacion/` (layouts y
    guards). Son los únicos módulos de fuera de `features/` que pueden importar features.
  - `app/` (Expo Router): solo re-exports (R3).
- **Reglas de dependencia** (FR-010):
  1. Ningún ciclo entre módulos.
  2. La base no importa `features/` (salvo `composicion.ts` y `navegacion/`).
  3. Desde afuera de una feature (otra feature, `app/`, `navegacion/`, `composicion.ts`) solo se
     importa su `index.ts`. Adentro, los archivos se importan entre sí por ruta relativa, nunca
     por el `index.ts` propio (cerraría un ciclo).
  4. Dentro de la base, un módulo importa a otro por su archivo o por el `index.ts` de otra
     carpeta, nunca por el `index.ts` de su propia carpeta.
- **Rationale**: es la organización del cliente de referencia de la cátedra
  (`ddso-utn/ejercicio-megasuper-2026`, rama `clase11-integracion-front-back`) adaptada a Expo
  Router. Con 10–15 pantallas por venir, agrupar por dominio mantiene juntos los archivos que
  cambian juntos. Las funciones de endpoint siguen en `src/api/` (clarificación 1, principio VII).
- **Alternatives considered**: mantener las carpetas por capa (crecen todas a la vez y no
  impiden ciclos); alias de rutas `@/` (más legible, pero suma configuración en Metro, Jest,
  TypeScript y el resolver del lint sin que la spec lo pida: YAGNI).

## R2. Cortar los ciclos actuales

Hoy hay dos ciclos entre carpetas (no entre archivos): `sesion/SesionProvider` →
`conexion/secuencia-reintentos` y `conexion/useConexion` → `sesion/SesionProvider`; y
`composicion` → `sesion/usuario-recordado` con `sesion/SesionProvider` → `composicion`. Al
pasar a features con `index.ts`, aparecerían ciclos reales entre archivos (por ejemplo,
`composicion → features/sesion/index → SesionProvider → composicion`). Se cortan así:

- **Conexión** (clarificación 3): la base define `EstadoConexion`, su contexto,
  `ConexionProvider` y `useConexion()` en `src/conexion/`. `SesionProvider` calcula el valor y
  lo provee. La franja y `SegunConsulta` solo dependen de `useConexion()`.
- **Cliente HTTP en React**: `useUsuarios` (feature `usuarios`) necesita `useClienteApi()`, y la
  feature `sesion` usa a `usuarios` (selector y Perfil). Si `useClienteApi` quedara en `sesion`,
  `usuarios ↔ sesion` sería un ciclo. Mismo patrón que la conexión: la base define
  `ClienteApiProvider` y `useClienteApi()` en `src/consultas/cliente-api.tsx`; `SesionProvider`
  provee el cliente que crea su controlador. La firma de `useClienteApi()` no cambia (FR-002).
  Es la misma decisión de la clarificación 3 aplicada a la otra pieza que hoy causa el ciclo.
- **Dependencias por props, sin contexto**: `useDependencias()` solo lo usa `SesionProvider`.
  Se elimina el contexto: `LayoutRaiz` recibe `dependencias` (como hoy) y se las pasa a
  `<SesionProvider dependencias={...}>`. La feature `sesion` declara qué necesita
  (`DependenciasSesion`: `urlBase`, `usuarioRecordado`, `queryClient`, `crearCliente`,
  `registrarOyenteDeErrores`). `composicion.ts` arma un `Dependencias` que la cumple. Así
  ninguna feature importa `composicion`.
- **Secuencia de reintentos**: `SecuenciaDeReintentos` pasa a `features/sesion/`, porque solo la
  usa el controlador de la sesión. La base solo ve su resultado a través de `EstadoConexion`.
- **Rationale**: las dependencias apuntan siempre en el mismo sentido:
  `app/ → navegacion/ → features → base`, con `composicion` al costado. Es la inversión de
  dependencias que pide la constitución (III, en espíritu): las features dependen de contratos
  de la base, no al revés.
- **Alternatives considered**: mover `usuario-recordado` a la base (es lógica de la sesión);
  fusionar `usuarios` y `sesion` (contradice la clarificación 2); dejar `useDependencias` y
  mover `Dependencias` a la base (la interfaz nombra tipos de la feature `sesion`).

## R3. `app/` como re-exports

- **Decision**: cada archivo de `app/` es una sola sentencia:
  `export { SeleccionarUsuario as default } from "../src/features/sesion";`. La lógica que hoy
  está en `app/` se mueve:
  - `app/_layout.tsx` (el `useState(crearDependenciasDeProduccion)`) →
    `src/navegacion/RaizDeLaApp.tsx`;
  - `app/(tabs)/_layout.tsx` (pestañas e íconos) → `src/navegacion/LayoutPestanas.tsx`;
  - `app/seleccionar-usuario.tsx` y `app/(tabs)/perfil.tsx` →
    `features/sesion/pantallas/`;
  - `app/cargando.tsx` re-exporta `Cargando` de `src/componentes`.
  - Las tres secciones pendientes siguen renderizando `<SeccionPendiente nombre="…" />` (FR-006
    lo permite; no se crean features vacías).
- Un bloque de lint para `mobile/app/**` prohíbe importar `react`, `react-native`,
  `@tanstack/react-query`, `@expo/vector-icons` y `expo-router`: así un archivo de navegación no
  puede volver a tener estado, estilos ni componentes propios (SC-003).
- **Rationale**: `renderConDependencias` ya renderiza `app/` con `renderRouter` y reemplaza
  `_layout` por `LayoutRaiz`; mover la lógica a `src/` no cambia lo que ven los tests.
- **Alternatives considered**: `export { default } from` con export por defecto en la pantalla
  (las pantallas exportan con nombre, como todo `src/`).

## R4. Lint de dependencias: `eslint-plugin-import-x`

- **Decision**: dos dependencias de desarrollo en la raíz: `eslint-plugin-import-x` (4.x, peer
  `eslint ^10`) y `eslint-import-resolver-typescript`, configuradas en `eslint.config.js`
  solo para `mobile/**/*.{ts,tsx}`:
  - `import-x/no-cycle` (`ignoreExternal: true`) → regla 1 de R1;
  - `import-x/no-restricted-paths` con zonas **calculadas** al cargar el config
    (`fs.readdirSync` de `mobile/src` y `mobile/src/features`). Así una carpeta nueva de la base
    o una feature nueva quedan cubiertas sin tocar el config:
    - una zona por carpeta o archivo de la base (todo `mobile/src` salvo `features/`,
      `navegacion/` y `composicion.ts`) con `from: mobile/src/features` → regla 2;
    - una zona por feature `F`: `target: features/F`, `from: features`, `except: ["./F",
      "./G/index.ts" para cada G ≠ F]` → regla 3 entre features;
    - una zona para `mobile/app`, `mobile/src/navegacion` y `mobile/src/composicion.ts` con
      `from: features` y `except` con cada `index.ts` → regla 3 desde los conectores.
  - Los tests (`mobile/tests/**`) quedan fuera de las zonas: prueban archivos internos (el
    reducer, el controlador).
- **Verificación automática**: `mobile/tests/arquitectura/reglas-de-dependencia.test.ts` corre
  ESLint (proceso hijo, `--stdin --stdin-filename`, formato JSON) sobre código de prueba que
  rompe cada regla y espera el error de la regla correspondiente. Cubre un ciclo (por ejemplo,
  `src/api/errores.ts` importando `./cliente`), un import de una feature desde la base y uno
  interno entre features. También verifica que el código real no da errores. Sin este test, un
  resolver mal configurado haría que `no-cycle` pase sin ver nada.
- **Rationale**: "el lint falla" (FR-008, FR-010) se cumple dentro de `npm run lint` y del hook
  `Stop`, con mensajes que nombran la regla y los módulos. `no-restricted-imports` del core no
  sirve: trabaja sobre el texto del import, no sobre la ruta resuelta. Con imports relativos de
  profundidad variable no puede distinguir "otra feature" de "la propia".
- **Alternatives considered**: `dependency-cruiser` o `madge` (otra herramienta y otro comando
  fuera de ESLint); `eslint-plugin-boundaries` (más configuración para tres reglas);
  `eslint-plugin-import` original (más lento y con soporte de flat config/ESLint 10 atrasado).

## R5. Rutas tipadas de Expo Router, también en el CI

- **Decision**: activar `experiments.typedRoutes` en `mobile/app.json`. En SDK 58, Expo CLI
  genera `.expo/types/router.d.ts` **solo** al levantar el servidor de desarrollo
  (`MetroBundlerDevServer`); no hay un comando para el CI. Se agrega
  `mobile/scripts/generar-tipos-rutas.js` (CommonJS, ~15 líneas). Hace lo mismo que el CLI:
  define `EXPO_ROUTER_APP_ROOT=<mobile>/app`, crea `.expo/types/` y llama a
  `regenerateDeclarations` de `@expo/router-server/build/typed-routes`, resuelto desde
  `@expo/cli`. Falla con un mensaje claro si el módulo no está o su `version` es < 52. Se
  probó en este repo y genera `router.d.ts` con `/cargando`, `/seleccionar-usuario`, las
  pestañas, etc.
  - `mobile/package.json`: `"typecheck": "node scripts/generar-tipos-rutas.js && tsc --noEmit"`.
    El CI, el hook `Stop` y `npm run typecheck` de la raíz quedan cubiertos sin cambios en el
    workflow.
  - `mobile/tsconfig.json`: `include` suma `.expo/types/**/*.ts` y `expo-env.d.ts` (lo mismo
    que agrega el CLI, así `expo start` no reescribe el archivo). `exclude` deja de excluir
    `.expo`. `.expo/` sigue ignorado por git, ESLint y Prettier.
  - Guarda permanente: `mobile/tests/tipos/rutas-tipadas.ts` (lo compila `tsc`, Jest no lo
    corre) declara una `Href` válida y otra mal escrita (`"/seleccionar-usuarios"`) con
    `// @ts-expect-error` justificado. Si las rutas tipadas se desactivan o los tipos no se
    generan, la directiva queda sin uso y el typecheck falla. Los parámetros obligatorios se
    verifican de la misma forma cuando haya rutas dinámicas (004 en adelante).
- **Rationale**: FR-009 pide que falle "también en el CI". El dev server no puede ser parte del
  CI. Versionar el `.d.ts` generado se desactualiza en cuanto cambia una ruta.
- **Riesgo**: usa un módulo interno de Expo. Si una actualización del SDK lo mueve, el script
  falla de forma explícita (no en silencio) y se ajusta la ruta. Queda registrado en Complexity
  Tracking.
- **Alternatives considered**: levantar `expo start` en el CI y esperar los tipos (lento y
  frágil); versionar `router.d.ts`; no tipar rutas (contradice FR-009).

## R6. Tema único

- **Decision**: `src/componentes/tema.ts` exporta `tema` (`as const`) con `colores` (los 8 de
  hoy, mismos nombres y valores), `espacio`, `texto` (tamaños), `peso`, `radio` y
  `opacidadApagado`. Contiene **exactamente** los valores que usan hoy los componentes, ver
  [data-model.md](./data-model.md#tema), para que nada cambie a la vista (FR-001). Se elimina
  `estilos.ts`.
- **Rationale**: FR-011. Los `StyleSheet.create` de cada componente toman los valores de
  `tema.*`, sin números sueltos (salvo `StyleSheet.hairlineWidth` y los insets).
- **Alternatives considered**: hook `useTema()` con contexto (no hay modo oscuro: YAGNI);
  librería de theming (principio VII).

## R7. `Boton` base

- **Decision**: `src/componentes/Boton.tsx`, un `Pressable` con `accessibilityRole="button"`.
  Props: `texto`, `alPresionar`, `variante` (`"primario"` | `"aviso"` | `"texto"`),
  `deshabilitado`, `enCurso` + `textoEnCurso`, `accessibilityLabel`, `hitSlop` y `style` (solo
  para ubicarlo, por ejemplo un margen). Mientras está deshabilitado o en curso, `disabled` no
  deja tocarlo y `accessibilityState = { disabled: true, busy: enCurso }`. Se ve con la opacidad
  apagada al presionarlo, deshabilitado o en curso. Variantes:
  - `primario`: "Reintentar" de `MensajeError` y "Cambiar usuario" de Perfil (mismo estilo
    duplicado hoy);
  - `aviso`: "Reintentar" de la franja (con borde, sobre el fondo de aviso);
  - `texto`: "Cerrar" del encabezado del modal.
- La fila del selector no es un botón con estilo de botón: sigue como `Pressable` propio de
  `FilaUsuario`.
- **Rationale**: FR-012 y SC-005. Agregar `busy` es lo que pide FR-012 ("en curso" anunciado) y
  no cambia lo que verifican los tests actuales (`disabled`).
- **Alternatives considered**: variantes futuras (secundario, peligro) cuando una feature las
  necesite (YAGNI).

## R8. `SegunConsulta`: los cuatro estados en una pieza

- **Decision**: `src/componentes/SegunConsulta.tsx`, genérico en `T`:
  `<SegunConsulta consulta={useUsuarios()} mensajeVacio="No hay usuarios disponibles.">{(datos)
  => …}</SegunConsulta>`. Recibe solo la parte de `UseQueryResult` que usa (`isPending`,
  `isError`, `error`, `data`, `isFetching`, `refetch`), así los tests pueden pasarle objetos
  literales. Reglas, en orden:
  1. `isPending` → `<Cargando />`.
  2. `isError` y `error instanceof ServidorNoDisponibleError` → `MensajeError` "Servidor no
     disponible", "No se pudo conectar con {conexion.urlBase}." y "Reintentar" →
     `conexion.reintentarAhora()`, en curso según `conexion.enCurso`.
  3. `isError` (otro) → `MensajeError` con `error.mensaje` si es `ErrorDeApi`, si no "Ocurrió un
     error inesperado."; "Reintentar" → `consulta.refetch()`, en curso según
     `consulta.isFetching`.
  4. `esVacio(datos)` → `<ListaVacia mensaje={mensajeVacio} />`. Por defecto, `esVacio` es
     verdadero para `undefined`, `null` y arreglos vacíos, así un 204 en una lectura se trata
     como dato ausente (edge case de la spec).
  5. Si no, `children(datos)`.
- Una consulta cancelada vuelve a su estado anterior en TanStack Query v5 (no queda en error),
  así que no se muestra error (edge case), igual que hoy.
- **Rationale**: es el mismo bloque `if/else` del selector actual, extraído sin cambios de
  textos (FR-013, FR-014, SC-005).
- **Alternatives considered**: un hook que devuelva el nodo a mostrar (la render prop deja el
  caso de datos tipado y legible).

## R9. Formato de vista puro

- **Decision**: `features/usuarios/formato.ts` con `nombreCompleto({ nombre, apellido })` y
  `textoEventosOrganizados(cantidad)` (la `textoEventos` de hoy, con su nombre del dominio).
  Lo usan `FilaUsuario` (texto y `accessibilityLabel`) y Perfil. Tests propios en
  `tests/features/usuarios/formato.test.ts` (0, 1 y varios eventos).
- **Rationale**: FR-015; constitución II (tests de los formateos de mobile).

## R10. Cliente HTTP con todos los métodos

- **Decision**: `crearClienteApi` expone
  `pedir<T>(metodo, ruta, { cuerpo?, signal?, usuarioId? })` y los atajos `get(ruta, opc)`,
  `post(ruta, cuerpo?, opc)`, `put(ruta, cuerpo?, opc)`, `patch(ruta, cuerpo?, opc)` y
  `delete(ruta, opc)`, todos sobre `pedir` (contrato en
  [contracts/cliente-api.md](./contracts/cliente-api.md)).
  - Con `cuerpo !== undefined`: `body: JSON.stringify(cuerpo)` y
    `Content-Type: application/json`. Sin cuerpo, no se manda ese encabezado (FR-017).
  - `status === 204` → resuelve `undefined` sin interpretar el cuerpo (FR-018). Cualquier otra
    respuesta exitosa sin JSON sigue siendo `RESPUESTA_INESPERADA` (edge case).
  - Tiempo límite, encadenado del `signal`, traducción a `ErrorDeApi` /
    `ServidorNoDisponibleError` y aviso del 401 `USUARIO_NO_IDENTIFICADO` en nombre del
    usuario **del pedido**: sin cambios, ahora para todo método (FR-019).
- **Sin reintentos de escrituras (FR-020)**: ya lo garantizan `mutations.retry: false` y la
  secuencia, que solo hace `refetchQueries` de las queries activas en error. Se agrega un test
  de pantalla con una ruta de prueba que hace una mutation `POST`: cae con servidor no
  disponible, la secuencia se recupera y se verifica que el `POST` salió una sola vez.
- **Helper de tests**: `crearFetchFalso` registra también `cuerpo` (el `init.body`) en cada
  `PedidoRegistrado`. Es un agregado y no cambia lo que verifican los tests existentes (FR-003).
- **Rationale**: la 004 (Crear evento) es la primera escritura. Así, una función de endpoint
  de escritura queda en una línea, por ejemplo `cliente.post<EventoVista>("/eventos", datos)`
  (SC-006).
- **Alternatives considered**: `post(ruta, { cuerpo })` (más ruido en cada endpoint); axios
  (dependencia para lo que ya resuelve `fetch`, R4 de la 002).

## R11. Ubicación de los tests

- **Decision**: los tests reflejan la estructura nueva sin cambiar lo que verifican (FR-003):
  - `tests/sesion/*` y `tests/conexion/secuencia-reintentos.test.ts` → `tests/features/sesion/`;
  - nuevo `tests/features/usuarios/formato.test.ts`;
  - `tests/api/`, `tests/componentes/`, `tests/consultas/` y `tests/pantallas/` se quedan donde
    están, con los imports actualizados;
  - nuevos `tests/componentes/boton.test.tsx`, `tests/componentes/segun-consulta.test.tsx`,
    `tests/arquitectura/reglas-de-dependencia.test.ts` y `tests/tipos/rutas-tipadas.ts`.
  Los movimientos se hacen con `git mv` para conservar la historia.
- **Rationale**: los tests de `pantallas/` recorren la app entera (`renderConDependencias`) y son
  la red de seguridad del refactor: se corren antes y después de cada movimiento.
