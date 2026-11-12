---

description: "Tareas de implementación de la feature 006 — Comprar entradas"
---

# Tasks: Comprar entradas

**Input**: documentos de diseño en `specs/006-comprar-entradas/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md),
[contracts/app.md](./contracts/app.md), [quickstart.md](./quickstart.md)

**Tests**: obligatorios (constitución II, SC-005): cada regla con su caso borde en `domain`,
`repositories`, `services` (reloj fijo y movible, repositorios armados por caso, concurrencia) y
`api`; en mobile, `api/`, `formato`, el componente base nuevo y las pantallas con
`renderConDependencias`.

**Organización**: una fase por historia de usuario, en el orden de la spec (US1 y US2 son P1 y
forman el MVP; US3 es P2; US4 es P3). La `Compra` con historial, el vencimiento perezoso y el cupo
**al día** van en Foundational: el alta (US1) ya necesita materializar los vencimientos bajo el
cerrojo y contar solo las compras vigentes para el tope, y las ediciones de la 004 tienen que
materializarlos antes de guardar (R3).

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: puede hacerse en paralelo (archivo distinto, sin dependencias pendientes).
- **[Story]**: historia a la que pertenece (US1–US4).
- Rutas relativas a la raíz del repo.

## Convenciones para todas las tareas

- **Test primero con stub en el mismo turno** (AGENTS.md): el hook `Stop` exige typecheck y lint
  en verde al cerrar cada turno. Cada tarea "Test" crea **en el mismo turno** los módulos que
  importa como **stub con la firma real** que lanza `new Error("no implementado")` (un componente
  que devuelve `null`, una ruta de `app/` con su re-export). Se corre el test con `test:foco`,
  **se lo ve fallar** por comportamiento y recién en la tarea siguiente se implementa. Las tareas
  que dicen "Test … Luego implementar" son el mismo ciclo en dos turnos.
- Endpoints: seguir la skill **`nuevo-endpoint`**. Pantallas, hooks y funciones de `src/api/`:
  seguir la skill **`nueva-pantalla`**.
- Backend en capas: `domain/` puro (sin Express, sin `errors/`, sin reloj: `ahora` llega como
  argumento); cada service escribe **solo su agregado** y pide lo ajeno a su dueño
  (`CompraService` → `EventoService`, `TipoEntradaService`; `EventoService` →
  `VencimientoService`), sin ciclos (R4); el controller solo lee lo ya validado; la forma va en
  `validations/`; `app.ts` es el único que instancia y conecta, en el orden
  `VencimientoService → EventoService → TipoEntradaService → CompraService`.
- **Cerrojo por evento** (AGENTS.md): el alta, el pago y toda escritura de la 004 corren bajo
  `cerrojo.ejecutar(eventoId, …)`, leen `reloj.ahora()` **una vez adentro**, releen evento y
  compras, verifican y recién después guardan. `obtenerAlDia`, `buscarReferenciada` y
  `descontarCupo` se usan **dentro** del cerrojo del que llama y no lo toman (sin cerrojos
  anidados). Las lecturas (`obtener`, `listar`, `mis-compras`, `GET /compras/:id`) no lo usan y no
  guardan nada.
- **Orden de guardado** (R8): alta → primero el evento con el cupo descontado, después la compra;
  vencimiento → primero las compras `CANCELADA`, después el evento con el cupo devuelto. Una
  lectura intermedia nunca ve cupo de más.
- **Sin N+1**: las lecturas al día hacen **una** `listarPendientesPorEventos` por pedido.
- **Dependencias al usarse**: un constructor recibe solo las dependencias que ya usa algún método
  (si no, fallan `no-unused-vars` / `no-unused-private-class-members` y el hook `Stop`).
- Orden de chequeos (R2): alta `401 → 400 forma → 404 evento → 400 body.tipoEntradaId → 409
  EVENTO_REALIZADO → 409 COMPRA_PROPIO_EVENTO → 409 TOPE_POR_PERSONA → 409 CUPO_INSUFICIENTE`;
  pago `401 → 400 id → 404 COMPRA_NO_ENCONTRADA → 403 SIN_PERMISO → 409 COMPRA_VENCIDA → 409
  TRANSICION_INVALIDA`. Los 404/403 los lanza el service con `errors/`; los 409, `domain/` con
  `ReglaDeNegocioError`.
- Mensajes de error: los textos exactos de `contracts/api.md` y `data-model.md` ("Errores de
  dominio nuevos"). Textos de la app: los de `contracts/app.md`, que son los que buscan los tests.
- Mobile: imports relativos sin alias `@/`; desde afuera de una feature solo su `index.ts`
  (adentro, por archivo); `features/compras` importa de `features/eventos` y `features/sesion`
  por su `index.ts`, y `features/eventos` **nunca** importa `features/compras` (R12); `app/` solo
  re-exports de una línea; todo `fetch` en `src/api/`; estilos con `StyleSheet` y valores del
  `tema`; textos con `...tema.tipografia.<estilo>` (nunca `fontWeight`).
- `DetalleEvento` y `ListaTiposEntrada` se amplían **solo con props opcionales**: los tests de la
  004 y la 005 siguen en verde sin cambios.
- Prohibidos `any`, `@ts-ignore` y `eslint-disable` sin descripción (principio IX).
- Commits: Conventional Commits con scope `006-comprar-entradas`, uno por tarea o grupo
  coherente. Cada fase cierra con la suite completa en verde, sus tareas marcadas y su commit.

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: tipos compartidos nuevos (aditivos, no rompen nada) y estado del backlog.

- [X] T001 [P] En `docs/backlog.md`, pasar la 006 de `plan` a `tasks`.
- [X] T002 Crear `shared/src/compra.ts` con lo de data-model ("Tipos compartidos"), con su JSDoc: `LIMITES_COMPRA = { entradasPorEvento: 4, entradasPorTipoGratis: 1, minutosParaPagar: 15 } as const`; `DatosCompra { tipoEntradaId: string; cantidad: number }` ("nunca lleva precio ni total"); `AutorCambioEstadoVista = { tipo: "usuario"; usuarioId: string } | { tipo: "sistema" }`; `CambioEstadoCompraVista { estado: EstadoCompra; autor; fechaHora: string /* ISO UTC */; fechaHoraLocal: string /* "YYYY-MM-DDTHH:mm" Buenos Aires */ }`; `CompraVista { id; compradorId; evento: { id; nombre; fechaHora; fechaHoraLocal; realizado }; tipoEntrada: { id; nombre }; cantidad; total /* pesos enteros; 0 = gratis */; estado; creadaEn; venceEn: string | null /* null si no está PENDIENTE */; venceEnLocal: string | null; historial: CambioEstadoCompraVista[] /* cronológico; el primero siempre PENDIENTE */ }`; `MisComprasDelEventoVista { pendientes: CompraVista[] /* PENDIENTE no vencidas, de la más vieja a la más nueva */; restantesPorTipo: { tipoEntradaId: string; restantes: number }[] /* todos los tipos; 0 si es el organizador */ }`. Exportarlos en `shared/src/index.ts` (`LIMITES_COMPRA` como valor). Extender `backend/tests/domain/tipos-compartidos.test.ts` con los tres valores de `LIMITES_COMPRA`.

---

## Phase 2: Foundational (prerequisitos bloqueantes)

**Purpose**: `Compra` con historial y vencimiento, el repositorio ampliado, `VencimientoService`,
el cupo al día en las lecturas de eventos y la materialización de vencimientos en las escrituras
de la 004. Lo usan el alta (US1), el pago (US2) y todas las lecturas.

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

### `Compra` con historial (dominio)

- [X] T003 Test de `backend/tests/domain/compra.test.ts` (se reescribe) con el stub de la `Compra` nueva en `backend/src/domain/compra.ts` (data-model, "`CambioEstadoCompra` y `Compra`"): `type AutorDelCambio`, `interface CambioEstadoCompra { estado; autor; fechaHora: Date }`, `PropiedadesCompra` **sin** `estado` y con `historial: CambioEstadoCompra[]`; getters `estado`, `creadaEn`, `venceEn`; `estaVencida(ahora)`, `fueVencida()`, `esVigente(ahora)`, `esGratis()`, `vencer()`, `alDia(ahora)`; y la función `cupoLiberadoPorTipo(compras: readonly Compra[], ahora: Date): Map<string, number>`. En el mismo turno, adaptar a la forma nueva (historial `[PENDIENTE]` o `[PENDIENTE, CONFIRMADA]`, sin `estado`) los usos de `new Compra(` en `backend/tests/helpers/eventos.ts` (`compra(...)`: que acepte el historial o un atajo de estado), `backend/tests/repositories/compra.repository.test.ts`, `backend/tests/services/concurrencia.test.ts` y `backend/src/seed/datos-ejemplo.ts` (por ahora un historial mínimo; el definitivo es T008). Casos:
  - invariantes (`DatosInvalidosError`): `cantidad` "entero ≥ 1" (0, -1 y 1.5 lanzan); `total` "entero ≥ 0"; `historial` vacío, con el primero distinto de `PENDIENTE`, con un estado inválido, con una fecha inválida o con fechas **decrecientes** lanzan; fechas iguales consecutivas construyen;
  - `estado` es el del último cambio; `creadaEn` la fecha del primero; `venceEn = creadaEn + 15 min` (`LIMITES_COMPRA.minutosParaPagar`);
  - `estaVencida`: `PENDIENTE` a los 14:59.999 → `false`; a los **15 min exactos** → `true`; una `CONFIRMADA` pasado el plazo → `false`;
  - `vencer()` desde `PENDIENTE` → `Compra` nueva `CANCELADA` con un cambio `{ tipo: "sistema" }` fechado en `venceEn` (no en `ahora`), la original intacta; desde otro estado → `ReglaDeNegocioError` `TRANSICION_INVALIDA` "La compra no está pendiente de pago.";
  - `alDia(ahora)`: vencida → la `CANCELADA` del sistema; no vencida → la **misma** instancia;
  - `fueVencida()`: `CANCELADA` por el sistema → `true`; `PENDIENTE` o `CONFIRMADA` → `false`;
  - `esVigente`: `PENDIENTE` no vencida y `CONFIRMADA` → `true`; `PENDIENTE` vencida y `CANCELADA` → `false`;
  - `esGratis()` ⇔ `total === 0`;
  - `cupoLiberadoPorTipo`: suma la `cantidad` de las vencidas por `tipoEntradaId`; ignora las no vencidas, las confirmadas y las ya canceladas; sin vencidas → `Map` vacío.
- [X] T004 Implementar `Compra` y `cupoLiberadoPorTipo` en `backend/src/domain/compra.ts` (propiedades `readonly`, `historial` copiado y congelado, invariantes con `Invariantes` de `backend/src/domain/invariantes.ts`; los errores de regla con `ReglaDeNegocioError` de `backend/src/domain/errores.ts`). Actualizar el comentario de clase (ya no es "mínima"; las transiciones de la 008 y la 009 se suman después).
- [X] T005 [P] Test en `backend/tests/domain/evento.test.ts` (se amplía) con los stubs de `TipoEntrada.devolver(cantidad)` y `Evento.devolverCupos(porTipo: ReadonlyMap<string, number>)` en `backend/src/domain/evento.ts`. Casos: `devolver(2)` sobre cupo 3 → tipo nuevo con cupo 5 y el original intacto; `devolverCupos` devuelve un `Evento` nuevo con cada tipo devuelto, ignora los ids ausentes, con un `Map` vacío los cupos quedan iguales y **no** chequea "realizado" (un evento realizado devuelve igual: R9). Luego implementarlos.

### Repositorio de compras

- [X] T006 Test en `backend/tests/repositories/compra.repository.test.ts` (se amplía) con los stubs en `backend/src/domain/repositorios.ts` (`RepositorioCompras` suma `siguienteId(): string`, `buscarPorId(id): Promise<Compra | null>`, `listarPorEventoYComprador(eventoId, compradorId): Promise<Compra[]>`, `listarPendientesPorEventos(eventoIds: readonly string[]): Promise<Compra[]>`; actualizar su JSDoc: ya no es "mínimo") y en `backend/src/repositories/compra.repository.ts`. Casos: `siguienteId` da UUID v4 distintos; `buscarPorId` la compra o `null`; `listarPorEventoYComprador` solo las de esa persona en ese evento, en cualquier estado; `listarPendientesPorEventos` solo las **guardadas** `PENDIENTE` (vencidas o no) de esos ids, `[]` → `[]`; `guardar` reemplaza la instancia del mismo id; `existePorEvento`/`existePorTipoEntrada` siguen contando una `CANCELADA` (edge case "Compra vencida y reglas de la 004"); dos instancias no comparten estado.
- [X] T007 Implementar los métodos nuevos de `CompraRepository` en `backend/src/repositories/compra.repository.ts` sobre su `Map` privado (`crypto.randomUUID()` para `siguienteId`).
- [X] T008 Datos de ejemplo (R10, FR-024) en `backend/src/seed/datos-ejemplo.ts`: `compra-martin-festival-vip` (Martín, VIP, 2, total 240000) con historial `PENDIENTE` por Martín en `ahora − 2 días` → `CONFIRMADA` por Martín `+5 min`; `compra-diego-festival-general` (Diego, General, 1, total 45000) con `PENDIENTE` por Diego en `ahora − 1 día` → `CANCELADA` por el **sistema** `+15 min`. Sin eventos nuevos ni cambios de cupo. Extender `backend/tests/domain/datos-ejemplo.test.ts`: las dos compras con ese historial y estado; ninguna compra del seed queda `PENDIENTE`; los cupos del Festival siguen VIP 50 y Backstage 3.

### Vencimiento perezoso y cupo al día (services)

- [X] T009 Test de `backend/tests/services/vencimiento.service.test.ts` (nuevo) con el stub de `backend/src/services/vencimiento.service.ts` (`VencimientoService({ compras })`, `cupoLiberadoPorTipo(eventoIds: readonly string[], ahora: Date): Promise<Map<string, Map<string, number>>>` (por evento y por tipo), `vencerPendientes(eventoId: string, ahora: Date): Promise<Map<string, number>>`). Casos con reloj fijo y compras armadas por caso: `cupoLiberadoPorTipo` cuenta solo las pendientes vencidas de esos eventos, **no guarda nada** (la compra sigue `PENDIENTE` en el repositorio) y hace **una** `listarPendientesPorEventos` (espiar); `vencerPendientes` guarda cada vencida como `CANCELADA` del sistema fechada en `venceEn`, devuelve el cupo liberado por tipo, no toca las no vencidas ni las de otros eventos, y llamado dos veces con el mismo `ahora` la segunda devuelve un `Map` vacío (cupo devuelto **una sola vez**, FR-014a).
- [X] T010 Implementar `VencimientoService` en `backend/src/services/vencimiento.service.ts` con `cupoLiberadoPorTipo` del dominio (T004); trabaja solo sobre el agregado `Compra` (`listarPendientesPorEventos` y `guardar`).
- [X] T011 Test en `backend/tests/services/evento.service.test.ts` (se amplía), ampliando `crearServicesDeEventos` en `backend/tests/helpers/services-de-eventos.ts` (arma `VencimientoService` y se lo pasa a `EventoService` como `app.ts`; admite un reloj **movible**, por ejemplo un `relojMovible()` en `backend/tests/helpers/eventos.ts` con `avanzar(ms)`), con los stubs en `backend/src/services/evento.service.ts`: el constructor recibe `vencimientoService`; `obtenerAlDia(id, ahora): Promise<Evento>` (público) y `obtenerDelOrganizador(id, usuarioId, ahora)` con el parámetro nuevo; `backend/src/app.ts` arma `VencimientoService` antes de `EventoService`. Casos:
  - con una compra `PENDIENTE` de 2 VIP creada hace 15 min (VIP guardado en 48): `obtener` y `listar` muestran VIP con cupo **50** (y `agotado` recalculado: un evento con todo en 0 más una vencida deja de estar agotado) **sin** guardar el evento ni la compra; con la compra a los 14 min, 48;
  - `listar` con varios eventos hace **una** `listarPendientesPorEventos` (sin N+1);
  - `obtenerAlDia`: 404 si no existe; con vencidas, guarda las compras `CANCELADA` y **después** el evento con el cupo devuelto (verificar el orden espiando los dos repositorios); sin vencidas no guarda el evento;
  - `obtenerDelOrganizador(id, otro, ahora)` → 403 **sin** materializar nada (la compra sigue `PENDIENTE` guardada);
  - `actualizar` y `eliminar` materializan antes de verificar y guardar, con el mismo `ahora`: guardar el evento con cupo editado deja el cupo guardado igual al mostrado (R3, "Por qué materializar también en las ediciones").
- [X] T012 Implementar en `backend/src/services/evento.service.ts`: `obtenerAlDia` (404 con `obtenerOFallar` → `vencimientoService.vencerPendientes` → si liberó, `eventos.guardar(evento.devolverCupos(…))`); `obtenerDelOrganizador(id, usuarioId, ahora)` (404 → 403 → `obtenerAlDia`); `actualizar` y `eliminar` leen `ahora` una vez dentro del cerrojo antes de `obtenerDelOrganizador`; `obtener` y `listar` aplican `cupoLiberadoPorTipo` con `devolverCupos` a lo que muestran (sin guardar). `listarMios` no cambia: `EventoResumenVista` no lleva cupo, y el organizador ve el cupo al día en su evento vía `GET /eventos/:eventoId` (FR-014a).
- [X] T013 Test en `backend/tests/services/tipo-entrada.service.test.ts` (se amplía): `crear`, `actualizar` y `eliminar` de tipos materializan los vencimientos antes de verificar (editar el cupo de un tipo con una compra vencida guarda el cupo pedido, sin volver a sumar las vencidas en la próxima lectura); quitar un tipo cuya única compra está vencida sigue rechazado (toda compra cuenta). Luego, en `backend/src/services/tipo-entrada.service.ts`, leer `ahora` una vez dentro del cerrojo y pasarlo a `obtenerDelOrganizador`.
- [X] T014 Test en `backend/tests/services/concurrencia-compras.test.ts` (nuevo, mismo enfoque que `concurrencia.test.ts`: `Promise.allSettled` sobre los services reales): una edición del organizador y otra escritura del mismo evento con una compra vencida → el cupo se devuelve **una sola vez** (R11). Debe pasar con T012 y T013; si no, corregirlos.
- [X] T015 Test en `backend/tests/api/eventos.test.ts` (se amplía) con `crearApp({ reloj })`: `GET /api/eventos/:id` y `GET /api/eventos` muestran el cupo al día con una compra pendiente vencida armada en los repositorios (la forma de `EventoVista` no cambia). Correr `backend/tests/api/` y `backend/tests/services/` completos (los de la 004 y la 005 en verde).

**Checkpoint**: la compra tiene historial y vence sola; toda lectura muestra el cupo al día y
toda escritura de un evento materializa antes. Las pantallas de la 004 y la 005 siguen igual.

---

## Phase 3: User Story 1 — Comprar entradas de un tipo (Priority: P1) 🎯 MVP

**Goal**: desde el detalle de un evento no realizado, "Comprar" en un tipo con cupo, elegir la
cantidad (1 a `min(cupo, restantes)`) con el total estimado y registrar la compra `PENDIENTE`
con el cupo descontado bajo el cerrojo; el organizador ve "Sos el organizador de este evento".

**Independent Test**: con el seed, Sofía compra 2 VIP del Festival → `201` `PENDIENTE` con total
240000 y el detalle muestra VIP 48; Diego compra las 3 Backstage → "Agotado"; Lucía no ve
"Comprar"; 50 compras simultáneas sobre cupo 10 → 10 registradas, cupo 0.

### Backend

- [ ] T016 [P] [US1] Test en `backend/tests/domain/compra.test.ts` (se amplía) con el stub de `static registrar({ id, compradorId, eventoId, tipo, cantidad, ahora })`. Casos: `total = tipo.precio × cantidad` (VIP 120000 × 2 = 240000; gratis → 0); historial `[PENDIENTE por { tipo: "usuario", usuarioId: compradorId } en ahora]`; `tipoEntradaId = tipo.id`; cantidad 0 → `DatosInvalidosError`. Luego implementarlo.
- [ ] T017 [P] [US1] Test en `backend/tests/domain/evento.test.ts` (se amplía) con los stubs de `TipoEntrada.esGratis()`, `TipoEntrada.descontar(cantidad)`, `Evento.exigirQueSePuedeComprar(compradorId, ahora)` y `Evento.descontarCupo(tipoId, cantidad, ahora)`. Casos: `esGratis` ⇔ `precio === 0`; `descontar(3)` sobre 3 → cupo 0 (cupo justo) y sobre 2 → `DatosInvalidosError` (el constructor exige cupo ≥ 0); `exigirQueSePuedeComprar`: en el instante exacto de `fechaHora` → `EVENTO_REALIZADO` "El evento ya se realizó: no se pueden comprar entradas." (1 ms antes, pasa); el organizador → `COMPRA_PROPIO_EVENTO` "No podés comprar entradas de un evento que organizás."; realizado **y** organizador → `EVENTO_REALIZADO` (va primero); `descontarCupo`: realizado → `EVENTO_REALIZADO`; cupo 3 y pide 3 → `Evento` nuevo con 0, el original intacto; pide 4 → `CUPO_INSUFICIENTE` "Quedan 3 entradas de «VIP»." (con cupo 1 y pide 2 → "Queda 1 entrada de «VIP»."); cupo 0 → "No quedan entradas de «VIP»."; el mensaje de edición de `#exigirNoRealizado` de la 004 no cambia. Luego implementarlos.
- [ ] T018 [P] [US1] Test de `backend/tests/domain/tope-por-persona.test.ts` (nuevo) con el stub de `backend/src/domain/tope-por-persona.ts` (`entradasRestantes(tipo: TipoEntrada, vigentes: readonly Compra[]): number`, `exigirTopePorPersona(tipo, cantidad, vigentes): void`). Casos (R6): tipo pago sin compras → 4; con una confirmada de 2 y una pendiente de 1 (pagas) → 1, y pedir 2 → `TOPE_POR_PERSONA` "Podés comprar 1 entrada más de tipos pagos de este evento." (plural con N > 1: "Podés comprar 2 entradas más…"); con 4 → 0 y "Ya tenés el máximo de 4 entradas de tipos pagos de este evento."; las compras gratis no cuentan para el tope de 4; tipo gratis sin compras de ese tipo → 1; con una vigente gratis de **ese** tipo → 0 y "Ya tenés tu entrada gratis de «Carrera kids»."; pedir 2 de un gratis → "Podés tener 1 sola entrada de «Carrera kids»."; una gratis de **otro** tipo no cuenta; precio cambiado: una compra hecha con total > 0 de un tipo que ahora es gratis cuenta como paga, y el tope del pedido se evalúa con el precio **vigente** del tipo; nunca menos de 0. Las compras que recibe ya son las vigentes (la función no filtra por estado). Luego implementarlo con `LIMITES_COMPRA`.
- [ ] T019 [US1] Test en `backend/tests/services/tipo-entrada.service.test.ts` (se amplía) con los stubs de `buscarReferenciada(evento: Evento, tipoId: string): TipoEntrada` y `descontarCupo(evento, tipoId, cantidad, ahora): Promise<Evento>` en `backend/src/services/tipo-entrada.service.ts`. Casos: `buscarReferenciada` con un tipo de otro evento o inexistente → `ReferenciaInvalidaError` con `campo: "tipoEntradaId"` y "No existe el tipo de entrada en este evento."; `descontarCupo` guarda el evento con el tipo descontado y lo devuelve; con cupo insuficiente no guarda nada; ninguno de los dos toma el cerrojo (espiar `cerrojo.ejecutar`). Luego implementarlos.
- [ ] T020 [US1] Test de `backend/tests/services/compra.service.test.ts` (nuevo), ampliando `crearServicesDeEventos` con `CompraService`, con los stubs de `backend/src/services/compra.service.ts` (`CompraService({ compras, eventoService, tipoEntradaService, cerrojo, reloj })`, `obtenerOFallar(id): Promise<Compra>`, `crear(eventoId, compradorId, datos: DatosCompra): Promise<CompraVista>`, `misComprasDelEvento(eventoId, usuarioId): Promise<MisComprasDelEventoVista>`) y de `aCompraVista(compra, evento, ahora)` en `backend/src/services/compra.vistas.ts`; en `backend/src/errors/index.ts`, `CompraNoEncontradaError` (`COMPRA_NO_ENCONTRADA`, "No existe la compra.") con su fila en `statusDe` de `backend/src/middlewares/traducir-error.ts` (404). Casos de `crear` (data-model, "`CompraService.crear`"):
  - registra `PENDIENTE` con total del servidor, descuenta el cupo exactamente en la cantidad y devuelve la `CompraVista` (`venceEn`/`venceEnLocal` = alta + 15 min, `evento` con `fechaHoraLocal` y `realizado`, `tipoEntrada.nombre`, historial con `fechaHoraLocal`);
  - cupo justo deja el tipo en 0; tipo gratis → total 0;
  - el orden de los rechazos de R2 (con datos que disparan dos a la vez, gana el primero): 404 evento → `ReferenciaInvalidaError` del tipo → `EVENTO_REALIZADO` → `COMPRA_PROPIO_EVENTO` → `TOPE_POR_PERSONA` → `CUPO_INSUFICIENTE`; cada rechazo deja cupo y compras sin cambios (salvo la materialización);
  - el tope cuenta solo las compras **vigentes** (una vencida o cancelada no cuenta: con una pendiente de 4 vencida, se pueden comprar 4 más) y la vencida se materializa y devuelve su cupo antes de verificar;
  - un mismo comprador puede hacer varias compras del mismo tipo (FR-010);
  - todo corre dentro de `cerrojo.ejecutar(eventoId, …)` y `reloj.ahora()` se lee una vez;
  - guarda el evento **antes** que la compra (R8).
  Casos de `misComprasDelEvento`: 404 evento; `pendientes` con solo sus `PENDIENTE` **no vencidas** de ese evento (ni vencidas, ni confirmadas, ni ajenas, ni de otros eventos), por `creadaEn` ascendente; `restantesPorTipo` con un elemento por tipo en el orden del evento; para el organizador, 0 en todos; con el evento realizado se calcula igual; sin cerrojo y sin guardar nada.
- [ ] T021 [US1] Implementar `aCompraVista` en `backend/src/services/compra.vistas.ts` (vista explícita; nombre del tipo desde el evento; `venceEn`/`venceEnLocal` solo si `PENDIENTE`, con `horaDeBuenosAires` de `backend/src/domain/hora-buenos-aires.ts`) y `CompraService` (`obtenerOFallar`, `crear`, `misComprasDelEvento`) en `backend/src/services/compra.service.ts`, con `exigirTopePorPersona`/`entradasRestantes` de `backend/src/domain/tope-por-persona.ts`; en `backend/src/app.ts`, armar `CompraService` después de `TipoEntradaService`.
- [ ] T022 [US1] Test en `backend/tests/services/concurrencia-compras.test.ts` (se amplía): **50** compras de 1 entrada de 50 compradores distintos sobre un tipo con cupo 10 → exactamente 10 cumplidas, 40 `CUPO_INSUFICIENTE`, cupo final 0 y nunca negativo (SC-002); dos compras simultáneas de la misma persona que juntas superan su tope (3 + 2 pagas) → una sola cumplida y la otra `TOPE_POR_PERSONA`; compras sobre eventos distintos no se esperan entre sí; una compra simultánea con una edición del organizador que baja el cupo del tipo → una de las dos se completa primero y la otra se evalúa sobre su resultado, y el cupo nunca queda negativo; una compra simultánea con un cambio de precio del tipo → el total es `precio × cantidad` con el precio vigente cuando se procesó la compra (el viejo o el nuevo, nunca una mezcla) (edge case "Compra simultánea con una edición del organizador"). Debe pasar con T021; si no, corregirlo.
- [ ] T023 [US1] Test de `backend/tests/api/compras.test.ts` (nuevo) con supertest y `crearApp()`, con los stubs de `backend/src/validations/compra.validation.ts` (`compraNueva` con `params: { eventoId }` y `body`, `comprasDelEvento` con `params: { eventoId }`), `backend/src/controllers/compra.controller.ts` (`crear`, `misComprasDelEvento`) y las rutas `router.post("/:eventoId/compras", requerirUsuario, …)` y `router.get("/:eventoId/mis-compras", requerirUsuario, …)` en `backend/src/routes/eventos.routes.ts` (con el controller de compras pasado desde `backend/src/routes/index.ts`). Casos: Sofía compra 2 VIP del Festival → `201` con total 240000 y `PENDIENTE`, y después `GET /api/eventos/evento-festival-sonidos-del-sur` muestra VIP 48; Diego compra las 3 Backstage → `201` y Backstage con cupo 0; sin `X-Usuario-Id` → `401 USUARIO_NO_IDENTIFICADO`; un cuerpo con `precio: 1` y `total: 1` se ignora (total 240000); `mis-compras` de Martín en el Festival → `{ pendientes: [], restantesPorTipo: [General 2, VIP 2, Backstage 2] }` (contrato, ejemplo); de Lucía → 0 en todos.
- [ ] T024 [US1] Implementar `compraNueva` (`tipoEntradaId`: `idSchema`; `cantidad`: entero de 1 a `LIMITES_COMPRA.entradasPorEvento` con "Debe ser un entero entre 1 y 4.", faltante → "Es obligatorio."; claves desconocidas descartadas) y `comprasDelEvento` en `backend/src/validations/compra.validation.ts`, el controller (`res.status(201).json(...)`, sin reglas) y las rutas. Documentar en `backend/src/docs/openapi.json` el tag **Compras**, `POST /eventos/{eventoId}/compras` y `GET /eventos/{eventoId}/mis-compras` con los esquemas `DatosCompra`, `CompraVista`, `CambioEstadoCompraVista`, `MisComprasDelEventoVista` y sus errores; sumar la carpeta "Comprar entradas" con esos dos pedidos a `backend/src/docs/ai-ticket-it.postman_collection.json` (`backend/tests/api/docs.test.ts` en verde).

### Mobile

- [ ] T025 [P] [US1] Test de `mobile/tests/api/compras.test.ts` (nuevo) con el stub de `mobile/src/api/compras.ts` (`comprarEntradas(cliente, eventoId, { tipoEntradaId, cantidad }, { usuarioId })`, `obtenerMisComprasDelEvento(cliente, eventoId, { signal })`), exportado por `mobile/src/api/index.ts`. Casos: `POST /eventos/<id>/compras` con cuerpo **exactamente** `{ tipoEntradaId, cantidad }` (sin precio ni total) y `X-Usuario-Id` del usuario pasado; `GET /eventos/<id>/mis-compras` con el `signal`; ids con `encodeURIComponent`. Luego implementarlas con `cliente.post`/`cliente.get`.
- [ ] T026 [P] [US1] Test de `mobile/tests/features/compras/formato.test.ts` (nuevo) con el stub de `mobile/src/features/compras/formato.ts` (`textoTotal(total)`, `textoCantidad(cantidad)`). Casos: `textoTotal(0)` → "Gratis"; `textoTotal(240000)` → "$ 240.000" (reusa `textoPrecio` del `index.ts` de `eventos`); `textoCantidad(1)` → "1 entrada"; `textoCantidad(2)` → "2 entradas". Luego implementarlo.
- [ ] T027 [US1] Claves y hooks: en `mobile/src/consultas/claves.ts`, `misComprasDelEvento: (usuarioId, eventoId) => ["mis-compras-del-evento", usuarioId, eventoId] as const`; en `mobile/src/features/compras/useMisComprasDelEvento.ts`, `useMisComprasDelEvento(usuarioId, eventoId)`; en `mobile/src/features/compras/mutaciones.ts`, `useComprarEntradas(usuarioId, eventoId)` (sin reintentos; al terminar, con éxito o error, invalida `["evento", *, eventoId]` con un predicado para **todos** los usuarios, `misComprasDelEvento` y `["catalogo"]`); en `mobile/src/features/eventos/index.ts`, exportar `useEvento` y el tipo `ComplementosDelDetalle`. Lo prueban T028 y T030.
- [ ] T028 [US1] Test en `mobile/tests/pantallas/detalle-evento.test.tsx` (se amplía) con `renderConDependencias` y `porRuta`, con los stubs de: la prop opcional `complementos?: ComplementosDelDetalle` (`{ AccionDeTipo?: ComponentType<{ evento; tipo }>; SeccionPropia?: ComponentType<{ evento }> }`) en `mobile/src/features/eventos/pantallas/DetalleEvento.tsx`; la prop opcional `accionDeTipo?: (tipo) => ReactNode` en `mobile/src/features/eventos/componentes/ListaTiposEntrada.tsx`; `DetalleEventoConCompras` en `mobile/src/features/compras/pantallas/DetalleEventoConCompras.tsx`, `AccionComprar` en `mobile/src/features/compras/componentes/AccionComprar.tsx` y `mobile/src/features/compras/index.ts` (exporta `DetalleEventoConCompras`); **mover** `mobile/app/explorar/[eventoId].tsx` a `mobile/app/explorar/[eventoId]/index.tsx` (re-export de `DetalleEventoConCompras`) y, en `mobile/src/navegacion/LayoutRaiz.tsx`, reemplazar `explorar/[eventoId]` por `explorar/[eventoId]/index` (título "Evento"). En `mobile/tests/helpers/render-con-dependencias.tsx`, responder por defecto `GET /eventos/:id/mis-compras` con `{ pendientes: [], restantesPorTipo: [] }` si el test no lo registra (R19); fixtures nuevos en `mobile/tests/helpers/compras.ts`. Casos (contracts/app.md, "Acción de cada tipo"): cada tipo con cupo tiene "Comprar" (`accessibilityLabel` "Comprar VIP"); un tipo agotado no lo tiene y sigue diciendo "Agotado"; un evento realizado no ofrece "Comprar" en ningún tipo y sigue con "Este evento ya se realizó"; con `restantes: 0` en un tipo → "Ya tenés el máximo de entradas para este evento" en ese tipo; mientras `mis-compras` carga, o si un tipo no tiene elemento en `restantesPorTipo`, se ve "Comprar"; el organizador ve "Sos el organizador de este evento" y ningún "Comprar"; si `mis-compras` falla, el detalle se ve igual. Los casos de la 005 de este archivo siguen en verde sin cambios.
- [ ] T029 [US1] Implementar `accionDeTipo` en `ListaTiposEntrada` (a la derecha de cada fila; sin la prop, igual que antes), `complementos` en `DetalleEvento` (`SeccionPropia` antes de "Tipos de entrada"; `AccionDeTipo` vía `accionDeTipo`), `AccionComprar` (orden de contracts/app.md; "Comprar" hace `router.push({ pathname: "/explorar/[eventoId]/comprar/[tipoEntradaId]", params })`), la parte "organizador" de la `SeccionPropia` y `DetalleEventoConCompras` (`<DetalleEvento complementos={…} />` con `useMisComprasDelEvento`).
- [ ] T030 [US1] Test de `mobile/tests/pantallas/comprar-entradas.test.tsx` (nuevo) con los stubs de `ComprarEntradas` en `mobile/src/features/compras/pantallas/ComprarEntradas.tsx`, `SelectorCantidad` en `mobile/src/features/compras/componentes/SelectorCantidad.tsx` (`{ cantidad, maximo, alCambiar }`), su export en `mobile/src/features/compras/index.ts`, la ruta `mobile/app/explorar/[eventoId]/comprar/[tipoEntradaId].tsx` (re-export), su `Stack.Screen` con título "Comprar entradas" en `LayoutRaiz`, y `mobile/app/compras/[compraId].tsx` con `<SeccionPendiente nombre="Tu compra" />` (lo reemplaza US2) con su `Stack.Screen` "Tu compra". Casos: desde el detalle, "Comprar" en VIP abre la pantalla con el nombre del evento, `textoFechaHora`, "VIP" y "$ 120.000 c/u" ("Gratis" en un tipo gratis); el selector arranca en "1 entrada", "−" ("Una entrada menos") deshabilitado en 1, "+" ("Una entrada más") sube y se deshabilita en `min(cupo, restantes)`; con `restantes` 2 y cupo 50 → "Podés comprar hasta 2 entradas de este evento"; "Total: $ 240.000" con 2 y "Total: Gratis" en el gratis; "Confirmar compra" manda `POST` con `{ tipoEntradaId, cantidad }` en nombre del usuario actual, muestra "Comprando…" deshabilitado mientras está en curso (un doble toque manda **un** pedido) y con el `201` hace `router.replace` a `/compras/[compraId]`; al volver al detalle se ve el cupo nuevo (segundo `GET` del evento); con el evento realizado → "Este evento ya se realizó" + "Volver al evento" sin selector; tipo agotado → "No quedan entradas de este tipo."; `restantes: 0` → "Ya tenés el máximo de entradas para este evento"; tipo inexistente en el evento leído → "Este tipo de entrada ya no está disponible."; cargando y error con "Reintentar" vía `SegunConsulta` (de cualquiera de las dos consultas).
- [ ] T031 [US1] Implementar `SelectorCantidad` ("−"/"+" con `accessibilityLabel` y `accessibilityState.disabled`; la cantidad con `accessibilityLiveRegion="polite"`) y `ComprarEntradas` (`useEvento` + `useMisComprasDelEvento` con `SegunConsulta`; cantidad en `useState`, recortada si el máximo baja; `Boton` primario con `enCurso`/`textoEnCurso`; total estimado con `textoTotal`), la ruta y los `Stack.Screen`. Sumar a `mobile/src/componentes/tema.ts` lo que falte (sin números sueltos).
- [ ] T032 [US1] En `mobile/tests/tipos/rutas-tipadas.ts`, sumar `/explorar/[eventoId]/comprar/[tipoEntradaId]` y `/compras/[compraId]` con sus parámetros (y `npm run typecheck` de `mobile/` en verde con las rutas nuevas y la movida).

**Checkpoint**: se compra desde el detalle y la compra queda `PENDIENTE` con el cupo descontado;
el organizador no compra; el tope limita el selector. "Tu compra" todavía es una sección pendiente.

---

## Phase 4: User Story 2 — Pagar la compra (pago simulado) (Priority: P1) 🎯 MVP

**Goal**: "Tu compra" muestra el resumen con el estado "Pendiente" y hasta qué hora se puede
pagar; "Pagar" (o "Confirmar" si es gratis) la pasa a `CONFIRMADA`; si vence, se ve
"Cancelada". El detalle lista "Tus compras pendientes" con "Pagar".

**Independent Test**: comprar 2 VIP, "Pagar" → "Confirmada" con historial `[PENDIENTE,
CONFIRMADA]` del comprador; pagar de nuevo → `409 TRANSICION_INVALIDA`; Diego pagando la de
Sofía → `403`; con el reloj 15 min adelante → `409 COMPRA_VENCIDA` y la compra `CANCELADA`.

### Backend

- [ ] T033 [P] [US2] Test en `backend/tests/domain/compra.test.ts` (se amplía) con el stub de `pagar(usuarioId, ahora)`. Casos (data-model, tabla de `Compra`): `PENDIENTE` → `CONFIRMADA` con un cambio por `{ tipo: "usuario", usuarioId }` en `ahora`, la original intacta, `estaVencida` deja de ser `true` pasado el plazo; a los **15 min exactos** → `COMPRA_VENCIDA` "La compra venció: pasaron 15 minutos sin pagarla."; una `CANCELADA` por el sistema (`fueVencida()`) → `COMPRA_VENCIDA`; ya `CONFIRMADA` → `TRANSICION_INVALIDA`; no recibe nada del evento (R9). Luego implementarlo.
- [ ] T034 [US2] Test en `backend/tests/services/compra.service.test.ts` (se amplía) con los stubs de `obtener(compraId, usuarioId): Promise<CompraVista>` y `pagar(compraId, usuarioId): Promise<CompraVista>`; en `backend/src/errors/index.ts`, el error de permiso con "Solo quien hizo la compra puede verla o pagarla." (`SIN_PERMISO`, 403; reusar la clase de permiso existente con ese mensaje si encaja). Casos de `obtener`: 404 `COMPRA_NO_ENCONTRADA` → 403 de otro usuario → la vista **al día** (una pendiente vencida se ve `CANCELADA` con el cambio del sistema fechado en `venceEn`, `venceEn: null`, sin guardar nada). Casos de `pagar`: 404 → 403 (sin cambiar nada) → `CONFIRMADA` con historial `[PENDIENTE, CONFIRMADA]` y `venceEn: null`; segunda vez → `TRANSICION_INVALIDA`; con el reloj movido 15 min → `COMPRA_VENCIDA`, la compra queda guardada `CANCELADA` del sistema y su cupo vuelve; con el evento **ya empezado** y la compra sin vencer → `CONFIRMADA` (R9); toma el cerrojo del evento **de la compra** y relee la compra adentro.
- [ ] T035 [US2] Implementar `obtener` y `pagar` en `backend/src/services/compra.service.ts` (data-model, "`CompraService.pagar`": `obtenerOFallar` fuera del cerrojo solo para el `eventoId`; adentro `ahora`, `eventoService.obtenerAlDia`, relectura, 403, `compra.pagar`, `guardar`).
- [ ] T036 [US2] Test en `backend/tests/services/concurrencia-compras.test.ts` (se amplía): pago con el reloj exactamente en `venceEn` → `COMPRA_VENCIDA` y cupo devuelto una vez; dos pagos simultáneos de la misma compra → uno cumplido y uno `TRANSICION_INVALIDA`, con un único cambio a `CONFIRMADA` (FR-013); pago con el evento empezado y la compra sin vencer → `CONFIRMADA`. Debe pasar con T035; si no, corregirlo.
- [ ] T037 [US2] Test en `backend/tests/api/compras.test.ts` (se amplía) con los stubs de `compraPorId` (`params: { compraId }`) en `backend/src/validations/compra.validation.ts`, `obtener` y `pagar` en `backend/src/controllers/compra.controller.ts`, y `backend/src/routes/compras.routes.ts` (`GET /:compraId` y `POST /:compraId/pago`, con `requerirUsuario`) montado en `/compras` desde `backend/src/routes/index.ts`. Casos: Sofía compra y `GET /api/compras/<id>` → `200` `PENDIENTE`; `POST /api/compras/<id>/pago` → `200` `CONFIRMADA` con el historial; repetido → `409 TRANSICION_INVALIDA`; Diego → `403 SIN_PERMISO` en las dos rutas; Sofía sobre `compra-diego-festival-general` → `403`, y Diego → `409 COMPRA_VENCIDA`; inexistente → `404 COMPRA_NO_ENCONTRADA`; un cuerpo en el pago se ignora; con `crearApp({ reloj })` movible, 15 min después del alta el `GET` la muestra `CANCELADA` y `mis-compras` ya no la lista; `mis-compras` de Sofía con una pendiente la lista con `venceEnLocal`.
- [ ] T038 [US2] Implementar `compraPorId`, el controller y `compras.routes.ts`. Documentar `GET /compras/{compraId}` y `POST /compras/{compraId}/pago` en `backend/src/docs/openapi.json` (tag Compras) y sumar a Postman "Ver compra", "Pagar" y "Pagar de nuevo → 409" (`docs.test.ts` en verde).

### Mobile

- [ ] T039 [P] [US2] Test de `mobile/tests/componentes/etiqueta-estado-compra.test.tsx` (nuevo) con el stub de `mobile/src/componentes/EtiquetaEstadoCompra.tsx` (`{ estado: EstadoCompra }`, exportado por `mobile/src/componentes/index.ts`) y de `textoEtiquetaEstado(estado)` junto a él. Casos: "Pendiente" / "Confirmada" / "Utilizada" / "Cancelada" / "Reembolsada" con fondo `advertencia` / `exito` / `exito` / `peligro` / `peligro` y su `sobre…` del `tema`; `accessibilityLabel` "Estado: Pendiente". Luego implementarlo (sin importar features; es el único componente de estado de compra, FR-017).
- [ ] T040 [P] [US2] Test en `mobile/tests/api/compras.test.ts` (se amplía) con los stubs de `obtenerCompra(cliente, compraId, { signal })` y `pagarCompra(cliente, compraId, { usuarioId })`: `GET /compras/<id>` con el `signal`; `POST /compras/<id>/pago` **sin cuerpo** con `X-Usuario-Id`. Luego implementarlas. En el mismo ciclo, extender `mobile/tests/features/compras/formato.test.ts` con `textoVencimiento("2026-11-12T15:35")` → "Podés pagar hasta las 15:35" (sin convertir zonas) e implementarlo.
- [ ] T041 [US2] Claves y hooks: en `mobile/src/consultas/claves.ts`, `compra: (usuarioId, compraId) => ["compra", usuarioId, compraId] as const`; `useCompra(usuarioId, compraId)` en `mobile/src/features/compras/useCompra.ts`; en `mobile/src/features/compras/mutaciones.ts`, `usePagarCompra(usuarioId, compraId, eventoId)` (con éxito, `setQueryData` en `claves.compra`; al terminar, con éxito o error, invalida la compra, `misComprasDelEvento`, `["evento", *, eventoId]` y `["catalogo"]`). Lo prueban T042 y T044.
- [ ] T042 [US2] Test de `mobile/tests/pantallas/compra.test.tsx` (nuevo) con los stubs de `Compra` en `mobile/src/features/compras/pantallas/Compra.tsx` y `ResumenCompra` en `mobile/src/features/compras/componentes/ResumenCompra.tsx`, su export en `mobile/src/features/compras/index.ts` y `mobile/app/compras/[compraId].tsx` como re-export de `Compra` (reemplaza la `SeccionPendiente`). Casos (contracts/app.md, "Tu compra"): `PENDIENTE` → "Estado: Pendiente", nombre del evento, fecha y hora, "VIP", "2 entradas", "Total: $ 240.000", "Podés pagar hasta las 15:35" y "Pagar"; gratis → "Total: Gratis" y "Confirmar"; tocar "Pagar" muestra "Pagando…" deshabilitado (doble toque → **un** `POST`) y con el `200` → "Confirmada", "¡Listo! Tu compra está confirmada.", "Volver al evento" (`router.back()`) e "Ir a Explorar" (`router.dismissTo("/")`); "Confirmar" → "Confirmando…"; `CANCELADA` → "Esta compra venció: sus entradas volvieron a estar disponibles." y "Volver al evento"; `409 COMPRA_VENCIDA` al pagar → la compra se vuelve a pedir y se ve el estado cancelado; `403` al leer → "No tenés permiso para ver esta compra." sin acciones; `404` → "No encontramos esta compra." + "Ir a Explorar"; cargando y error con "Reintentar" vía `SegunConsulta`; el recorrido completo desde el detalle: "Comprar" → "+" → "Confirmar compra" → "Pagar" → "Volver al evento" (≤ 5 toques, SC-001).
- [ ] T043 [US2] Implementar `ResumenCompra` y `Compra` (se dibuja **siempre** desde `useCompra`, R17; `EtiquetaEstadoCompra`; `Boton` con `enCurso`/`textoEnCurso`; textos de `formato.ts`) y la ruta.
- [ ] T044 [US2] Test en `mobile/tests/pantallas/detalle-evento.test.tsx` (se amplía) con el stub de `FilaCompraPendiente` en `mobile/src/features/compras/componentes/FilaCompraPendiente.tsx` y `ComprasPendientes` en `mobile/src/features/compras/componentes/ComprasPendientes.tsx`. Casos (FR-023, US2-10): con pendientes → "Tus compras pendientes" y, por compra, "VIP · 2 entradas · $ 240.000" (o "Gratis"), "Podés pagar hasta las 15:35", "Estado: Pendiente" y "Pagar" (`accessibilityLabel` "Pagar la compra de 2 entradas VIP") que hace `router.push` a `/compras/[compraId]`; sin pendientes la sección no aparece; con el evento realizado las pendientes siguen con "Pagar" y sin "Comprar" (R9); después de pagar y volver, la compra ya no figura (se vuelve a pedir `mis-compras`). Luego implementarlos y sumarlos a la `SeccionPropia` de `DetalleEventoConCompras`.

**Checkpoint**: el MVP (US1 + US2) está completo: comprar, pagar, ver la confirmación, retomar
una pendiente desde el detalle y ver una vencida. Validar con Sofía (paga), con la Maratón
(gratis → "Confirmar") y con Lucía (organizadora).

---

## Phase 5: User Story 3 — Rechazos claros cuando no se puede comprar (Priority: P2)

**Goal**: cada rechazo del alta llega con su código y mensaje en español, no cambia cupo ni
compras, y la app lo muestra conservando tipo y cantidad, actualizando el detalle con los datos
reales.

**Independent Test**: con pedidos directos, cada fila de "Ejemplos" de `contracts/api.md` da su
status y código y el cupo queda igual; en la app, comprar con el detalle viejo muestra el mensaje
del servidor y ajusta el selector.

### Backend

- [ ] T045 [US3] Test en `backend/tests/api/compras.test.ts` (se amplía) con la tabla de rechazos de `contracts/api.md` ("Ejemplos" y "Errores de esta feature"), verificando además en cada caso que `GET /api/eventos/:id` muestra el **mismo** cupo antes y después (SC-003): `cantidad` `0`, `-1`, `1.5`, `"2"`, `5` y faltante → `400 ENTRADA_INVALIDA` con detalle en `body.cantidad` ("Debe ser un entero entre 1 y 4." / "Es obligatorio."); `tipoEntradaId` faltante o mal formado → detalle en `body.tipoEntradaId`; `tipo-hamlet-platea` sobre el Festival → `400` con "No existe el tipo de entrada en este evento." en `body.tipoEntradaId`; `evento-inexistente` → `404 EVENTO_NO_ENCONTRADO`; un `eventoId` mal formado → `400` en `params.eventoId`; `evento-noche-de-risas` → `409 EVENTO_REALIZADO`; Lucía en el Festival → `409 COMPRA_PROPIO_EVENTO`; Martín con 3 General → `409 TOPE_POR_PERSONA` "Podés comprar 2 entradas más de tipos pagos de este evento."; dos "Carrera kids" seguidas de Sofía → `201` y `409 TOPE_POR_PERSONA`; las 3 Backstage y después 1 más → `409 CUPO_INSUFICIENTE` "No quedan entradas de «Backstage»."; 4 VIP con cupo 3 armado → "Quedan 3 entradas de «VIP»."; `mis-compras` y `GET /compras/:id` con ids mal formados → `400` en `params.*`. Estos tests fijan el contrato sobre lo implementado en US1: si alguno pasa de entrada, se deja (es regresión); si falla, corregir la validación o el mensaje.
- [ ] T046 [US3] Sumar a `backend/src/docs/openapi.json` los ejemplos de cada error de la tabla en las cuatro rutas de compras y a Postman los rechazos del quickstart ("cantidad 0 → 400", "tipo de otro evento → 400", "evento realizado → 409", "organizador → 409", "tope → 409", "sin cupo → 409") (`docs.test.ts` en verde).

### Mobile

- [ ] T047 [US3] Test en `mobile/tests/pantallas/comprar-entradas.test.tsx` (se amplía) de los errores del alta (contracts/app.md, "Errores del alta"; el mensaje arriba del botón con `accessibilityLiveRegion="polite"`, tipo y cantidad conservados): `409 CUPO_INSUFICIENTE` y `409 TOPE_POR_PERSONA` → el mensaje del servidor, el evento y `mis-compras` se vuelven a pedir y la cantidad se recorta al nuevo máximo (por ejemplo, de 3 a 1); `409 EVENTO_REALIZADO` → el mensaje y, con el evento vuelto a pedir, "Este evento ya se realizó" + "Volver al evento"; `409 COMPRA_PROPIO_EVENTO` → el mensaje; `400` en `body.tipoEntradaId` → "Este tipo de entrada ya no está disponible." + "Volver al evento"; `404 EVENTO_NO_ENCONTRADO` → "No encontramos este evento." + "Volver a Explorar" (`router.dismissTo("/")`), y al volver Explorar vuelve a pedir el catálogo; al volver al detalle tras un `CUPO_INSUFICIENTE` se ve el cupo real. Luego implementarlo en `ComprarEntradas` con `AvisoDeFormulario`, que se exporta desde `mobile/src/features/eventos/index.ts` (hoy solo lo usan las pantallas de `eventos` por archivo) y se importa en `compras` por ese `index.ts`; `esNoEncontrado` y los errores de `src/api/`; sin validar nada en la app.

**Checkpoint**: todos los rechazos del alta llegan claros y sin cambios de cupo (SC-003).

---

## Phase 6: User Story 4 — Comprar y pagar con conexión inestable (Priority: P3)

**Goal**: con el servidor caído, comprar y pagar avisan, no se reintentan solos y dejan
reintentar; al volver el servidor, la compra muestra su estado real (sin un error si el pago
había llegado).

**Independent Test**: con el `fetch` falso caído, "Confirmar compra" y "Pagar" avisan y siguen
disponibles; un pago aceptado cuya respuesta se perdió, al reintentar, muestra "Confirmada".

- [ ] T048 [US4] Test en `mobile/tests/pantallas/comprar-entradas.test.tsx` (se amplía): con el servidor no disponible en el `POST`, "No se pudo registrar la compra. Probá de nuevo.", **un solo** `POST` (sin reintento automático, también tras avanzar la secuencia de reintentos de las queries con temporizadores falsos), tipo y cantidad conservados y "Confirmar compra" disponible; al volver el servidor, tocarlo registra la compra. Compra registrada con respuesta perdida: al volver al detalle, la compra aparece en "Tus compras pendientes" con "Pagar" (US4-5). Luego implementar el mensaje en `ComprarEntradas`.
- [ ] T049 [US4] Test en `mobile/tests/pantallas/compra.test.tsx` (se amplía): servidor no disponible en el pago → "No se pudo pagar. Probá de nuevo." arriba de "Pagar", que sigue disponible, la compra se ve "Pendiente" y hay un solo `POST`; pago aceptado con la respuesta perdida → la compra se vuelve a pedir y llega `CONFIRMADA` → la confirmación **sin** mensaje de error; reintento que recibe `409 TRANSICION_INVALIDA` con la compra ya `CONFIRMADA` → la confirmación sin error (FR-021, SC-006); cambiar de usuario desde Perfil con la pantalla abierta → `403` y "No tenés permiso para ver esta compra.". Luego implementar el mensaje en `Compra` (el error del pago se muestra solo mientras la compra sigue `PENDIENTE`).

**Checkpoint**: las cuatro historias funcionan; el reintento nunca termina en dos
confirmaciones ni en un error falso.

---

## Phase 7: Polish y transversales

**Purpose**: documentación, accesibilidad, validación de punta a punta y cierre.

- [ ] T050 [P] Actualizar `AGENTS.md` (plan, "Post-design re-check"):
  - recurso `compras` (ya no "mínimo"): sus cuatro endpoints, `Compra` con historial, `CompraService` dueño (`obtenerOFallar`) y `VencimientoService`; `RepositorioCompras` con `siguienteId`, `buscarPorId`, `listarPorEventoYComprador`, `listarPendientesPorEventos`;
  - el vencimiento perezoso: lecturas al día sin guardar; toda escritura de un evento materializa antes con `EventoService.obtenerAlDia`, y `obtenerDelOrganizador` recibe `ahora`;
  - los métodos para usar dentro del cerrojo del que llama (`obtenerAlDia`, `TipoEntradaService.buscarReferenciada` y `descontarCupo`) y el orden de guardado;
  - `domain/tope-por-persona.ts` y `LIMITES_COMPRA` en `shared/`;
  - mobile: la feature `compras` (depende de `eventos`, no al revés), `DetalleEvento` con `complementos` y `ListaTiposEntrada` con `accionDeTipo`, las rutas `explorar/[eventoId]/index`, `explorar/[eventoId]/comprar/[tipoEntradaId]` y `compras/[compraId]`, `EtiquetaEstadoCompra` en la base, las claves `misComprasDelEvento` y `compra`, y el `mis-compras` vacío por defecto de `renderConDependencias`.
- [ ] T051 [P] Sumar a `mobile/tests/arquitectura/reglas-de-dependencia.test.ts` el caso de un import de `features/eventos` hacia `features/compras` (hoy no hay ninguno) y comprobar que el lint lo rechaza (`import-x/no-cycle` o la regla de features) (R19).
- [ ] T052 Revisar en 360 px y con TalkBack: sin desplazamiento horizontal; "Comprar" al lado de cada tipo sin cortar textos; selector, "−"/"+", estado, "Pagar…" y los avisos anunciados; sin valores sueltos fuera del `tema`. Ajustar lo que haga falta en `mobile/src/features/compras/`.
- [ ] T053 Correr `npm test`, `npm run lint`, `npm run typecheck` y `npm run format:check` desde la raíz y dejar las cuatro en verde (incluidos todos los tests de la 004 y la 005).
- [ ] T054 Validar a mano las secciones "Pedidos directos" y "Recorrido en la app" de `specs/006-comprar-entradas/quickstart.md` y anotar cualquier desvío; en el paso 2–3, cronometrar comprar y pagar (< 1 min, ≤ 5 toques: SC-001).
- [ ] T055 En `docs/backlog.md`, pasar la 006 a `en PR`, y abrir el PR de `feature/006-comprar-entradas` a `development` con las cuatro verificaciones del CI en verde.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de T002 (`LIMITES_COMPRA`). **Bloquea todas las
  historias**. T003 → T004 antes que todo lo demás de la fase (cambia la forma de `Compra` y sus
  usos); T006 → T007 → T008; T009 → T010 → T011 → T012 → T013 → T014 → T015. T005 en paralelo
  con T006.
- **US1 (Phase 3)**: depende de Foundational.
- **US2 (Phase 4)**: depende de US1 (se paga una compra registrada por el alta; la ruta
  `compras/[compraId]` y las piezas del detalle nacen en US1).
- **US3 (Phase 5)**: depende de US1 (rechazos del alta y la pantalla `ComprarEntradas`). Es
  independiente de US2; el caso de `GET /compras/:id` mal formado de T045 necesita T038 (si US2
  no está, se omite).
- **US4 (Phase 6)**: depende de US1 (T048) y de US2 (T049).
- **Polish (Phase 7)**: depende de las historias que se quieran entregar.

### Within Each User Story

- Test con stub → verlo fallar → implementar.
- Dominio → service → concurrencia → validación, controller y ruta → OpenAPI y Postman.
- `src/api/` → claves y hooks → componentes → pantalla y ruta.
- Las tareas sobre el mismo archivo son secuenciales: `compra.test.ts`, `evento.test.ts`,
  `compra.service.test.ts`, `concurrencia-compras.test.ts`, `api/compras.test.ts`,
  `compra.validation.ts`, `openapi.json`, `detalle-evento.test.tsx`,
  `comprar-entradas.test.tsx`, `compra.test.tsx`, `claves.ts`, `mutaciones.ts`, `LayoutRaiz.tsx`.

### Parallel Opportunities

- **Phase 2**: T005 (`Evento.devolverCupos`) en paralelo con T006–T008.
- **US1 backend**: T016 (`Compra.registrar`), T017 (`Evento`) y T018 (tope) en paralelo: archivos
  distintos. T019 espera a T017; T020 a T016–T019.
- **Backend y mobile de una historia** avanzan en paralelo una vez cerrada Foundational: en US1,
  T025–T026 (api y formato) en paralelo con T016–T024; en US2, T039–T040 en paralelo con
  T033–T038.
- **US3** backend (T045–T046) y mobile (T047) en paralelo.

---

## Parallel Example: User Story 1

```text
Task: "T016 Test de Compra.registrar en backend/tests/domain/compra.test.ts"
Task: "T017 Test de exigirQueSePuedeComprar/descontarCupo en backend/tests/domain/evento.test.ts"
Task: "T018 Test de entradasRestantes/exigirTopePorPersona en backend/tests/domain/tope-por-persona.test.ts"
Task: "T025 Test de comprarEntradas/obtenerMisComprasDelEvento en mobile/tests/api/compras.test.ts"
Task: "T026 Test de textoTotal/textoCantidad en mobile/tests/features/compras/formato.test.ts"
```

## Parallel Example: User Story 2

```text
Task: "T033 Test de Compra.pagar en backend/tests/domain/compra.test.ts"
Task: "T039 Test de EtiquetaEstadoCompra en mobile/tests/componentes/etiqueta-estado-compra.test.tsx"
Task: "T040 Test de obtenerCompra/pagarCompra en mobile/tests/api/compras.test.ts"
```

---

## Implementation Strategy

### MVP primero (US1 + US2)

1. Phase 1 y Phase 2 completas (cada una con `/speckit-implement fase N` y `/clear` entre fases).
2. Phase 3 (US1): **Validar**: Sofía compra 2 VIP (cupo 48), Diego agota Backstage, Lucía sin
   "Comprar", 50 compras simultáneas → 10.
3. Phase 4 (US2): **Validar**: pagar, pagar de nuevo (409), pagar ajena (403), vencida (409),
   Carrera kids → "Confirmar", "Tus compras pendientes".
4. Las cuatro verificaciones en verde. Es una entrega demostrable: con ella pueden empezar la
   007, la 008 y la 009.

### Entrega incremental

1. MVP (US1 + US2).
2. US3: rechazos claros. Validar la tabla de rechazos del quickstart.
3. US4: conexión inestable. Validar con el servidor apagado.
4. Polish y PR.

---

## Notes

- [P] = archivo distinto y sin dependencias pendientes.
- Cada historia es verificable sola en su checkpoint.
- Si una tarea obliga a decidir algo que el plan o la spec no cubren, se frena y se consulta (no
  se inventa la regla).
- T014, T022, T036 y T045 son tests de concurrencia o de contrato sobre lo que ya implementó una
  tarea anterior: pueden pasar de entrada. No se fuerza un rojo artificial; si fallan, se corrige
  la implementación de la tarea que corresponde.
- Hasta US2, `mobile/app/compras/[compraId].tsx` muestra `SeccionPendiente` ("Tu compra"): el alta
  navega ahí, pero el resumen y el pago llegan en la fase 4.
- Hasta US3, la app muestra los errores del alta con el comportamiento por defecto (sin los
  mensajes y ajustes de `contracts/app.md`); si se entrega solo el MVP, decirlo en el PR.
