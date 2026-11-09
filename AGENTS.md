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
    `crearApp()` los usa por defecto. Las operaciones que toquen cupo o estados no pueden
    tener un `await` entre verificar y modificar (constitución, "Cupo atómico").
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
      la sesión vía `QueryCache`/`MutationCache`), claves en `claves.ts` y `cliente-api.tsx`
      (`ClienteApiProvider`, `useClienteApi()`), contrato que provee la sesión.
    - `src/conexion/` — contrato `EstadoConexion` + `ConexionProvider` + `useConexion()`; lo provee
      la sesión y lo leen la franja y `SegunConsulta`.
    - `src/componentes/` — `tema` (colores, espacios, textos, pesos, radio, opacidad: nada suelto),
      `Boton` (`primario` · `aviso` · `texto`), `SegunConsulta` (los cuatro estados), `Cargando`,
      `MensajeError`, `ListaVacia`, `SeccionPendiente`, la franja, `Logo` y `CargandoInicio`
      (la ruta `cargando`); todo por `index.ts`. El primario es el verde del logo oscurecido
      (`marca` es el verde exacto, solo para acentos sin texto encima); los estados de compra usan
      `exito` (CONFIRMADA, UTILIZADA), `peligro` (CANCELADA, REEMBOLSADA) y `advertencia`
      (PENDIENTE), cada uno con su `sobre…`, y siempre junto a la etiqueta del estado.
  - **Features** — `src/features/<dominio>/` con `pantallas/`, `componentes/`, hooks de consulta,
    `formato.ts` (textos derivados puros) e `index.ts`, su **único punto de entrada público**:
    - `usuarios/` — `useUsuarios`, `FilaUsuario`, `nombreCompleto`, `textoEventosOrganizados`;
    - `sesion/` — usuario actual (reducer puro + controlador sin React + `SesionProvider`), usuario
      recordado en AsyncStorage y su validación, la secuencia única de reintentos (1, 2, 4, 8, 16,
      32 s), `useSesion()` y las pantallas `SeleccionarUsuario` y `Perfil`.
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
    `renderConDependencias` (la app real con `fetch` falso) y `crearFetchFalso`/`porRuta` (registra
    método, encabezados y cuerpo). Tests por capa en `api/`, `componentes/`, `consultas/`,
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
| `npm test` · `npm run lint` · `npm run typecheck` | calidad, en todos los paquetes |
| `npm run format` · `npm run format:check` | Prettier (escribe / verifica); no toca los `.md` |

Antes de dar una tarea por terminada: `npm test`, `npm run lint`, `npm run typecheck` y
`npm run format:check` en verde. El CI (`.github/workflows/ci.yml`) los corre en cada PR.
Además, un hook `Stop` de Claude Code (`.claude/settings.json` →
`.claude/hooks/verificar-al-terminar.mjs`) corre `typecheck` y `lint` al terminar cada turno en
que cambió algo que no sea Markdown, y si fallan no deja cerrar el turno hasta corregirlos.
Por eso, en TDD, el test y un **stub con la firma real** del módulo que importa (que lanza
`new Error("no implementado")`) se escriben en el mismo turno: el typecheck queda en verde y el
test falla por comportamiento, no por un import inexistente.
Vale igual en `mobile/`: el test de una pantalla, hook o función de `src/api/` va en el mismo
turno que el stub de lo que importa (la pantalla con su export con nombre y la ruta de `app/` con
su re-export, el hook o la función con su firma real).

## Convención de nombres (repositories y services)

| Capa | Método | Devuelve / hace |
|---|---|---|
| Repository | `listar()` | todas las entidades |
| Repository | `buscarPorId(id)` · `buscarPor<Criterio>(...)` | la entidad o `null` (nunca lanza 404) |
| Repository | `contarPor<Criterio>(...)` · `existe<Algo>(...)` | números / booleanos |
| Repository | `guardar(entidad)` · `eliminarPorId(id)` | persistencia |
| Service | `listar()` · `obtener(id)` · `crear(datos)` · `actualizar(id, datos)` · `eliminar(id)` | casos de uso; `obtener` lanza 404 |
| Service | `#obtenerOFallar(id)` (privado) | **único** lugar del service que busca por id y lanza 404 |

