---

description: "Tareas de implementación de la feature 007 — Mis compras"
---

# Tasks: Mis compras

**Input**: documentos de diseño en `specs/007-mis-compras/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md),
[contracts/app.md](./contracts/app.md), [quickstart.md](./quickstart.md)

**Tests**: obligatorios (constitución II, SC-008): cada regla con su caso borde en `domain`,
`repositories`, `services` (reloj fijo y movible, repositorios armados por caso y espiados para
contar lecturas) y `api`; en mobile, `api/`, `formato`, `vencimientos` y la pantalla con
`renderConDependencias` (R11).

**Organización**: una fase por historia de usuario, en el orden de la spec (US1 y US2 son P1 y
forman el MVP; US3 y US4 son P2). Las dos lecturas en lote (`listarPorComprador`,
`listarPorIds` y `EventoService.obtenerPorIds`) van en Foundational: las usa el caso de uso de la
US1 y de ellas depende SC-007. La vista del servidor se arma completa en la US1 (estado al día y
`canceladaPor`, que salen de `Compra.alDia` y `fueVencida()`, R2 y R6) salvo `diasRestantes`, que
llega en la US2 (hasta entonces vale `null` en todas las compras).

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: puede hacerse en paralelo (archivo distinto, sin dependencias pendientes).
- **[Story]**: historia a la que pertenece (US1–US4).
- Rutas relativas a la raíz del repo.

## Convenciones para todas las tareas

- **Test primero con stub en el mismo turno** (AGENTS.md): el hook `Stop` exige typecheck y lint
  en verde al cerrar cada turno. Cada tarea "Test" crea **en el mismo turno** los módulos que
  importa como **stub con la firma real** que lanza `new Error("no implementado")` (un componente
  que devuelve `null`, la ruta de `app/` con su re-export). Se corre el test con `test:foco`,
  **se lo ve fallar** por comportamiento y recién después se implementa. Las tareas que dicen
  "Test … Luego implementar" son el mismo ciclo en dos turnos.
- Endpoints: seguir la skill **`nuevo-endpoint`**. Pantallas, hooks y funciones de `src/api/`:
  seguir la skill **`nueva-pantalla`**.
- Backend en capas: `domain/` puro (sin Express, sin `errors/`, sin reloj: `ahora` llega como
  argumento; la zona horaria solo la conoce `domain/hora-buenos-aires.ts`). `CompraService` es
  dueño de `Compra` y le pide los eventos en lote a `EventoService` (`obtenerPorIds`), nunca lee
  `RepositorioEventos`. `app.ts` **no cambia** (`CompraService` ya recibe `EventoService`).
- **La lista es una lectura** (R2, FR-003): `misCompras` lee `reloj.ahora()` **una vez**, pasa
  cada compra por `compra.alDia(ahora)`, **no toma el cerrojo y no guarda nada** (ni compras ni
  cupo). `VencimientoService` no se toca.
- **Sin N+1** (FR-002, SC-007): **dos** lecturas por pedido (`listarPorComprador` y
  `listarPorIds`), cualquiera sea la cantidad de compras; sin compras, ninguna lectura de eventos.
- **Los contratos de la 006 no cambian**: `aCompraVista` devuelve exactamente lo mismo que hoy
  (los tests de la 006 siguen en verde sin cambios).
- Textos de la app: los de `contracts/app.md` ("Todavía no compraste entradas", "Ir a Explorar",
  "Podés pagar hasta las HH:MM", "Pagar"/"Confirmar", "Hoy · HH:MM", "Mañana", "Faltan N días",
  "Evento realizado", "Venció sin pagarse", "La cancelaste", los `accessibilityLabel` "Ver la
  compra de {cantidad} {tipo} para {evento}" y "Pagar la compra de {cantidad} {tipo}"), que son
  los que buscan los tests. El estado ("Pendiente", "Confirmada", …) lo pone **siempre**
  `EtiquetaEstadoCompra`, sin cambios; el aviso va **junto** a la etiqueta, nunca la reemplaza
  (FR-012).
- La app **nunca decide que una compra venció** (FR-018): el reloj del teléfono solo programa
  cuándo volver a pedir la lista.
- Mobile: todo lo nuevo vive en `features/compras`; afuera solo cambian `src/api/compras.ts` (+
  `index.ts`), `src/consultas/claves.ts` y `app/(tabs)/mis-compras.tsx`. Imports relativos sin
  alias `@/`; desde afuera de una feature solo su `index.ts` (adentro, por archivo);
  `features/eventos` **nunca** importa `features/compras`; `app/` solo re-exports de una línea;
  todo `fetch` en `src/api/`; estilos con `StyleSheet` y valores del `tema`; textos con
  `...tema.tipografia.<estilo>` (nunca `fontWeight`).
- Prohibidos `any`, `@ts-ignore` y `eslint-disable` sin descripción (principio IX).
- Commits: Conventional Commits con scope `007-mis-compras`, uno por tarea o grupo coherente.
  Cada fase cierra con la suite completa en verde (`npm test`, `npm run lint`,
  `npm run typecheck`, `npm run format:check`), sus tareas marcadas y su commit.

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: el tipo compartido nuevo (aditivo, no rompe nada) y el estado del backlog.

- [X] T001 [P] En `docs/backlog.md`, pasar la 007 de `plan` a `tasks`.
- [X] T002 En `shared/src/compra.ts`, sumar `MiCompraVista` con el JSDoc de data-model ("Tipos compartidos"): `type MiCompraVista = Omit<CompraVista, "compradorId" | "historial"> & { diasRestantes: number | null /* "Días de calendario (Buenos Aires) hasta el evento; solo en CONFIRMADA de un evento no realizado; si no, null." */; canceladaPor: "sistema" | "usuario" | null /* "Solo en CANCELADA: \"sistema\" si venció sin pagarse, \"usuario\" si la canceló su comprador; si no, null." */ }`. Exportarlo (como tipo) en `shared/src/index.ts`. `npm run typecheck` en verde en los tres paquetes.

---

## Phase 2: Foundational (prerequisitos bloqueantes)

**Purpose**: las lecturas en lote que necesita el caso de uso de la lista: compras por comprador y
eventos por ids (R3).

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

- [X] T003 [P] Test en `backend/tests/repositories/compra.repository.test.ts` (se amplía) con el stub de `listarPorComprador(compradorId: string): Promise<Compra[]>` en `backend/src/domain/repositorios.ts` (`RepositorioCompras`) y `backend/src/repositories/compra.repository.ts`. Casos: devuelve **solo** las compras de ese comprador, de **todos** los eventos y en **cualquier** estado (una `PENDIENTE`, una `CONFIRMADA` y una cancelada de dos eventos distintos); ninguna de otro comprador; un comprador sin compras → `[]`. Luego implementarlo como filtro sobre el `Map`.
- [X] T004 [P] Test en `backend/tests/repositories/evento.repository.test.ts` (se amplía) con el stub de `listarPorIds(ids: readonly string[]): Promise<Evento[]>` en `backend/src/domain/repositorios.ts` (`RepositorioEventos`) y `backend/src/repositories/evento.repository.ts`. Casos (como `UsuarioRepository.listarPorIds`): devuelve los que existen de esos ids; un id repetido no repite el evento; un id inexistente se ignora; `[]` → `[]`. Luego implementarlo.
- [X] T005 Test en `backend/tests/services/evento.service.test.ts` (se amplía) con el stub de `obtenerPorIds(ids: readonly string[]): Promise<Map<string, Evento>>` en `backend/src/services/evento.service.ts`. Casos: devuelve un `Map` por id con todos los pedidos; hace **una** sola llamada a `listarPorIds` (repositorio espiado) y ninguna a `buscarPorId`; si falta alguno → `NoEncontradoError` con `EVENTO_NO_ENCONTRADO`; no toma el cerrojo (espiar `cerrojo.ejecutar`) y no guarda nada. Luego implementarlo (sin cupo al día: los que lo usan no muestran cupo, data-model).

**Checkpoint**: las dos lecturas en lote existen y están probadas; nada visible cambió.

---

## Phase 3: User Story 1 — Ver todas mis compras con su estado (Priority: P1) 🎯 MVP

**Goal**: la pestaña "Mis compras" muestra, en una sola lista y en el orden del servidor, cada
compra del usuario actual como comprador (de todos los eventos, una fila por compra) con el
evento, su fecha y hora, el tipo, la cantidad, el total y el estado con texto y color; tocar una
fila abre "Tu compra".

**Independent Test**: con el seed, Martín ve su compra `CONFIRMADA` del Festival ("VIP · 2
entradas · $ 240.000"); Diego, la suya `CANCELADA`; Lucía, `[]`; sin usuario → `401`; con un
usuario que compró en dos eventos, cada compra es una fila; la lista nunca trae compras de otro
ni las de eventos que él organiza.

### Backend

- [X] T006 [P] [US1] Test de `backend/tests/domain/orden-mis-compras.test.ts` (nuevo) con el stub de `backend/src/domain/orden-mis-compras.ts` (`export interface OrdenableMiCompra { id: string; creadaEn: Date; fechaHoraEvento: Date; eventoRealizado: boolean }` y `export function compararMisCompras(a: OrdenableMiCompra, b: OrdenableMiCompra): number`). Casos (FR-006, R5): las de eventos no realizados van **antes** que las de realizados aunque la fecha del realizado sea mayor (es un caso de robustez del comparador puro: con datos reales no ocurre, porque un realizado siempre tiene una fecha anterior a la de cualquier no realizado); las no realizadas por `fechaHoraEvento` **ascendente**; las realizadas por `fechaHoraEvento` **descendente**; con la misma `fechaHoraEvento`, `creadaEn` **descendente** (la comprada más recientemente primero) y, si empatan, `id` ascendente; ordenar dos veces la misma lista (en distinto orden de entrada) da el mismo resultado (estable). Luego implementarlo.
- [X] T007 [US1] Test en `backend/tests/services/compra.service.test.ts` (se amplía) con los stubs de `misCompras(usuarioId: string): Promise<MiCompraVista[]>` en `backend/src/services/compra.service.ts` y `aMiCompraVista(compra, evento, ahora): MiCompraVista` en `backend/src/services/compra.vistas.ts`. Repositorios armados por caso y reloj fijo/movible. Casos (data-model, "`CompraService.misCompras`"):
  - trae **solo** las compras del usuario como comprador, de todos los eventos y en todos los estados, una vista por compra (dos compras del mismo evento y tipo son dos vistas); **no** trae las que otros hicieron en eventos que él organiza (FR-001);
  - la vista **no** tiene `historial` ni `compradorId` (FR-005) y sí `id`, `evento { id, nombre, fechaHora, fechaHoraLocal, realizado }`, `tipoEntrada { id, nombre }`, `cantidad`, `total`, `estado`, `creadaEn`, `venceEn`, `venceEnLocal`, `diasRestantes` y `canceladaPor`;
  - nombre y fecha del evento y nombre del tipo **actuales** (editados después de comprar), y `total`/`cantidad` los de la compra (FR-004);
  - **al día** (FR-003): una `PENDIENTE` con los 15 minutos cumplidos (reloj adelantado) sale `CANCELADA` con `venceEn: null`, `venceEnLocal: null` y `canceladaPor: "sistema"`, y en el repositorio **sigue** `PENDIENTE` (no guarda nada; el cupo del evento no cambia); 1 ms antes del vencimiento sigue `PENDIENTE` con su `venceEnLocal`;
  - `canceladaPor` (R6, FR-014): `"sistema"` si `compra.fueVencida()` (también una vencida ya materializada), `"usuario"` si la canceló su comprador, `null` en cualquier otro estado; invariantes de data-model: `canceladaPor !== null` ⇔ `CANCELADA`, `venceEn !== null` ⇔ `PENDIENTE`;
  - `UTILIZADA` y `REEMBOLSADA` (armadas con su historial) se devuelven con su estado, `canceladaPor: null` y `diasRestantes: null`;
  - el orden de FR-006 (no realizados ascendente, después realizados descendente, desempates), con `eventoRealizado` = `evento.estaRealizado(ahora)`;
  - **dos lecturas** (SC-007): con 30 compras en 10 eventos, una llamada a `listarPorComprador` y una a `listarPorIds` (con los 10 ids sin repetir), ninguna a `buscarPorId` (repositorios espiados); sin compras → `[]` y **ninguna** lectura de eventos;
  - no toma el cerrojo (espiar `cerrojo.ejecutar`), no llama a `guardar` y lee `reloj.ahora()` una vez.
  Por ahora `diasRestantes` es `null` en todas (lo calcula la US2).
- [X] T008 [US1] Implementar en `backend/src/services/compra.vistas.ts` la función privada `datosComunes(compra, evento, ahora)` (los campos que hoy arma `aCompraVista` salvo `compradorId` e `historial`), `aCompraVista` = `datosComunes` + `compradorId` + `historial` (**salida idéntica** a la de hoy) y `aMiCompraVista` = `datosComunes` + `diasRestantes: null` + `canceladaPor`; y `CompraService.misCompras` en `backend/src/services/compra.service.ts` (pasos 1–5 de data-model, con `eventoService.obtenerPorIds([...new Set(...)])` y `compararMisCompras` de `backend/src/domain/orden-mis-compras.ts`). T007 y los tests de la 006 (`tests/services/compra.service.test.ts`, `tests/api/compras.test.ts`) en verde.
- [X] T009 [US1] Test en `backend/tests/api/compras.test.ts` (se amplía) con supertest y `crearApp()`, con los stubs de `misCompras` en `backend/src/controllers/compra.controller.ts` y la ruta `router.get("/", requerirUsuario, controller.misCompras)` en `backend/src/routes/compras.routes.ts` (**antes** de `/:compraId`). Casos (contracts/api.md): sin `X-Usuario-Id` y con `usuario-inexistente` → `401 USUARIO_NO_IDENTIFICADO`; `usuario-martin` → `200` con una compra `CONFIRMADA` del Festival, VIP, cantidad 2, total 240000, sin `historial` ni `compradorId`; `usuario-diego` → `200` con una `CANCELADA` con `canceladaPor: "sistema"`; `usuario-lucia` (organiza el Festival) → `200 []`; una query (`?estado=PENDIENTE`) se ignora; `GET /api/compras/:compraId` de la 006 sigue funcionando. Luego implementar el controller (`res.json(await compraService.misCompras(usuarioActual(req).id))`, sin reglas; la ruta no lleva validación).
- [X] T010 [US1] Documentar en `backend/src/docs/openapi.json` el path `/compras` con `get` (tag `Compras`, header `X-Usuario-Id`, respuestas `200` arreglo de `MiCompraVista` y `401` `Error`) y el esquema `MiCompraVista` en `components.schemas` (campos y nulabilidad de la tabla de contracts/api.md; `diasRestantes` entero ≥ 0 o `null`; `canceladaPor` enum `"sistema"`/`"usuario"` o `null`); sumar el pedido "Mis compras" a `backend/src/docs/ai-ticket-it.postman_collection.json`. `backend/tests/api/docs.test.ts` en verde (FR-021).

### Mobile

- [X] T011 [P] [US1] Test en `mobile/tests/api/compras.test.ts` (se amplía) con el stub de `obtenerMisCompras(cliente, { signal }): Promise<MiCompraVista[]>` en `mobile/src/api/compras.ts`, exportado por `mobile/src/api/index.ts`. Casos: `GET /compras` con `X-Usuario-Id` del usuario del cliente y el `signal`; devuelve el arreglo tal cual. Luego implementarlo con `cliente.get`.
- [X] T012 [US1] Clave, hook y helpers: en `mobile/src/consultas/claves.ts`, `misCompras: (usuarioId: string) => ["mis-compras", usuarioId] as const` (el usuario en la posición 1; no comparte prefijo con `mis-compras-del-evento`, R7); en `mobile/src/features/compras/useMisCompras.ts`, `useMisCompras(usuarioId)` (sin `placeholderData`: al cambiar de usuario es otra query, FR-019); en `mobile/tests/helpers/render-con-dependencias.tsx`, responder `GET /compras` con `[]` si el test no lo registra (así los tests de otras pantallas no se rompen); en `mobile/tests/helpers/compras.ts`, el fixture `miCompra(...)` armado a partir del fixture de `CompraVista` existente (sin `compradorId` ni `historial`, con `diasRestantes` y `canceladaPor`). Lo prueban T013 y la US4.
- [X] T013 [US1] Test de `mobile/tests/pantallas/mis-compras.test.tsx` (nuevo) con `renderConDependencias` y `porRuta`, con los stubs de `MisCompras` en `mobile/src/features/compras/pantallas/MisCompras.tsx`, `FilaMiCompra` en `mobile/src/features/compras/componentes/FilaMiCompra.tsx` (`{ compra: MiCompraVista }`), su export en `mobile/src/features/compras/index.ts` y `mobile/app/(tabs)/mis-compras.tsx` reemplazado por el re-export de una línea `export { MisCompras as default } from "../../src/features/compras";`. Casos (contracts/app.md, "`FilaMiCompra`"): al abrir la pestaña se pide `GET /compras` en nombre del usuario actual; con tres compras de dos eventos, tres filas en el orden de la respuesta (sin reordenar, sin agrupar, sin filtro por estado: FR-007); cada fila muestra el nombre del evento, `textoFechaHora(evento.fechaHoraLocal)`, "VIP · 2 entradas · $ 240.000" y, en un gratis, "Carrera kids · 1 entrada · Gratis"; los cinco estados se ven con el texto de `EtiquetaEstadoCompra` ("Pendiente", "Confirmada", "Cancelada", "Utilizada", "Reembolsada"); tocar la fila (`accessibilityLabel` "Ver la compra de 2 VIP para Festival Sonidos del Sur") abre "Tu compra" de esa compra (se pide `GET /compras/<id>`); una compra de un evento con `realizado: true` sigue en la lista (no depende del catálogo, US4-8). **Cuatro estados** (FR-016), que T014 implementa y por eso se prueban acá: mientras `GET /compras` no responde, "cargando"; con un error o el servidor no disponible, el mensaje en español y "Reintentar", que vuelve a pedir la lista (y la franja, si corresponde); con `[]`, "Todavía no compraste entradas" y "Ir a Explorar", que abre Explorar.
- [X] T014 [US1] Implementar `MisCompras` (`useSesion` para el usuario; `useMisCompras` con `SegunConsulta`; `vacio` = `ListaVacia` "Todavía no compraste entradas" con la acción "Ir a Explorar" → `router.navigate("/")`; datos en `PantallaDesplazable` con una `FilaMiCompra` por compra) y `FilaMiCompra` (un `View` contenedor sin rol, con el `Pressable` de los datos adentro, que lleva `accessibilityRole="button"` y el `accessibilityLabel` del contrato y hace `router.push({ pathname: "/compras/[compraId]", params: { compraId } })`; dejar en el contenedor el lugar del botón de pago **como hermano** de ese `Pressable`, nunca dentro, contracts/app.md y R10; nombre del evento con `tipografia.subtitulo`; la línea "{tipo} · {textoCantidad} · {textoTotal}"; `EtiquetaEstadoCompra`; textos con `flexShrink`/`flexWrap` para 360 px, FR-020). Reusar `textoFechaHora`, `textoTotal` y `textoCantidad`. Sumar al `tema` lo que falte (sin números sueltos).

**Checkpoint**: la pestaña lista todas las compras del usuario con su estado y abre "Tu compra".
Todavía no se ven días restantes, hora límite, "Pagar" ni el motivo de la cancelación.

---

## Phase 4: User Story 2 — Saber cuánto falta para mis eventos confirmados (Priority: P1) 🎯 MVP

**Goal**: cada compra `CONFIRMADA` muestra, junto a "Confirmada", cuántos días de calendario (Buenos
Aires) faltan para el evento, calculados por el servidor en cada consulta, o "Evento realizado"
si ya empezó.

**Independent Test**: con el reloj del servidor fijado, confirmadas de eventos dentro de 10 días,
mañana (consultado a las 00:01 y a las 23:59), hoy más tarde y ya empezados → 10, 1, 1, 0 y
`null`; adelantar el reloj un día baja uno; en la app, "Faltan 10 días", "Mañana", "Hoy · 21:00" y
"Evento realizado", siempre junto a "Confirmada".

### Backend

- [ ] T015 [P] [US2] Test de `backend/tests/domain/dias-restantes.test.ts` (nuevo) con el stub de `backend/src/domain/dias-restantes.ts` (`export function diasRestantes(fechaHoraEvento: Date, ahora: Date): number | null`). Casos (R4, tabla de contracts/api.md, en hora de Buenos Aires = UTC−3): lun 10 12:00 → jue 20 20:00 = `10`; lun 10 00:01 → mar 11 21:00 = `1`; lun 10 23:59 → mar 11 21:00 = `1` (días de calendario, no bloques de 24 h); mar 11 00:00 → mar 11 21:00 = `0`; mar 11 20:59 → `0`; el instante exacto de inicio (`ahora === fechaHoraEvento`) → `null`; ya empezado el mismo día → `null`; borde de medianoche de Buenos Aires: `ahora` 02:59:59 Z (aún el día anterior) → `1` y 03:00:00 Z → `0` para un evento de ese día; un evento a fin de mes / de año cruza bien (31 dic → 2 ene = `2`); siempre entero ≥ 0. Luego implementarlo con `horaDeBuenosAires(...)` de `backend/src/domain/hora-buenos-aires.ts` (los primeros 10 caracteres de cada fecha, restados como `Date.UTC(a, m − 1, d)` / 86 400 000), sin `Intl` ni repetir el desfase.
- [ ] T016 [US2] Test en `backend/tests/services/compra.service.test.ts` (se amplía) para `diasRestantes` en `misCompras`: una `CONFIRMADA` de un evento a 10 días → `10`; el mismo pedido con el reloj adelantado un día → `9` (se calcula en cada consulta y no queda guardado en la compra); una `CONFIRMADA` de un evento ya empezado → `diasRestantes: null` y `evento.realizado: true`; `PENDIENTE`, `CANCELADA`, `UTILIZADA` y `REEMBOLSADA` de eventos futuros → `null`; si el organizador cambia la fecha del evento, los días se recalculan con la nueva; invariante `diasRestantes !== null` ⇒ `CONFIRMADA` y `!evento.realizado` y ≥ 0. Luego, en `aMiCompraVista` (`backend/src/services/compra.vistas.ts`), `diasRestantes` = `diasRestantes(evento.fechaHora, ahora)` solo si la compra está `CONFIRMADA` (sin llamar a la función en los demás estados).
- [ ] T017 [US2] En `backend/tests/api/compras.test.ts` (se amplía): `usuario-martin` → su `CONFIRMADA` con `diasRestantes` igual al calculado con `diasRestantes(evento.fechaHora, ahora)` para el reloj de la app (contracts/api.md: 30 con los datos de ejemplo; si el seed no fija esa distancia exacta, comparar con el cálculo y no con el literal); con `crearApp({ reloj })` fijado, una compra confirmada armada para un evento de mañana devuelve `1`. Debe pasar con T016; si no, corregirlo.

### Mobile

- [ ] T018 [P] [US2] Test en `mobile/tests/features/compras/formato.test.ts` (se amplía) con los stubs de `textoDiasRestantes(dias: number, fechaHoraLocal: string): string` y `textoAvisoDeMiCompra(compra: MiCompraVista): string | null` en `mobile/src/features/compras/formato.ts`. Casos de `textoDiasRestantes`: `0` con `"2026-12-01T21:00"` → "Hoy · 21:00"; `1` → "Mañana"; `2` → "Faltan 2 días"; `10` → "Faltan 10 días". Casos de `textoAvisoDeMiCompra` para `CONFIRMADA` (tabla "Avisos por estado"): `evento.realizado` → "Evento realizado"; `diasRestantes` 0 / 1 / N → los textos de arriba; `UTILIZADA` y `REEMBOLSADA` → `null`. Luego implementarlas (las ramas `PENDIENTE` y `CANCELADA` las completa T021; hasta entonces devuelven `null`).
- [ ] T019 [US2] Test en `mobile/tests/pantallas/mis-compras.test.tsx` (se amplía): una fila `CONFIRMADA` con `diasRestantes: 10` dice "Confirmada" **y** "Faltan 10 días"; con `1`, "Mañana"; con `0` y el evento a las 21:00, "Hoy · 21:00"; con `realizado: true` y `diasRestantes: null`, "Confirmada" y "Evento realizado"; una `PENDIENTE` o `CANCELADA` no muestra ningún texto de días (FR-012). Luego, en `FilaMiCompra`, mostrar el aviso de `textoAvisoDeMiCompra` al lado de `EtiquetaEstadoCompra` (con `flexWrap` para que baje de renglón a 360 px).

**Checkpoint (MVP)**: UC-01 completo en su sentido estricto: todas las compras con su estado y,
en las confirmadas, cuánto falta.

---

## Phase 5: User Story 3 — Retomar el pago de una pendiente desde la lista (Priority: P2)

**Goal**: una `PENDIENTE` muestra hasta qué hora se puede pagar y "Pagar" ("Confirmar" si es
gratis), que abre "Tu compra"; una vencida se ve `CANCELADA` con "Venció sin pagarse" y una
cancelada por el comprador, con "La cancelaste", sin acciones.

**Independent Test**: comprar sin pagar → la fila dice "Pendiente", "Podés pagar hasta las HH:MM"
y "Pagar"; tocarlo, pagar y volver → "Confirmada" con sus días; con el reloj del servidor
adelantado 15 minutos, otra pendiente figura "Cancelada" con "Venció sin pagarse" y sin "Pagar",
aunque nadie haya escrito en el evento.

### Backend

- [ ] T020 [US3] Test en `backend/tests/api/compras.test.ts` (se amplía) con `crearApp({ reloj })` y un reloj movible: Sofía compra 1 VIP del Festival → `GET /api/compras` la trae `PENDIENTE` con `venceEnLocal` y `canceladaPor: null`; adelantado el reloj 15 minutos, el mismo pedido la trae `CANCELADA` con `canceladaPor: "sistema"` y `venceEn: null`, y `GET /api/eventos/evento-festival-sonidos-del-sur` sigue mostrando el cupo **al día** de la 006 (la lista no materializó nada: la compra guardada sigue `PENDIENTE`, verificable con el repositorio de la app de test); otra compra cancelada por Sofía con `POST /compras/:id/cancelacion` → `canceladaPor: "usuario"`. Debe pasar con T008; si no, corregirlo.

### Mobile

- [ ] T021 [P] [US3] Test en `mobile/tests/features/compras/formato.test.ts` (se amplía) con el stub de `textoAccionDePago(total: number): string` en `mobile/src/features/compras/formato.ts`. Casos: `textoAccionDePago(0)` → "Confirmar"; `textoAccionDePago(120000)` → "Pagar"; `textoAvisoDeMiCompra` de una `PENDIENTE` con `venceEnLocal` `"2026-12-01T15:35"` → "Podés pagar hasta las 15:35" (reusa `textoVencimiento`); de una `CANCELADA` con `canceladaPor: "sistema"` → "Venció sin pagarse"; con `"usuario"` → "La cancelaste". Luego implementarlas y usar `textoAccionDePago` en `mobile/src/features/compras/pantallas/Compra.tsx` en lugar del texto suelto ("Pagar"/"Confirmar"): `mobile/tests/pantallas/compra.test.tsx` sigue en verde sin cambios.
- [ ] T022 [US3] Test en `mobile/tests/pantallas/mis-compras.test.tsx` (se amplía): una fila `PENDIENTE` dice "Pendiente", "Podés pagar hasta las 15:35" y tiene el botón "Pagar" (`accessibilityLabel` "Pagar la compra de 1 VIP"), que abre "Tu compra" de esa compra; una pendiente gratis tiene "Confirmar"; una `CANCELADA` del sistema dice "Cancelada" y "Venció sin pagarse", y una del comprador, "La cancelaste", ninguna con "Pagar" (tocar la fila igual abre "Tu compra"); `UTILIZADA` y `REEMBOLSADA` sin aviso, sin días y sin acciones (FR-015). (Pagar y volver a la lista ya actualizada lo prueba T024, porque necesita la invalidación de T025.) El test también verifica la estructura accesible: el botón "Pagar la compra de 1 VIP" **no** es descendiente del elemento "Ver la compra de 1 VIP para …" (RNTL lo encontraría igual anidado, así que se comprueba explícitamente con `within(fila).queryByLabelText(...)` → `null`). Luego, en `FilaMiCompra`, sumar solo en `PENDIENTE` el `Boton` con `textoAccionDePago(total)` y su `accessibilityLabel`, **hermano** del `Pressable` de los datos dentro del contenedor, que navega igual que la fila (R10).

**Checkpoint**: las pendientes se retoman desde la lista y ninguna vencida aparece como pagable.

---

## Phase 6: User Story 4 — Lista al día, sin compras ajenas y ante fallas (Priority: P2)

**Goal**: la lista se vuelve a pedir al volver a la pestaña, después de comprar, pagar o cancelar
y al llegar la hora límite más próxima de sus pendientes; al cambiar de usuario nunca muestra
compras del anterior.

**Independent Test**: con el fetch falso y timers falsos (vacío, error y cargando ya los probó
T013): volver a la pestaña la vuelve a pedir; una pendiente que vence en 2 minutos se
vuelve a pedir a los 2 min + 1 s y pasa a "Cancelada"; cambiar de usuario no muestra, ni por un
instante, compras del anterior.

- [ ] T023 [P] [US4] Test de `mobile/tests/features/compras/vencimientos.test.ts` (nuevo) con el stub de `mobile/src/features/compras/vencimientos.ts` (`export function esperaHastaElProximoVencimiento(compras: readonly MiCompraVista[], ahoraMs: number): number | null`). Casos (R9): sin `PENDIENTE` (lista vacía, o solo confirmadas y canceladas) → `null`; una pendiente que vence en 2 min → `120 000 + 1 000`; varias → la más próxima + 1 000; una ya pasada o que vence en < 4 s → `5 000` (mínimo). Luego implementarlo: `max(min(Date.parse(venceEn)) − ahoraMs + 1000, 5000)`.
- [ ] T024 [US4] Test en `mobile/tests/pantallas/mis-compras.test.tsx` (se amplía), con timers falsos donde haga falta, con el stub de `useRefrescarAlVencer(compras: readonly MiCompraVista[] | undefined, refetch: () => unknown): void` en `mobile/src/features/compras/useRefrescarAlVencer.ts`. Casos:
  - **foco** (R8, US4-5): ir a otra pestaña y volver a "Mis compras" hace un segundo `GET /compras`; el primer foco no duplica el pedido del montaje (un solo `GET` al entrar);
  - **vencimiento con la lista abierta** (R9, FR-018): con una pendiente que vence en 2 minutos, al avanzar 2 min + 1 s se vuelve a pedir la lista y la segunda respuesta (`CANCELADA`, `canceladaPor: "sistema"`) se muestra sin "Pagar"; sin pendientes no se programa ningún pedido (avanzar 30 minutos no hace otro `GET`); la app nunca la muestra cancelada antes de que lo diga el servidor;
  - **después de comprar, pagar o cancelar** (FR-017, SC-005): tras pagar desde "Tu compra" y volver, la lista refleja `CONFIRMADA`; tras comprar desde el detalle o cancelar una pendiente desde el detalle, al volver a la pestaña aparece el cambio;
  - **cambio de usuario** (FR-019, SC-006): con la lista de Martín cargada, cambiar a Diego desde Perfil y volver a "Mis compras" con la respuesta de Diego demorada → no se ve ninguna fila de Martín mientras carga, y el `GET /compras` lleva `X-Usuario-Id: usuario-diego`.
- [ ] T025 [US4] Implementar: en `mobile/src/features/compras/mutaciones.ts`, que `useComprarEntradas`, `usePagarCompra` y `useCancelarCompra` sumen `invalidateQueries({ queryKey: claves.misCompras(usuarioId) })` a lo que ya invalidan al terminar (con éxito o error); `useRefrescarAlVencer` (un único `setTimeout` con `esperaHastaElProximoVencimiento(compras, Date.now())` que llama a `refetch`, reprogramado con cada respuesta y cancelado al cambiar los datos o al desmontar; sin pendientes, nada); y en `MisCompras`, `useFocusEffect` de `expo-router` que llama a `refetch()` en cada foco salvo el primero (reconocido con un `useRef`) y `useRefrescarAlVencer(consulta.data, consulta.refetch)`. T024 en verde, y los tests de la 006 (`detalle-evento`, `compra`, `comprar-entradas`) también.

**Checkpoint**: la lista nunca engaña: refleja compras, pagos, cancelaciones y vencimientos, y
nunca muestra compras de otro usuario.

---

## Phase 7: Polish y transversales

**Purpose**: documentación, accesibilidad, validación de punta a punta y cierre.

- [ ] T026 [P] Actualizar `AGENTS.md` (plan, "Post-design re-check"): en el recurso `compras`, `GET /compras` (las del usuario actual como comprador, al día, ordenadas, `MiCompraVista`); `RepositorioCompras.listarPorComprador`, `RepositorioEventos.listarPorIds` y `EventoService.obtenerPorIds`; los módulos puros `domain/dias-restantes.ts` y `domain/orden-mis-compras.ts`; `compra.vistas.ts` con `datosComunes`/`aMiCompraVista`; en mobile, la clave `misCompras` (con usuario), la pantalla `MisCompras` en `(tabs)/mis-compras`, `FilaMiCompra`, el refresco por foco (`useFocusEffect`) y por vencimiento (`useRefrescarAlVencer`, `vencimientos.ts`), las mutations que la invalidan, `textoAccionDePago` compartida con "Tu compra" y el `GET /compras` vacío por defecto de `renderConDependencias`.
- [ ] T027 Revisar en 360 px y con TalkBack: sin desplazamiento horizontal; nombres largos de evento y tipo se parten en varias líneas antes de recortarse; la etiqueta de estado y su aviso legibles; la fila y "Pagar" enfocables **por separado** y anunciados cada uno con su `accessibilityLabel`; sin valores sueltos fuera del `tema` ni `fontWeight`. Ajustar lo que haga falta en `mobile/src/features/compras/componentes/FilaMiCompra.tsx` (FR-020).
- [ ] T028 Correr `npm test`, `npm run lint`, `npm run typecheck` y `npm run format:check` desde la raíz y dejar las cuatro en verde (incluidos todos los tests de la 004 a la 006).
- [ ] T029 Validar a mano las secciones "Pedidos directos" y "Recorrido en la app" de `specs/007-mis-compras/quickstart.md` y anotar cualquier desvío debajo de esta tarea.
- [ ] T030 En `docs/backlog.md`, pasar la 007 a `en PR`, y abrir el PR de `feature/007-mis-compras` a `development` con las cuatro verificaciones del CI en verde.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T002 (`MiCompraVista`) lo usan el backend y la app.
- **Foundational (Phase 2)**: depende de Setup. T003 y T004 en paralelo; T005 depende de T004.
  **Bloquea todas las historias**.
- **US1 (Phase 3)**: depende de Foundational.
- **US2 (Phase 4)**: depende de US1 (amplía `aMiCompraVista`, `FilaMiCompra` y el test de la
  pantalla). Su dominio (T015) y su formato (T018) pueden adelantarse en paralelo con la US1.
- **US3 (Phase 5)**: depende de US1 (la fila y la vista con `canceladaPor`). Es independiente de
  US2.
- **US4 (Phase 6)**: depende de US1; T024 usa la fila de una pendiente (US3) para el caso del
  vencimiento sin "Pagar". T023 puede adelantarse en paralelo.
- **Polish (Phase 7)**: depende de las historias que se quieran entregar.

### Within Each User Story

- Test con stub → verlo fallar → implementar.
- Dominio → service → controller y ruta → OpenAPI y Postman.
- `src/api/` → clave y hook → componente → pantalla y ruta.
- Las tareas sobre el mismo archivo son secuenciales: `compra.service.test.ts`,
  `api/compras.test.ts` (backend), `compra.vistas.ts`, `formato.ts`, `formato.test.ts`,
  `mis-compras.test.tsx`, `FilaMiCompra.tsx`, `MisCompras.tsx`.
- T017 y T020 son tests de contrato sobre lo ya implementado: pueden pasar de entrada. No se
  fuerza un rojo artificial; si fallan, se corrige la tarea que corresponde.

### Parallel Opportunities

- **Phase 2**: T003 (compras) y T004 (eventos).
- **US1**: T006 (orden, dominio) y T011 (API mobile) en paralelo con el resto del backend.
- **US2**: T015 (días, dominio) y T018 (formato) en paralelo; los dos pueden empezar ni bien
  termina Setup.
- **US3**: T021 (formato) en paralelo con T020 (backend).
- **US4**: T023 (`vencimientos.ts`) en paralelo con cualquier tarea.

---

## Parallel Example: User Story 1

```text
Task: "T006 Test de compararMisCompras en backend/tests/domain/orden-mis-compras.test.ts"
Task: "T011 Test de obtenerMisCompras en mobile/tests/api/compras.test.ts"
```

## Parallel Example: User Story 2

```text
Task: "T015 Test de diasRestantes en backend/tests/domain/dias-restantes.test.ts"
Task: "T018 Test de textoDiasRestantes/textoAvisoDeMiCompra en mobile/tests/features/compras/formato.test.ts"
```

---

## Implementation Strategy

### MVP primero (US1 + US2)

1. Phase 1 y Phase 2 completas (cada una con `/speckit-implement fase N` y `/clear` entre fases).
2. Phase 3 (US1): **Validar**: Martín ve su confirmada, Diego su cancelada, Lucía el vacío; sin
   usuario → `401`; dos lecturas con 30 compras en 10 eventos.
3. Phase 4 (US2): **Validar**: los bordes de días restantes (23:59, medianoche, hoy, inicio
   exacto) y los textos "Faltan N días", "Mañana", "Hoy · HH:MM", "Evento realizado".
4. Las cuatro verificaciones en verde. Es UC-01 completo y demostrable.

### Entrega incremental

1. MVP (US1 + US2).
2. US3: pendientes con hora límite y "Pagar"; motivo de la cancelación.
3. US4: refresco por foco, mutations y vencimiento; cambio de usuario; cuatro estados.
4. Polish y PR.

---

## Notes

- [P] = archivo distinto y sin dependencias pendientes.
- Cada historia es verificable sola en su checkpoint.
- Si una tarea obliga a decidir algo que el plan o la spec no cubren, se frena y se consulta (no
  se inventa la regla).
- Hasta la US2, `diasRestantes` vale `null` en todas las compras; hasta la US3, la fila de una
  pendiente no tiene "Pagar" (igual se toca la fila para ir a "Tu compra"); hasta la US4, la lista
  solo se vuelve a pedir por el `staleTime` y el reintento. Si se entrega solo el MVP, decirlo en
  el PR.
- Los cuatro estados de la pantalla se prueban en T013 y se implementan en T014 (son parte de
  `SegunConsulta`), en el orden test → implementación.
