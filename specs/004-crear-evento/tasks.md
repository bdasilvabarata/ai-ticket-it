---

description: "Tareas de implementación de la feature 004 — Crear evento"
---

# Tasks: Crear evento

**Input**: documentos de diseño en `specs/004-crear-evento/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md),
[contracts/app.md](./contracts/app.md), [quickstart.md](./quickstart.md)

**Tests**: obligatorios (constitución II, SC-003): cada regla con su caso borde en `domain`,
`repositories`, `services` (con reloj fijo y concurrencia) y `api`; en mobile, `api/`,
`formato`, `fecha-de-pared`, `errores-de-formulario` y las pantallas con
`renderConDependencias`.

**Organización**: una fase por historia de usuario. **US2 va antes que US1** aunque las dos son
P1: Mis eventos es la pantalla desde la que se crea, y US1 le agrega la acción "Crear evento"
(por eso la prueba independiente de US2 se completa con la de US1).
US3 le agrega a las filas la navegación al evento, y US4 suma eliminar a la pantalla de edición.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: puede hacerse en paralelo (archivo distinto, sin dependencias pendientes).
- **[Story]**: historia a la que pertenece (US1–US4).
- Rutas relativas a la raíz del repo.

## Convenciones para todas las tareas

- **Test primero con stub en el mismo turno** (AGENTS.md): el hook `Stop` exige typecheck y lint
  en verde al cerrar cada turno. Cada tarea "Test" crea **en el mismo turno** los módulos que
  importa como **stub con la firma real** que lanza `new Error("no implementado")` (un
  componente que devuelve `null`, una ruta de `app/` con su re-export). Se corre el test, **se
  lo ve fallar** por comportamiento, y recién en la tarea siguiente se implementa.
- Endpoints: seguir la skill **`nuevo-endpoint`**. Pantallas, hooks y funciones de `src/api/`:
  seguir la skill **`nueva-pantalla`**.
- Backend en capas: `domain/` sin Express ni `errors/` (los 409 son `ReglaDeNegocioError`); los
  404 y 403 los lanza el service con `errors/`; los controllers sin reglas; `app.ts` es el único
  que instancia. Ningún service depende de otro.
- **Cerrojo**: toda escritura sobre un evento existente corre en
  `cerrojo.ejecutar(eventoId, async () => …)`, **vuelve a leer** el evento adentro, lee
  `reloj.ahora()` adentro, verifica en el orden de R5 (`404 evento → 403 → 404 tipo → 400
  categoría → 409 EVENTO_REALIZADO → otros 409`) y recién después guarda. Sin cerrojos
  anidados. Crear un evento y las lecturas no usan el cerrojo (R1, R2).
- **Inmutabilidad**: las operaciones de `Evento` devuelven un `Evento` nuevo; nunca se modifica
  la instancia guardada (R7). Los tests afirman que el original no cambió.
- **Dependencias al usarse**: un constructor recibe solo las dependencias que ya usa algún
  método, y `app.ts` solo crea lo que pasa a alguien. Las demás se suman en la tarea que las
  usa (si no, fallan `no-unused-vars` / `no-unused-private-class-members` y el hook `Stop`).
- Mensajes de error: los textos exactos de `contracts/api.md` ("Errores de esta feature" y
  "Reglas de los cuerpos"). Textos de la app: los de `contracts/app.md`, que son los que buscan
  los tests.
- Mobile: imports relativos sin alias `@/`; desde afuera de una feature solo su `index.ts`;
  `app/` solo re-exports de una línea; todo `fetch` en `src/api/`; estilos con `StyleSheet` y
  valores del `tema` (sin hex ni números sueltos ni anchos fijos).
- Prohibidos `any`, `@ts-ignore` y `eslint-disable` sin descripción (principio IX).
- Commits: Conventional Commits con scope `004-crear-evento`, uno por tarea o grupo coherente.

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: prerequisitos de la feature: constitución, dependencia nueva y tipos compartidos.

- [X] T001 Verificar que `.specify/memory/constitution.md` tiene la enmienda MINOR de research R1 ("Operaciones atómicas por evento", versión 2.1.0). Ya aplicada en el commit `a6c9a70`.
- [X] T002 Instalar `@react-native-community/datetimepicker` 9.2.1 desde `mobile/` con `npx expo install @react-native-community/datetimepicker` y comprobar que `npx expo install --check` no da advertencias. Cambian `mobile/package.json` y `package-lock.json`. Agregar el mock de jest del módulo (componente `DateTimePicker` y `DateTimePickerAndroid.open` como `jest.fn`) en `mobile/jest.setup.ts` (lo carga `setupFilesAfterEnv` de `mobile/jest.config.js`), para que los tests de pantalla puedan simular la elección de una fecha (R11).
- [X] T003 [P] Tipos compartidos en `shared/src/evento.ts`: `TipoEntradaVista { id, nombre, descripcion, precio, cupo }`, `EventoResumenVista { id, nombre, categoria: { id, nombre }, fechaHora (instante ISO UTC), fechaHoraLocal ("YYYY-MM-DDTHH:mm", hora de pared de Buenos Aires), organizadorId, realizado, cantidadTiposEntrada }`, `EventoVista extends EventoResumenVista { descripcion, multimedia: string[], tiposEntrada: TipoEntradaVista[] }`, `DatosTipoEntrada { nombre; descripcion?; precio; cupo }`, `DatosEvento { nombre; descripcion?; categoriaId; fechaHora ("YYYY-MM-DDTHH:mm" en hora de Buenos Aires); multimedia? }`, `DatosNuevoEvento extends DatosEvento { tiposEntrada: DatosTipoEntrada[] }`, `LIMITES_EVENTO = { nombre: 100, descripcion: 2000, multimedia: 5 } as const` y `LIMITES_TIPO_ENTRADA = { nombre: 50, descripcion: 300 } as const`. Además, `shared/src/categoria.ts` con `CategoriaVista { id, nombre, descripcion }`, y los exports en `shared/src/index.ts`. Extender `backend/tests/domain/tipos-compartidos.test.ts` con los límites.

---

## Phase 2: Foundational (prerequisitos bloqueantes)

**Purpose**: piezas que usan todas las historias: hora de Buenos Aires, reloj, cerrojo, Compra
mínima, repositorios, seed, consultas de `Evento`, claves, tema y formato de la app.

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

### Backend

- [X] T004 [P] Test de `backend/tests/domain/hora-buenos-aires.test.ts` con el stub de `backend/src/domain/hora-buenos-aires.ts`. Casos: `instanteDesdeHoraDeBuenosAires("2026-12-01T20:00")` → `2026-12-01T23:00:00.000Z`; `horaDeBuenosAires(new Date("2026-12-01T23:00:00.000Z"))` → `"2026-12-01T20:00"`; ida y vuelta; cambio de día (`"2026-12-31T22:30"` → `2027-01-01T01:30Z`); resultado igual con `process.env.TZ` distinto. Buenos Aires es UTC−3 fijo y la constante del desfase vive solo en este archivo (R10).
- [X] T005 Implementar `backend/src/domain/hora-buenos-aires.ts` (`Date.UTC(a, m − 1, d, h + 3, min)` y getters UTC). En `backend/src/seed/datos-ejemplo.ts`, reemplazar `DESFASE_UTC_HORAS` por `instanteDesdeHoraDeBuenosAires` (los tests de `backend/tests/domain/datos-ejemplo.test.ts` siguen en verde).
- [X] T006 [P] Interfaz `Reloj { ahora(): Date }` en `backend/src/domain/reloj.ts` y `relojDelSistema` (`ahora: () => new Date()`) en `backend/src/config/reloj.ts` (R3).
- [X] T007 [P] Test de `backend/tests/services/cerrojo-por-clave.test.ts` con el stub de `backend/src/services/cerrojo-por-clave.ts` (`interface Cerrojo { ejecutar<T>(clave: string, operacion: () => Promise<T>): Promise<T> }`, `class CerrojoPorClave implements Cerrojo`). Casos: dos operaciones sobre la misma clave no se intercalan (la segunda empieza cuando termina la primera); claves distintas corren en paralelo (una bloqueada a propósito no frena a la otra); se libera ante un error y el error llega al que llamó; devuelve el valor de la operación; la cola de una clave se borra al vaciarse (R2).
- [X] T008 Implementar `CerrojoPorClave` en `backend/src/services/cerrojo-por-clave.ts`: `Map<string, Promise<void>>` privado, libera en `finally` y borra la clave al quedar vacía. Un comentario de clase con las cuatro reglas de uso de R2.
- [X] T009 [P] Test de `backend/tests/domain/compra.test.ts` con el stub de `backend/src/domain/compra.ts`. `Compra { id, compradorId, eventoId, tipoEntradaId, cantidad, total, estado }`, con `cantidad` "entero ≥ 1", `total` "entero ≥ 0, fijado al comprar" y `estado` "`EstadoCompra` (shared), uno de los cinco". Valores inválidos → `DatosInvalidosError`.
- [X] T010 Implementar `Compra` en `backend/src/domain/compra.ts`, con propiedades `readonly`, `Invariantes` y sin comportamiento (data-model).
- [X] T011 Test de `backend/tests/repositories/evento.repository.test.ts` y `backend/tests/repositories/compra.repository.test.ts`, con los stubs de las interfaces y los repositorios:
  - en `backend/src/domain/repositorios.ts`, `RepositorioEventos` suma `listarPorOrganizador(organizadorId): Promise<Evento[]>`, `guardar(evento): Promise<void>` (alta o reemplazo por id) y `eliminarPorId(id): Promise<void>`;
  - `RepositorioCompras` nuevo, con `existePorEvento(eventoId)`, `existePorTipoEntrada(tipoEntradaId)` y `guardar(compra)`;
  - stubs en `backend/src/repositories/evento.repository.ts` y en `backend/src/repositories/compra.repository.ts` (nuevo).
  - Casos: `listarPorOrganizador` devuelve solo los del organizador (o `[]`); `guardar` agrega y reemplaza; `eliminarPorId` quita; `existePor*` es `true` con una compra en **cualquier** estado (también `CANCELADA`) y `false` sin compras; dos instancias no comparten estado.
- [X] T012 Implementar los métodos nuevos de `backend/src/repositories/evento.repository.ts` y `CompraRepository` en `backend/src/repositories/compra.repository.ts` (`Map` privado por instancia, construido con las entidades iniciales).
- [X] T013 Seed de compras (FR-021a, R17): en `backend/src/seed/datos-ejemplo.ts`, `DatosEjemplo` suma `compras`: `compra-martin-festival-vip` (`usuario-martin`, `evento-festival-sonidos-del-sur` · `tipo-festival-sonidos-del-sur-vip`, 2 entradas, total 240000, `CONFIRMADA`) y `compra-diego-festival-general` (`usuario-diego`, mismo evento · `tipo-festival-sonidos-del-sur-general`, 1 entrada, total 45000, `CANCELADA`). En `backend/src/seed/repositorios-de-ejemplo.ts`, `Repositorios` suma `compras: RepositorioCompras`. Extender `backend/tests/domain/datos-ejemplo.test.ts` (ids legibles; la compra apunta a un evento y a un tipo que existen y son de ese evento; el Festival es de Lucía y es próximo) y `backend/tests/repositories/repositorios-de-ejemplo.test.ts`.
- [X] T014 Composition root en `backend/src/app.ts`: `OpcionesApp { repositorios?: Partial<Repositorios>; reloj?: Reloj }`, con `reloj = relojDelSistema` por defecto. Los repositorios de ejemplo se arman con `crearRepositoriosDeEjemplo(reloj.ahora())`. El cerrojo todavía no se crea: lo crea T056, cuando lo usa el primer service. Los tests de `backend/tests/api/` existentes siguen en verde.
- [X] T015 Test en `backend/tests/domain/evento.test.ts` (se amplía) con los stubs en `backend/src/domain/evento.ts`. Antes de los casos, renombrar las interfaces del constructor de `backend/src/domain/evento.ts` a `PropiedadesEvento` y `PropiedadesTipoEntrada` (y sus usos en `backend/src/seed/datos-ejemplo.ts`), para que no choquen con `DatosEvento` y `DatosTipoEntrada` de `shared` (los cuerpos HTTP). Casos:
  - `mismoNombreDeTipo`: "VIP" = " vip " = "Víp"; "Platea" = "Plátea"; "Año" ≠ "Ano" (R14);
  - el constructor de `Evento` con dos tipos de nombre "igual" lanza `ReglaDeNegocioError("NOMBRE_TIPO_ENTRADA_REPETIDO")`;
  - `estaRealizado(ahora)`: 1 ms antes de `fechaHora` → `false`; en el instante exacto → `true`;
  - `esOrganizadoPor(usuarioId)`;
  - `buscarTipoEntrada(tipoId)`: el tipo o `null`;
  - `TipoEntrada.con(datos)`: devuelve un tipo nuevo con el mismo `id` y deja intacto el original;
  - el dominio **no** limita longitudes ni multimedia: un nombre de 101 caracteres o 6 URLs construyen sin error (esos límites son de forma y los valida zod; A1).
- [X] T016 Implementar en `backend/src/domain/evento.ts` `mismoNombreDeTipo` (`Intl.Collator("es", { sensitivity: "base" })` sobre los textos recortados), la invariante de nombres únicos en el constructor, `estaRealizado`, `esOrganizadoPor`, `buscarTipoEntrada` y `TipoEntrada.con`. Corregir el comentario de `tuPrecioEstaEntre` para que diga "feature 005".

### Mobile

- [X] T017 [P] En `mobile/src/consultas/claves.ts`, sumar `categorias: () => ["categorias"]`, `misEventos: (usuarioId) => ["mis-eventos", usuarioId]` y `evento: (usuarioId, eventoId) => ["evento", usuarioId, eventoId]` (`as const`, con el `usuarioId` en la posición 1). En `mobile/src/componentes/tema.ts`, sumar `colores.neutro` (`#52606d`) y `colores.sobreNeutro` (`#ffffff`) para la marca "Realizado" (contraste > 4,5:1).
- [X] T018 [P] Test de `mobile/tests/features/eventos/formato.test.ts` con el stub de `mobile/src/features/eventos/formato.ts` y el `index.ts` de la feature. Casos de R18: `textoFechaHora("2026-12-01T20:00")` → `"mar 1 dic 2026 · 20:00"`, igual con `process.env.TZ` distinto; `textoPrecio(0)` → `"Gratis"`; `textoPrecio(15000)` → `"$ 15.000"`; `textoCantidadTipos(1)` → `"1 tipo de entrada"`; `textoCantidadTipos(3)` → `"3 tipos de entrada"`; `textoCupo(0)` → `"Agotado"`; `textoCupo(30)` → `"30 disponibles"`.
- [X] T019 Implementar `mobile/src/features/eventos/formato.ts` sin `Intl`: arreglos propios de días y meses, día de la semana con `new Date(Date.UTC(a, m − 1, d)).getUTCDay()` y separador de miles con una expresión regular.

**Checkpoint**: la base está lista. Las historias pueden empezar.

---

## Phase 3: User Story 2 — Ver mis eventos (Priority: P1) 🎯 MVP

**Goal**: la pestaña Mis eventos lista los eventos del usuario actual, con el orden de FR-004,
la marca "Realizado" y los cuatro estados.

**Independent Test**: con los datos de ejemplo, elegir a Lucía y ver Noche de Rock, Festival y
Maratón en ese orden, sin eventos de otros; elegir a Sofía y ver Noche de risas al final con
"Realizado"; elegir un usuario sin eventos y ver "Todavía no organizás eventos.".

### Backend

- [X] T020 [US2] Test de `EventoService.listarMios(usuarioId)` en `backend/tests/services/evento.service.test.ts`, con los stubs de `backend/src/services/evento.service.ts` (constructor `{ eventos, categorias, reloj }`; `cerrojo` y `compras` se suman en T056 y T076, cuando se usan) y de `backend/src/services/evento.vistas.ts` (`aEventoResumenVista`). Usar repositorios en memoria con los datos de cada caso y un reloj fijo. Casos:
  - solo los del organizador (FR-002);
  - primero los próximos por `fechaHora` ascendente y después los realizados por `fechaHora` descendente (FR-004);
  - `realizado` en el borde (evento en el instante exacto del reloj → realizado);
  - `categoria: { id, nombre }`, `fechaHora` ISO, `fechaHoraLocal` de Buenos Aires y `cantidadTiposEntrada`;
  - sin eventos → `[]`.
- [X] T021 [US2] Implementar `aEventoResumenVista(evento, categoria, ahora)` en `backend/src/services/evento.vistas.ts` (con `horaDeBuenosAires`) y `EventoService.listarMios` en `backend/src/services/evento.service.ts`.
- [X] T022 [US2] Test de `GET /api/eventos/mios` en `backend/tests/api/eventos.test.ts` (supertest con `crearApp({ reloj })`), con los stubs de `backend/src/controllers/evento.controller.ts` y `backend/src/routes/eventos.routes.ts`. Casos: `401 USUARIO_NO_IDENTIFICADO` sin `X-Usuario-Id`; Lucía → Noche de Rock, Festival y Maratón en ese orden; Sofía → Clásico de básquet y, al final, Noche de risas con `realizado: true`; un usuario sin eventos → `[]`.
- [X] T023 [US2] Implementar `EventoController.listarMios` en `backend/src/controllers/evento.controller.ts` y `crearEventosRouter` en `backend/src/routes/eventos.routes.ts` (`GET /mios` con `requerirUsuario`, declarada antes de `/:eventoId`). Montarlo en `/eventos` en `backend/src/routes/index.ts` (`ControllersApi` suma `eventos`) y conectar `EventoService` y `EventoController` en `backend/src/app.ts`.
- [X] T024 [US2] Documentar `GET /api/eventos/mios` en `backend/src/docs/openapi.json` (tag **Eventos**, esquema `EventoResumenVista`, `401`) y sumar el pedido a `backend/src/docs/ai-ticket-it.postman_collection.json`. `backend/tests/api/docs.test.ts` en verde.

### Mobile

- [X] T025 [P] [US2] Test de `listarMisEventos(cliente, { signal })` en `mobile/tests/api/eventos.test.ts` (`GET /eventos/mios` con `X-Usuario-Id`), con el stub en `mobile/src/api/eventos.ts` exportado por `mobile/src/api/index.ts`.
- [X] T026 [US2] Implementar `listarMisEventos` en `mobile/src/api/eventos.ts`.
- [X] T027 [US2] Test de `mobile/tests/pantallas/mis-eventos.test.tsx` con `renderConDependencias` y `crearFetchFalso`/`porRuta`. Stubs en el mismo turno: `useMisEventos(usuarioId)` en `mobile/src/features/eventos/useMisEventos.ts`, `FilaEvento` y `MarcaRealizado` en `mobile/src/features/eventos/componentes/`, `MisEventos` en `mobile/src/features/eventos/pantallas/MisEventos.tsx` exportado por `mobile/src/features/eventos/index.ts`, y `mobile/app/(tabs)/mis-eventos.tsx` como re-export (`export { MisEventos as default } from "../../src/features/eventos";`). Casos:
  - cargando;
  - error con "Reintentar";
  - vacío con "Todavía no organizás eventos.";
  - con datos: nombre, `textoFechaHora(fechaHoraLocal)` · categoría, `textoCantidadTipos(n)` y "Realizado" solo en los realizados, en el orden del servidor;
  - `accessibilityLabel` `"Editar <nombre>, <fecha y hora>"` / `"Ver <nombre>, realizado, <fecha y hora>"`;
  - al cambiar de usuario se ven los eventos del nuevo (US2-5).
- [X] T028 [US2] Implementar `useMisEventos` (`claves.misEventos(usuarioId)`), `MarcaRealizado` (texto "Realizado" sobre `tema.colores.neutro`), `FilaEvento` (`Pressable` con `accessibilityRole="button"`; la navegación llega en US3) y `MisEventos` (`SegunConsulta` y `FlatList`) en `mobile/src/features/eventos/`, según `contracts/app.md`, "Mis eventos".

**Checkpoint**: Mis eventos muestra los eventos del seed de cada usuario. La acción de crear de
US2-AS3 y US2-AS4 ("Crear tu primer evento" / "Crear evento") se suma en T051 y se valida al
cerrar US1.

---

## Phase 4: User Story 1 — Crear un evento con sus tipos de entrada (Priority: P1) 🎯 MVP

**Goal**: el organizador crea un evento con uno o más tipos de entrada desde Mis eventos, y el
evento aparece en la lista sin recargar.

**Independent Test**: con un usuario elegido, crear un evento con dos tipos desde la app y verlo
en Mis eventos. Por el lado del servidor, `POST /api/eventos` válido → `201` con el usuario
actual como organizador, y cada dato inválido → `400` con su detalle por campo.

### Backend: categorías

- [X] T029 [P] [US1] Test de `CategoriaService.listar()` en `backend/tests/services/categoria.service.test.ts` (las `CategoriaVista` ordenadas por nombre con el collator `es`), con el stub de `backend/src/services/categoria.service.ts`.
- [X] T030 [US1] Implementar `CategoriaService` en `backend/src/services/categoria.service.ts`.
- [X] T031 [US1] Test de `GET /api/categorias` (público, 6 categorías por nombre) en `backend/tests/api/categorias.test.ts`, con los stubs de `backend/src/controllers/categoria.controller.ts` y `backend/src/routes/categorias.routes.ts`.
- [X] T032 [US1] Implementar `CategoriaController` y `crearCategoriasRouter`, montarlo en `/categorias` en `backend/src/routes/index.ts` y conectarlo en `backend/src/app.ts`. Documentarlo en `backend/src/docs/openapi.json` (tag **Categorías**) y en la colección de Postman.

### Backend: crear evento

- [X] T033 [US1] Test de `Evento.crear(datos, ahora)` en `backend/tests/domain/evento.test.ts`. Casos:
  - `fechaHora` igual a `ahora` → `ReglaDeNegocioError("FECHA_NO_FUTURA")`; `ahora + 1 ms` → se acepta;
  - con fecha futura, se verifican después las invariantes: tipos "VIP" y " vip " → `NOMBRE_TIPO_ENTRADA_REPETIDO`; sin tipos → `DatosInvalidosError`;
  - un tipo con precio 0 se acepta.
- [X] T034 [US1] Implementar la fábrica estática `Evento.crear` en `backend/src/domain/evento.ts`.
- [X] T035 [US1] Validaciones (contracts/api.md, "Reglas de los cuerpos"). En `backend/src/validations/comunes.ts`, `fechaDeParedSchema`: `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/` y fecha real (rechaza `2026-02-30` y `25:00`), con el mensaje "Debe ser una fecha y hora válidas (AAAA-MM-DDTHH:mm)."; transforma a instante con `instanteDesdeHoraDeBuenosAires`. En `backend/src/validations/evento.validation.ts`, el cuerpo de crear:
  - `nombre`: string, `trim`, 1–100 ("Es obligatorio." / "Debe tener como máximo 100 caracteres.");
  - `descripcion`: opcional, `trim`, ≤ 2000, `""` por defecto;
  - `categoriaId`: `idSchema`;
  - `fechaHora`: `fechaDeParedSchema`;
  - `multimedia`: arreglo opcional (≤ 5, "Puede tener como máximo 5 URLs.") de URLs `http`/`https` con `trim` ("Debe ser una URL http o https."), `[]` por defecto;
  - `tiposEntrada`: arreglo ≥ 1 ("El evento necesita al menos un tipo de entrada."), con `nombre` (`trim`, 1–50), `descripcion` (opcional, `trim`, ≤ 300), `precio` (entero ≥ 0: "Debe ser un entero mayor o igual a 0.") y `cupo` (entero ≥ 1: "Debe ser un entero mayor o igual a 1.").
  - Los valores faltantes, `null` o de otro tipo responden "Es obligatorio." (los obligatorios) o el mensaje de la regla. Las claves desconocidas (`organizadorId`) se descartan. Usar `LIMITES_EVENTO` y `LIMITES_TIPO_ENTRADA` de `shared`.
- [X] T036 [US1] Test de `EventoService.crear(usuarioId, datos)` en `backend/tests/services/evento.service.test.ts`, con el stub de `aEventoVista` en `backend/src/services/evento.vistas.ts`. Casos:
  - el organizador es el usuario actual;
  - ids nuevos (UUID) para el evento y sus tipos;
  - categoría inexistente → `EntradaInvalidaError` con detalle `body.categoriaId` "No existe la categoría.", sin guardar nada;
  - `FECHA_NO_FUTURA` con el reloj fijo, sin guardar nada;
  - `EventoVista` con `tiposEntrada` en el orden recibido.
- [X] T037 [US1] Implementar `aEventoVista` y `aTipoEntradaVista` en `backend/src/services/evento.vistas.ts`, y `EventoService.crear` en `backend/src/services/evento.service.ts` (sin cerrojo, `crypto.randomUUID()`).
- [X] T038 [US1] Test de `POST /api/eventos` en `backend/tests/api/eventos.test.ts`. Casos:
  - `201` con el ejemplo del contrato: `organizadorId` del usuario actual, `fechaHora: "2026-12-01T23:00:00.000Z"` y `fechaHoraLocal: "2026-12-01T20:00"`;
  - `401` sin usuario, sin crear nada;
  - `400` con `body.nombre`, `body.categoriaId` (formato e inexistente), `body.fechaHora` (`2026-02-30`, `25:00`, texto libre), `body.multimedia.0` (`ftp://…`), 6 URLs, `body.tiposEntrada` vacío, y `body.tiposEntrada.1.precio` (−1 y 1.5) y `…cupo` (0, −1 y 2.5);
  - nombre solo con espacios → `400`;
  - `409 FECHA_NO_FUTURA` con fecha de ayer;
  - `409 NOMBRE_TIPO_ENTRADA_REPETIDO` con "VIP" y " vip ", y con "Platea" y "Plátea";
  - `"organizadorId": "usuario-sofia"` en el cuerpo se ignora;
  - el evento creado aparece en `GET /api/eventos/mios`.
- [X] T039 [US1] Implementar `EventoController.crear` (`201`) y `POST /` con `requerirUsuario` y la validación en `backend/src/routes/eventos.routes.ts`. Documentar en `backend/src/docs/openapi.json` (esquemas `DatosNuevoEvento`, `EventoVista`, `TipoEntradaVista` y los errores) y en la colección de Postman.

### Mobile

- [X] T040 [P] [US1] Test de `listarCategorias(cliente, { signal })` (`GET /categorias`, sin `X-Usuario-Id`) en `mobile/tests/api/categorias.test.ts`, y de `crearEvento(cliente, datos, { usuarioId })` (`POST /eventos` con el cuerpo como JSON y el `usuarioId` recibido) en `mobile/tests/api/eventos.test.ts`. Stubs en `mobile/src/api/categorias.ts` y `mobile/src/api/eventos.ts`, exportados por `mobile/src/api/index.ts`.
- [X] T041 [US1] Implementar `listarCategorias` y `crearEvento`.
- [X] T042 [P] [US1] Feature `categorias`: `useCategorias()` (`claves.categorias()`) en `mobile/src/features/categorias/useCategorias.ts` y `mobile/src/features/categorias/index.ts`.
- [X] T043 [P] [US1] Test de `mobile/tests/features/eventos/fecha-de-pared.test.ts` con el stub de `mobile/src/features/eventos/fecha-de-pared.ts`. `aFechaDelSelector("2026-12-01T20:00")` → `Date` con componentes locales 2026-12-01 20:00, y `aFechaDePared(date)` → `"YYYY-MM-DDTHH:mm"`. La ida y vuelta conserva los componentes con `process.env.TZ` = `Asia/Tokyo`, `America/New_York` y `UTC`. Un caso con una zona con horario de verano fija el comportamiento aceptado en la hora que no existe (R11, riesgo conocido).
- [X] T044 [US1] Implementar `mobile/src/features/eventos/fecha-de-pared.ts` con `getFullYear`/`getMonth`/`getDate`/`getHours`/`getMinutes` y `new Date(a, m − 1, d, h, min)`.
- [X] T045 [P] [US1] Test de `mobile/tests/features/eventos/errores-de-formulario.test.ts` con el stub de `mobile/src/features/eventos/errores-de-formulario.ts`. Casos:
  - `400` `body.nombre` → `nombre`;
  - `body.multimedia.0` → imagen 1;
  - `body.tiposEntrada.1.precio` → tipo 1, precio;
  - `409 FECHA_NO_FUTURA` → `fechaHora`;
  - `409 NOMBRE_TIPO_ENTRADA_REPETIDO` → la sección de tipos (formulario de crear) o `nombre` (formulario de tipo);
  - cualquier otro error → `mensajeGeneral` con el mensaje del servidor.
  - El resultado es `Record<campo, mensaje>` más `mensajeGeneral` (data-model, "Mobile").
- [X] T046 [US1] Implementar `mobile/src/features/eventos/errores-de-formulario.ts`. Incluir la conversión de texto a número de R13: `/^\d+$/` → número, vacío → `null`, si no, el texto tal cual.
- [X] T047 [US1] Test de `mobile/tests/pantallas/crear-evento.test.tsx` con `renderConDependencias` y `jest.spyOn(Alert, "alert")`. Stubs en el mismo turno: `CrearEvento` en `mobile/src/features/eventos/pantallas/CrearEvento.tsx` (export por `index.ts`), `mobile/app/eventos/nuevo.tsx` (re-export), `useCrearEvento` en `mobile/src/features/eventos/mutaciones.ts`, `useConfirmarDescarte({ habilitado })` en `mobile/src/features/eventos/useConfirmarDescarte.ts` y los componentes `CamposEvento`, `SelectorCategoria`, `SelectorFechaHora` y `CamposTipoEntrada` en `mobile/src/features/eventos/componentes/`. Casos de **formulario y envío**:
  - Mis eventos con datos muestra "Crear evento", y vacío muestra "Crear tu primer evento"; los dos llevan a la pantalla;
  - completar todo, elegir la fecha con el selector simulado y guardar → `POST /eventos` con `fechaHora` de pared y el `usuarioId` del formulario; vuelve a Mis eventos sin diálogo y el evento aparece (invalidación de `misEventos` y `usuarios`);
  - "Creando…" deshabilita el botón;
  - "Quitar tipo 1" está deshabilitado con un solo tipo; "Agregar otro tipo de entrada" suma una tarjeta;
  - "Agregar imagen" se deshabilita con 5 URLs ("Máximo 5 imágenes");
  - categoría con `accessibilityRole="radio"` y `checked`, y sus estados "Cargando categorías…" y error con "Reintentar";
  - la fecha muestra "Sin elegir" y la nota "Hora de Buenos Aires", sin campo de texto.
- [X] T048 [US1] Test de **errores y descarte** en `mobile/tests/pantallas/crear-evento.test.tsx` (se amplía; usa los stubs de T047, sin stubs nuevos). Casos:
  - `400` → cada detalle debajo de su campo (también `body.tiposEntrada.1.cupo` en la tarjeta 2) y lo cargado sigue;
  - `409 FECHA_NO_FUTURA` debajo de Fecha y hora;
  - `409 NOMBRE_TIPO_ENTRADA_REPETIDO` arriba de la sección de tipos;
  - otro error en el aviso arriba del botón;
  - `fetch` rechazado al guardar → se ve la franja "Servidor no disponible", no sale un segundo `POST` y los campos siguen cargados (Edge Cases "Servidor no disponible" y "Doble envío");
  - atrás → "¿Descartar los cambios?": "Seguir editando" conserva lo cargado y "Descartar" sale; se pregunta también sin cambios;
  - un 401 que olvida al usuario sale sin diálogo y no envía en nombre de otro usuario (R12).
- [X] T049 [US1] Implementar `useConfirmarDescarte` (`usePreventRemove` de `expo-router` y `Alert.alert` con "Seguir editando" (cancel) y "Descartar" (destructive), que hace `navigation.dispatch(data.action)`; `habilitado` es `false` tras un éxito, si la fase deja de ser `con-usuario` o cambia el `usuarioId`, y ante un 404) en `mobile/src/features/eventos/useConfirmarDescarte.ts`. Implementar `useCrearEvento` en `mobile/src/features/eventos/mutaciones.ts` (invalida `claves.misEventos(usuarioId)` y `claves.usuarios()` al terminar, sin reintentos).
- [X] T050 [US1] Implementar `SelectorCategoria` (opciones con `flexWrap`), `SelectorFechaHora` (`DateTimePickerAndroid.open({ mode, is24Hour: true })` en Android, el componente en iOS, sin `minimumDate`, valor inicial = fecha del teléfono solo como punto de partida), `CamposEvento` (nombre con `maxLength` 100 y `accessibilityLabel` "Nombre del evento", descripción multilínea con `maxLength` 2000, imágenes con "Quitar imagen N") y `CamposTipoEntrada` (precio y cupo con `number-pad`, nota "0 = gratis", etiquetas con número: "Precio del tipo 2") en `mobile/src/features/eventos/componentes/`. Los errores van en `tema.colores.peligro` con `accessibilityLiveRegion="polite"`.
- [X] T051 [US1] Implementar `CrearEvento` en `mobile/src/features/eventos/pantallas/CrearEvento.tsx` (`ScrollView`, estado del formulario de data-model con una fila de tipo desde el inicio y botón "Crear evento" / "Creando…"). Agregar los botones "Crear evento" y "Crear tu primer evento" a `MisEventos`, y `Stack.Screen name="eventos/nuevo"` ("Crear evento") en el `Stack.Protected` de `con-usuario` de `mobile/src/navegacion/LayoutRaiz.tsx`.

**Checkpoint**: MVP completo (US2 + US1). Se crea un evento desde la app y aparece en Mis eventos.

---

## Phase 5: User Story 3 — Editar un evento y sus tipos de entrada (Priority: P2)

**Goal**: el organizador edita los datos de un evento no realizado y agrega, edita o quita sus
tipos de a uno. Un evento realizado se abre en solo lectura.

**Independent Test**: editar el nombre y la fecha de Noche de Rock y verlo en su nueva posición;
agregar, editar y quitar un tipo; por el lado del servidor, cada regla (realizado, tipo con
compras, último tipo, nombre repetido, sin permiso, no encontrado).

### Backend: dominio

- [X] T052 [US3] Test de las operaciones en `backend/tests/domain/evento.test.ts`. Cada una devuelve un `Evento` **nuevo** y el original no cambia. Casos:
  - `actualizar(datos, ahora)`: `EVENTO_REALIZADO` (en el borde) antes que `FECHA_NO_FUTURA`; conserva `id`, `organizadorId` y `tiposEntrada`;
  - `agregarTipoEntrada(tipo, ahora)`: `EVENTO_REALIZADO`; cupo 0 → `DatosInvalidosError`; nombre repetido sin mayúsculas ni tildes → `NOMBRE_TIPO_ENTRADA_REPETIDO`; queda al final;
  - `editarTipoEntrada(tipoId, datos, ahora)`: `EVENTO_REALIZADO`; conservar el propio nombre (o cambiarle solo mayúsculas o tildes) se acepta; el nombre de **otro** tipo → `NOMBRE_TIPO_ENTRADA_REPETIDO`; cupo 0 se acepta (agotado); tipo inexistente → error (red de seguridad);
  - `quitarTipoEntrada(tipoId, { ahora, tieneCompras })`: `EVENTO_REALIZADO`, después `ULTIMO_TIPO_ENTRADA` y después `TIPO_ENTRADA_CON_COMPRAS`, en ese orden.
- [X] T053 [US3] Implementar `actualizar`, `agregarTipoEntrada`, `editarTipoEntrada` y `quitarTipoEntrada` en `backend/src/domain/evento.ts`, construyendo siempre con el constructor para volver a verificar las invariantes (R7).

### Backend: validaciones y services

- [X] T054 [US3] Validaciones:
  - en `backend/src/validations/evento.validation.ts`, `params.eventoId` con `idSchema` y el cuerpo de editar (`DatosEvento`, las mismas reglas de crear sin `tiposEntrada`);
  - en `backend/src/validations/tipo-entrada.validation.ts` (nuevo), `params.eventoId` y `params.tipoEntradaId` con `idSchema`, y los cuerpos de crear (`cupo` entero ≥ 1: "Debe ser un entero mayor o igual a 1.") y de editar (`cupo` entero ≥ 0: "Debe ser un entero mayor o igual a 0."), con `nombre` (`trim`, 1–50), `descripcion` (opcional, `trim`, ≤ 300) y `precio` (entero ≥ 0).
- [X] T055 [US3] Test de `EventoService.obtener(id)` (404 `EVENTO_NO_ENCONTRADO`) y `actualizar(id, usuarioId, datos)` en `backend/tests/services/evento.service.test.ts`. El orden es `404 → 403 → 400 categoría → 409 EVENTO_REALIZADO → 409 FECHA_NO_FUTURA`, y nada se guarda cuando falla. Los tipos no se tocan.
- [X] T056 [US3] Implementar `obtener`, `actualizar` y `#obtenerOFallar` en `backend/src/services/evento.service.ts`. `actualizar` corre bajo `cerrojo.ejecutar(id, …)`, con la relectura y `reloj.ahora()` adentro. Los errores 404 y 403 salen de `errors/` (403 "Solo el organizador puede modificar este evento."). Sumar `cerrojo` al constructor de `EventoService`, y crear en `backend/src/app.ts` la **única** instancia de `CerrojoPorClave` para pasársela (T062 le pasa la misma a `TipoEntradaService`).
- [X] T057 [US3] Test de `backend/tests/services/tipo-entrada.service.test.ts` con el stub de `backend/src/services/tipo-entrada.service.ts` (constructor `{ eventos, compras, cerrojo, reloj }`; `crear(eventoId, usuarioId, datos)`, `actualizar(eventoId, tipoId, usuarioId, datos)`, `eliminar(eventoId, tipoId, usuarioId)`). Casos:
  - orden `404 evento → 403 → 404 TIPO_ENTRADA_NO_ENCONTRADO` (también para un tipo que existe en **otro** evento, FR-023) `→ 409`;
  - `TIPO_ENTRADA_CON_COMPRAS` con una compra `CANCELADA`;
  - cambiar el precio de un tipo con compras se acepta y el `total` de la compra no cambia (FR-015);
  - crear devuelve un UUID nuevo;
  - nada se guarda cuando falla.
- [X] T058 [US3] Implementar `TipoEntradaService` en `backend/src/services/tipo-entrada.service.ts`, con `#obtenerEventoOFallar` y `#obtenerTipoOFallar(evento, tipoId)`, y cada escritura bajo el cerrojo del evento (flujo de data-model, "Services").
- [X] T059 [US3] Test de concurrencia en `backend/tests/services/concurrencia.test.ts` (`Promise.all`, con los dos services compartiendo un `CerrojoPorClave`). Casos:
  - dos tipos "VIP" agregados a la vez → uno se crea y el otro da `NOMBRE_TIPO_ENTRADA_REPETIDO`;
  - dos tipos distintos agregados a la vez → quedan los dos (sin actualización perdida);
  - dos tipos renombrados a la vez al mismo nombre → uno da `200` y el otro `NOMBRE_TIPO_ENTRADA_REPETIDO`;
  - quitar a la vez los dos tipos de un evento con dos → uno se quita y el otro da `ULTIMO_TIPO_ENTRADA`;
  - una operación sobre el evento A bloqueada a propósito → una sobre el evento B termina antes (FR-029, SC-008).

### Backend: API

- [X] T060 [US3] Test de `GET /api/eventos/:eventoId` (público: `200` con `EventoVista`, `400` con un id mal formado, `404`) y `PUT /api/eventos/:eventoId` en `backend/tests/api/eventos.test.ts`. Para el `PUT`: `200`; `401`; `400`; `403` (Lucía sobre `evento-hamlet`); `404`; `409 EVENTO_REALIZADO` (Sofía sobre `evento-noche-de-risas`); `409 FECHA_NO_FUTURA`. Además, un pedido rechazado no deja nada modificado (`GET` posterior igual).
- [X] T061 [US3] Test de `POST`, `PUT` y `DELETE /api/eventos/:eventoId/tipos-entrada[/:tipoEntradaId]` en `backend/tests/api/tipos-entrada.test.ts`, con los stubs de `backend/src/controllers/tipo-entrada.controller.ts` y del router hijo. Casos: `201` / `200` / `204`; `401`; `400` (cupo 0 al crear, −1 al editar, ids mal formados); `403`; `404 EVENTO_NO_ENCONTRADO`; `404 TIPO_ENTRADA_NO_ENCONTRADO` (`tipo-hamlet-platea` en Noche de Rock); `409 EVENTO_REALIZADO`; `NOMBRE_TIPO_ENTRADA_REPETIDO`; `ULTIMO_TIPO_ENTRADA` (General de Noche de Rock); `TIPO_ENTRADA_CON_COMPRAS` (General del Festival, con compra `CANCELADA`); `204` al quitar Backstage del Festival.
- [X] T062 [US3] Implementar `EventoController.obtener` y `actualizar`, y las rutas `GET /:eventoId` (público) y `PUT /:eventoId` (`requerirUsuario`) en `backend/src/routes/eventos.routes.ts`. Implementar `TipoEntradaController` en `backend/src/controllers/tipo-entrada.controller.ts` y el router hijo `Router({ mergeParams: true })` montado en `/:eventoId/tipos-entrada` (todas las rutas con `requerirUsuario`). Conectar `TipoEntradaService` y `TipoEntradaController` en `backend/src/app.ts`, con el **mismo** cerrojo que `EventoService`.
- [X] T063 [US3] Documentar `GET` y `PUT /api/eventos/{eventoId}` y los tres endpoints de **Tipos de entrada** en `backend/src/docs/openapi.json` (esquemas `DatosEvento` y `DatosTipoEntrada`, y cada código de error de `contracts/api.md`), y sumarlos a la colección de Postman. `backend/tests/api/docs.test.ts` en verde.

### Mobile

- [ ] T064 [P] [US3] Test de `obtenerEvento`, `actualizarEvento`, `agregarTipoEntrada`, `editarTipoEntrada` y `quitarTipoEntrada` (método, ruta, cuerpo y `X-Usuario-Id` del `usuarioId` recibido; `DELETE` → `undefined`) en `mobile/tests/api/eventos.test.ts`, con los stubs en `mobile/src/api/eventos.ts`.
- [ ] T065 [US3] Implementar esas cinco funciones en `mobile/src/api/eventos.ts`.
- [ ] T066 [US3] Rutas: los stubs de `EventoDelOrganizador`, `AgregarTipoEntrada` y `EditarTipoEntrada` en `mobile/src/features/eventos/pantallas/` (export por `index.ts`), y sus re-exports en `mobile/app/eventos/[eventoId]/index.tsx`, `mobile/app/eventos/[eventoId]/tipos-entrada/nuevo.tsx` y `mobile/app/eventos/[eventoId]/tipos-entrada/[tipoEntradaId].tsx`. Sumar los `Stack.Screen` (títulos "Evento" como inicial de `eventos/[eventoId]/index`, que `EventoDelOrganizador` cambia en T068; "Agregar tipo de entrada" y "Editar tipo de entrada") al `Stack.Protected` de `con-usuario` de `mobile/src/navegacion/LayoutRaiz.tsx`. En `mobile/tests/tipos/rutas-tipadas.ts`, sumar el caso `@ts-expect-error` del `pathname` `/eventos/[eventoId]` sin `params`.
- [ ] T067 [US3] Test de `mobile/tests/pantallas/editar-evento.test.tsx`, con los stubs de `useEvento(usuarioId, eventoId)` en `mobile/src/features/eventos/useEvento.ts`, de las mutations `useActualizarEvento` y `useQuitarTipoEntrada` en `mutaciones.ts`, y de `EditarEvento` y `ListaTiposEntrada`. Casos:
  - tocar una fila de Mis eventos lleva a `/eventos/[eventoId]`;
  - el header dice "Editar evento", y tras un `409 EVENTO_REALIZADO` pasa a "Evento realizado";
  - datos precargados desde `fechaHoraLocal`;
  - "Guardar cambios" / "Guardando…" → `PUT`, vuelve sin diálogo y la lista muestra el cambio en su nueva posición;
  - `400` y `FECHA_NO_FUTURA` junto al campo;
  - la lista de tipos con `textoPrecio` y `textoCupo`;
  - "Quitar <nombre>" → "¿Quitar <nombre>?" con Cancelar / Quitar;
  - `ULTIMO_TIPO_ENTRADA`, `TIPO_ENTRADA_CON_COMPRAS` y `403` → aviso con el mensaje del servidor;
  - `EVENTO_REALIZADO` → la misma ruta pasa a solo lectura con el aviso "El evento ya se realizó: no se puede modificar.";
  - `404` → `Alert` "El evento ya no existe." y vuelta a Mis eventos con `router.dismissTo("/mis-eventos")`, sin diálogo de descarte;
  - `fetch` rechazado al guardar → franja "Servidor no disponible", sin un segundo `PUT` y con los campos cargados;
  - atrás → "¿Descartar los cambios?".
- [ ] T068 [US3] Implementar `useEvento` (`claves.evento(usuarioId, eventoId)`), `useActualizarEvento` y `useQuitarTipoEntrada` (invalidan `misEventos` y `evento` al terminar), `ListaTiposEntrada` ("Editar <nombre>", "Quitar <nombre>" y "Agregar tipo de entrada"), `EditarEvento` (secciones "Datos del evento" y "Tipos de entrada" con `accessibilityRole="header"`, reutilizando `CamposEvento` y `useConfirmarDescarte`) y `EventoDelOrganizador` (elige `EditarEvento` o `VerEventoRealizado` según el `realizado` del servidor, nunca el reloj del teléfono, y fija el título con `<Stack.Screen options={{ title }} />`: "Editar evento" / "Evento realizado") en `mobile/src/features/eventos/`. En `FilaEvento`, el `onPress` navega a `/eventos/[eventoId]`.
- [ ] T069 [P] [US3] Test de `mobile/tests/pantallas/evento-realizado.test.tsx` con el stub de `VerEventoRealizado`. El header dice "Evento realizado". Muestra "Realizado", la categoría, la fecha, la descripción, las URLs como texto y los tipos con precio y cupo disponible; no tiene acciones de editar, agregar, quitar ni eliminar; al salir no pregunta (FR-006a).
- [ ] T070 [US3] Implementar `VerEventoRealizado` en `mobile/src/features/eventos/pantallas/`.
- [ ] T071 [US3] Test de `mobile/tests/pantallas/tipo-entrada.test.tsx` con los stubs de `useAgregarTipoEntrada` y `useEditarTipoEntrada`. Casos:
  - agregar → `POST` y vuelta a Editar evento con el tipo nuevo;
  - editar con la etiqueta "Cupo disponible", precargado → `PUT`, y "Guardar cambios" vuelve;
  - `NOMBRE_TIPO_ENTRADA_REPETIDO` debajo de Nombre;
  - `400` junto a cada campo;
  - `EVENTO_REALIZADO` vuelve a la ruta del evento en solo lectura;
  - `404` del tipo o del evento vuelve a Mis eventos sin diálogo;
  - `fetch` rechazado al guardar → franja "Servidor no disponible", sin reenviar y con los campos cargados;
  - atrás → "¿Descartar los cambios?".
- [ ] T072 [US3] Implementar `useAgregarTipoEntrada` y `useEditarTipoEntrada` en `mutaciones.ts`, y las pantallas `AgregarTipoEntrada` y `EditarTipoEntrada` (reutilizando `CamposTipoEntrada` y `useConfirmarDescarte`) en `mobile/src/features/eventos/pantallas/`.

**Checkpoint**: US1, US2 y US3 funcionan solas y juntas.

---

## Phase 6: User Story 4 — Eliminar un evento (Priority: P3)

**Goal**: el organizador elimina un evento propio no realizado y sin compras, después de
confirmar.

**Independent Test**: crear un evento, eliminarlo confirmando y ver que no está en Mis eventos;
cancelar la confirmación y ver que sigue; por el lado del servidor, el rechazo de un evento
realizado, con compras, ajeno o inexistente.

- [X] T073 [US4] Test de `verificarQueSePuedeEliminar({ ahora, tieneCompras })` en `backend/tests/domain/evento.test.ts`: `EVENTO_REALIZADO` (en el borde) antes que `EVENTO_CON_COMPRAS`, y sin error si se puede eliminar.
- [X] T074 [US4] Implementar `verificarQueSePuedeEliminar` en `backend/src/domain/evento.ts`.
- [X] T075 [US4] Test de `EventoService.eliminar(id, usuarioId)` en `backend/tests/services/evento.service.test.ts`: orden `404 → 403 → 409`; `EVENTO_CON_COMPRAS` con una compra `CANCELADA`; nada se elimina cuando falla. Sumar a `backend/tests/services/concurrencia.test.ts` el caso de eliminar el evento mientras una operación simulada de la 006 guarda una compra bajo el **mismo** cerrojo: o se elimina y la compra ve el evento inexistente, o la compra entra primero y eliminar da `EVENTO_CON_COMPRAS`.
- [X] T076 [US4] Implementar `EventoService.eliminar` en `backend/src/services/evento.service.ts` (bajo el cerrojo: relectura, `compras.existePorEvento`, `verificarQueSePuedeEliminar` y `eventos.eliminarPorId`). Sumar `compras` al constructor de `EventoService` y a su conexión en `backend/src/app.ts`.
- [X] T077 [US4] Test de `DELETE /api/eventos/:eventoId` en `backend/tests/api/eventos.test.ts`: `204` (Noche de Rock; después, `GET` → `404`); `401`; `400`; `403`; `404`; `409 EVENTO_REALIZADO`; `409 EVENTO_CON_COMPRAS` (Festival).
- [X] T078 [US4] Implementar `EventoController.eliminar` (`204`) y `DELETE /:eventoId` con `requerirUsuario` en `backend/src/routes/eventos.routes.ts`. Documentarlo en `backend/src/docs/openapi.json` y en la colección de Postman.
- [ ] T079 [P] [US4] Test de `eliminarEvento(cliente, eventoId, { usuarioId })` (`DELETE /eventos/:eventoId` → `undefined`) en `mobile/tests/api/eventos.test.ts`, con el stub en `mobile/src/api/eventos.ts`.
- [ ] T080 [US4] Implementar `eliminarEvento` en `mobile/src/api/eventos.ts`.
- [ ] T081 [US4] Test en `mobile/tests/pantallas/editar-evento.test.tsx` (se amplía) con el stub de `useEliminarEvento`. Casos:
  - "Eliminar evento" (variante `aviso`) → "¿Eliminar "<nombre>"?" / "Esta acción no se puede deshacer.";
  - Cancelar no envía nada;
  - Eliminar → `DELETE`, vuelve a Mis eventos sin diálogo de descarte y el evento ya no está;
  - `EVENTO_CON_COMPRAS` → aviso con el mensaje del servidor;
  - el botón queda deshabilitado mientras se elimina.
- [ ] T082 [US4] Implementar `useEliminarEvento` en `mobile/src/features/eventos/mutaciones.ts` (invalida `misEventos`, `evento` y `usuarios`) y la sección final con "Eliminar evento" en `EditarEvento`.

**Checkpoint**: las cuatro historias están completas.

---

## Phase 7: Polish y transversales

**Purpose**: documentación, convenciones, validación de punta a punta y cierre.

- [ ] T083 [P] Corregir los comentarios con la numeración vieja de features en `backend/src/repositories/evento.repository.ts` y `backend/src/domain/evento.ts` (quickstart, "Cierre").
- [ ] T084 [P] Actualizar `AGENTS.md`:
  - en la tabla de convención de nombres, `listarPor<Criterio>(...)` (R6);
  - el `Reloj` inyectado (`domain/reloj.ts`, `config/reloj.ts`, `crearApp({ reloj })`);
  - `CerrojoPorClave` y sus cuatro reglas de uso (R2);
  - los recursos `categorias`, `eventos`, `tipos-entrada` y `compras` (mínimo);
  - las features mobile `eventos` y `categorias`, y `useConfirmarDescarte`.
- [ ] T085 [P] En `docs/backlog.md`, pasar la 004 a `en PR` y sumar la 004 a las dependencias de la 006 (tabla y grafo).
- [ ] T086 Revisar en 360 px y con TalkBack: sin desplazamiento horizontal, etiquetas en todos los controles, errores anunciados y sin valores sueltos fuera del `tema` (SC-007). Ajustar lo que haga falta en `mobile/src/features/eventos/`.
- [ ] T087 Correr `npm test`, `npm run lint`, `npm run typecheck` y `npm run format:check` desde la raíz, y dejar las cuatro en verde.
- [ ] T088 Validar a mano las secciones 2 (API) y 3 (app en el celular) de `specs/004-crear-evento/quickstart.md` y anotar cualquier desvío. En el paso 2 de la app, cronometrar la creación de un evento con dos tipos: menos de 3 minutos y sin escribir la fecha ni la hora (SC-001).
- [ ] T089 Abrir el PR de `feature/004-crear-evento` a `development` con las cuatro verificaciones del CI en verde.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T001 ya está hecha.
- **Foundational (Phase 2)**: depende de Setup (T003 para los tipos). **Bloquea todas las
  historias**.
- **US2 (Phase 3)**: depende de Foundational.
- **US1 (Phase 4)**: depende de Foundational y de US2. Del lado del backend solo usa
  Foundational. En mobile agrega la acción de crear a `MisEventos`.
- **US3 (Phase 5)**: depende de US1, porque reutiliza `CamposEvento`, `CamposTipoEntrada`,
  `useConfirmarDescarte`, `errores-de-formulario`, las validaciones de crear y `aEventoVista`.
- **US4 (Phase 6)**: depende de US3, porque el botón vive en `EditarEvento` y usa
  `GET /:eventoId`. El backend de US4 (T073–T078) solo depende de Foundational, de T023 y de T056 (que crea
  el cerrojo).
- **Polish (Phase 7)**: depende de las historias que se quieran entregar.

### Within Each User Story

- Test con stub → verlo fallar → implementar.
- Dominio → validaciones → services → controllers y rutas → OpenAPI y Postman.
- `src/api/` → hooks y mutations → componentes → pantalla y ruta.
- Las tareas sobre el mismo archivo (`evento.test.ts`, `evento.service.test.ts`,
  `eventos.test.ts`, `mutaciones.ts`, `LayoutRaiz.tsx`) son secuenciales.

### Parallel Opportunities

- **Phase 2**: T004, T006, T007, T009, T017 y T018 en paralelo (archivos distintos). T015 puede
  correr en paralelo con el bloque cerrojo/compra.
- **Backend y mobile de una misma historia** avanzan en paralelo una vez que están los tipos de
  `shared/` (T003). Por ejemplo, T025–T028 en paralelo con T020–T024.
- **US1**: el bloque de categorías (T029–T032) en paralelo con `Evento.crear` (T033–T034). En
  mobile, T040, T042, T043 y T045 en paralelo.
- **US3**: T064 y T069 en paralelo con el backend.
- **US4**: el backend (T073–T078) puede adelantarse a la par de US3 mobile.

---

## Parallel Example: Phase 2

```text
Task: "T004 Test de hora-buenos-aires con stub en backend/src/domain/hora-buenos-aires.ts"
Task: "T007 Test de CerrojoPorClave con stub en backend/src/services/cerrojo-por-clave.ts"
Task: "T009 Test de Compra con stub en backend/src/domain/compra.ts"
Task: "T018 Test de formato con stub en mobile/src/features/eventos/formato.ts"
```

## Parallel Example: User Story 1

```text
Task: "T029 Test de CategoriaService en backend/tests/services/categoria.service.test.ts"
Task: "T033 Test de Evento.crear en backend/tests/domain/evento.test.ts"
Task: "T043 Test de fecha-de-pared en mobile/tests/features/eventos/fecha-de-pared.test.ts"
Task: "T045 Test de errores-de-formulario en mobile/tests/features/eventos/errores-de-formulario.test.ts"
```

---

## Implementation Strategy

### MVP primero (US2 + US1)

1. Phase 1 y Phase 2 completas.
2. Phase 3 (US2): Mis eventos con el seed. **Validar**: Lucía, Sofía y un usuario sin eventos.
3. Phase 4 (US1): crear evento. **Validar**: crear con dos tipos y verlo en la lista.
4. Las cuatro verificaciones en verde. Es una entrega demostrable de UC-04.

### Entrega incremental

1. MVP (US2 + US1).
2. US3: editar, tipos de entrada y vista de solo lectura. Validar con el Festival y Noche de
   risas.
3. US4: eliminar. Validar con Noche de Rock y el Festival.
4. Polish y PR.

---

## Notes

- [P] = archivo distinto y sin dependencias pendientes.
- Cada historia es verificable sola en su checkpoint.
- Si una tarea obliga a decidir algo que el plan o la spec no cubren, se frena y se consulta
  (no se inventa la regla).
- Riesgo de R12: si el test del 401 con el formulario abierto (T048) muestra que el guard
  remueve la ruta antes de que `useConfirmarDescarte` se actualice, aplicar el plan B
  (`key={usuarioId}` en el `Stack.Protected` de `con-usuario`) y registrarlo en `research.md`.
