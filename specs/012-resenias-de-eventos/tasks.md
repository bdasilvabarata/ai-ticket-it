---

description: "Tareas de implementación de la feature 012 — Reseñas de eventos"
---

# Tasks: Reseñas de eventos

**Input**: documentos de diseño en `specs/012-resenias-de-eventos/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md),
[contracts/app.md](./contracts/app.md), [quickstart.md](./quickstart.md)

**Tests**: obligatorios (constitución II, research R12): cada regla con su borde en `domain`
(puntuación 0, 1, 5, 6 y 4,5; comentario `""`, solo espacios, 500 y 501; "1 de 3"; dos compras
`UTILIZADA`; cada estado no `UTILIZADA`; organizador; repetida), `repositories`, `services` (reloj
fijo, repositorios armados por caso y espiados para contar lecturas y `guardar`), concurrencia (dos
reseñas a la vez → una) y `api`; en mobile, `api/`, `formato` y las pantallas con
`renderConDependencias` y `porRuta`.

**Organización**: una fase por historia, en el orden de la spec (US1 P1, US2 P2, US3 P3). La
`Resenia` ampliada, sus reglas puras, el repositorio, los métodos nuevos de `ReseniaService` y las
vistas de reseñas del backend van en Foundational porque los usan US1 y US2. El alta, los campos
`resenia`/`puedeReseniar` de la compra y la pantalla "Reseñar evento" con sus accesos llegan en la
US1; el endpoint "Reseñas del organizador", el seed con reseñas y la sección del detalle, en la US2;
el puntaje real en el catálogo (verificación sobre el seed y el refresco tras reseñar), en la US3.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: puede hacerse en paralelo (archivo distinto, sin dependencias pendientes).
- **[Story]**: historia a la que pertenece (US1–US3).
- Rutas relativas a la raíz del repo.

## Convenciones para todas las tareas

- **Test primero con stub en el mismo turno** (AGENTS.md, "TDD con stub"): el hook `Stop` exige
  typecheck y lint en verde al cerrar cada turno. Cada tarea "Test" crea **en el mismo turno** los
  módulos o miembros que importa como **stub con la firma real** que lanza
  `new Error("no implementado")` (un componente que devuelve `null`; una ruta de `app/` con su
  re-export de una línea). Se corre el test con `test:foco` (o `test:afectados -w backend`), **se lo
  ve fallar** por comportamiento y recién después se implementa.
- Endpoints: skill **`nuevo-endpoint`**. Pantallas, hooks y funciones de `src/api/`: skill
  **`nueva-pantalla`**.
- Backend en capas: `domain/` puro (sin Express, sin `errors/`, sin reloj: `ahora` llega como
  argumento); los 409 son `ReglaDeNegocioError` del dominio y el 404, `EventoNoEncontradoError` de
  `EventoService.obtenerOFallar`. **Sin** services, controllers ni routers nuevos (plan, principio
  IX): el alta va en `CompraController` y la lista en `EventoController`, las dos rutas en
  `eventos.routes.ts`. `ReseniaService` sigue **sin depender de otros services**; la única
  dependencia nueva es `CompraService → ReseniaService` (R2), y `EventoService → ReseniaService` ya
  existe (sin ciclo).
- **Reseñar** (R2, R3): `CompraService.reseniar(eventoId, usuarioId, datos)` adentro de
  `cerrojo.ejecutar(eventoId, …)`: leer `ahora` → `eventoService.obtenerOFallar(eventoId)` (404) →
  `compras.listarPorEventoYComprador(eventoId, usuarioId)` → `exigirQuePuedeReseniar` (409 propio
  evento → 409 sin compra utilizada) → `reseniaService.registrar(...)` (409 repetida; guarda). **No**
  llama a `obtenerAlDia` ni guarda compras ni eventos (FR-007). `registrar` no toma el cerrojo.
  Cerrojo liberado en `finally`, sin anidar.
- Orden de rechazos del alta (R4, contracts/api.md): `401 USUARIO_NO_IDENTIFICADO → 400
  ENTRADA_INVALIDA (params.eventoId, body.puntuacion, body.comentario) → 404 EVENTO_NO_ENCONTRADO →
  409 RESENIA_PROPIO_EVENTO → 409 SIN_COMPRA_UTILIZADA → 409 RESENIA_REPETIDA`. Mensajes al pie de la
  letra: "No podés reseñar un evento que organizás.", "Solo podés reseñar un evento al que asististe
  (con una compra utilizada).", "Ya reseñaste este evento.", "Debe ser un entero de 1 a 5.", "Es
  obligatorio." y "Debe tener como máximo 500 caracteres.".
- **No hay `PUT`, `PATCH` ni `DELETE` de reseñas** (FR-006b), ni `eliminarPorId` en el repositorio.
- `GET /eventos/:eventoId/resenias-del-organizador` es **público** (sin `requerirUsuario`), sin
  cerrojo ni reloj, con cuatro lecturas fijas (R7). La lista no expone el id del autor, compras,
  códigos, totales ni estados (FR-016).
- Textos de la app: los de contracts/app.md (son los que buscan los tests). La app **no valida**:
  muestra el 400 junto a cada campo y el `mensaje` del 409 en `AvisoDeFormulario`.
- Mobile: la pantalla, el selector, la sección de la compra y la mutation viven en
  `features/compras`; `Puntuacion`, la sección del detalle, `FilaResenia` y su consulta, en
  `features/eventos`. `compras` importa de `eventos` **solo por su `index.ts`**; `eventos` nunca
  importa `compras`. Afuera de las features solo cambian `src/api/resenias.ts` (+ `index.ts`),
  `src/consultas/claves.ts`, `src/navegacion/LayoutRaiz.tsx` y la ruta nueva de `app/`. Imports
  relativos sin alias `@/`; todo `fetch` en `src/api/`; estilos con `StyleSheet` y valores del
  `tema`; textos con `...tema.tipografia.<estilo>` (nunca `fontWeight`). Las escrituras no se
  reintentan solas.
- Prohibidos `any`, `@ts-ignore` y `eslint-disable` sin descripción (principio IX).
- Commits: Conventional Commits con scope `012-resenias-de-eventos`, uno por tarea o grupo
  coherente. Cada fase cierra con la suite completa en verde (`npm test`, `npm run lint`,
  `npm run typecheck`, `npm run format:check`), sus tareas marcadas y su commit.

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: el estado del backlog y los tipos compartidos nuevos (aditivos: todavía no los usa
nadie).

- [X] T001 [P] En `docs/backlog.md`, pasar la 012 de `plan` a `tasks`.
- [X] T002 [P] Crear `shared/src/resenia.ts` con el contenido de data-model.md ("Vistas") al pie de la letra, con JSDoc: `LIMITES_RESENIA = { puntuacionMinima: 1, puntuacionMaxima: 5, comentarioLargoMaximo: 500 } as const`; `DatosResenia { puntuacion: number; comentario?: string }`; `ReseniaVista { id; eventoId; puntuacion; comentario: string | null; creadaEn: string /* ISO UTC */; creadaEnLocal: string /* "YYYY-MM-DDTHH:mm", Buenos Aires */ }`; `ReseniaDelOrganizadorVista { id; puntuacion; comentario: string | null; autor: { nombre; apellido } /* sin id (FR-016) */; evento: { id; nombre }; creadaEn; creadaEnLocal }`; `ReseniasDelOrganizadorVista { organizador: OrganizadorVista; resenias: ReseniaDelOrganizadorVista[] }` (reusar el `OrganizadorVista` existente de `shared/`). Exportarlos desde `shared/src/index.ts` (`LIMITES_RESENIA` como valor; el resto como tipos). En `backend/tests/domain/tipos-compartidos.test.ts`, sumar que `LIMITES_RESENIA` vale `{ puntuacionMinima: 1, puntuacionMaxima: 5, comentarioLargoMaximo: 500 }`. `npm run typecheck` en verde en los tres paquetes.

---

## Phase 2: Foundational (prerequisitos bloqueantes)

**Purpose**: la `Resenia` con comentario y fecha, sus reglas puras y su orden, el repositorio con
alta, los métodos nuevos de `ReseniaService` y las vistas de reseñas del backend. Ningún endpoint ni
pantalla todavía.

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

### Dominio

- [X] T003 Test en `backend/tests/domain/resenia.test.ts` + stubs en `backend/src/domain/resenia.ts`: `PropiedadesResenia` suma `comentario: string | null` y `creadaEn: Date`; campos `readonly comentario: string | null` y `readonly creadaEn: Date`; `static crear({ id, compradorId, eventoId, puntuacion, comentario }: { …; comentario: string | null }, ahora: Date): Resenia`. Casos (data-model "Resenia"): puntuación 1 y 5 se aceptan; 0, 6 y 4,5 dan `DatosInvalidosError` con detalle en `puntuacion` "Debe ser un entero de 1 a 5."; comentario `null` y de 1 y de exactamente **500** caracteres se aceptan; de **501**, `""`, solo espacios y **sin recortar** (`" hola "`) se rechazan en el constructor con detalle en `comentario` (regla: `null` o `comentario === comentario.trim()` con largo de 1 a `LIMITES_RESENIA.comentarioLargoMaximo`); `creadaEn` inválida (`new Date(NaN)`) da detalle en `creadaEn`; varios problemas a la vez, un detalle por campo; es inmutable (`Object.freeze`; `creadaEn` se copia). `Resenia.crear` recorta el comentario, pasa `""`/solo espacios a `null` y fija `creadaEn = ahora`. No hay métodos de edición. Actualizar el JSDoc de la clase (ya no es "mínima"; el campo es `comentario`, no `detalle`: R1). Actualizar los usos existentes de `new Resenia(...)` en los tests de la 005 (`resenia.test.ts`, `resenia.service.test.ts`, `evento.service.test.ts`, helpers) para pasar `comentario` y `creadaEn`. Luego implementar con `domain/invariantes.ts` y los límites de `shared/`.
- [X] T004 Test en `backend/tests/domain/resenia.test.ts` + stubs en `backend/src/domain/resenia.ts` de las funciones puras (data-model "Funciones puras", R4, R8): `exigirQuePuedeReseniar({ usuarioId, evento, compras }: { usuarioId: string; evento: Evento; compras: readonly Compra[] }): void`, `exigirQueNoReseniO(existente: Resenia | null): void` y `compararResenias(a: Resenia, b: Resenia): number`. Casos: el organizador (`evento.esOrganizadoPor(usuarioId)`) → `ReglaDeNegocioError` `RESENIA_PROPIO_EVENTO` **aunque** tuviera compras; sin compras, o con solo `PENDIENTE`, `PENDIENTE` vencida, `CONFIRMADA`, `CANCELADA` (por el comprador y por vencimiento) o `REEMBOLSADA` → `SIN_COMPRA_UTILIZADA` (un test por estado); una `UTILIZADA` con **1 de 3** entradas usadas alcanza; dos compras `UTILIZADA` alcanzan; una `UTILIZADA` más una `CANCELADA` alcanza; con un evento **no realizado** (la ventana abierta) también alcanza (no se mira `realizado`); `exigirQueNoReseniO(null)` no lanza y con una reseña lanza `RESENIA_REPETIDA`; `compararResenias` ordena por `creadaEn` **descendente** y, con la misma fecha, por `id` ascendente. Mensajes de contracts/api.md al pie de la letra. Usar `compra.estado === EstadoCompra.UTILIZADA` (010; sin contar entradas). Luego implementar.

### Repositorio y service

- [X] T005 [P] Test en `backend/tests/repositories/resenia.repository.test.ts` + stubs en `backend/src/domain/repositorios.ts` (`RepositorioResenias` suma `siguienteId(): string`, `buscarPorEventoYComprador(eventoId: string, compradorId: string): Promise<Resenia | null>`, `listarPorComprador(compradorId: string): Promise<Resenia[]>` y `guardar(resenia: Resenia): Promise<void>`) y en `backend/src/repositories/resenia.repository.ts` (R9). Casos: `siguienteId` da UUIDs distintos; `guardar` agrega y reemplaza por id; `buscarPorEventoYComprador` encuentra la del par exacto y da `null` con otro evento u otro comprador; `listarPorComprador` trae las de todos los eventos de ese autor (y `[]` sin ninguna); `listarPorEventos` sigue igual; el `Map` es privado (lo que devuelve no lo expone). Si `backend/tests/repositories/repositorios.test.ts` verifica los puertos de forma genérica, sumar el nuevo. Sin `eliminarPorId`. Luego implementar (UUID con `randomUUID` como los demás repositorios).
- [X] T006 Test en `backend/tests/services/resenia.service.test.ts` + stubs en `backend/src/services/resenia.service.ts` (data-model "ReseniaService"): `registrar(datos: { eventoId: string; compradorId: string; puntuacion: number; comentario: string | null }, ahora: Date): Promise<Resenia>`, `deCompradorEnEvento(compradorId: string, eventoId: string): Promise<Resenia | null>`, `deComprador(compradorId: string): Promise<Map<string, Resenia>>` (clave `eventoId`) y `listarDeEventos(eventos: readonly Evento[]): Promise<Resenia[]>`. Casos (repositorio en memoria armado por caso y **espiado**): `registrar` guarda **una** reseña con el id de `siguienteId()`, el comentario recortado (`"  x  "` → `"x"`, `""` → `null`) y `creadaEn = ahora`, y la devuelve; con una existente del mismo comprador y evento lanza `RESENIA_REPETIDA` y no guarda; la de **otro** evento del mismo comprador no la bloquea; `deCompradorEnEvento` hace una lectura; `deComprador` hace **una** lectura y arma el `Map` por evento; `listarDeEventos` hace **una** `listarPorEventos` y devuelve en el orden de `compararResenias`; `puntajesPorOrganizador` y `puntajeDe` no cambian (tests de la 005 en verde). `ReseniaService` sigue recibiendo solo `{ resenias }`. Actualizar el JSDoc (ya no "mínimo"; `registrar` se usa **dentro del cerrojo del que llama**). Luego implementar.

### Vistas del backend

- [X] T007 [P] Test `backend/tests/services/resenia.vistas.test.ts` (nuevo) + stub `backend/src/services/resenia.vistas.ts` con `aReseniaVista(resenia: Resenia): ReseniaVista`, `aReseniaDelOrganizadorVista(resenia: Resenia, autor: Usuario, evento: Evento): ReseniaDelOrganizadorVista` y `aReseniasDelOrganizadorVista(organizador: OrganizadorVista, resenias: readonly Resenia[], usuarios: Map<string, Usuario>, eventos: Map<string, Evento>): ReseniasDelOrganizadorVista`. Casos (R8): `creadaEn` ISO UTC y `creadaEnLocal` `"YYYY-MM-DDTHH:mm"` de Buenos Aires con `horaDeBuenosAires` (una reseña a las 01:30 UTC cae el día **anterior** a las 22:30 locales); `comentario` `null` se mantiene `null`; `autor` es **exactamente** `{ nombre, apellido }` (sin `id`); `evento` es `{ id, nombre }`; `resenias` en el orden recibido; las claves del JSON son **exactamente** las de `shared/src/resenia.ts` (sin `compradorId`, compras, códigos, totales ni estados: FR-016). Luego implementar.

**Checkpoint**: la reseña se crea, se valida, se guarda una vez y se muestra; suite completa en verde.

---

## Phase 3: User Story 1 — El comprador reseña un evento al que asistió (Priority: P1) 🎯 MVP

**Goal**: quien tiene una compra `UTILIZADA` reseña el evento una vez desde "Tu compra" o "Mis
compras"; después ve su reseña en lugar del botón, sin que cambie la compra ni el cupo.

**Independent Test**: con el seed, como Martín, en "Mis compras" la compra de la Peña (`UTILIZADA`,
"1 de 3") muestra "Reseñar evento"; tocarlo, elegir 4, escribir "Muy buena organización" y enviar;
la fila y "Tu compra" muestran la reseña sin el botón; del lado del servidor quedó una reseña con
la fecha del servidor y la compra, sus entradas y el cupo no cambiaron.

### Backend

- [X] T008 [US1] Test en `backend/tests/services/compra.service.test.ts` + stub `CompraService.reseniar(eventoId: string, usuarioId: string, datos: { puntuacion: number; comentario: string }): Promise<ReseniaVista>` en `backend/src/services/compra.service.ts`; `CompraService` recibe además `reseniaService: ReseniaService` en el constructor y `backend/src/app.ts` se lo pasa (ya se arma antes); actualizar `backend/tests/helpers/services-de-eventos.ts` (o donde se arme `CompraService` en los tests) para pasarlo. Casos (reloj fijo, repositorios espiados): con una compra `UTILIZADA` ("1 de 3") responde `ReseniaVista` con `creadaEn` = el reloj y el comentario recortado; `""` → `comentario: null`; **no** se llama a `compras.guardar` ni a `eventos.guardar`, y la compra (estado, historial, entradas, total, mensajes) y el cupo del evento quedan iguales (FR-007); con el evento **no realizado** y la ventana abierta también se acepta; evento inexistente → `EventoNoEncontradoError` y nada guardado; organizador → `RESENIA_PROPIO_EVENTO`; solo `CONFIRMADA` → `SIN_COMPRA_UTILIZADA`; con una reseña previa del mismo comprador → `RESENIA_REPETIDA`, y queda una sola; el orden 404 → propio evento → sin utilizada → repetida (combinaciones: organizador sin compras → propio evento); toma el cerrojo con el `eventoId` (espiar `cerrojo.ejecutar`) y lo libera también cuando falla; **no** llama a `eventoService.obtenerAlDia`. Luego implementar según "Convenciones" (respuesta con `aReseniaVista`).
- [X] T009 [US1] Campos de la compra (R6, contracts/api.md "Cambios en las vistas"): en `shared/src/compra.ts`, `CompraVista` suma `resenia: ReseniaVista | null` y `puedeReseniar: boolean` (con JSDoc; `MiCompraVista` los hereda). En `backend/src/services/compra.vistas.ts`, la pieza `reseniaDeLaCompra(compra: Compra, resenia: Resenia | null): { resenia: ReseniaVista | null; puedeReseniar: boolean }` (`resenia` solo si `compra.estado === UTILIZADA`; `puedeReseniar = UTILIZADA && resenia === null`) y `aCompraVista` / `aMiCompraVista` reciben un parámetro más `resenia: Resenia | null` y la suman; `datosComunes` y `aCompraDelEventoVista` **no** cambian. En `CompraService`: `obtener` lee `reseniaService.deCompradorEnEvento(compra.compradorId, compra.eventoId)`; `misComprasDelEvento` lo lee **una** vez (comprador y evento fijos); `misCompras` lee `reseniaService.deComprador(usuarioId)` **una** vez y busca por `eventoId`; `crear`, `pagar` y `cancelar` pasan `null`. Test primero en `backend/tests/services/compra.service.test.ts`: una `UTILIZADA` sin reseña → `resenia: null, puedeReseniar: true`; con reseña → la `ReseniaVista` y `puedeReseniar: false`; **dos** `UTILIZADA` del mismo evento muestran la misma reseña (escenario 4); una `CANCELADA` o `CONFIRMADA` del mismo evento con reseña existente → `resenia: null, puedeReseniar: false`; `PENDIENTE`, `CONFIRMADA`, `CANCELADA` y `REEMBOLSADA` → `puedeReseniar: false`; `misCompras` con N compras hace **una** lectura de reseñas (espiar `listarPorComprador`); `CompraDelEventoVista` no trae los campos. En mobile, sumar `resenia: null, puedeReseniar: false` a los fixtures de `mobile/tests/helpers/compras.ts` (y a cualquier otro que arme una `CompraVista` o `MiCompraVista`) más un helper `reseniaDeEjemplo(parcial?)`. `npm run typecheck` en verde en los tres paquetes.
- [X] T010 [US1] Validación, controller y ruta (skill `nuevo-endpoint`): `backend/src/validations/resenia.validation.ts` (nuevo) con `reseniaNueva = crearValidacion({ params: z.object({ eventoId: idSchema }), body: z.object({ puntuacion: z.number({ error: obligatorio(MENSAJE) }).int(MENSAJE).min(LIMITES_RESENIA.puntuacionMinima, MENSAJE).max(LIMITES_RESENIA.puntuacionMaxima, MENSAJE), comentario: textoOpcional(LIMITES_RESENIA.comentarioLargoMaximo) }) })` con `MENSAJE = "Debe ser un entero de 1 a 5."` (si falta, "Es obligatorio."; confirmar con el test cuál da `obligatorio`) y las claves desconocidas descartadas (R5); en `backend/src/controllers/compra.controller.ts`, `reseniar` (`201`, usuario de `X-Usuario-Id`; el service pasa `""` a `null`); en `backend/src/routes/eventos.routes.ts`, `router.post("/:eventoId/resenias", requerirUsuario, reseniaNueva.middleware, compraController.reseniar)` con su comentario (como `POST /:eventoId/compras`). Test primero en `backend/tests/api/resenias.test.ts` (nuevo, supertest con `crearApp()` y el seed), en el orden de contracts/api.md: Martín `POST /api/eventos/evento-pena-en-la-rueda/resenias` con `{ "puntuacion": 4, "comentario": "  Muy buena organización  " }` → `201` con `comentario` recortado, `eventoId` y `creadaEn` del reloj fijo; claves extra (`compradorId`, `creadaEn`, `id`) se ignoran; después, `GET /api/compras/compra-martin-pena-general` trae `resenia` y `puedeReseniar: false`, y el evento muestra el mismo cupo antes y después; sin `X-Usuario-Id` y con usuario inexistente → `401`; `eventoId` inválido → `400` en `params.eventoId`; `puntuacion` ausente, `"4"`, `4.5`, `0` y `6` → `400` en `body.puntuacion`; `comentario` de 501 (y de 500 con espacios alrededor → `201`), número → `400` en `body.comentario`; solo espacios → `201` con `comentario: null`; `evento-no-existe` → `404 EVENTO_NO_ENCONTRADO`; Lucía (organizadora) → `409 RESENIA_PROPIO_EVENTO`; Sofía (`compra-sofia-pena-con-cena`, no `UTILIZADA`) → `409 SIN_COMPRA_UTILIZADA`; Martín de nuevo → `409 RESENIA_REPETIDA`; combinaciones (sin usuario + puntuación inválida → 401; puntuación inválida + evento inexistente → 400); `PUT`, `PATCH` y `DELETE` sobre `/api/eventos/evento-pena-en-la-rueda/resenias` → `404 RUTA_NO_ENCONTRADA` (FR-006b). En `backend/tests/api/compras.test.ts`, `GET /compras`, `GET /compras/:id` y `GET /eventos/:eventoId/mis-compras` traen los dos campos.
- [X] T011 [US1] Test en `backend/tests/services/concurrencia-compras.test.ts` (patrón de los tests de concurrencia de 006–011): dos `reseniar` simultáneos (`Promise.all`) del mismo comprador y evento → uno responde `ReseniaVista` y el otro rechaza con `RESENIA_REPETIDA`; queda **una** reseña en el repositorio; reseñas de **dos compradores** distintos del mismo evento a la vez → las dos se guardan; reseña ‖ `registrarUso` de otra entrada de la misma compra → los dos efectos se conservan. Corregir `CompraService.reseniar` si alguno falla (todo adentro del cerrojo, releyendo la reseña).
- [X] T012 [P] [US1] OpenAPI y Postman (alta): en `backend/src/docs/openapi.json`, el path `/eventos/{eventoId}/resenias` con `post` (cuerpo `DatosResenia`, `201 ReseniaVista`, 400, 401, 404, 409) y los esquemas `DatosResenia` (`puntuacion` `integer` `minimum: 1` `maximum: 5`, requerida; `comentario` `maxLength: 500`) y `ReseniaVista`; `CompraVista` y `MiCompraVista` suman `resenia` (`ReseniaVista` nullable) y `puedeReseniar`. En `backend/src/docs/ai-ticket-it.postman_collection.json`, "Reseñar evento (Martín, Peña)", "Reseñar de nuevo → 409", "Reseñar como organizadora → 409" y "Puntuación 6 → 400". `test:foco -w backend -- tests/api/docs.test.ts` en verde.

### Mobile

- [X] T013 [P] [US1] Test `mobile/tests/api/resenias.test.ts` (nuevo) + stub `mobile/src/api/resenias.ts` (exportado por `mobile/src/api/index.ts`): `reseniarEvento(cliente, eventoId, datos: DatosResenia, { usuarioId })` → `cliente.post<ReseniaVista>(\`/eventos/${eventoId}/resenias\`, datos, { usuarioId })`. Casos con `crearFetchFalso`: método `POST`, ruta, cuerpo `{ puntuacion, comentario }` y `X-Usuario-Id`. Luego implementar.
- [X] T014 [P] [US1] Textos y `Puntuacion`: test en `mobile/tests/features/eventos/formato.test.ts` + stub en `mobile/src/features/eventos/formato.ts` de `textoPuntuacion(puntuacion: number): string` → "Puntuación: 4 de 5"; test en `mobile/tests/features/compras/formato.test.ts` + stub en `mobile/src/features/compras/formato.ts` de `textoAvisoResenia(compra: CompraVista): string | null` → "Ya reseñaste este evento" con `resenia`, "Solo podés reseñar un evento al que asististe." sin `resenia` y sin `puedeReseniar`, `null` con `puedeReseniar`. Crear `mobile/src/features/eventos/componentes/Puntuacion.tsx` (solo lectura: cinco marcas, las llenas distinguibles por forma y no solo por color, un único elemento accesible con `accessibilityLabel = textoPuntuacion(n)`; valores del `tema`). Exportar desde `mobile/src/features/eventos/index.ts`: `Puntuacion`, `textoPuntuacion`, `useConfirmarDescarte` y lo de `errores-de-formulario.ts` que use el formulario (`erroresDeFormulario` ampliado con el formulario `"resenia"` —campos `puntuacion` y `comentario`— y `SIN_ERRORES`, con su test en `mobile/tests/features/eventos/errores-de-formulario.test.ts`). Luego implementar.
- [X] T015 [US1] Test `mobile/tests/pantallas/reseniar-evento.test.tsx` (nuevo, `renderConDependencias` + `porRuta`) + stubs: `useReseniarEvento(usuarioId, eventoId)` en `mobile/src/features/compras/mutaciones.ts`, `SelectorPuntuacion` en `mobile/src/features/compras/componentes/SelectorPuntuacion.tsx`, la pantalla `ReseniarEvento` en `mobile/src/features/compras/pantallas/ReseniarEvento.tsx` (exportada por `mobile/src/features/compras/index.ts`), la ruta `mobile/app/compras/[compraId]/resenia.tsx` (`export { ReseniarEvento as default } from "../../../src/features/compras";`) y en `mobile/src/navegacion/LayoutRaiz.tsx` `Stack.Screen name="compras/[compraId]/resenia"` con el título "Reseñar evento", en la misma fase de la sesión que `compras/[compraId]/index` y `/chat`. Casos (contracts/app.md "Pantalla"): con la compra `UTILIZADA` y `puedeReseniar` (`GET /compras/:id`), muestra el nombre del evento, cinco `radio` "1 de 5" … "5 de 5" **sin ninguno elegido** (`accessibilityState.checked: false`), el campo "Comentario (opcional)" con `maxLength` 500 y "Enviar"; tocar "4 de 5" lo marca `checked`; escribir y "Enviar" manda `POST /eventos/<eventoId>/resenias` con `{ "puntuacion": 4, "comentario": "…" }` (sin recortar) y `X-Usuario-Id`, y vuelve atrás; **doble toque** en "Enviar" → un solo `POST`; "Enviar" sin puntuación manda el pedido igual (la app no valida) y un `400` con `body.puntuacion` muestra el mensaje junto al selector y conserva el comentario; un `400` en `body.comentario` va junto al campo; un `409` muestra su `mensaje` en `AvisoDeFormulario` y conserva lo escrito; sin servidor, error de conexión, no se reintenta solo ni sale; volver atrás con una puntuación elegida o texto → "¿Descartar los cambios?"; sin cambios sale directo; con `resenia` (pantalla desactualizada) muestra "Ya reseñaste este evento" y la reseña propia, sin formulario; con una compra no `UTILIZADA`, "Solo podés reseñar un evento al que asististe." sin formulario; un `403`/`404` al leer la compra lo muestra `AvisoDeLaCompra`. Sumar en `mobile/tests/tipos/rutas-tipadas.ts` un `@ts-expect-error` para `{ pathname: "/compras/[compraId]/resenia" }` sin `compraId` y una válida con el parámetro.
- [X] T016 [US1] Implementar para que T015 pase: `useReseniarEvento` (en nombre de `usuarioId`, `retry: false`; en `onSettled`, o solo al terminar con éxito, invalida **por prefijo** `["compra"]`, `["mis-compras"]`, `["mis-compras-del-evento"]`, `["evento"]`, `["catalogo"]` y `["resenias-del-organizador"]`: R11); `SelectorPuntuacion` (fila de cinco `Pressable` con `accessibilityRole="radio"`, `accessibilityLabel` "N de 5", `accessibilityState={{ checked }}`; el elegido con relleno **y** marca, no solo color; tamaño táctil del `tema`, cabe en 360 px; el `MensajeDeCampo` de `body.puntuacion` debajo); `ReseniarEvento` (`useSesion()`, `useCompra`, `SegunConsulta`, `PantallaDesplazable`, `CampoDeTexto` multilínea de `eventos`, `Boton` "Enviar" / "Enviando…" con `useEnvioUnico`, errores con `erroresDeFormulario(error, "resenia")`, `useConfirmarDescarte({ hayCambios: puntuacion !== null || comentario.trim() !== "" })` y, con éxito, `salirSinConfirmar(() => router.back())`).
- [X] T017 [US1] Accesos. Test en `mobile/tests/pantallas/compra.test.tsx`: con `puedeReseniar`, "Tu compra" muestra `Boton` "Reseñar evento" después de las entradas, que navega a `/compras/[compraId]/resenia`; con `resenia`, "Tu reseña" con `Puntuacion` ("Puntuación: 4 de 5") y el comentario (sin comentario, **sin** texto de relleno) y sin el botón; en `PENDIENTE`, `CONFIRMADA`, `CANCELADA` y `REEMBOLSADA`, ninguna de las dos. Test en `mobile/tests/pantallas/mis-compras.test.tsx`: lo mismo en `FilaMiCompra`, con "Reseñar evento" como elemento accesible **hermano** del `Pressable` de los datos de la fila (no adentro, como "Pagar": FR-012) y la reseña propia dentro de la etiqueta accesible de la fila; de punta a punta: tocar "Reseñar evento", elegir 4, enviar → vuelve a "Mis compras", que se vuelve a pedir y muestra la reseña sin el botón. Luego implementar `mobile/src/features/compras/componentes/ReseniaDeLaCompra.tsx` (botón o reseña según el servidor), usarla en `mobile/src/features/compras/pantallas/Compra.tsx` y en `mobile/src/features/compras/componentes/FilaMiCompra.tsx`, con `router.push({ pathname: "/compras/[compraId]/resenia", params: { compraId } })`.

**Checkpoint**: el comprador reseña desde "Tu compra" y "Mis compras" (MVP); suite completa en verde.

---

## Phase 4: User Story 2 — Ver las reseñas del organizador en el detalle (Priority: P2)

**Goal**: el detalle público de todo evento muestra "Reseñas del organizador" con el puntaje (igual
al de la tarjeta), la cantidad y todas las reseñas de sus eventos, de la más reciente a la más
vieja; sin reseñas, "Todavía no tiene reseñas".

**Independent Test**: con el seed, abrir "Hamlet" (Martín): "4,7 · 3 reseñas" y las tres de "Jazz en
el Patio" ordenadas, con autor, evento y fecha; abrir "Noche de Rock" (Lucía): "Todavía no tiene
reseñas", sin puntaje.

### Backend

- [X] T018 [US2] Seed (R10, data-model "Seed"). Test primero en `backend/tests/domain/datos-ejemplo.test.ts`: "Jazz en el Patio" (Martín, −10 días) tiene compras `UTILIZADA` de una entrada de Lucía, Diego y Valentina (`compra-<autor>-jazz-en-el-patio-general`) con el uso dentro de la ventana, y reseñas 5, 4 y 5 (`resenia-<autor>-jazz-en-el-patio`); "Stand-up: Noche de risas" (Sofía, −3 días), compras `UTILIZADA` de Diego y Valentina y reseñas 3 (con comentario) y 2 (**sin** comentario); cada reseña cumple las reglas (`exigirQuePuedeReseniar` pasa con las compras del autor; una por autor y evento), tiene `creadaEn` posterior al uso y anterior al arranque, y todas las fechas son distintas; Lucía no tiene reseñas; `compra-martin-pena-general` sigue `UTILIZADA` "1 de 3" y **sin** reseña; los cupos de Jazz (60) y Stand-up (80) descuentan las entradas nuevas; los códigos de entrada nuevos son fijos y únicos; las demos de 007 a 011 no cambian (tests existentes del seed en verde). Luego implementar en `backend/src/seed/datos-ejemplo.ts` (con las fechas calculadas desde el arranque como las demás) y pasar las reseñas a `new ReseniaRepository([...])` en `backend/src/seed/repositorios-de-ejemplo.ts`; ajustar `backend/tests/repositories/repositorios-de-ejemplo.test.ts` si cuenta compras o reseñas.
- [X] T019 [US2] Test en `backend/tests/services/evento.service.test.ts` + stub `EventoService.reseniasDelOrganizador(eventoId: string): Promise<ReseniasDelOrganizadorVista>` en `backend/src/services/evento.service.ts` (R7, data-model "EventoService"). Casos (repositorios espiados): evento inexistente → `EventoNoEncontradoError`; devuelve las reseñas de **todos** los eventos del organizador (próximos y realizados, también el que se mira) y no las de otros organizadores, en el orden de `compararResenias`, con autor y evento de cada una; `organizador.puntaje` sin redondear y `cantidadResenias === resenias.length`, **iguales** a los de `obtener(eventoId).organizador` (FR-018); sin reseñas, `puntaje: null`, `cantidadResenias: 0`, `resenias: []`; exactamente **cuatro** lecturas fijas con 0 y con 3 reseñas (`obtenerOFallar`, `listarPorOrganizador`, `listarDeEventos`, **una** `usuarioService.obtenerPorIds` con el organizador y los autores); no toma el cerrojo ni guarda. Luego implementar con `aReseniasDelOrganizadorVista` y `calcularPuntaje` sobre esas reseñas (reusar lo que arma `#organizadorVista` sin una lectura extra).
- [X] T020 [US2] Controller y ruta: en `backend/src/controllers/evento.controller.ts`, `reseniasDelOrganizador` (`200`); en `backend/src/routes/eventos.routes.ts`, `router.get("/:eventoId/resenias-del-organizador", eventoPorId.middleware, controller.reseniasDelOrganizador)` **sin** `requerirUsuario`, con su comentario. Test primero en `backend/tests/api/resenias.test.ts`: sin `X-Usuario-Id` → `200`; con cualquier usuario, la misma respuesta; para "Hamlet" (Martín), `puntaje ≈ 4.6667`, 3 reseñas de Jazz en orden y `autor` sin `id`; para "Noche de Rock" (Lucía), `puntaje: null` y `[]`; el `puntaje` coincide con `GET /api/eventos/:id` y con la tarjeta de `GET /api/eventos`; el JSON no contiene `compradorId` ni códigos de entrada; `eventoId` inválido → `400`; inexistente → `404`; después de que Martín reseña la Peña, los eventos de Lucía pasan a `puntaje: 4`, `cantidadResenias: 1` y la reseña aparece primera; después de cada rechazo de T010, la respuesta no cambia.
- [X] T021 [P] [US2] OpenAPI y Postman (lista): en `backend/src/docs/openapi.json`, el path `/eventos/{eventoId}/resenias-del-organizador` con `get` público (`200 ReseniasDelOrganizadorVista`, 400, 404) y los esquemas `ReseniaDelOrganizadorVista` y `ReseniasDelOrganizadorVista`; en la colección Postman, "Reseñas del organizador (Hamlet)" y "Reseñas del organizador sin reseñas (Noche de Rock)". `test:foco -w backend -- tests/api/docs.test.ts` en verde.

### Mobile

- [X] T022 [P] [US2] Test en `mobile/tests/api/resenias.test.ts` + stub en `mobile/src/api/resenias.ts`: `obtenerReseniasDelOrganizador(cliente, eventoId, { signal })` → `cliente.get<ReseniasDelOrganizadorVista>(\`/eventos/${eventoId}/resenias-del-organizador\`, { signal })`. Sumar en `mobile/src/consultas/claves.ts` `reseniasDelOrganizador(usuarioId, eventoId)` → `["resenias-del-organizador", usuarioId, eventoId]` (usuario en la posición 1; sin prefijo común con `["evento"]`). En `mobile/tests/helpers/` (`renderConDependencias`), que un `GET /eventos/:id/resenias-del-organizador` no registrado responda vacío (`{ organizador, puntaje: null, cantidadResenias: 0, resenias: [] }` con el organizador del evento o uno genérico), como ya hace con `mis-compras`, para que los tests existentes del detalle sigan en verde; sumar el helper `reseniasDelOrganizadorDeEjemplo(parcial?)`.
- [X] T023 [P] [US2] Test en `mobile/tests/features/eventos/formato.test.ts` + stubs en `mobile/src/features/eventos/formato.ts`: `textoFechaResenia(creadaEnLocal: string): string` (el día, con el formato de fechas de la app, sin hora), `etiquetaDeResenia(resenia: ReseniaDelOrganizadorVista): string` ("Valentina Gómez, Jazz en el Patio, <día>: Puntuación: 5 de 5. <comentario>"; sin comentario, sin el texto final) y la constante `SIN_RESENIAS = "Todavía no tiene reseñas"`. Luego implementar.
- [X] T024 [US2] Test en `mobile/tests/pantallas/detalle-evento.test.tsx` + stubs `useReseniasDelOrganizador(usuarioId, eventoId)` en `mobile/src/features/eventos/useReseniasDelOrganizador.ts`, `ReseniasDelOrganizador` y `FilaResenia` en `mobile/src/features/eventos/componentes/` (no exportados por el `index.ts`). Casos (contracts/app.md "Sección"): al final del detalle, el título "Reseñas del organizador" (`accessibilityRole="header"`); con reseñas, `textoPuntaje` igual al de la tarjeta ("4,7 · 3 reseñas") y una fila por reseña en el orden del servidor con `Puntuacion`, el comentario (sin comentario, nada en su lugar), "Valentina Gómez", "Jazz en el Patio" y el día; cada fila es **un** elemento accesible con `etiquetaDeResenia`; sin reseñas, "Todavía no tiene reseñas" **sin** puntaje (ni "0", ni "Sin reseñas"); mientras carga la sección, el resto del detalle ya se ve; un error de la sección muestra el error y "Reintentar" **solo en la sección**, con los tipos de entrada a la vista; el propio organizador ve la misma sección; se pide `GET /eventos/<id>/resenias-del-organizador`. Luego implementar con `SegunConsulta` (`vacio` propio) y `tema`, y sumar `<ReseniasDelOrganizador eventoId={…} />` al final de `mobile/src/features/eventos/pantallas/DetalleEvento.tsx` (también se ve en `DetalleEventoConCompras`, que lo monta).

**Checkpoint**: cualquiera ve las reseñas del organizador en el detalle; suite completa en verde.

---

## Phase 5: User Story 3 — El puntaje del organizador con reseñas reales (Priority: P3)

**Goal**: el catálogo muestra el promedio real y ordena por puntaje de verdad; después de una
reseña, el puntaje se pone al día en el catálogo, el detalle y la sección.

**Independent Test**: con el seed, "Mejor puntaje primero" deja Martín → Sofía → Lucía (distinto del
orden por fecha); cada tarjeta, "4,7 · 3 reseñas", "2,5 · 2 reseñas" o "Sin reseñas".

- [ ] T025 [US3] Test en `backend/tests/api/eventos.test.ts` (o `domain/datos-ejemplo.test.ts`), sobre el seed: `GET /api/eventos?orden=puntaje&sentido=desc` (los nombres de parámetros de la 005) deja primero los eventos de Martín, después los de Sofía y al final los de Lucía y los demás organizadores sin reseñas; ese orden es distinto del de `orden=fecha` (SC-005); cada `organizador` trae el `puntaje` y la `cantidadResenias` de R10. Debería pasar con el seed de T018; si no, corregir el seed (no el cálculo de la 005: FR-017).
- [ ] T026 [US3] Test en `mobile/tests/pantallas/reseniar-evento.test.tsx` (o `catalogo-actualizado.test.tsx`): después de reseñar, al volver a Explorar se vuelve a pedir el catálogo (invalidado `["catalogo"]`) y la tarjeta del organizador muestra el puntaje nuevo; al abrir el detalle de otro evento del mismo organizador se vuelven a pedir el evento y `resenias-del-organizador`, y la reseña aparece primera (SC-006, FR-011); cambiar de usuario y abrir el detalle no reusa la sección del anterior (la clave lleva el usuario). Implementar lo que falte en `useReseniarEvento`.

**Checkpoint**: UC-11 (orden por puntaje) completo con datos reales; suite completa en verde.

---

## Phase 6: Polish y documentación

**Purpose**: documentación, validación de punta a punta y cierre de la feature.

- [ ] T027 Revisión manual de 360 px y TalkBack: `SelectorPuntuacion` (cinco botones sin desborde horizontal, tamaño táctil), `FilaResenia` y `ReseniaDeLaCompra` (comentarios largos con `flexShrink`), el botón hermano en `FilaMiCompra`; solo valores del `tema`. Anotar en el commit y en el PR lo verificado (no hay test automático de layout).
- [ ] T028 [P] Actualizar `AGENTS.md`: en `shared/`, `shared/src/resenia.ts` (`LIMITES_RESENIA`, `DatosResenia`, las tres vistas) y los campos `resenia`/`puedeReseniar` de `CompraVista`; en "Recursos", `resenias` deja de ser mínimo: `POST /eventos/:eventoId/resenias` (orden 401 → 400 → 404 → 409 `RESENIA_PROPIO_EVENTO` → `SIN_COMPRA_UTILIZADA` → `RESENIA_REPETIDA`, bajo el cerrojo del evento, sin tocar compra ni cupo, sin `PUT`/`PATCH`/`DELETE`) y `GET /eventos/:eventoId/resenias-del-organizador` (público, cuatro lecturas); `Resenia` con `comentario` y `creadaEn`, `Resenia.crear`, `exigirQuePuedeReseniar`, `exigirQueNoReseniO`, `compararResenias`; `RepositorioResenias` ampliado; `ReseniaService.registrar` (dentro del cerrojo del que llama), `deCompradorEnEvento`, `deComprador`, `listarDeEventos`; `CompraService.reseniar` y la dependencia `CompraService → ReseniaService` (y el orden de `app.ts`); `EventoService.reseniasDelOrganizador`; `services/resenia.vistas.ts` y `reseniaDeLaCompra`; el seed con las reseñas de Jazz y Stand-up y la Peña sin reseñar; en mobile, la ruta `compras/[compraId]/resenia` (`ReseniarEvento`, `SelectorPuntuacion`, `ReseniaDeLaCompra`), `useReseniarEvento` y lo que invalida, la clave `reseniasDelOrganizador`, `useReseniasDelOrganizador`, `ReseniasDelOrganizador`/`FilaResenia` al final de `DetalleEvento`, `Puntuacion` y los nuevos exports de `eventos/index.ts`, y el vacío por defecto de `resenias-del-organizador` en `renderConDependencias`.
- [ ] T029 [P] En `docs/backlog.md`, pasar la 012 a `implement` (y a `PR` al abrirlo). Opcional (R1): PATCH de la constitución para llamar `comentario` al "detalle" de la reseña, con su entrada en el historial de versiones.
- [ ] T030 Validar [quickstart.md](./quickstart.md): los escenarios 1 a 4 contra `npm start` (incluidos los rechazos con Postman o `curl`, y que la sección no cambia después de cada uno) y Swagger en `/api/docs`; el escenario 5 y los pasos de la app en el celular con Expo Go (los que no se puedan hacer, anotarlos en el PR).
- [ ] T031 Suite completa en verde desde la raíz: `npm test`, `npm run lint`, `npm run typecheck` y `npm run format:check`; commit y PR a `development` con el resumen de la feature.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T002 bloquea todo lo que usa los tipos nuevos.
- **Foundational (Phase 2)**: depende de T002. T003 → T004 (mismo archivo); T005 en paralelo con
  T003/T004 (solo depende de la firma de `Resenia`); T006 depende de T003–T005; T007 depende de T003.
  Bloquea todas las historias.
- **US1 (Phase 3)**: depende de Foundational. T008 → T009 (mismo service) → T010 (el API usa los dos)
  → T011; T012, T013 y T014 en paralelo con T008–T011; T015 depende de T009 (campos de la compra en
  mobile), T013 y T014; T015 → T016 → T017.
- **US2 (Phase 4)**: depende de Foundational; el backend es independiente de la US1 salvo el último
  caso de T020 (después de reseñar, que usa T010). T018 → T020 (el API usa el seed); T019 → T020;
  T021, T022 y T023 en paralelo; T022/T023 → T024.
- **US3 (Phase 5)**: depende del seed (T018) y, para T026, de la US1 (pantalla y mutation) y la US2
  (sección).
- **Polish (Phase 6)**: depende de todas las historias.

### User Story Dependencies

- **US1 (P1)**: la fuente de los datos; prueba independiente con la Peña de Martín del seed actual.
- **US2 (P2)**: sección y endpoint propios; con el seed de T018 se prueba sin la US1.
- **US3 (P3)**: sin pantallas nuevas; verifica el seed en el catálogo y el refresco tras la US1.

### Within Each User Story

- Test con stub de firma real → verlo fallar → implementar → `test:foco` en verde.
- Dominio → repositorio → service → vistas → validación/controller/rutas → OpenAPI → app (api →
  claves → formato → hooks → pantalla → accesos).

### Parallel Opportunities

- T001 y T002.
- T005 y T007 en paralelo con T003/T004 una vez definida la firma de `Resenia`.
- En la US1: T012 (docs), T013 (api mobile) y T014 (formato y `Puntuacion`) mientras se hacen
  T008–T011.
- En la US2: T021 (docs), T022 (api mobile y helper) y T023 (formato) en paralelo con T018–T020.
- T028 y T029.

---

## Parallel Example: User Story 1

```bash
# Mientras se hace el backend (T008 → T009 → T010 → T011), en paralelo:
Task: "T012 OpenAPI y Postman de POST /eventos/{eventoId}/resenias en backend/src/docs/"
Task: "T013 reseniarEvento en mobile/src/api/resenias.ts"
Task: "T014 textoPuntuacion, textoAvisoResenia y Puntuacion en mobile/src/features/eventos/ y compras/formato.ts"

# Después, en orden:
Task: "T015 Test y stubs de ReseniarEvento + ruta compras/[compraId]/resenia"
Task: "T016 Implementar ReseniarEvento, SelectorPuntuacion y useReseniarEvento"
Task: "T017 ReseniaDeLaCompra en Compra.tsx y FilaMiCompra.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (Setup) y Phase 2 (Foundational).
2. Phase 3 (US1): el comprador reseña desde "Tu compra" y "Mis compras".
3. **Parar y validar**: quickstart escenarios 3 y 4 (Martín reseña la Peña; rechazos por API).

### Incremental Delivery

1. US1 → reseñar (MVP).
2. US2 → seed con reseñas y "Reseñas del organizador" en el detalle.
3. US3 → puntaje real y orden por puntaje en el catálogo, al día después de reseñar.
4. Polish → revisión de 360 px, AGENTS.md, backlog, quickstart y PR.

Cada fase se corre con `/speckit-implement fase N` y contexto limpio entre fases (`/clear`); cierra
con la suite completa en verde, sus tareas marcadas en este archivo y su commit.

---

## Notes

- [P] = archivo distinto y sin dependencias pendientes.
- US1 y US2 suman casos a los mismos archivos (`resenias.test.ts` del API, `resenias.test.ts` de
  mobile, `formato.test.ts` de `eventos`): por eso esas tareas no llevan [P] entre historias.
- Si una tarea "Debería pasar con …" pasa de entrada, igual se deja el test: documenta la regla
  (principio II).
