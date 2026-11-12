# Feature Specification: Comprar entradas

**Feature Branch**: `feature/006-comprar-entradas`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "Feature 006 — Comprar entradas (UC-12, prioridad P1). Depende de 004 (cerrojo por evento, entidad Compra y RepositorioCompras mínimos) y de 005 (detalle público del evento en Explorar, ruta explorar/[eventoId]). Qué quiero: un comprador, desde el detalle de un evento no realizado, elige un tipo de entrada y una cantidad y compra sin superar el cupo disponible de ese tipo. La compra nace PENDIENTE y, con un pago simulado (sin pasarela real ni datos de tarjeta), pasa a CONFIRMADA. El cupo disponible se descuenta de forma atómica por evento: dos compras simultáneas nunca pueden vender más que el cupo. Un tipo gratis se puede "comprar" igual. No se puede comprar en un evento realizado ni en un tipo agotado, y el organizador no puede comprar entradas de sus propios eventos (confirmalo con la constitución). Fuera de alcance: listado "Mis compras" (007), cancelación y reembolso (009), chat (010). Escribí la spec en términos de comportamiento y reglas de negocio (qué, no cómo): historias de usuario priorizadas con criterios de aceptación verificables, casos borde (cupo justo, cantidad 0 o negativa, tipo inexistente, evento que se realiza mientras se compra, compras concurrentes, servidor caído durante el pago) y criterios de éxito medibles. La decisión abierta del backlog (¿cuánto dura una compra PENDIENTE sin pagar? ¿vence y libera el cupo?) y cualquier otro hueco marcalos como [NEEDS CLARIFICATION]: no los resuelvas por tu cuenta, los vemos en /speckit-clarify."

**Casos de uso**:

- UC-12 — *Como comprador, quiero comprar sobre un Evento eligiendo un tipo de entrada y una
  cantidad, sin superar el cupo disponible.*

## Alcance

**Incluye**: el botón para comprar en el **detalle público** del evento (005), por tipo de
entrada; la elección de la **cantidad**; el **alta de la compra** en estado `PENDIENTE`, con el
total calculado por el servidor y el cupo disponible descontado de forma atómica; el **pago
simulado** que pasa la compra a `CONFIRMADA`; el **historial de cambios de estado** de la compra
(quién y cuándo); el **vencimiento** de una compra pendiente sin pagar a los 15 minutos; ver
una compra propia el tiempo necesario para pagarla y ver su confirmación; las **compras
pendientes propias** en el detalle del evento, para retomar el pago **o cancelarlas** sin
esperar a que venzan; el acceso desde el detalle a las **entradas confirmadas** propias de ese
evento ("Ver mis entradas");
los rechazos con mensaje claro (evento realizado, tipo agotado, cupo insuficiente, cantidad
inválida, evento o tipo inexistente).

**No incluye**: el listado "Mis compras" y los días restantes (007, UC-01); las compras de un
evento vistas por el organizador y registrar el uso (008, UC-02); cancelar y reembolsar una compra
**confirmada** (009, UC-07 y UC-08); el chat de la compra (010); pasarela de pago real, datos de tarjeta, medios de
pago, facturas o comprobantes; elegir asientos; comprar varios tipos de entrada en una misma
compra; notificaciones; pulido estético (013).

## Clarifications

### Session 2026-11-12

- Q: ¿El organizador de un evento puede comprar entradas de ese evento? → A: No. El servidor lo rechaza como regla de negocio (conflicto con código propio, `COMPRA_PROPIO_EVENTO`), y en el detalle de su propio evento la app no ofrece "Comprar" y muestra "Sos el organizador de este evento". Es un refinamiento de la constitución (no lo prohíbe ni lo permite expresamente) que evita autorreseñas en la 011 y registrar el uso de una compra propia en la 008 (FR-008, US1 escenario 12, US3 escenario 8).
- Q: ¿Una compra PENDIENTE que nunca se paga vence y devuelve sus entradas al cupo? → A: Sí. Vence a los 15 minutos desde su alta (según el reloj del servidor, inclusive): pasa a `CANCELADA`, con un cambio de estado registrado por el **sistema** (no por un usuario), y sus entradas vuelven al cupo disponible. Una compra vencida no se puede pagar (FR-014, FR-014a, FR-014b, US2 escenarios 9 y 12).
- Q: Si el comprador sale de la pantalla de pago sin pagar, ¿dónde retoma el pago de esa compra pendiente, ya que "Mis compras" llega recién en la 007? → A: En el detalle del evento: el comprador ve sus compras pendientes (no vencidas) de ese evento, con tipo, cantidad, total, hasta qué hora puede pagar y "Pagar". También recupera una compra registrada cuya respuesta se perdió con el servidor caído (FR-023, US2 escenario 10, US4 escenario 5).
- Q: ¿Hay un máximo de entradas por compra, además del cupo disponible? → A: Sí, un tope **por persona y por evento, acumulado**: un comprador no puede tener más de 4 entradas de tipos pagos de un mismo evento sumando sus compras vigentes (pendientes no vencidas y confirmadas; las canceladas, incluidas las vencidas, no cuentan). En un tipo gratis el tope es 1 entrada por persona para ese tipo, aparte de las 4 (en la Maratón: hasta 4 "Inscripción" y 1 "Carrera kids"). Reemplaza el supuesto "sin tope de cantidad" (FR-002, FR-002a, US1 escenario 3, US3 escenarios 11 y 12).
- Q: Al "comprar" un tipo gratis, ¿la compra pasa por el paso de pago o queda CONFIRMADA directamente? → A: Mismo recorrido que una paga: nace `PENDIENTE` y el comprador toca "Confirmar" (pago simulado de $ 0) para pasarla a `CONFIRMADA`; si no confirma, vence a los 15 minutos como cualquier otra (FR-009, US2 escenario 4).
- Q: ¿Qué pasa con las compras cuando el evento empieza? → A: Una compra no puede **empezar**
  (nacer `PENDIENTE`) con el evento empezado. Una compra pendiente creada antes **se puede pagar**
  con el evento empezado mientras no venza, y si no se paga, vence a los 15 minutos como
  cualquier otra, **aunque el evento ya haya empezado** (por ejemplo, una compra hecha 1 minuto
  antes del inicio vence 14 minutos después de empezado). La regla "Cancelación" de la
  constitución se mantiene tal cual para las compras confirmadas: se pueden cancelar y reembolsar
  hasta que el evento empiece o la entrada figure como utilizada (feature 009). Para una compra
  `PENDIENTE` prevalece la regla de los 15 minutos, según la constitución 2.4.0 (regla
  "Cancelación": una `PENDIENTE` puede pasar a `CANCELADA` con el evento empezado; una
  `CONFIRMADA`, no). Reemplaza el supuesto "no se paga una compra de un evento realizado"
  (FR-012, edge case "Evento que empieza con una compra pendiente").

## User Scenarios & Testing *(mandatory)*

El actor es el **comprador**: cualquier usuario en su relación con la compra que hace
(constitución, "Roles"), salvo el organizador del evento, que no puede comprar entradas de sus
propios eventos (Clarifications, 2026-11-12).

### User Story 1 - Comprar entradas de un tipo (Priority: P1)

Desde el detalle de un evento que todavía no se realizó, el comprador toca "Comprar" en un tipo
de entrada con cupo, elige cuántas entradas quiere (por ejemplo, 2 "VIP") y ve el total
(precio × cantidad, "Gratis" si el tipo cuesta $ 0). Al confirmar, la compra queda registrada
como **pendiente de pago**, las entradas quedan reservadas para él (el cupo disponible del tipo
baja en esa cantidad) y la app lo lleva a pagar.

**Why this priority**: es UC-12 en sentido estricto y el origen de todas las features
siguientes (007 a 011 operan sobre compras). Sin esta historia no hay compras en el sistema.

**Independent Test**: con los datos de ejemplo, abrir el detalle de "Festival Sonidos del Sur",
con un usuario sin compras en ese evento comprar 2 entradas "VIP" y verificar que la compra
queda pendiente con total $ 240.000 y que el detalle muestra 48 VIP disponibles (antes, 50);
con otro usuario, comprar las 3 "Backstage" y verlo agotado;
verificar por el lado del servidor que el
total lo calcula él, que el cupo baja exactamente en la cantidad y que dos compras simultáneas
sobre el último cupo no lo dejan negativo.

**Acceptance Scenarios**:

1. **Given** el detalle de un evento no realizado, **When** se muestra, **Then** cada tipo de
   entrada con cupo disponible tiene una acción "Comprar"; los tipos agotados no la tienen (y
   siguen diciendo "Agotado").
2. **Given** el detalle de un evento ya realizado, **When** se muestra, **Then** ningún tipo
   ofrece comprar y el detalle sigue indicando "Este evento ya se realizó".
3. **Given** el comprador eligiendo la cantidad, **When** se muestra el selector, **Then**
   arranca en 1, no baja de 1, no sube por encima del menor entre el cupo disponible y las
   entradas que el comprador todavía puede comprar según su tope (4 por evento en tipos pagos, 1
   en cada tipo gratis), y el total se actualiza con cada cambio (precio × cantidad, en pesos
   enteros). Si ya alcanzó el tope, el tipo no ofrece "Comprar" y lo indica ("Ya tenés el máximo
   de entradas para este evento").
4. **Given** una cantidad elegida, **When** el comprador confirma, **Then** se registra una
   compra a su nombre con el evento, el tipo, la cantidad, el total y el estado `PENDIENTE`, y el
   cupo disponible del tipo baja en esa cantidad.
5. **Given** la compra registrada, **When** se calcula su total, **Then** es el precio vigente
   del tipo en el servidor al momento de comprar multiplicado por la cantidad; la app nunca
   envía precios ni totales.
6. **Given** un tipo gratis ($ 0), **When** el comprador lo compra, **Then** la compra se
   registra igual, con total 0, y la app muestra "Gratis" en lugar de "$ 0".
7. **Given** un tipo con cupo disponible justo igual a la cantidad pedida, **When** el
   comprador confirma, **Then** la compra se registra y el tipo queda con cupo 0 ("Agotado").
8. **Given** dos o más compras simultáneas sobre el mismo tipo cuya suma supera el cupo
   disponible, **When** el servidor las procesa, **Then** se registran solo las que entran en el
   cupo, en el orden en que se procesan, y las demás se rechazan por cupo insuficiente; el cupo
   nunca queda por debajo de 0.
9. **Given** la compra registrada, **When** se consulta su historial, **Then** tiene un primer
   cambio de estado `PENDIENTE` registrado por el comprador, con la fecha y hora del servidor.
10. **Given** la compra registrada, **When** el comprador vuelve al detalle o a Explorar,
    **Then** ve el cupo actualizado (y "Agotado" si el tipo o el evento se quedaron sin cupo).
11. **Given** una compra en curso, **When** el servidor todavía no respondió, **Then** la acción
    de confirmar muestra que está procesando y no se puede tocar de nuevo (no se envían dos
    compras por un doble toque).
12. **Given** el usuario actual es el organizador del evento, **When** abre su detalle público
    desde Explorar, **Then** ningún tipo ofrece "Comprar" y se ve el aviso "Sos el organizador
    de este evento".

---

### User Story 2 - Pagar la compra (pago simulado) (Priority: P1)

Con la compra pendiente, el comprador ve un resumen (evento, fecha y hora, tipo, cantidad y
total, tal como los registró el servidor) y un botón "Pagar". No ingresa datos de tarjeta: el
pago es simulado y siempre se acepta. La compra pasa a **confirmada** y la app le muestra la
confirmación.

**Why this priority**: sin el pago la compra nunca llega a `CONFIRMADA`, que es el estado del
que dependen 007 (días restantes), 008 (registrar uso) y 011 (reseñas). Va junto con US1 en el
MVP.

**Independent Test**: comprar un tipo, tocar "Pagar" y ver la compra confirmada; verificar por
el lado del servidor que el pago solo lo hace el comprador de la compra, solo desde `PENDIENTE`,
y que registra el cambio de estado con quién y cuándo.

**Acceptance Scenarios**:

1. **Given** una compra recién registrada, **When** la app muestra el pago, **Then** se ven el
   nombre del evento, su fecha y hora en hora de Buenos Aires, el tipo de entrada, la cantidad y
   el total que calculó el servidor ("Gratis" si es 0), junto al estado "Pendiente" con texto y
   color.
2. **Given** el resumen de pago, **When** el comprador toca "Pagar", **Then** la compra pasa a
   `CONFIRMADA` sin pedir datos de pago, y la app muestra la confirmación con el estado
   "Confirmada" (texto y color) y una acción para volver al evento o a Explorar.
3. **Given** el pago aceptado, **When** se consulta el historial de la compra, **Then** tiene un
   segundo cambio de estado `CONFIRMADA` registrado por el comprador, con la fecha y hora del
   servidor.
4. **Given** una compra gratis, **When** se muestra su resumen, **Then** el botón dice
   "Confirmar" en lugar de "Pagar"; al tocarlo pasa a `CONFIRMADA` igual que una paga, y si no se
   confirma, vence a los 15 minutos como cualquier otra.
5. **Given** una compra que no está `PENDIENTE` (por ejemplo, ya confirmada), **When** se intenta
   pagar de nuevo, **Then** el servidor la rechaza por estado inválido y la compra no cambia.
6. **Given** una compra de otro usuario, **When** alguien que no es su comprador intenta pagarla
   o verla, **Then** el servidor la rechaza por falta de permiso.
7. **Given** una compra inexistente, **When** se intenta pagarla o verla, **Then** el servidor
   responde "no encontrada".
8. **Given** el pago en curso, **When** el servidor todavía no respondió, **Then** el botón
   muestra que está procesando y no se puede tocar de nuevo.
9. **Given** una compra pendiente que el comprador no pagó, **When** se cumplen 15 minutos
   desde su alta según el reloj del servidor, **Then** la compra vence: pasa a `CANCELADA`, su
   historial registra ese cambio hecho por el sistema, con la fecha y hora del vencimiento, y sus
   entradas vuelven al cupo disponible del tipo.
10. **Given** un comprador que sale de la pantalla de pago sin pagar, **When** vuelve a abrir el
    detalle de ese evento, **Then** ve sus compras pendientes no vencidas de ese evento (tipo,
    cantidad, total, hasta qué hora puede pagar, estado "Pendiente" con texto y color) y cada una
    tiene "Pagar", que lo lleva al resumen de pago; las vencidas, las confirmadas y las de otros
    usuarios no aparecen ahí.
11. **Given** el resumen de pago de una compra pendiente, **When** se muestra, **Then** indica
    hasta qué hora (de Buenos Aires) se puede pagar.
12. **Given** una compra vencida (15 minutos o más desde su alta), **When** el comprador intenta
    pagarla, **Then** el servidor la rechaza indicando que la compra venció, la compra queda
    `CANCELADA` y la app lo muestra, con la opción de volver al evento para comprar de nuevo.

---

### User Story 3 - Rechazos claros cuando no se puede comprar (Priority: P2)

Si el comprador intenta comprar algo que ya no se puede (el evento se realizó, el tipo se agotó
o quedan menos entradas de las que pidió, el tipo o el evento ya no existen), la compra no se
registra, el cupo no cambia y la app le explica por qué con un mensaje claro, sin perder lo que
había elegido cuando tiene sentido reintentar con otra cantidad.

**Why this priority**: protege las reglas de cupo y de evento realizado, que el servidor aplica
siempre (también ante pedidos directos). Con US1 y US2 el recorrido feliz ya funciona; esta
historia completa los caminos de error que la app conoce con datos viejos.

**Independent Test**: con pedidos directos al servidor, intentar comprar en un evento realizado,
en un tipo agotado, más entradas que el cupo, cantidad 0, negativa o decimal, un tipo de otro
evento y un evento inexistente, y verificar cada rechazo y que el cupo no cambia; en la app,
comprar con el detalle desactualizado y ver el mensaje correspondiente.

**Acceptance Scenarios**:

1. **Given** un evento realizado (su fecha y hora llegó según el reloj del servidor), **When**
   llega una compra, **Then** se rechaza indicando que el evento ya se realizó.
2. **Given** un tipo con cupo disponible 0, **When** llega una compra, **Then** se rechaza por
   cupo insuficiente.
3. **Given** un tipo con cupo disponible 3, **When** llega una compra de 4, **Then** se rechaza
   por cupo insuficiente indicando cuántas quedan, y el cupo sigue en 3.
4. **Given** una cantidad 0, negativa, con decimales, que no es un número o que falta, **When**
   llega una compra, **Then** se rechaza como entrada inválida con el detalle en la cantidad.
5. **Given** un tipo de entrada que no existe o que pertenece a otro evento, **When** llega una
   compra, **Then** se rechaza indicando que el tipo de entrada no existe en ese evento.
6. **Given** un evento que no existe (por ejemplo, eliminado después de abrir su detalle),
   **When** llega una compra, **Then** se rechaza como "no encontrado", y la app ofrece volver a
   Explorar.
7. **Given** un pedido de compra sin usuario identificado, **When** llega, **Then** se rechaza
   por usuario no identificado.
8. **Given** el organizador del evento, **When** llega una compra suya de entradas de ese
   evento (por ejemplo, un pedido directo al servidor), **Then** se rechaza indicando que el
   organizador no puede comprar entradas de sus propios eventos.
9. **Given** un rechazo por cupo insuficiente o evento realizado en la app, **When** se muestra
   el mensaje, **Then** el detalle se actualiza con el cupo real (o con "Este evento ya se
   realizó") y el comprador puede elegir otra cantidad u otro tipo sin volver a Explorar.
10. **Given** cualquier rechazo, **When** termina, **Then** no se registró ninguna compra ni
    cambió ningún cupo.
11. **Given** un comprador con 3 entradas vigentes de tipos pagos de un evento (por ejemplo, una
    compra confirmada de 2 y una pendiente de 1), **When** llega una compra suya de 2 entradas
    pagas de ese evento, **Then** se rechaza por tope por persona indicando que puede comprar 1
    más; con una compra de 1, se acepta. Una compra suya vencida o cancelada no cuenta.
12. **Given** un comprador con una entrada vigente de un tipo gratis, **When** llega otra compra
    suya de ese tipo, o una compra de 2 o más de ese tipo, **Then** se rechaza por tope por
    persona; sus entradas gratis no cuentan para el tope de 4 de los tipos pagos.
13. **Given** una cantidad mayor que 4 en un solo pedido, **When** llega, **Then** se rechaza
    como entrada inválida con el detalle en la cantidad.

---

### User Story 4 - Comprar y pagar con conexión inestable (Priority: P3)

Si el servidor no responde mientras el comprador compra o paga, la app no reintenta sola: avisa
que no se pudo completar, conserva lo elegido y deja reintentar a mano. Cuando el servidor
vuelve, el comprador ve el estado real de su compra, sin pagar dos veces ni quedarse con un
mensaje de error si el pago en realidad llegó.

**Why this priority**: la app ya muestra la franja de "servidor no disponible" (002/003) y no
reintenta escrituras; esta historia define qué ve el comprador en ese caso. Aporta robustez pero
no bloquea la demo del recorrido.

**Independent Test**: en la app con el servidor falso caído, tocar "Comprar" y "Pagar" y ver el
aviso y la opción de reintentar; simular un pago que llegó al servidor pero cuya respuesta se
perdió, reintentar y ver la compra confirmada.

**Acceptance Scenarios**:

1. **Given** el servidor caído, **When** el comprador confirma la compra, **Then** la app avisa
   que no se pudo registrar, no reintenta sola, conserva el tipo y la cantidad elegidos y deja
   reintentar.
2. **Given** el servidor caído, **When** el comprador toca "Pagar", **Then** la app avisa que no
   se pudo pagar, no reintenta sola y la compra sigue mostrándose pendiente, con "Pagar"
   disponible para reintentar.
3. **Given** un pago que el servidor aceptó pero cuya respuesta no llegó a la app, **When** el
   comprador reintenta, **Then** ve la compra confirmada (la app consulta el estado real) y no
   un error de "estado inválido".
4. **Given** el servidor de vuelta, **When** la app vuelve a mostrar la compra o el detalle,
   **Then** muestra el estado y el cupo que informa el servidor.
5. **Given** una compra que el servidor registró pero cuya respuesta no llegó a la app, **When**
   el comprador vuelve a ver el detalle del evento, **Then** la encuentra entre sus compras
   pendientes y puede pagarla (sin necesidad de comprar de nuevo).

---

### Edge Cases

- **Cupo justo**: pedir exactamente el cupo disponible se acepta y deja el tipo agotado; pedir
  uno más se rechaza. El evento queda "Agotado" en Explorar solo si todos sus tipos quedaron en
  0 (regla de la 005).
- **Cantidad 0, negativa o no entera**: entrada inválida, la valida el servidor aunque la app no
  permita elegirla.
- **Tope por persona**: 4 entradas de tipos pagos por evento, acumuladas entre las compras
  vigentes del comprador (pendientes no vencidas y confirmadas), y 1 por cada tipo gratis, aparte.
  Al vencer o cancelarse una compra, sus entradas dejan de contar y el comprador puede volver a
  comprar. Se aplica también si el cupo alcanzaría.
- **Tope y concurrencia**: dos compras simultáneas del mismo comprador sobre el mismo evento se
  evalúan una sobre el resultado de la otra (operación atómica del evento): nunca suman más que
  el tope.
- **Tope y precio cambiado**: si el organizador pasa un tipo de pago a gratis (o al revés), cada
  compra cuenta según el precio con el que se hizo (total 0 = gratis); el tope se evalúa con el
  precio vigente del tipo pedido.
- **Tipo inexistente o de otro evento**: se rechaza; nunca se descuenta cupo de un tipo que no
  pertenece al evento pedido.
- **Evento que se realiza mientras se compra**: lo decide el servidor al registrar la compra, con
  su reloj, dentro de la misma operación atómica que verifica el cupo; si la hora del evento
  llegó, se rechaza aunque el detalle de la app todavía ofrezca comprar.
- **Evento que empieza con una compra pendiente**: la compra se puede pagar igual mientras no
  venza (la persona reservó antes de que empezara); si no se paga, vence a los 15 minutos de su
  alta como cualquier otra (FR-014). Lo que no se puede, con el evento empezado, es registrar una
  compra nueva (FR-007).
- **Pago en el límite del vencimiento**: si el pago y el vencimiento coinciden, gana lo que el
  servidor procese primero bajo la operación atómica del evento: o queda `CONFIRMADA` (y ya no
  vence) o queda `CANCELADA` (y el pago se rechaza por vencida). A los 15 minutos exactos ya está
  vencida.
- **Vencimiento sin nadie mirando**: una compra vence aunque nadie la consulte; el cupo que se
  muestra y el que se verifica al comprar ya cuentan sus entradas como disponibles.
- **Compra vencida y reglas de la 004**: una compra vencida (`CANCELADA`) sigue contando como
  compra para no poder quitar el tipo ni eliminar el evento (aclaración de la 004: toda compra
  cuenta, en cualquier estado).
- **Compras concurrentes**: verificar el cupo y descontarlo ocurre bajo la operación atómica del
  evento (constitución, "Operaciones atómicas por evento"); la segunda compra se evalúa sobre el
  cupo que dejó la primera. Compras sobre eventos distintos no se esperan entre sí.
- **Compra simultánea con una edición del organizador**: si el organizador baja el cupo, quita
  el tipo (sin compras todavía) o cambia la fecha o el precio mientras entra una compra, una de
  las dos operaciones se completa primero y la otra se evalúa sobre su resultado (por ejemplo, el
  tipo quitado da "tipo inexistente"; el precio nuevo es el que se cobra).
- **Precio cambiado entre ver el detalle y comprar**: el total es el del precio vigente en el
  servidor al registrar la compra; la app muestra en el resumen de pago el total que registró el
  servidor, que puede diferir del que estimó en el selector.
- **Tipo con compras**: desde la 006, toda compra registrada (incluida una pendiente) cuenta para
  las reglas de la 004: el tipo no se puede quitar y el evento no se puede eliminar.
- **Varias compras del mismo comprador**: un comprador puede hacer más de una compra del mismo
  tipo y evento; cada una es independiente.
- **Doble toque**: confirmar y pagar quedan deshabilitados mientras el pedido está en curso.
- **Servidor caído al registrar la compra**: si la compra llegó al servidor pero la respuesta se
  perdió, puede quedar registrada (pendiente y reservando cupo) sin que la app lo sepa; un
  reintento manual registra otra compra. El comprador la encuentra entre sus compras pendientes
  en el detalle del evento (FR-023) y, si no la paga, vence a los 15 minutos y libera el cupo.
- **Servidor caído durante el pago**: la compra sigue pendiente en la app; el reintento manual
  consulta el estado real y, si ya estaba confirmada, la muestra confirmada (US4).
- **Usuario actual cambiado en medio del pago**: la compra pertenece a quien la hizo; si se
  cambia de usuario desde Perfil, la pantalla de pago muestra que el nuevo usuario no tiene
  permiso para ver esa compra (sin acciones) y no puede pagarla.

## Requirements *(mandatory)*

### Functional Requirements

**Comprar (alta de la compra)**

- **FR-001**: El detalle público de un evento no realizado DEBE ofrecer "Comprar" en cada tipo
  de entrada con cupo disponible mayor que 0, y NO DEBE ofrecerlo en los tipos agotados, en
  ningún tipo de un evento realizado ni en los eventos del usuario actual (FR-008). Reemplaza FR-031 de la 005 ("el detalle no ofrece comprar
  todavía").
- **FR-002**: El comprador DEBE poder elegir una cantidad entera entre 1 y el menor entre el cupo
  disponible y lo que le queda de su tope (FR-002a), con el total estimado (precio × cantidad,
  "Gratis" si es 0) a la vista. El detalle del evento DEBE informar, para el usuario actual,
  cuántas entradas más puede comprar de cada tipo según su tope; si es 0, el tipo no ofrece
  "Comprar" y lo indica.
- **FR-002a**: El sistema DEBE rechazar la compra que deje al comprador con más de **4 entradas
  de tipos pagos de ese evento** o con más de **1 entrada de un tipo gratis**, contando sus
  compras vigentes de ese evento (`PENDIENTE` no vencidas y `CONFIRMADA`; las `CANCELADA`, incluidas
  las vencidas, no cuentan). Una compra cuenta como gratis si su total es 0. Una cantidad mayor
  que 4 en un solo pedido es entrada inválida; superar el tope acumulado es una regla de negocio
  (código propio, por ejemplo `TOPE_POR_PERSONA`) cuyo mensaje indica cuántas puede comprar
  todavía. El tope se verifica dentro de la misma operación atómica que el cupo (FR-006).
- **FR-003**: El sistema DEBE registrar la compra con comprador (el usuario actual), evento, tipo
  de entrada, cantidad, total y estado `PENDIENTE`.
- **FR-004**: El total DEBE calcularlo el servidor como precio vigente del tipo × cantidad al
  registrar la compra, en pesos enteros; el pedido de compra NO DEBE llevar precio ni total, y
  el total no cambia si después cambia el precio del tipo.
- **FR-005**: Al registrar la compra, el cupo disponible del tipo DEBE bajar exactamente en la
  cantidad comprada.
- **FR-006**: Verificar que el evento no se realizó, que el tipo existe en el evento y que hay
  cupo suficiente, y descontar el cupo y registrar la compra, DEBEN ocurrir en una sola operación
  atómica respecto de toda otra operación sobre el mismo evento (constitución, "Operaciones
  atómicas por evento"): el cupo NUNCA queda por debajo de 0, ni ante compras o ediciones
  simultáneas.
- **FR-007**: El sistema DEBE rechazar la compra, sin registrar nada ni cambiar el cupo, si:
  el usuario no está identificado; la cantidad no es un entero entre 1 y 4; el evento no existe;
  el tipo no existe en ese evento; el evento ya se realizó (según el reloj del servidor); el
  comprador es el organizador del evento (FR-008); supera su tope por persona (FR-002a); o el
  cupo disponible es menor que la cantidad (incluido cupo 0). Cada rechazo DEBE tener un mensaje en
  español que la app muestre; el de cupo insuficiente DEBE indicar cuántas entradas quedan.
- **FR-008**: El sistema DEBE rechazar, como regla de negocio (`COMPRA_PROPIO_EVENTO`), la
  compra del organizador del evento sobre ese evento, sin registrar nada ni cambiar el cupo. En
  el detalle de su propio evento, la app NO DEBE ofrecer "Comprar" y DEBE mostrar "Sos el
  organizador de este evento". Refina la constitución ("Roles"), que no lo prohíbe ni lo permite
  expresamente.
- **FR-009**: Un tipo de entrada gratis DEBE poder comprarse con el mismo recorrido, con total 0:
  nace `PENDIENTE`, se confirma con el pago simulado (botón "Confirmar") y vence a los 15 minutos
  si no se confirma. No se confirma sola al comprar.
- **FR-010**: Un comprador DEBE poder hacer varias compras del mismo tipo y evento; cada una es
  una compra independiente.

**Pagar (pago simulado)**

- **FR-011**: El comprador de una compra `PENDIENTE` DEBE poder pagarla sin ingresar datos de
  pago; el pago simulado siempre se acepta y pasa la compra a `CONFIRMADA`.
- **FR-012**: El sistema DEBE rechazar el pago si quien paga no es el comprador de la compra (sin
  permiso), si la compra no existe (no encontrada), si la compra no está `PENDIENTE` (transición
  inválida: solo `PENDIENTE → CONFIRMADA`) o si venció (FR-014b). Que el evento ya haya
  empezado **no** impide pagar una compra pendiente no vencida (Clarifications, 2026-11-12).
- **FR-013**: Verificar y cambiar el estado de la compra DEBE ocurrir bajo la operación atómica
  del evento de la compra (constitución), de modo que dos pagos simultáneos de la misma compra
  produzcan un único cambio a `CONFIRMADA`.
- **FR-014**: Una compra `PENDIENTE` DEBE vencer a los 15 minutos desde su alta (según el reloj
  del servidor; a los 15 minutos exactos ya está vencida): pasa a `CANCELADA`, con un cambio de
  estado cuyo autor es el **sistema** y cuya fecha y hora es la del vencimiento, y su cantidad
  vuelve al cupo disponible del tipo.
- **FR-014a**: El vencimiento DEBE respetar la operación atómica del evento (devolver cupo y
  cambiar el estado de una compra, constitución): una compra nunca se confirma y vence a la vez,
  y su cupo se devuelve una sola vez. El cupo que ven todos los usuarios (detalle, Explorar, Mis
  eventos) y el que se verifica al comprar DEBEN contar como disponibles las entradas de las
  compras ya vencidas, aunque nadie haya consultado esa compra desde que venció.
- **FR-014b**: El sistema DEBE rechazar el pago de una compra vencida (código propio, por
  ejemplo `COMPRA_VENCIDA`), y la compra queda `CANCELADA`. El resumen de pago DEBE indicar
  hasta qué hora se puede pagar.

**Historial y acceso**

- **FR-015**: Todo cambio de estado de una compra, incluido el alta como `PENDIENTE`, DEBE
  registrar un cambio de estado con el estado nuevo, quién lo hizo y la fecha y hora del reloj
  del servidor.
- **FR-016**: El comprador DEBE poder ver una compra suya (evento con nombre y fecha y hora,
  tipo de entrada, cantidad, total y estado actual) para pagarla y ver su confirmación; nadie
  más que su comprador puede verla en esta feature (el organizador la ve desde la 008).
- **FR-017**: El estado de la compra DEBE mostrarse con texto y color, con el único componente
  reutilizable de estados de la app (constitución, principio VII): "Pendiente" y "Confirmada".

**Comportamiento de la app**

- **FR-018**: Confirmar la compra y pagar DEBEN mostrar que están procesando y no aceptar un
  segundo toque mientras el pedido está en curso.
- **FR-019**: Ante un rechazo por cupo insuficiente, tipo inexistente o evento realizado, la app
  DEBE mostrar el mensaje del servidor y actualizar el detalle del evento con los datos reales;
  ante "evento no encontrado", DEBE ofrecer volver a Explorar y dejar de mostrar el evento allí.
- **FR-020**: Comprar y pagar NO DEBEN reintentarse solos; ante el servidor no disponible, la
  app DEBE avisar, conservar lo elegido y permitir reintentar a mano.
- **FR-021**: Si al reintentar un pago la compra ya está `CONFIRMADA`, la app DEBE mostrarla
  confirmada en lugar de un error.
- **FR-022**: Después de una compra o un pago, el detalle del evento, Explorar (cupo y
  "Agotado") y Mis eventos del organizador DEBEN reflejar el cupo nuevo la próxima vez que se
  muestren.
- **FR-023**: El detalle del evento DEBE mostrarle al usuario actual sus compras `PENDIENTE` no
  vencidas de ese evento (tipo, cantidad, total, hasta qué hora puede pagar y estado), cada una
  con "Pagar", que lleva al resumen de pago. Solo ve las propias; las vencidas y las
  confirmadas no aparecen ahí (el listado completo es de la 007). Se actualiza después de
  comprar, pagar, cancelar o al vencer una compra la próxima vez que se muestra el detalle.
- **FR-023a** (revisión, 2026-11-12): Cada compra pendiente del detalle DEBE tener también
  "Cancelar", que, tras confirmarlo, la pasa a `CANCELADA` con un cambio de estado **del
  comprador** (no del sistema) y devuelve sus entradas al cupo disponible, sin esperar los 15
  minutos. Solo su comprador puede cancelarla; una vencida da `COMPRA_VENCIDA` y una que no está
  `PENDIENTE` (por ejemplo, ya confirmada) da `TRANSICION_INVALIDA`: cancelar una confirmada, con
  reembolso, sigue siendo de la 009. Se puede cancelar también con el evento empezado (como al
  vencer). "Tu compra" de una cancelada por el comprador dice "Cancelaste esta compra: sus
  entradas volvieron a estar disponibles.".
- **FR-023b** (revisión, 2026-11-12): Si el usuario tiene compras `CONFIRMADA` de ese evento, el
  detalle DEBE mostrar cuántas entradas confirmadas tiene y "Ver mis entradas", que abre "Mis
  entradas": sus compras confirmadas del evento (tipo, cantidad, total y estado), cada una con
  "Ver", que abre "Tu compra". El listado de todas sus compras sigue siendo de la 007.
- **FR-023c** (revisión, 2026-11-12): El aviso "Ya tenés el máximo de entradas para este evento"
  de un tipo DEBE ocupar una columna angosta a la derecha, como "Comprar", sin quitarles ancho al
  nombre y la descripción del tipo (se parte en varias líneas).

**Datos de ejemplo**

- **FR-024**: Los datos de ejemplo DEBEN permitir demostrar la compra desde el primer arranque:
  un tipo con cupo bajo (para el cupo justo y el agotado), un tipo gratis y un tipo agotado
  (los de la 005 alcanzan), y las compras fijas de la 004, que pasan a tener estado e historial
  coherentes con esta feature.

### Key Entities *(include if feature involves data)*

- **Compra**: la adquisición de una cantidad de entradas de un tipo de un evento por un
  comprador. Tiene comprador, evento, tipo de entrada, cantidad (entero ≥ 1), total fijado al
  comprar, momento del alta, estado actual e historial de cambios de estado. En esta feature
  nace `PENDIENTE` y pasa a `CONFIRMADA` (pago) o a `CANCELADA` (vencimiento a los 15 minutos).
- **CambioEstadoCompra**: un paso del historial de una compra: estado, quién lo hizo (un
  usuario o el **sistema**, en el vencimiento) y fecha y hora del servidor. El primero es
  siempre `PENDIENTE`.
- **TipoEntrada** (de la 004): su **cupo** es la cantidad de entradas disponibles; cada compra
  registrada lo baja en su cantidad.
- **Evento** (de la 004 y la 005): la compra solo se registra si no se realizó; su operación
  atómica protege el cupo de todos sus tipos y el estado de todas sus compras.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un comprador, con los datos de ejemplo, compra y paga entradas desde el detalle de
  un evento en menos de 1 minuto y con no más de 5 toques desde que abre el detalle (Comprar,
  ajustar cantidad, confirmar, Pagar, volver).
- **SC-002**: Con 50 pedidos de compra simultáneos de 1 entrada, de 50 compradores distintos,
  sobre un tipo con cupo 10, se
  registran exactamente 10 compras, se rechazan exactamente 40 por cupo insuficiente y el cupo
  final es 0; en ninguna corrida de esa prueba el cupo queda negativo.
- **SC-003**: El 100 % de los rechazos de la feature (evento realizado, cupo insuficiente,
  cantidad inválida, evento o tipo inexistente, pago ajeno, pago fuera de `PENDIENTE`) llega a
  la app con un mensaje en español y deja el cupo y las compras sin cambios.
- **SC-004**: Después de comprar, el cupo que ve cualquier usuario en el detalle del evento es
  el anterior menos la cantidad comprada, en la primera consulta posterior.
- **SC-005**: Cada regla de la feature (cupo nunca negativo, cupo justo, total calculado por el
  servidor, evento realizado, transiciones `PENDIENTE → CONFIRMADA` y `PENDIENTE → CANCELADA` por
  vencimiento, vencimiento a los 15 minutos exactos, cupo devuelto una sola vez, tope por persona
  acumulado (4 pagas, 1 por tipo gratis) también ante compras simultáneas, organizador que no
  compra en su evento, solo el comprador
  paga, historial con quién y cuándo) tiene al menos un test que la verifica, incluido su caso borde.
- **SC-006**: Ante el servidor caído durante el pago, el comprador nunca termina con dos
  confirmaciones de la misma compra ni con un error cuando el pago en realidad se aceptó.

## Assumptions

- **El cupo se descuenta al registrar la compra (`PENDIENTE`)**, no al pagar: la constitución
  dice que el cupo "disminuye en la cantidad de cada compra que se registra". Una compra
  pendiente reserva entradas hasta pagarse, cancelarse (FR-023a) o vencer a los 15 minutos
  (FR-014).
- **Una compra = un tipo de entrada**, como en el modelo de la consigna (Compra tiene un
  `tipoEntrada` y una `cantidad`). Comprar dos tipos son dos compras.
- **Tope por persona** (Clarifications, 2026-11-12): 4 entradas pagas por evento y 1 por tipo
  gratis, acumuladas entre las compras vigentes del comprador.
- **El pago simulado siempre se acepta**; no hay pago rechazado ni medios de pago. No hay
  pantalla de datos de tarjeta.
- **Un tipo gratis sigue el mismo recorrido** `PENDIENTE → CONFIRMADA` (Clarifications,
  2026-11-12), para respetar una única máquina de estados; solo cambia el texto ("Gratis",
  "Confirmar").
- **El inicio del evento corta el alta, no el pago** (Clarifications, 2026-11-12): con el evento
  empezado no nace ninguna compra nueva, pero una pendiente se puede pagar hasta que venza (y, si
  no, vence igual, también con el evento empezado), según la constitución 2.4.0 (regla
  "Cancelación"): una pendiente puede pasar a `CANCELADA` con el evento empezado, y una
  confirmada se cancela y reembolsa solo hasta que el evento empieza o la entrada se usa
  (feature 009).
- **"Realizado"** es el mismo criterio de la 004 y la 005: desde la fecha y hora de inicio
  (inclusive) según el reloj del servidor.
- **Visibilidad de la compra**: en esta feature solo la ve su comprador, para pagarla y ver la
  confirmación; el listado propio es de la 007 y la vista del organizador, de la 008.
- **Identidad simulada**: el comprador es el usuario actual elegido en la app (constitución,
  principio VI).
- **Dependencias**: 004 (eventos, tipos con cupo, compra mínima y operación atómica por evento) y
  005 (detalle público del evento y su ruta desde Explorar), ambas integradas.
