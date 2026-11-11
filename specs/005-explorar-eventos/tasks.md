---

description: "Tareas de implementación de la feature 005 — Explorar eventos"
---

# Tasks: Explorar eventos

**Input**: documentos de diseño en `specs/005-explorar-eventos/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md),
[contracts/app.md](./contracts/app.md), [quickstart.md](./quickstart.md)

**Tests**: obligatorios (constitución II, SC-006): cada regla con su caso borde en `domain`,
`repositories`, `services` (reloj fijo, repositorios armados por caso) y `api`; en mobile,
`api/`, `formato`, las piezas base ampliadas y las pantallas con `renderConDependencias`.

**Organización**: una fase por historia de usuario, en el orden de la spec (US1 y US2 son P1 y
forman el MVP; US3 y US4 son P2). El organizador con su puntaje se necesita en la tarjeta (US1)
y en el detalle (US2), así que la reseña mínima, el puntaje y el `organizador` de `EventoVista`
van en Foundational.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: puede hacerse en paralelo (archivo distinto, sin dependencias pendientes).
- **[Story]**: historia a la que pertenece (US1–US4).
- Rutas relativas a la raíz del repo.

## Convenciones para todas las tareas

- **Test primero con stub en el mismo turno** (AGENTS.md): el hook `Stop` exige typecheck y lint
  en verde al cerrar cada turno. Cada tarea "Test" crea **en el mismo turno** los módulos que
  importa como **stub con la firma real** que lanza `new Error("no implementado")` (un
  componente que devuelve `null`, una ruta de `app/` con su re-export). Se corre el test, **se
  lo ve fallar** por comportamiento y recién en la tarea siguiente se implementa. Las tareas que
  dicen "Test … Luego implementar" (T033, T040–T042, T047, T048) son el mismo ciclo en dos
  turnos: primero el test con su stub, verlo fallar; después la implementación.
- Endpoints: seguir la skill **`nuevo-endpoint`**. Pantallas, hooks y funciones de `src/api/`:
  seguir la skill **`nueva-pantalla`**.
- Backend en capas (constitución 2.2.0): `domain/` puro (sin Express, sin `errors/`, sin reloj:
  `ahora` llega como argumento); el service orquesta y arma vistas y pide lo de otros agregados
  a su service dueño (`CategoriaService`, `UsuarioService`, `ReseniaService`), sin ciclos; el
  controller solo lee `req.query` ya validada; la forma va en `validations/`; `app.ts` es el
  único que instancia y conecta los services en orden.
- **Lecturas sin cerrojo**: `listar` y `obtener` no usan `cerrojo.ejecutar` (R2.4 de la 004).
  `listar` lee `reloj.ahora()` **una sola vez** por pedido.
- **Sin N+1** (R7): `listar` hace un número fijo de lecturas por pedido (`eventos.listar` y una
  búsqueda en lote a cada dueño: `categoriaService.obtenerPorIds`, `usuarioService.obtenerPorIds`
  y `reseniaService.puntajesPorOrganizador`, con **un** `listarPorEventos`), sin importar cuántos
  eventos haya.
- **Dependencias al usarse**: un constructor recibe solo las dependencias que ya usa algún
  método (si no, fallan `no-unused-vars` / `no-unused-private-class-members` y el hook `Stop`).
- Mensajes de error: los textos exactos de `contracts/api.md`. Textos de la app: los de
  `contracts/app.md`, que son los que buscan los tests.
- Mobile: imports relativos sin alias `@/`; desde afuera de una feature solo su `index.ts`
  (adentro, por archivo); `app/` solo re-exports de una línea; todo `fetch` en `src/api/`;
  estilos con `StyleSheet` y valores del `tema` (sin hex, números sueltos ni anchos fijos);
  textos con `...tema.tipografia.<estilo>` (nunca `fontWeight`).
- Las piezas base (`SegunConsulta`, `ListaVacia`) y `SelectorCategoria` se amplían **solo con
  props opcionales**: sus tests y los de la 003/004 siguen en verde sin cambios (SC-008).
- Prohibidos `any`, `@ts-ignore` y `eslint-disable` sin descripción (principio IX).
- Commits: Conventional Commits con scope `005-explorar-eventos`, uno por tarea o grupo
  coherente.

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: tipos compartidos nuevos (aditivos, no rompen nada) y estado del backlog.

- [X] T001 [P] En `docs/backlog.md`, pasar la 005 de `plan` a `tasks`.
- [X] T002 Tipos compartidos en `shared/src/evento.ts` (data-model, "Tipos compartidos"), **sin tocar todavía `EventoVista`** (lo hace T008): `ORDENES_CATALOGO = ["fecha", "precio", "puntaje"] as const`, `type OrdenCatalogo = (typeof ORDENES_CATALOGO)[number]`, `LIMITES_BUSQUEDA = { texto: 100 } as const`, `ConsultaCatalogo { texto?: string; categoriaId?: string; orden?: OrdenCatalogo }` ("lo que pide la app: los vacíos no se mandan"), `OrganizadorVista { id; nombre; apellido; puntaje: number | null /* promedio sin redondear; null = sin reseñas (nunca 0) */; cantidadResenias: number }`, `EventoCatalogoVista extends EventoResumenVista { precioDesde: number /* menor precio de todos sus tipos; 0 = gratis */; agotado: boolean /* todos sus tipos con cupo 0 */; organizador: OrganizadorVista }` y `CatalogoVista { eventos: EventoCatalogoVista[]; hayEventosProximos: boolean /* hay eventos no realizados antes de aplicar texto y categoría */ }`, con JSDoc. Exportarlos en `shared/src/index.ts` (`ORDENES_CATALOGO` y `LIMITES_BUSQUEDA` como valores). Extender `backend/tests/domain/tipos-compartidos.test.ts` con `ORDENES_CATALOGO` y `LIMITES_BUSQUEDA.texto === 100`. `mobile/tests/shared.test.ts` no se toca: solo comprueba que la app importa valores del workspace (con `EstadoCompra`), no el contenido de cada tipo.

---

## Phase 2: Foundational (prerequisitos bloqueantes)

**Purpose**: la reseña mínima, el cálculo del puntaje, su repositorio y el `organizador` de
toda `EventoVista`: los usan la tarjeta (US1), el detalle (US2) y el orden por puntaje (US4).

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

### Reseña mínima y puntaje (backend)

- [X] T003 [P] Test de `backend/tests/domain/resenia.test.ts` con el stub de `backend/src/domain/resenia.ts` (`class Resenia`, `type Puntaje = { promedio: number | null; cantidad: number }`, `calcularPuntaje(puntuaciones: readonly number[]): Puntaje`, `puntajesPorOrganizador(eventos: readonly Evento[], resenias: readonly Resenia[]): Map<string, Puntaje>`). Casos:
  - `Resenia { id, compradorId, eventoId, puntuacion }`: `puntuacion` 1 y 5 construyen; 0, 6 y 4.5 lanzan `DatosInvalidosError` con detalle en `puntuacion` y el mensaje "Debe ser un entero de 1 a 5.";
  - `calcularPuntaje([])` → `{ promedio: null, cantidad: 0 }` (nunca 0); `calcularPuntaje([5, 4, 4])` → promedio `4.333…` **sin redondear**, cantidad 3;
  - `puntajesPorOrganizador`: agrupa por el `organizadorId` del evento reseñado (dos eventos del mismo organizador suman en un solo puntaje, **incluido un evento realizado**); una reseña de un evento que no está en `eventos` se ignora; un organizador sin reseñas **no aparece** en el `Map`.
- [X] T004 Implementar `backend/src/domain/resenia.ts`: propiedades `readonly`, la invariante con `Invariantes` (o el helper de `backend/src/domain/invariantes.ts` que corresponda), sin `detalle` ni la regla de compra `UTILIZADA` (las agrega la 011; dejarlo en un comentario de clase).
- [X] T005 Test de `backend/tests/repositories/resenia.repository.test.ts` con los stubs de la interfaz y el repositorio: en `backend/src/domain/repositorios.ts`, `RepositorioResenias { listarPorEventos(eventoIds: readonly string[]): Promise<Resenia[]> }` con el JSDoc de data-model ("Reseñas (mínimo de la 005): lo justo para el puntaje del organizador. La 011 lo amplía."); `ReseniaRepository` en `backend/src/repositories/resenia.repository.ts` (nuevo). Casos: con reseñas de varios eventos devuelve solo las de los ids pedidos; `[]` → `[]`; ids sin reseñas → `[]`; dos instancias no comparten estado.
- [X] T006 Implementar `ReseniaRepository` en `backend/src/repositories/resenia.repository.ts`: `Map<string, Resenia>` privado, construido con `Resenia[]` (por defecto `[]`).
- [X] T007 En `backend/src/seed/repositorios-de-ejemplo.ts`, `Repositorios` suma `resenias: RepositorioResenias` y `crearRepositoriosDeEjemplo()` lo arma con `new ReseniaRepository([])` (**vacío**: FR-010). Extender `backend/tests/repositories/repositorios-de-ejemplo.test.ts` (las reseñas de cualquier evento del seed son `[]`).
- [X] T007a Test de `UsuarioService` y su repositorio (**después de T005**: los dos editan `backend/src/domain/repositorios.ts`), con los stubs: en `backend/src/domain/repositorios.ts`, `RepositorioUsuarios.listarPorIds(ids: readonly string[]): Promise<Usuario[]>`; en `backend/src/repositories/usuario.repository.ts`, su stub; en `backend/src/services/usuario.service.ts`, `obtenerOFallar(id)` **público** y `obtenerPorIds(ids): Promise<Map<string, Usuario>>`. Casos, como `CategoriaService.obtenerPorIds` (refactor de la 004): `listarPorIds` devuelve los que existen sin repetir, o `[]` (en `backend/tests/repositories/repositorios.test.ts`); `obtenerPorIds` devuelve un `Map` por id con **una** lectura aunque los ids se repitan, `[]` → `Map` vacío y, si falta alguno, `404 USUARIO_NO_ENCONTRADO` (en `backend/tests/services/usuario.service.test.ts`).
- [X] T007b Implementar `UsuarioRepository.listarPorIds` y `UsuarioService.obtenerPorIds` (y quitar el `#` de `obtenerOFallar`).
- [X] T007c Test de `backend/tests/services/resenia.service.test.ts` con el stub de `backend/src/services/resenia.service.ts` (`ReseniaService({ resenias })`, `puntajesPorOrganizador(eventos: readonly Evento[]): Promise<Map<string, Puntaje>>`, `puntajeDe(eventosDelOrganizador: readonly Evento[]): Promise<Puntaje>`). Casos: `puntajesPorOrganizador` trae **todos** los organizadores de `eventos`, los sin reseñas con `{ promedio: null, cantidad: 0 }`; cuenta las reseñas de un evento **realizado**; hace **un** `listarPorEventos` con los ids de esos eventos (espiar el repositorio); `puntajeDe` promedia las reseñas de esos eventos (`[5, 4]` → 4.5) y sin reseñas da `{ promedio: null, cantidad: 0 }`.
- [X] T007d Implementar `ReseniaService` en `backend/src/services/resenia.service.ts`: lee con `listarPorEventos` y calcula con `puntajesPorOrganizador` / `calcularPuntaje` de `backend/src/domain/resenia.ts`. Depende solo de `RepositorioResenias` (no de `EventoService`: evita el ciclo).

### `organizador` en toda `EventoVista` (FR-030)

- [X] T008 Test en `backend/tests/services/evento.service.test.ts` (se amplía): construir `EventoService` con `usuarios` y `resenias` armados por caso, ampliando `crearServicesDeEventos` de `backend/tests/helpers/services-de-eventos.ts` (arma `UsuarioService` y `ReseniaService` como `app.ts`). Casos: `obtener(id)` devuelve los campos de la 004 sin cambios (`organizadorId` incluido) más `organizador: { id, nombre, apellido, puntaje: null, cantidadResenias: 0 }` sin reseñas; con reseñas 5 y 4 de **dos** eventos del organizador (uno realizado) → `puntaje: 4.5, cantidadResenias: 2`; reseñas de eventos de **otro** organizador no cuentan; `crear` y `actualizar` también devuelven `organizador`. En el mismo turno: en `shared/src/evento.ts`, `EventoVista` suma `organizador: OrganizadorVista` (comentario "nuevo: nada se quita (FR-030)"); en `backend/src/services/evento.vistas.ts`, `aOrganizadorVista(usuario, puntaje)` como stub y `aEventoVista(evento, categoria, organizador, ahora)` con el parámetro nuevo; en `backend/src/services/evento.service.ts`, el constructor recibe `usuarioService: UsuarioService` y `reseniaService: ReseniaService` y el stub de `#organizadorVista(organizadorId)`; `backend/src/app.ts` arma `ReseniaService` y se los pasa, en orden (usuarios, categorías y reseñas antes que eventos). Ajustar los fixtures de `EventoVista` de `mobile/tests/helpers/eventos.ts` con un `organizador` (sin cambiar el comportamiento de los tests de la 004: SC-008).
- [X] T009 Implementar `aOrganizadorVista` en `backend/src/services/evento.vistas.ts` (solo `id`, `nombre`, `apellido`, `puntaje: puntaje.promedio`, `cantidadResenias: puntaje.cantidad`: vista explícita, principio VI), con un comentario que explique el cambio de nombres (data-model, "Nombres del puntaje": `Puntaje { promedio, cantidad }` del dominio → `puntaje` / `cantidadResenias` del contrato) y `#organizadorVista(organizadorId)` en `backend/src/services/evento.service.ts`: `usuarioService.obtenerOFallar` + `eventos.listarPorOrganizador` (todos, próximos y realizados) + `reseniaService.puntajeDe(eventos)`. El service no repite la búsqueda del usuario: si no existiera, el 404 es el de `UsuarioService`. Usarlo en `obtener`, `crear` y `actualizar`.
- [X] T010 Test en `backend/tests/api/eventos.test.ts` (se amplía): `GET /api/eventos/evento-hamlet` sin `X-Usuario-Id` → 200 con los campos de la 004 y `organizador` de Martín (`puntaje: null`, `cantidadResenias: 0`); el detalle de un evento **realizado** (`evento-noche-de-risas`) sigue respondiendo 200 con `realizado: true`; un id inexistente sigue en `404 EVENTO_NO_ENCONTRADO` ("No existe el evento."); `POST` y `PUT` responden con `organizador`. Ampliar el esquema `EventoVista` y sumar `OrganizadorVista` en `backend/src/docs/openapi.json` (`docs.test.ts` en verde).

**Checkpoint**: el puntaje está listo (siempre "sin puntaje" con el seed) y toda `EventoVista`
trae el organizador. Las pantallas de la 004 siguen igual.

---

## Phase 3: User Story 1 — Ver el catálogo de eventos próximos (Priority: P1) 🎯 MVP

**Goal**: la pestaña Explorar lista los eventos no realizados por fecha, con tarjetas que
muestran nombre, categoría, fecha y hora, precio "desde" / "Gratis", organizador y su puntaje, y
la marca "Agotado"; con los cuatro estados (skeleton como cargando).

**Independent Test**: con el seed, `GET /api/eventos` sin usuario devuelve los 6 próximos por
fecha (Noche de Rock, Clásico, Hamlet, Charla IA, Festival, Maratón) con `hayEventosProximos:
true`; en la app, Explorar muestra esas tarjetas, "Gratis" en la Maratón, "Agotado" en Hamlet y
"Sin reseñas" en todas.

### Backend

- [ ] T011 [P] [US1] Test en `backend/tests/domain/evento.test.ts` (se amplía) con los stubs de `precioDesde(): number` y `estaAgotado(): boolean` en `backend/src/domain/evento.ts`. Casos: `precioDesde` es el menor precio entre **todos** los tipos, "con o sin cupo" (un tipo agotado más barato sigue siendo el menor: clarificación 1); con un tipo de precio 0 → 0; `estaAgotado` con todos los tipos en `cupo === 0` → `true`; agotado parcial (uno en 0 y otro con cupo) → `false`; ninguna de las dos modifica el evento.
- [ ] T012 [US1] Implementar `precioDesde` (`Math.min(...tiposEntrada.map((t) => t.precio))`; siempre hay al menos un tipo por invariante) y `estaAgotado` (`every((t) => t.cupo === 0)`) en `backend/src/domain/evento.ts`.
- [ ] T013 [P] [US1] Test de `backend/tests/domain/orden-catalogo.test.ts` con el stub de `backend/src/domain/orden-catalogo.ts` (`interface Ordenable { id: string; nombre: string; fechaHora: Date; precioDesde: number; puntaje: number | null }`, `ordenarCatalogo<T extends Ordenable>(elementos: readonly T[], orden: OrdenCatalogo): T[]`). Casos **solo del criterio `fecha`** (los otros los agrega US4): `fechaHora` ascendente; misma fecha → nombre con `Intl.Collator("es", { sensitivity: "base" })` ("álvarez" = "Alvarez", sin distinguir mayúsculas ni tildes); mismo nombre y fecha → `id`; devuelve un arreglo nuevo y el de entrada queda intacto; los elementos pueden traer campos de más (`T extends Ordenable`, por ejemplo `{ …, vista }`) y salen los mismos objetos, sin copiarlos ni recortarlos (lo usa `listar`, T017).
- [ ] T014 [US1] Implementar `ordenarCatalogo` para `fecha` en `backend/src/domain/orden-catalogo.ts` con `toSorted` y una cadena de comparadores (principal → fecha → nombre → id), dejando el lugar del criterio principal para `precio` y `puntaje` (US4). Por ahora `precio` y `puntaje` lanzan `new Error("no implementado")`.
- [ ] T015 [US1] Datos de ejemplo (FR-033, R9) en `backend/src/seed/datos-ejemplo.ts`: en `evento-hamlet`, Platea y Pullman con cupo **0**; `evento-maraton-10k` suma el tipo `tipo-maraton-10k-carrera-kids` ("Carrera kids", "Circuito de 2 km para menores de 12.", precio **0**, cupo 200). Sin eventos nuevos. Extender `backend/tests/domain/datos-ejemplo.test.ts`: hay al menos un evento próximo con un tipo gratis y al menos uno próximo agotado; siguen 8 eventos (6 próximos, 2 realizados) con 3, 3 y 2 por organizador; ids legibles. El caso "tiene precios muy distintos (máximo ≥ 10 × mínimo)" deja de verificar algo con un tipo gratis (`max / 0` es `Infinity` y siempre pasa): pasa a llamarse "tiene precios muy distintos (máximo ≥ 10 × el menor precio pagado)" y compara contra `Math.min(...precios.filter((p) => p > 0))`; el tipo gratis lo cubre el caso nuevo de "al menos un evento próximo con un tipo gratis". Correr `backend/tests/api/` y `backend/tests/services/` (Noche de Rock sigue con un solo tipo; el Festival conserva sus compras y sus tres tipos).
- [ ] T016 [US1] Test en `backend/tests/services/evento.service.test.ts` (se amplía) con el stub de `listar(consulta: ConsultaCatalogoValidada): Promise<CatalogoVista>` en `backend/src/services/evento.service.ts` y de `aEventoCatalogoVista(evento, categoria, organizador, ahora)` en `backend/src/services/evento.vistas.ts`, con reloj fijo y repositorios armados por caso. Casos: solo los **no realizados** (un evento en su instante exacto ya no aparece; uno 1 ms después sí), de cualquier organizador y agotados incluidos; orden por fecha; cada elemento con `precioDesde`, `agotado` y `organizador` (puntaje con reseñas de un evento **realizado** del organizador); `hayEventosProximos: false` con todos realizados y `eventos: []`, **sin** llamar a `listarPorIds` de categorías ni de usuarios ni a `resenias.listarPorEventos` (lista filtrada vacía: no se piden lotes); sin cerrojo; `reloj.ahora()` llamado una sola vez por pedido y, con eventos en la lista, `listarPorIds` de categorías y usuarios y `resenias.listarPorEventos` una sola vez cada uno (sin N+1: espiar los repositorios).
- [ ] T017 [US1] Implementar `aEventoCatalogoVista` (`EventoResumenVista` + `precioDesde`, `agotado`, `organizador`) y `EventoService.listar` según el flujo de data-model: `ahora` una vez → `proximos` → en lote, `categoriaService.obtenerPorIds`, `usuarioService.obtenerPorIds` y `reseniaService.puntajesPorOrganizador` (con **todos** los eventos de los organizadores de la lista) → por evento, un elemento privado `ElementoDelCatalogo = Ordenable & { vista: EventoCatalogoVista }` (`fechaHora` el `Date` de la entidad, `precioDesde()`, `puntaje: puntaje.promedio` sin redondear y la vista de `aEventoCatalogoVista`; data-model, "Flujo de `listar`") → `ordenarCatalogo(elementos, "fecha")` → `{ eventos: elementos.map((e) => e.vista), hayEventosProximos: proximos.length > 0 }`. No se ordenan las vistas: no cumplen `Ordenable` (`fechaHora` string, puntaje anidado). Si la lista filtrada queda vacía, responde `{ eventos: [], hayEventosProximos }` antes de pedir los lotes. `EventoService` no arma los cruces: cada dueño devuelve su `Map` por id.
- [ ] T018 [US1] Test en `backend/tests/api/eventos.test.ts` (se amplía) de `GET /api/eventos`, con stubs de `consultaCatalogo = crearValidacion({ query })` en `backend/src/validations/evento.validation.ts` (por ahora un `z.object({})`: las claves desconocidas se descartan; `texto`/`categoriaId` los suma US3 y `orden`, US4), `EventoController.listar` en `backend/src/controllers/evento.controller.ts` y `router.get("/", consultaCatalogo.middleware, controller.listar)` en `backend/src/routes/eventos.routes.ts` (**sin** `requerirUsuario`). Casos: 200 sin `X-Usuario-Id` con los 6 próximos del seed en orden de fecha y `hayEventosProximos: true`; con un `X-Usuario-Id` inválido también 200 (se ignora); Hamlet con `agotado: true`; Maratón con `precioDesde: 0`; todos con `organizador.puntaje: null` y `cantidadResenias: 0`; con `crearApp({ reloj })` pasado todo el seed → `{ eventos: [], hayEventosProximos: false }`.
- [ ] T019 [US1] Implementar el controller (`res.json(await service.listar(req.query validada))`, sin reglas) y la ruta. Documentar `GET /eventos` (tag **Eventos**, público) con `CatalogoVista` y `EventoCatalogoVista` en `backend/src/docs/openapi.json`, y sumar la carpeta "Explorar eventos" con el pedido sin filtros a `backend/src/docs/ai-ticket-it.postman_collection.json` (`backend/tests/api/docs.test.ts` en verde).

### Mobile

- [ ] T020 [P] [US1] Test en `mobile/tests/api/eventos.test.ts` (se amplía) con el stub de `listarEventos(cliente, consulta: ConsultaCatalogo, { signal })` en `mobile/src/api/eventos.ts` (exportado por `mobile/src/api/index.ts`). Casos (R13): sin parámetros → `GET /eventos?orden=fecha`; solo se agregan los parámetros con valor (`texto` recortado y no vacío, `categoriaId` si viene), `orden` siempre, en ese orden (`texto`, `categoriaId`, `orden`: los tests de pantalla registran las URL así, T026); la URL exacta con acentos, espacios (`+`), `&` y `+` literales (`URLSearchParams`); **sin** `X-Usuario-Id` (`usuarioId: null`); pasa el `signal`.
- [ ] T021 [US1] Implementar `listarEventos` en `mobile/src/api/eventos.ts` con `URLSearchParams` y `cliente.get<CatalogoVista>(ruta, { signal, usuarioId: null })`. En `mobile/src/consultas/claves.ts`, `catalogo: (consulta: { texto: string; categoriaId: string | null; orden: OrdenCatalogo }) => ["catalogo", consulta] as const`, con un comentario que lo documenta como la **excepción** a "el usuario en la posición 1" (el catálogo es el mismo para todos) y el prefijo `["catalogo"]` para invalidar.
- [ ] T022 [P] [US1] Test de `mobile/tests/features/eventos/formato.test.ts` (se amplía) con los stubs de `textoPrecioDesde(precio)` y `textoPuntaje({ puntaje, cantidadResenias })` en `mobile/src/features/eventos/formato.ts`. Casos (R18): `textoPrecioDesde(0)` → "Gratis"; `textoPrecioDesde(8000)` → "desde $ 8.000"; `textoPuntaje` con `null` → "Sin reseñas" (nunca "0"); `4.5, 12` → "4,5 · 12 reseñas"; `5, 1` → "5,0 · 1 reseña"; `4.45` → "4,5"; `4.04` → "4,0" (redondeo al décimo, coma decimal).
- [ ] T023 [US1] Implementar `textoPrecioDesde` (reusa `textoPrecio`) y `textoPuntaje` (`Math.round(p * 10) / 10`, `toFixed(1)` con coma; singular/plural) en `mobile/src/features/eventos/formato.ts`, sin `Intl`.
- [ ] T024 [P] [US1] Test de `mobile/tests/componentes/segun-consulta.test.tsx` (se amplía) con el stub de las props nuevas de `mobile/src/componentes/SegunConsulta.tsx`: `cargando?: ReactNode` (se muestra en lugar de `<Cargando />` mientras `isPending`) y `vacio?: ReactNode` (reemplaza a `ListaVacia` con `mensajeVacio`; las props del vacío quedan discriminadas: **`mensajeVacio` o `vacio`**, una de las dos es obligatoria; `cargando` es opcional siempre). Los casos actuales siguen igual (por defecto `<Cargando />` y `ListaVacia` con `mensajeVacio`).
- [ ] T025 [US1] Implementar las props nuevas de `SegunConsulta` sin cambiar el comportamiento por defecto.
- [ ] T026 [US1] Test de `mobile/tests/pantallas/explorar.test.tsx` (nuevo) con `renderConDependencias` y `porRuta` (registrar las respuestas con la ruta y la query **completas**, en el orden en que las arma `listarEventos` — `texto`, `categoriaId`, `orden` —, por ejemplo `"/eventos?orden=fecha"` o `"/eventos?texto=basquet&categoriaId=categoria-musica&orden=fecha"`: `porRuta` elige la primera clave con la que **termina** la URL (`url.endsWith`), así que cada combinación es una clave distinta y `"/eventos?orden=fecha"` no captura `"…&orden=fecha"`, porque lo precede `&` y no `/eventos?`; `mobile/tests/helpers/fetch-falso.ts` no cambia), con los stubs de `Explorar` en `mobile/src/features/eventos/pantallas/Explorar.tsx`, `useCatalogo` en `mobile/src/features/eventos/useCatalogo.ts`, `TarjetaEvento` y `TarjetaSkeleton` en `mobile/src/features/eventos/componentes/`, el export de `Explorar` en `mobile/src/features/eventos/index.ts` y `mobile/app/(tabs)/index.tsx` como re-export de una línea (reemplaza la `SeccionPendiente`). Sumar a `mobile/tests/helpers/eventos.ts` fixtures de `EventoCatalogoVista` / `CatalogoVista`. Casos: el pedido es `GET /eventos?orden=fecha` sin `X-Usuario-Id`; mientras carga se ve el skeleton anunciado como "Cargando eventos"; las tarjetas en el orden del servidor con nombre, "categoría · `textoFechaHora`", "desde $ 8.000" / "Gratis", "Organiza Sofía Castro" · "Sin reseñas" / "4,5 · 12 reseñas", y el badge "Agotado" como texto; el `accessibilityLabel` de la tarjeta con todos esos textos separados por comas; `eventos: []` con `hayEventosProximos: false` → "Todavía no hay eventos próximos."; error de servidor → "Reintentar"; con el servidor caído, "Servidor no disponible" y "Reintentar", y cuando el `fetch` falso vuelve a responder y avanza la secuencia de reintentos (temporizadores falsos, como en `mobile/tests/pantallas/errores-en-uso.test.tsx`) la lista aparece sola, sin tocar "Reintentar" (edge case "Servidor no disponible"; en el detalle es el mismo mecanismo de `SegunConsulta`, ya probado en la 003); un evento propio del usuario actual aparece como cualquier otro; cambiar de usuario no cambia el pedido (clave sin usuario).
- [ ] T027 [P] [US1] En `mobile/src/componentes/tema.ts`, sumar lo que falte para la tarjeta y el skeleton (alto de los bloques de relleno, por ejemplo `tamano.lineaSkeleton`), sin números sueltos en los componentes.
- [ ] T028 [US1] Implementar `useCatalogo(consulta)` (`useQuery({ queryKey: claves.catalogo(consulta), queryFn: ({ signal }) => listarEventos(cliente, consulta, { signal }) })`, **sin** `placeholderData`/`keepPreviousData`), `TarjetaEvento` (`Pressable` con `accessibilityRole="button"`, se hunde con `hundido` como `FilaEvento`; badge "Agotado" con `neutro`/`sobreNeutro` como `MarcaRealizado`; organizador con `nombreCompleto` del `index.ts` de `usuarios`), `TarjetaSkeleton` (bloques `neutro` con la forma de la tarjeta, sin animación) y `Explorar`: arriba un `View` fijo (que US3 y US4 completan con los controles) y debajo `SegunConsulta` con `cargando` = tres `TarjetaSkeleton` en un `View` con `accessible`, `accessibilityLabel="Cargando eventos"` y `accessibilityLiveRegion="polite"`, `esVacio={(c) => c.eventos.length === 0}`, `vacio` = `ListaVacia` "Todavía no hay eventos próximos." y la `FlatList` de `TarjetaEvento`.

**Checkpoint**: Explorar muestra el catálogo del seed con sus cuatro estados (SC-002 para "no
realizado").

---

## Phase 4: User Story 2 — Ver el detalle de un evento (Priority: P1) 🎯 MVP

**Goal**: tocar una tarjeta abre el detalle público con descripción, imágenes, organizador y
tipos de entrada (precio y cupo / "Agotado"); "Este evento ya se realizó" si corresponde; "No
encontramos este evento." ante un 404, que además saca al evento del catálogo.

**Independent Test**: tocar la Maratón en Explorar y ver sus dos imágenes, "Organiza Lucía
Álvarez · Sin reseñas" y los tipos "Inscripción · $ 30.000 · 1000 disponibles" y "Carrera kids ·
Gratis · 200 disponibles", sin botón de compra; volver a Explorar. (El backend ya quedó en
Foundational: T008–T010.)

- [ ] T029 [P] [US2] En `mobile/src/componentes/tema.ts`, sumar `tamano.imagenDetalle` (ancho y alto de cada imagen de la fila) y lo que haga falta para el espacio entre imágenes.
- [ ] T030 [US2] Test de `mobile/tests/pantallas/detalle-evento.test.tsx` (nuevo) con `renderConDependencias` y `porRuta`, con los stubs de `DetalleEvento` en `mobile/src/features/eventos/pantallas/DetalleEvento.tsx`, `FilaImagenes` en `mobile/src/features/eventos/componentes/FilaImagenes.tsx`, `useInvalidarCatalogo` en `mobile/src/features/eventos/useCatalogo.ts`, el export en `mobile/src/features/eventos/index.ts`, la ruta `mobile/app/explorar/[eventoId].tsx` (re-export de una línea), el `Stack.Screen name="explorar/[eventoId]"` con `title: "Evento"` dentro del `Stack.Protected` de `con-usuario` en `mobile/src/navegacion/LayoutRaiz.tsx` y, en `TarjetaEvento`/`Explorar`, `router.push({ pathname: "/explorar/[eventoId]", params: { eventoId } })`. Casos:
  - tocar una tarjeta de Explorar abre el detalle de ese evento (header "Evento") con volver; un evento propio abre el mismo detalle público;
  - nombre, categoría, `textoFechaHora`, descripción (si tiene), "Organiza" con "Martín Benítez" · "Sin reseñas" (o "4,5 · 12 reseñas"), "Tipos de entrada" con `ListaTiposEntrada` **sin acciones** ("$ 25.000 · Agotado", "Gratis · 200 disponibles");
  - `FilaImagenes`: una imagen por URL con `accessibilityLabel="Imagen N de M de <nombre>"`; al disparar `onError` en una, desaparece sin hueco y las demás quedan; si fallan todas, o sin multimedia, la fila no aparece;
  - `realizado: true` → `MarcaRealizado` y "Este evento ya se realizó";
  - no hay ningún botón de compra (FR-031);
  - cargando y error ≠ 404 con "Reintentar" vía `SegunConsulta`;
  - 404 → "No encontramos este evento." con `Boton` "Volver a Explorar" (`router.back()`), y al volver Explorar vuelve a pedir el catálogo (invalidación de `["catalogo"]`) y el evento ya no aparece.
- [ ] T031 [US2] Implementar `FilaImagenes` (`ScrollView` horizontal de `Image` de React Native con tamaño `tema.tamano.imagenDetalle`; guarda en `useState` las URLs que fallaron y las quita; sin ninguna, `null`), `useInvalidarCatalogo()` (invalida el prefijo `["catalogo"]`), `DetalleEvento` (lee `eventoId` de la ruta y el usuario de la sesión; reusa `useEvento(usuarioId, eventoId)`; antes de `SegunConsulta`, si `esNoEncontrado(error)` muestra el 404 e invalida el catálogo **una vez** en un `useEffect`; con datos, `PantallaDesplazable` en el orden de `contracts/app.md`, "Detalle del evento"), la ruta, el `Stack.Screen` y la navegación desde la tarjeta.
- [ ] T032 [US2] En `mobile/tests/tipos/rutas-tipadas.ts`, sumar el caso de `/explorar/[eventoId]` con su parámetro (y que `npm run typecheck` de `mobile/` pase con la ruta nueva).
- [ ] T033 [US2] Test de `mobile/tests/pantallas/catalogo-actualizado.test.tsx` (nuevo) con `renderConDependencias` y `porRuta`, que verifica por comportamiento (como los tests de la 004) que las escrituras invalidan el catálogo (R15): abrir Explorar (primer `GET /eventos`), ir a Mis eventos, editar un evento y guardar, volver a Explorar → hubo un segundo `GET /eventos` y la lista muestra el nombre nuevo; segundo caso: eliminar un evento → al volver, ya no aparece. Luego sumar `["catalogo"]` **una sola vez**, dentro de `useInvalidar()` de `mobile/src/features/eventos/mutaciones.ts`, para que lo tengan las seis mutations (crear, actualizar, eliminar, agregar, editar y quitar tipo), con éxito o error; los tests de la 004 siguen en verde (el prefijo es adicional).

**Checkpoint**: el MVP (US1 + US2) está completo: catálogo, detalle y vuelta, con los cuatro
estados. Validar con Diego (no organiza nada) y con Lucía (ve sus eventos como cualquiera).

---

## Phase 5: User Story 3 — Buscar por texto y filtrar por categoría (Priority: P2)

**Goal**: un buscador (palabras en cualquier orden, sin mayúsculas ni tildes, ñ ≠ n, hasta 100
caracteres, con debounce de 500 ms) y un selector de categoría con "Todas", combinables, con el
vacío propio "Ningún evento coincide con tu búsqueda." y "Limpiar búsqueda".

**Independent Test**: con el seed, `?texto=BASQUET` → solo el Clásico; `?texto=club+rock` → Noche
de Rock; `?categoriaId=categoria-musica` → Noche de Rock; `?categoriaId=categoria-stand-up` →
`{ eventos: [], hayEventosProximos: true }` (existe, pero su evento ya se realizó);
`?categoriaId=categoria-inexistente` → 400 con detalle en `query.categoriaId` (constitución 2.2.0,
principio III); en la app, escribir "basquet", elegir Música y ver
el vacío de búsqueda, "Limpiar búsqueda".

### Backend

- [ ] T034 [P] [US3] Test de `backend/tests/domain/busqueda.test.ts` con el stub de `backend/src/domain/busqueda.ts` (`normalizarParaBuscar(texto: string): string`, `palabrasDeBusqueda(texto: string): string[]`). Casos (R3): `"BÁSQUET"` → `"basquet"`; `"Pingüino"` → `"pinguino"`; `"Año"` → `"año"` (la ñ se conserva, también si llega descompuesta `"n" + U+0303`); `"Café"` en forma precompuesta y descompuesta da lo mismo; `palabrasDeBusqueda("  club   ROCK ")` → `["club", "rock"]`; `"   "` y `""` → `[]`; la **tabla de coherencia** con `mismoNombreDeTipo` (`"Café"/"cafe"`, `"PINGÜINO"/"pinguino"`, `"Año"/"Ano"`, `"Plátea"/" PLATEA "`, …): `normalizarParaBuscar(a.trim()) === normalizarParaBuscar(b.trim())` coincide con `mismoNombreDeTipo(a, b)`.
- [ ] T035 [US3] Implementar `backend/src/domain/busqueda.ts`: `normalize("NFD")` → quitar **solo** U+0301 y U+0308 detrás de una vocal (`/([aeiouAEIOU])[́̈]+/g` → `"$1"`) → `normalize("NFC")` → `toLowerCase()`; `palabrasDeBusqueda` separa por `/\s+/` sin vacíos. Comentar la diferencia aceptada con el Collator `base` (`ç`, `à`).
- [ ] T036 [US3] Test en `backend/tests/domain/evento.test.ts` (se amplía) con el stub de `coincideCon(palabras: readonly string[]): boolean` en `backend/src/domain/evento.ts`. Casos (R4): `[]` → `true`; parte de una palabra ("basq") y palabra completa; mayúsculas y tildes en el evento ("Noche de Rock" con `["rock"]`); varias palabras en cualquier orden; palabras **repartidas** entre nombre y descripción ("hamlet butacas" con "Hamlet" en el nombre y "butacas" en la descripción del evento); una sola de dos palabras no alcanza; una palabra no coincide "pegando" el final del nombre con el principio de la descripción; `"*"`, `"."` y `"(rock"` son literales.
- [ ] T037 [US3] Implementar `coincideCon` en `backend/src/domain/evento.ts` con `includes` sobre `normalizarParaBuscar(nombre)` y `normalizarParaBuscar(descripcion)` por separado (sin expresiones regulares armadas con la entrada).
- [ ] T037a [US3] Test de la referencia inválida en la query (constitución 2.2.0, principio III; research R1), con los stubs de la firma nueva: en `backend/src/errors/index.ts`, `type OrigenDeReferencia = "datos" | "consulta"` (exportado) y `ReferenciaInvalidaError(campo, mensaje, origen: OrigenDeReferencia = "datos")` con `readonly origen` (sin vocabulario HTTP en `errors/`: research R1); en `backend/src/services/categoria.service.ts`, `buscarReferenciada(id, origen: OrigenDeReferencia = "datos")`. Casos en `backend/tests/services/categoria.service.test.ts`: `buscarReferenciada("categoria-nada", "consulta")` lanza `ReferenciaInvalidaError` con `campo: "categoriaId"`, `origen: "consulta"` y "No existe la categoría."; sin `origen`, `origen: "datos"` (como en la 004); una existente devuelve la categoría. En `backend/tests/api/errores.test.ts` (cubre la traducción de errores): el detalle sale en `query.categoriaId` con `origen: "consulta"` y en `body.categoriaId` con `"datos"` o sin `origen`. Los tests de `POST`/`PUT` de la 004 siguen en verde con `body.categoriaId`.
- [ ] T037b [US3] Implementar `origen` en `ReferenciaInvalidaError` y `buscarReferenciada`, y en `aErrorAplicacion` de `backend/src/middlewares/traducir-error.ts` traducir el origen con una tabla `{ datos: "body", consulta: "query" }` (tipada como `Record<OrigenDeReferencia, string>`, así un origen nuevo no compila sin su prefijo) y armar el campo como `` `${PREFIJO[error.origen]}.${error.campo}` `` (actualizar su comentario: ya no viene siempre del cuerpo).
- [ ] T038 [US3] Test en `backend/tests/services/evento.service.test.ts` (se amplía) de `listar({ texto, categoriaId })`: filtra por `categoriaId` (igualdad exacta) y por texto (palabras ya normalizadas una vez por pedido); los dos combinados; una categoría que **no existe** → rechaza con `ReferenciaInvalidaError` (`campo: "categoriaId"`, `origen: "consulta"`) **sin** leer los eventos ni el reloj (espiar el repositorio de eventos); una categoría que existe pero sin eventos próximos → `eventos: []` con `hayEventosProximos: true`; sin próximos, `hayEventosProximos: false` **aunque** haya texto o categoría; `hayEventosProximos` se calcula antes de aplicar texto y categoría.
- [ ] T039 [US3] Implementar el filtro en `EventoService.listar`: si viene `categoriaId`, **primero** `categoriaService.buscarReferenciada(categoriaId, "consulta")` (el service no busca la categoría por su cuenta ni repite el error: lo lanza el dueño); después `palabrasDeBusqueda(texto)` una vez, el filtro por `categoriaId` y `coincideCon(palabras)`. El tipo `ConsultaCatalogoValidada` suma `texto: string` y `categoriaId?: string`. La lectura extra de `buscarReferenciada` es una sola por pedido (sigue sin N+1).
- [ ] T040 [US3] Test en `backend/tests/api/eventos.test.ts` (se amplía) y en `backend/tests/api/validacion.test.ts` si corresponde: `?texto=BASQUET`, `?texto=básquet` y `?texto=%20basquet%20` → solo el Clásico; `?texto=club+rock` y `?texto=rock%20%20%20club` → Noche de Rock; `?texto=clasico` → Clásico (nombre) y Hamlet (descripción); `?categoriaId=categoria-musica` → solo Noche de Rock (Jazz en el Patio ya se realizó); `?categoriaId=categoria-stand-up` → `200 { eventos: [], hayEventosProximos: true }` (existe, sin próximos); `?texto=rock&categoriaId=categoria-deportes` → `200 { eventos: [], hayEventosProximos: true }`; `?categoriaId=categoria-inexistente` → `400 ENTRADA_INVALIDA` con detalle en `query.categoriaId` y "No existe la categoría." (no la lista vacía); `?categoriaId=%20%20` → 200 sin filtro; `?texto=` + 101 letras → `400 ENTRADA_INVALIDA` con detalle en `query.texto` y "Debe tener como máximo 100 caracteres."; 100 letras con espacios alrededor → 200 (el 100 se cuenta después del `trim`); `?texto=a&texto=b` y `?categoriaId=a&categoriaId=b` → 400 con "Debe ser un texto." en su campo. Luego sumar al `z.object` de `consultaCatalogo` en `backend/src/validations/evento.validation.ts`: `texto` (string opcional, `trim`, ≤ `LIMITES_BUSQUEDA.texto`, `""` por defecto; reusar `textoOpcional` de `backend/src/validations/comunes.ts` si encaja) y `categoriaId` (string opcional, `trim`, vacío = sin filtro; **no** `idSchema`: que exista lo decide `buscarReferenciada`, T039). Documentar los dos parámetros en `backend/src/docs/openapi.json` (con el 400 de `query.categoriaId` en los ejemplos de error) y sumar a Postman "texto=basquet", "categoriaId=categoria-musica", "categoría inexistente → 400" y "texto de 101 caracteres → 400".

### Mobile

- [ ] T041 [P] [US3] Test de `mobile/tests/componentes/lista-vacia.test.tsx` (nuevo) con el stub de la prop `accion?: { texto: string; alPresionar: () => void }` en `mobile/src/componentes/ListaVacia.tsx`: sin `accion`, igual que hoy (solo el mensaje); con `accion`, un `Boton` `aviso` con ese texto debajo del mensaje que llama a `alPresionar`. Luego implementarla.
- [ ] T042 [P] [US3] Test de `mobile/tests/features/eventos/selector-categoria.test.tsx` (nuevo) del modo `conTodas` de `SelectorCategoria`, con el stub de las props discriminadas en `mobile/src/features/eventos/componentes/SelectorCategoria.tsx`: `conTodas: true`, `valor: string | null`, `alCambiar(categoriaId: string | null)`. Casos: "Todas" va primera y queda `checked` con `null`; elegir una categoría llama `alCambiar(id)`; elegir "Todas" llama `alCambiar(null)`; `radiogroup` "Categoría" con cada opción `radio`; los formularios de la 004 no cambian (sus tests siguen en verde). Luego implementarlo.
- [ ] T043 [US3] Test en `mobile/tests/pantallas/explorar.test.tsx` (se amplía) con el stub de `useValorDemorado<T>(valor: T, ms: number): T` en `mobile/src/features/eventos/useValorDemorado.ts`, usando los temporizadores falsos (`jest.advanceTimersByTimeAsync`). Casos:
  - buscador con placeholder "Buscar por nombre o descripción", `accessibilityLabel="Buscar eventos"` y `maxLength` 100 (`LIMITES_BUSQUEDA.texto`);
  - escribir "basquet": el skeleton aparece **desde la primera tecla**; antes de 500 ms no hay pedido nuevo; después, **un** pedido con `texto=basquet` (el último texto, no los intermedios); el campo conserva lo escrito (no se desmonta);
  - un texto con espacios alrededor se manda recortado; solo espacios no agrega `texto`;
  - elegir "Música" pide al instante con `categoriaId=categoria-musica` y muestra el skeleton (sin resultados anteriores a la vista);
  - `eventos: []` con `hayEventosProximos: true` → "Ningún evento coincide con tu búsqueda." con "Limpiar búsqueda"; tocarlo deja el texto `""` y "Todas" (el orden queda); con `hayEventosProximos: false` y un texto escrito → "Todavía no hay eventos próximos.";
  - las categorías con sus propios estados ("Cargando categorías…", error con "Reintentar") mientras el catálogo funciona con "Todas";
  - abrir el detalle de un evento y volver conserva el texto y la categoría (FR-024; la pestaña no se desmonta).
- [ ] T044 [US3] Implementar `useValorDemorado` (`useEffect` + `setTimeout`, limpia al cambiar) y completar `Explorar`: `useState` de `texto` (`""`) y `categoriaId` (`null`); `textoDemorado = useValorDemorado(texto.trim(), 500)`; la clave usa `textoDemorado`; en el `View` fijo de arriba, el `TextInput` (`returnKeyType="search"`, `clearButtonMode`) y el `SelectorCategoria` `conTodas` (chips con `flexWrap`); skeleton ⇔ `texto.trim() !== textoDemorado` **o** `isPending`; el `vacio` según `hayEventosProximos` con la `accion` "Limpiar búsqueda".

**Checkpoint**: US3 funciona sola sobre el MVP (SC-002 completo, SC-004).

---

## Phase 6: User Story 4 — Ordenar los eventos (Priority: P2)

**Goal**: ordenar por fecha, precio "desde" o puntaje del organizador (sin puntaje al final),
con desempates por fecha → nombre → id, combinado con la búsqueda y el filtro.

**Independent Test**: `?orden=precio` con el seed → Maratón (0), Charla (2000), Clásico (8000),
Noche de Rock (15000), Hamlet (18000), Festival (45000); `?orden=puntaje` → igual que por fecha
(nadie tiene reseñas); `?orden=nombre` → 400 con detalle en `query.orden`.

### Backend

- [ ] T045 [P] [US4] Test en `backend/tests/domain/orden-catalogo.test.ts` (se amplía) de los criterios `precio` y `puntaje`. Casos: `precio` ascendente con los gratis primero; empate de precio → fecha → nombre → id; `puntaje` descendente con el valor **sin redondear** (4.36 antes que 4.34); `null` **siempre al final**, nunca como 0 (un 1.0 va antes que un `null`); todos `null` → queda en orden de fecha; empate de puntaje → fecha → nombre → id; el arreglo original intacto (SC-003, SC-005).
- [ ] T046 [US4] Implementar `precio` y `puntaje` en `backend/src/domain/orden-catalogo.ts`.
- [ ] T047 [US4] Test en `backend/tests/services/evento.service.test.ts` (se amplía) de `listar({ orden })`: por precio y por puntaje con reseñas armadas por caso (incluida una reseña de un evento **realizado** del organizador, que cuenta para su puntaje); el orden se aplica sobre lo filtrado por texto y categoría. Luego pasar `consulta.orden` a `ordenarCatalogo` en `EventoService.listar` (el tipo `ConsultaCatalogoValidada` suma `orden: OrdenCatalogo`).
- [ ] T048 [US4] Test en `backend/tests/api/eventos.test.ts` (se amplía): `?orden=precio` en el orden del seed de arriba; `?orden=puntaje` igual que por fecha; sin `orden` → por fecha; `?orden=nombre` → `400 ENTRADA_INVALIDA` con detalle en `query.orden` y "Debe ser fecha, precio o puntaje."; `?orden=fecha&orden=precio` → 400. Luego sumar `orden: z.enum(ORDENES_CATALOGO)` con `"fecha"` por defecto al `z.object` de `consultaCatalogo` en `backend/src/validations/evento.validation.ts`, documentarlo en `backend/src/docs/openapi.json` y sumar a Postman "orden=precio", "orden=puntaje" y "orden=nombre → 400".

### Mobile

- [ ] T049 [US4] Test en `mobile/tests/pantallas/explorar.test.tsx` (se amplía) con el stub de `SelectorOrden` en `mobile/src/features/eventos/componentes/SelectorOrden.tsx` (`valor: OrdenCatalogo`, `alCambiar(orden: OrdenCatalogo)`). Casos: `radiogroup` "Ordenar por" con "Fecha" · "Precio" · "Puntaje" como `radio` y "Fecha" `checked` al abrir; elegir "Precio" pide al instante `orden=precio` (combinado con el texto y la categoría elegidos) y muestra el skeleton; la lista sale en el orden del servidor; "Limpiar búsqueda" deja el orden; volver del detalle conserva el orden; Fecha → Precio → Fecha muestra la respuesta cacheada de **esa** consulta.
- [ ] T050 [US4] Implementar `SelectorOrden` (mismo estilo de chips que `SelectorCategoria`, con `flexWrap`) y sumar a `Explorar` el `useState` de `orden` (`"fecha"`), el selector en el `View` fijo y `orden` en la clave.

**Checkpoint**: las cuatro historias funcionan; el orden por puntaje queda listo para la 011
(FR-010).

---

## Phase 7: Polish y transversales

**Purpose**: comentarios, documentación, accesibilidad, validación de punta a punta y cierre.

- [ ] T051 [P] Corregir el comentario de `tuPrecioEstaEntre` en `backend/src/domain/evento.ts`: el filtro por rango de precio quedó fuera de alcance de la 005 (lo pide el diagrama de la consigna, sin feature que lo use todavía).
- [ ] T052 [P] Actualizar `AGENTS.md` (plan, "Post-design re-check"):
  - `GET /eventos` público y `EventoVista` con `organizador`;
  - `Resenia` mínima, `RepositorioResenias.listarPorEventos` y `ReseniaService` (lo amplía la 011), en "Recursos";
  - `UsuarioService.obtenerOFallar` público y `obtenerPorIds`, y `RepositorioUsuarios.listarPorIds` en la convención de nombres;
  - los módulos puros `domain/busqueda.ts` y `domain/orden-catalogo.ts`;
  - Explorar y el detalle público en la feature `eventos`, la ruta `explorar/[eventoId]`, `useCatalogo`/`useInvalidarCatalogo`/`useValorDemorado` y la clave `catalogo` **sin usuario** (la excepción documentada en `claves.ts`);
  - las props nuevas de `SegunConsulta` (`cargando`, `vacio`) y `ListaVacia` (`accion`), y el modo `conTodas` de `SelectorCategoria`.
- [ ] T053 Revisar en 360 px y con TalkBack: sin desplazamiento horizontal de la página (solo la fila de imágenes se desliza; los chips se acomodan en renglones), tarjetas, selectores, buscador e imágenes anunciados, "Agotado" como texto y sin valores sueltos fuera del `tema` (SC-007). Ajustar lo que haga falta en `mobile/src/features/eventos/`.
- [ ] T054 Correr `npm test`, `npm run lint`, `npm run typecheck` y `npm run format:check` desde la raíz, y dejar las cuatro en verde (incluidos todos los tests de la 004: SC-008).
- [ ] T055 Validar a mano las secciones 2 (pedidos directos) y 3 (recorrido de la demo en el celular) de `specs/005-explorar-eventos/quickstart.md` y anotar cualquier desvío. En el paso 2 de la app, cronometrar buscar un evento sin tildes y abrir su detalle: menos de 30 s (SC-001); al dejar de escribir, la lista cambia en menos de 1 s (SC-004).
- [ ] T056 En `docs/backlog.md`, pasar la 005 a `en PR`, y abrir el PR de `feature/005-explorar-eventos` a `development` con las cuatro verificaciones del CI en verde.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de T002 (tipos compartidos). **Bloquea todas las
  historias**.
- **US1 (Phase 3)**: depende de Foundational.
- **US2 (Phase 4)**: depende de Foundational (backend del detalle) y de US1 en mobile (se llega
  al detalle tocando una tarjeta de Explorar; `useInvalidarCatalogo` vive junto a `useCatalogo`).
- **US3 (Phase 5)**: depende de US1 (amplía `listar`, `consultaCatalogo` y `Explorar`). El test
  de "volver del detalle conserva la consulta" (T043) depende además de US2. La referencia
  inválida va antes del filtro: T037a → T037b → T038 → T039 → T040 (T038 espera el
  `ReferenciaInvalidaError` con `origen: "consulta"` y T040, el 400 en `query.categoriaId`).
- **US4 (Phase 6)**: depende de US1 (`ordenarCatalogo`, `listar`, `Explorar`). Es independiente
  de US3: si US3 no está, `SelectorOrden` va igual en el `View` fijo y los casos combinados de
  T049 se limitan al orden.
- **Polish (Phase 7)**: depende de las historias que se quieran entregar.

### Within Each User Story

- Test con stub → verlo fallar → implementar.
- Dominio → service → validación, controller y ruta → OpenAPI y Postman.
- `src/api/` → claves y hooks → componentes → pantalla y ruta.
- Las tareas sobre el mismo archivo (`evento.test.ts`, `orden-catalogo.test.ts`,
  `evento.service.test.ts`, `api/eventos.test.ts`, `evento.validation.ts`, `openapi.json`,
  `explorar.test.tsx`, `Explorar.tsx`, `tema.ts`) son secuenciales.

### Parallel Opportunities

- **Phase 2**: T005 (repositorio) después del stub de `Resenia` de T003; T007a (usuarios) en
  paralelo con T003, T004 y T006, pero **después de T005** (los dos editan
  `backend/src/domain/repositorios.ts`); T007c espera a T004 y T006; T008 espera a T004–T007d.
- **Backend y mobile de una misma historia** avanzan en paralelo una vez cerrada Foundational:
  en US1, T020–T025 (api, formato, `SegunConsulta`) en paralelo con T011–T019.
- **US1 backend**: T011 (Evento) y T013 (orden) en paralelo.
- **US3**: T034 (búsqueda) y T037a (referencia inválida: `errors/`, `CategoriaService`, sin
  archivos en común) en paralelo con T041 y T042 (piezas de mobile).
- **US4**: el backend (T045–T048) puede adelantarse en paralelo con US3.

---

## Parallel Example: User Story 1

```text
Task: "T011 Test de precioDesde/estaAgotado en backend/tests/domain/evento.test.ts"
Task: "T013 Test de ordenarCatalogo (fecha) en backend/tests/domain/orden-catalogo.test.ts"
Task: "T020 Test de listarEventos en mobile/tests/api/eventos.test.ts"
Task: "T022 Test de textoPrecioDesde/textoPuntaje en mobile/tests/features/eventos/formato.test.ts"
Task: "T024 Test de las props nuevas de SegunConsulta en mobile/tests/componentes/segun-consulta.test.tsx"
```

## Parallel Example: User Story 3

```text
Task: "T034 Test de normalizarParaBuscar/palabrasDeBusqueda en backend/tests/domain/busqueda.test.ts"
Task: "T041 Test de ListaVacia con accion en mobile/tests/componentes/lista-vacia.test.tsx"
Task: "T042 Test de SelectorCategoria conTodas"
```

---

## Implementation Strategy

### MVP primero (US1 + US2)

1. Phase 1 y Phase 2 completas.
2. Phase 3 (US1): Explorar con el seed. **Validar**: 6 próximos por fecha, "Gratis", "Agotado",
   "Sin reseñas".
3. Phase 4 (US2): detalle y vuelta. **Validar**: Maratón (imágenes, dos tipos), Hamlet
   (agotado), un 404.
4. Las cuatro verificaciones en verde. Es una entrega demostrable de la puerta de entrada a la
   006.

### Entrega incremental

1. MVP (US1 + US2).
2. US3: búsqueda y filtro. Validar "basquet", Música y "Limpiar búsqueda".
3. US4: orden. Validar precio y puntaje.
4. Polish y PR.

---

## Notes

- [P] = archivo distinto y sin dependencias pendientes.
- Cada historia es verificable sola en su checkpoint.
- Si una tarea obliga a decidir algo que el plan o la spec no cubren, se frena y se consulta
  (no se inventa la regla).
- La validación de `GET /api/eventos` crece por historia (T018 → T040 → T048): hasta US3/US4,
  `texto`, `categoriaId` y `orden` son claves desconocidas y se ignoran (por ejemplo,
  `?orden=nombre` responde 200 en vez de 400). El contrato final es el de `contracts/api.md`; si
  se entrega solo el MVP, decirlo en el PR.
- El ejemplo "hamlet butacas" de la spec se prueba con datos armados en T036, no con el seed
  ("butacas" está en la descripción de los tipos de Hamlet, no del evento; ver
  `contracts/api.md`).
