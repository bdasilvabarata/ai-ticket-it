---

description: "Tareas de implementación de la feature 013 — Paginación"
---

# Tasks: Paginación

**Input**: documentos de diseño en `specs/013-paginacion/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md),
[contracts/app.md](./contracts/app.md), [quickstart.md](./quickstart.md)

**Tests**: obligatorios (constitución II, research R12): `paginar` con 0, 1, 10, 11 y 25 elementos y
las páginas 1, la última, la última + 1 y 99, más la concatenación de todas (SC-002); `pagina`
ausente, `"2"`, `"0"`, `"-1"`, `"1.5"`, `"abc"`, `""` y repetida; `estado` inválido y
`sinResponder=si`; `tamano` ignorado; `filtrarComprasDelEvento` por cada estado, por `sinResponder`
y por los dos juntos; services con repositorios armados por caso y espiados para contar lecturas
(solo la página); seed; en mobile, `botonesDelPaginador` de 1 a 20 páginas con todas las actuales y
SC-004, `Paginador`, `usePagina`, `src/api/` y las pantallas con `renderConDependencias` y `porRuta`.

**Organización**: la paginación común del **servidor** (`paginar`, `paginaSchema`, los tipos de
`shared/`) va en Setup y Foundational porque la usan las tres listas. El **paginador común** de la
app es la US2 (P1) y va **antes** que la US1 (P1), porque Explorar lo usa; las dos juntas son el
MVP. Después, Compras del evento (US3, P2), el resumen de 3 reseñas en el detalle (US4, P3) y "Ver
todas las reseñas" (US5, P3). Cada historia suma su parte del seed (R11).

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: puede hacerse en paralelo (archivo distinto, sin dependencias pendientes).
- **[Story]**: historia a la que pertenece (US1–US5).
- Rutas relativas a la raíz del repo.

## Convenciones para todas las tareas

- **Test primero con stub en el mismo turno** (AGENTS.md, "TDD con stub"): el hook `Stop` exige
  typecheck y lint en verde al cerrar cada turno. Cada tarea "Test" crea **en el mismo turno** los
  módulos o miembros que importa como **stub con la firma real** que lanza
  `new Error("no implementado")` (un componente que devuelve `null`; una ruta de `app/` con su
  re-export de una línea). Se corre el test con `test:foco` (o `test:afectados -w backend`), **se lo
  ve fallar** por comportamiento y recién después se implementa.
- **Un campo nuevo obligatorio en una vista de `shared/`** (`CatalogoVista.pagina`,
  `ComprasDelEventoVista.pagina` y `cantidadCompras`) rompe el typecheck de todo lo que arma esa
  vista: la tarea que lo agrega actualiza **en el mismo turno** el service del backend (con el
  stub/valor provisorio que haga falta) y los helpers de mobile (`mobile/tests/helpers/eventos.ts`,
  `mobile/tests/helpers/compras.ts`, `mobile/tests/helpers/render-con-dependencias.tsx`) con una
  `pagina` de ejemplo coherente.
- Endpoints: skill **`nuevo-endpoint`**. Pantallas, hooks, componentes y funciones de `src/api/`:
  skill **`nueva-pantalla`**.
- Backend en capas: `paginar` y `filtrarComprasDelEvento` son **puras**, en `domain/`. Los services
  ordenan, filtran y cortan; **los repositorios no cambian**. Los 404/403 siguen en sus dueños
  (`EventoService.obtenerOFallar`, `EventoService.leerDelOrganizador`). **Sin** services,
  controllers ni routers nuevos: la ruta `/resumen` va en `EventoController` y en
  `eventos.routes.ts`. Las tres listas son **lecturas**: sin cerrojo y sin guardar.
- Paginación (R1, contracts/api.md): `LIMITES_PAGINACION.tamanoDePagina` = 10, fijo; la app no lo
  manda y un `tamano`/`limite` en la query se descarta. Página posterior a la última → la última,
  con su número real en `pagina.numero`; lista vacía →
  `{ numero: 1, tamano: 10, totalElementos: 0, totalPaginas: 0 }`. Cada respuesta **conserva** el
  nombre de su lista (`eventos`, `compras`, `resenias`) y **suma** `pagina`.
- Mensajes al pie de la letra: `query.pagina` → "Debe ser un entero mayor o igual a 1.";
  `query.estado` → "Debe ser uno de los estados de una compra."; `query.sinResponder` → "Debe ser
  true o false.".
- Textos de la app: los de contracts/app.md ("Página N", "Ver todas las reseñas", "Cargando
  compras…", "Cargando reseñas…", "Reseñas del organizador", los vacíos existentes). El paginador
  **no** tiene "…" ni botones anterior/siguiente (R6).
- Mobile: `Paginador`, `botonesDelPaginador` y `usePagina` viven en la **base**
  (`src/componentes/`, exportados por su `index.ts`); la sección y la pantalla de reseñas, en
  `features/eventos`; Compras del evento, en `features/compras`. `eventos` nunca importa `compras`.
  Imports relativos sin alias `@/`; todo `fetch` en `src/api/`; estilos con `StyleSheet` y valores
  del `tema` (sin tokens nuevos); textos con `...tema.tipografia.<estilo>` (nunca `fontWeight`).
- "Mis compras" (`GET /compras`, pestaña `MisCompras`) **no cambia** (FR-023).
- Prohibidos `any`, `@ts-ignore` y `eslint-disable` sin descripción (principio IX).
- Commits: Conventional Commits con scope `013-paginacion`, uno por tarea o grupo coherente. Cada
  fase cierra con la suite completa en verde (`npm test`, `npm run lint`, `npm run typecheck`,
  `npm run format:check`), sus tareas marcadas y su commit.

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: el estado del backlog y los tipos compartidos nuevos que todavía no rompen a nadie (los
campos obligatorios en vistas existentes llegan con cada historia).

- [X] T001 [P] En `docs/backlog.md`, pasar la 013 de `plan` a `tasks`.
- [X] T002 [P] Crear `shared/src/paginacion.ts` con el contenido de data-model.md ("Página") al pie de la letra, con JSDoc: `export const LIMITES_PAGINACION = { tamanoDePagina: 10, reseniasEnElDetalle: 3 } as const;` y `export interface PaginaVista { numero: number; tamano: number; totalElementos: number; totalPaginas: number }` ("`numero`: la página entregada, desde 1: la pedida o, si no existe, la última (FR-005)"; "`tamano`: siempre `LIMITES_PAGINACION.tamanoDePagina`"; "`totalElementos`: de la lista completa, con los filtros aplicados"; "`totalPaginas`: `ceil(totalElementos / tamano)`; 0 con la lista vacía"). En `shared/src/evento.ts`, sumar `pagina?: number` a `ConsultaCatalogo`. En `shared/src/compra.ts`, sumar `export interface ConsultaComprasDelEvento { pagina?: number; estado?: EstadoCompra; sinResponder?: boolean }`. En `shared/src/resenia.ts`, sumar `export interface PaginaDeReseniasVista extends ReseniasDelOrganizadorVista { pagina: PaginaVista }` y actualizar el JSDoc de `ReseniasDelOrganizadorVista` ("`GET …/resenias-del-organizador/resumen`: la forma de la 012, con las 3 más recientes"; `resenias`: "hasta `LIMITES_PAGINACION.reseniasEnElDetalle`, de la más reciente a la más vieja"). Exportar todo desde `shared/src/index.ts` (`LIMITES_PAGINACION` como valor; el resto como tipos). En `backend/tests/domain/tipos-compartidos.test.ts`, sumar que `LIMITES_PAGINACION` vale `{ tamanoDePagina: 10, reseniasEnElDetalle: 3 }`. `npm run typecheck` en verde en los tres paquetes.

---

## Phase 2: Foundational (paginación común del servidor)

**Purpose**: la función pura que corta una lista y el esquema común de `?pagina` (FR-001 a FR-006).
Ningún endpoint ni pantalla todavía.

**⚠️ CRITICAL**: ninguna historia del backend empieza antes de terminar esta fase (la US2, solo de
mobile, puede empezar en paralelo).

- [X] T003 Test de `paginar` en `backend/tests/domain/paginacion.test.ts` con stub de `paginar<T>(elementos: readonly T[], numeroPedido: number): { elementos: T[]; pagina: PaginaVista }` en `backend/src/domain/paginacion.ts` (puro: sin Express, sin `errors/`, sin reloj). Casos (R12): 0 elementos con la página 1 y la 5 → `elementos: []` y `{ numero: 1, tamano: 10, totalElementos: 0, totalPaginas: 0 }`; 1 elemento → 1 página; 10 → 1 página con los 10; 11 → 2 páginas, la 2 con 1 elemento; 25 → 3 páginas (10, 10, 5); la página 3 de 25 → los elementos 21–25; la última + 1 y la 99 → la última, con su `numero` real (FR-005); `tamano` siempre 10; concatenar las páginas 1…`totalPaginas` da la lista original en su orden (SC-002); no muta el arreglo recibido. Verlo fallar.
- [X] T004 Implementar `paginar` en `backend/src/domain/paginacion.ts` (R1): `totalPaginas = Math.ceil(total / LIMITES_PAGINACION.tamanoDePagina)`; `numero = Math.min(numeroPedido, Math.max(totalPaginas, 1))`; `elementos = elementos.slice((numero − 1) · 10, numero · 10)`. JSDoc: la lista llega **ya filtrada y ordenada** por el que llama (FR-003). `test:foco` de T003 en verde.
- [X] T005 `paginaSchema` en `backend/src/validations/comunes.ts` (R2), con test en `backend/tests/api/validacion.test.ts` (sobre el esquema con `safeParse` y sobre una app mínima con `crearValidacion({ query: z.object({ pagina: paginaSchema }) })`, como los casos existentes): ausente → `1`; `"2"` → `2`; `"0"`, `"-1"`, `"1.5"`, `"abc"`, `""`, `"1e1"`, un número que no es entero seguro y repetida (`?pagina=1&pagina=2`, que llega como arreglo) → 400 `ENTRADA_INVALIDA` con el detalle `{ campo: "query.pagina", mensaje: "Debe ser un entero mayor o igual a 1." }`. Regex de dígitos sin signo (no `z.coerce.number()`, que acepta `""` y `"1e1"`). Test primero con stub, verlo fallar, implementar.

**Checkpoint**: `paginar` y `paginaSchema` listos para las tres listas.

---

## Phase 3: User Story 2 - El paginador común (Priority: P1) 🎯 MVP (parte 1)

**Goal**: un único `Paginador` en la base de la app, con la regla de los 5 botones, accesible y con
la página actual distinguible sin color (FR-007 a FR-011).

**Independent Test**: con distintas combinaciones de total de páginas y página actual, verificar
los botones (`1 2 3 4 10`, `1 5 6 7 10`, `1 7 8 9 10`, `1 2 3`, nada con 1 página), "Página N" con
la actual `selected`, y que tocar la actual no llama a `alCambiar` (tests de componentes, sin
pantallas).

- [X] T006 [P] [US2] Test de `botonesDelPaginador` en `mobile/tests/componentes/botones-del-paginador.test.ts` con stub de `botonesDelPaginador(totalPaginas: number, actual: number): number[]` en `mobile/src/componentes/botones-del-paginador.ts` (no `paginador.ts`: en Windows choca con `Paginador.tsx`, R6). Casos: los ejemplos de la spec con 10 páginas (actual 1 y 2 → `[1, 2, 3, 4, 10]`; 4 → `[1, 3, 4, 5, 10]`; 6 → `[1, 5, 6, 7, 10]`; 9 y 10 → `[1, 7, 8, 9, 10]`), 3 páginas → `[1, 2, 3]`, 5 → `[1, 2, 3, 4, 5]`, 6 páginas con cada actual; y un recorrido de **todos** los totales de 1 a 20 con **todas** las actuales: a lo sumo 5 botones, todos si el total es ≤ 5, siempre incluye 1, el total, la actual y la anterior/siguiente cuando existen, ascendente y sin repetidos (SC-003). SC-004: con 10 páginas, toda página se alcanza desde la 1 en ≤ 3 toques eligiendo cada vez un botón visible (búsqueda en anchura sobre `botonesDelPaginador`). Verlo fallar.
- [X] T007 [US2] Implementar `botonesDelPaginador` en `mobile/src/componentes/botones-del-paginador.ts` (R6): con ≤ 5 páginas, todas; si no, la ventana `[actual − 1, actual + 1]` recortada a `[1, total]` más la 1 y la última, y mientras haya menos de 5 la ventana crece hacia adentro (hacia la última si toca la 1, hacia la 1 si toca la última). Exportarla por `mobile/src/componentes/index.ts`. `test:foco` de T006 en verde.
- [X] T008 [P] [US2] Test de `Paginador` en `mobile/tests/componentes/paginador-componente.test.tsx` (RNTL) con stub de `Paginador({ pagina, alCambiar }: { pagina: PaginaVista; alCambiar: (numero: number) => void })` en `mobile/src/componentes/Paginador.tsx` (devuelve `null`). Casos (contracts/app.md, "Paginador"): con `totalPaginas` 0 y 1 no dibuja nada (FR-010); con 3 páginas, tres botones con `accessibilityRole="button"` y `accessibilityLabel` "Página 1", "Página 2", "Página 3"; con 10 páginas y `numero: 6`, los botones `1 5 6 7 10`; la actual con `accessibilityState={{ selected: true }}` y **sin** `disabled`, las demás con `selected: false`; tocar otra llama a `alCambiar(N)` una vez; tocar la actual **no** llama a `alCambiar` (FR-011, US2-8); la actual sale de `pagina.numero` (la respuesta). Verlo fallar.
- [X] T009 [US2] Implementar `Paginador` en `mobile/src/componentes/Paginador.tsx` (R6): un `Pressable` por botón de `botonesDelPaginador`, en fila, centrados, con toque mínimo `tema.tamano` y que entren 5 en 360 px; la actual con relleno `resaltado`, `texto` encima, sombra dura `nivel1` y el número en Archivo Black; las demás sobre `superficie`, el mismo borde, sin sombra y en Archivo (la actual se distingue sin color, FR-009); solo valores del `tema`, sin tokens nuevos; usar `hundido` al presionar si el patrón de `Boton` lo usa. Exportarlo por `mobile/src/componentes/index.ts`. `test:foco` de T008 en verde.
- [X] T010 [P] [US2] `usePagina(criterio: string): [numero: number, cambiar: (numero: number) => void]` en `mobile/src/componentes/usePagina.ts` (R7), con test en `mobile/tests/componentes/usePagina.test.tsx` (`renderHook`): empieza en 1; `cambiar(3)` → 3; al cambiar el `criterio` devuelve 1 en el **mismo render** (estado derivado de `{ criterio, numero }`, sin `useEffect`); volver a cambiar la página con el criterio nuevo funciona; con el mismo criterio conserva la página entre renders. Exportarlo por `mobile/src/componentes/index.ts`. Test primero con stub, verlo fallar, implementar.
- [X] T011 [P] [US2] Prop opcional `volverArribaCon?: unknown` en `mobile/src/componentes/PantallaDesplazable.tsx` (R9): cuando su valor cambia (no en el primer render) hace `scrollTo({ y: 0, animated: false })` con la `ref` interna, el mismo mecanismo que `empezarAlFinal`. Test en `mobile/tests/componentes/pantalla-desplazable.test.tsx`: al cambiar el valor se llama a `scrollTo` con `y: 0`; sin la prop, ni al montar, no se llama; las pantallas que no la pasan no cambian. Test primero, verlo fallar, implementar.

**Checkpoint**: el paginador común existe y está probado; todavía ninguna pantalla lo usa.

---

## Phase 4: User Story 1 - Explorar el catálogo por páginas (Priority: P1) 🎯 MVP (parte 2)

**Goal**: el catálogo llega de a 10 (con búsqueda, categoría y orden sobre todos los eventos antes
de cortar), con el `Paginador` al pie de Explorar y vuelta a la página 1 al cambiar cualquier
criterio (FR-012 a FR-014).

**Independent Test**: con el seed (12 próximos), abrir Explorar: 10 tarjetas y `1 2` con el 1
marcado; tocar 2 → las 2 restantes en el mismo orden; escribir una búsqueda → página 1 (sin
paginador si entra en una); `GET /api/eventos?pagina=2` y `?orden=puntaje` como en quickstart.

### Backend

- [X] T012 [US1] Tests del catálogo paginado en `backend/tests/api/eventos.test.ts` (sección `GET /api/eventos`) y `backend/tests/services/evento.service.test.ts`. En `shared/src/evento.ts`, sumar `pagina: PaginaVista` (obligatorio) a `CatalogoVista` (JSDoc de data-model.md: `eventos` "la página pedida del catálogo filtrado y ordenado (hasta 10)"; `hayEventosProximos` "sin cambios: sobre todos los eventos próximos, antes del texto, la categoría y la página (FR-014)"), con `EventoService.listar` devolviendo provisoriamente todos y la `pagina` de `paginar(…, 1)` para que compile, y los helpers de mobile (`mobile/tests/helpers/eventos.ts`, el catálogo por defecto de `mobile/tests/helpers/render-con-dependencias.tsx`) con una `pagina` coherente (lista vacía: `{ numero: 1, tamano: 10, totalElementos: 0, totalPaginas: 0 }`). Casos de API con repositorios armados con más de 10 eventos próximos: sin `pagina` → los 10 primeros y `pagina` `{ numero: 1, tamano: 10, totalElementos: N, totalPaginas }`; `?pagina=2` → los que siguen, en el orden de la lista completa; concatenar las páginas = la lista sin paginar (SC-002); `?pagina=9` → la última con su `numero`; `?pagina=0` y `?pagina=abc` → 400 `query.pagina`; `?tamano=50` → se ignora (10); con `orden=puntaje&sentido=desc` el evento del mejor organizador está en la página 1 aunque su fecha lo pondría al final (US1-4); `?texto=zzz` → `eventos: []`, `totalPaginas: 0`, `numero: 1` y `hayEventosProximos: true` (FR-014); el filtro por `categoriaId` y `texto` se aplica antes de cortar. Caso de service: el cupo al día, las categorías y los organizadores se piden **solo para los eventos de la página** (espiar `listarPendientesPorEventos`/`cupoLiberadoPorTipo`, `categoriaService.obtenerPorIds` y `usuarioService.obtenerPorIds`: reciben a lo sumo 10 ids) y el número de lecturas es fijo. Verlo fallar.
- [X] T013 [US1] Implementar en el backend (R3): `consultaCatalogo` en `backend/src/validations/evento.validation.ts` suma `pagina: paginaSchema`; `EventoService.listar(consulta)` en `backend/src/services/evento.service.ts`: (1) igual que hoy, la categoría referenciada (400), los eventos, `hayEventosProximos` sobre todos los próximos y el filtro por texto y categoría; (2) los puntajes de los organizadores de **todos** los coincidentes y `ordenarCatalogo` sobre todos; (3) `paginar(ordenados, consulta.pagina)`; (4) solo para la página: `#conCupoAlDia`, categorías y organizadores en lote y `aEventoCatalogoVista`; responde `{ eventos, pagina, hayEventosProximos }`. El controller de `backend/src/controllers/evento.controller.ts` pasa la `pagina` validada. `test:foco` de T012 en verde; los tests existentes del catálogo (005, 012) siguen en verde.
- [X] T014 [US1] Seed (R11, FR-024): en `backend/src/seed/datos-ejemplo.ts`, 5 eventos próximos nuevos con ids fijos `evento-<slug>`, de organizadores y categorías variados, fechas repartidas en las próximas semanas (relativas al arranque como los existentes), tipos de entrada con cupo y **sin compras**; los ids existentes no cambian. En `backend/tests/domain/datos-ejemplo.test.ts`: el catálogo sin filtros tiene **12** eventos no realizados (2 páginas: 10 + 2) y los nuevos cumplen las reglas existentes. En `backend/tests/api/eventos.test.ts`, con `crearApp()` por defecto: `GET /api/eventos` → 10 eventos y `totalElementos: 12, totalPaginas: 2`; `?pagina=2` → 2. Ajustar los tests existentes que contaban los eventos del seed.
- [X] T015 [P] [US1] OpenAPI y Postman del catálogo: en `backend/src/docs/openapi.json`, el parámetro compartido `pagina` (`components/parameters`, entero ≥ 1, por defecto 1) y el esquema `PaginaVista` (`components/schemas`), usados en `GET /eventos`, y `pagina` en `CatalogoVista`; en `backend/src/docs/ai-ticket-it.postman_collection.json`, "Explorar — página 2" (`GET {{baseUrl}}/eventos?pagina=2`). `backend/tests/api/docs.test.ts` en verde.

### Mobile

- [X] T016 [US1] `listarEventos(cliente, { …, pagina })` en `mobile/src/api/eventos.ts` agrega `pagina` a la query **solo si es distinta de 1** (las URLs de la página 1 de la 005 siguen iguales), con casos en `mobile/tests/api/eventos.test.ts` (`pagina: 2` → `?…&pagina=2`; `pagina: 1` o ausente → sin `pagina`). `ClaveCatalogo` en `mobile/src/consultas/claves.ts` suma `pagina: number` (sin usuario, como en la 005; `["catalogo"]` sigue siendo el prefijo). `useCatalogo` en `mobile/src/features/eventos/useCatalogo.ts` recibe la página, la pone en la clave y la manda (sin `placeholderData`, R8). Test primero, verlo fallar, implementar.
- [X] T017 [US1] Test de Explorar paginado en `mobile/tests/pantallas/explorar.test.tsx` (`renderConDependencias` + `porRuta`, respuestas del catálogo por `pagina`): con 12 eventos se ven las 10 tarjetas de la página 1 y el paginador con "Página 1" `selected` y "Página 2"; tocar "Página 2" pide `GET /eventos?…&pagina=2`, muestra el skeleton ("Cargando eventos") y después las 2 tarjetas, con "Página 2" `selected`; si la respuesta trae otro `numero` (pidió 9, llega 2), se marca el de la respuesta (FR-005); estando en la 2, escribir una búsqueda (después de la demora), elegir una categoría, cambiar el orden o invertir el sentido piden la página 1 (sin `pagina` en la URL) (FR-013); con ≤ 10 resultados no hay paginador; los vacíos ("Ningún evento coincide…" y "Todavía no hay eventos próximos.") sin paginador; el buscador conserva lo escrito al cambiar de página; si la página 2 responde con un error de conexión, se ve el `MensajeError` y ningún botón "Página 2" queda `selected` (el paginador no da por hecho el cambio, Edge Cases); tocar "Página 2" y, antes de que responda, "Página 1" muestra la página 1, nunca la 2 encima (Edge Cases); estando en la 2, abrir el detalle de un evento y volver sigue en la 2 (la pestaña no se desmonta, Assumptions). Verlo fallar.
- [X] T018 [US1] Implementar en `mobile/src/features/eventos/pantallas/Explorar.tsx`: `const [pagina, cambiarPagina] = usePagina(JSON.stringify({ textoDemorado, categoriaId, orden, sentido }))` (R7), la página a `useCatalogo` y el `Paginador` (de `../../../componentes`) como `ListFooterComponent` de la `FlatList`, con la `pagina` de la respuesta y `alCambiar={cambiarPagina}` (R9); los controles siguen fuera de `SegunConsulta`. `test:foco` de T017 en verde; `catalogo-actualizado.test.tsx` y `detalle-evento.test.tsx` siguen en verde.

**Checkpoint**: MVP — el catálogo se navega por páginas con el paginador común.

---

## Phase 5: User Story 3 - Compras del evento por páginas (Priority: P2)

**Goal**: la lista de Compras del evento llega de a 10, con el filtro por estado y "Sin responder"
aplicados en el servidor antes de paginar; la ventana, el resumen, el contador y el nuevo
`cantidadCompras` son de todas las compras (FR-015 a FR-019).

**Independent Test**: como Lucía, Festival Sonidos del Sur (12 compras del seed): 10 filas y el
paginador; el contador cuenta la compra con mensaje sin responder de la página 2; "Cancelada" →
"Cargando compras…" sin tapar el resumen y después solo las canceladas; `?estado=VENCIDA` → 400.

### Backend

- [X] T019 [P] [US3] `filtrarComprasDelEvento(compras: readonly Compra[], filtro: { estado?: EstadoCompra; sinResponder: boolean }): Compra[]` en `backend/src/domain/compras-del-evento.ts` (puro, sobre compras **al día**), con casos en `backend/tests/domain/compras-del-evento.test.ts`: sin filtro → todas en el mismo orden; cada uno de los cinco estados compara `compra.estado` (una pendiente vencida ya llega como `CANCELADA`); `sinResponder: true` → las de `compra.mensajeSinResponder`; los dos juntos → la intersección (y); no muta. Test primero con stub, verlo fallar, implementar.
- [X] T020 [US3] Tests de Compras del evento paginadas en `backend/tests/api/compras.test.ts` (sección `GET /api/eventos/:eventoId/compras`) y `backend/tests/services/compra.service.test.ts`. En `shared/src/compra.ts`, sumar a `ComprasDelEventoVista` `cantidadCompras: number` ("cuántas compras tiene el evento, sin filtro (decide los chips y el vacío, FR-017)") y `pagina: PaginaVista`, con JSDoc de data-model.md; el service provisoriamente con todas y `paginar(…, 1)`, y `mobile/tests/helpers/compras.ts` con `cantidadCompras` = `compras.length` y una `pagina` coherente por defecto. Casos de API con un evento armado con más de 10 compras de varios estados y alguna con mensaje sin responder en la página 2: las 10 primeras en el orden de la 008 (`creadaEn` descendente → `id`) y `pagina` con los totales; `?pagina=2` → las restantes; `ventanaDeUso`, `resumenPorTipo`, `comprasConMensajesSinResponder` y `cantidadCompras` **iguales** en la página 1, la 2 y con cada filtro (SC-006, FR-016), y el contador cuenta la de la página 2 (US3-3); `?estado=CANCELADA` → solo esas, `pagina.totalElementos` filtrado y `cantidadCompras` sin filtrar; `?sinResponder=true` → solo las del último mensaje del comprador; los dos juntos (y); un filtro sin resultados → `compras: []`, `{ numero: 1, …, totalElementos: 0, totalPaginas: 0 }`; página posterior a la última → la última; orden de rechazos 401 `USUARIO_NO_IDENTIFICADO` → 400 (`params.eventoId`, `query.pagina`, `query.estado` "Debe ser uno de los estados de una compra.", `query.sinResponder` con `si` "Debe ser true o false.") → 404 `EVENTO_NO_ENCONTRADO` → 403 `SIN_PERMISO`; sin códigos de entradas (FR-019); `GET /eventos/:eventoId/mis-compras` **no** acepta ni exige los parámetros nuevos (sigue igual). Caso de service: los compradores se piden en lote **solo para la página** (a lo sumo 10 ids) y **ninguna** lectura de compradores con la página vacía; sin guardar ni cerrojo. Verlo fallar.
- [X] T021 [US3] Implementar (R4): en `backend/src/validations/compra.validation.ts`, una validación **nueva** `consultaComprasDelEvento = crearValidacion({ params: paramsEvento, query: z.object({ pagina: paginaSchema, estado: <enum de EstadoCompra con el mensaje "Debe ser uno de los estados de una compra.">.optional(), sinResponder: <"true" | "false" → boolean, por defecto false, mensaje "Debe ser true o false."> }) })` usada **solo** por `GET /:eventoId/compras` en `backend/src/routes/eventos.routes.ts` (`/:eventoId/mis-compras` sigue con `comprasDelEvento`, solo params); `CompraService.comprasDelEvento(eventoId, usuarioId, consulta: ConsultaComprasDelEvento validada)` en `backend/src/services/compra.service.ts`: (1) igual que hoy `leerDelOrganizador` (404 → 403) y las compras al día ordenadas con `compararComprasDelEvento`; (2) sobre **todas**: `ventanaDeUso`, `resumenPorTipo`, `comprasConMensajesSinResponder` y `cantidadCompras`; (3) `filtrarComprasDelEvento` y `paginar`; (4) los compradores en lote solo de la página (sin lectura si está vacía); el controller en `backend/src/controllers/compra.controller.ts` pasa la query validada. `test:foco` de T019/T020 en verde.
- [X] T022 [US3] Seed (R11): en `backend/src/seed/datos-ejemplo.ts`, 10 compras nuevas de **una** entrada en `evento-festival-sonidos-del-sur` (de Lucía), ids fijos `compra-<comprador>-festival-<n>`, de Diego, Sofía, Valentina y Martín sin pasar el tope de 4 pagas por persona y evento (Martín ya tiene 2 VIP); mezcla de `CONFIRMADA` y `CANCELADA` (vencidas por el sistema o canceladas después de pagar, con el reembolso pendiente), **sin `PENDIENTE`**; al menos una, con `creadaEn` que la deje **fuera de la página 1**, con un mensaje del comprador sin responder (mensajes en orden y posteriores al alta); los cupos de General y VIP descuentan las vigentes; códigos de entrada únicos; las dos compras existentes del Festival (con el chat de la 011) no cambian. En `backend/tests/domain/datos-ejemplo.test.ts`: el Festival tiene 12 compras, ninguna `PENDIENTE`, y las reglas existentes (cupo, tope, estados, códigos únicos, mensajes en orden) se cumplen. En `backend/tests/api/compras.test.ts` con `crearApp()`: como `usuario-lucia`, 10 compras, `cantidadCompras: 12`, `totalPaginas: 2`, y el contador incluye la de la página 2. Ajustar los tests existentes que contaban compras del Festival o mensajes sin responder del seed.
- [X] T023 [P] [US3] OpenAPI y Postman de Compras del evento: en `backend/src/docs/openapi.json`, `pagina` (el parámetro compartido), `estado` (enum de los cinco) y `sinResponder` (`true`/`false`) en `GET /eventos/{eventoId}/compras`, y `cantidadCompras` y `pagina` en `ComprasDelEventoVista`; en Postman, "Compras del Festival — canceladas" (`?estado=CANCELADA`, `X-Usuario-Id: usuario-lucia`). `backend/tests/api/docs.test.ts` en verde.

### Mobile

- [X] T024 [US3] API, clave y filtro: `obtenerComprasDelEvento(cliente, eventoId, { pagina, estado, sinResponder }: ConsultaComprasDelEvento, { signal, usuarioId })` en `mobile/src/api/compras.ts` agrega cada parámetro solo si tiene valor (`pagina ≠ 1`, `estado` definido, `sinResponder === true`), con casos en `mobile/tests/api/compras.test.ts`; `claves.comprasDelEvento(usuarioId, eventoId, filtroYPagina?: { filtro: string; pagina: number })` en `mobile/src/consultas/claves.ts` → `["compras-del-evento", usuarioId, eventoId, { filtro, pagina }]`, y sin el tercer argumento el prefijo de dos ids que siguen usando `useConfirmarReembolso`, `useRegistrarUso` y `useCancelarCompra` (el filtro es un `string` en la clave, **no** `FiltroDeCompras`: la base no importa la feature, regla de dependencia 2; `useComprasDelEvento` le pasa su `FiltroDeCompras`, que es asignable a `string`); en `mobile/src/features/compras/filtro-de-compras.ts`, `consultaDelFiltro(filtro: FiltroDeCompras): Pick<ConsultaComprasDelEvento, "estado" | "sinResponder">` (`"todas"` → `{}`; `"sin-responder"` → `{ sinResponder: true }`; un estado → `{ estado }`) y **eliminar** `filtrarCompras` (filtra el servidor), con `mobile/tests/features/compras/filtro-de-compras.test.ts` actualizado. Test primero, verlo fallar, implementar.
- [X] T025 [US3] Test de Compras del evento paginada en `mobile/tests/pantallas/compras-del-evento.test.tsx` (respuestas por query con `porRuta`; helpers de `mobile/tests/helpers/compras.ts`): con 12 compras, 10 filas y el paginador; tocar "Página 2" pide `?pagina=2`, muestra "Cargando compras…" **en lugar de las filas y del paginador** mientras el encabezado, la ventana de uso, el resumen por tipo, el contador y los chips siguen a la vista (`keepPreviousData`), y después las 2 filas; elegir el chip "Cancelada" estando en la 2 pide `?estado=CANCELADA` **sin** `pagina` (vuelve a la 1, FR-017) y "Sin responder" pide `?sinResponder=true`; "Todas" sin parámetros; un filtro vacío muestra su vacío ("No hay compras canceladas") sin paginador y con los chips; con `cantidadCompras: 0` no hay chips y se ve "Todavía nadie compró entradas"; después de "Confirmar reembolso" en una fila de la página 2 se vuelve a pedir la página 2 con el mismo filtro y, si llega la 1 como última, se marca la 1 (FR-005, FR-018); lo mismo al volver del chat o de "Registrar ingreso" (foco): se pide la página y el filtro en los que estaba (US3-4); con ≤ 10 compras no hay paginador; ningún test de la 008–011 que filtraba en la app se pierde (se migra al filtro del servidor). Verlo fallar.
- [X] T026 [US3] Implementar: `useComprasDelEvento(usuarioId, eventoId, filtro, pagina)` en `mobile/src/features/compras/useComprasDelEvento.ts` con la clave de T024, `consultaDelFiltro(filtro)` y `placeholderData: keepPreviousData` (R8); en `mobile/src/features/compras/pantallas/ComprasDelEvento.tsx`, `usePagina(filtro)` (R7), los chips según `vista.cantidadCompras > 0` (no `vista.compras.length`), mientras `isPlaceholderData` "Cargando compras…" en lugar de las filas y del paginador (nunca las filas viejas), las filas de `vista.compras` tal cual llegan (sin `filtrarCompras`), el `Paginador` después de la última fila dentro de la sección "Compras" y `volverArribaCon={pagina}` en `PantallaDesplazable` (R9). `test:foco` de T025 en verde; `registrar-ingreso.test.tsx` y `chat-de-la-compra.test.tsx` siguen en verde.

**Checkpoint**: Compras del evento paginada y filtrada en el servidor; US1 y US2 siguen funcionando.

---

## Phase 6: User Story 4 - Las 3 reseñas más recientes en el detalle (Priority: P3)

**Goal**: la sección "Reseñas del organizador" del detalle pide el resumen (`/resumen`): puntaje y
cantidad de todas y las 3 más recientes, con "Ver todas las reseñas" si tiene más de 3 (FR-020 a
FR-022).

**Independent Test**: detalle de un evento de Martín (11 reseñas del seed): "4,7", 11 reseñas, 3
filas (las más recientes) y "Ver todas las reseñas"; en uno de Sofía (2) sin el botón; en uno de
Lucía, "Todavía no tiene reseñas".

### Backend

- [ ] T027 [US4] Tests de `GET /api/eventos/:eventoId/resenias-del-organizador/resumen` en `backend/tests/api/resenias.test.ts` y de `EventoService.resumenDeResenias` en `backend/tests/services/evento.service.test.ts`, con stub del método y la ruta cableada a un controller stub: con más de 3 reseñas → `resenias` con las **3** más recientes (`creadaEn` descendente → `id`, de todos los eventos del organizador) y `organizador` con `puntaje` y `cantidadResenias` de **todas** (FR-021), igual al `organizador` de `GET /eventos/:eventoId` y de la tarjeta del catálogo (SC-005); con 3 o menos → todas; sin reseñas → `resenias: []`, `puntaje: null`, `cantidadResenias: 0`; público (sin `X-Usuario-Id` y con uno, igual); 400 `params.eventoId`; 404 `EVENTO_NO_ENCONTRADO`; sin id del autor, compras ni códigos; después de reseñar (`POST …/resenias`), la nueva aparece primera y la cantidad suma una (US4-4). Service: lecturas fijas y **un** `usuarioService.obtenerPorIds` con el organizador y solo los autores de las 3. Verlo fallar.
- [ ] T028 [US4] Implementar (R5): en `backend/src/services/evento.service.ts`, un `#reseniasDelOrganizador(eventoId)` privado con las lecturas de la 012 (evento → 404, eventos del organizador, sus reseñas ordenadas con `compararResenias`, el puntaje igual que en `OrganizadorVista`) y `resumenDeResenias(eventoId)` público que toma las primeras `LIMITES_PAGINACION.reseniasEnElDetalle` y pide los usuarios en un lote; `reseniasDelOrganizador(eventoId)` sigue respondiendo como hoy (lo pagina la US5) apoyado en el mismo privado. Controller `resumenDeResenias` en `backend/src/controllers/evento.controller.ts` y, en `backend/src/routes/eventos.routes.ts`, `router.get("/:eventoId/resenias-del-organizador/resumen", eventoPorId.middleware, controller.resumenDeResenias)` (público, sin `requerirUsuario`). `test:foco` de T027 en verde.
- [ ] T029 [US4] Seed (R11): en `backend/src/seed/datos-ejemplo.ts`, 2 eventos **realizados** nuevos de Martín (ids fijos `evento-<slug>`), cada uno con 4 compras `UTILIZADA` de Lucía, Sofía, Diego y Valentina (ids `compra-<comprador>-<slug>`, con su `uso` explícito dentro de la ventana) y su reseña (`resenia-<autor>-<slug>`) posterior al uso y **posterior a las de Jazz**: 8 reseñas que suman 38 puntos (`5 5 5 4 5 5 4 5`), algunas sin comentario; Martín pasa a 11 reseñas, 52 / 11 ≈ 4,7272… (se sigue viendo "4,7"). Sofía (2,5 con 2), Lucía sin reseñas y `compra-martin-pena-general` sin reseñar no cambian; los ids existentes tampoco. En `backend/tests/domain/datos-ejemplo.test.ts`: Martín con 11 reseñas y puntaje 52/11; toda reseña de una compra `UTILIZADA`, posterior al uso, una por comprador y evento; los eventos nuevos realizados no están en el catálogo (sigue en 12). En `backend/tests/api/resenias.test.ts` con `crearApp()`: `GET /api/eventos/evento-jazz-en-el-patio/resenias-del-organizador/resumen` → 3 reseñas (de los eventos nuevos) y `cantidadResenias: 11`. Ajustar los tests de la 012 que contaban 3 reseñas o ≈ 4,67 de Martín, y el de orden por puntaje del catálogo si cambia.
- [ ] T030 [P] [US4] OpenAPI y Postman del resumen: en `backend/src/docs/openapi.json`, `GET /eventos/{eventoId}/resenias-del-organizador/resumen` (público, `200 ReseniasDelOrganizadorVista`, 400, 404); en Postman, "Reseñas de Martín — resumen" (`evento-jazz-en-el-patio`). `backend/tests/api/docs.test.ts` en verde.

### Mobile

- [ ] T031 [US4] API, consulta y defaults de test: renombrar `obtenerReseniasDelOrganizador` de la 012 en `mobile/src/api/resenias.ts` a `obtenerResumenDeResenias(cliente, eventoId, { signal })` → `GET …/resenias-del-organizador/resumen`, sin usuario (exportarla por `mobile/src/api/index.ts`), con casos en `mobile/tests/api/resenias.test.ts`; `useReseniasDelOrganizador` en `mobile/src/features/eventos/useReseniasDelOrganizador.ts` la usa (la clave `claves.reseniasDelOrganizador(usuarioId, eventoId)` queda para el resumen); en `mobile/tests/helpers/render-con-dependencias.tsx`, el default pasa a responder `/resenias-del-organizador/resumen` con la vista vacía (regex nueva). Test primero, verlo fallar, implementar; `detalle-evento.test.tsx` y `reseniar-evento.test.tsx` actualizados a la ruta nueva.
- [ ] T032 [US4] Test de la sección en `mobile/tests/pantallas/detalle-evento.test.tsx`, con la **ruta y la pantalla stub** de "Ver todas las reseñas" en el mismo turno: `mobile/app/explorar/[eventoId]/resenias.tsx` (re-export de una línea `export { TodasLasResenias as default } from "../../../src/features/eventos";`), stub `TodasLasResenias` en `mobile/src/features/eventos/pantallas/TodasLasResenias.tsx` (devuelve `null`) exportado por `mobile/src/features/eventos/index.ts`, y la pantalla registrada en `mobile/src/navegacion/LayoutRaiz.tsx` con el título "Reseñas del organizador". Casos: con `cantidadResenias: 11` y 3 reseñas → `textoPuntaje` igual al de la tarjeta, 3 `FilaResenia` y el botón "Ver todas las reseñas" debajo; tocarlo navega a `/explorar/[eventoId]/resenias`; con `cantidadResenias: 3` (o menos) → sin el botón; sin reseñas → "Todavía no tiene reseñas" sin puntaje ni botón (US4-3, US4-5); el cargando y el error siguen siendo propios de la sección. Verlo fallar.
- [ ] T033 [US4] Implementar en `mobile/src/features/eventos/componentes/ReseniasDelOrganizador.tsx`: las reseñas del resumen tal cual llegan y, si `organizador.cantidadResenias > LIMITES_PAGINACION.reseniasEnElDetalle`, `Boton` variante `texto` "Ver todas las reseñas" debajo de las 3, que navega con `router.push({ pathname: "/explorar/[eventoId]/resenias", params: { eventoId } })` por la ruta tipada (R10). Sumar `/explorar/[eventoId]/resenias` a `mobile/tests/tipos/rutas-tipadas.ts`. `test:foco` de T032 en verde.

**Checkpoint**: el detalle muestra 3 reseñas y el puntaje real; el botón lleva a una pantalla todavía vacía.

---

## Phase 7: User Story 5 - Ver todas las reseñas del organizador (Priority: P3)

**Goal**: `GET …/resenias-del-organizador?pagina=N` paginado y la pantalla pública "Reseñas del
organizador" con puntaje, cantidad, las reseñas de a 10 y el paginador común (FR-022).

**Independent Test**: desde el detalle de un evento de Martín, "Ver todas las reseñas": 10 reseñas,
`1 2`, el mismo puntaje y cantidad; en la 2, 1 reseña; un evento inexistente → "No existe el
evento.".

### Backend

- [ ] T034 [US5] Tests de la colección paginada en `backend/tests/api/resenias.test.ts` y `backend/tests/services/evento.service.test.ts`, con stub de la firma `reseniasDelOrganizador(eventoId: string, pagina: number): Promise<PaginaDeReseniasVista>`: con 11 reseñas, `GET …/resenias-del-organizador` → 10 y `pagina` `{ numero: 1, tamano: 10, totalElementos: 11, totalPaginas: 2 }`; `?pagina=2` → 1; concatenar = el orden de la 012 (SC-002); `?pagina=9` → la 2; `?pagina=0` → 400 `query.pagina`; `organizador` igual en las dos páginas y en `/resumen` (SC-005) y `cantidadResenias === pagina.totalElementos`; sin reseñas → `resenias: []`, `totalPaginas: 0`, `numero: 1`; público; 404 `EVENTO_NO_ENCONTRADO`; sin id del autor. Service: un `usuarioService.obtenerPorIds` con el organizador y solo los autores de la página. Verlo fallar.
- [ ] T035 [US5] Implementar (R5): `EventoService.reseniasDelOrganizador(eventoId, pagina)` en `backend/src/services/evento.service.ts` con el `#reseniasDelOrganizador` de T028 y `paginar`; `aPaginaDeReseniasVista` (o equivalente) en `backend/src/services/resenia.vistas.ts` que suma `pagina` a `aReseniasDelOrganizadorVista`; una validación `reseniasDelOrganizador = crearValidacion({ params: paramsEvento, query: z.object({ pagina: paginaSchema }) })` en `backend/src/validations/evento.validation.ts`, usada por `GET /:eventoId/resenias-del-organizador` en `backend/src/routes/eventos.routes.ts` (la de `/resumen` sigue con `eventoPorId`); el controller pasa la página. Actualizar los comentarios de la ruta (ya no "todas las reseñas"). `test:foco` de T034 en verde.
- [ ] T036 [P] [US5] OpenAPI y Postman de la colección: en `backend/src/docs/openapi.json`, `pagina` en `GET /eventos/{eventoId}/resenias-del-organizador`, que responde `PaginaDeReseniasVista` (esquema nuevo); en Postman, "Reseñas de Martín — página 2" (`evento-jazz-en-el-patio?pagina=2`). `backend/tests/api/docs.test.ts` en verde.

### Mobile

- [ ] T037 [US5] API, clave y hook: `obtenerReseniasDelOrganizador(cliente, eventoId, pagina, { signal })` en `mobile/src/api/resenias.ts` → `GET …/resenias-del-organizador` con `?pagina=N` solo si ≠ 1, sin usuario, respondiendo `PaginaDeReseniasVista` (casos en `mobile/tests/api/resenias.test.ts`); `claves.paginaDeResenias(usuarioId, eventoId, pagina)` en `mobile/src/consultas/claves.ts` → `["resenias-del-organizador", usuarioId, eventoId, "pagina", pagina]` (el prefijo `["resenias-del-organizador"]` que invalida `useReseniarEvento` la alcanza); `usePaginaDeResenias(eventoId, pagina)` en `mobile/src/features/eventos/usePaginaDeResenias.ts` (el `usuarioId` de la clave sale de `useSesion()`, como en `useReseniasDelOrganizador`; sin `placeholderData`, R8). Test primero, verlo fallar, implementar.
- [ ] T038 [US5] Test de la pantalla en `mobile/tests/pantallas/todas-las-resenias.test.tsx` (nuevo; llegar desde el detalle tocando "Ver todas las reseñas" o con la ruta): título "Reseñas del organizador"; "Cargando reseñas…"; éxito con el nombre del organizador como encabezado, `textoPuntaje(organizador)`, 10 `FilaResenia` en el orden del servidor y el paginador `1 2`; tocar "Página 2" pide `?pagina=2` y muestra 1 reseña con el mismo puntaje; con 4 a 10 reseñas, sin paginador; vacío `SIN_RESENIAS`; un 404 muestra "No existe el evento." (US5-5); un error de conexión, el `MensajeError` con reintento que vuelve a pedir la misma página; la ve igual el organizador y otro usuario (pública). Verlo fallar.
- [ ] T039 [US5] Implementar `TodasLasResenias` en `mobile/src/features/eventos/pantallas/TodasLasResenias.tsx` (R10): `useLocalSearchParams` del `eventoId`, `usePagina(eventoId)`, `usePaginaDeResenias`, `PantallaDesplazable` con `volverArribaCon={pagina}` y `SegunConsulta` (cargando "Cargando reseñas…", vacío `SIN_RESENIAS`, error de siempre); en éxito, el nombre del organizador, `textoPuntaje`, una `FilaResenia` (la de la 012, sin cambios) por reseña y el `Paginador` después de la última. `test:foco` de T038 en verde.

**Checkpoint**: las cinco historias funcionan; todas las reseñas se pueden leer.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: documentación, revisión manual y cierre.

- [ ] T040 [P] Actualizar `AGENTS.md` (mapa): `shared/src/paginacion.ts` (`LIMITES_PAGINACION`, `PaginaVista`), `ConsultaComprasDelEvento`, `PaginaDeReseniasVista`; en el backend, `domain/paginacion.ts` (`paginar`), `filtrarComprasDelEvento`, `paginaSchema`, el catálogo, Compras del evento (`?pagina`, `?estado`, `?sinResponder`, `cantidadCompras`, totales sobre todas) y las reseñas (`/resumen` con 3 y la colección paginada), el seed de la 013 (12 próximos, 12 compras en el Festival sin pendientes, Martín con 11 reseñas ≈ 4,73); en mobile, `Paginador`, `botonesDelPaginador`, `usePagina`, `volverArribaCon`, las claves nuevas, `consultaDelFiltro` (sin `filtrarCompras`: la descripción de `FiltroPorEstado` pasa a "filtra en el servidor"), `TodasLasResenias` en `explorar/[eventoId]/resenias` y los defaults nuevos de `renderConDependencias`. Corregir lo que hoy dice "las reseñas de todos sus eventos" / "lista completa" de la 012.
- [ ] T041 [P] Recorrer [quickstart.md](./quickstart.md) completo contra el servidor y la app (Expo Go): la tabla de la API y los cinco escenarios de la app, incluido TalkBack ("Página 1, seleccionado, botón") y el paginador de 5 botones en 360 px; anotar y corregir lo que no coincida.
- [ ] T042 En `docs/backlog.md`, pasar la 013 a `hecha` (con el PR). Suite completa en verde desde la raíz: `npm test`, `npm run lint`, `npm run typecheck` y `npm run format:check`; commit y PR a `development` con el resumen de la feature.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T002 bloquea todo lo que usa los tipos nuevos.
- **Foundational (Phase 2)**: depende de T002. T003 → T004; T005 en paralelo con T003/T004.
  Bloquea el backend de US1, US3, US4 y US5.
- **US2 (Phase 3)**: solo mobile; depende de T002 (`PaginaVista`), no de Foundational. T006 → T007;
  T008 → T009 (usa T007); T010 y T011 en paralelo con todo lo anterior.
- **US1 (Phase 4)**: depende de Foundational (backend) y de la US2 (T018 usa `Paginador` y
  `usePagina`). T012 → T013 → T014; T015 en paralelo con T013/T014; T016 → T017 → T018.
- **US3 (Phase 5)**: depende de Foundational y de la US2. T019 en paralelo con T020; T020 → T021 →
  T022; T023 en paralelo; T024 → T025 → T026. Independiente de la US1.
- **US4 (Phase 6)**: depende de Foundational (no usa `paginar`, pero sí el orden de fases) y del
  seed de T014 solo para el conteo del catálogo en T029. T027 → T028 → T029; T030 en paralelo;
  T031 → T032 → T033.
- **US5 (Phase 7)**: depende de la US2 (paginador), de T028 (el privado compartido), de T029 (11
  reseñas en el seed) y de T032 (ruta y stub). T034 → T035; T036 en paralelo; T037 → T038 → T039.
- **Polish (Phase 8)**: depende de todas las historias.

### User Story Dependencies

- **US2 (P1)**: la pieza común de la app; se prueba sola con tests de componentes.
- **US1 (P1)**: usa la US2; con la US2 es el MVP.
- **US3 (P2)**: usa la US2; independiente de la US1.
- **US4 (P3)**: independiente de las demás salvo la ruta stub que crea para la US5.
- **US5 (P3)**: usa la US2 y la US4.

### Within Each User Story

- Test con stub de firma real → verlo fallar → implementar → `test:foco` en verde.
- Backend: dominio → validación → service → controller/rutas → seed → OpenAPI/Postman.
- Mobile: api → claves → hook → pantalla.

### Parallel Opportunities

- T001 y T002.
- T005 con T003/T004; toda la US2 (T006–T011) mientras se hace Foundational.
- En la US2: T006, T008 (con el stub de T006), T010 y T011.
- Las tareas de OpenAPI/Postman (T015, T023, T030, T036) mientras avanza el resto de su historia
  (tocan el mismo archivo entre historias: no en paralelo entre ellas).
- T019 con T020.
- T040 y T041.

---

## Parallel Example: User Story 2

```bash
# Los tres tests de la base a la vez (archivos distintos):
Task: "T006 botonesDelPaginador en mobile/tests/componentes/botones-del-paginador.test.ts"
Task: "T010 usePagina en mobile/src/componentes/usePagina.ts"
Task: "T011 volverArribaCon en mobile/src/componentes/PantallaDesplazable.tsx"

# Después, en orden:
Task: "T007 implementar botonesDelPaginador"
Task: "T008 test de Paginador" → "T009 implementar Paginador"
```

## Parallel Example: User Story 3

```bash
# Backend en paralelo:
Task: "T019 filtrarComprasDelEvento en backend/src/domain/compras-del-evento.ts"
Task: "T020 tests de GET /eventos/:eventoId/compras paginado"
Task: "T023 OpenAPI y Postman de Compras del evento"

# Después, en orden: T021 → T022, y en mobile T024 → T025 → T026.
```

---

## Implementation Strategy

### MVP First (US2 + US1)

1. Phase 1 (Setup) y Phase 2 (Foundational).
2. Phase 3 (US2): el paginador común.
3. Phase 4 (US1): Explorar por páginas.
4. **Parar y validar**: quickstart, filas del catálogo en la API y escenarios 1 y 2 de la app.

### Incremental Delivery

1. US2 + US1 → catálogo paginado (MVP).
2. US3 → Compras del evento paginada con filtros en el servidor.
3. US4 → 3 reseñas en el detalle con el puntaje real.
4. US5 → "Ver todas las reseñas".
5. Polish → AGENTS.md, quickstart, backlog y PR.

Cada fase se corre con `/speckit-implement fase N` y contexto limpio entre fases (`/clear`); cierra
con la suite completa en verde, sus tareas marcadas en este archivo y su commit.

---

## Notes

- [P] = archivo distinto y sin dependencias pendientes.
- Varias historias suman casos a los mismos archivos (`backend/tests/api/resenias.test.ts`,
  `backend/tests/services/evento.service.test.ts`, `backend/tests/domain/datos-ejemplo.test.ts`,
  `openapi.json`, `mobile/tests/api/resenias.test.ts`): por eso esas tareas no llevan [P] entre
  historias.
- El seed crece en tres tareas (T014, T022, T029); cada una ajusta los tests existentes que
  contaban los datos de ejemplo.
- Si una tarea "Test" pasa de entrada, igual se deja el test: documenta la regla (principio II).
