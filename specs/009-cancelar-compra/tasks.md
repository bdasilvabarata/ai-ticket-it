---

description: "Tareas de implementación de la feature 009 — Cancelar compra con reembolso"
---

# Tasks: Cancelar compra con reembolso

**Input**: documentos de diseño en `specs/009-cancelar-compra/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md),
[contracts/app.md](./contracts/app.md), [quickstart.md](./quickstart.md)

**Tests**: obligatorios (constitución II): cada regla con su caso borde en `domain` (hora exacta y
−1 min, cada estado no cancelable con el evento empezado y sin empezar, la gratis, las invariantes),
`services` (reloj fijo y movible, repositorios armados por caso y espiados para el orden y la
cantidad de guardados), concurrencia y `api`; en mobile, `api/`, `formato` y las pantallas con
`renderConDependencias` y `porRuta` (R13).

**Organización**: una fase por historia de usuario, en el orden de la spec (US1, US2 y US3 son P1;
US4 y US5 son P2). Lo que se deriva del historial (`fueConfirmada`, `canceladaDesde`,
`cambioDeCancelacion`, `tieneReembolsoPendiente`, `motivoNoCancelable`), el cambio propio de cada
entrada a `CANCELADA`, las invariantes y los campos nuevos de las vistas van en Foundational: los
usan las tres historias P1. La transición `CONFIRMADA → CANCELADA` llega en la US1; `CANCELADA →
REEMBOLSADA` y el seed del Maratón, en la US2; los rechazos y el motivo en "Tu compra", en la US3.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: puede hacerse en paralelo (archivo distinto, sin dependencias pendientes).
- **[Story]**: historia a la que pertenece (US1–US5).
- Rutas relativas a la raíz del repo.

## Convenciones para todas las tareas

- **Test primero con stub en el mismo turno** (AGENTS.md, "TDD con stub"): el hook `Stop` exige
  typecheck y lint en verde al cerrar cada turno. Cada tarea "Test" crea **en el mismo turno** los
  módulos o miembros que importa como **stub con la firma real** que lanza
  `new Error("no implementado")` (un componente que devuelve `null`). Se corre el test con
  `test:foco` (o `test:afectados -w backend`), **se lo ve fallar** por comportamiento y recién
  después se implementa. "Test … Luego implementar" es el mismo ciclo en dos turnos.
- Endpoints: skill **`nuevo-endpoint`**. Pantallas, hooks y funciones de `src/api/`: skill
  **`nueva-pantalla`**.
- Backend en capas: `domain/` puro (sin Express, sin `errors/`, sin reloj: `ahora` e
  `inicioDelEvento` llegan como argumentos; "empezó" es `ahora >= fechaHora`, inclusive, como
  `Evento.estaRealizado`). `CompraService` es dueño de `Compra` y escribe solo su agregado: el cupo
  lo devuelve `TipoEntradaService.devolverCupo`, el 403 del organizador y la materialización vienen
  de `EventoService.obtenerDelOrganizador`, y el comprador de `UsuarioService`. Sin services,
  repositorios ni campos guardados nuevos (R4, data-model "Repositorios").
- **Escrituras** (cancelar y confirmar el reembolso): todo dentro de
  `cerrojo.ejecutar(eventoId, …)`, con `ahora` leído adentro, el evento materializado
  (`obtenerAlDia` al cancelar, `obtenerDelOrganizador` al reembolsar), la compra **releída** adentro,
  y el cerrojo liberado en `finally`, sin anidar. Al cancelar se guarda **primero la compra y
  después el evento** con el cupo devuelto. Reembolsar es **un** `guardar` de la compra y no toca el
  cupo. **Lecturas**: al día, sin cerrojo y sin guardar (`cancelable`, `motivoNoCancelable`,
  `reembolso` se calculan en cada consulta).
- Orden de rechazos: cancelación `401 → 400 → 404 COMPRA_NO_ENCONTRADA → 403 SIN_PERMISO → 409
  COMPRA_VENCIDA → 409 EVENTO_REALIZADO (solo CONFIRMADA) → 409 TRANSICION_INVALIDA`; reembolso
  `401 → 400 → 404 COMPRA_NO_ENCONTRADA → 403 SIN_PERMISO → 409 TRANSICION_INVALIDA`. Los 404/403,
  el service con `errors/`; los 409, el dominio. Los mensajes son los de data-model ("Mensajes de
  los rechazos") y contracts/api.md, al pie de la letra.
- **Los contratos de la 006 a la 008 solo crecen**: la única ampliación de significado es
  `canceladaPor`, que también llega en `REEMBOLSADA` (R7). `CompraDelEventoVista` sigue **sin
  códigos**; `CompraVista.entradas` sigue vacía fuera de `CONFIRMADA`/`UTILIZADA`.
- Textos de la app: los de `contracts/app.md` (son los que buscan los tests). El estado lo pone
  siempre `EtiquetaEstadoCompra`, sin cambios; los avisos van al lado, nunca la reemplazan. La app
  **no calcula la regla**: el botón "Cancelar compra" depende de `cancelable`, el motivo de
  `motivoNoCancelable` y "Confirmar reembolso" de `reembolso?.estado === "pendiente"` (SC-007).
- Mobile: todo lo nuevo vive en `features/compras` (la feature `eventos` no cambia). Afuera solo
  cambia `src/api/compras.ts` (+ `index.ts`). Sin rutas nuevas. Imports relativos sin alias `@/`;
  todo `fetch` en `src/api/`; estilos con `StyleSheet` y valores del `tema`; textos con
  `...tema.tipografia.<estilo>` (nunca `fontWeight`). Las escrituras no se reintentan solas.
- Prohibidos `any`, `@ts-ignore` y `eslint-disable` sin descripción (principio IX).
- Commits: Conventional Commits con scope `009-cancelar-compra`, uno por tarea o grupo coherente.
  Cada fase cierra con la suite completa en verde (`npm test`, `npm run lint`,
  `npm run typecheck`, `npm run format:check`), sus tareas marcadas y su commit.

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: la enmienda de la constitución, los tipos compartidos nuevos (aditivos: todavía no los
usa ninguna vista) y el estado del backlog.

- [X] T001 Enmendar `.specify/memory/constitution.md` a 2.5.1 con `/speckit-constitution` (R12): en "Roles · Organizador", "confirma los reembolsos de las compras canceladas de sus eventos"; en el principio VI, "un organizador solo ve las compras de sus eventos y solo confirma sus reembolsos". Hecho en `b898afd`.
- [X] T002 [P] En `docs/backlog.md`, pasar la 009 de `plan` a `tasks`.
- [X] T003 [P] En `shared/src/compra.ts`, sumar con el JSDoc de data-model ("Vistas compartidas") `export type MotivoNoCancelable = "evento-empezado" | "entrada-usada" | "cancelada" | "reembolsada";` ("Por qué una compra no se puede cancelar (lo decide el servidor al consultar; feature 009).") y `export interface ReembolsoVista { estado: "pendiente" | "confirmado"; monto: number }` ("`pendiente` hasta que el organizador lo confirma; `confirmado` en una REEMBOLSADA." / "Pesos enteros: el total fijado al comprar."). Exportarlos como tipos en `shared/src/index.ts`. **No** tocar todavía `CompraVista`, `MiCompraVista` ni `CompraDelEventoVista` (T005). `npm run typecheck` en verde en los tres paquetes.

---

## Phase 2: Foundational (prerequisitos bloqueantes)

**Purpose**: lo que la compra sabe de su cancelación y su reembolso, derivado del historial; el
cambio propio de cada entrada a `CANCELADA`; las invariantes; y los campos nuevos de las vistas, que
usan las tres historias P1. Ninguna transición nueva todavía.

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

- [ ] T004 Test en `backend/tests/domain/compra.test.ts` (se amplía) con los stubs en `backend/src/domain/compra.ts` de `Entrada.cancelar(compradorId: string, ahora: Date): Entrada` y, en `Compra`, los getters `fueConfirmada: boolean`, `canceladaDesde: "PENDIENTE" | "CONFIRMADA" | null`, `cambioDeCancelacion: CambioEstadoCompra | null` y los métodos `tieneReembolsoPendiente(): boolean` y `motivoNoCancelable(inicioDelEvento: Date, ahora: Date): MotivoNoCancelable | null` (`MotivoNoCancelable` importado de `shared`, como `EstadoCompra`). Las compras `CANCELADA`/`REEMBOLSADA` desde confirmada se arman **con el constructor** (historial y entradas a mano; la transición llega en la US1). Casos (R3, R4, R6, data-model "`Compra`"):
  - `Entrada.cancelar` devuelve la entrada con el cambio `{ estado: CANCELADA, autor: { tipo: "usuario", usuarioId: comprador }, fechaHora: ahora }` sin tocar la original;
  - `Entrada.estadoEn(compra)`: si la compra **nunca llegó a `CONFIRMADA`**, el estado de la compra (como hoy: `PENDIENTE`, `CANCELADA` de una pendiente o vencida); si llegó, `ultimoEstadoPropio ?? CONFIRMADA` → en una `CANCELADA` y en una `REEMBOLSADA` después de confirmada, `CANCELADA`;
  - `fueConfirmada`: `true` si el historial tiene un `CONFIRMADA` (confirmada, utilizada, cancelada desde confirmada, reembolsada); `false` en una pendiente, una pendiente cancelada y una vencida;
  - `canceladaDesde`: `"CONFIRMADA"` en `CANCELADA`/`REEMBOLSADA` que pasaron por `CONFIRMADA` (también una gratis), `"PENDIENTE"` en una `CANCELADA` sin confirmar (por el comprador o vencida, también una pendiente vencida tras `alDia`), `null` en `PENDIENTE`, `CONFIRMADA` y `UTILIZADA`;
  - `cambioDeCancelacion`: el cambio a `CANCELADA` del historial, también en una `REEMBOLSADA` (autor el comprador); `null` si no hay;
  - `tieneReembolsoPendiente()` ⇔ `CANCELADA` ∧ `fueConfirmada` ∧ `total > 0`: `true` en la paga cancelada desde confirmada; `false` en la gratis ($ 0), en la pendiente cancelada, en la vencida, en la `REEMBOLSADA` y en cualquier otro estado;
  - `motivoNoCancelable` (tabla de R6, sobre la compra al día): `PENDIENTE` → `null` (también con el evento empezado); `CONFIRMADA` 1 minuto antes del inicio → `null`; `CONFIRMADA` **exactamente** en el inicio y después → `"evento-empezado"`; `UTILIZADA` con el evento empezado y sin empezar → `"entrada-usada"`; `CANCELADA` → `"cancelada"`; `REEMBOLSADA` → `"reembolsada"`;
  - invariantes del constructor → `DatosInvalidosError`: un `REEMBOLSADA` que no es el último cambio, que no sigue inmediatamente a un `CANCELADA`, de una compra que no pasó por `CONFIRMADA` o con `total === 0`; **entradas coherentes** (reemplaza a `usoCoherente` por `entradasCoherentes`): si la compra no pasó por `CONFIRMADA`, ninguna entrada con cambios (como hoy); `CONFIRMADA` → ninguna usada ni cancelada; `UTILIZADA` → alguna usada y ninguna cancelada; `CANCELADA`/`REEMBOLSADA` después de confirmada → cada entrada con **un único** cambio propio, `CANCELADA` (falla con una sin cambio, con una usada o con dos cambios);
  - `esVigente(ahora)` es `false` en una `CANCELADA` desde confirmada y en una `REEMBOLSADA` (FR-004, sin cambios de código).
  Luego implementarlo. Los tests de la 006 a la 008 de este archivo siguen en verde.
- [ ] T005 Campos nuevos de las vistas (R7). En `shared/src/compra.ts`: `CompraVista` suma `canceladaDesde: "PENDIENTE" | "CONFIRMADA" | null` ("Solo en CANCELADA o REEMBOLSADA."), `reembolso: ReembolsoVista | null`, `cancelable: boolean` y `motivoNoCancelable: MotivoNoCancelable | null` ("Al día con el reloj del servidor."); `MiCompraVista` pasa a `Omit<CompraVista, "compradorId" | "historial" | "entradas" | "cancelable" | "motivoNoCancelable">` y el JSDoc de su `canceladaPor` dice "solo CANCELADA o REEMBOLSADA: el autor del cambio a CANCELADA"; `CompraDelEventoVista` suma `canceladaDesde` y `reembolso` y amplía igual el JSDoc de `canceladaPor`. Test en `backend/tests/services/compra.service.test.ts` (se amplía), con compras armadas por constructor en el repositorio y reloj fijo: `obtener`, `misComprasDelEvento` y las respuestas de `pagar`/`cancelar` (pendiente) traen `canceladaDesde`, `reembolso` y `cancelable`/`motivoNoCancelable` según la tabla de R6 (una `CONFIRMADA` antes del inicio → `cancelable: true`, `motivoNoCancelable: null`; moviendo el reloj al inicio → `false`, `"evento-empezado"`; `UTILIZADA` → `"entrada-usada"`); una `CANCELADA` desde confirmada paga → `reembolso: { estado: "pendiente", monto: total }` y `entradas: []`; una `REEMBOLSADA` → `{ estado: "confirmado", monto: total }`; una gratis cancelada desde confirmada o una pendiente cancelada → `reembolso: null`; `misCompras` trae `canceladaDesde` y `reembolso` pero **no** `cancelable` ni `motivoNoCancelable`; `misCompras` y `comprasDelEvento` dan `canceladaPor: "usuario"` también en una `REEMBOLSADA` (desde `cambioDeCancelacion`); todo sin guardar (repositorios espiados). Implementar en `backend/src/services/compra.vistas.ts` (`aReembolsoVista(compra)`; `datosComunes(compra, evento, ahora)` suma `canceladaDesde` y `reembolso`; `aCompraVista` suma `cancelable` y `motivoNoCancelable` con `compra.motivoNoCancelable(evento.fechaHora, ahora)`; `aMiCompraVista` y `aCompraDelEventoVista` con `canceladaPor` desde `cambioDeCancelacion` y, la segunda, `canceladaDesde` y `reembolso`). En el mismo turno, actualizar los fixtures de `mobile/tests/helpers/compras.ts` (`canceladaDesde: null` y `reembolso: null` salvo en las canceladas o reembolsadas; `cancelable: true` y `motivoNoCancelable: null` en las `PENDIENTE` y en las `CONFIRMADA` de eventos futuros, y en el resto `cancelable: false` con el motivo de la tabla de R6: `UTILIZADA` → `"entrada-usada"`, `CANCELADA` → `"cancelada"`, `REEMBOLSADA` → `"reembolsada"`) y cualquier otro objeto literal de esas vistas en `mobile/tests/` para que el typecheck de mobile quede en verde. Los tests de api de la 006 a la 008 siguen en verde (solo crecen).

**Checkpoint**: las vistas ya informan si una compra se puede cancelar y su reembolso, al día; nada
cambia de comportamiento (todavía no se cancela una confirmada).

---

## Phase 3: User Story 1 — Cancelar una compra confirmada (Priority: P1) 🎯 MVP

**Goal**: el comprador cancela desde "Tu compra" una `CONFIRMADA` propia, sin entradas usadas,
antes del inicio: la compra pasa a `CANCELADA` (autor él, hora del servidor), cada entrada queda
`CANCELADA` y deja de servir en "Registrar ingreso", el cupo vuelve, el tope se libera y, si es
paga, queda con el reembolso pendiente.

**Independent Test**: con el seed, Martín → "Mis compras" → Festival → "Cancelar compra" → el
`Alert` dice 2 entradas y $ 240.000 → confirmar → "Cancelada" con "Cancelaste esta compra. El
organizador tiene que confirmar el reembolso de $ 240.000" y sin entradas; el detalle del Festival
muestra VIP con 50 disponibles y Martín puede volver a comprar hasta 4; el historial termina en
`CANCELADA` con Martín como autor.

### Backend

- [ ] T006 [US1] Test en `backend/tests/domain/compra.test.ts` (se amplía) con el **cambio de firma** `cancelar(usuarioId: string, ahora: Date, inicioDelEvento: Date): Compra` en `backend/src/domain/compra.ts`; en el mismo turno actualizar a todos los que lo llaman para que el typecheck quede en verde (`backend/src/services/compra.service.ts`: `compra.cancelar(usuarioId, ahora, evento.fechaHora)`; los tests de domain, services y concurrencia que cancelan pendientes). Casos (R1, FR-001 a FR-003, FR-006):
  - una `CONFIRMADA` 1 minuto antes del inicio → `CANCELADA` con el cambio `{ CANCELADA, autor: el comprador, fechaHora: ahora }` como último del historial; **cada** entrada con su cambio propio `CANCELADA` (mismo autor y hora, `Entrada.cancelar`); `estadoDeEntrada(codigo)` → `CANCELADA`; `canceladaDesde` → `"CONFIRMADA"`; `tieneReembolsoPendiente()` → `true` si `total > 0`; la instancia original no cambia;
  - una `CONFIRMADA` gratis → `CANCELADA` con sus entradas canceladas y `tieneReembolsoPendiente()` → `false`;
  - la `PENDIENTE` sigue como en la 006: `CANCELADA` sin cambios en sus entradas, también con el evento empezado; una pendiente vencida → `COMPRA_VENCIDA`;
  - `registrarUso` sobre una entrada de la compra cancelada → `TRANSICION_INVALIDA` "La compra de esta entrada está cancelada." (y sigue igual en una `REEMBOLSADA` armada por constructor: R3);
  - en `backend/tests/domain/tope-por-persona.test.ts` (se amplía): con el tope lleno, cancelar una confirmada devuelve `entradasRestantes` a su valor (FR-004); con el tope de un tipo gratis lleno (1), cancelar su confirmada lo devuelve a 1 (caso borde "Compra gratis confirmada").
  Luego implementarlo: vencida → `COMPRA_VENCIDA`; `PENDIENTE` → como hoy; si no, según `motivoNoCancelable(inicioDelEvento, ahora)`: `"evento-empezado"` → `ReglaDeNegocioError` `EVENTO_REALIZADO` "El evento ya empezó: ya no se puede cancelar la compra."; otro motivo → `TRANSICION_INVALIDA` con el mensaje por motivo ("Ya se usó una entrada de esta compra: no se puede cancelar.", "La compra ya está cancelada.", "La compra ya fue reembolsada."); `null` → la compra con el cambio y las entradas canceladas.
- [ ] T007 [US1] Test en `backend/tests/services/compra.service.test.ts` (se amplía): `CompraService.cancelar` sobre una `CONFIRMADA` antes del inicio, con reloj fijo y repositorios espiados. Casos (R2, FR-002 a FR-005, FR-014): responde la `CompraVista` `CANCELADA` con `canceladaDesde: "CONFIRMADA"`, `reembolso: { "pendiente", total }`, `entradas: []`, `cancelable: false`, `motivoNoCancelable: "cancelada"`; el historial guardado termina en `CANCELADA` con el comprador y la hora del reloj **leída dentro del cerrojo**; el cupo del tipo sube **exactamente** `cantidad` (un tipo agotado vuelve a tener disponibles; `EventoService.obtener` lo muestra igual a cualquier usuario); el orden de guardado es **la compra primero y después el evento** (una sola vez cada uno); `misComprasDelEvento` vuelve a dar `restantes` 4 en los tipos pagos (tope liberado) y se puede volver a comprar; la gratis → `reembolso: null` y su cupo vuelve igual; `comprasDelEvento` la muestra `CANCELADA`, fuera de `vendidas` y con `disponibles` sumado (R2); toma `cerrojo.ejecutar(eventoId, …)` una vez y lo libera. Debería pasar con T006; si no, corregir `backend/src/services/compra.service.ts`.
- [ ] T008 [US1] Test en `backend/tests/api/compras.test.ts` (se amplía) y `backend/tests/api/entradas.test.ts` (se amplía), con el seed y `crearApp({ reloj })`: `POST /api/compras/compra-martin-festival-vip/cancelacion` como Martín → `200` con la forma del ejemplo de contracts/api.md (`CANCELADA`, `canceladaDesde`, `reembolso { "pendiente", 240000 }`, `entradas: []`, `cancelable: false`, `motivoNoCancelable: "cancelada"`, el último cambio del historial por Martín); después `GET /api/eventos/evento-festival-sonidos-del-sur` → VIP con cupo 50, también en `GET /api/eventos` y con otro usuario; `GET /api/eventos/evento-festival-sonidos-del-sur/mis-compras` de Martín → `restantes` 4 y la compra ya **no** está en `confirmadas` ("Ver mis entradas" no la incluye, US1-5); un cuerpo, si llega, se ignora. En `entradas.test.ts`, con el reloj dentro de la ventana de la Peña: cancelar `compra-sofia-pena-con-cena` como Sofía → `200` con `reembolso` de 30000; después `GET …/entradas/PRCS2B01` como Lucía → `estado: "CANCELADA"` y `POST …/PRCS2B01/uso` → `409 TRANSICION_INVALIDA` "La compra de esta entrada está cancelada." (SC-006). Debería pasar con T006–T007.
- [ ] T009 [US1] En `backend/src/docs/openapi.json`: el `POST /compras/{compraId}/cancelacion` amplía su descripción (también una `CONFIRMADA`) y sus `409` (`EVENTO_REALIZADO` y los tres `TRANSICION_INVALIDA`); los esquemas `MotivoNoCancelable` y `ReembolsoVista`, y los campos nuevos de `CompraVista` (`canceladaDesde`, `reembolso`, `cancelable`, `motivoNoCancelable`), `MiCompraVista` (`canceladaDesde`, `reembolso`) y `CompraDelEventoVista` (`canceladaDesde`, `reembolso`; `canceladaPor` también en `REEMBOLSADA`). En `backend/src/docs/ai-ticket-it.postman_collection.json`, una carpeta "Cancelar compra (009)" con "Cancelar compra confirmada (Martín, Festival)". `backend/tests/api/docs.test.ts` en verde.

### Mobile

- [ ] T010 [P] [US1] Test en `mobile/tests/features/compras/formato.test.ts` (se amplía) con el stub de `textoConfirmarCancelacion(compra: CompraVista): string` y la ampliación de `textoCancelada(compra)` en `mobile/src/features/compras/formato.ts`. Casos (contracts/app.md, "Textos"): `textoConfirmarCancelacion` paga de 2 → "Se cancelan tus 2 entradas. El organizador tiene que confirmar el reembolso de $ 240.000. No se puede deshacer."; gratis de 1 → "Se cancela tu entrada y vuelve a estar disponible. No se puede deshacer."; gratis de 3 → "Se cancelan tus 3 entradas y vuelven a estar disponibles. No se puede deshacer."; `textoCancelada` con `reembolso.estado === "pendiente"` → "Cancelaste esta compra. El organizador tiene que confirmar el reembolso de $ 240.000"; con `canceladaDesde === "CONFIRMADA"` y gratis → "Cancelaste esta compra"; pendiente cancelada y vencida → los textos de la 006 sin cambios. Montos con `textoTotal`. Luego implementarlos.
- [ ] T011 [US1] Test en `mobile/tests/pantallas/compra.test.tsx` (se amplía), con `porRuta` y fixtures de `mobile/tests/helpers/compras.ts` (una `CONFIRMADA` `cancelable` y su respuesta `CANCELADA` con reembolso pendiente). Casos (contracts/app.md, "Tu compra"):
  - `CONFIRMADA` con `cancelable: true`: "¡Listo! Tu compra está confirmada.", "Tus entradas" y el botón **"Cancelar compra"** (variante `texto`) debajo de las entradas, además de "Volver al evento" e "Ir a Explorar";
  - tocar "Cancelar compra" abre `Alert.alert` con el título "¿Cancelar la compra de 2 entradas VIP?" (`textoCantidad` + nombre del tipo), el mensaje de `textoConfirmarCancelacion` y los botones "Volver" (`cancel`) y "Cancelar compra" (`destructive`); "Volver" **no** manda nada; "Cancelar compra" hace **un** `POST /compras/:id/cancelacion` sin cuerpo con `X-Usuario-Id`;
  - una gratis: el `Alert` sin monto;
  - mientras va el pedido, el botón dice "Cancelando…" (`enCurso`, `busy`) y un segundo toque (o una segunda confirmación) **no** manda otro pedido (marca sincrónica `enviando`);
  - al terminar, la pantalla (redibujada desde `useCompra`) muestra `EtiquetaEstadoCompra` "Cancelada" con el aviso de `textoCancelada` (`accessibilityLiveRegion="polite"`) y **sin** "Tus entradas";
  - un `409` (por ejemplo `EVENTO_REALIZADO`) muestra su `mensaje` con `AvisoDeFormulario` (**también los 409**, a diferencia del pago) y vuelve a pedir la compra; sin servidor → "No se pudo cancelar. Probá de nuevo."; otro error → "Ocurrió un error inesperado.".
  Luego implementar en `mobile/src/features/compras/pantallas/Compra.tsx` una sección `Cancelacion` para `CONFIRMADA`/`UTILIZADA` (el botón si `cancelable`; el motivo llega en la US3) usando la `useCancelarCompra` existente de `mobile/src/features/compras/mutaciones.ts`. Los casos de la 006 a la 008 de este archivo siguen en verde.

**Checkpoint**: UC-07 en su mitad del comprador: una compra pagada tiene salida, el cupo y el tope
vuelven y el código deja de servir.

---

## Phase 4: User Story 2 — Confirmar el reembolso (Priority: P1)

**Goal**: el organizador ve en "Compras del evento" las compras canceladas con reembolso pendiente
y su monto, y con "Confirmar reembolso" las pasa a `REEMBOLSADA` (autor él, sin plazo, sin tocar el
cupo); el comprador ve "Te devolvimos $ X".

**Independent Test**: con el seed, Lucía → "Mis eventos" → Maratón Ciudad 10K → "Ver compras": la
fila de Diego dice "La canceló el comprador · Reembolso pendiente de $ 30.000" con "Confirmar
reembolso"; la de Valentina, "Reembolso confirmado" sin botón; confirmar el de Diego → "Reembolsada";
Diego → "Mis compras" → "Te devolvimos $ 30.000"; Diego no puede confirmarlo (`403`); el cupo de
Inscripción sigue en 1000.

### Backend

- [ ] T012 [US2] Test en `backend/tests/domain/compra.test.ts` (se amplía) con el stub de `confirmarReembolso(organizadorId: string, ahora: Date): Compra` en `backend/src/domain/compra.ts`. Casos (R5, FR-011, FR-012): una `CANCELADA` paga desde confirmada → `REEMBOLSADA` con el cambio `{ REEMBOLSADA, autor: { tipo: "usuario", usuarioId: organizador }, fechaHora: ahora }` como último; las entradas **no** cambian (siguen con su único cambio `CANCELADA`); `canceladaDesde` sigue `"CONFIRMADA"` y `cambioDeCancelacion` sigue siendo el del comprador; sin plazo (no recibe la fecha del evento); una `REEMBOLSADA` → `TRANSICION_INVALIDA` "El reembolso de esta compra ya se confirmó."; `PENDIENTE`, `CONFIRMADA`, `UTILIZADA`, una pendiente cancelada, una vencida y una gratis cancelada desde confirmada → `TRANSICION_INVALIDA` "Esta compra no tiene un reembolso pendiente."; ningún rechazo cambia la instancia. Luego implementarlo.
- [ ] T013 [US2] Test en `backend/tests/services/compra.service.test.ts` (se amplía) con el stub de `confirmarReembolso(compraId: string, usuarioId: string): Promise<CompraDelEventoVista>` en `backend/src/services/compra.service.ts`. Reloj fijo y movible, repositorios espiados. Casos (R5, FR-011 a FR-014): el organizador → la `CompraDelEventoVista` `REEMBOLSADA` con `comprador`, `canceladaPor: "usuario"`, `canceladaDesde: "CONFIRMADA"`, `reembolso: { "confirmado", total }` y **sin** códigos; el cambio guardado tiene al organizador y la hora del reloj leída dentro del cerrojo; **un solo** `guardar` de compras y **ninguno** de eventos en el caso base (sin pendientes vencidas que materializar); el cupo no cambia; con el evento ya realizado (reloj después del inicio) también se acepta (US2-8); orden: compra inexistente → `NoEncontradoError` `COMPRA_NO_ENCONTRADA` → otro usuario, **también el comprador** → `SinPermisoError` "Solo el organizador puede modificar este evento." (de `obtenerDelOrganizador`) → los `409` del dominio; toma `cerrojo.ejecutar(eventoId, …)` una vez y lo libera también ante error; los vencimientos pendientes del evento quedan materializados. Luego implementarlo: `obtenerOFallar` afuera → cerrojo → `ahora` → `eventoService.obtenerDelOrganizador(eventoId, usuarioId, ahora)` → relee la compra → `confirmarReembolso(usuarioId, ahora)` → `guardar` → `usuarioService.obtenerOFallar(compradorId)` → `aCompraDelEventoVista`.
- [ ] T014 [US2] Seed (R11): en `backend/src/seed/datos-ejemplo.ts`, en "Maratón Ciudad 10K" (Lucía, tipo Inscripción $ 30.000) sumar `compra-diego-maraton-inscripcion` (Diego, 1, $ 30.000: `PENDIENTE` hace 3 días → `CONFIRMADA` +5 min → `CANCELADA` por Diego hace 1 día; entrada `MZDF1C01` con su cambio `CANCELADA`) y `compra-valentina-maraton-inscripcion` (Valentina, 2, $ 60.000: `PENDIENTE` hace 4 días → `CONFIRMADA` +5 min → `CANCELADA` por Valentina hace 2 días → `REEMBOLSADA` por Lucía hace 1 día; entradas `MZVG2R01` y `MZVG2R02`, cada una con su cambio `CANCELADA`). El cupo de Inscripción **sigue en 1000**; las demás compras no cambian. Tests: `backend/tests/domain/datos-ejemplo.test.ts` (las dos compras existen con su estado, `tieneReembolsoPendiente` en la de Diego, los códigos siguen siendo válidos y distintos entre todas las compras, el cupo del Maratón en 1000) y `backend/tests/repositories/repositorios-de-ejemplo.test.ts`; ajustar los conteos de compras del seed que cambien en esos tests, en `backend/tests/api/` y en mobile si alguno los usa.
- [ ] T015 [US2] Test en `backend/tests/api/compras.test.ts` (se amplía) de `POST /api/compras/:compraId/reembolso` con los stubs de `confirmarReembolso` en `backend/src/controllers/compra.controller.ts` y la ruta en `backend/src/routes/compras.routes.ts` (`requerirUsuario`, la validación de `params.compraId` que ya usan `pago` y `cancelacion`). Casos con el seed (contracts/api.md): sin header → `401 USUARIO_NO_IDENTIFICADO`; `compraId` inválido → `400 ENTRADA_INVALIDA` en `params.compraId`; `no-existe` → `404 COMPRA_NO_ENCONTRADA`; Diego sobre la suya → `403 SIN_PERMISO`; Lucía sobre `compra-diego-maraton-inscripcion` → `200` con la forma del ejemplo y, después, `GET /api/eventos/evento-maraton-10k/compras` la muestra `REEMBOLSADA` y el cupo sigue en 1000; repetir → `409 TRANSICION_INVALIDA` "El reembolso de esta compra ya se confirmó."; Valentina (ya reembolsada) → el mismo `409`; `compra-diego-festival-general` (vencida) → `409` "Esta compra no tiene un reembolso pendiente."; un cuerpo, si llega, se ignora. Antes del reembolso, `GET …/maraton-10k/compras` (Lucía) trae Diego `CANCELADA` con `reembolso { "pendiente", 30000 }` y Valentina `REEMBOLSADA` con `{ "confirmado", 60000 }`, e Inscripción con 1000 disponibles y 0 vendidas. Luego implementar controller y ruta.
- [ ] T016 [US2] En `backend/src/docs/openapi.json`, sumar `POST /compras/{compraId}/reembolso` con `200 CompraDelEventoVista` y sus errores (`401`, `400`, `404 COMPRA_NO_ENCONTRADA`, `403 SIN_PERMISO`, `409 TRANSICION_INVALIDA`); en la colección de Postman, dentro de "Cancelar compra (009)", "Confirmar reembolso (Lucía, Maratón, Diego)", "Confirmar reembolso ya confirmado (Valentina) → 409" y "Confirmar reembolso como comprador (Diego) → 403". `backend/tests/api/docs.test.ts` en verde (cubre la ruta nueva).

### Mobile

- [ ] T017 [P] [US2] Test en `mobile/tests/api/compras.test.ts` (se amplía) con el stub de `confirmarReembolso(cliente, compraId, { usuarioId })` en `mobile/src/api/compras.ts` (exportado por `mobile/src/api/index.ts`). Casos: `POST /compras/:compraId/reembolso` **sin cuerpo**, con `X-Usuario-Id` y el id por `encodeURIComponent`; devuelve la `CompraDelEventoVista`; un `409` llega como `ErrorDeApi` con su `mensaje`. Luego implementarlo (una línea con `cliente.post`).
- [ ] T018 [P] [US2] Test en `mobile/tests/features/compras/formato.test.ts` (se amplía) con los stubs de `textoReembolsada(compra)` y `textoConfirmarReembolso(compra)` y las ampliaciones de `textoAvisoDeMiCompra` y `textoAvisoDeCompraDelEvento` en `mobile/src/features/compras/formato.ts`. Casos (contracts/app.md, "Textos"): `textoReembolsada` → "Te devolvimos $ 240.000"; `textoConfirmarReembolso` → "Confirmás que le devolviste $ 240.000. No se puede deshacer."; `textoAvisoDeMiCompra`: `CANCELADA` + `reembolso.pendiente` → "El organizador tiene que confirmar el reembolso de $ 240.000"; `CANCELADA` desde `CONFIRMADA` gratis → "Cancelaste esta compra"; `REEMBOLSADA` → "Te devolvimos $ 240.000"; los de la 007/008 ("Venció sin pagarse", "La cancelaste", usadas, días restantes) sin cambios; `textoAvisoDeCompraDelEvento`: `CANCELADA` + `reembolso.pendiente` → "La canceló el comprador · Reembolso pendiente de $ 240.000"; `CANCELADA` desde `CONFIRMADA` gratis (sin reembolso) → "La canceló el comprador" (caso nuevo, mismo texto que una pendiente cancelada); `REEMBOLSADA` → "Reembolso confirmado"; los de la 008 sin cambios. Luego implementarlos.
- [ ] T019 [US2] Test en `mobile/tests/pantallas/compras-del-evento.test.tsx` (se amplía) con el stub de `useConfirmarReembolso(usuarioId: string, eventoId: string)` en `mobile/src/features/compras/mutaciones.ts` (variable `compraId`). Fixtures en `mobile/tests/helpers/compras.ts` (una `CANCELADA` con reembolso pendiente y una `REEMBOLSADA`). Casos (contracts/app.md, "Compras del evento"):
  - **"Confirmar reembolso"** (variante `aviso`) **solo** en las filas con `reembolso?.estado === "pendiente"`; ninguna en la `REEMBOLSADA`, la pendiente cancelada, la vencida ni la gratis cancelada; las filas muestran el aviso de `textoAvisoDeCompraDelEvento` y su `accessibilityLabel` lo suma;
  - el botón es **hermano** del bloque accesible de la fila (que sigue sin ser tocable): se encuentra por su rol y texto fuera de ese bloque;
  - tocarlo abre `Alert.alert` con el título "¿Confirmar el reembolso a Diego Fernández?", el mensaje de `textoConfirmarReembolso` y los botones "Volver" y "Confirmar reembolso"; "Volver" no manda nada; confirmar hace **un** `POST /compras/:id/reembolso` sin cuerpo; un doble toque manda **un** pedido (marca sincrónica en la pantalla) y el botón de esa fila queda en curso (`isPending && variables === compra.id`);
  - al terminar, se vuelve a pedir `GET …/compras` y la fila releída dice "Reembolso confirmado", sin botón;
  - un `403` o `409` muestra su `mensaje` con `AvisoDeFormulario` **en esa fila**; sin servidor → "No se pudo confirmar el reembolso. Probá de nuevo."; un 404 del evento sigue saliendo a "Mis eventos" (008);
  - al terminar (éxito o error) se invalidan `comprasDelEvento(usuarioId, eventoId)` y, por prefijo, `["entrada-del-evento"]`, `["compra"]`, `["mis-compras"]` y `["mis-compras-del-evento"]`; **no** el evento ni el catálogo (R10).
  Luego implementar: la mutation (sin reintentos, `onSettled` con esas invalidaciones), en `mobile/src/features/compras/pantallas/ComprasDelEvento.tsx` **una** `useConfirmarReembolso` que se pasa a las filas (`alConfirmarReembolso(compraId)`, `enCurso`, error por fila) y en `mobile/src/features/compras/componentes/FilaCompraDelEvento.tsx` el botón y el `AvisoDeFormulario` debajo del bloque.
- [ ] T020 [US2] Test en `mobile/tests/pantallas/compra.test.tsx` y `mobile/tests/pantallas/mis-compras.test.tsx` (se amplían). Casos (US2-4, US2-5, FR-019): "Tu compra" de una `REEMBOLSADA` → `EtiquetaEstadoCompra` "Reembolsada" con "Te devolvimos $ 60.000", sin "Tus entradas" ni botones de pago o cancelación, con "Volver al evento" (la `CANCELADA` con reembolso pendiente ya la cubre T011); "Mis compras": la fila de una `CANCELADA` con reembolso pendiente dice "El organizador tiene que confirmar el reembolso de $ X", la de una gratis cancelada desde confirmada "Cancelaste esta compra", la de una `REEMBOLSADA` "Te devolvimos $ X", distintas de "Venció sin pagarse" y "La cancelaste", siempre junto a la etiqueta. Luego implementar en `mobile/src/features/compras/pantallas/Compra.tsx` el caso `REEMBOLSADA` (aviso de `textoReembolsada`); `FilaMiCompra` ya usa `textoAvisoDeMiCompra` (T018).

**Checkpoint**: UC-07 completo: el ciclo `CONFIRMADA → CANCELADA → REEMBOLSADA` se recorre de punta
a punta y lo ven los dos lados.

---

## Phase 5: User Story 3 — Que no se pueda cancelar lo que ya no corresponde (Priority: P1)

**Goal**: el servidor rechaza, en el orden de FR-010 y sin cambiar nada, cancelar una compra cuyo
evento empezó (a la hora exacta, inclusive), con una entrada usada, ya cancelada o reembolsada, o
ajena; "Tu compra" muestra el motivo en lugar del botón.

**Independent Test**: reloj fijado a la hora exacta de inicio → `409 EVENTO_REALIZADO`; un minuto
antes → `200`; Martín → "Mis compras" → Peña → "Ya usaste una entrada" sin botón; cancelar una
`UTILIZADA`, `CANCELADA`, `REEMBOLSADA` o ajena → rechazo sin cambios.

- [ ] T021 [US3] Test en `backend/tests/domain/compra.test.ts` (se amplía): los rechazos de `cancelar` (FR-007, FR-008, FR-010, US3-1 a US3-4 y US3-7). Casos: `CONFIRMADA` **exactamente** en el inicio y 1 hora después → `EVENTO_REALIZADO` "El evento ya empezó: ya no se puede cancelar la compra."; `UTILIZADA` (1 de 3 usada) con el evento sin empezar **y** empezado → `TRANSICION_INVALIDA` "Ya se usó una entrada de esta compra: no se puede cancelar." (nunca `EVENTO_REALIZADO`); `CANCELADA` desde confirmada, pendiente cancelada y vencida materializada → "La compra ya está cancelada." (la pendiente vencida sin materializar sigue dando `COMPRA_VENCIDA`); `REEMBOLSADA` → "La compra ya fue reembolsada.", con el evento empezado o no; en todos, la instancia, sus entradas y su historial quedan iguales. Deberían pasar con T006; si no, corregir T006.
- [ ] T022 [US3] Test en `backend/tests/services/compra.service.test.ts` (se amplía): rechazos de `CompraService.cancelar` con repositorios espiados. Casos (FR-009, FR-010, SC-003): la compra inexistente → `404` antes que el permiso; el **organizador** del evento → `SinPermisoError` "Solo quien hizo la compra puede verla o pagarla." (también sobre una `CONFIRMADA` cancelable); `CONFIRMADA` con el reloj a la hora exacta de inicio → `EVENTO_REALIZADO` y 1 minuto antes → éxito; `UTILIZADA`, `CANCELADA` y `REEMBOLSADA` → `TRANSICION_INVALIDA`; en cada rechazo, **ningún** `guardar` de la compra (solo los de materializar vencimientos, si los hay) y el cupo del evento sin cambios; el cerrojo se libera también ante error. Deberían pasar con T006–T007.
- [ ] T023 [US3] Test en `backend/tests/api/compras.test.ts` (se amplía): la tabla de rechazos de `POST /compras/:compraId/cancelacion` de contracts/api.md con status, código y mensaje: sin header → `401`; id inválido → `400 ENTRADA_INVALIDA` en `params.compraId`; inexistente → `404`; `compra-sofia-pena-con-cena` como Lucía → `403 SIN_PERMISO`; con `crearApp({ reloj })` a la hora de inicio del Festival, la de Martín → `409 EVENTO_REALIZADO`; `compra-martin-pena-general` → `409 TRANSICION_INVALIDA` "Ya se usó una entrada…"; cancelar dos veces la del Festival → el segundo `409` "La compra ya está cancelada." y el cupo de VIP sigue en 50; `compra-valentina-maraton-inscripcion` como Valentina → `409` "La compra ya fue reembolsada."; `GET /compras/compra-martin-pena-general` como Martín → `cancelable: false`, `motivoNoCancelable: "entrada-usada"`, y la del Festival antes de cancelar → `cancelable: true`, `motivoNoCancelable: null`. Deberían pasar con lo anterior. En la colección de Postman, "Cancelar compra utilizada (Martín, Peña) → 409".
- [ ] T024 [P] [US3] Test en `mobile/tests/features/compras/formato.test.ts` (se amplía) con el stub de `textoMotivoNoCancelable(motivo: MotivoNoCancelable | null): string | null` en `mobile/src/features/compras/formato.ts`. Casos: `"evento-empezado"` → "El evento ya empezó"; `"entrada-usada"` → "Ya usaste una entrada"; `"cancelada"`, `"reembolsada"` y `null` → `null`. Luego implementarlo.
- [ ] T025 [US3] Test en `mobile/tests/pantallas/compra.test.tsx` y `mobile/tests/pantallas/mis-compras.test.tsx` (se amplían). Casos (FR-017, US3-6, SC-007): "Tu compra" de una `CONFIRMADA` con `cancelable: false` y `motivoNoCancelable: "evento-empezado"` → "El evento ya empezó" como texto **en lugar** del botón (no hay "Cancelar compra"); de una `UTILIZADA` → "Ya usaste una entrada", con "Tus entradas" y "N de M entradas usadas" como en la 008; la app **no** mira la fecha del evento: una `CONFIRMADA` con `cancelable: true` y una fecha pasada en el fixture sigue mostrando el botón; tras un `409 EVENTO_REALIZADO` al cancelar, la compra releída (no cancelable) muestra el motivo en lugar del botón; "Mis compras": **ninguna** fila tiene "Cancelar" (ni pendiente, ni confirmada, ni utilizada). Luego implementar el motivo en la sección `Cancelacion` de `mobile/src/features/compras/pantallas/Compra.tsx`.

**Checkpoint**: UC-08: ninguna cancelación fuera de regla pasa, y el comprador ve por qué.

---

## Phase 6: User Story 4 — Operaciones que compiten (Priority: P2)

**Goal**: uso ‖ cancelación, dos cancelaciones, dos reembolsos y cancelación ‖ compra nueva se
serializan en el cerrojo del evento: se aplica exactamente lo que corresponde y el cupo es coherente.

**Independent Test**: reloj dentro de la ventana y antes del inicio; N repeticiones de uso y
cancelación simultáneos de la misma compra → siempre una sola gana, historial y cupo coherentes.

- [ ] T026 [US4] Test en `backend/tests/services/concurrencia-compras.test.ts` (se amplía), con reloj fijo dentro de la ventana de uso y antes del inicio. Casos (US4, FR-014, SC-005):
  - uso de una entrada ‖ cancelación de su compra `CONFIRMADA`, repetido N (20) veces con compras nuevas y alternando el orden de lanzamiento: **exactamente uno** resuelve; si ganó el uso, la cancelación da `TRANSICION_INVALIDA` "Ya se usó una entrada…" y la compra queda `UTILIZADA` con el cupo sin devolver; si ganó la cancelación, el uso da `TRANSICION_INVALIDA` "La compra de esta entrada está cancelada.", la compra queda `CANCELADA` con un único cambio nuevo y el cupo devuelto una vez; nunca conviven entradas usadas y canceladas (el constructor lo impediría);
  - N (10) cancelaciones simultáneas de la misma `CONFIRMADA` → una `200` y las demás `TRANSICION_INVALIDA` "La compra ya está cancelada."; el cupo sube `cantidad` **una** vez y el historial suma **un** `CANCELADA`;
  - N (10) `confirmarReembolso` simultáneos → uno resuelve y los demás `TRANSICION_INVALIDA` "El reembolso de esta compra ya se confirmó."; **un** `REEMBOLSADA`;
  - cancelación ‖ compra nueva del mismo tipo con cupo justo: el cupo final es inicial − comprado + devuelto, nunca negativo ni de más (la compra nueva puede rechazarse por cupo si llegó primero, y aceptarse si llegó después);
  - el evento que empieza entre la lectura y la cancelación (US4-4): con el reloj movido a la hora de inicio **justo antes** de `cancelar`, se rechaza con `EVENTO_REALIZADO` (el reloj se lee dentro del cerrojo).
  Debería pasar con lo anterior; si no, corregir `backend/src/services/compra.service.ts` (y la `EntradaService` de la 008 solo si el uso no relee la compra adentro).

**Checkpoint**: la regla "una `UTILIZADA` no se cancela y una entrada cancelada no se usa" se
sostiene también con pedidos simultáneos.

---

## Phase 7: User Story 5 — Ver el resultado en todas las pantallas (Priority: P2)

**Goal**: después de cancelar o reembolsar, comprador y organizador ven el estado real en todas sus
pantallas, también en el mismo dispositivo con otro usuario, ante una respuesta perdida o el
servidor caído, y nunca con datos del usuario anterior.

**Independent Test**: cancelar una compra y recorrer "Tu compra", "Mis compras", el detalle, el
catálogo y, como Lucía en el mismo dispositivo, "Compras del evento" y "Registrar ingreso": todos
muestran el estado y el cupo nuevos; simular la respuesta perdida y el servidor caído.

- [ ] T027 [US5] Test en `mobile/tests/pantallas/compra.test.tsx` (se amplía) para `useCancelarCompra(usuarioId, compraId, eventoId)` en `mobile/src/features/compras/mutaciones.ts`. Casos (FR-021, FR-022, US5-3 a US5-5, R10): al terminar la cancelación de una confirmada (éxito **o** error) se invalidan, además de lo de la 006 (la compra, `misComprasDelEvento`, `misCompras`, el evento para todos los usuarios y `["catalogo"]`), **por prefijo** `["compras-del-evento"]` y `["entrada-del-evento"]` (sembrar en el `QueryClient` una consulta de Lucía de cada una y verificar que queda `isInvalidated`); con éxito, la respuesta se escribe en `claves.compra(usuarioId, compraId)`; **respuesta perdida** (el `fetch` falso falla después de aplicar el cambio en el "servidor"): la pantalla muestra el error y, al releer, el estado real `CANCELADA`; la escritura **no** se reintenta sola (un solo `POST`). Luego implementar las invalidaciones nuevas en `onSettled`.
- [ ] T028 [US5] Test en `mobile/tests/pantallas/compras-del-evento.test.tsx` y `mobile/tests/pantallas/mis-compras.test.tsx` (se amplían). Casos (US5-1, US5-2, US5-7): "Compras del evento" con una compra cancelada desde confirmada la muestra con su estado, "La canceló el comprador" y el reembolso, y el resumen por tipo con las entradas fuera de "vendidas" (tal como lo manda el servidor); tras confirmar un reembolso con la respuesta perdida, la relectura muestra la fila real; con la lista de Lucía cargada, cambiar de usuario desde Perfil → nunca se ven sus compras ni el botón "Confirmar reembolso", y los pedidos llevan el `X-Usuario-Id` nuevo; "Mis compras" vuelve a pedirse al volver de "Tu compra" después de cancelar (foco de la 007) y muestra el aviso nuevo. Deberían pasar con T019 y T027; si no, corregir la tarea que corresponde.

**Checkpoint**: ninguna pantalla engaña después de cancelar o reembolsar, ni mezcla usuarios.

---

## Phase 8: Polish y transversales

**Purpose**: documentación, accesibilidad, validación de punta a punta y cierre.

- [ ] T029 [P] Actualizar `AGENTS.md`: en el recurso `compras`, `POST /compras/:compraId/cancelacion` también para una `CONFIRMADA` (antes del inicio, sin entradas usadas; orden de rechazos con `EVENTO_REALIZADO` solo en `CONFIRMADA`) y el nuevo `POST /compras/:compraId/reembolso` (solo el organizador, bajo el cerrojo, `obtenerDelOrganizador`, un `guardar`, responde `CompraDelEventoVista`, sin plazo); en "Compras", `cancelar(usuarioId, ahora, inicioDelEvento)`, `motivoNoCancelable`, `confirmarReembolso` y lo derivado del historial (`fueConfirmada`, `canceladaDesde`, `cambioDeCancelacion`, `tieneReembolsoPendiente`: `CANCELADA` ∧ pasó por `CONFIRMADA` ∧ `total > 0`); en "Entradas y uso", el cambio propio `CANCELADA` de cada entrada al cancelar una confirmada (`Entrada.cancelar`, `estadoEn`, `entradasCoherentes`); las vistas con `canceladaDesde`, `reembolso`, `cancelable`/`motivoNoCancelable` y `canceladaPor` también en `REEMBOLSADA`; el seed del Maratón (Diego con reembolso pendiente, Valentina `REEMBOLSADA`); en mobile, `confirmarReembolso` en `src/api`, `useConfirmarReembolso` y las invalidaciones nuevas de `useCancelarCompra`, la sección de cancelación de "Tu compra" y "Confirmar reembolso" como hermano de la fila en "Compras del evento".
- [ ] T030 Revisar en 360 px y con TalkBack "Tu compra" (botón "Cancelar compra", motivo y avisos), "Mis compras" y "Compras del evento" ("Confirmar reembolso"): sin desplazamiento horizontal; textos largos (avisos con montos, nombres de comprador) que se parten con `flexShrink: 1`, sin anchos fijos; el motivo y los avisos leídos como texto; "Confirmar reembolso" enfocable aparte del bloque de la fila; sin valores sueltos fuera del `tema` ni `fontWeight` (FR-023). Ajustar en `mobile/src/features/compras/` lo que haga falta y anotar la revisión debajo de esta tarea.
- [ ] T031 Correr `npm test`, `npm run lint`, `npm run typecheck` y `npm run format:check` desde la raíz y dejar las cuatro en verde (incluidos todos los tests de la 004 a la 008).
- [ ] T032 Validar a mano las secciones "Pedidos directos" (los 15 pedidos) y "Recorrido en la app" (los 7 pasos) de `specs/009-cancelar-compra/quickstart.md` y anotar cualquier desvío debajo de esta tarea.
- [ ] T033 En `docs/backlog.md`, pasar la 009 a `en PR`, y abrir el PR de `feature/009-cancelar-compra` a `development` con las cuatro verificaciones del CI en verde.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T001 ya está hecho; T003 (tipos nuevos) lo usan T004 y T005.
- **Foundational (Phase 2)**: depende de Setup. T005 depende de T004 (usa `motivoNoCancelable`,
  `canceladaDesde`, `cambioDeCancelacion`, `tieneReembolsoPendiente`). **Bloquea todas las
  historias**.
- **US1 (Phase 3)**: depende de Foundational. T007 y T008 dependen de T006; T009 de T008; T011 de
  T010.
- **US2 (Phase 4)**: el backend depende de Foundational (T012 arma la `CANCELADA` por constructor),
  pero T015 usa el seed de T014; T013 depende de T012; T016 de T015. Su mobile depende de T017 y
  T018; T020 depende de T018. Para recorrer el ciclo entero en la app hace falta la US1.
- **US3 (Phase 5)**: depende de US1 (T006 ya implementa los rechazos; T021–T023 son tests de
  contrato) y, para los casos de `REEMBOLSADA` del api, del seed de T014. T025 depende de T011 y T024.
- **US4 (Phase 6)**: depende de US1 y US2 (cancela confirmadas y confirma reembolsos) y del uso de
  la 008.
- **US5 (Phase 7)**: depende de US1 (T027) y US2 (T028).
- **Polish (Phase 8)**: depende de las historias que se quieran entregar.

### Within Each User Story

- Test con stub → verlo fallar → implementar.
- Dominio → service → controller y ruta → OpenAPI y Postman.
- `src/api/` → `formato.ts` → mutation → componente → pantalla.
- Las tareas sobre el mismo archivo son secuenciales: `domain/compra.test.ts` (T004, T006, T012,
  T021), `compra.service.test.ts` (T005, T007, T013, T022), `api/compras.test.ts` del backend (T008,
  T015, T023), `openapi.json` y la colección de Postman (T009, T016, T023), `formato.ts` y
  `formato.test.ts` (T010, T018, T024), `Compra.tsx` y `compra.test.tsx` (T011, T020, T025, T027),
  `compras-del-evento.test.tsx` (T019, T028), `mis-compras.test.tsx` (T020, T025, T028),
  `mutaciones.ts` (T019, T027).
- T007, T008, T021, T022, T023, T026 y T028 son tests de contrato sobre lo ya implementado: pueden
  pasar de entrada. No se fuerza un rojo artificial; si fallan, se corrige la tarea que corresponde.

### Parallel Opportunities

- **Phase 1**: T002 y T003.
- **US1**: T010 (formato) en paralelo con T006–T009 (backend).
- **US2**: T017 (API mobile) y T018 (formato) en paralelo con T012–T016 (backend); T014 (seed) en
  paralelo con T012–T013.
- **US3**: T024 (formato) en paralelo con T021–T023 (backend).
- **Polish**: T029 en paralelo con T030.

---

## Parallel Example: User Story 1

```text
Task: "T006 Test de cancelar una CONFIRMADA en backend/tests/domain/compra.test.ts"
Task: "T010 Test de textoConfirmarCancelacion/textoCancelada en mobile/tests/features/compras/formato.test.ts"
```

## Parallel Example: User Story 2

```text
Task: "T012 Test de confirmarReembolso en backend/tests/domain/compra.test.ts"
Task: "T014 Seed del Maratón en backend/src/seed/datos-ejemplo.ts"
Task: "T017 Test de confirmarReembolso en mobile/tests/api/compras.test.ts"
Task: "T018 Test de los textos del reembolso en mobile/tests/features/compras/formato.test.ts"
```

---

## Implementation Strategy

### MVP primero (US1)

1. Phase 1 y Phase 2 completas (cada una con `/speckit-implement fase N` y `/clear` entre fases).
2. Phase 3 (US1): **Validar**: Martín cancela la del Festival desde "Tu compra" (2 toques), VIP
   vuelve a 50, el tope se libera y el código de una entrada cancelada no sirve en "Registrar
   ingreso".
3. Las cuatro verificaciones en verde. El reembolso queda "pendiente" para siempre hasta la US2: si
   se entrega solo el MVP, decirlo en el PR.

### Entrega incremental

1. MVP (US1).
2. US2: confirmar el reembolso y el seed del Maratón: UC-07 completo.
3. US3: los rechazos de UC-08 probados en cada capa y el motivo en "Tu compra".
4. US4: concurrencia.
5. US5: invalidaciones entre usuarios, respuesta perdida y cambio de usuario.
6. Polish y PR.

---

## Notes

- [P] = archivo distinto y sin dependencias pendientes.
- Cada historia es verificable sola en su checkpoint.
- Si una tarea obliga a decidir algo que el plan o la spec no cubren, se frena y se consulta (no
  se inventa la regla).
- Hasta la US3, una `CONFIRMADA` no cancelable o una `UTILIZADA` en "Tu compra" no muestran ni el
  botón ni el motivo (la sección `Cancelacion` de T011 solo dibuja el botón si `cancelable`).
- El caso `REEMBOLSADA` de `motivoNoUsable` (dominio) y de `textoMotivoNoUsable` (app) queda
  inalcanzable por R3; se conserva por exhaustividad del `switch` sobre `EstadoCompra`.
