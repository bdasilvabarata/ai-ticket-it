# AI Ticket It — instrucciones para agentes

Plataforma móvil de venta de entradas para eventos: organizadores publican eventos con tipos de
entrada; compradores buscan, compran, siguen sus compras, chatean y reseñan. TP individual de
Desarrollo con IA (DDS UTN FRBA, 2C 2026).

## Antes de tocar código

- Leé `.specify/memory/constitution.md`: dominio, reglas de negocio y principios no negociables.
- La consigna y los casos de uso (UC-01 a UC-12) están en `docs/consigna/consigna.md`.
- El orden y las dependencias de las features están en `docs/backlog.md`.
- Toda feature sigue Spec Kit: `/speckit-specify → /speckit-clarify → /speckit-plan →
  /speckit-tasks → /speckit-implement`, con revisión humana entre etapas.

## Ramas (ver constitución, "Flujo de Trabajo")

- `main` ← solo merges desde `development`.
- `development` ← PRs de features.
- `feature/NNN-slug` ← la crea `/speckit-specify`. **Antes de correrlo, posicionate en
  `development` actualizada** (`git switch development && git pull`), porque la rama nueva
  nace del HEAD actual.
- Al terminar una feature: tests, lint y typecheck en verde → PR a `development` → actualizar
  el estado en `docs/backlog.md`.

## Mapa

- `shared/` — tipos de contratos y enums compartidos (ej.: `EstadoCompra`).
- `backend/src/` — Express en capas:
  `routes/ → controllers/ → services/ → repositories/ → domain/`, más `middlewares/`
  (usuario actual, logging, 404, registro y respuesta de errores), `validations/` (zod),
  `errors/`, `config/` y `docs/` (OpenAPI, servida en `/api/docs`).
  - `app.ts` es el **composition root**: el único lugar que instancia y conecta las clases;
    cada clase recibe sus dependencias por constructor (nada de instancias globales).
  - `domain/` son clases con comportamiento (sin Express ni IO) y las interfaces de
    repositorio de las que dependen los services.
  - `repositories/` son repositorios **en memoria** (un `Map` privado por repositorio); no hay
    base de datos. `seed/` arma los datos de ejemplo y `crearRepositoriosDeEjemplo()`;
    `crearApp()` los usa por defecto. Las entidades son inmutables: `guardar` reemplaza la
    instancia (las operaciones de `Evento` devuelven un `Evento` nuevo).
  - **Recursos**: `usuarios`, `categorias` (solo lectura), `eventos` y su router hijo
    `eventos/:eventoId/tipos-entrada` (`TipoEntrada` vive dentro del agregado `Evento`: tiene
    controller y service, pero se guarda con `RepositorioEventos`), `compras` **mínimo**
    (entidad y `RepositorioCompras` con `existePorEvento` / `existePorTipoEntrada`, sin
    endpoints; lo amplía la 006) y `resenias` **mínimo** (feature 005: entidad `Resenia`,
    `RepositorioResenias.listarPorEventos` y `ReseniaService` con `puntajesPorOrganizador` /
    `puntajeDe`, sin endpoints; lo amplía la 011; vacío en el seed).
  - **Eventos públicos** (feature 005): `GET /eventos` es el catálogo (público, `CatalogoVista`:
    los no realizados filtrados por `texto` y `categoriaId` y ordenados por `orden` y `sentido`, más
    `hayEventosProximos`) y `GET /eventos/:eventoId` también es público. Toda `EventoVista` trae
    `organizador` (`OrganizadorVista` con `puntaje` sin redondear o `null` y `cantidadResenias`).
    Módulos puros del dominio: `domain/busqueda.ts` (`normalizarParaBuscar`, `palabrasDeBusqueda`:
    sin mayúsculas, acentos ni diéresis, ñ ≠ n) y `domain/orden-catalogo.ts` (`ordenarCatalogo`
    sobre elementos `Ordenable`, desempates fecha → nombre → id).
  - **Reloj**: `domain/reloj.ts` (interfaz `Reloj { ahora() }`) y `config/reloj.ts`
    (`relojDelSistema`). Es la única referencia de "ahora": llega a los services por constructor
    y `crearApp({ reloj })` permite fijarlo en los tests. `domain/` recibe `ahora` como
    argumento. La hora de pared de Buenos Aires (UTC−3) vive solo en `domain/hora-buenos-aires.ts`.
  - **Cerrojo por evento** (constitución, "Operaciones atómicas por evento"):
    `services/cerrojo-por-clave.ts`. `app.ts` crea **una** instancia y la comparten los services
    que modifican eventos. Reglas: (1) adentro de `cerrojo.ejecutar(eventoId, …)` se **vuelve a
    leer** el evento y el reloj, se verifica y recién después se guarda; (2) se libera siempre
    (`finally`) y el error llega al que llamó; (3) sin cerrojos anidados; (4) las lecturas no lo
    usan. Crear un evento no lo usa (su id es nuevo).
  - Orden de los chequeos de una escritura: 401 → 400 de forma → 404 evento → 403 → 404 tipo →
    400 categoría → 409 `EVENTO_REALIZADO` → otros 409. Los 404/403 los lanza el service con
    `errors/`; los 409, `domain/`.
  - **Services que se apoyan en otros** (como la referencia `2026-2c-lu-sa-grupo-1`): cada entidad
    tiene **un** service que la busca por id y lanza su 404 (`obtenerOFallar`, público); los demás
    se lo piden a él en vez de repetir la búsqueda. `TipoEntradaService` recibe `EventoService` y
    usa `obtenerDelOrganizador(id, usuarioId)` (404 + 403); `EventoService` recibe
    `CategoriaService` y valida la categoría elegida con `buscarReferenciada(id, origen)` (si no
    existe, `ReferenciaInvalidaError` → 400 sobre `body.categoriaId` con origen `"datos"` o
    `query.categoriaId` con `"consulta"`) y, para varias, le pide el lote con `obtenerPorIds` (una
    sola lectura, sin N+1). También recibe `UsuarioService` (`obtenerOFallar` público y
    `obtenerPorIds`) y `ReseniaService` para el organizador y su puntaje; `ReseniaService` recibe
    los eventos por parámetro y no depende de `EventoService` (sin ciclos). Los ids nuevos los da el
    repositorio (`siguienteId()`), y los órdenes son comparadores del dominio
    (`ordenDeMisEventos`, `compararPorNombre`).
  - `errors/` no conoce HTTP: cada error lleva código y mensaje, y el status lo asigna
    `statusDe` (tabla clase → status) en `middlewares/traducir-error.ts`.
  - `domain/errores.ts`: `DatosInvalidosError` y `ReglaDeNegocioError` (sin HTTP); el
    error handler los traduce a 400 y 409. `domain/` no importa `errors/` (lo controla el lint).
- `backend/tests/{domain,repositories,services,api}` — Vitest; `services/` usa los
  repositorios en memoria construidos con los datos de cada caso; `api/` usa supertest con
  `crearApp()` (repositorios nuevos por test).
- `mobile/` — Expo (SDK 58) + Expo Router + TanStack Query, organizado en **base**, **features** y
  **conectores** (feature 003). Para crear o cambiar una pantalla, usá la skill `nueva-pantalla`.
  - `app/` — **solo rutas**: cada archivo es un re-export de una línea
    (`export { Perfil as default } from "../../src/features/sesion";`); las secciones pendientes
    renderizan `<SeccionPendiente nombre="…" />`. `(tabs)/` tiene las pestañas Explorar · Mis
    compras · Mis eventos · Perfil; `seleccionar-usuario` es el selector (pantalla completa sin
    usuario, modal desde Perfil) y `cargando`, la espera inicial. El lint prohíbe importar
    `react`, `react-native`, `@tanstack/react-query`, `@expo/vector-icons` o `expo-router` en `app/`.
  - **Base** (no importa features):
    - `src/api/` — el cliente HTTP y un archivo por recurso con sus funciones de endpoint,
      exportados por `index.ts`. **Todo `fetch` vive acá** (el lint lo prohíbe en el resto de
      `mobile/`). `pedir(metodo, ruta, { cuerpo, signal, usuarioId })` y los atajos
      `get/post/put/patch/delete`: agrega `X-Usuario-Id`, manda el cuerpo como JSON, resuelve
      `undefined` ante un 204 y traduce errores a `ErrorDeApi` / `ServidorNoDisponibleError`.
      Un endpoint de escritura es una línea: `cliente.post<EventoVista>("/eventos", datos)`. Las
      escrituras **no se reintentan solas** (`mutations.retry: false`; la secuencia solo vuelve a
      pedir queries).
    - `src/consultas/` — `QueryClient` (sin reintentos propios; todo error de query o mutation va a
      la sesión vía `QueryCache`/`MutationCache`), claves en `claves.ts` (`catalogo` es la excepción
      documentada: **sin usuario**, porque el catálogo es el mismo para todos) y `cliente-api.tsx`
      (`ClienteApiProvider`, `useClienteApi()`), contrato que provee la sesión.
    - `src/conexion/` — contrato `EstadoConexion` + `ConexionProvider` + `useConexion()`; lo provee
      la sesión y lo leen la franja y `SegunConsulta`.
    - `src/componentes/` — `tema` (sistema visual "Pop Brutal": colores, espacios, `tipografia`,
      fuentes, radios, grosores, `tamano`, `sombra` dura con `boxShadow`, opacidad: nada suelto),
      `fuentes` (Archivo y Archivo Black, que `RaizDeLaApp` carga con `useFonts`), `hundido` (lo que
      se desplaza al presionar un elemento con sombra), `Boton` (`primario` · `aviso` = secundaria
      sobre superficie · `texto`), `Ilustracion`, `SegunConsulta` (los cuatro estados; `cargando` y
      `vacio` opcionales reemplazan a `Cargando` y a `ListaVacia`), `Cargando`, `MensajeError`,
      `ListaVacia` (con `accion` opcional), `SeccionPendiente`, `PantallaDesplazable` (scroll de las pantallas
      apiladas con header: margen sobre la barra de navegación del sistema y teclado que no tapa el
      campo; úsenla en vez de un `ScrollView` suelto), la franja, `Logo` y `CargandoInicio`
      (la ruta `cargando`); todo por `index.ts`. Los textos usan un estilo de `tema.tipografia`
      (`...tema.tipografia.cuerpo, color: …`): con fuentes propias el peso es la familia, nunca
      `fontWeight`. El primario es azul (`marca`, el verde exacto del logo, solo para acentos sin
      texto encima); el `resaltado` amarillo lleva siempre `texto` encima; los estados de compra usan
      `exito` (CONFIRMADA, UTILIZADA), `peligro` (CANCELADA, REEMBOLSADA) y `advertencia`
      (PENDIENTE), cada uno con su `sobre…`, y siempre junto a la etiqueta del estado.
  - **Features** — `src/features/<dominio>/` con `pantallas/`, `componentes/`, hooks de consulta,
    `formato.ts` (textos derivados puros) e `index.ts`, su **único punto de entrada público**:
    - `usuarios/` — `useUsuarios`, `FilaUsuario`, `nombreCompleto`, `textoEventosOrganizados`;
    - `sesion/` — usuario actual (reducer puro + controlador sin React + `SesionProvider`), usuario
      recordado en AsyncStorage y su validación, la secuencia única de reintentos (1, 2, 4, 8, 16,
      32 s), `useSesion()` y las pantallas `SeleccionarUsuario` y `Perfil`;
    - `categorias/` — `useCategorias`;
    - `eventos/` — Explorar (la pestaña de inicio: buscador con `useValorDemorado` de 500 ms,
      `BotonCategoria` (a la derecha del buscador) que abre `SelectorCategoria` en modo `conTodas` como
      desplegable, `SelectorOrden` (tocar el elegido invierte el `sentido`), `TarjetaEvento`/`TarjetaSkeleton` y
      `useCatalogo`), el detalle público `DetalleEvento` (ruta `explorar/[eventoId]`, `FilaImagenes`;
      ante un 404 llama a `useInvalidarCatalogo`), Mis eventos, Crear evento, `EventoDelOrganizador`
      (edita o muestra en solo lectura según el `realizado` del servidor), los formularios de tipo
      de entrada, `useMisEventos`/`useEvento`, las mutations de `mutaciones.ts` (en nombre del
      usuario **del formulario**, invalidan al terminar, también `["catalogo"]`), `fecha-de-pared.ts` (selector ⇄ `"YYYY-MM-DDTHH:mm"`,
      sin convertir zonas), `errores-de-formulario.ts` (la app no valida: muestra los detalles del
      400 junto a cada campo) y `useConfirmarDescarte` ("¿Descartar los cambios?" al salir de un
      formulario, con `usePreventRemove`; `salirSinConfirmar(navegar)` tras guardar o ante un 404).
  - **Conectores** (los únicos fuera de `features/` que importan features):
    - `src/composicion.ts` — **composition root** de la app, sin contexto: `crearDependencias({
      fetch, almacenamiento, urlEntorno, hostUri })` y `crearDependenciasDeProduccion()` arman la
      dirección, el `QueryClient`, el usuario recordado y la fábrica del cliente
      (`Dependencias = DependenciasSesion`), que llegan por props a `SesionProvider`.
    - `src/navegacion/` — `RaizDeLaApp` (dependencias de producción), `LayoutRaiz` (providers,
      franja de servidor no disponible y el `Stack` con los guards `Stack.Protected` por fase de
      la sesión) y `LayoutPestanas` (pestañas e íconos).
  - **Reglas de dependencia** (las verifica el lint con `eslint-plugin-import-x`, y
    `tests/arquitectura/reglas-de-dependencia.test.ts` comprueba que fallan cuando corresponde):
    (1) sin ciclos (`import-x/no-cycle`); (2) la base no importa features; (3) desde afuera de una
    feature solo se importa su `index.ts`, y adentro, por archivo (nunca el `index.ts` propio);
    (4) `app/` sin lógica, estado ni estilos. Imports relativos, sin alias `@/`; dentro de la base,
    lo de la misma carpeta por archivo y lo de otra carpeta por su `index.ts`.
  - **Rutas tipadas** (`experiments.typedRoutes`): `npm run typecheck` de `mobile/` corre primero
    `scripts/generar-tipos-rutas.js` (genera `.expo/types/router.d.ts` sin levantar Expo) y después
    `tsc`; una ruta mal escrita no compila, también en el CI. `tests/tipos/rutas-tipadas.ts` es la
    guarda (`@ts-expect-error` sobre una ruta inexistente).
  - `tests/` — Jest + React Native Testing Library, sin red: `helpers/` tiene
    `renderConDependencias` (la app real con `fetch` falso; si un test no registra lo que pide
    Explorar al entrar —el catálogo y las categorías— responde vacío) y `crearFetchFalso`/`porRuta`
    (registra método, encabezados y cuerpo). Tests por capa en `api/`, `componentes/`, `consultas/`,
    `conexion/` y `pantallas/`, y los de cada feature en `features/<dominio>/`.
- `specs/NNN-slug/` — spec, plan, research, data-model, contracts y tasks de cada feature.

## Comandos

Desde la raíz del repo:

| Comando | Efecto |
|---|---|
| `npm install` | instala todos los workspaces (`backend`, `shared`, `mobile`) |
| `npm start` | arranca el servidor con los datos de ejemplo en memoria |
| `npm run dev` | igual, recargando ante cambios (cada recarga vuelve a los datos de ejemplo) |
| `npm run mobile` | arranca Metro (`expo start`) para abrir la app con Expo Go (ver README) |
| `npm test` · `npm run lint` · `npm run typecheck` | calidad, en todos los paquetes (sin caché, como el CI) |
| `npm run format` · `npm run format:check` | Prettier (escribe / verifica); no toca los `.md` |
| `npm run test:foco -w backend -- <archivos>` | Vitest solo sobre esos tests, salida `dot` |
| `npm run test:afectados -w backend` | Vitest sobre los tests que dependen de lo que cambió sin commitear (`--changed`) |
| `npm run test:foco -w mobile -- <archivos>` | Jest solo sobre esos tests, `--silent` |

### Cuándo se corre cada cosa (constitución, "Verificación durante el desarrollo")

| Momento | Qué se corre |
|---|---|
| Cada ciclo rojo/verde de TDD | **solo** el test de la tarea: `test:foco` con su archivo (o `test:afectados` en el backend) |
| Fin de cada turno | el hook `Stop` (automático, ver abajo) |
| Al cerrar una fase de `tasks.md` y antes del PR | la suite completa: `npm test`, `npm run lint`, `npm run typecheck` y `npm run format:check` en verde |
| Cada PR y cada push a `development`/`main` | el CI (`.github/workflows/ci.yml`): todo, sin caché |

- Se corre el test por archivo y no la suite: la suite de mobile tarda entre 1 y 1,5 minutos;
  un test de mobile de lógica pura, ~4 s, y uno de `tests/pantallas/` (renderiza la app), entre 10
  y 20 s; un test del backend, ~4 s.
- En `mobile/`, `jest --findRelatedTests` / `-o` **no sirven para las pantallas**: los tests de
  `tests/pantallas/` llegan a ellas a través de las rutas de `app/` (que Expo Router carga con
  `require.context`), así que Jest no las relaciona. Se nombra el archivo del test.
- Un cambio en `shared/` lo consumen los dos paquetes: los tests de mobile no lo detectan con
  `-o`; se corren los tests que lo usan o la suite completa.
- Los tests focalizados no reemplazan a la suite: un cambio puede romper un test de otra
  pantalla. Por eso la suite completa al cerrar cada fase.

### Hook `Stop`

Un hook `Stop` de Claude Code (`.claude/settings.json` → `.claude/hooks/verificar-al-terminar.mjs`)
verifica tipos y lint al terminar cada turno y, si fallan, **no deja cerrar el turno** hasta
corregirlos. Compara cada archivo con la última verificación exitosa y verifica solo lo afectado:

| Cambió | Typecheck | Lint |
|---|---|---|
| solo `.md` | nada | nada |
| `backend/` | backend | `backend/` |
| `mobile/` | mobile (regenera las rutas tipadas solo si cambió `mobile/app/`) | `mobile/` |
| `shared/` | shared, backend y mobile | los tres |
| `eslint.config.js`, `tsconfig.base.json`, `package.json`, `package-lock.json` | los tres | todo el repo |
| otro `.js`/`.mjs`/`.ts` de la raíz (por ejemplo, el hook) | — | ese archivo |

Usa `tsc --incremental` y `eslint --cache --cache-strategy content`, con las cachés en
`node_modules/.cache/` (fuera de git), y corre typecheck y lint en paralelo. **No corre tests**:
esos van según la tabla de arriba. Si sospechás de la caché, borrá `node_modules/.cache/` o corré
`npm run typecheck` / `npm run lint`, que no la usan.

### TDD con stub

Como el hook bloquea el turno con el typecheck en rojo, en TDD el test y un **stub con la firma
real** del módulo que importa (que lanza `new Error("no implementado")`) se escriben en el mismo
turno: el typecheck queda en verde y el test falla por comportamiento, no por un import
inexistente. El rojo se comprueba con `test:foco` sobre ese test, y el verde, con el mismo comando.
Vale igual en `mobile/`: el test de una pantalla, hook o función de `src/api/` va en el mismo
turno que el stub de lo que importa (la pantalla con su export con nombre y la ruta de `app/` con
su re-export, el hook o la función con su firma real).

### Implement por fases

- `/speckit-tasks` **agrupa las tareas triviales** en una sola: los stubs con firma real y los
  re-exports de `app/` van junto con el test que los necesita (o en una tarea "stubs y rutas de la
  fase"), no una tarea por archivo.
- `/speckit-implement` se corre **de a una fase de `tasks.md`** (por ejemplo,
  `/speckit-implement fase 3`), con **contexto limpio entre fases** (`/clear`): lo que la fase
  siguiente necesita está en `tasks.md`, el plan y el código, no en la conversación. Cada fase
  cierra con la suite completa en verde, las tareas marcadas en `tasks.md` y su commit.

## Convención de nombres (repositories y services)

| Capa | Método | Devuelve / hace |
|---|---|---|
| Repository | `listar()` | todas las entidades |
| Repository | `buscarPorId(id)` · `buscarPor<Criterio>(...)` | la entidad o `null` (nunca lanza 404) |
| Repository | `listarPor<Criterio>(...)` | las entidades que cumplen el criterio (arreglo, posiblemente vacío) |
| Repository | `listarPorIds(ids)` | las que existen de esos ids, sin repetir (para las búsquedas en lote; categorías y usuarios) |
| Repository | `contarPor<Criterio>(...)` · `existe<Algo>(...)` | números / booleanos |
| Repository | `guardar(entidad)` · `eliminarPorId(id)` | persistencia |
| Repository | `siguienteId()` | un id nuevo para una entidad (el service no genera ids) |
| Service | `listar()` · `obtener(id)` · `crear(datos)` · `actualizar(id, datos)` · `eliminar(id)` | casos de uso para el controller (devuelven vistas); `obtener` lanza 404 |
| Service | `obtenerOFallar(id)` | la **entidad**; **único** lugar que la busca por id y lanza 404. Público si otro service la necesita (si no, `#obtenerOFallar`) |
| Service | `obtenerPorIds(ids)` | búsqueda en lote para otro service: un `Map` por id en una sola lectura; si falta alguna, 404 |
| Service | `buscarReferenciada(id)` | la entidad a la que apunta un dato de la entrada; si no existe, `ReferenciaInvalidaError` (400 sobre el campo) |

