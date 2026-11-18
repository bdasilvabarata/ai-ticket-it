---

description: "Tareas de implementación de la feature 008 — Compras de un evento"
---

# Tasks: Compras de un evento

**Input**: documentos de diseño en `specs/008-compras-de-evento/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md),
[contracts/app.md](./contracts/app.md), [quickstart.md](./quickstart.md)

**Tests**: obligatorios (constitución II): cada regla con su caso borde en `domain`,
`repositories`, `services` (reloj fijo y movible, repositorios armados por caso y espiados para
contar lecturas y guardados), concurrencia y `api`; en mobile, `api/`, `formato` y las pantallas
con `renderConDependencias` (R16).

**Organización**: una fase por historia de usuario, en el orden de la spec (US1, US2 y US3 son P1;
US4 es P2). La `Entrada` dentro de `Compra` (códigos dados por el repositorio, estado derivado) y
la ventana de uso van en Foundational: las usan la vista del organizador (US1) y el uso (US3). La
vista `ComprasDelEventoVista` se arma en la US1 con `resumenPorTipo: []`, que la US2 completa.
`registrarUso`, `UTILIZADA` en las vistas del comprador y el seed de la Peña llegan en la US3.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: puede hacerse en paralelo (archivo distinto, sin dependencias pendientes).
- **[Story]**: historia a la que pertenece (US1–US4).
- Rutas relativas a la raíz del repo.

## Convenciones para todas las tareas

- **Test primero con stub en el mismo turno** (AGENTS.md, "TDD con stub"): el hook `Stop` exige
  typecheck y lint en verde al cerrar cada turno. Cada tarea "Test" crea **en el mismo turno** los
  módulos que importa como **stub con la firma real** que lanza `new Error("no implementado")` (un
  componente que devuelve `null`; la ruta de `app/` con su re-export de una línea). Se corre el
  test con `test:foco`, **se lo ve fallar** por comportamiento y recién después se implementa. "Test
  … Luego implementar" es el mismo ciclo en dos turnos.
- Endpoints: skill **`nuevo-endpoint`**. Pantallas, hooks y funciones de `src/api/`: skill
  **`nueva-pantalla`**.
- Backend en capas: `domain/` puro (sin Express, sin `errors/`, sin reloj: `ahora` llega como
  argumento; la hora de Buenos Aires solo en `domain/hora-buenos-aires.ts`). Los ids **y los
  códigos de entrada** los da el repositorio (constitución IV, 2.5.0). `CompraService` es dueño de
  `Compra`; `EntradaService` escribe con `RepositorioCompras` (como `TipoEntradaService` con
  `RepositorioEventos`) y le pide el evento a `EventoService` y los compradores a `UsuarioService`.
  Orden en `app.ts`: `VencimientoService → EventoService → TipoEntradaService → CompraService →
  EntradaService`; `EntradaService` **no** depende de `CompraService`.
- **Lecturas** (`GET …/compras`, `GET …/entradas/:codigo`): un `ahora` por pedido, todo al día
  (`compra.alDia(ahora)`, `leerDelOrganizador` con el cupo al día), **sin cerrojo y sin guardar**.
  **Escritura** (`POST …/uso`): todo dentro de `cerrojo.ejecutar(eventoId, …)`, con `ahora` leído
  adentro, `obtenerDelOrganizador` (materializa), relectura de la compra y **un solo** `guardar`.
- Orden de chequeos (R5): lista `401 → 400 → 404 EVENTO_NO_ENCONTRADO → 403 SIN_PERMISO`;
  búsqueda, el mismo `→ 404 ENTRADA_NO_ENCONTRADA`; uso, el mismo `→ 409 FUERA_DE_HORARIO_DE_USO →
  409 TRANSICION_INVALIDA`. Los 404/403, el service con `errors/`; los 409, el dominio.
- **Los códigos solo los ve el comprador** (FR-012b): `CompraVista.entradas` (sus compras);
  nunca en `CompraDelEventoVista`. `EntradaDelEventoVista` lleva solo el código que el organizador
  ingresó.
- **Los contratos de la 006 y la 007 solo crecen** (campos nuevos); la única excepción es que
  `MisComprasDelEventoVista.confirmadas` incluye también las `UTILIZADA` (R9).
- Textos de la app: los de `contracts/app.md` (son los que buscan los tests). El estado de una
  compra **y de una entrada** lo pone siempre `EtiquetaEstadoCompra`, sin cambios; los avisos van
  junto a la etiqueta, nunca la reemplazan. La app **no lee su reloj** para la ventana:
  `ventanaDeUso.estado` lo decide el servidor.
- Mobile: todo lo nuevo vive en `features/compras`. `features/eventos` **nunca** importa
  `features/compras`: el botón "Ver compras" navega por la ruta tipada. Afuera de las features
  solo cambian `src/api/compras.ts` (+ `index.ts`), `src/consultas/claves.ts` y las dos rutas de
  `app/eventos/[eventoId]/`. Imports relativos sin alias `@/`; `app/` solo re-exports de una línea;
  todo `fetch` en `src/api/`; estilos con `StyleSheet` y valores del `tema`; textos con
  `...tema.tipografia.<estilo>` (nunca `fontWeight`).
- Prohibidos `any`, `@ts-ignore` y `eslint-disable` sin descripción (principio IX).
- Commits: Conventional Commits con scope `008-compras-de-evento`, uno por tarea o grupo
  coherente. Cada fase cierra con la suite completa en verde (`npm test`, `npm run lint`,
  `npm run typecheck`, `npm run format:check`), sus tareas marcadas y su commit.

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: la enmienda de la constitución, los tipos compartidos nuevos (aditivos: no rompen
nada) y el estado del backlog.

- [X] T001 Enmendar `.specify/memory/constitution.md` a 2.5.0 con `/speckit-constitution` (R15): entidad `Entrada` en "Entidades", regla "Estado de una entrada" y códigos de entrada en el principio IV. Hecho en `4875ae9`.
- [X] T002 [P] En `docs/backlog.md`, pasar la 008 de `plan` a `tasks`.
- [X] T003 [P] En `shared/src/compra.ts`, sumar (con el JSDoc de data-model, "Vistas compartidas") las interfaces **nuevas** `EntradaVista { codigo; estado: EstadoCompra; usadaEn: string | null; usadaEnLocal: string | null }`, `VentanaDeUsoVista { desde; hasta; desdeLocal; hastaLocal; estado: "antes" | "abierta" | "despues" }`, `CompradorVista { id; nombre; apellido }`, `ResumenTipoEntradaVista { tipoEntrada: { id; nombre }; disponibles; pendientes; vendidas; usadas }`, `CompraDelEventoVista` (`id`, `comprador`, `tipoEntrada`, `cantidad`, `total`, `estado`, `creadaEn`, `creadaEnLocal`, `venceEn`/`venceEnLocal` "solo PENDIENTE", `canceladaPor: "sistema" | "usuario" | null` "solo CANCELADA", `entradasUsadas`; **sin códigos**), `ComprasDelEventoVista { evento: { id; nombre; fechaHoraLocal; realizado }; ventanaDeUso; resumenPorTipo; compras }` y `EntradaDelEventoVista extends EntradaVista { compra: { id; comprador; tipoEntrada; cantidad; estado; entradasUsadas }; ventanaDeUso }`. Exportarlas como tipos en `shared/src/index.ts`. **No** tocar todavía `CompraVista` ni `MiCompraVista` (US3). `npm run typecheck` en verde en los tres paquetes.

---

## Phase 2: Foundational (prerequisitos bloqueantes)

**Purpose**: la `Entrada` dentro del agregado `Compra` (una por unidad, código del repositorio,
estado derivado del de la compra hasta confirmarse) y la ventana de uso, que usan la US1 y la US3.

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

- [X] T004 [P] Test de `backend/tests/domain/codigo-de-entrada.test.ts` (nuevo) con el stub de `backend/src/domain/codigo-de-entrada.ts` (`export const ALFABETO_DE_CODIGO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"`, `export const LARGO_DE_CODIGO = 8`, `export function esCodigoValido(codigo: string): boolean`, `export function normalizarCodigo(texto: string): string`). Casos (R2): `"7K3MQ9TB"` válido; 7 o 9 caracteres, minúsculas, `I`, `L`, `O`, `U` o un guion → inválido; `normalizarCodigo(" 7k3m-q9tb ")` → `"7K3MQ9TB"`, también con espacios en el medio (`"7K3M Q9TB"`); normalizar no inventa validez (`normalizarCodigo("abc")` → `"ABC"`, inválido). Luego implementarlo.
- [X] T005 [P] Test de `backend/tests/domain/ventana-de-uso.test.ts` (nuevo) con el stub de `backend/src/domain/ventana-de-uso.ts` (`HORAS_ANTES_DEL_INICIO = 4`, `HORAS_DESPUES_DEL_INICIO = 12`, `ventanaDeUso(fechaHora: Date): { desde: Date; hasta: Date }`, `estadoDeVentana(ventana, ahora: Date): "antes" | "abierta" | "despues"`, `exigirVentanaAbierta(fechaHora: Date, ahora: Date): void`). Casos (FR-016, R8): `desde` = inicio − 4 h y `hasta` = inicio + 12 h; **exactamente** en `desde` y en `hasta` → `"abierta"` (inclusive); 1 minuto antes de `desde` → `"antes"` y 1 minuto después de `hasta` → `"despues"`; evento a las 23:00 de Buenos Aires → de las 19:00 a las 11:00 del día siguiente; `exigirVentanaAbierta` fuera → `ReglaDeNegocioError` `FUERA_DE_HORARIO_DE_USO` con el mensaje "El ingreso se registra desde el DD/MM HH:mm hasta el DD/MM HH:mm." en hora de Buenos Aires (usar `horaDeBuenosAires`); adentro no lanza. Luego implementarlo.
- [X] T006 Test en `backend/tests/repositories/compra.repository.test.ts` (se amplía) con el stub de `siguientesCodigosDeEntrada(cantidad: number): string[]` en `RepositorioCompras` (`backend/src/domain/repositorios.ts`, JSDoc "`cantidad` códigos nuevos, distintos entre sí y de todos los guardados") y `backend/src/repositories/compra.repository.ts`. Casos: devuelve `cantidad` códigos, todos con `esCodigoValido`; distintos entre sí (pedir 50); distintos de los de las compras ya guardadas (forzar la colisión con un generador inyectable o espiando `crypto.randomInt`: el repositorio reintenta). Luego implementarlo con `crypto.randomInt` sobre `ALFABETO_DE_CODIGO`.
- [X] T007 Test en `backend/tests/domain/compra.test.ts` (se amplía) con la clase `Entrada` (en `backend/src/domain/compra.ts` o `backend/src/domain/entrada.ts` importada por `compra.ts`; R1, data-model "`Entrada`") y los cambios de `Compra`: `PropiedadesCompra.entradas: readonly Entrada[]`, `DatosDeAlta.codigos: readonly string[]`, `estadoDeEntrada(codigo): EstadoCompra | null`. `Entrada` tiene `codigo` y `cambios: readonly CambioEstadoCompra[]` (sin id aparte), `estadoEn(compra)` y `usadaEn`. Casos:
  - `Compra.registrar` crea **una entrada por código**, sin cambios propios, con el estado de la compra (`PENDIENTE`);
  - invariantes del constructor → `DatosInvalidosError`: `entradas.length !== cantidad`; un código inválido o repetido dentro de la compra; una entrada con cambios propios en una compra cuyo historial no llegó a `CONFIRMADA`;
  - estado derivado (FR-012a, US3 acceptance 1–2): con la compra `PENDIENTE`, `CONFIRMADA` (tras `pagar`) o `CANCELADA` (tras `cancelar` o `vencer`), **todas** sus entradas tienen ese estado; con una `PENDIENTE` vencida, `compra.alDia(ahora)` las da `CANCELADA`; un código ajeno → `null`;
  - `pagar`, `cancelar`, `vencer` y `alDia` **conservan** las entradas (mismos códigos; `#conCambio` las copia).
  Actualizar en el mismo turno a todos los que llaman a `Compra.registrar` o construyen una `Compra` para que el typecheck quede en verde: `backend/tests/helpers/eventos.ts` (`compra(...)` arma códigos válidos y distintos por defecto, por ejemplo un contador en el alfabeto), `backend/tests/domain/tope-por-persona.test.ts`, `backend/tests/repositories/compra.repository.test.ts`, `backend/tests/services/concurrencia.test.ts`, `backend/src/seed/datos-ejemplo.ts` (las compras del Festival suman sus entradas con **códigos fijos y válidos**: Martín 2 VIP, Diego 1 General) y `backend/src/services/compra.service.ts` (`crear` pide `this.#compras.siguientesCodigosDeEntrada(cantidad)` dentro del cerrojo, junto con `siguienteId()`). Luego implementar.
- [X] T008 Test en `backend/tests/domain/datos-ejemplo.test.ts` (se amplía): cada compra del seed tiene `cantidad` entradas, todos los códigos del seed son válidos (`esCodigoValido`) y **distintos entre todas las compras**; y en `backend/tests/services/compra.service.test.ts` (se amplía): una compra creada por `crear` tiene `cantidad` entradas con los códigos que dio el repositorio (repositorio espiado: una llamada a `siguientesCodigosDeEntrada(cantidad)`). Deberían pasar con T007; si no, corregir T007.

**Checkpoint**: toda compra tiene sus entradas con código; nada visible cambió (las vistas son las
de la 006 y la 007).

---

## Phase 3: User Story 1 — Ver las compras de mi evento con su estado (Priority: P1) 🎯 MVP

**Goal**: desde un evento propio (editable o en solo lectura), "Ver compras" abre "Compras del
evento" con todas sus compras, de todos los compradores y en todos los estados, cada una con
comprador, tipo, cantidad, total, fecha de compra, estado con texto y color y su aviso; la ventana
de uso arriba. Solo el organizador, al día, sin guardar.

**Independent Test**: con el seed, Lucía → Mis eventos → Festival → "Ver compras": Martín ("VIP",
"Confirmada") y Diego ("General", "Cancelada", "Venció sin pagarse"); con Sofía comprar sin pagar
→ aparece "Pendiente" con "Puede pagarla hasta las HH:mm"; `usuario-martin` → `403`; sin header →
`401`; evento inexistente → `404`.

### Backend

- [X] T009 [P] [US1] Test en `backend/tests/repositories/compra.repository.test.ts` (se amplía) con el stub de `listarPorEvento(eventoId: string): Promise<Compra[]>` en `RepositorioCompras` y `backend/src/repositories/compra.repository.ts`. Casos: todas las compras de ese evento, de **todos** los compradores y en **cualquier** estado; ninguna de otro evento; un evento sin compras → `[]`. Luego implementarlo como filtro sobre el `Map`.
- [X] T010 [P] [US1] Test en `backend/tests/domain/compras-del-evento.test.ts` (nuevo) con el stub de `backend/src/domain/compras-del-evento.ts` (`export function compararComprasDelEvento(a: Compra, b: Compra): number`; `resumenPorTipo` llega en la US2). Casos (FR-005): `creadaEn` **descendente**; con la misma `creadaEn`, `id` ascendente; estable (ordenar dos veces en distinto orden de entrada da lo mismo). Luego implementarlo.
- [X] T011 [US1] Test en `backend/tests/services/evento.service.test.ts` (se amplía) con el stub de `leerDelOrganizador(id: string, usuarioId: string, ahora: Date): Promise<Evento>` en `backend/src/services/evento.service.ts`. Casos (R6): evento inexistente → `NoEncontradoError` `EVENTO_NO_ENCONTRADO` **antes** que el permiso; otro usuario → `SinPermisoError` con "Solo el organizador del evento puede ver sus compras."; el organizador → el evento con el **cupo al día** (una pendiente vencida sin materializar ya devuelve su cupo, el mismo que `obtener`); **no guarda nada** (ni compras ni eventos, repositorios espiados) y no toma el cerrojo (`cerrojo.ejecutar` espiado). Luego implementarlo reusando `#obtenerOFallar` y `#conCupoAlDia`.
- [X] T012 [US1] Test en `backend/tests/services/compra.service.test.ts` (se amplía) con los stubs de `comprasDelEvento(eventoId: string, usuarioId: string): Promise<ComprasDelEventoVista>` en `backend/src/services/compra.service.ts` y de `aCompraDelEventoVista(compra, comprador, tipo)` y `aVentanaDeUsoVista(fechaHora, ahora)` en `backend/src/services/compra.vistas.ts`. `CompraService` pasa a recibir `usuarioService` (actualizar `backend/src/app.ts` y `backend/tests/helpers/services-de-eventos.ts` en el mismo turno). Reloj fijo y movible. Casos (FR-002 a FR-006, R6):
  - todas las compras del evento, de todos los compradores y estados, ninguna de otro evento; cada una con `comprador { id, nombre, apellido }`, `tipoEntrada { id, nombre }` (nombre **actual**), `cantidad`, `total`, `estado`, `creadaEn`/`creadaEnLocal`, `entradasUsadas` (0 por ahora) y **sin** códigos ni `historial`;
  - **al día**: una `PENDIENTE` con los 15 minutos cumplidos sale `CANCELADA` con `canceladaPor: "sistema"` y `venceEn: null`, y en el repositorio **sigue** `PENDIENTE`; 1 ms antes sigue `PENDIENTE` con su `venceEnLocal`; una cancelada por el comprador → `canceladaPor: "usuario"`; `venceEn !== null` ⇔ `PENDIENTE` y `canceladaPor !== null` ⇔ `CANCELADA`;
  - orden de `compararComprasDelEvento`;
  - `evento { id, nombre, fechaHoraLocal, realizado }` (también con el evento ya realizado, US1 acceptance 10) y `ventanaDeUso` con `desde`/`hasta` ISO, sus `…Local` y `estado` según el reloj (`"antes"`, `"abierta"` y `"despues"` moviendo el reloj); `resumenPorTipo: []` hasta la US2;
  - 404 antes que 403; 403 para un comprador del evento que no lo organiza (FR-010);
  - **lecturas fijas** (FR-002): con 30 compras de 10 compradores, una lectura del evento, una de `listarPendientesPorEventos`, una de `listarPorEvento` y **una** de `UsuarioService.obtenerPorIds`; sin compras, ninguna de usuarios; ningún `guardar` ni `cerrojo.ejecutar`.
  Luego implementarlo (R6: `ahora` → `leerDelOrganizador` → `listarPorEvento` + `alDia` → compradores en lote → orden).
- [X] T013 [US1] Test en `backend/tests/api/compras.test.ts` (se amplía) de `GET /api/eventos/:eventoId/compras` con los stubs de `comprasDelEvento` en `backend/src/controllers/compra.controller.ts` y la ruta en `backend/src/routes/eventos.routes.ts` (`requerirUsuario`, validación de `params` reusando la del id de evento de `backend/src/validations/compra.validation.ts`). Casos (contracts/api.md, reloj fijo con `crearApp({ reloj })`): sin header → `401 USUARIO_NO_IDENTIFICADO`; evento inexistente → `404 EVENTO_NO_ENCONTRADO`; Martín sobre el Festival de Lucía → `403 SIN_PERMISO`; Lucía → `200` con la forma de `ComprasDelEventoVista` (Martín `CONFIRMADA`, Diego `CANCELADA` con `canceladaPor: "sistema"`, ordenadas por `creadaEn` desc); una pendiente vencida sale `CANCELADA` y un segundo `GET` sigue igual (no se guardó); query y cuerpo se ignoran. Luego implementar controller y ruta.
- [X] T014 [US1] En `backend/src/docs/openapi.json`, sumar `GET /eventos/{eventoId}/compras` con `ComprasDelEventoVista`, `CompraDelEventoVista`, `VentanaDeUsoVista`, `ResumenTipoEntradaVista` y `CompradorVista`, y sus errores (`401`, `400`, `404`, `403`); en `backend/src/docs/ai-ticket-it.postman_collection.json`, la carpeta "Compras del evento" con "Listar compras (Lucía)" y "Listar compras (otro usuario, 403)". `backend/tests/api/docs.test.ts` en verde.

### Mobile

- [X] T015 [P] [US1] Test en `mobile/tests/api/compras.test.ts` (se amplía) con el stub de `obtenerComprasDelEvento(cliente, eventoId, { signal })` en `mobile/src/api/compras.ts` (exportado por `mobile/src/api/index.ts`). Casos: `GET /eventos/:eventoId/compras` con `X-Usuario-Id`, sin cuerpo; devuelve la `ComprasDelEventoVista`; un `403` llega como `ErrorDeApi` con su código. Luego implementarlo (una línea con `cliente.get`).
- [X] T016 [P] [US1] Test en `mobile/tests/features/compras/formato.test.ts` (se amplía) con los stubs en `mobile/src/features/compras/formato.ts` de `textoCompradaEl(creadaEnLocal)` (→ "Comprada el 18/11 15:20"), `textoVentanaDeUso(ventana)` (`abierta` → "Ingresos habilitados hasta el 19/11 09:00"; `antes` → "Podés registrar ingresos desde el 18/11 17:00"; `despues` → "Los ingresos se registraron hasta el 19/11 09:00"), `textoEntradasUsadas(usadas, cantidad)` (`(1, 3)` → "1 de 3 entradas usadas"; `(1, 1)` → "1 de 1 entrada usada") y `textoAvisoDeCompraDelEvento(compra)` (`PENDIENTE` → "Puede pagarla hasta las 15:35"; `CANCELADA` sistema → "Venció sin pagarse"; `CANCELADA` usuario → "La canceló el comprador"; `UTILIZADA` → `textoEntradasUsadas`; `CONFIRMADA` y `REEMBOLSADA` → `null`). Luego implementarlos.
- [X] T017 [US1] Test de `mobile/tests/pantallas/compras-del-evento.test.tsx` (nuevo) con los stubs de `useComprasDelEvento(usuarioId, eventoId)` en `mobile/src/features/compras/useComprasDelEvento.ts`, `claves.comprasDelEvento(usuarioId, eventoId)` → `["compras-del-evento", usuarioId, eventoId]` en `mobile/src/consultas/claves.ts`, `FilaCompraDelEvento` en `mobile/src/features/compras/componentes/FilaCompraDelEvento.tsx`, la pantalla `ComprasDelEvento` en `mobile/src/features/compras/pantallas/ComprasDelEvento.tsx` (exportada por `mobile/src/features/compras/index.ts`) y la ruta `mobile/app/eventos/[eventoId]/compras.tsx` (`export { ComprasDelEvento as default } from "../../../src/features/compras";`). Fixtures de `ComprasDelEventoVista` en `mobile/tests/helpers/compras.ts`. Casos (contracts/app.md, "`ComprasDelEvento`"):
  - "Ver compras" en la edición de un evento propio (`EditarEvento`) y en la solo lectura (`VerEventoRealizado`) abre la pantalla (SC-001: Mis eventos → evento → "Ver compras");
  - cargando; error con reintento (`SegunConsulta`);
  - título del evento como header y su fecha; el texto de la ventana según `ventanaDeUso.estado`;
  - una fila por compra con "Martín Benítez", "General · 3 entradas · $ 18.000" ("Gratis" con total 0), "Comprada el …", la etiqueta de estado (`EtiquetaEstadoCompra`) y el aviso de cada estado (tabla de contracts/app.md); la fila **no** es tocable y no tiene acción de uso (FR-017); su `accessibilityLabel` resume comprador, tipo, cantidad, total y estado;
  - el pedido lleva `X-Usuario-Id` del usuario actual.
  Luego implementar: hook con `obtenerComprasDelEvento`, fila, pantalla con `PantallaDesplazable` y `SegunConsulta`, y en `mobile/src/features/eventos/pantallas/EditarEvento.tsx` y `VerEventoRealizado.tsx` el botón **"Ver compras"** con `router.push({ pathname: "/eventos/[eventoId]/compras", params: { eventoId } })` (sin importar nada de `features/compras`). Regenerar las rutas tipadas (`npm run typecheck -w mobile`).

**Checkpoint**: UC-02 sin disponibilidad: el organizador ve todas las compras de su evento al día,
y nadie más puede verlas.

---

## Phase 4: User Story 2 — Ver cómo viene la venta de cada tipo (Priority: P1)

**Goal**: en "Compras del evento", "Disponibilidad por tipo": por tipo y en el orden del evento,
disponibles, pendientes, vendidas y usadas, al día; "Agotado" con texto.

**Independent Test**: reloj fijo, un tipo de cupo 10: 3 sin pagar y 2 pagadas → 5 · 3 · 2 · 0;
adelantar 15 minutos → 8 · 0 · 2 · 0; un tipo sin compras → todo su cupo y ceros; los disponibles
coinciden con los del detalle.

- [ ] T018 [P] [US2] Test en `backend/tests/domain/compras-del-evento.test.ts` (se amplía) con el stub de `resumenPorTipo(tipos: readonly TipoEntrada[], comprasAlDia: readonly Compra[]): ResumenDeTipo[]` en `backend/src/domain/compras-del-evento.ts` (`ResumenDeTipo { tipoEntrada: TipoEntrada; disponibles; pendientes; vendidas; usadas }`). Casos (FR-007, R7): uno por tipo **en el orden del evento**; `disponibles` = `tipo.cupo`; `pendientes` = Σ `cantidad` de las `PENDIENTE`; `vendidas` = Σ `cantidad` de las `CONFIRMADA` y `UTILIZADA`; `usadas` = Σ entradas `UTILIZADA` (armar con el constructor una `UTILIZADA` de 3 con 1 entrada usada → 3 vendidas, 1 usada); `CANCELADA` y `REEMBOLSADA` no suman; un tipo sin compras → su cupo y ceros; compras de otro tipo no se mezclan. Luego implementarlo.
- [ ] T019 [US2] Test en `backend/tests/services/compra.service.test.ts` (se amplía): `comprasDelEvento` devuelve `resumenPorTipo` (`{ tipoEntrada: { id, nombre }, disponibles, pendientes, vendidas, usadas }`). Casos: el escenario del Independent Test (5 · 3 · 2 · 0 y, con el reloj adelantado 15 minutos, 8 · 0 · 2 · 0 sin guardar nada); los `disponibles` son **iguales** a los de `EventoService.obtener` en el mismo instante, también con pendientes vencidas sin materializar (SC-003); las lecturas siguen siendo las de T012. Luego implementarlo en `comprasDelEvento` y `compra.vistas.ts`.
- [ ] T020 [US2] En `backend/tests/api/compras.test.ts` (se amplía): el `GET` de Lucía sobre el Festival trae `resumenPorTipo` con cada tipo del evento en su orden y las cantidades del seed. Actualizar el ejemplo de `openapi.json` si hace falta.
- [ ] T021 [P] [US2] Test en `mobile/tests/features/compras/formato.test.ts` (se amplía) con el stub de `textoResumenDeTipo(resumen)` → "117 disponibles · 0 pendientes · 3 vendidas · 1 usada" (singular en 1: "1 disponible", "1 pendiente", "1 vendida", "1 usada"). Luego implementarlo.
- [ ] T022 [US2] Test en `mobile/tests/pantallas/compras-del-evento.test.tsx` (se amplía) con el stub de `ResumenPorTipo` en `mobile/src/features/compras/componentes/ResumenPorTipo.tsx`. Casos: sección "Disponibilidad por tipo" con cada tipo (nombre y `textoResumenDeTipo`) en el orden de la respuesta; con 0 disponibles, el texto **"Agotado"** (FR-008). Luego implementarlo y sumarlo a `ComprasDelEvento` entre la ventana y "Compras".

**Checkpoint**: UC-02 completo: compras con su estado y cuántas entradas quedan de cada tipo.

---

## Phase 5: User Story 3 — Registrar el uso de una entrada con su código (Priority: P1)

**Goal**: el comprador ve los códigos de sus entradas confirmadas; el organizador ingresa un código
en "Registrar ingreso", ve de quién es y confirma: esa entrada pasa a `UTILIZADA` (y la compra,
con la primera), dentro de la ventana, bajo el cerrojo del evento.

**Independent Test**: reloj dentro de la ventana; Martín anota el código de una entrada VIP; Lucía
lo ingresa en minúsculas, confirma → "Utilizada"; la compra pasa a `UTILIZADA` y la otra entrada
sigue `CONFIRMADA`; el mismo código otra vez → "Esta entrada ya se utilizó"; un código de otro
evento → 404; Martín intentando el uso → 403; fuera de la ventana → 409 con desde y hasta.

### Backend: dominio y datos

- [ ] T023 [US3] Test en `backend/tests/domain/compra.test.ts` (se amplía) con los stubs de `registrarUso(codigo: string, organizadorId: string, ahora: Date): Compra` y el getter `entradasUsadas` en `Compra`, y `Entrada.usar(organizadorId, ahora)`. Casos (R9, FR-012d, FR-013, FR-014):
  - sobre una `CONFIRMADA`: la entrada pasa a `UTILIZADA` con `{ UTILIZADA, autor: organizador, fechaHora: ahora }` y `usadaEn = ahora`; la compra suma **el mismo** cambio y queda `UTILIZADA`; las demás entradas siguen `CONFIRMADA`; `entradasUsadas` = 1;
  - una segunda entrada de la misma compra (ya `UTILIZADA`): pasa a `UTILIZADA` y el historial de la compra **no** cambia; `entradasUsadas` = 2;
  - entrada no `CONFIRMADA` → `ReglaDeNegocioError` `TRANSICION_INVALIDA` con el mensaje según el estado: `UTILIZADA` "Esta entrada ya se utilizó."; `PENDIENTE` "La compra de esta entrada todavía no se pagó."; `CANCELADA` (también una pendiente vencida tras `alDia`) "La compra de esta entrada está cancelada."; `REEMBOLSADA` "La compra de esta entrada fue reembolsada."; nada cambia (la instancia original queda igual);
  - un código que no es de la compra → `TRANSICION_INVALIDA` (nunca un 404 desde el dominio);
  - invariante nueva del constructor: `estado === UTILIZADA` ⇔ alguna entrada `UTILIZADA`;
  - `cancelar` de una `UTILIZADA` → `TRANSICION_INVALIDA` (FR-020); `esVigente(ahora)` es `true` en una `UTILIZADA`.
  Luego implementarlo. En `backend/tests/domain/tope-por-persona.test.ts` (se amplía), una `UTILIZADA` cuenta para el tope por persona.
- [ ] T024 [P] [US3] Test en `backend/tests/repositories/compra.repository.test.ts` (se amplía) con el stub de `buscarPorCodigoDeEntrada(codigo: string): Promise<Compra | null>` en `RepositorioCompras` y su implementación. Casos: la compra que tiene una entrada con ese código canónico, de cualquier evento; un código inexistente → `null`; recorre las compras sin exponer el `Map`. Luego implementarlo.
- [ ] T025 [P] [US3] Sumar `EntradaNoEncontradaError` en `backend/src/errors/index.ts` (código `ENTRADA_NO_ENCONTRADA`, "No hay ninguna entrada con ese código en este evento.", como `CompraNoEncontradaError`) y `[EntradaNoEncontradaError, 404]` en la tabla de `backend/src/middlewares/traducir-error.ts`; el test existente de "todo error tiene status" en verde, más un caso en `backend/tests/domain/errores.test.ts` (o el test de `statusDe`) para el 404.
- [ ] T026 [US3] Ampliar las vistas del comprador. En `shared/src/compra.ts`: `CompraVista` suma `entradas: EntradaVista[]` ("Solo en CONFIRMADA o UTILIZADA; si no, []. Solo la ve su comprador.") y `entradasUsadas: number`; `MiCompraVista` omite también `entradas` y conserva `entradasUsadas`. Test en `backend/tests/services/compra.service.test.ts` (se amplía): `obtener`, `pagar`, `cancelar`, `crear` y `misComprasDelEvento` devuelven `entradas` vacías en `PENDIENTE` y `CANCELADA` y con sus códigos y estado en `CONFIRMADA`/`UTILIZADA` (`usadaEn`/`usadaEnLocal` en las usadas); `misCompras` trae `entradasUsadas` y no `entradas`; `misComprasDelEvento.confirmadas` **incluye** las `UTILIZADA` (R9); `diasRestantes` sigue solo en `CONFIRMADA`; `aCompraDelEventoVista.entradasUsadas` real. Implementar en `backend/src/services/compra.vistas.ts` (`aEntradaVista`, `aCompraVista`, `aMiCompraVista`, `aCompraDelEventoVista`) y `compra.service.ts`. En el mismo turno, actualizar los fixtures de `mobile/tests/helpers/compras.ts` (`entradas: []`/códigos y `entradasUsadas: 0`) para que el typecheck de mobile quede en verde. Los tests de api de la 006 y la 007 siguen en verde (solo crecen).
- [ ] T027 [US3] Seed (R12): en `backend/src/seed/datos-ejemplo.ts`, el evento `evento-pena-en-la-rueda` ("Peña en La Rueda", de Lucía, Música), a la **hora en punto más cercana a `ahora + 2 h`** del arranque, con `tipo-pena-en-la-rueda-general` (6.000, cupo 120 − 3) y `tipo-pena-en-la-rueda-con-cena` (15.000, cupo 40 − 2); `compra-martin-pena-general` (3 General, `CONFIRMADA` → `UTILIZADA` con 1 entrada usada por Lucía) y `compra-sofia-pena-con-cena` (2 Con cena, `CONFIRMADA`), todas con códigos fijos y válidos distintos de los del Festival. Tests: `backend/tests/domain/datos-ejemplo.test.ts` (el evento existe, su ventana está **abierta** en el arranque y durante al menos 12 h, el cupo descuenta las compras vigentes, los códigos siguen siendo distintos) y ajustar los conteos del seed que cambian (un evento más, Lucía organiza 4) en `backend/tests/domain/datos-ejemplo.test.ts`, `backend/tests/repositories/repositorios-de-ejemplo.test.ts`, `backend/tests/api/eventos.test.ts` y los de mobile que usen esos números.

### Backend: service, concurrencia y API

- [ ] T028 [US3] Test de `backend/tests/services/entrada.service.test.ts` (nuevo) con el stub de `backend/src/services/entrada.service.ts` (`EntradaService` con dependencias `{ compras, eventoService, usuarioService, cerrojo, reloj }`; `obtener(eventoId, codigo, usuarioId): Promise<EntradaDelEventoVista>` y `registrarUso(eventoId, codigo, usuarioId): Promise<EntradaDelEventoVista>`) y de `aEntradaDelEventoVista` en `compra.vistas.ts`; sumarlo en `backend/src/app.ts` después de `CompraService`. Reloj movible. Casos:
  - **`obtener`** (lectura): normaliza el código (`"7k3m-q9tb"`); devuelve `codigo`, `estado` al día (una pendiente vencida → `CANCELADA`), `usadaEn`, `compra { id, comprador, tipoEntrada, cantidad, estado, entradasUsadas }` y `ventanaDeUso` con su `estado`; una entrada no usable **no** es error; 404 evento → 403 ("Solo el organizador del evento puede ver sus compras.") → `EntradaNoEncontradaError` (inexistente, con formato inválido o de **otro** evento: el mismo error, sin datos del otro); sin cerrojo y sin guardar;
  - **`registrarUso`**: dentro de la ventana, la entrada pasa a `UTILIZADA` con autor el organizador y `fechaHora` = el reloj **leído dentro del cerrojo**, y la compra también si es la primera; **un solo** `guardar` de la compra usada (aparte de los que haga `obtenerDelOrganizador` al materializar vencimientos: en el caso base, sin pendientes vencidas, es el único `guardar` en todo el pedido); el cupo del evento **no** cambia (FR-009); orden de chequeos 404 evento → 403 → 404 entrada → `FUERA_DE_HORARIO_DE_USO` → `TRANSICION_INVALIDA` (una `PENDIENTE` fuera de la ventana da el de la ventana); bordes de la ventana con el reloj movido (exactamente 4 h antes y 12 h después se aceptan; 1 minuto afuera, no); una pendiente vencida sin materializar → `TRANSICION_INVALIDA` "…está cancelada." y sus vencimientos quedan materializados (`obtenerDelOrganizador`); toma `cerrojo.ejecutar(eventoId, …)` una vez y lo libera también ante error.
  Luego implementarlo (R10).
- [ ] T029 [US3] Test en `backend/tests/services/concurrencia-compras.test.ts` (se amplía): N (10) `registrarUso` simultáneos sobre la misma entrada → uno resuelve y los demás rechazan con `TRANSICION_INVALIDA` "Esta entrada ya se utilizó."; la entrada tiene **un** cambio `UTILIZADA` y la compra **uno** (SC-006); usos simultáneos de **dos** entradas de la misma compra → las dos usadas y la compra con un único cambio `UTILIZADA`; un uso y una cancelación simultáneos sobre una `PENDIENTE` → la cancelación tiene efecto, el uso se rechaza con `TRANSICION_INVALIDA` y la compra queda `CANCELADA` con un único cambio nuevo (test de humo: hasta la 009 no existe cancelar una `CONFIRMADA`, que es la carrera real del caso borde "Uso y cancelación simultáneos"; la prueba la 009 sobre el mismo cerrojo). Debería pasar con T028; si no, corregir T028.
- [ ] T030 [US3] Test de `backend/tests/api/entradas.test.ts` (nuevo) con los stubs de `backend/src/controllers/entrada.controller.ts` (`obtener`, `registrarUso`), `backend/src/validations/entrada.validation.ts` (`params`: `eventoId` y `codigo` texto no vacío de hasta 32 caracteres) y el router hijo `eventos/:eventoId/entradas` (`mergeParams`, como `tipos-entrada`) en `backend/src/routes/eventos.routes.ts` (o un `entradas.routes.ts` que ese archivo monte). Casos con el seed y `crearApp({ reloj })` dentro de la ventana de la Peña: `GET …/entradas/:codigo` → `401`, `400` (código de 33 caracteres), `404 EVENTO_NO_ENCONTRADO`, `403` (Martín), `404 ENTRADA_NO_ENCONTRADA` (inexistente y de otro evento), `200` con un código de Sofía en minúsculas y con guion; `POST …/uso` → `200` `UTILIZADA` y la compra de Sofía `UTILIZADA` (`GET /compras/:id` con Sofía la muestra con una entrada usada); el mismo otra vez → `409 TRANSICION_INVALIDA` "Esta entrada ya se utilizó."; la otra entrada de Sofía → `200` y la compra no suma otro cambio; un código VIP de Martín sobre el Festival → `409 FUERA_DE_HORARIO_DE_USO`; un cuerpo, si llega, se ignora; después de los usos, `GET …/compras` muestra el cupo sin cambios y `usadas` sumado. Luego implementar controller, validación y router.
- [ ] T031 [US3] En `backend/src/docs/openapi.json`, sumar `GET /eventos/{eventoId}/entradas/{codigo}` y `POST /eventos/{eventoId}/entradas/{codigo}/uso` con `EntradaVista`, `EntradaDelEventoVista` y sus errores (`404 ENTRADA_NO_ENCONTRADA`, `409 FUERA_DE_HORARIO_DE_USO`, `409 TRANSICION_INVALIDA`), y los campos nuevos de `CompraVista` (`entradas`, `entradasUsadas`) y `MiCompraVista` (`entradasUsadas`); en la colección de Postman, dentro de "Compras del evento", "Buscar entrada", "Registrar uso" y "Registrar uso (ya utilizada, 409)" con un código de Sofía del seed. `backend/tests/api/docs.test.ts` en verde.

### Mobile

- [ ] T032 [P] [US3] Test en `mobile/tests/api/compras.test.ts` (se amplía) con los stubs de `obtenerEntradaDelEvento(cliente, eventoId, codigo, { signal })` y `registrarUsoDeEntrada(cliente, eventoId, codigo, { usuarioId })` en `mobile/src/api/compras.ts` (+ `index.ts`). Casos: `GET /eventos/:eventoId/entradas/:codigo` y `POST …/uso` **sin cuerpo**, con el código pasado por `encodeURIComponent` (un código con espacio o `/` no rompe la ruta), con `X-Usuario-Id`; un `409` llega como `ErrorDeApi` con su `mensaje`. Luego implementarlos.
- [ ] T033 [P] [US3] Test en `mobile/tests/features/compras/formato.test.ts` (se amplía) con los stubs de `textoCodigo` (`"7K3MQ9TB"` → `"7K3M-Q9TB"`), `textoCodigoAccesible` (→ `"7 K 3 M Q 9 T B"`), `normalizarCodigo` (`" 7k3m-q9tb "` → `"7K3MQ9TB"`), `textoMotivoNoUsable(entrada: EntradaDelEventoVista)` (ventana no abierta → "El ingreso se registra desde el 18/11 17:00 hasta el 19/11 09:00." —va **primero**, como en el servidor—; `UTILIZADA` → "Esta entrada ya se utilizó el 18/11 20:15."; `PENDIENTE`, `CANCELADA`, `REEMBOLSADA` → los mensajes de contracts/app.md; `CONFIRMADA` con la ventana abierta → `null`) y el caso `UTILIZADA` de `textoAvisoDeMiCompra` (→ `textoEntradasUsadas`). Luego implementarlos.
- [ ] T034 [US3] Test de `mobile/tests/pantallas/registrar-ingreso.test.tsx` (nuevo) con los stubs de `claves.entradaDelEvento(usuarioId, eventoId, codigo)` → `["entrada-del-evento", usuarioId, eventoId, codigo]`, `useEntradaDelEvento(usuarioId, eventoId, codigo | null)` en `mobile/src/features/compras/useEntradaDelEvento.ts` (`enabled: codigo !== null`), `useRegistrarUso(usuarioId, eventoId)` en `mobile/src/features/compras/mutaciones.ts`, `TarjetaEntrada` en `mobile/src/features/compras/componentes/TarjetaEntrada.tsx`, la pantalla `RegistrarIngreso` en `mobile/src/features/compras/pantallas/RegistrarIngreso.tsx` (exportada por `index.ts`) y la ruta `mobile/app/eventos/[eventoId]/ingreso.tsx`. Casos (contracts/app.md, "`RegistrarIngreso`"):
  - el botón primario "Registrar ingreso" de `ComprasDelEvento` (siempre visible) abre la pantalla;
  - campo "Código de la entrada" (`autoCapitalize="characters"`, sin autocorrección) y "Buscar" deshabilitado con el campo vacío; buscar `" 7k3m-q9tb "` pide `GET …/entradas/7K3MQ9TB`; buscar otra vez el mismo código vuelve a pedirlo;
  - cargando; `404 ENTRADA_NO_ENCONTRADA` → "No hay ninguna entrada con ese código en este evento."; otro error → `MensajeError` con reintento;
  - encontrada: `TarjetaEntrada` con "7K3M-Q9TB", comprador, tipo, `EtiquetaEstadoCompra` y, si la compra tiene usadas, "1 de 3 entradas usadas";
  - usable (`CONFIRMADA` y ventana `abierta`): "Registrar ingreso" → `Alert.alert("¿Registrar el ingreso?", "Martín Benítez · General. No se puede deshacer.", …)`; "Cancelar" no pide nada; "Registrar" hace **un** `POST …/uso` sin cuerpo;
  - no usable: el motivo de `textoMotivoNoUsable` **en lugar** del botón (cada estado y la ventana cerrada);
  - éxito → "Ingreso registrado: Martín Benítez · General", el campo vacío y con foco; `409` → su `mensaje` y la entrada se vuelve a pedir; la escritura **no** se reintenta sola;
  - al terminar (éxito o error) se vuelven a pedir "Compras del evento", el evento y, por prefijo, `["compra"]`, `["mis-compras"]` y `["mis-compras-del-evento"]` (FR-021, R13), y `["catalogo"]`.
  Luego implementar: hook, mutation (sin reintentos; `onSuccess` → `setQueryData(entradaDelEvento)`; `onSettled` invalida `comprasDelEvento(usuarioId, eventoId)`, la entrada, `["evento", *, eventoId]`, `["catalogo"]` y los tres prefijos del comprador), tarjeta, pantalla con `PantallaDesplazable` y el botón en `ComprasDelEvento` con `router.push({ pathname: "/eventos/[eventoId]/ingreso", params: { eventoId } })`.
- [ ] T035 [US3] Test de las vistas del comprador con el stub de `ListaDeEntradas` en `mobile/src/features/compras/componentes/ListaDeEntradas.tsx`, en `mobile/tests/pantallas/compra.test.tsx` (se amplía), `mobile/tests/pantallas/mis-entradas.test.tsx` (nuevo: la pantalla `MisEntradasDelEvento` con `ListaDeEntradas`; los casos de "Ver mis entradas" que ya están en `detalle-evento.test.tsx` se quedan ahí), `mobile/tests/pantallas/detalle-evento.test.tsx` (se amplía: `AccesoMisEntradas` cuenta las `UTILIZADA`) y `mobile/tests/pantallas/mis-compras.test.tsx` (se amplía). Casos (FR-012b, FR-012e, R14):
  - "Tu compra" en `CONFIRMADA` y `UTILIZADA`: sección **"Tus entradas"** con una fila por entrada ("Entrada 1", "7K3M-Q9TB", `EtiquetaEstadoCompra`) y `accessibilityLabel` "Entrada 1, código 7 K 3 M Q 9 T B, Confirmada"; en `PENDIENTE` y `CANCELADA`, **ningún** código; en `UTILIZADA`, "1 de 3 entradas usadas" y lo que hoy muestra de una pagada (sin acciones nuevas);
  - "Ver mis entradas" (`mis-entradas.test.tsx`): la `ListaDeEntradas` debajo de cada fila, también de una `UTILIZADA`;
  - detalle (`detalle-evento.test.tsx`): `AccesoMisEntradas` cuenta las `UTILIZADA`;
  - "Mis compras": la fila de una `UTILIZADA` dice "N de M entradas usadas" junto a la etiqueta.
  Luego implementar `ListaDeEntradas` y los cambios en `mobile/src/features/compras/pantallas/Compra.tsx` (`UTILIZADA` donde hoy pregunta por `CONFIRMADA`), `componentes/FilaCompraConfirmada.tsx`, `componentes/FilaMiCompra.tsx` y `componentes/AccesoMisEntradas.tsx`. Los tests de la 006 y la 007 siguen en verde.

**Checkpoint**: el ciclo de vida de la compra llega a `UTILIZADA`; el comprador muestra su código y
el organizador registra el ingreso en menos de 15 s.

---

## Phase 6: User Story 4 — Lista al día y ante fallas (Priority: P2)

**Goal**: "Compras del evento" refleja lo último (foco y después de un uso), muestra el vacío con
el resumen, informa un evento inexistente y nunca mezcla usuarios.

**Independent Test**: un evento sin compras → resumen y "Todavía nadie compró entradas"; comprar
con otro usuario y volver → aparece; servidor caído → error con reintento; evento borrado → aviso y
vuelta a Mis eventos.

- [ ] T036 [US4] Test en `mobile/tests/pantallas/compras-del-evento.test.tsx` (se amplía). Casos:
  - **vacío** (FR-022): sin compras, la ventana y el resumen se ven igual y la lista dice "Todavía nadie compró entradas" (el vacío **no** reemplaza la pantalla);
  - **foco** (FR-023, US4-3): ir a "Registrar ingreso" (u otra pantalla) y volver hace un segundo `GET …/compras`; el primer foco no duplica el pedido del montaje;
  - **después de un uso** (US3-9): registrar un ingreso y volver → la lista muestra la compra `UTILIZADA` con "1 de N entradas usadas" y el resumen con la usada;
  - **404 del evento** (FR-024): "No existe el evento." y vuelta a "Mis eventos" (`router.dismissTo("/mis-eventos")`), también desde `RegistrarIngreso`;
  - **cambio de usuario** (US4-4): con la lista de Lucía cargada, cambiar de usuario desde Perfil → nunca se ven compras de Lucía y los pedidos llevan el `X-Usuario-Id` nuevo.
  Luego implementar en `ComprasDelEvento` el `useFocusEffect` que llama a `refetch()` en cada foco salvo el primero (como `MisCompras`, con un `useRef`) y el manejo de `esNoEncontrado` (como `DetalleEvento`) en las dos pantallas.

**Checkpoint**: la pantalla nunca engaña: refleja compras, usos y vencimientos al volver, y nunca
muestra datos de otro usuario.

---

## Phase 7: Polish y transversales

**Purpose**: documentación, accesibilidad, validación de punta a punta y cierre.

- [ ] T037 [P] Actualizar `AGENTS.md` (plan, "Post-design re-check"): en el recurso `compras`, `GET /eventos/:eventoId/compras` (organizador, al día, sin códigos); el recurso `entradas` (router hijo de `eventos/:eventoId`, `EntradaService` con `obtener`/`registrarUso`, orden de chequeos del uso, `EntradaNoEncontradaError`); la `Entrada` dentro del agregado `Compra` (código del repositorio, estado derivado, `registrarUso` y la primera entrada usada), `esVigente` y `confirmadas` con `UTILIZADA`; los módulos puros `codigo-de-entrada.ts`, `ventana-de-uso.ts` y `compras-del-evento.ts`; `EventoService.leerDelOrganizador`; `listarPorEvento`, `buscarPorCodigoDeEntrada` y `siguientesCodigosDeEntrada`; `CompraService` con `UsuarioService` y el orden de `app.ts`; en mobile, las rutas `eventos/[eventoId]/compras` e `ingreso`, las claves `comprasDelEvento` y `entradaDelEvento`, `useRegistrarUso` y sus invalidaciones por prefijo, `ListaDeEntradas` y "Ver compras" por ruta desde `eventos`; el evento del seed "Peña en La Rueda" con la ventana abierta.
- [ ] T038 Revisar en 360 px y con TalkBack "Compras del evento", "Registrar ingreso" y "Tus entradas": sin desplazamiento horizontal; nombres largos se parten antes de recortarse; el resumen por tipo legible; cada código leído de a un carácter; el campo y "Buscar" accesibles; sin valores sueltos fuera del `tema` ni `fontWeight` (FR-025). Ajustar en `mobile/src/features/compras/componentes/` lo que haga falta.
- [ ] T039 Correr `npm test`, `npm run lint`, `npm run typecheck` y `npm run format:check` desde la raíz y dejar las cuatro en verde (incluidos todos los tests de la 004 a la 007).
- [ ] T040 Validar a mano las secciones "Pedidos directos" y "Recorrido en la app" de `specs/008-compras-de-evento/quickstart.md` y anotar cualquier desvío debajo de esta tarea.
- [ ] T041 En `docs/backlog.md`, pasar la 008 a `en PR`, y abrir el PR de `feature/008-compras-de-evento` a `development` con las cuatro verificaciones del CI en verde.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T001 ya está hecho; T003 (tipos nuevos) lo usan el
  backend y la app.
- **Foundational (Phase 2)**: depende de Setup. T004 y T005 en paralelo; T006 depende de T004;
  T007 depende de T004 y T006; T008 depende de T007. **Bloquea todas las historias**.
- **US1 (Phase 3)**: depende de Foundational (usa la ventana de T005).
- **US2 (Phase 4)**: depende de US1 (completa `resumenPorTipo` de `comprasDelEvento` y suma su
  sección a la pantalla). T018 y T021 pueden adelantarse en paralelo con la US1.
- **US3 (Phase 5)**: depende de Foundational para el backend; su mobile (T034, el botón "Registrar
  ingreso") depende de la pantalla de la US1. T027 (seed) depende de T023. T028 depende de T023,
  T024, T025 y T026; T029 y T030 de T028.
- **US4 (Phase 6)**: depende de US1 y, para el caso "después de un uso", de US3.
- **Polish (Phase 7)**: depende de las historias que se quieran entregar.

### Within Each User Story

- Test con stub → verlo fallar → implementar.
- Dominio → repositorio → service → controller y ruta → OpenAPI y Postman.
- `src/api/` → clave y hook → componente → pantalla y ruta.
- Las tareas sobre el mismo archivo son secuenciales: `domain/compra.test.ts`,
  `compra.repository.test.ts`, `compra.service.test.ts`, `compras-del-evento.test.ts`,
  `api/compras.test.ts` (backend y mobile), `compra.vistas.ts`, `openapi.json`, `formato.ts`,
  `formato.test.ts`, `compras-del-evento.test.tsx`, `ComprasDelEvento.tsx`.
- T008, T020 y T029 son tests de contrato sobre lo ya implementado: pueden pasar de entrada. No se
  fuerza un rojo artificial; si fallan, se corrige la tarea que corresponde.

### Parallel Opportunities

- **Phase 1**: T002 y T003.
- **Phase 2**: T004 (código) y T005 (ventana).
- **US1**: T009 (repositorio), T010 (orden), T015 (API mobile) y T016 (formato) en paralelo.
- **US2**: T018 (resumen, dominio) y T021 (formato) en paralelo; pueden empezar ni bien termina
  Foundational.
- **US3**: T024 (repositorio), T025 (error), T032 (API mobile) y T033 (formato) en paralelo con
  T023.

---

## Parallel Example: User Story 1

```text
Task: "T009 Test de listarPorEvento en backend/tests/repositories/compra.repository.test.ts"
Task: "T010 Test de compararComprasDelEvento en backend/tests/domain/compras-del-evento.test.ts"
Task: "T015 Test de obtenerComprasDelEvento en mobile/tests/api/compras.test.ts"
Task: "T016 Test de los textos de la lista en mobile/tests/features/compras/formato.test.ts"
```

## Parallel Example: User Story 3

```text
Task: "T024 Test de buscarPorCodigoDeEntrada en backend/tests/repositories/compra.repository.test.ts"
Task: "T025 EntradaNoEncontradaError en backend/src/errors/index.ts"
Task: "T032 Test de obtenerEntradaDelEvento/registrarUsoDeEntrada en mobile/tests/api/compras.test.ts"
Task: "T033 Test de textoCodigo/textoMotivoNoUsable en mobile/tests/features/compras/formato.test.ts"
```

---

## Implementation Strategy

### MVP primero (US1 + US2)

1. Phase 1 y Phase 2 completas (cada una con `/speckit-implement fase N` y `/clear` entre fases).
2. Phase 3 (US1): **Validar**: Lucía ve las compras del Festival al día; Martín → `403`; sin
   usuario → `401`; cuatro lecturas con 30 compras.
3. Phase 4 (US2): **Validar**: 5 · 3 · 2 · 0 → 8 · 0 · 2 · 0 al vencer; "Agotado"; los
   disponibles iguales a los del detalle.
4. Las cuatro verificaciones en verde. Es UC-02 completo y demostrable.

### Entrega incremental

1. MVP (US1 + US2).
2. US3: códigos para el comprador, "Registrar ingreso" y `UTILIZADA`; el seed de la Peña para la
   demo.
3. US4: foco, vacío, 404 y cambio de usuario.
4. Polish y PR.

---

## Notes

- [P] = archivo distinto y sin dependencias pendientes.
- Cada historia es verificable sola en su checkpoint.
- Si una tarea obliga a decidir algo que el plan o la spec no cubren, se frena y se consulta (no
  se inventa la regla).
- Hasta la US2, `resumenPorTipo` llega vacío; hasta la US3, `entradasUsadas` vale 0 en toda
  compra, no hay códigos en las vistas del comprador ni botón "Registrar ingreso", y el seed no
  tiene la Peña (la ventana de uso del Festival está cerrada). Si se entrega solo el MVP, decirlo
  en el PR.
