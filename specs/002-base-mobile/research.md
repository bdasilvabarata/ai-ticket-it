# Research: Base mobile (002)

Decisiones técnicas que resuelven el **cómo** de la spec. El stack lo fija la constitución
(principio VII y "Stack y Restricciones Técnicas"); acá se eligen versiones, librerías
auxiliares y patrones. Las versiones exactas se fijan en la primera tarea (R1), porque
dependen del Expo Go instalado en el celular de la persona que hace el TP.

## R1. Versión de Expo SDK y de TypeScript

- **Decision**: el SDK de Expo es **el que soporte el Expo Go de Android instalado en el
  celular** de la persona que hace el TP. Lo verifica antes de la primera tarea (Expo Go →
  Ajustes → "Supported SDK"). **SDK fijado: 58** (verificado el 2026-11-08 en el celular:
  Expo Go para Android, versión del cliente 58.0.5, T001). La investigación había encontrado el
  57 como el más reciente, pero manda lo que dice el celular. El proyecto se crea con `create-expo-app` en esa versión (R2).
  Toda dependencia nativa o ligada al SDK se agrega con `npx expo install <paquete>`, que
  elige la versión compatible. TypeScript del paquete `mobile` es el que fija
  `npx expo install typescript` para ese SDK, como `devDependency` de `mobile/`. npm
  workspaces lo instala anidado en `mobile/node_modules`, así que `npm run typecheck -w mobile`
  usa ese `tsc` y la raíz sigue con `~6.0` (backend, shared y typescript-eslint, 001 R1).
  `npx expo install --check` debe quedar sin advertencias al cerrar la feature, y el README
  indica el SDK (FR-003).
- **Rationale**: Expo Go de Android solo abre proyectos de **un** SDK, el último que
  soporta; con otro SDK la app no abre (FR-002). `expo install` evita combinaciones de
  versiones que compilan pero fallan en el celular.
- **Alternatives considered**: el último SDK publicado sin mirar Expo Go (puede no estar
  todavía en la tienda; `eas go` o development builds requieren compilar, fuera de FR-002);
  usar el TypeScript de la raíz en `mobile` (puede no ser el que soporta ese SDK; la
  coexistencia de dos versiones la resuelve npm).

## R2. Paquete `mobile/` en el monorepo

- **Decision**: workspace `mobile` (`@ai-ticket-it/mobile`, `private`) agregado a
  `workspaces` de la raíz. Se genera con la plantilla mínima de TypeScript de
  `create-expo-app` para el SDK de R1 y se le suma Expo Router a mano (`npx expo install
  expo-router react-native-safe-area-context react-native-screens expo-linking
  expo-constants expo-status-bar`). `main: "expo-router/entry"` y plugin `expo-router` en
  `app.json`, con `scheme: "ai-ticket-it"`. **Sin** `experiments.typedRoutes` (R11). Depende de
  `"@ai-ticket-it/shared": "*"`. Sin `metro.config.js` propio: desde el SDK 52 la
  configuración por defecto de Metro detecta los workspaces. Si en la verificación no
  resuelve `@ai-ticket-it/shared`, se agrega el `metro.config.js` mínimo de la guía de
  monorepos de Expo. Script `"mobile": "npm run start -w mobile"` en la raíz y `start: "expo start"` en
  `mobile/`. El paquete **no** es `"type": "module"`: las herramientas de Expo y Jest esperan
  CommonJS para sus archivos de configuración.
- **Rationale**: un solo `npm install` instala todo (FR-001) y `npm run mobile` arranca desde
  la raíz (FR-002). `shared` se consume como fuente TypeScript igual que en el backend
  (001 R2).
- **Alternatives considered**: plantilla `default` de `create-expo-app` (trae pantallas,
  temas y assets de ejemplo que habría que borrar); `metro.config.js` con `watchFolders`
  manual (innecesario en SDKs recientes).

## R3. Navegación y guard sin usuario

- **Decision**: Expo Router con esta estructura:
  - `app/_layout.tsx`: solo el export por defecto. Arma las dependencias reales (R10) y
    renderiza `LayoutRaiz` de `src/navegacion/LayoutRaiz.tsx`. Las rutas de `app/` no exportan
    nada más que su componente, y los tests importan `LayoutRaiz` desde `src/`, con dependencias
    falsas, sin depender de un archivo de ruta;
  - `src/navegacion/LayoutRaiz.tsx`: recibe las dependencias y monta los providers
    (`SafeAreaProvider`, `DependenciasProvider`, `QueryClientProvider`, `SesionProvider`),
    la franja de servidor no disponible (R8) y un `Stack` con tres grupos de
    `Stack.Protected` según la fase de la sesión (R5):
    - `iniciando` → solo `cargando` (indicador mientras se lee lo recordado y se valida,
      US2-6);
    - `sin-usuario` → solo `seleccionar-usuario` (pantalla completa, sin volver atrás);
    - `con-usuario` → `(tabs)` y `seleccionar-usuario` como **modal**.
    Al cambiar la fase, Expo Router redirige solo a la primera ruta permitida, así que
    ninguna pantalla navega "a mano" después de elegir u olvidar al usuario.
  - `app/(tabs)/_layout.tsx`: `Tabs` con Explorar (`index`), Mis compras, Mis eventos y
    Perfil, en ese orden, con ícono de `@expo/vector-icons` (Ionicons) **y** texto
    (`tabBarLabel`), abre en Explorar (FR-017).
  - `app/seleccionar-usuario.tsx`: el selector. Si se abrió como modal, al elegir o al
    salir hace `router.back()` (US3-4/5).
- **Rationale**: `Stack.Protected` (Expo Router ≥ SDK 53) declara el guard en un único lugar
  y evita la carrera de un `Redirect` que se dispara antes de montar el layout. La ruta
  `cargando` evita que el selector se monte (y pida la lista) mientras se valida al usuario
  recordado.
- **Alternatives considered**: `<Redirect>` dentro de `(tabs)/_layout.tsx` (válido; queda como
  plan B si el SDK de R1 no trae `Stack.Protected`); no montar el `Stack` mientras se
  inicia (Expo Router exige que el layout raíz monte un navegador); `expo-splash-screen` como
  indicador (no es un indicador de carga visible si la validación tarda hasta 8 s).

## R4. Cliente HTTP (`mobile/src/api/`)

- **Decision**: `crearClienteApi({ fetch, urlBase, obtenerUsuarioId, alUsuarioNoIdentificado,
  tiempoLimiteMs = 8000 })` devuelve un `ClienteApi` con `get<T>(ruta, opciones?)`. Las
  funciones por recurso (`usuarios.ts`: `listarUsuarios`, `obtenerUsuarioActual`) reciben el
  cliente. Comportamiento (contrato en [contracts/cliente-api.md](./contracts/cliente-api.md)):
  - agrega `X-Usuario-Id` si hay usuario (el actual, o el `usuarioId` explícito de la
    opción, que usa la validación del recordado); sin usuario, no lo envía (FR-008);
  - **tiempo límite de 8 s** con un `AbortController` propio, encadenado a mano con el
    `signal` externo (el de TanStack Query) sin depender de `AbortSignal.any`. Que venza el
    tiempo → `ServidorNoDisponibleError` (`motivo: "tiempo-agotado"`); que aborte el
    `signal` externo → se relanza el `AbortError` tal cual (es una cancelación, no una falla);
  - `fetch` rechazado → `ServidorNoDisponibleError` (`motivo: "sin-conexion"`, con la `url`);
  - status ≥ 400 con cuerpo `ErrorApi` → `ErrorDeApi` (status, código, mensaje, detalles);
    sin ese formato (HTML de un proxy, JSON ajeno, cuerpo vacío) → `ErrorDeApi` con
    `codigo: "RESPUESTA_INESPERADA"` y "El servidor respondió de forma inesperada." (FR-009);
    lo mismo para un 2xx cuyo cuerpo no es JSON;
  - 401 `USUARIO_NO_IDENTIFICADO` en un pedido que llevaba usuario → llama a
    `alUsuarioNoIdentificado(usuarioIdDelPedido)` y además lanza el `ErrorDeApi` (FR-014).
  Ambas clases extienden `Error` y se distinguen con `instanceof`. Los tipos `ErrorApi`,
  `DetalleError` y `UsuarioVista` vienen de `@ai-ticket-it/shared` (FR-007).
- **Rationale**: inyectar `fetch`, la dirección y el usuario permite testear el cliente con
  un `fetch` falso, sin red ni servidor (FR-024/FR-025), y sin estado global (mismo criterio
  que el composition root del backend, 001 R16). 8 s cumple SC-003 (aviso en < 10 s). La
  sesión recibe el 401 con el id del pedido: si el usuario cambió mientras tanto, lo ignora.
- **Alternatives considered**: axios (dependencia de más para un `get` con timeout);
  `AbortSignal.timeout`/`AbortSignal.any` (soporte incierto en Hermes según el SDK); un
  módulo con la dirección y el usuario como variables globales (tests acoplados entre sí).

## R5. Sesión: React Context + reducer puro

- **Decision**: `SesionProvider` (React Context) expone `{ estado, elegirUsuario,
  olvidarUsuario, reintentar }`. El estado es una unión discriminada (ver
  [data-model.md](./data-model.md)): `iniciando` · `sin-usuario` (con `aviso` opcional) ·
  `con-usuario` (`usuarioId`, `usuario: UsuarioVista | null`, `servidor`). Las transiciones
  son un **reducer puro** (`src/sesion/estado-sesion.ts`) y la regla de FR-013 una
  **función pura** (`decidirValidacion(resultado)` en `src/sesion/validacion.ts`):
  - `UsuarioVista` → `confirmado`;
  - `ErrorDeApi` 401 `USUARIO_NO_IDENTIFICADO` → `olvidar`;
  - cualquier otro error (`ServidorNoDisponibleError`, otro `ErrorDeApi`, excepción
    inesperada) → `conservar-sin-servidor`.
  El provider solo conecta: lee lo recordado (R6), valida con `obtenerUsuarioActual`, aplica
  la decisión y maneja la secuencia de reintentos (R7). La misma regla se aplica en cada
  reintento automático o manual y ante el 401 durante el uso (FR-014). Si el usuario se
  conservó sin servidor, `usuario` es `null` hasta que una validación lo confirme: Perfil
  muestra el id y "No se pudieron cargar los datos del usuario" (solo se recuerda el id,
  spec "Usuario actual").
  `elegirUsuario(usuario)` es idempotente (ignora una segunda llamada mientras procesa la
  primera, edge case de doble toque), cancela y limpia la caché (R9), guarda el usuario
  recordado y pasa a `con-usuario` con la `UsuarioVista` de la lista. No revalida, porque el
  servidor acaba de devolverla.
- **Rationale**: el principio VII descarta librerías de estado global; un Context alcanza
  para un único valor de sesión. Separar reducer y regla en funciones puras permite cubrir el
  100 % de los casos de SC-005 sin renderizar nada.
- **Alternatives considered**: Zustand o Redux (prohibidos sin justificación y sin
  necesidad); guardar la sesión en TanStack Query (mezcla estado del cliente con estado del
  servidor y complica la regla "olvidar solo ante 401").

## R6. Usuario recordado (AsyncStorage)

- **Decision**: `@react-native-async-storage/async-storage` (con `npx expo install`), detrás
  de una interfaz mínima `Almacenamiento` (`getItem`, `setItem`, `removeItem`) que recibe
  `crearRepositorioUsuarioRecordado(almacenamiento)` → `{ leer(), guardar(id), olvidar() }`.
  Clave `ai-ticket-it/usuario-recordado`, valor JSON **versionado** `{ "version": 1,
  "usuarioId": "<id>" }`. `leer()` devuelve el id o `null`. Si el JSON está dañado, la
  versión es otra, `usuarioId` no es un string no vacío o falla la lectura, borra la clave y
  devuelve `null` (edge case "formato viejo o dañado"). La validación de forma es un type
  guard escrito a mano.
- **Rationale**: AsyncStorage viene incluido en Expo Go y sobrevive a cerrar la app
  (FR-012). Con la versión en el valor, un cambio futuro de formato se detecta en vez de
  romper. El id no es sensible (spec, "Assumptions"), así que no hace falta `expo-secure-store`.
- **Alternatives considered**: `expo-secure-store` (cifrado innecesario); guardar la
  `UsuarioVista` completa (la spec pide recordar solo el id y validar contra el servidor);
  zod en mobile (una dependencia para un objeto de dos campos).

## R7. Secuencia de reintentos (FR-021a)

- **Decision**: clase pura `SecuenciaDeReintentos` (`src/conexion/secuencia-reintentos.ts`)
  con `esperasMs = [1000, 2000, 4000, 8000, 16000, 32000]`, una función `intentar():
  Promise<boolean>` (`true` = éxito, se corta) y un temporizador inyectable (por defecto
  `setTimeout`/`clearTimeout`). Operaciones: `iniciar()` (programa el primer reintento
  automático tras 1 s), `reintentarAhora()` (cancela lo programado, intenta en el acto y,
  si falla, reinicia desde 1 s), `detener()`. Expone `{ enCurso, automaticosRestantes }` y
  avisa los cambios con un callback. Reglas: nunca hay dos intentos en curso (mientras uno
  corre, `reintentarAhora` se ignora y la UI muestra "Reintentando…" deshabilitado). Tras el
  sexto fallo automático no programa más. Un éxito cancela lo pendiente. `detener()` al
  desmontar el provider. Hay **una sola instancia para toda la app** (FR-021a, CHK002/CHK008).
  Vive en el `SesionProvider` y se expone con `useConexion()` (`{ servidor, enCurso,
  automaticosRestantes, reintentarAhora }`). La franja y el estado de error del selector la
  leen, pero no tienen secuencia propia:
  - **se inicia** cuando la validación del usuario termina en `conservar-sin-servidor` (sin
    conexión, tiempo agotado **o error inesperado**, como un 500) o cuando cualquier otro pedido
    falla con `ServidorNoDisponibleError` (este caso llega por `QueryCache`/`MutationCache`, R8).
    Si ya está corriendo, no se reinicia;
  - **`intentar`** depende de la fase:
    - en `con-usuario`, valida al usuario actual con la regla de FR-013. Es éxito **solo** si la
      decisión es `confirmado` u `olvidar`. `conservar-sin-servidor`, por cualquier causa, incluido
      un 500, es un intento fallido y la secuencia sigue (I1);
    - en `sin-usuario`, hace `refetch()` de la lista de usuarios. Es éxito si el servidor
      respondió (no `ServidorNoDisponibleError`);
  - **ante un éxito** se marca `servidor: "disponible"` y se hace
    `queryClient.refetchQueries({ type: "active", predicate: (q) => q.state.status === "error" })`.
    Eso recarga la lista del selector si estaba en error, y en las features siguientes, las
    pantallas que habían fallado;
  - **no se detiene** cuando el modal del selector oculta la franja. **Sí se detiene** al
    elegir un usuario (`elegido`): para elegirlo, la lista llegó del servidor, así que
    `servidor` pasa a `disponible` (A1). Si el olvido de un usuario lleva a `sin-usuario`, el
    próximo `intentar` ya es el de esa fase.
  - `olvidarUsuario` es **idempotente** (U2): si la fase ya no es `con-usuario` o el
    `usuarioId` cambió, no hace nada. Así, un 401 en un reintento, que llega a la vez por
    `alUsuarioNoIdentificado` y por `decidirValidacion → olvidar`, olvida una sola vez.

  Un `ErrorDeApi` en la lista del selector no inicia la secuencia: queda solo "Reintentar",
  que hace `refetch()` (CHK017).
- **Rationale**: separar la secuencia de React permite probarla con `jest.useFakeTimers()` y
  `jest.advanceTimersByTimeAsync` (SC-005: esperas, corte tras el sexto, reinicio, cancelación),
  y reutilizarla igual en franja y selector.
- **Alternatives considered**: `retry`/`retryDelay` de TanStack Query (el reintento sería
  invisible, sin "Reintentar" que reinicie y sin aplicar a la validación de la sesión, que
  no es una query); `setInterval` (no da esperas crecientes).

## R8. Franja de servidor no disponible

- **Decision**: `FranjaServidorNoDisponible` en `LayoutRaiz` (`src/navegacion/`), encima del `Stack`. Se
  muestra cuando la sesión está en `con-usuario` con `servidor: "no-disponible"` **y** la
  ruta actual **no** es `seleccionar-usuario` (`useSegments()`). La condición es por exclusión:
  así la franja cubre las pestañas y también las pantallas que las features 003+ apilen fuera
  de `(tabs)` (por ejemplo, `evento/[id]`), y solo se oculta en el modal del selector, que ya
  muestra su propio estado de error (FR-021). Texto: "Servidor no disponible", la
  dirección intentada (`urlBase`) y el botón "Reintentar" (texto, no solo color;
  `accessibilityRole="alert"` en el contenedor y `accessibilityLiveRegion="polite"`, más
  `AccessibilityInfo.announceForAccessibility("Servidor no disponible")` al aparecer, FR-022).
  El aviso de usuario inexistente del selector se anuncia de la misma forma. Ocupa el
  inset superior de la zona segura y provee a los hijos un `SafeAreaInsetsContext` con
  `top: 0`, para que los headers de las pestañas no dupliquen el espacio. Es no bloqueante:
  las pestañas siguen navegables. Además, el `QueryCache` y el `MutationCache` avisan a la
  sesión cuando cualquier query o mutation falla (`onError`), con esta regla (FR-014):
  - `ServidorNoDisponibleError` → muestra la franja e inicia la secuencia única de R7, si no
    estaba corriendo;
  - `ErrorDeApi` 401 `USUARIO_NO_IDENTIFICADO` → `olvidarUsuario()` con el aviso de usuario
    inexistente. Si el modal del selector estaba abierto, `Stack.Protected` saca el grupo
    `con-usuario` y queda el selector a pantalla completa, sin "Cerrar" (CHK020);
  - cualquier otro `ErrorDeApi` → no hace nada global; lo muestra la pantalla en su estado de
    error.

  Las mutations entran desde la 005 (comprar, cancelar), por eso el `MutationCache` ya queda
  conectado en la base. Al recuperarse, se vuelven a pedir las queries activas que estaban en
  error (R7).
- **Rationale**: un solo aviso para las cuatro secciones, como fijó la clarificación. Engancharlo al
  `QueryCache` deja resuelto el caso para las features siguientes sin que cada pantalla lo
  repita.
- **Alternatives considered**: franja dentro de `(tabs)/_layout.tsx` (el usuario la pidió en
  el layout raíz, y ahí también cubre pantallas de detalle que se apilen sobre las pestañas en
  features futuras); un `Toast` o un modal (bloqueante o efímero, contra la clarificación).

## R9. TanStack Query como estado del servidor

- **Decision**: `@tanstack/react-query` v5 para los datos remotos de las pantallas (en esta
  feature, solo la lista de usuarios del selector). `crearQueryClient()` con
  `retry: false` (queries y mutations; los reintentos son los de R7), `staleTime: 30_000` y
  `QueryCache({ onError })` y `MutationCache({ onError })` (R8). `focusManager.setEventListener` con `AppState` para
  revalidar al volver la app a primer plano; sin `onlineManager` (no hay modo sin conexión).
  **Claves**: `claves.ts` las arma en un solo lugar. Las que dependen del usuario llevan
  `usuarioId` en la segunda posición (`["usuario-actual", usuarioId]`, y en features
  siguientes `["compras", usuarioId, ...]`); las públicas no (`["usuarios"]`). **Cambio de
  usuario**: `elegirUsuario` y `olvidarUsuario` hacen `await queryClient.cancelQueries()` y
  luego `queryClient.clear()` antes de cambiar la sesión (FR-016, edge case de pedido en
  curso). La `queryFn` pasa el `signal` de Query al cliente (R4).
- **Rationale**: el principio VII pide justificar librerías de estado. Esta es **estado
  del servidor** (caché, deduplicación, cancelación, estados `isPending`/`isError` que mapean a
  cargando/error/vacío/éxito), no estado global de la app. Sin ella, cada feature 003–011
  reimplementaría caché, cancelación y la limpieza al cambiar de usuario con `useEffect`.
  Con `usuarioId` en la clave, una respuesta del usuario anterior no se lee nunca con la
  clave del nuevo, y `clear()` descarta lo demás. Registrado en Complexity Tracking.
- **Alternatives considered**: `useEffect` + `useState` por pantalla (repite los cuatro
  estados y la cancelación en cada pantalla, y es fácil olvidar el caso del usuario cambiado);
  SWR (similar, con menos control de cancelación y caché).

## R10. Dirección del servidor y composición

- **Decision**: función pura `resolverUrlBase({ urlEntorno, hostUri })` en
  `src/api/direccion.ts`:
  1. `urlEntorno` (`EXPO_PUBLIC_API_URL`) no vacía → esa, sin `/` final (prioridad, FR-005).
     Se espera la base **con** `/api` (`http://192.168.0.23:3000/api`), igual que la línea
     "Red:" que imprime el servidor al arrancar (001).
  2. `hostUri` (`Constants.expoConfig?.hostUri`, por ejemplo `192.168.0.23:8081`) → host sin
     puerto + `:3000/api` (FR-004).
  3. ninguno → `http://localhost:3000/api` (se ve en la franja y el README explica por qué
     falla en el celular).
  `process.env.EXPO_PUBLIC_API_URL` se lee **literalmente** en `src/composicion.tsx` (Expo
  solo reemplaza accesos estáticos) y se pasa a la función. `src/composicion.tsx` es el
  composition root de la app: `crearDependencias({ fetch, almacenamiento, urlEntorno,
  hostUri })` arma la dirección, el repositorio del usuario recordado, el `QueryClient` y una
  fábrica del cliente, y `DependenciasProvider` los expone por contexto. Los tests le pasan
  `fetch` falso y el mock de AsyncStorage. `mobile/.env.example` documenta la variable;
  `.env` ya está en `.gitignore`. **VirtualBox / varias interfaces**: si Expo anuncia la IP
  de un adaptador virtual (por ejemplo `192.168.56.1` de VirtualBox Host-Only), el QR y el
  `hostUri` apuntan ahí y el celular no llega. Se arranca con
  `REACT_NATIVE_PACKAGER_HOSTNAME=<IP Wi-Fi de la PC>`, que corrige ambos. El README lo
  documenta con el comando de PowerShell y el de bash, junto con el firewall de Windows (puertos
  8081 y 3000) y el aislamiento de clientes del Wi-Fi.
- **Rationale**: con `hostUri` la app sale andando sin configurar nada en la misma red
  (SC-001). Al ser una función pura, cada rama se testea sin Expo (FR-024).
- **Alternatives considered**: `Constants.expoConfig.extra` con `app.config.ts` (más
  configuración para lo mismo); exigir siempre `EXPO_PUBLIC_API_URL` (rompe SC-001).

## R11. Verificación de tipos en CI sin `expo start`

- **Decision**: `mobile/tsconfig.json` extiende `expo/tsconfig.base` con `strict: true`,
  `noEmit`, e incluye `**/*.ts` y `**/*.tsx`. **Sin `expo-env.d.ts`**: la decisión original
  era versionarlo, pero al validar T048 (2026-11-08) `expo start` del SDK 58 lo borró y lo
  sacó del `include` de `tsconfig.json`. `tsc --noEmit` pasa igual sin él, así que se acepta
  el cambio de Expo en vez de restaurarlo después de cada `npm start`. Sin `typedRoutes`, porque genera tipos en `.expo/` y obligaría a
  correr Expo antes del typecheck. Las rutas se escriben como strings literales. No hereda
  `tsconfig.base.json` de la raíz: la base de Expo fija `jsx`, `lib` y la resolución de
  React Native, y mezclar ambas cambia opciones que Metro espera.
- **Rationale**: el CI corre `npm run typecheck` en una máquina limpia (FR-023).
- **Alternatives considered**: correr `expo customize tsconfig.json` o `expo start` en el CI
  (lento y frágil); `typedRoutes` (rutas tipadas a cambio de acoplar el typecheck a Expo).

## R12. Tests (jest-expo + React Native Testing Library)

- **Decision**: `jest-expo` (preset, versión del SDK con `npx expo install jest-expo jest
  @types/jest -- --save-dev`) y `@testing-library/react-native` (matchers incluidos).
  `jest.config.js` con `preset: "jest-expo"`, `testMatch` en `mobile/tests/**` y **sin**
  `transformIgnorePatterns` propio. AsyncStorage con su **mock oficial**
  (`@react-native-async-storage/async-storage/jest/async-storage-mock`) en `jest.setup.ts`, con
  `AsyncStorage.clear()` y `jest.useRealTimers()` en `beforeEach` (FR-025). Las pantallas se
  prueban con `renderRouter` de `expo-router/testing-library` (rutas en memoria, guards
  reales) y un helper `renderConDependencias` que arma `crearDependencias` con un `fetch`
  falso por test y un `QueryClient` nuevo. La secuencia de reintentos y la franja se prueban
  con `jest.useFakeTimers()` + `await act(() => jest.advanceTimersByTimeAsync(ms))`. Un test
  `tests/shared.test.ts` importa un **valor** de `@ai-ticket-it/shared` (`EstadoCompra`).
  Si Jest no transformara el TypeScript del workspace (por resolver el symlink a `shared/src`,
  fuera de `node_modules`), el test fallaría al parsear, así que deja verificado que no hace
  falta `transformIgnorePatterns`. Los tests viven en `mobile/tests/` (no en `app/`, donde
  Expo Router los tomaría como rutas): `api/`, `sesion/`, `conexion/`, `componentes/`,
  `pantallas/`.
- **Rationale**: es el stack de la constitución. Con `fetch` falso inyectado no hace falta
  servidor ni librerías de mock de red. La suite debe correr en < 1 min (SC-006).
- **Alternatives considered**: MSW (otra dependencia para lo que ya resuelve la inyección);
  `@testing-library/jest-native` (deprecada, sus matchers están en RNTL); tests junto a cada
  archivo (en `app/` se interpretarían como rutas).
- **Hallazgos al implementar (US2–US3)**:
  - `jest.config.js` lleva `clearMocks: true`. El preset ya mockea APIs como
    `AccessibilityInfo.announceForAccessibility`, y `jest.spyOn` sobre un mock existente
    devuelve ese mismo mock, con las llamadas de los tests anteriores. Sin `clearMocks`, contar o
    verificar anuncios daba falsos resultados.
  - Las pestañas se buscan como `button` con la etiqueta "{nombre}, tab, {i} of {n}" (Jest
    corre con plataforma iOS). El contenedor `tablist` no es accesible por sí mismo, así que
    `*ByRole("tablist")` no lo encuentra (helper `tests/helpers/pestanas.ts`).
  - Una ruta de `(tabs)/` sin su `Tabs.Screen` en `(tabs)/_layout.tsx` no es una pestaña ni se
    puede navegar a ella: `router.navigate` no cambia la ruta, aunque el archivo exista. Por
    eso la ruta de prueba de `errores-en-uso.test.tsx` (T051) **reemplaza a `(tabs)/index`**
    en lugar de ser `(tabs)/prueba`: así es una ruta real de `(tabs)` que se ve apenas se
    confirma al usuario, sin tocar el layout que se está probando. Se había atribuido a que el
    layout declaraba solo Explorar. Con las cuatro pestañas (T061) se volvió a probar:
    `/perfil` navega, pero `(tabs)/prueba` sigue sin poder navegarse.

## R13. Lint, formato y CI

- **Decision**: el `eslint.config.js` de la raíz suma:
  - `typescript-eslint` recommended también para `**/*.tsx`;
  - `eslint-plugin-react-hooks` (config flat `recommended`) para `mobile/**/*.{ts,tsx}`
    (requiere una versión con peer `eslint ^10`; si no la hay, se fija la última compatible y
    se registra);
  - globals de `mobile/**`: `globals.browser` + `__DEV__`; `globals.node` para
    `mobile/*.config.js` y `jest.setup.ts`, y `globals.jest` en `mobile/tests/**`;
  - **`no-restricted-globals` de `fetch`** en `mobile/**` salvo `mobile/src/api/**` y
    `mobile/src/composicion.tsx`, con el mensaje "Todo pedido al servidor vive en src/api
    (principio VII)" (FR-006);
  - `ignores` de `mobile/.expo/`.
  `.prettierignore` suma `mobile/.expo/`. El CI no cambia de pasos: `npm ci` instala `mobile`
  por estar en `workspaces` y los cuatro comandos ya recorren todos los workspaces. Solo se
  renombra el paso "Tests (Vitest)" a "Tests (Vitest y Jest)". `mobile/package.json`: `test:
  "jest"` (en CI, `jest --ci`) y `typecheck: "tsc --noEmit"`.
- **Rationale**: un solo ESLint y un solo Prettier para todo el repo, como en 001 (R14/R22).
  La regla de `fetch` hace que el principio VII lo controle el lint y no solo la revisión.
- **Alternatives considered**: `eslint-config-expo` (trae su propia configuración y plugins
  que duplican la raíz); ESLint separado en `mobile/` (dos configuraciones que mantener).

## R14. Componentes base y skill `nueva-pantalla`

- **Decision**: componentes chicos en `src/componentes/` que reutilizan todas las pantallas:
  `Cargando`, `MensajeError` (mensaje + "Reintentar" opcional), `ListaVacia`, `SeccionPendiente`
  (nombre + "Todavía no disponible", FR-018), `FranjaServidorNoDisponible` y `FilaUsuario`.
  Estilos con `StyleSheet` y flex, sin anchos fijos (360 px, FR-022). La **última tarea** crea
  `.claude/skills/nueva-pantalla/SKILL.md` con las convenciones que quedaron: dónde va la
  ruta, función de `src/api/` + hook de query con clave de `claves.ts` (con `usuarioId` si
  depende del usuario), los cuatro estados con estos componentes, prohibición de `fetch`,
  accesibilidad, tests con `renderRouter`/`renderConDependencias`, y comandos de calidad.
- **Rationale**: el principio VII exige los cuatro estados en cada pantalla. Tenerlos como
  componentes y documentados en una skill (como `nuevo-endpoint` en 001) hace que 003–011
  los repitan igual.
- **Alternatives considered**: una librería de UI (contra el principio VII); dejar las
  convenciones solo en `AGENTS.md` (la skill se carga justo cuando se crea una pantalla).

## Desvíos registrados al implementar

- **R1 (TypeScript)**: el SDK 58 fija `typescript ~6.0.3`, la misma versión que la raíz, así
  que npm instala una sola copia (no queda anidada en `mobile/node_modules`). Con TypeScript 6
  `types` ya no incluye `@types/*` por defecto: `mobile/tsconfig.json` declara
  `"types": ["jest"]`.
- **R2 (React duplicado)**: `expo-router` pide `react-dom` como peer y npm izó `react-dom@19.3.1`
  con `react@19.3.1`, mientras el SDK fija `react@19.3.0` en `mobile/`. Dos copias de React
  rompen los hooks, así que la raíz fija `overrides: { react: "19.3.0", "react-dom": "19.3.0" }`.
- **R2 (plantilla)**: la plantilla `blank-typescript@sdk-58` trae además `AGENTS.md`,
  `.claude/settings.json` (plugin de Expo) y `LICENSE` propios; se borraron porque las
  instrucciones del repo viven en la raíz. También `assets/favicon.png` y la sección `web` de
  `app.json` (no hay cliente web).
- **R13**: `eslint-plugin-react-hooks@7.1.1` acepta `eslint ^10`; se usa
  `configs.flat.recommended`. En `jest.setup.ts` el mock de AsyncStorage se carga con
  `jest.requireActual` (la regla `no-require-imports` prohíbe `require`).
- **R3 (SafeAreaProvider)**: `ExpoRoot` de expo-router 58 ya monta un `SafeAreaProvider`, así que
  `LayoutRaiz` no monta otro. El resto del orden de providers no cambia.
- **R5 (controlador de sesión)**: la lógica del `SesionProvider` vive en
  `src/sesion/controlador-sesion.ts`, sin React. Lleva su propia copia del estado, calculada con
  el mismo `reducirSesion` que el `useReducer`, para que el cliente HTTP lea el usuario actual
  en el acto (sin esperar al próximo render). El provider solo conecta el controlador con React.
- **R12 (RNTL 14)**: `render`, `fireEvent` y `act` son async (`await`). `renderRouter` activa
  siempre los temporizadores falsos. El mock oficial de AsyncStorage es un `jest.fn` compartido
  dentro de cada archivo de test: se usa `jest.mocked(...).mockImplementationOnce` y
  `mockClear`, nunca `mockRestore` (le borraría la implementación).
- **R2 (Metro)**: `npx expo export --platform android` arma el bundle sin `metro.config.js`
  propio: Metro resuelve `@ai-ticket-it/shared` desde el workspace.
