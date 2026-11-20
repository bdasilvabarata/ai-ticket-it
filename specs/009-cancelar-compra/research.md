# Research: Cancelar compra con reembolso

Decisiones de diseño de la 009. La spec no deja `NEEDS CLARIFICATION`: las cinco clarificaciones
(reembolso confirmado por el organizador sin plazo, las gratis no se reembolsan, `EVENTO_REALIZADO`
para el evento empezado, `TRANSICION_INVALIDA` para los demás estados y la lista de entradas que
desaparece) ya están en la spec. No hay dependencias nuevas ni tecnología que investigar: todo se
resuelve con las piezas de la 006 a la 008.

## R1. `Compra.cancelar` acepta también una `CONFIRMADA`

**Decision**: la misma operación de la 006 (`cancelar(usuarioId, ahora, inicioDelEvento)`) decide
según el estado de la compra **al día**:

1. Vencida (`estaVencida(ahora)` o `fueVencida()`) → `COMPRA_VENCIDA` (como en la 006).
2. `PENDIENTE` → `CANCELADA` por el comprador, sin reembolso (como en la 006; también con el evento
   empezado).
3. `CONFIRMADA` y `ahora >= inicioDelEvento` → `EVENTO_REALIZADO`, "El evento ya empezó: ya no se
   puede cancelar la compra".
4. `CONFIRMADA` antes del inicio → `CANCELADA` por el comprador en `ahora`, y **cada entrada** suma
   su cambio propio a `CANCELADA` (R3).
5. `UTILIZADA`, `CANCELADA` o `REEMBOLSADA` → `TRANSICION_INVALIDA` con un mensaje por estado
   (R5), empiece o no el evento.

Los pasos 3 y 5 salen de `motivoNoCancelable(inicioDelEvento, ahora)` (R6): la misma función decide
el rechazo y lo que informa la vista, así nunca se contradicen.

**Rationale**: la spec pide reusar `POST /compras/:compraId/cancelacion` (Assumptions) y el orden de
FR-010. Pasar `inicioDelEvento` como dato deja `domain/` puro (recibe `ahora` y fechas, no al
`Evento`), igual que `diasRestantes(fechaHoraEvento, ahora)`. "Empezó" es `ahora >= fechaHora`, la
misma comparación que `Evento.estaRealizado` (inclusive en la hora exacta).

**Alternatives considered**: un método aparte `cancelarConfirmada` — dos puntos de entrada para la
misma acción del comprador y el service tendría que elegir cuál llamar mirando el estado (la regla
saldría del dominio). Recibir el `Evento` — acopla `Compra` a otro agregado por un solo dato.

## R2. El servicio: el mismo `CompraService.cancelar`

**Decision**: `CompraService.cancelar` no cambia de forma: lee la compra afuera para saber qué
cerrojo tomar; bajo el cerrojo de su evento lee `ahora`, materializa con `obtenerAlDia(eventoId,
ahora)`, relee la compra, 403 si no es suya y llama a `compra.cancelar(usuarioId, ahora,
evento.fechaHora)`. Guarda **primero la compra** y después el evento con `devolverCupo` (exactamente
`cantidad`, una sola vez). La respuesta es la `CompraVista` con su `reembolso` y su
`cancelable: false`.

Orden de rechazos resultante (US3, escenario 7): 401 (middleware) → 400 (`compraPorId`) → 404
`COMPRA_NO_ENCONTRADA` (afuera) → 403 `SIN_PERMISO` (adentro, también para el organizador) → 409
`COMPRA_VENCIDA` (solo pendientes vencidas) → 409 `EVENTO_REALIZADO` (solo `CONFIRMADA`) → 409
`TRANSICION_INVALIDA`.

**Rationale**: es la operación de la 006; solo cambia la regla del dominio. El tope por persona no
necesita código: `esVigente` ya excluye `CANCELADA` y `REEMBOLSADA` (FR-004). El resumen por tipo
de "Compras del evento" tampoco: `vendidas` cuenta solo `CONFIRMADA`/`UTILIZADA` y `disponibles` es
el cupo devuelto.

## R3. Las entradas de una confirmada cancelada: un cambio propio a `CANCELADA` cada una

**Decision**: al cancelar una `CONFIRMADA`, cada `Entrada` suma su cambio
`{ estado: CANCELADA, autor: comprador, fechaHora: ahora }` (`Entrada.cancelar(compradorId, ahora)`).
`Entrada.estadoEn(compra)` pasa a ser: si la compra **nunca llegó a `CONFIRMADA`**, el estado de la
compra (derivado, como hasta ahora); si llegó, el de su último cambio propio o `CONFIRMADA`. El
reembolso no toca las entradas: en una `REEMBOLSADA` siguen `CANCELADA` (Key Entities: "el
reembolso no la cambia").

La invariante de entradas (`usoCoherente`) se amplía a **entradas coherentes**: con la compra
`CONFIRMADA`, ninguna usada ni cancelada; `UTILIZADA`, alguna usada y ninguna cancelada;
`CANCELADA` o `REEMBOLSADA` después de confirmada, todas con un único cambio propio, `CANCELADA`.

**Rationale**: la constitución ("Estado de una entrada") dice que el estado se deriva **hasta que
la compra se confirma** y que desde `CONFIRMADA` cada entrada cambia por separado con su propio
cambio (quién y cuándo). Registrar el cambio cumple eso sin enmienda. Además, resuelve solo que una
entrada de una `REEMBOLSADA` se vea `CANCELADA` (sin un caso especial) y que "Registrar ingreso"
responda "La compra de esta entrada está cancelada" con o sin reembolso confirmado (US1, escenario
6). Como una `UTILIZADA` no se cancela, nunca conviven entradas usadas y canceladas.

**Alternatives considered**: seguir derivando (la entrada toma el estado de la compra en
`CANCELADA`/`REEMBOLSADA`, sin guardar nada) — menos código, pero contradice la constitución
después de la confirmación y obliga a mapear `REEMBOLSADA → CANCELADA` a mano en `estadoEn`.

Consecuencia: el caso `REEMBOLSADA` de `motivoNoUsable` (dominio) y de `textoMotivoNoUsable` (app)
queda inalcanzable; se conserva por exhaustividad del `switch` sobre `EstadoCompra`.

## R4. El reembolso pendiente se deriva del historial

**Decision**: sin campo nuevo. `Compra.tieneReembolsoPendiente()` ⇔ estado `CANCELADA` **y** el
historial tiene un `CONFIRMADA` **y** `total > 0`. `Compra.canceladaDesde` (`PENDIENTE` |
`CONFIRMADA` | `null`) es `CONFIRMADA` si la compra está `CANCELADA` o `REEMBOLSADA` y su historial
pasó por `CONFIRMADA`, `PENDIENTE` si está `CANCELADA` sin haberse confirmado y `null` en otro
estado. El monto es siempre `total` (FR-005).

La invariante de historial suma: un `REEMBOLSADA` solo puede seguir a un `CANCELADA` de una compra
que pasó por `CONFIRMADA` y con `total > 0`, y es el último cambio (estado final).

**Rationale**: lo pidió la invocación del plan y la regla es exactamente "venía de `CONFIRMADA`, es
paga y no se confirmó" (Key Entities). Un booleano guardado podría desincronizarse del historial;
derivarlo no. Una pendiente cancelada o vencida nunca pasó por `CONFIRMADA` (FR-006), y una gratis
tiene `total === 0`.

**Alternatives considered**: `reembolsoPendiente: boolean` en `PropiedadesCompra` — redundante con
el historial y con una invariante más que mantener. Un estado nuevo (`REEMBOLSO_PENDIENTE`) — la
constitución fija los cinco estados.

## R5. Confirmar el reembolso: `POST /compras/:compraId/reembolso` en `CompraService`

**Decision**:

- **Dominio**: `Compra.confirmarReembolso(organizadorId, ahora)`: si `tieneReembolsoPendiente()`,
  suma `{ estado: REEMBOLSADA, autor: organizador, fechaHora: ahora }`; si no,
  `TRANSICION_INVALIDA` con "El reembolso de esta compra ya se confirmó." (si ya está
  `REEMBOLSADA`) o "Esta compra no tiene un reembolso pendiente." (cualquier otro caso). Sin plazo:
  no recibe la fecha del evento (FR-012). No toca entradas.
- **Service**: `CompraService.confirmarReembolso(compraId, usuarioId)` (Compra es su agregado):
  `obtenerOFallar` afuera (404, y el `eventoId` para el cerrojo) → bajo el cerrojo del evento:
  `ahora` → `eventoService.obtenerDelOrganizador(eventoId, usuarioId, ahora)` (403, y materializa
  los vencimientos como toda escritura) → relee la compra → `confirmarReembolso` → **un** `guardar`
  de la compra → la `CompraDelEventoVista` (con el comprador por `usuarioService.obtenerOFallar`).
  El cupo no cambia: no llama a `TipoEntradaService`.
- **API**: `POST /api/compras/:compraId/reembolso`, sin cuerpo, `200` con `CompraDelEventoVista`.
  Orden: 401 → 400 → 404 `COMPRA_NO_ENCONTRADA` → 403 `SIN_PERMISO` → 409 `TRANSICION_INVALIDA`
  (FR-013).

**Rationale**: el sustantivo como sub-recurso sigue el patrón de `/pago`, `/cancelacion` y `/uso`
(una acción con efecto, un `POST` sin cuerpo). Va en `compras.routes.ts` porque se identifica por la
compra, como el pago. La respuesta es la fila del organizador (no `CompraVista`, que es del
comprador: trae `compradorId`, historial y es la que lleva códigos). Tomar el cerrojo del evento
cumple FR-014 y la constitución ("todo cambio de estado de una compra"): dos confirmaciones
simultáneas se serializan y la segunda ve `REEMBOLSADA` → 409. `obtenerDelOrganizador` ya da el
403 (con su mensaje "Solo el organizador puede modificar este evento.") y la materialización, como
en `EntradaService.registrarUso`; con el evento realizado no rechaza nada (no chequea
`EVENTO_REALIZADO`), así que el reembolso no tiene plazo (US2, escenario 8).

**Alternatives considered**: `POST /eventos/:eventoId/compras/:compraId/reembolso` — duplica el
`eventoId` (la compra ya lo sabe) y suma un 404 de evento al orden. Un `ReembolsoService` aparte —
escribiría el mismo agregado que `CompraService` sin otra dependencia que justifique separarlo.
`PATCH /compras/:id { estado: "REEMBOLSADA" }` — expone el estado como dato editable.

## R6. Si se puede cancelar: el servidor lo informa en `CompraVista`

**Decision**: `Compra.motivoNoCancelable(inicioDelEvento, ahora)` devuelve `null` o un
`MotivoNoCancelable`:

| Estado (al día) | Motivo |
|---|---|
| `PENDIENTE` | `null` (se cancela como en la 006) |
| `CONFIRMADA`, antes del inicio | `null` |
| `CONFIRMADA`, desde el inicio | `"evento-empezado"` |
| `UTILIZADA` (empiece o no el evento) | `"entrada-usada"` |
| `CANCELADA` | `"cancelada"` |
| `REEMBOLSADA` | `"reembolsada"` |

`CompraVista` suma `cancelable: boolean` (`motivo === null`) y `motivoNoCancelable`. Se calcula en
cada lectura con el reloj del servidor, sin guardar (FR-015). La app traduce el código a su texto
("El evento ya empezó", "Ya usaste una entrada"); no decide la regla (SC-007).

**Rationale**: mismo patrón que `VentanaDeUsoVista.estado` (008): el servidor decide, la app
formatea. Un código estable en minúsculas como `"antes" | "abierta" | "despues"` y `canceladaPor`.
`MiCompraVista` lo omite (en "Mis compras" no hay botón, FR-017); `MisComprasDelEventoVista` lo
recibe gratis porque usa `CompraVista`.

**Alternatives considered**: mandar el texto del motivo — los textos de pantalla viven en la app
(`formato.ts`), como en la 008. Solo un booleano — la app no podría mostrar el porqué sin
calcularlo.

## R7. Qué suman las vistas compartidas

**Decision** (`shared/src/compra.ts`, todo aditivo):

- `ReembolsoVista = { estado: "pendiente" | "confirmado"; monto: number }`.
- `MotivoNoCancelable = "evento-empezado" | "entrada-usada" | "cancelada" | "reembolsada"`.
- Datos comunes (`CompraVista` y `MiCompraVista`) y `CompraDelEventoVista` suman:
  - `canceladaDesde: "PENDIENTE" | "CONFIRMADA" | null` (R4): distingue una cancelada después de
    confirmada de una pendiente vencida o cancelada sin pagar (FR-016), también en las gratis.
  - `reembolso: ReembolsoVista | null`: `pendiente` en una `CANCELADA` con reembolso pendiente,
    `confirmado` en una `REEMBOLSADA`, `null` en el resto (incluidas las gratis).
- `CompraVista` suma `cancelable` y `motivoNoCancelable` (R6); `MiCompraVista` los omite.
- `canceladaPor` (`MiCompraVista`, `CompraDelEventoVista`) se amplía a `REEMBOLSADA`: el autor del
  cambio a `CANCELADA` (siempre `"usuario"` en una reembolsada). Hasta ahora era `null` fuera de
  `CANCELADA`; ninguna pantalla lo leía en una `REEMBOLSADA`, así que no rompe nada.
- "Compras del evento" no suma un campo propio para la acción: se ofrece "Confirmar reembolso" si y
  solo si `reembolso?.estado === "pendiente"`, que es lo que informa el servidor (FR-016) y la única
  condición de la regla (el que mira es el organizador y no hay plazo).

**Rationale**: lo que la spec pide distinguir (FR-016) con los nombres del dominio. `canceladaDesde`
y `reembolso` en los datos comunes evitan que "Tu compra" tenga que recorrer el historial para
decidir el aviso. El monto se repite en `reembolso` (es `total`) para que la vista diga
explícitamente qué se devuelve.

**Alternatives considered**: un contador `reembolsosPendientes` en `ComprasDelEventoVista` — la spec
lo deja al plan; con las listas del TP la fila ya se distingue por texto y acción (YAGNI). Fecha
del reembolso en `ReembolsoVista` — ninguna pantalla la muestra; sigue en el historial.

## R8. "Tu compra"

**Decision** (`pantallas/Compra.tsx`):

- `CONFIRMADA` o `UTILIZADA`: debajo de "Tus entradas", una sección `Cancelacion`: si
  `cancelable`, el botón "Cancelar compra" (variante `texto`, como en la pendiente); si no, el
  motivo (`textoMotivoNoCancelable`) como texto. "Cancelar compra" abre un `Alert` (FR-018):
  - paga: título "¿Cancelar la compra de 2 entradas VIP?", mensaje "Se cancelan tus 2 entradas.
    El organizador tiene que confirmar el reembolso de $ 240.000. No se puede deshacer.";
  - gratis: "Se cancela tu entrada y vuelve a estar disponible. No se puede deshacer." (sin monto);
  - botones "Volver" y "Cancelar compra" (destructivo).
- `CANCELADA` / `REEMBOLSADA`: el estado y el aviso de `textoCancelada` (ampliado) o
  `textoReembolsada`; sin lista de entradas (ya era así).
- La mutation es la `useCancelarCompra` existente (misma ruta). Marca sincrónica `enviando` para el
  doble toque. Los errores se muestran con `AvisoDeFormulario` **incluido el 409** (FR-022: el
  mensaje del servidor), y la relectura redibuja el estado real (el motivo reemplaza al botón).

**Rationale**: SC-001: botón + confirmación = 2 toques. La pendiente sigue con su `Pago` (que oculta
los 409 porque la relectura cambia la sección entera); en la confirmada, un `EVENTO_REALIZADO` deja
la compra `CONFIRMADA`, así que sin el mensaje el usuario no sabría qué pasó.

## R9. "Mis compras" y "Compras del evento"

**Decision**:

- **"Mis compras"** (`FilaMiCompra`): sin botón nuevo (FR-017). `textoAvisoDeMiCompra` suma:
  `CANCELADA` con `reembolso.pendiente` → "El organizador tiene que confirmar el reembolso de
  $ X"; `CANCELADA` desde `CONFIRMADA` sin reembolso (gratis) → "Cancelaste esta compra";
  `REEMBOLSADA` → "Te devolvimos $ X". Los de la 007 siguen ("Venció sin pagarse", "La cancelaste").
- **"Compras del evento"** (`FilaCompraDelEvento`): `textoAvisoDeCompraDelEvento` suma
  "La canceló el comprador · Reembolso pendiente de $ X", "La canceló el comprador" (gratis o
  pendiente, como hoy) y "Reembolso confirmado" (`REEMBOLSADA`). Con `reembolso.pendiente`, la fila
  suma el botón "Confirmar reembolso" **como hermano** del bloque accesible (que sigue sin ser
  tocable), como "Pagar" en `FilaMiCompra` (FR-023). El `Alert`: "¿Confirmar el reembolso a Martín
  Benítez?", "Confirmás que le devolviste $ 240.000. No se puede deshacer.", botones "Volver" y
  "Confirmar reembolso". El error se muestra en la fila (`AvisoDeFormulario`).
- **Mutation nueva** `useConfirmarReembolso(usuarioId, eventoId)` en `mutaciones.ts`, con el
  `compraId` como variable (`mutate(compraId)`), sin reintentos. `isPending` + `variables`
  deshabilitan el botón de esa fila mientras va el pedido; una marca sincrónica en la fila evita el
  doble toque.

**Rationale**: SC-002 (acción + confirmación). La estructura de la fila con el botón aparte es la
que ya validó TalkBack en la 007.

## R10. Invalidaciones

**Decision** (`mutaciones.ts`, en `onSettled`, con éxito o error):

- `useCancelarCompra` (pendiente o confirmada) suma a lo de la 006 —la compra, `misComprasDelEvento`,
  `misCompras`, el evento de todos los usuarios y `["catalogo"]`— las vistas del organizador **por
  prefijo**: `["compras-del-evento"]` y `["entrada-del-evento"]` (otro usuario en el mismo
  dispositivo, FR-021).
- `useConfirmarReembolso` invalida `comprasDelEvento(usuarioId, eventoId)`, `["entrada-del-evento"]`
  y, por prefijo, las del comprador: `["compra"]`, `["mis-compras"]` y `["mis-compras-del-evento"]`
  (como `useRegistrarUso`). No invalida el evento ni el catálogo: el reembolso no cambia el cupo
  (FR-011), así que no son vistas afectadas.
- Con éxito, `useCancelarCompra` sigue escribiendo la respuesta en `claves.compra` (006).

**Rationale**: FR-021 pide volver a pedir "todas las vistas afectadas", también las de otro usuario
guardadas en la app; es el mismo criterio de R13 de la 008. Las consultas inactivas solo se marcan
viejas (se piden al volver a montarse).

## R11. Seed

**Decision** (`datos-ejemplo.ts`), sin tocar las compras existentes:

| Compra | Evento (organiza) | Estado | Para qué |
|---|---|---|---|
| `compra-martin-festival-vip` (existe) | Festival (Lucía), +30 días | `CONFIRMADA`, 2 VIP, $ 240.000 | US1: cancelar con monto |
| `compra-sofia-pena-con-cena` (existe) | Peña (Lucía), ~+2 h | `CONFIRMADA`, 2 Con cena | cancelable hasta el inicio; usarla la vuelve no cancelable |
| `compra-martin-pena-general` (existe) | Peña | `UTILIZADA` 1 de 3 | US3: "Ya usaste una entrada" |
| `compra-diego-maraton-inscripcion` (nueva) | Maratón 10K (Lucía), +45 días | `CANCELADA` desde `CONFIRMADA` por Diego, 1 Inscripción, $ 30.000 | US2: reembolso pendiente |
| `compra-valentina-maraton-inscripcion` (nueva) | Maratón 10K | `REEMBOLSADA` (cancelada por Valentina, confirmada por Lucía), 2 Inscripción, $ 60.000 | "Te devolvimos $ 60.000" |

Las dos nuevas tienen historial coherente (alta hace días, pago 5 minutos después, cancelación y, en
la de Valentina, reembolso después) y entradas con su cambio `CANCELADA` (R3) y códigos fijos
válidos (`MZDF1C01`; `MZVG2R01`, `MZVG2R02`). El cupo de Inscripción **no cambia** (1000): las
canceladas ya lo devolvieron.

**Rationale**: FR-024. El Maratón es de Lucía, no tiene otras compras en el seed y ninguna demo ni
test lo borra o le quita "Inscripción" (los de la 004 usan Noche de Rock y Backstage). Valentina
no tiene otras compras; Diego tiene la vencida del Festival, así que su "Mis compras" muestra lado a
lado una pendiente vencida y una cancelada con reembolso pendiente (la distinción de FR-016). Usar
el mismo organizador que la Peña deja toda la demo del organizador con Lucía.

## R12. Constitución: enmienda PATCH 2.5.1

**Decision**: sí, una enmienda **PATCH** con `/speckit-constitution` como primera tarea de
`tasks.md`:

- **Roles · Organizador**: "…ve las compras de sus eventos, **confirma los reembolsos de las
  compras canceladas de sus eventos**, responde mensajes y registra el uso de entradas."
- **VI. Identidad y autorización**: "un organizador solo ve las compras de sus eventos **y solo
  confirma sus reembolsos**".

**Rationale**: no hay contradicción (la transición `CANCELADA → REEMBOLSADA` existe y registra
quién y cuándo, y la spec puede refinar las condiciones del reembolso), así que no es obligatoria.
Pero "Roles" y el principio VI enumeran lo que hace el organizador sobre las compras (solo "ve"), y
esta feature le da la primera **escritura** sobre la compra de otro; dejarlo explícito evita que una
revisión lo lea como violación de VI. Es una aclaración sin principio nuevo → PATCH (2.5.0 →
2.5.1). Lo demás (sin plazo, las gratis no se reembolsan, el cambio propio de cada entrada) ya
cumple la constitución tal como está (R3, R4) y queda en la spec.

**Alternatives considered**: MINOR — no se agrega ni amplía un principio. Ninguna enmienda —
dejaría a VI diciendo que el organizador solo ve las compras.

## R13. Tests

- **domain/compra.test.ts**: `cancelar` de una `CONFIRMADA` un minuto antes y a la hora exacta
  (`EVENTO_REALIZADO`), una `UTILIZADA` con el evento empezado y sin empezar (`TRANSICION_INVALIDA`),
  `CANCELADA` y `REEMBOLSADA`; la pendiente como en la 006 (también vencida); entradas con su cambio
  `CANCELADA`, `estadoEn` en `CANCELADA` y `REEMBOLSADA`; `registrarUso` de una entrada cancelada;
  `motivoNoCancelable` en cada fila de la tabla de R6; `tieneReembolsoPendiente`, `canceladaDesde`
  (paga, gratis, pendiente cancelada, vencida); `confirmarReembolso` válido y en cada estado
  inválido; invariantes nuevas (REEMBOLSADA sin pasar por CONFIRMADA o gratis, entradas
  incoherentes); `esVigente` de una cancelada desde confirmada.
- **services/compra.service.test.ts**: cancelar una confirmada (cupo +cantidad, orden de guardado
  compra → evento, autor y hora), tope liberado (volver a comprar), 403 al organizador, orden de
  rechazos; `confirmarReembolso` (autor organizador, cupo igual, un solo `guardar`, 403 al
  comprador, 404, 409 sin reembolso/ya reembolsada, evento realizado aceptado); vistas con
  `cancelable`/`motivoNoCancelable`/`reembolso`/`canceladaDesde`/`canceladaPor` al día y sin
  guardar; `comprasDelEvento` con la cancelada fuera de "vendidas".
- **services/concurrencia-compras.test.ts**: uso ‖ cancelación de la misma compra (uno solo gana,
  historial y cupo coherentes, N repeticiones); dos cancelaciones; dos confirmaciones de reembolso;
  cancelación ‖ compra nueva del mismo tipo.
- **api/compras.test.ts**: `POST …/cancelacion` de una confirmada (200 y tabla de rechazos con
  status, código y mensaje, sin tocar el cupo), `POST …/reembolso` (200 y 401 → 400 → 404 → 403 →
  409); **api/entradas.test.ts**: el código de una entrada cancelada → 409 `TRANSICION_INVALIDA`
  "La compra de esta entrada está cancelada."; **api/docs.test.ts** cubre la ruta nueva.
- **domain/datos-ejemplo.test.ts** y **repositories/repositorios-de-ejemplo.test.ts**: las compras
  nuevas, su estado y que el cupo del Maratón sigue en 1000.
- **mobile**: `formato` (motivos, avisos de cada caso y de las dos filas, textos de los `Alert`);
  `tests/api/compras` (`confirmarReembolso`); `tests/pantallas/compra.test.tsx` (botón o motivo,
  `Alert` con monto o sin él, cancelar → "Cancelada" con el aviso, 409 con el mensaje y el estado
  real, doble toque, servidor caído, invalidación de las vistas del organizador);
  `mis-compras.test.tsx` (avisos, sin botón); `compras-del-evento.test.tsx` ("Confirmar reembolso"
  solo con reembolso pendiente, `Alert`, un solo pedido, invalidación de las vistas del comprador,
  accesibilidad del botón aparte de la fila).
