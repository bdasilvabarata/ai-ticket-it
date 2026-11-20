---

description: "Tareas de implementación de la feature 010 — Refactor de Mis compras, Compras del evento y Cancelación"
---

# Tasks: Refactor de Mis compras, Compras del evento y Cancelación

**Input**: documentos de diseño en `specs/010-refactor-compras/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/interno.md](./contracts/interno.md),
[quickstart.md](./quickstart.md)

**Tests**: obligatorios (constitución II, TDD). Es un refactor: la **red de seguridad** son
`backend/tests/api/` y `mobile/tests/pantallas/`, que **no se modifican** (única excepción: las
aserciones de invalidación del test "registrar con éxito…" de
`mobile/tests/pantallas/registrar-ingreso.test.tsx`, T015). Lo nuevo se prueba primero
(`entrada.test.ts`, `reglas-de-compra.test.ts`, `reembolso`, `CompraService.registrarUso`); los
tests de `domain/`, `services/`, `repositories/` y los ayudantes se adaptan a la forma nueva **sin
perder ningún caso** (FR-003, SC-003).

**Organización**: una fase por tramo del alcance, agrupadas por historia (US1: fases 3–5; US2:
fases 6–7; US3: fase 8), en el orden de retorno del backlog. Las fases son **secuenciales**: tocan
los mismos archivos (`compra.ts`, `compra.vistas.ts`, `compra.service.ts`). La opcional (US4) va
después de la Fase 9, antes del cierre (Fase 11), y la feature se puede cerrar sin ella.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: puede hacerse en paralelo (archivo distinto, sin dependencias pendientes).
- **[Story]**: historia a la que pertenece (US1–US4).
- Rutas relativas a la raíz del repo.

## Convenciones para todas las tareas

- **Sin cambios visibles** (FR-001, FR-002): no se tocan `shared/`, `backend/src/docs/`, las rutas,
  los controllers, los textos ni los estilos de la app. Mismos códigos, mensajes y orden de los
  errores de las transiciones (FR-013). Si aparece un caso visible sin cubrir, se agrega su test
  **antes** de cambiar el código, sin modificar los existentes.
- **Test primero con stub en el mismo turno** (AGENTS.md, "TDD con stub"): el hook `Stop` exige
  typecheck y lint en verde al cerrar cada turno. Cada tarea "Test" crea **en el mismo turno** los
  módulos o miembros que importa como **stub con la firma real** que lanza
  `new Error("no implementado")` (un componente que devuelve `null`). Se corre con `test:foco`, se
  lo ve fallar por comportamiento y recién después se implementa.
- **Cambios de forma que rompen el typecheck** (la `Entrada` nueva, `tieneReembolsoPendiente`
  borrado): el código y **todos** sus usos (semilla, ayudantes y tests) se actualizan en el **mismo
  turno**, para que el hook no bloquee.
- `domain/` puro: sin Express, `errors/` ni reloj (`ahora` llega como argumento). `CompraService`
  es dueño de `Compra`; los 404/403 los lanza el service con `errors/`; los 409, `domain/`.
- Escrituras bajo `cerrojo.ejecutar(eventoId, …)` con `ahora` leído adentro, el evento releído al
  día y la compra releída; un `guardar`; sin cerrojos anidados. Lecturas sin cerrojo y sin guardar.
- Mobile: todo en `features/compras`, piezas nuevas sin exportar por `index.ts`; estilos con el
  `tema`; skill **`nueva-pantalla`** para la pantalla. Backend: skill **`nuevo-endpoint`** como
  checklist de capas (no hay endpoints nuevos).
- Prohibidos `any`, `@ts-ignore` y `eslint-disable` sin descripción.
- TDD: `npm run test:foco -w backend -- <archivo>` / `npm run test:foco -w mobile -- <archivo>`.
  Cada fase cierra con `npm test`, `npm run lint`, `npm run typecheck` y `npm run format:check` en
  verde, sus tareas marcadas y su commit (Conventional Commits, scope `010-refactor-compras`, por
  ejemplo `refactor(010-refactor-compras): entrada con uso y cancelación explícitos`).
- `/speckit-implement` de a una fase, con `/clear` entre fases: todo lo necesario está en esta
  lista, el plan, el data-model y el código.

---

## Phase 1: Setup (línea de base)

**Purpose**: dejar registrado el comportamiento de antes para compararlo al final.

- [X] T001 [P] En `docs/backlog.md`, pasar la 010 de `pendiente` a `tasks` (columna de estado de la tabla de features).
- [X] T002 Desde la raíz, correr `npm test`, `npm run lint`, `npm run typecheck` y `npm run format:check` **sin cambios de código** y confirmar las cuatro en verde (línea de base). Si algo falla, parar y avisar: no se empieza el refactor sobre una base roja.
- [X] T003 Snapshot de la semilla por la API (quickstart §1). Crear `node_modules/.cache/010-refactor-compras/snapshot.ts` (fuera de git: `node_modules/` está ignorado; **no se commitea**) que: importa `crearApp` de `../../../backend/src/app` y `supertest`; arma `crearApp({ reloj: { ahora: () => new Date("2026-11-20T15:00:00.000Z") } })`; hace los pedidos de la tabla de quickstart §1 con su `X-Usuario-Id` (`GET /api/compras` como `usuario-martin`, `usuario-diego`, `usuario-valentina`, `usuario-sofia`; `GET /api/compras/:id` de cada compra del seed como su comprador: `compra-martin-festival-vip`, `compra-diego-festival-general`, `compra-martin-pena-general`, `compra-sofia-pena-con-cena`, `compra-diego-maraton-inscripcion`, `compra-valentina-maraton-inscripcion`; `GET /api/eventos/evento-pena-en-la-rueda/compras` y `GET /api/eventos/evento-maraton-10k/compras` como `usuario-lucia`; `GET /api/eventos/evento-pena-en-la-rueda/entradas/PRGM3A01` y `…/PRGM3A02`, `GET /api/eventos/evento-maraton-10k/entradas/MZDF1C01` y `…/MZVG2R01` como Lucía; `GET /api/eventos/:eventoId/mis-compras` de `evento-festival-sonidos-del-sur`, `evento-pena-en-la-rueda` y `evento-maraton-10k` como cada comprador de ese evento; `GET /api/eventos` y `GET /api/eventos/:eventoId` de esos tres eventos sin usuario), y escribe `{ pedido, status, body }[]` como JSON indentado en la ruta que recibe por argumento. Correrlo con `npx tsx node_modules/.cache/010-refactor-compras/snapshot.ts node_modules/.cache/010-refactor-compras/antes.json` y verificar que todos los status son 200.

---

## Phase 2: Foundational

**Purpose**: no hay prerequisitos compartidos aparte de la línea de base: cada fase siguiente
construye sobre la anterior (ver "Dependencies").

---

## Phase 3: User Story 1 — `Entrada` explícita y una sola "entrada usada" (Priority: P1) 🎯 MVP

**Goal**: la entrada registra su uso y su cancelación (quién y cuándo) y su estado visible lo da la
compra; "entrada usada" se define una sola vez (puntos 1 y 3 del alcance, primera parte).

**Independent Test**: `tests/api/` sin modificar en verde; `entrada.test.ts` cubre cada transición
de la entrada; `compra.test.ts` cubre el estado visible de una entrada en cada estado de la compra.

- [X] T004 [US1] En `backend/src/domain/compras-del-evento.ts`, `resumenPorTipo` suma `resumen.usadas += compra.entradasUsadas` en lugar de filtrar `compra.entradas` por `estadoEn(compra) === UTILIZADA` (research R7; FR-006). `EstadoCompra` se sigue importando (lo usan los estados de la compra); solo desaparece el filtro por entrada. Correr `npm run test:foco -w backend -- tests/domain/compras-del-evento.test.ts tests/services/compra.service.test.ts tests/api/compras.test.ts` en verde.
- [X] T005 [US1] Test en `backend/tests/domain/entrada.test.ts` (nuevo) con el stub de `backend/src/domain/entrada.ts` con las firmas de data-model ("Entrada"): `export interface RegistroDeEntrada { usuarioId: string; fechaHora: Date }`, `export interface PropiedadesEntrada { codigo: string; uso?: RegistroDeEntrada | null; cancelacion?: RegistroDeEntrada | null }`, `export class Entrada` (`codigo`, `uso`, `cancelacion`, getters `usada`, `cancelada`, `usadaEn`, `estadoPropio`, métodos `usar(organizadorId, ahora)`, `cancelar(compradorId, ahora)`) y `export function motivoNoUsable(estado: EstadoCompra | null): string`. Casos: sin `uso` ni `cancelacion` → los dos `null` (por defecto), `usada`/`cancelada` en `false`, `usadaEn` `null`, `estadoPropio` `CONFIRMADA`; `usar("usuario-lucia", t)` devuelve una entrada nueva con `uso: { usuarioId: "usuario-lucia", fechaHora: t }`, `usada: true`, `usadaEn: t`, `estadoPropio: UTILIZADA`, sin tocar la original; `cancelar("usuario-martin", t)` → `cancelacion: { usuarioId: "usuario-martin", fechaHora: t }`, `cancelada: true`, `estadoPropio: CANCELADA`, sin tocar la original; `uso` y `cancelacion` congelados (`Object.isFrozen`); `motivoNoUsable` con los mensajes **al pie de la letra** de hoy (`backend/src/domain/compra.ts`, función `motivoNoUsable`): `UTILIZADA` → "Esta entrada ya se utilizó.", `PENDIENTE` → "La compra de esta entrada todavía no se pagó.", `CANCELADA` → "La compra de esta entrada está cancelada.", `REEMBOLSADA` → "La compra de esta entrada fue reembolsada.", `null` o `CONFIRMADA` → "La entrada no es de esta compra.". Verlo fallar y luego implementar `entrada.ts` (sin importar `compra.ts`).
- [X] T006 [US1] Pasar `Compra` a la `Entrada` nueva **en un solo turno** (la forma vieja deja de compilar). En `backend/src/domain/compra.ts`: borrar `PropiedadesEntrada` y la clase `Entrada` viejas y la función `motivoNoUsable` (ahora en `entrada.ts`), importar de `./entrada` y re-exportar `export { Entrada, type RegistroDeEntrada } from "./entrada";`; sumar `estadoDe(entrada: Entrada): EstadoCompra` (`!this.fueConfirmada` → `this.estado`; si no, `entrada.estadoPropio`) y hacer que `estadoDeEntrada(codigo)` lo use; `entradasUsadas` = `this.entradas.filter((entrada) => entrada.usada).length`; `registrarUso` y `cancelar` siguen llamando a `entrada.usar(organizadorId, ahora)` / `entrada.cancelar(usuarioId, ahora)`; `entradasCoherentes` se adapta **provisoriamente** a la forma nueva (sin cambios propios = `!usada && !cancelada`; "usada" = `usada`; "cancelada" = `cancelada`; en `CANCELADA`/`REEMBOLSADA` tras confirmar: `cancelada && !usada`) hasta que la Fase 4 la reemplace. En el mismo turno: `backend/src/services/compra.vistas.ts` (`aEntradaVista`: `estado: compra.estadoDe(entrada)`); `backend/src/seed/datos-ejemplo.ts` (tabla "Semilla" de data-model: `PRGM3A01` con `uso: { usuarioId: lucia, fechaHora: <la de usoDeMartin> }`, `MZDF1C01` con `cancelacion: { usuarioId: diego, fechaHora: dias(1) }`, `MZVG2R01`/`MZVG2R02` con `cancelacion: { usuarioId: valentina, fechaHora: dias(2) }`; el historial de cada compra no cambia); `backend/tests/helpers/eventos.ts` (`entradasDePrueba(cantidad, historial)` **con la misma firma**: si pasó por `CONFIRMADA` y tiene un `CANCELADA`, todas con `cancelacion` = autor usuario y fecha de ese cambio; si el último es `UTILIZADA`, la primera con `uso` = autor y fecha de ese cambio; si no, sin nada; actualizar su JSDoc); y los tests que usan la forma vieja, reemplazando sin perder el caso: `new Entrada({ codigo, cambios: [cambioUso] })` → `new Entrada({ codigo, uso: { usuarioId, fechaHora } })` (ídem `cancelacion`), `entrada.cambios` → `entrada.uso` / `entrada.cancelacion`, `entrada.cambios.length === 0` → `!entrada.usada && !entrada.cancelada`, `entrada.ultimoEstadoPropio === CANCELADA` / `tieneCambioA(CANCELADA)` → `entrada.cancelada`, `tieneCambioA(UTILIZADA)` → `entrada.usada`, `entrada.estadoEn(compra)` → `compra.estadoDe(entrada)`, en `backend/tests/domain/compra.test.ts`, `backend/tests/domain/compras-del-evento.test.ts`, `backend/tests/domain/datos-ejemplo.test.ts`, `backend/tests/services/compra.service.test.ts` y `backend/tests/services/concurrencia-compras.test.ts` (los casos de "dos cambios" de `compra.test.ts`, como `dosCancelaciones`, pasan a "usada y cancelada a la vez", que sigue siendo inválida). Mover los tests de la entrada que ahora cubre `entrada.test.ts` (p. ej. "`Entrada.cancelar` devuelve…") sin borrar los que verifican la compra. `grep -rn "estadoEn(\|ultimoEstadoPropio\|tieneCambioA\|cambios: \[" backend/src backend/tests` sin resultados de entradas. `npm run test:afectados -w backend` y `npm run test:foco -w backend -- tests/api/compras.test.ts tests/api/entradas.test.ts tests/api/eventos.test.ts` en verde. Orden sugerido dentro del turno: `entrada.ts` ya implementado (T005) → `compra.ts` → `compra.vistas.ts` → semilla → `helpers/eventos.ts` → tests. Antes de cerrar el turno, el typecheck tiene que estar en verde; si a mitad de camino no se llega, `git restore backend/` y reintentar (ningún paso intermedio se commitea).
- [X] T007 [US1] Test en `backend/tests/domain/compra.test.ts` (se amplía) del estado visible de una entrada (tabla "Estado visible de una entrada" de data-model; FR-008) y de los escenarios 1–4 de la US1: una `PENDIENTE`, una `CANCELADA` desde pendiente y una vencida (`alDia`) → cada entrada con el estado de la compra; una `CONFIRMADA` → `CONFIRMADA`; `registrarUso(codigoA, "usuario-lucia", t)` sobre una confirmada → la entrada A con `uso: { usuarioId: "usuario-lucia", fechaHora: t }`, la compra con el último cambio `{ UTILIZADA, autor: usuario-lucia, fechaHora: t }`; un segundo `registrarUso(codigoB, …, t2)` → B usada y el historial **sin** cambios nuevos; `cancelar("usuario-martin", t, inicio)` de una confirmada → todas con `cancelacion: { usuarioId: "usuario-martin", fechaHora: t }` y `estadoDeEntrada` `CANCELADA`; una `REEMBOLSADA` → sus entradas `CANCELADA` y la compra `REEMBOLSADA`. Si alguno ya está cubierto tras T006, no duplicarlo: anotarlo. Correr con `test:foco` (deberían pasar: es cobertura del comportamiento conservado).
  - Resultado: los escenarios ya quedaban cubiertos tras T006 (`describe("Compra.estadoDe")` y "estado derivado" para pendiente, cancelada desde pendiente, vencida al día, confirmada y reembolsada; `Compra.registrarUso` para el uso de A y el historial; `Compra.cancelar de una CONFIRMADA` para `cancelacion` y `estadoDeEntrada`). Solo se sumó la aserción del `uso` (quién y cuándo) de la segunda entrada usada. Pasaron de entrada (no es un rojo de TDD).

**Checkpoint**: suite completa en verde, tareas marcadas y commit.

---

## Phase 4: User Story 1 — Reglas de la compra, una por regla (Priority: P1)

**Goal**: las invariantes de `Compra` como once reglas con nombre, cada una con su detalle, sin
`entradasCoherentes` ni la guarda combinada `!cantidadValida || …` (punto 3, segunda parte;
FR-009, FR-010).

**Independent Test**: `reglas-de-compra.test.ts` tiene, por regla, un caso que la cumple y uno que
la viola; `compra.test.ts` conserva todos los casos de invariantes.

- [ ] T008 [US1] Test en `backend/tests/domain/reglas-de-compra.test.ts` (nuevo) con el stub de `backend/src/domain/reglas-de-compra.ts`: `export interface ReglaDeCompra { nombre: string; campo: keyof PropiedadesCompra; mensaje: string; cumple(propiedades: PropiedadesCompra): boolean }`, `export const REGLAS_DE_COMPRA: readonly ReglaDeCompra[]` (las once de la tabla "Reglas de la compra" de data-model, **en ese orden**, con `nombre`, `campo` y `mensaje` **al pie de la letra**; en el stub, `cumple` lanza "no implementado") y `export function pasoPorConfirmada(historial: readonly CambioEstadoCompra[]): boolean`; los tipos `PropiedadesCompra` y `CambioEstadoCompra` con `import type` desde `./compra` (research R2). El test busca cada regla por `nombre` y llama a `regla.cumple(propiedades)` con propiedades armadas a mano (sin construir la `Compra`). Un caso que la cumple y uno que la viola por regla: `cantidad-valida` (1 / 0, 1.5); `total-valido` (0 / −1, 1.5); `historial-valido` (`[PENDIENTE]` / vacío, que empieza en `CONFIRMADA`, estado desconocido, fecha inválida, fechas decrecientes); `reembolso-valido` (paga cancelada tras confirmar + `REEMBOLSADA` / `REEMBOLSADA` no último, que no sigue a `CANCELADA`, sin `CONFIRMADA`, con `total` 0); `una-entrada-por-unidad` (2 entradas y cantidad 2 / 1 entrada y cantidad 2; **y con cantidad 0 o 1.5 se cumple**, porque esa la informa `cantidad-valida`); `codigos-con-formato` (códigos válidos / uno de 7 caracteres o con una letra fuera del alfabeto); `codigos-distintos` (distintos / repetido); `sin-cambios-antes-de-confirmar` (pendiente sin nada; cancelada tras confirmar con canceladas / pendiente con una usada, pendiente con una cancelada, vencida con una cancelada); `usada-o-cancelada` (una usada y otra cancelada en entradas distintas se cumple / una entrada con `uso` y `cancelacion`); `utilizada-si-alguna-usada` (`UTILIZADA` con una usada; `CONFIRMADA` sin usadas / `UTILIZADA` sin usadas, `CONFIRMADA` con una usada); `canceladas-con-la-compra` (cancelada tras confirmar con todas canceladas; `REEMBOLSADA` con todas canceladas; `CONFIRMADA` sin canceladas / cancelada tras confirmar con una sin cancelar, `CONFIRMADA` con una cancelada, `UTILIZADA` con una cancelada). Más: `pasoPorConfirmada` (`true` con un `CONFIRMADA` en cualquier posición, `false` sin él) y que `REGLAS_DE_COMPRA` tiene 11 reglas con nombres distintos. Verlo fallar y luego implementar (predicados auxiliares privados: `esCantidadValida`, `ultimoEstado(historial)`, `canceladaTrasConfirmar`; cada regla escribe **su** condición, sin reusar el resultado de otra).
- [ ] T009 [US1] En `backend/src/domain/compra.ts`, el constructor recorre `REGLAS_DE_COMPRA` (`for (const regla of REGLAS_DE_COMPRA) invariantes.exigir(regla.cumple(propiedades), regla.campo, regla.mensaje)` y `verificar()`) y se borran `sonEntradasValidas`, `entradasCoherentes`, `esReembolsoValido`, `esHistorialValido`, `pasoPorConfirmada` (se importa de `./reglas-de-compra` para `fueConfirmada`) y las constantes que solo usaban ellas (`ESTADOS` pasa a `reglas-de-compra.ts`). En `backend/tests/domain/compra.test.ts`, conservar **cada** caso de invariantes: los que comparan `camposInvalidos(...)` con `["entradas"]` siguen valiendo si fallan una o más reglas de `entradas` (compararlos con `[...new Set(campos)]` o con el mensaje de la regla esperada, eligiendo el que deje más claro qué regla se viola); sumar a nivel de `Compra`: (a) una compra con varias reglas violadas a la vez informa cada detalle (`DatosInvalidosError` con un detalle por regla, p. ej. una `PENDIENTE` con una entrada usada → los mensajes de `sin-cambios-antes-de-confirmar` y `utilizada-si-alguna-usada`); (b) cantidad 0 con 1 entrada → solo el detalle de `cantidad` (no el de `una-entrada-por-unidad`). `grep -n "entradasCoherentes\|sonEntradasValidas\|cantidadValida ||" backend/src/domain` sin resultados. `npm run test:afectados -w backend` y `npm run test:foco -w backend -- tests/api/compras.test.ts tests/api/entradas.test.ts` en verde.

**Checkpoint**: suite completa en verde, tareas marcadas y commit.

---

## Phase 5: User Story 1 — `compra.reembolso` (Priority: P1)

**Goal**: el reembolso como un único valor derivado de la compra (punto 4; FR-012).

**Independent Test**: `compra.test.ts` cubre `reembolso` en cada estado (tabla de data-model); las
vistas y `confirmarReembolso` responden igual (tests de API sin modificar).

- [ ] T010 [US1] Test en `backend/tests/domain/compra.test.ts` (se amplía; reemplaza el `describe("tieneReembolsoPendiente")`) con el stub en `backend/src/domain/compra.ts` de `export type EstadoDeReembolso = "pendiente" | "confirmado";` y el getter `get reembolso(): EstadoDeReembolso | null`. Casos (tabla "Reembolso" de data-model): `REEMBOLSADA` → `"confirmado"`; `CANCELADA` tras confirmar y paga → `"pendiente"`; `CANCELADA` tras confirmar con `total` 0 → `null`; `CANCELADA` desde pendiente, vencida (también `alDia` de una pendiente vencida) → `null`; `PENDIENTE`, `CONFIRMADA`, `UTILIZADA` → `null`; y tras las transiciones: `cancelar` de una confirmada paga → `"pendiente"`, de una gratis → `null`, `confirmarReembolso` → `"confirmado"`. Verlo fallar y luego, **en el mismo turno** que borra `tieneReembolsoPendiente()`: implementar `reembolso`; `confirmarReembolso` usa `this.reembolso === "confirmado"` → `TRANSICION_INVALIDA` «El reembolso de esta compra ya se confirmó.» y `this.reembolso === null` → `TRANSICION_INVALIDA` «Esta compra no tiene un reembolso pendiente.» (mismo orden y mensajes); `aReembolsoVista` en `backend/src/services/compra.vistas.ts` queda `compra.reembolso ? { estado: compra.reembolso, monto: compra.total } : null`; y los usos de `tieneReembolsoPendiente()` en `backend/tests/domain/compra.test.ts` y `backend/tests/domain/datos-ejemplo.test.ts` pasan a `reembolso` (`true` → `"pendiente"`, `false` → el valor que corresponda en ese caso). `grep -rn "tieneReembolsoPendiente" backend` sin resultados.
- [ ] T011 [US1] Cierre de US1: `wc -l backend/src/domain/compra.ts` ≤ **300** (SC-005; medir aparte `entrada.ts` y `reglas-de-compra.ts` y anotarlos debajo de esta tarea). Si pasa de 300, mover a otro módulo lo que no sea de la compra (p. ej. `cupoLiberadoPorTipo` a `backend/src/domain/vencimiento.ts`, nuevo, actualizando su import en `backend/src/services/vencimiento.service.ts` y en los tests), **no** recortar documentación de reglas o transiciones. Revisar que los JSDoc de `compra.ts`, `entrada.ts` y `reglas-de-compra.ts` describen la forma nueva (sin "cambios propios").
- [ ] T019 Enmendar `.specify/memory/constitution.md` a **2.5.2** (PATCH) con `/speckit-constitution` (research R9; FR-024): en "Entidades", la **Entrada** dice "un **código** propio, corto y legible, que no se repite entre entradas (es su identificador), su **uso** y su **cancelación**, cada uno con quién y cuándo (o ninguno)"; en "Estado de una entrada", "con su propio cambio de estado (quién y cuándo)" pasa a "registrando su uso (quién y cuándo)". Ninguna regla cambia; Sync Impact Report al principio y `Last Amended` 2026-11-20 (o la fecha del día). Se hace al cerrar US1 (y no en la Fase 9), para que la constitución y el código describan la misma entrada desde el primer commit del modelo nuevo.

**Checkpoint**: suite completa en verde, tareas marcadas y commit. US1 completa: el modelo de la
compra y la entrada es el que usarán la 011 y la 012.

---

## Phase 6: User Story 2 — Vistas compuestas (Priority: P2)

**Goal**: las vistas del organizador se arman con las mismas piezas que las del comprador (punto
5; FR-017, SC-006).

**Independent Test**: los tests de API de "Compras del evento", la entrada buscada, "Tu compra" y
"Mis compras" pasan sin modificarse; los de `compra.service.test.ts` y `entrada.service.test.ts`,
también.

- [ ] T012 [US2] En `backend/src/services/compra.vistas.ts`, extraer las piezas privadas de research R6 y data-model ("Vistas"): `aTipoDeLaCompra(compra, evento)` (`{ id: compra.tipoEntradaId, nombre: evento.buscarTipoEntrada(compra.tipoEntradaId)?.nombre ?? "" }`), `aCompradorVista(usuario)` (`{ id, nombre, apellido }`), `vencimiento(compra)` (`venceEn` y `venceEnLocal`, solo en `PENDIENTE`, si no `null`), `estadoDeLaCompra(compra)` (`estado`, `entradasUsadas`, `canceladaDesde`, `reembolso: aReembolsoVista(compra)`) y la ya existente `canceladaPor`. `datosComunes` se arma con ellas; `aCompraDelEventoVista(compra, comprador, evento)` **recibe el evento en lugar del tipo** y se arma con `aCompradorVista`, `aTipoDeLaCompra`, `vencimiento`, `canceladaPor` y `estadoDeLaCompra`; `aEntradaDelEventoVista` arma `compra` con `aCompradorVista`, `aTipoDeLaCompra` y `estado`/`entradasUsadas` de `estadoDeLaCompra`. Actualizar las dos llamadas de `backend/src/services/compra.service.ts` (`confirmarReembolso` y `comprasDelEvento`: pasan `evento`). El JSDoc de `estadoDeLaCompra` dice que un dato de la compra que ven comprador y organizador se suma ahí. Sin cambios en `shared/`. `npm run test:foco -w backend -- tests/services/compra.service.test.ts tests/services/entrada.service.test.ts tests/api/compras.test.ts tests/api/entradas.test.ts` en verde.

**Checkpoint**: suite completa en verde, tareas marcadas y commit.

---

## Phase 7: User Story 2 — Un solo dueño de las compras (Priority: P2)

**Goal**: `CompraService` es el único service de casos de uso que guarda compras; `EntradaService`
delega el uso (punto 6; FR-014, FR-015, FR-016).

**Independent Test**: `tests/api/entradas.test.ts` y `tests/services/concurrencia-compras.test.ts`
sin cambios de lo que verifican, en verde; `compra.service.test.ts` cubre `registrarUso` con los
mismos casos que hoy cubre `entrada.service.test.ts`.

- [ ] T013 [US2] Test en `backend/tests/services/compra.service.test.ts` (se amplía, `describe("CompraService.registrarUso (feature 010)")` y `describe("CompraService.obtenerPorCodigoOFallar")`) con los stubs en `backend/src/services/compra.service.ts` de `obtenerPorCodigoOFallar(eventoId: string, codigoCanonico: string): Promise<Compra>` y `registrarUso(eventoId: string, codigo: string, usuarioId: string): Promise<EntradaDelEventoVista>`. Usar `crearServicesDeEventos` y los datos/armado de `backend/tests/services/entrada.service.test.ts` (evento A de Lucía que empieza en `AHORA + 2 h`, `deMartin`, `tipeado`). Casos de `obtenerPorCodigoOFallar`: devuelve la compra; código con formato inválido, inexistente o de otra compra de otro evento → `EntradaNoEncontradaError`. Casos de `registrarUso` (los mismos que hoy tiene `EntradaService.registrarUso` en `entrada.service.test.ts`, research R4): código tipeado con minúsculas y guion → vista con la entrada `UTILIZADA`, `usadaEn` = el `ahora` leído **dentro** del cerrojo y `compra.entradasUsadas: 1`; la segunda entrada de la misma compra → `entradasUsadas: 2` sin sumar cambios al historial; orden de rechazos 404 `EVENTO_NO_ENCONTRADO` → 403 (`SinPermisoError`, también el comprador) → 404 `EntradaNoEncontradaError` → 409 `FUERA_DE_HORARIO_DE_USO` (evento B, ventana cerrada) → 409 `TRANSICION_INVALIDA` (ya usada, pendiente, cancelada, reembolsada, con el mensaje de `motivoNoUsable`); una pendiente vencida → materializada y `TRANSICION_INVALIDA` «La compra de esta entrada está cancelada.»; **un solo** `guardar` de compras por uso (espía sobre el repositorio de compras) y ningún `guardar` de eventos (el cupo no cambia); ante un error, el cerrojo se libera (una segunda llamada no queda esperando). Verlo fallar y luego implementar (research R3/R4): `obtenerPorCodigoOFallar` con `esCodigoValido(codigo) ? await this.#compras.buscarPorCodigoDeEntrada(codigo) : null` y `!compra || compra.eventoId !== eventoId` → `EntradaNoEncontradaError`; `registrarUso` con el cuerpo de hoy de `EntradaService.registrarUso` (`cerrojo.ejecutar` → `reloj.ahora()` → `eventoService.obtenerDelOrganizador(eventoId, usuarioId, ahora)` → `normalizarCodigo` → `obtenerPorCodigoOFallar` → `exigirVentanaAbierta(evento.fechaHora, ahora)` → `compra.alDia(ahora).registrarUso(canonico, usuarioId, ahora)` → `guardar` → `usuarioService.obtenerOFallar(compradorId)` → `aEntradaDelEventoVista`). JSDoc al estilo de `cancelar`/`confirmarReembolso`.
- [ ] T014 [US2] En `backend/src/services/entrada.service.ts`: `DependenciasEntradaService` pasa a `{ compraService: CompraService; eventoService: EventoService; usuarioService: UsuarioService; reloj: Reloj }` (sin `compras` ni `cerrojo`); `obtener` usa `this.#compraService.obtenerPorCodigoOFallar(eventoId, canonico)` en lugar de `#buscarEnElEvento` (que se borra); `registrarUso` es `return this.#compraService.registrarUso(eventoId, codigo, usuarioId);`; actualizar el JSDoc de la clase ("no escribe compras: el uso lo registra `CompraService`, dueño de `Compra`"). En el mismo turno: `backend/src/app.ts` (`new EntradaService({ compraService, eventoService, usuarioService, reloj })` y el comentario: "las entradas viven dentro de las compras: el uso lo guarda su dueño, `CompraService`"; el orden de construcción no cambia) y `backend/tests/helpers/services-de-eventos.ts` (misma conexión y JSDoc). `backend/tests/services/entrada.service.test.ts` se conserva entero (ahora prueba la delegación de punta a punta). Verificar con `grep -n "RepositorioCompras\|cerrojo\|guardar" backend/src/services/entrada.service.ts` sin resultados y `grep -rn "compras.guardar" backend/src/services` solo en `compra.service.ts` y `vencimiento.service.ts`. `npm run test:foco -w backend -- tests/services/entrada.service.test.ts tests/services/concurrencia-compras.test.ts tests/services/compra.service.test.ts tests/api/entradas.test.ts` en verde.

**Checkpoint**: suite completa en verde, tareas marcadas y commit. US2 completa.

---

## Phase 8: User Story 3 — "Registrar ingreso" en la app (Priority: P3)

**Goal**: registrar un ingreso no vuelve a pedir el evento ni el catálogo, y la pantalla se lee en
dos piezas sin ternarios anidados (puntos 2 y 7; FR-018, FR-019).

**Independent Test**: `mobile/tests/pantallas/registrar-ingreso.test.tsx` (con la excepción de las
aserciones de invalidación) y `mobile/tests/pantallas/compras-del-evento.test.tsx` en verde.

- [ ] T015 [US3] **Excepción acotada** (spec, Clarifications; FR-003): en el test "registrar con éxito: un POST sin cuerpo, el aviso, el campo vacío y las consultas vuelven a pedirse" de `mobile/tests/pantallas/registrar-ingreso.test.tsx`, cambiar **solo** las aserciones de invalidación: sacar `["catalogo"]` del `arrayContaining` (quedan `["compras-del-evento", lucia.id, "evento-festival"]`, `["entrada-del-evento", lucia.id, "evento-festival", "7K3MQ9TB"]`, `["compra"]`, `["mis-compras"]`, `["mis-compras-del-evento"]`); reemplazar `expect(invalidar.mock.calls.some(([filtro]) => typeof filtro?.predicate === "function")).toBe(true)` por la misma expresión con `.toBe(false)`; y sumar `expect(claves).not.toContainEqual(["catalogo"])`. Nada más del archivo cambia. Correr `npm run test:foco -w mobile -- tests/pantallas/registrar-ingreso.test.tsx` y verlo fallar. Luego, en `mobile/src/features/compras/mutaciones.ts`, `useRegistrarUso.onSettled` deja de invalidar `{ predicate: delEvento(eventoId) }` y `["catalogo"]` (research R8; el resto igual, también el `setQueryData` de `onSuccess`) y su JSDoc dice por qué: el uso no cambia el cupo. En verde.
- [ ] T016 [US3] Dividir `mobile/src/features/compras/pantallas/RegistrarIngreso.tsx` (skill `nueva-pantalla`; research R8, data-model "Registrar ingreso"): crear `mobile/src/features/compras/componentes/BuscadorDeCodigo.tsx` (props `{ texto: string; alCambiar: (texto: string) => void; alBuscar: () => void; refCampo: RefObject<ComponentRef<typeof TextInput> | null> }`; el `CampoDeTexto` "Código de la entrada" con `autoCapitalize="characters"`, `autoCorrect={false}`, `maxLength={32}` y el `Boton` "Buscar" deshabilitado si `normalizarCodigo(texto) === ""`) y `mobile/src/features/compras/componentes/ResultadoDeIngreso.tsx` (props `{ consulta: UseQueryResult<EntradaDelEventoVista>; enCurso: boolean; alRegistrar: (entrada: EntradaDelEventoVista) => void }`, con `UseQueryResult` de `@tanstack/react-query` y `EntradaDelEventoVista` de `shared/`, el tipo que devuelve `useEntradaDelEvento`; con un `if` por caso: `ENTRADA_NO_ENCONTRADA` → el `Text` "No hay ninguna entrada con ese código en este evento." con `accessibilityLiveRegion="polite"`; si no, `SegunConsulta` con el mismo `mensajeVacio`, `TarjetaEntrada` y `AccionDeIngreso` (la `Accion` de hoy, movida y renombrada, interna del archivo)). La pantalla conserva el estado (`texto`, `codigo`, `aviso`), el ref del campo, `useEntradaDelEvento`, `useRegistrarUso`, `useSalirSiNoExisteElEvento`, `buscar` y `alRegistrar` con el `Alert`, y dibuja `BuscadorDeCodigo`, el aviso con `aviso && <Text …>` y `codigo !== null && <ResultadoDeIngreso … />`. Estilos movidos con cada pieza (`StyleSheet`, valores del `tema`); mismos textos, roles, `accessibilityLiveRegion` y foco. Sin exportar las piezas por `mobile/src/features/compras/index.ts`. Ninguna expresión de lo que se dibuja encadena un ternario dentro de otro (FR-019). `npm run test:foco -w mobile -- tests/pantallas/registrar-ingreso.test.tsx tests/pantallas/compras-del-evento.test.tsx` en verde **sin tocar** esos tests (más allá de T015).

**Checkpoint**: suite completa en verde, tareas marcadas y commit. US3 completa.

---

## Phase 9: Polish, documentación y validación

**Purpose**: AGENTS.md, skills y comparación con la línea de base (la constitución ya se enmendó
en T019, al cerrar US1; el backlog y el PR van en la Fase 11).

- [ ] T017 [P] Actualizar `AGENTS.md` (FR-022): en "Recursos · entradas", `EntradaService` con `obtener` (lectura, con `CompraService.obtenerPorCodigoOFallar`) y `registrarUso` que **delega** en `CompraService.registrarUso` (mismo cerrojo y orden de chequeos); en "Compras", `compra.reembolso` (`"pendiente"` · `"confirmado"` · `null`) en lugar de `tieneReembolsoPendiente()` y `compra.estadoDe(entrada)`; en "Entradas y uso", `domain/entrada.ts` (`Entrada` con `uso` y `cancelacion`, cada uno `{ usuarioId, fechaHora }` o `null`; `usada`, `cancelada`, `usadaEn`, `estadoPropio`, `motivoNoUsable`) en lugar de "sus cambios propios", `estadoEn` y `entradasCoherentes`, y `domain/reglas-de-compra.ts` (`REGLAS_DE_COMPRA`, una por regla con nombre, campo y mensaje); "entrada usada" definida solo en `Entrada.usada` (`resumenPorTipo` usa `compra.entradasUsadas`); en "Services que se apoyan en otros", `EntradaService` recibe `CompraService` (no `RepositorioCompras` ni el cerrojo) y `CompraService` es el único service de casos de uso que guarda compras (excepción: `VencimientoService.vencerPendientes`); las vistas compuestas de `compra.vistas.ts` (`estadoDeLaCompra`, `aTipoDeLaCompra`, `aCompradorVista`, `vencimiento`; `aCompraDelEventoVista(compra, comprador, evento)`); en mobile, `useRegistrarUso` sin el evento ni el catálogo y "Registrar ingreso" con `BuscadorDeCodigo` y `ResultadoDeIngreso`. El seed: mismas compras con `uso`/`cancelacion`.
- [ ] T018 [P] Revisar `.claude/skills/nuevo-endpoint/` y `.claude/skills/nueva-pantalla/` (FR-022): actualizarlas solo si mencionan algo que cambió (`EntradaService` escribiendo compras, `cambios` de la entrada, `estadoEn`, `tieneReembolsoPendiente`, `useRegistrarUso`, la estructura de `RegistrarIngreso`). Anotar debajo de esta tarea qué se cambió o "sin cambios" con el `grep` usado.
- [ ] T020 Comparar con la línea de base (FR-004): correr `npx tsx node_modules/.cache/010-refactor-compras/snapshot.ts node_modules/.cache/010-refactor-compras/despues.json` y `diff node_modules/.cache/010-refactor-compras/antes.json node_modules/.cache/010-refactor-compras/despues.json`: DEBE estar vacío. Si no, es una regresión: corregir el código (no el snapshot). Anotar el resultado debajo de esta tarea.
- [ ] T021 Verificaciones de quickstart §4 y §5: `git diff --stat development -- shared backend/src/docs backend/tests/api` vacío; `git diff development -- mobile/tests/pantallas` solo con las aserciones de T015; `wc -l backend/src/domain/compra.ts` ≤ 300; y los `grep` de la tabla §5 con el resultado esperado. Anotar los números debajo de esta tarea.
- [ ] T022 Correr `npm test`, `npm run lint`, `npm run typecheck` y `npm run format:check` desde la raíz y dejar las cuatro en verde.
- [ ] T023 Validar a mano en el celular los 5 puntos de quickstart §6 (SC-008) y anotar cualquier desvío debajo de esta tarea.

---

## Phase 10: User Story 4 — Deduplicaciones opcionales (Priority: P4) ⚪ OPCIONAL

**Purpose**: solo si sobra tiempo (FR-020, FR-021). La feature y su PR se cierran sin esta fase; si
se hace, va antes de la Fase 11.

**Independent Test**: los tests de pantalla de "Tu compra" y "Compras del evento" (incluido el doble
toque en el diálogo) y `dias-restantes.test.ts` pasan sin cambiar lo que verifican.

- [ ] T025 [P] [US4] Test en `mobile/tests/features/compras/useEnvioUnico.test.ts` (nuevo, `renderHook` de React Native Testing Library) con el stub de `mobile/src/features/compras/useEnvioUnico.ts` (`export function useEnvioUnico(): (enviar: (alTerminar: () => void) => void) => void`; research R11): la primera llamada ejecuta `enviar`; una segunda antes de `alTerminar()` no lo ejecuta; después de `alTerminar()`, sí. Verlo fallar e implementarlo con un `useRef(false)`. Luego usarlo en `Pago` y `Cancelacion` de `mobile/src/features/compras/pantallas/Compra.tsx` y en `Contenido` de `mobile/src/features/compras/pantallas/ComprasDelEvento.tsx` en lugar de cada `useRef(false)` (`enviarUnaVez((terminar) => mutation.mutate(variables, { onSettled: terminar }))`), conservando el comentario de por qué hace falta (el `Alert` responde antes del re-render). `npm run test:foco -w mobile -- tests/features/compras/useEnvioUnico.test.ts tests/pantallas/compra.test.tsx tests/pantallas/compras-del-evento.test.tsx` en verde sin tocar los de pantallas.
- [ ] T026 [P] [US4] Test en `backend/tests/domain/hora-buenos-aires.test.ts` (se amplía) con el stub de `diaDeCalendarioDeBuenosAires(instante: Date): number` en `backend/src/domain/hora-buenos-aires.ts` (research R11): `2026-11-20T02:59Z` (23:59 del 19 en Buenos Aires) → `Date.UTC(2026, 10, 19)`; `2026-11-20T03:00Z` (00:00 del 20) → `Date.UTC(2026, 10, 20)`; un 31 de diciembre a las 23:59 de Buenos Aires → ese día, no el 1 de enero. Verlo fallar e implementarla con `DESFASE_UTC_HORAS` (sin partir textos). En `backend/src/domain/dias-restantes.ts`, `diasRestantes` la usa y se borra `diaDeCalendario` (sin `split` ni `horaDeBuenosAires`). `npm run test:foco -w backend -- tests/domain/hora-buenos-aires.test.ts tests/domain/dias-restantes.test.ts tests/api/compras.test.ts` en verde sin cambiar lo que verifica `dias-restantes.test.ts`.
- [ ] T027 [US4] Suite completa en verde; sumar a AGENTS.md lo que corresponda (`useEnvioUnico` en `features/compras`; `diaDeCalendarioDeBuenosAires` en `hora-buenos-aires.ts`).

---

## Phase 11: Cierre

**Purpose**: backlog y PR, con o sin la Fase 10.

- [ ] T028 En `docs/backlog.md`, pasar la 010 a `en PR` y registrar en "Alcance de la 010 · Opcionales" cuáles se hicieron y cuáles no (FR-023). Abrir el PR de `feature/010-refactor-compras` a `development` con las verificaciones del CI en verde y, en la descripción, la excepción acotada de `registrar-ingreso.test.tsx` y la de `VencimientoService`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T003 (snapshot `antes.json`) **antes de tocar código**.
- **Foundational (Phase 2)**: vacía.
- **US1 (Phases 3–5)**: dependen de Setup. Dentro: T004 → T005 → T006 → T007; T008 → T009 (T009
  depende de T006: las reglas usan la `Entrada` nueva); T010 depende de T009; T011 → T019 cierran.
- **US2 (Phases 6–7)**: dependen de US1 (`estadoDeLaCompra` usa `compra.reembolso`;
  `registrarUso` usa la `Entrada` nueva). T012 → T013 → T014.
- **US3 (Phase 8)**: el cambio de la app no depende del backend (no cambia el contrato); se puede
  hacer en paralelo con US1/US2 en otra sesión, pero se hace después para cerrar las fases en
  orden. T015 → T016 (el mismo test).
- **Polish (Phase 9)**: depende de US1–US3. T017, T018 en paralelo; T020 y T021 después del
  código.
- **US4 (Phase 10, opcional)**: depende de US3 (T025 toca `ComprasDelEvento.tsx` y `Compra.tsx`) y
  de US1 (T026, independiente en la práctica). Si se hace, antes de la Fase 11.
- **Cierre (Phase 11)**: Polish (Phase 9) → (Phase 10, opcional) → T028, siempre al final.

### Within Each Phase

- Test (con stub) → verlo fallar → implementar → `test:foco` en verde → suite completa al cerrar la
  fase → marcar tareas → commit.

### Parallel Opportunities

- T001 con T002/T003.
- T017 y T018 (archivos distintos).
- T025 y T026 (mobile y backend).
- US3 (Phase 8) podría hacerse en paralelo a US1/US2 en otro worktree (solo toca `mobile/`).

---

## Parallel Example: Polish

```text
Task: "T017 Actualizar AGENTS.md"
Task: "T018 Revisar las skills nuevo-endpoint y nueva-pantalla"
```

## Parallel Example: User Story 4 (opcional)

```text
Task: "T025 useEnvioUnico en mobile/src/features/compras/useEnvioUnico.ts"
Task: "T026 diaDeCalendarioDeBuenosAires en backend/src/domain/hora-buenos-aires.ts"
```

---

## Implementation Strategy

### MVP primero (US1)

1. Phase 1 (línea de base y snapshot).
2. Phases 3–5: la `Entrada` nueva, las reglas y el reembolso. **Parar y validar**: suite en verde y
   `diff` del snapshot vacío (se puede correr T020 en este punto como control intermedio). Es lo que
   necesitan la 011 y la 012.

### Entrega incremental

1. US1 → modelo de compra y entrada listo.
2. US2 → un solo dueño y vistas compuestas (sin cambios visibles).
3. US3 → app.
4. Polish → documentación y comparación con la línea de base (la constitución ya se enmendó al
   cerrar US1).
5. US4 → solo si sobra tiempo.
6. Cierre → backlog y PR.

---

## Notes

- Una tarea "Test" que pasa de entrada (cobertura de comportamiento conservado, como T007) no es un
  rojo de TDD: se anota y se sigue.
- Ningún archivo de `backend/tests/api/` cambia; si un test de API falla, es una regresión del
  refactor.
- Los textos de "no se puede usar" del servidor y la app siguen duplicados (descartado en el
  backlog).
