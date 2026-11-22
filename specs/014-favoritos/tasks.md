---

description: "Tareas de implementación de la feature 014 — Favoritos"
---

# Tasks: Favoritos

**Input**: documentos de diseño en `specs/014-favoritos/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md),
[contracts/app.md](./contracts/app.md), [quickstart.md](./quickstart.md)

**Tests**: obligatorios (constitución II, TDD). Cada regla tiene su test: idempotencia de marcar y
desmarcar (FR-003), "sin repetir" en `Usuario` (R1), 404 del evento sin cambiar nada (FR-004),
orden de rechazos 401 → 400 → 404 (FR-005), favoritos por usuario (FR-006), sin cerrojo del evento
(FR-007), orden de la lista con desempate nombre → id (FR-009), limpieza al eliminar solo si se
elimina y huérfano omitido (FR-010), lecturas fijas (FR-011), catálogo idéntico con y sin usuario
(FR-013); en mobile, la estrella del detalle (etiquetas, `selected`, `busy`, doble toque = un
pedido, error → estado real), las estrellas indicadoras con su etiqueta "en favoritos" y sin
estrellas con la consulta fallando, y los cuatro estados de "Mis favoritos".

**Organización**: el backend va primero (dominio y repositorio como fundación; después US1, US2 y
el seed de US4) y la app después (su base como fundación; después US1, US2 y US3), en el orden de
"Fases sugeridas" del plan. Las historias US1 y US2 (P1) juntas son el MVP; US3 (P2) suma las
estrellas indicadoras en el resto de las listas, y US4 (P3), los favoritos de ejemplo.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: puede hacerse en paralelo (archivo distinto, sin dependencias pendientes).
- **[Story]**: historia a la que pertenece (US1–US4).
- Rutas relativas a la raíz del repo.

## Convenciones para todas las tareas

- **Test primero con stub en el mismo turno** (AGENTS.md, "TDD con stub"): el hook `Stop` exige
  typecheck y lint en verde al cerrar cada turno. Cada tarea "Test" crea **en el mismo turno** los
  métodos, módulos o componentes que importa como **stub con la firma real** que lanza
  `new Error("no implementado")` (un componente que devuelve `null`; una ruta de `app/` con su
  re-export de una línea). Se corre el test con `test:foco` (o `test:afectados -w backend`), **se lo
  ve fallar** por comportamiento y recién después se implementa.
- Endpoints: skill **`nuevo-endpoint`**. Pantallas, hooks, componentes y funciones de `src/api/`:
  skill **`nueva-pantalla`**.
- Backend en capas (research R1–R6): **sin** entidad, repositorio, service, controller ni router
  nuevos. `Usuario` (dominio) tiene el comportamiento; `UsuarioService` es el **único** que escribe
  usuarios; el 404 del evento lo lanza **solo** `EventoService.obtenerOFallar`; `UsuarioService` no
  depende de `EventoService` (sería un ciclo). Marcar y desmarcar **no** toman el cerrojo del evento
  ni tocan el evento, sus tipos, su cupo ni sus compras (FR-007). La lista es una **lectura**: sin
  cerrojo y sin guardar. Sin cerrojos anidados.
- Contrato (contracts/api.md): `GET /api/usuarios/actual/favoritos` → `200 EventoCatalogoVista[]`
  (sin páginas, `[]` sin favoritos); `PUT` y `DELETE /api/usuarios/actual/favoritos/:eventoId` →
  `204` sin cuerpo, también si ya era / no era favorito. Rechazos 401 `USUARIO_NO_IDENTIFICADO` →
  400 `ENTRADA_INVALIDA` sobre `params.eventoId` (validación `eventoPorId` de
  `backend/src/validations/evento.validation.ts`) → 404 `EVENTO_NO_ENCONTRADO`. **No hay 403 ni
  409.** Las tres rutas se declaran **antes** que `/:id` en `usuarios.routes.ts`.
- `shared/` **no cambia**: la lista reusa `EventoCatalogoVista`; `EventoVista`,
  `EventoCatalogoVista` y `CatalogoVista` **no** suman nada de favoritos (FR-013).
- Invariante de `Usuario`: `favoritos` "sin repetir" → `DatosInvalidosError` sobre `favoritos` con
  el mensaje "No puede repetir eventos." (data-model.md).
- Mobile: todo lo de favoritos vive en `features/eventos` (research R7) y `compras` lo usa por el
  `index.ts` de `eventos`; `eventos` nunca importa `compras`; Perfil (`sesion`) navega por la ruta
  tipada sin importar `eventos`. Imports relativos sin alias `@/`; todo `fetch` en `src/api/`;
  estilos con `StyleSheet` y valores del `tema` (sin tokens nuevos); textos con
  `...tema.tipografia.<estilo>` (nunca `fontWeight`).
- Textos de la app al pie de la letra: "Agregar a favoritos", "Quitar de favoritos", "Mis
  favoritos", "Todavía no tenés favoritos", "Ir a Explorar", "Realizado"; la etiqueta accesible de
  una tarjeta o fila favorita suma ", en favoritos" (y una tarjeta realizada, ", realizado").
- La estrella del detalle es el **único** lugar donde se marca o desmarca (FR-014); las estrellas
  de las listas (`MarcaFavorito`) solo indican: ni tocables ni accesibles aparte (FR-015).
- Sin optimismo (research R8): el estado de toda estrella sale **solo** de `useIdsDeFavoritos()`;
  `useCambiarFavorito` no reintenta y queda pendiente hasta releer `["favoritos", usuarioId]`; no
  invalida catálogo, detalle, "Mis compras" ni "Mis eventos" (FR-018).
- Prohibidos `any`, `@ts-ignore` y `eslint-disable` sin descripción (principio IX).
- Commits: Conventional Commits con scope `014-favoritos`, uno por tarea o grupo coherente. Cada
  fase cierra con la suite completa en verde (`npm test`, `npm run lint`, `npm run typecheck`,
  `npm run format:check`), sus tareas marcadas y su commit.

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: partir de una base en verde. No hay dependencias ni carpetas nuevas.

- [X] T001 Verificar que se está en `feature/014-favoritos` y que la suite completa (`npm test`,
  `npm run lint`, `npm run typecheck`, `npm run format:check`) está en verde antes de tocar código;
  si algo falla, reportarlo antes de seguir.

---

## Phase 2: Foundational — dominio y repositorio del backend

**Purpose**: el comportamiento de `Usuario`, el desempate del orden y el repositorio que usan todas
las historias del backend.

**⚠️ CRITICAL**: ninguna historia del backend empieza hasta cerrar esta fase.

- [X] T002 Test de `Usuario` en `backend/tests/domain/usuario.test.ts` (con stubs de
  `tieneFavorito(eventoId): boolean`, `marcarFavorito(eventoId): Usuario` y
  `desmarcarFavorito(eventoId): Usuario` en `backend/src/domain/usuario.ts`): `tieneFavorito`
  verdadero/falso; `marcarFavorito` agrega el id **al final** y devuelve un `Usuario` nuevo sin
  cambiar el original; marcar uno que ya está devuelve **el mismo** objeto (`toBe`); `desmarcar`
  lo saca y devuelve uno nuevo; desmarcar uno que no está devuelve el mismo; el constructor con
  `favoritos` repetidos lanza `DatosInvalidosError` con un detalle sobre `favoritos`, "No puede
  repetir eventos."; `nombre`, `apellido` e `id` se conservan en las copias.
- [X] T003 Implementar en `backend/src/domain/usuario.ts` la invariante "sin repetir" (con
  `Invariantes`, como `nombre` y `apellido`) y los tres métodos, inmutables; verde T002 y
  `test:afectados -w backend` (el seed y los tests que construyen usuarios siguen en verde).
- [X] T004 [P] Test y cambio de `ordenDeMisEventos(ahora)` en `backend/tests/domain/evento.test.ts`
  y `backend/src/domain/evento.ts`: dos eventos a la misma `fechaHora` (próximos y realizados) se
  ordenan por nombre sin mayúsculas ni tildes (el mismo criterio que `porNombre` de
  `domain/orden-catalogo.ts`; reusarlo exportándolo o extrayendo el comparador, sin duplicarlo) y,
  con el mismo nombre, por `id`; los casos existentes (próximos ascendente, realizados descendente)
  siguen en verde (FR-009, research R6).
- [X] T005 [P] Test nuevo `backend/tests/repositories/usuario.repository.test.ts` (con stubs de
  `guardar(usuario): Promise<void>` y `listarPorFavorito(eventoId): Promise<Usuario[]>` en
  `RepositorioUsuarios` de `backend/src/domain/repositorios.ts` y en
  `backend/src/repositories/usuario.repository.ts`): `guardar` da de alta y reemplaza la instancia
  por id (`buscarPorId` devuelve la nueva); `listarPorFavorito` devuelve solo los usuarios que
  tienen ese evento en `favoritos` y `[]` si ninguno. Implementar sobre el `Map` privado (sin
  `eliminarPorId`); verde.

**Checkpoint**: dominio y repositorio listos; las historias del backend pueden empezar.

---

## Phase 3: User Story 1 — Marcar y desmarcar (backend) (Priority: P1) 🎯 MVP

**Goal**: `PUT` y `DELETE /api/usuarios/actual/favoritos/:eventoId`, idempotentes, con el orden de
rechazos 401 → 400 → 404, bajo el cerrojo con la clave `usuario:<id>` y sin tocar el evento.

**Independent Test**: con `crearApp({ repositorios })`, marcar un evento con un usuario sin
favoritos (204), comprobar en el repositorio de usuarios que lo tiene una vez, repetir (204, sigue
una vez), desmarcar dos veces (204 y 204) y comprobar los rechazos.

- [X] T006 [US1] Test de `UsuarioService` en `backend/tests/services/usuario.service.test.ts` (ya
  existe: se suman casos y sus construcciones actuales, líneas 34 y 112, reciben el cerrojo) (con
  stubs de `marcarFavorito(usuarioId, eventoId): Promise<void>` y `desmarcarFavorito(usuarioId,
  eventoId): Promise<void>` en `backend/src/services/usuario.service.ts`, y el constructor que pasa
  a recibir `cerrojo: CerrojoPorClave`; en el **mismo turno**, `backend/src/app.ts` le pasa la
  **misma** instancia que ya reciben los services de eventos (una sola por app, research R4), y
  `backend/tests/helpers/services-de-eventos.ts` le pasa la que ya arma para ellos; los tests que
  construyen `UsuarioService` sueltos le pasan uno propio): marcar guarda el usuario con el evento al final; marcar uno repetido **no** llama a
  `guardar` (espía); desmarcar lo saca; desmarcar uno que no tiene no guarda; un usuario
  inexistente → `NoEncontradoError` `USUARIO_NO_ENCONTRADO` (vía `obtenerOFallar`); la escritura
  corre dentro de `cerrojo.ejecutar("usuario:<id>", …)` (la clave exacta, espiada) y relee el usuario adentro (espía del cerrojo);
  dos `marcarFavorito` concurrentes del mismo usuario sobre eventos distintos (`Promise.all`, con un
  repositorio cuyo `buscarPorId` cede el turno) conservan los dos.
- [X] T007 [US1] Implementar `marcarFavorito` / `desmarcarFavorito` en
  `backend/src/services/usuario.service.ts`: bajo `this.#cerrojo.ejecutar(this.#claveDe(usuarioId), …)` (`usuario:<id>`),
  `obtenerOFallar`, `usuario.marcarFavorito/desmarcarFavorito` y `guardar` solo si devolvió otro
  objeto. `UsuarioService` no sabe si el evento existe; verde T006.
- [X] T008 [US1] Test de `EventoService` en `backend/tests/services/evento.service.test.ts` (con
  stubs de `marcarFavorito(eventoId, usuarioId): Promise<void>` y `desmarcarFavorito(eventoId,
  usuarioId): Promise<void>` en `backend/src/services/evento.service.ts`): un evento inexistente →
  `EVENTO_NO_ENCONTRADO` y `usuarioService.marcarFavorito/desmarcarFavorito` no se llaman (los
  favoritos no cambian, FR-004); con uno existente delega en `UsuarioService` con
  `(usuarioId, eventoId)`; vale para un evento **propio** y uno **realizado** (FR-001); **no** toma
  el cerrojo de eventos (espía de `cerrojo.ejecutar` sin llamadas) ni guarda eventos ni compras
  (FR-007).
- [X] T009 [US1] Implementar los dos casos de uso en `backend/src/services/evento.service.ts`:
  `this.obtenerOFallar(eventoId)` y después `this.#usuarioService.marcarFavorito/desmarcarFavorito`;
  verde T008.
- [X] T010 [US1] Test de API nuevo `backend/tests/api/favoritos.test.ts` para `PUT` y `DELETE`
  (con stubs de `marcarFavorito` y `desmarcarFavorito` en
  `backend/src/controllers/evento.controller.ts`, las rutas
  `router.put("/actual/favoritos/:eventoId", requerirUsuario, eventoPorId.middleware, …)` y
  `router.delete(...)` en `backend/src/routes/usuarios.routes.ts` —**antes** de `/:id`—, que pasa a
  recibir también `EventoController`, y `backend/src/routes/index.ts` pasándoselo): sin
  `X-Usuario-Id` o con uno inexistente → 401 `USUARIO_NO_IDENTIFICADO` (también con un `eventoId`
  inválido: el 401 va primero); `eventoId` con formato inválido → 400 `ENTRADA_INVALIDA` con un
  detalle sobre `params.eventoId`; evento inexistente → 404 `EVENTO_NO_ENCONTRADO` y el usuario del
  repositorio sin cambios; `PUT` dos veces → `204`, `204`, cuerpo vacío, y el evento una sola vez
  en `favoritos` (leído del repositorio pasado a `crearApp({ repositorios })`); `DELETE` dos veces →
  `204`, `204`; marcar un evento propio y uno realizado → 204; lo que marca Diego no aparece en
  Lucía (FR-006); el evento (cupo y tipos) queda igual tras marcar.
- [X] T011 [US1] Implementar `EventoController.marcarFavorito` / `desmarcarFavorito` en
  `backend/src/controllers/evento.controller.ts` (usuario actual de `res.locals`, `eventoId` de
  `params`, `res.status(204).end()`, sin reglas) y dejar las rutas definitivas; verde T010.
- [X] T012 [US1] Documentar `PUT` y `DELETE /usuarios/actual/favoritos/{eventoId}` en
  `backend/src/docs/openapi.json` con el tag nuevo `Favoritos` (seguridad `X-Usuario-Id`, `204`,
  `400`, `401`, `404`, sin `409`); verde `backend/tests/api/docs.test.ts` (cobertura de rutas).

**Checkpoint**: marcar y desmarcar funcionan por API, idempotentes y por usuario.

---

## Phase 4: User Story 2 — La lista y la limpieza al eliminar (backend) (Priority: P1) 🎯 MVP

**Goal**: `GET /api/usuarios/actual/favoritos` con las tarjetas del catálogo en el orden de
FR-009, en lote; eliminar un evento lo saca de los favoritos de todos.

**Independent Test**: marcar eventos próximos y realizados por API y pedir la lista: orden, mismos
`organizador`/`puntaje`/`cantidadResenias` que en `GET /eventos`, `[]` sin favoritos; eliminar un
evento sin compras y ver que sale de las listas.

- [X] T013 [US2] Refactor sin cambio de comportamiento en `backend/src/services/evento.service.ts`:
  extraer de `listar` (013) el método privado `#tarjetasDelCatalogo(eventos, todos, ahora)` (puntajes
  con `reseniaService.puntajesPorOrganizador`, cupo al día con `#conCupoAlDia`, categorías y
  organizadores con `obtenerPorIds`) y que `listar` lo use para la página; verde
  `backend/tests/services/evento.service.test.ts` y `backend/tests/api/eventos.test.ts` sin
  tocarlos.
- [X] T014 [US2] Test de `EventoService.favoritosDe(usuarioId)` en
  `backend/tests/services/evento.service.test.ts` (con stub `favoritosDe(usuarioId):
  Promise<EventoCatalogoVista[]>`): primero los no realizados por `fechaHora` ascendente y después
  los realizados por `fechaHora` descendente, con `realizado: true` en estos; desempate nombre → id;
  cada elemento es igual (`toEqual`) a la tarjeta del mismo evento en `listar` (organizador,
  `puntaje` sin redondear o `null`, `cantidadResenias`, `precioDesde`, `agotado` con el cupo al día;
  SC-006), comparando solo los próximos, con un caso de 10 eventos o menos (una sola página de
  `listar`, que pagina de a 10 desde la 013); `[]` sin favoritos; con el reloj fijo avanzado más
  allá de la fecha de un favorito próximo, ese evento pasa al grupo de realizados con
  `realizado: true` (edge case "un favorito próximo que pasa a realizado"); un id guardado cuyo evento no existe
  se **omite** sin fallar (FR-010); con repositorios espiados, la cantidad de lecturas es la misma
  con 1 y con 5 favoritos (usuario, `eventos.listar` una vez, reseñas, pendientes, categorías y
  usuarios en lote; FR-011); no guarda nada ni toma cerrojos.
- [X] T015 [US2] Implementar `favoritosDe` (research R6): `usuarioService.obtenerOFallar(usuarioId)`,
  `eventos.listar()` una vez, filtrar los que existen en `usuario.favoritos`, ordenar con
  `ordenDeMisEventos(ahora)` y armar con `#tarjetasDelCatalogo`; `ahora` del reloj; verde T014.
- [X] T016 [US2] Test de la limpieza al eliminar en `backend/tests/services/usuario.service.test.ts`
  y `backend/tests/services/evento.service.test.ts` (con stub
  `quitarFavoritoDeTodos(eventoId): Promise<void>` en `UsuarioService`):
  `quitarFavoritoDeTodos` usa `listarPorFavorito` y, de a uno y bajo la clave `usuario:<id>` de cada uno,
  relee, desmarca y guarda (los demás favoritos de cada usuario se conservan; sin usuarios, no
  guarda nada); `EventoService.eliminar` de un evento sin compras lo saca de los favoritos de
  **todos** los que lo tenían; si la eliminación se rechaza (403 de otro usuario, 409 con compras,
  409 realizado) ningún favorito cambia y `quitarFavoritoDeTodos` no se llama; la limpieza corre
  **después** de liberar el cerrojo del evento (sin anidar: al entrar a `quitarFavoritoDeTodos`, el
  `cerrojo.ejecutar` del evento ya resolvió).
- [X] T017 [US2] Implementar `UsuarioService.quitarFavoritoDeTodos` y el segundo tramo de
  `EventoService.eliminar` en `backend/src/services/usuario.service.ts` y
  `backend/src/services/evento.service.ts` (research R5: después del `await` del cerrojo y solo si
  no lanzó); verde T016.
- [X] T018 [US2] Test de API de la lista en `backend/tests/api/favoritos.test.ts` (con stub
  `EventoController.favoritos` y la ruta `router.get("/actual/favoritos", requerirUsuario, …)` antes
  de `/:id`): 401 sin usuario; `200 []` sin favoritos; tras marcar un próximo y un realizado, el
  orden de FR-009; marcar dos veces → aparece una vez (SC-003); la de Lucía no trae los de Diego;
  Lucía elimina un evento propio sin compras que Diego tenía → la lista de Diego ya no lo trae; un
  `DELETE /eventos/:id` rechazado no cambia la lista; `GET /eventos` y `GET /eventos/:id` responden
  **lo mismo** con y sin `X-Usuario-Id` y con usuarios con favoritos distintos (FR-013, SC-004).
- [X] T019 [US2] Implementar `EventoController.favoritos` en
  `backend/src/controllers/evento.controller.ts` y documentar `GET /usuarios/actual/favoritos`
  (`200` arreglo de `EventoCatalogoVista`, `401`) bajo el tag `Favoritos` en
  `backend/src/docs/openapi.json`, más la nota en `DELETE /eventos/{eventoId}` ("al eliminarse, el
  evento sale de los favoritos de todos los usuarios"); verde T018 y `backend/tests/api/docs.test.ts`.

**Checkpoint**: el backend completo de US1 y US2.

---

## Phase 5: User Story 4 — Favoritos de ejemplo (backend) (Priority: P3)

**Goal**: el seed con favoritos para la demo (research R10) y la colección de Postman.

**Independent Test**: con `crearApp()` recién creada, la lista de Diego es Clásico de básquet →
Festival Sonidos del Sur → Noche de risas (realizado); la de Lucía y la de Martín, `[]`.

- [X] T020 [US4] Test en `backend/tests/domain/datos-ejemplo.test.ts` (y uno de API en
  `backend/tests/api/favoritos.test.ts` con `crearApp()` por defecto): `usuario-diego` tiene
  `evento-festival-sonidos-del-sur`, `evento-clasico-de-basquet` y `evento-noche-de-risas`;
  `usuario-valentina`, `evento-noche-de-rock` y `evento-jazz-en-el-patio`; `usuario-sofia`,
  `evento-clasico-de-basquet` (propio) y `evento-maraton-10k`; `usuario-lucia` y `usuario-martin`,
  `[]`; todos los ids existen en el seed; la lista de Diego por API sale en el orden Clásico de
  básquet → Festival Sonidos del Sur → Noche de risas (`realizado: true`) (US4-1, SC-007).
- [X] T021 [US4] Cargar esos favoritos en `backend/src/seed/datos-ejemplo.ts` (los ids con el mismo
  `slug` que usa el seed, sin repetir) y sumar la carpeta "Favoritos" con los tres pedidos (`GET`,
  `PUT` y `DELETE`, con `X-Usuario-Id`) a `backend/src/docs/ai-ticket-it.postman_collection.json`;
  verde T020 y `test:afectados -w backend` (los tests del seed y los que cuentan usuarios o eventos
  siguen en verde).

**Checkpoint**: backend terminado; cierre de fase con la suite completa.

---

## Phase 6: Foundational — base de la app

**Purpose**: cliente, clave, los dos hooks genéricos movidos a la base, el helper de tests y la
consulta de favoritos que usan las tres historias de la app.

**⚠️ CRITICAL**: ninguna historia de la app empieza hasta cerrar esta fase.

- [X] T022 [P] Test en `mobile/tests/api/usuarios.test.ts` (con stubs en
  `mobile/src/api/usuarios.ts`, exportados por `mobile/src/api/index.ts`):
  `listarFavoritos(cliente, usuarioId, { signal })` → `GET /usuarios/actual/favoritos` con
  `X-Usuario-Id` y el arreglo de la respuesta; `marcarFavorito(cliente, usuarioId, eventoId)` →
  `PUT /usuarios/actual/favoritos/<eventoId>` y `desmarcarFavorito(...)` → `DELETE`, los dos con
  `X-Usuario-Id`, sin cuerpo, resolviendo `undefined` ante el `204`. Implementar con
  `cliente.get/put/delete`; verde.
- [X] T023 [P] Test en `mobile/tests/consultas/claves.test.ts` y cambio en
  `mobile/src/consultas/claves.ts`: `claves.favoritos(usuarioId)` → `["favoritos", usuarioId]`, sin
  prefijo común con `catalogo`, `evento`, `misEventos` ni `misCompras`; verde.
- [X] T024 Mover `useEnvioUnico` y `useRefrescarAlFocalizar` de `mobile/src/features/compras/` a
  `mobile/src/componentes/useEnvioUnico.ts` y `mobile/src/componentes/useRefrescarAlFocalizar.ts`,
  exportados por `mobile/src/componentes/index.ts`, **sin cambiar su comportamiento** (research R7);
  actualizar los imports de `mobile/src/features/compras/pantallas/{ChatDeLaCompra,Compra,
  ComprasDelEvento,MisCompras,ReseniarEvento}.tsx` (y cualquier otro que aparezca con `grep`), sacar
  los archivos viejos y mover `mobile/tests/features/compras/useEnvioUnico.test.ts` a
  `mobile/tests/componentes/useEnvioUnico.test.ts`; verde ese test, `npm run lint -w mobile` (base
  sin imports de features) y los tests de pantalla de compras afectados.
- [X] T025 Helper de tests: `mobile/tests/helpers/render-con-dependencias.tsx` responde `[]` a
  `GET /usuarios/actual/favoritos` cuando el test no lo registra (como el catálogo y "Mis compras"),
  y `mobile/tests/helpers/eventos.ts` suma, si hace falta, un armador de `EventoCatalogoVista`
  realizado para los favoritos; verde la suite de `mobile/tests/pantallas/` (ninguna pantalla pide
  favoritos todavía, así que no cambia nada).
- [X] T026 Test en `mobile/tests/features/eventos/useFavoritos.test.tsx` (con stubs de
  `useFavoritos()` y `useIdsDeFavoritos(): ReadonlySet<string>` en
  `mobile/src/features/eventos/useFavoritos.ts`, exportados por
  `mobile/src/features/eventos/index.ts`): `useFavoritos` pide con el usuario de la sesión y la clave
  `claves.favoritos(usuarioId)`; `useIdsDeFavoritos` devuelve un `Set` **vacío** mientras carga y
  con la consulta en error (FR-018b) y los ids con datos; los dos hooks montados juntos hacen
  **una** sola consulta. Implementar (`useQuery` con `listarFavoritos`; el `Set` con `select`);
  verde.

**Checkpoint**: base lista; las historias de la app pueden empezar.

---

## Phase 7: User Story 1 — La estrella del detalle (app) (Priority: P1) 🎯 MVP

**Goal**: `EstrellaFavorito` en `DetalleEvento`, el único lugar donde se marca o desmarca.

**Independent Test**: con un usuario sin favoritos, abrir el detalle, tocar la estrella (sale el
`PUT`, queda llena y "Quitar de favoritos" tras releer), tocarla otra vez (sale el `DELETE`, queda
vacía).

- [X] T027 [US1] Test en `mobile/tests/features/eventos/estrella-favorito.test.tsx` (con stubs de
  `EstrellaFavorito({ eventoId })` en `mobile/src/features/eventos/componentes/EstrellaFavorito.tsx`,
  que devuelve `null`, y `useCambiarFavorito(usuarioId, eventoId)` en
  `mobile/src/features/eventos/useCambiarFavorito.ts`): sin datos de favoritos no se dibuja; no
  favorito → botón "Agregar a favoritos" con ícono `star-outline` y `selected: false`; favorito →
  "Quitar de favoritos", `star`, `selected: true`; al tocar sale **un** `PUT` (o `DELETE`) y,
  mientras no se releen los favoritos, `busy: true` y `disabled`; dos toques seguidos → un solo
  pedido (FR-016); con el pedido fallando, la estrella vuelve al estado releído y no se reintenta
  (FR-017, US1-6); tras el cambio solo se vuelve a pedir `GET /usuarios/actual/favoritos` (ni el
  catálogo ni el evento, FR-018).
- [X] T028 [US1] Implementar `useCambiarFavorito` (mutation `variables: { marcar: boolean }`,
  `marcarFavorito`/`desmarcarFavorito` de `src/api`, sin reintentos, `onSettled` que **devuelve** la
  promesa de `invalidateQueries({ queryKey: claves.favoritos(usuarioId) })`) y `EstrellaFavorito`
  (`Pressable` con `accessibilityRole="button"`, `accessibilityLabel` según el estado,
  `accessibilityState={{ selected, busy, disabled }}`, Ionicons `star`/`star-outline` en
  `tema.colores.texto`, atenuada con la `opacidad` del tema mientras está en curso, área táctil
  mínima `tema.tamano`, envío con `useEnvioUnico` de `src/componentes`); verde T027.
- [X] T029 [US1] Test en `mobile/tests/pantallas/detalle-evento.test.tsx`: el detalle de un evento
  ajeno muestra la estrella al lado del nombre; marcar registra el `PUT
  /usuarios/actual/favoritos/<id>` con `X-Usuario-Id` (con `crearFetchFalso`/`porRuta`) y, con los
  favoritos releídos, "Quitar de favoritos" seleccionada; desmarcar registra el `DELETE`; un
  favorito de Diego aparece vacío para Lucía (US1-5); el organizador también ve la estrella en el
  detalle de su evento; mientras los favoritos fallan, el resto del detalle se ve y la estrella no
  (FR-018b). Integrar `EstrellaFavorito` en el encabezado de
  `mobile/src/features/eventos/pantallas/DetalleEvento.tsx`, al lado del nombre, sin tapar el
  título; verde.

**Checkpoint**: US1 completa de punta a punta.

---

## Phase 8: User Story 2 — "Mis favoritos" (app) (Priority: P1) 🎯 MVP

**Goal**: la pantalla apilada `/favoritos` desde Perfil, con los cuatro estados, la tarjeta del
catálogo con su estrella indicadora y "Realizado", y la limpieza en la caché al eliminar un evento.

**Independent Test**: con favoritos registrados en el `fetch` falso, abrir Perfil → "Mis
favoritos": tarjetas en el orden del servidor con la estrella, el realizado con "Realizado";
vacío con "Ir a Explorar"; tocar una abre el detalle.

- [ ] T030 [P] [US2] Test en `mobile/tests/features/eventos/tarjeta-evento.test.tsx` (con stub
  `MarcaFavorito()` en `mobile/src/features/eventos/componentes/MarcaFavorito.tsx` y la prop
  `esFavorito?: boolean` en `TarjetaEvento`): con `esFavorito` la etiqueta accesible termina en ",
  en favoritos" y la estrella no es un elemento accesible aparte; sin la prop, ni estrella ni
  sufijo; con `evento.realizado`, la marca "Realizado" y ", realizado" en la etiqueta. Implementar
  `MarcaFavorito` (Ionicons `star` en `tema.colores.texto` sobre un círculo `resaltado` con borde,
  posición absoluta arriba a la derecha, `accessible={false}` e
  `importantForAccessibility="no-hide-descendants"`) y sumarla a
  `mobile/src/features/eventos/componentes/TarjetaEvento.tsx` con `MarcaRealizado` y el lugar a la
  derecha del título para que no lo tape; exportar `MarcaFavorito` por
  `mobile/src/features/eventos/index.ts`; verde, y `mobile/tests/pantallas/explorar.test.tsx` sigue
  en verde.
- [ ] T031 [US2] Test nuevo `mobile/tests/pantallas/mis-favoritos.test.tsx` (con stub de la
  pantalla `MisFavoritos` en `mobile/src/features/eventos/pantallas/MisFavoritos.tsx`, exportada por
  el `index.ts` de `eventos`, la ruta `mobile/app/favoritos.tsx` con su re-export de una línea y el
  `Stack.Screen name="favoritos"` con `title: "Mis favoritos"` dentro del guard con usuario de
  `mobile/src/navegacion/LayoutRaiz.tsx`): cargando mientras la consulta no responde; error con
  reintentar (nunca un vacío falso, US2-6); vacío "Todavía no tenés favoritos" con "Ir a Explorar",
  que lleva a la pestaña Explorar (US2-3); con favoritos, una tarjeta por favorito en el orden del
  servidor, cada una con ", en favoritos" y el realizado con "Realizado" (US2-1/2); tocar una abre
  `/explorar/<eventoId>` (US2-4); desmarcar en el detalle y volver → la lista se vuelve a pedir y
  ya no lo trae (US2-5); el header dice "Mis favoritos" y tiene atrás.
- [ ] T032 [US2] Implementar `MisFavoritos` (`SegunConsulta` con `useFavoritos()`, `ListaVacia`
  con la acción "Ir a Explorar" → `router.navigate("/")`, como en `MisCompras`, `TarjetaEvento` con `esFavorito` y el
  `onPress` al detalle por la ruta tipada, `useRefrescarAlFocalizar` de `src/componentes`) y dejar
  la ruta y el `Stack.Screen` definitivos; verde T031 y `npm run typecheck -w mobile` (rutas
  tipadas).
- [ ] T033 [US2] Test en `mobile/tests/pantallas/perfil.test.tsx` y cambio en
  `mobile/src/features/sesion/pantallas/Perfil.tsx`: botón "Mis favoritos" (`Boton` del tema)
  encima de "Cambiar usuario" que abre `/favoritos` con `router.push` por la ruta tipada, sin
  importar `eventos`; la barra inferior sigue con Explorar · Mis compras · Mis eventos · Perfil
  (`mobile/tests/pantallas/navegacion.test.tsx` sin cambios); verde.
- [ ] T034 [US2] Test en `mobile/tests/pantallas/editar-evento.test.tsx` (o
  `evento-propio.test.tsx`, donde ya se prueba eliminar) y cambio en
  `mobile/src/features/eventos/mutaciones.ts`: tras eliminar un evento, `useEliminarEvento`
  invalida por prefijo `["favoritos"]` (los de todos los usuarios de la caché: se vuelve a pedir
  `GET /usuarios/actual/favoritos`), además de lo que ya invalidaba; verde.

**Checkpoint**: MVP completo (US1 + US2) de punta a punta.

---

## Phase 9: User Story 3 — Estrellas indicadoras en las listas (app) (Priority: P2)

**Goal**: la estrella en Explorar, Mis eventos y Mis compras para los eventos favoritos del usuario
actual, sin cambiar el catálogo ni tapar las listas con estados propios de los favoritos.

**Independent Test**: con favoritos registrados, cada lista muestra la estrella y ", en favoritos"
solo en esos eventos; con `GET /usuarios/actual/favoritos` fallando, las listas se ven igual y sin
estrellas.

- [ ] T035 [US3] Test en `mobile/tests/pantallas/explorar.test.tsx`: las tarjetas de los favoritos
  tienen ", en favoritos" y las demás no (US3-1); tocar una tarjeta favorita abre el detalle (US3-4);
  con la consulta de favoritos cargando o fallando, el catálogo se ve igual, sin estrellas y sin
  cargando ni error propio (US3-7); el pedido del catálogo es el mismo (ruta, query y sin depender de
  los favoritos) para dos usuarios distintos (US3-6, FR-013); marcar en el detalle y volver muestra
  la estrella **sin** volver a pedir el catálogo (FR-018). Implementar en
  `mobile/src/features/eventos/pantallas/Explorar.tsx`: `useIdsDeFavoritos()` una vez y
  `esFavorito={ids.has(evento.id)}` en cada `TarjetaEvento`; verde.
- [ ] T036 [P] [US3] Test en `mobile/tests/pantallas/mis-eventos.test.tsx` y cambios en
  `mobile/src/features/eventos/componentes/FilaEvento.tsx` (prop `esFavorito?: boolean`,
  `MarcaFavorito` en la esquina y ", en favoritos" en la etiqueta) y
  `mobile/src/features/eventos/pantallas/MisEventos.tsx` (`useIdsDeFavoritos()` una vez): un evento
  propio favorito tiene la estrella y el sufijo, los demás no (US3-3); tocar la fila sigue abriendo
  el hub; el hub (`HubDelEvento`) **no** tiene estrella para marcar; verde.
- [ ] T037 [P] [US3] Test en `mobile/tests/pantallas/mis-compras.test.tsx` y cambios en
  `FilaMiCompra` (`mobile/src/features/compras/componentes/FilaMiCompra.tsx`: prop
  `esFavorito?: boolean`, `MarcaFavorito` importada del `index.ts` de `eventos`, dentro del
  `Pressable`, y ", en favoritos" en su etiqueta) y
  `mobile/src/features/compras/pantallas/MisCompras.tsx` (`useIdsDeFavoritos()` del `index.ts` de
  `eventos`, `esFavorito={ids.has(compra.evento.id)}`): **todas** las compras de un evento favorito
  tienen la estrella y las demás no (US3-2); tocar la fila abre "Tu compra" y "Pagar" sigue como
  hermano; con los favoritos fallando, la lista se ve igual; Compras del evento, Registrar ingreso
  y "Ver mis entradas" **no** suman estrella (FR-015); verde y `npm run lint -w mobile` (sin
  ciclos: `compras → eventos`, nunca al revés).

**Checkpoint**: las cuatro historias completas.

---

## Phase 10: Polish & cierre

**Purpose**: documentación, backlog y verificación final.

- [ ] T038 [P] Actualizar `AGENTS.md`: en el mapa del backend, el recurso `usuarios` con
  `GET`/`PUT`/`DELETE /usuarios/actual/favoritos[/:eventoId]` (orden de rechazos, `204`
  idempotentes, sin 409), `Usuario.tieneFavorito/marcarFavorito/desmarcarFavorito` y la invariante,
  `RepositorioUsuarios.guardar`/`listarPorFavorito`, el cerrojo único compartido con `UsuarioService`
  (claves `usuario:<id>`; los ids de eventos nunca empiezan así), `EventoService.marcarFavorito/desmarcarFavorito/favoritosDe`
  y `#tarjetasDelCatalogo`, la limpieza al eliminar después del cerrojo del evento,
  `ordenDeMisEventos` con desempate nombre → id y el seed de favoritos (Diego, Valentina, Sofía;
  Lucía y Martín sin); en mobile, `claves.favoritos`, las funciones de `src/api/usuarios.ts`,
  `useEnvioUnico`/`useRefrescarAlFocalizar` en la base, `useFavoritos`/`useIdsDeFavoritos`/
  `useCambiarFavorito`, `EstrellaFavorito`, `MarcaFavorito` (`TarjetaEvento`, `FilaEvento`,
  `FilaMiCompra`), la ruta `favoritos` y `MisFavoritos`, el botón de Perfil, la invalidación de
  `["favoritos"]` en `useEliminarEvento` y que el helper responde `[]` a los favoritos.
- [ ] T039 [P] Marcar la 014 en `docs/backlog.md` con su estado y el enlace a `specs/014-favoritos/`.
- [ ] T040 Suite completa en verde (`npm test`, `npm run lint`, `npm run typecheck`,
  `npm run format:check`) y recorrido de `specs/014-favoritos/quickstart.md` (los `curl` de la API
  con `npm start` y, si se puede, la tabla de la app con Expo Go); anotar en el PR lo que no se
  pudo probar a mano.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)** → **Foundational backend (2)** → **US1 backend (3)** → **US2 backend (4)** →
  **US4 seed (5)**.
- **Foundational app (6)** depende del contrato de la API (fases 3–5 cerradas, para que el seed y
  los ejemplos coincidan) pero no de su código: los tests de mobile usan `fetch` falso.
- **US1 app (7)** y **US2 app (8)** dependen de la fase 6. La 8 usa `TarjetaEvento` con
  `esFavorito` (T030) y la refresca el desmarcar de la 7 (T031 usa la estrella del detalle).
- **US3 app (9)** depende de T030 (`MarcaFavorito`) y de la fase 6.
- **Polish (10)** al final.

### User Story Dependencies

- **US1 (P1)**: backend fase 3, app fase 7. Independiente.
- **US2 (P1)**: backend fase 4 (usa `marcar` de US1 para armar los casos de API), app fase 8.
- **US3 (P2)**: solo app (fase 9); usa la consulta de la fase 6 y `MarcaFavorito` de la 8.
- **US4 (P3)**: solo seed (fase 5); los tests de la app no dependen de él.

### Within Each Phase

- Test (con stub) → ver rojo → implementar → verde → siguiente tarea.
- Dominio → repositorio → service → controller/rutas → OpenAPI.
- En la app: api/clave/hook → componente → pantalla → integración en las listas.

## Parallel Opportunities

- Fase 2: T004 (`evento.ts`) y T005 (repositorio) en paralelo, después de T002–T003 o junto a ellas
  (archivos distintos).
- Fase 6: T022 (`src/api`) y T023 (`claves`) en paralelo; T024 (mover hooks) y T025 (helper) no
  chocan con ellas.
- Fase 8: T030 (tarjeta) en paralelo con el comienzo de T031, con cuidado: las dos tocan
  `mobile/src/features/eventos/index.ts` (exports de `MarcaFavorito` y `MisFavoritos`); se suma un
  export después del otro, no a la vez.
- Fase 9: T036 (Mis eventos) y T037 (Mis compras) en paralelo; T035 toca `Explorar.tsx`.
- Fase 10: T038 y T039 en paralelo.

### Parallel Example: Phase 9 (US3)

```text
Task: "T036 [US3] Estrella en Mis eventos: FilaEvento + MisEventos + mis-eventos.test.tsx"
Task: "T037 [US3] Estrella en Mis compras: FilaMiCompra + MisCompras + mis-compras.test.tsx"
```

## Implementation Strategy

### MVP (US1 + US2)

1. Fases 1–4: backend de marcar, desmarcar, la lista y la limpieza.
2. Fases 6–8: base de la app, la estrella del detalle y "Mis favoritos" desde Perfil.
3. **Validar**: marcar desde el detalle y encontrarlo en "Mis favoritos" (SC-001).

### Incremental Delivery

1. MVP → demo con un usuario marcando y viendo su lista.
2. Fase 5 (US4): la demo arranca con favoritos.
3. Fase 9 (US3): las estrellas en Explorar, Mis eventos y Mis compras.
4. Fase 10: documentación y PR a `development`.

### Implement por fases

`/speckit-implement` de a una fase (`/speckit-implement fase N`), con `/clear` entre fases; cada
fase cierra con la suite completa en verde, sus tareas marcadas en este archivo y su commit.

## Notes

- [P] = archivo distinto y sin dependencias pendientes.
- Las tareas triviales (stubs, re-exports de `app/`, `Stack.Screen`) van dentro de la tarea de test
  que las necesita.
- Si un test de otra pantalla se rompe por la consulta de favoritos nueva, el arreglo va en el
  helper (T025), no en cada test.
