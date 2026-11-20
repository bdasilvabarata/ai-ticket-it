# Feature Specification: Cancelar compra con reembolso

**Feature Branch**: `feature/009-cancelar-compra`

**Created**: 2026-11-20

**Status**: Draft

**Input**: User description: "Feature 009 — Cancelar compra con reembolso (UC-07 comprador, UC-08 organizador, prioridad P2). Como comprador, si no puedo ir, quiero cancelar una compra CONFIRMADA para que me devuelvan la plata (UC-07). Como organizador, quiero que solo se pueda cancelar una compra que no esté utilizada y cuyo evento todavía no empezó (UC-08). La única transición nueva es CONFIRMADA → CANCELADA → REEMBOLSADA; una CONFIRMADA no se cancela desde el inicio del evento, inclusive; una UTILIZADA, CANCELADA o REEMBOLSADA no se cancela nunca; al cancelar, todas las entradas vuelven al cupo y quedan canceladas, y la compra libera el tope por persona. Plazo ya decidido: hasta que el evento empieza o se usa una entrada. La cancelación de una PENDIENTE (006) no cambia." (descripción completa en la invocación de `/speckit-specify`).

**Casos de uso**:

- UC-07 — *Como comprador, quiero cancelar una compra para obtener el reembolso si no puedo
  asistir.*
- UC-08 — *Como organizador, quiero que se pueda cancelar una compra solo si no está
  **utilizada** y el evento aún no se realizó.*
- Transición `CONFIRMADA → CANCELADA → REEMBOLSADA` de la constitución ("Estados de una compra")
  y regla "Cancelación".

## Alcance

**Incluye**: cancelar desde "Tu compra" una compra `CONFIRMADA` propia cuyo evento no empezó y
que no tiene ninguna entrada usada, con una confirmación previa que dice el monto a devolver; el
paso a `CANCELADA` (autor: el comprador) con la devolución de **todas** sus entradas al cupo de su
tipo, la anulación de sus códigos para "Registrar ingreso" y la liberación del tope por persona;
el **reembolso pendiente** de una compra paga cancelada, que el **organizador confirma** desde
"Compras del evento" y la pasa a `REEMBOLSADA` (autor: el organizador); el motivo por el que una
compra no se puede cancelar, informado por el servidor; los avisos de cada situación en "Tu
compra", en "Mis compras" y en "Compras del evento"; el refresco de todas las vistas afectadas
(las del comprador, las del organizador y el catálogo); los datos de ejemplo que lo hacen
demostrable; las operaciones del servidor que lo sostienen, bajo el cerrojo del evento.

**No incluye**: medios de pago y reembolsos reales (el pago y el reembolso son simulados, como en
la 006); cancelar parte de las entradas de una compra (se cancela siempre la compra entera); que
el organizador cancele la compra de un comprador; un plazo para confirmar el reembolso o un
reembolso automático; rechazar un reembolso; reembolsar compras gratis o pendientes canceladas;
cancelar el evento entero; cambiar la cancelación de una `PENDIENTE` (006); deshacer una
cancelación o un reembolso; un botón de cancelar en la lista de "Mis compras"; notificaciones al
comprador o al organizador; chat (010); reseñas (011); pulido estético (013).

## Clarifications

### Session 2026-11-20

- Q: ¿El reembolso es inmediato o lo confirma el organizador? → A: lo **confirma el organizador**
  desde "Compras del evento", **sin plazo** (también con el evento ya realizado). Al cancelar, la
  compra queda `CANCELADA` con el reembolso pendiente (el cupo vuelve en ese momento); cuando el
  organizador lo confirma, pasa a `REEMBOLSADA` con él como autor. Mientras tanto, el comprador ve
  que el reembolso está pendiente y el organizador, que tiene un reembolso por confirmar.
- Q: Una compra gratis ($ 0) confirmada que se cancela, ¿pasa a `REEMBOLSADA`? → A: **no**: las
  gratis no se reembolsan. Queda `CANCELADA` (estado final), sin reembolso pendiente ni acción del
  organizador.
- Q: ¿Con qué código se rechaza cancelar una confirmada con el evento ya empezado? → A: con el
  existente **`EVENTO_REALIZADO`** (el del alta de compras), con un mensaje propio: "El evento ya
  empezó: ya no se puede cancelar la compra". No se suma un código nuevo.
- Q: Una compra `UTILIZADA`, `CANCELADA` o `REEMBOLSADA` con el evento ya empezado, ¿qué rechazo
  recibe al cancelarla? → A: **`TRANSICION_INVALIDA`** siempre. `EVENTO_REALIZADO` es una regla de
  la transición `CONFIRMADA → CANCELADA` y solo se chequea cuando la compra está `CONFIRMADA` (la
  `PENDIENTE` sigue como en la 006). El motivo de una `UTILIZADA` en "Tu compra" es siempre "Ya
  usaste una entrada".
- Q: En "Tu compra", ¿la lista de entradas de una compra cancelada o reembolsada desaparece o se
  muestra marcada como cancelada? → A: **desaparece**: como en la 008, las entradas con sus
  códigos solo se muestran en una `CONFIRMADA` o una `UTILIZADA`; en una `CANCELADA` o
  `REEMBOLSADA` solo se ven el estado y su aviso.

## User Scenarios & Testing *(mandatory)*

Los actores son el **comprador** (el usuario actual en su relación con una compra propia) y el
**organizador** del evento de esa compra, que no cancela, confirma los reembolsos y es para quien
rige la regla de UC-08 (constitución, "Roles").

### User Story 1 - Cancelar una compra confirmada (Priority: P1)

Un comprador que pagó sus entradas y ya no puede ir abre "Tu compra", toca "Cancelar compra",
confirma después de ver cuánto se le va a devolver, y la compra queda cancelada: sus entradas
dejan de valer, vuelven a estar a la venta y el reembolso queda pendiente de que lo confirme el
organizador.

**Why this priority**: es UC-07 en sentido estricto y la transición de la constitución que falta
implementar. Sin ella, una compra pagada no tiene salida.

**Independent Test**: con los datos de ejemplo, elegir a Martín, abrir su compra de "Festival
Sonidos del Sur" (2 VIP, confirmada) desde "Mis compras", tocar "Cancelar compra", ver el monto en
la confirmación, confirmar y ver la compra "Cancelada" con el aviso del reembolso pendiente;
verificar que en el detalle del festival el cupo de VIP subió 2 y que Martín puede volver a
comprar hasta su tope; verificar por el lado del servidor que el historial tiene el cambio a
`CANCELADA` con Martín como autor y la fecha y hora.

**Acceptance Scenarios**:

1. **Given** una compra `CONFIRMADA` propia, sin entradas usadas, de un evento que todavía no
   empezó según el reloj del servidor, **When** el comprador abre "Tu compra", **Then** ve
   "Cancelar compra".
2. **Given** "Cancelar compra", **When** el comprador lo toca, **Then** la app le pide
   confirmación diciendo cuántas entradas se cancelan, el monto que se le devuelve (el total
   fijado al comprar) y que el organizador confirma el reembolso, y que no se puede deshacer; si
   no confirma, nada cambia.
3. **Given** la confirmación, **When** el servidor cancela la compra, **Then** la compra pasa a
   `CANCELADA` con un cambio de estado cuyo autor es el comprador y la fecha y hora del servidor,
   y queda con su **reembolso pendiente**.
4. **Given** la compra cancelada, **When** se consulta el evento, **Then** el cupo de su tipo de
   entrada subió exactamente en la cantidad de la compra (sin esperar al reembolso), también en el
   catálogo y en el detalle que ven los demás usuarios; un tipo que estaba agotado vuelve a estar
   disponible.
5. **Given** la compra cancelada, **When** se consultan sus entradas, **Then** todas figuran
   canceladas y sus códigos dejan de mostrarse: "Tu compra" ya no muestra la lista de entradas
   (solo el estado y el aviso) y "Ver mis entradas" ya no la incluye.
6. **Given** el código de una entrada de una compra cancelada (con o sin reembolso confirmado),
   **When** el organizador lo ingresa en "Registrar ingreso", **Then** se le informa que esa
   entrada no se puede usar porque la compra se canceló, y nada cambia.
7. **Given** un comprador que había llegado a su tope por persona en ese evento, **When** cancela
   una de sus compras confirmadas, **Then** esas entradas dejan de contar para el tope y puede
   volver a comprar hasta él.
8. **Given** una compra confirmada de entradas gratis (total 0), **When** el comprador la cancela,
   **Then** se cancela igual, sus entradas vuelven al cupo y queda `CANCELADA` como estado final,
   sin reembolso pendiente; la confirmación no habla de un monto a devolver.
9. **Given** la cancelación terminada, **When** el comprador vuelve a "Tu compra", **Then** ve el
   estado con texto y color y el aviso de lo que pasó: en una paga, "Cancelaste esta compra. El
   organizador tiene que confirmar el reembolso de $ 240.000"; en una gratis, "Cancelaste esta
   compra".

---

### User Story 2 - Confirmar el reembolso (Priority: P1)

El organizador abre "Compras del evento" y ve las compras canceladas por sus compradores con el
reembolso pendiente y su monto; confirma el reembolso de cada una y la compra pasa a
`REEMBOLSADA`. El comprador ve que ya le devolvieron la plata.

**Why this priority**: es la otra mitad de UC-07 ("obtener el reembolso") y la única forma de
llegar a `REEMBOLSADA`. Sin ella, una compra cancelada queda con el reembolso pendiente para
siempre.

**Independent Test**: con los datos de ejemplo, elegir a Lucía, abrir las compras de un evento
suyo que tenga una compra cancelada con reembolso pendiente, ver el monto y la acción "Confirmar
reembolso", confirmar y ver la compra "Reembolsada"; elegir al comprador y ver en "Mis compras" y
en "Tu compra" el aviso "Te devolvimos $ X"; verificar por el lado del servidor que el historial
suma el cambio a `REEMBOLSADA` con Lucía como autora, que el cupo no cambió y que un usuario que no
es el organizador (incluido el comprador) no puede confirmarlo.

**Acceptance Scenarios**:

1. **Given** una compra `CANCELADA` por su comprador después de confirmada y con total mayor que
   0, **When** el organizador abre "Compras del evento", **Then** la fila indica "Reembolso
   pendiente" con el monto y ofrece "Confirmar reembolso".
2. **Given** "Confirmar reembolso", **When** el organizador lo toca, **Then** la app le pide
   confirmación con el comprador y el monto, avisando que no se puede deshacer; si no confirma,
   nada cambia.
3. **Given** la confirmación, **When** el servidor registra el reembolso, **Then** la compra pasa
   a `REEMBOLSADA` con un cambio de estado cuyo autor es el organizador y la fecha y hora del
   servidor; el cupo y las entradas no cambian (el cupo ya había vuelto al cancelar).
4. **Given** el reembolso confirmado, **When** el comprador abre "Mis compras" o "Tu compra",
   **Then** ve la compra "Reembolsada" con el aviso "Te devolvimos $ X".
5. **Given** el reembolso pendiente, **When** el comprador abre "Mis compras" o "Tu compra" antes
   de que el organizador lo confirme, **Then** ve la compra "Cancelada" con el aviso del reembolso
   pendiente y su monto.
6. **Given** una compra `CANCELADA` que no tiene reembolso pendiente (una pendiente cancelada por
   el comprador, una vencida o una gratis), o una ya `REEMBOLSADA`, **When** se intenta confirmar
   su reembolso, **Then** se rechaza como transición inválida y nada cambia; la app no ofrece la
   acción.
7. **Given** un usuario que no es el organizador del evento (incluido el comprador), **When**
   intenta confirmar un reembolso, **Then** se le niega el acceso y nada cambia; sin usuario se
   rechaza como no identificado y una compra inexistente, como inexistente.
8. **Given** un evento ya realizado (empezó, en solo lectura como en la 004), **When** el
   organizador abre sus compras, **Then** igual puede confirmar los reembolsos pendientes: no hay
   plazo.
9. **Given** dos pedidos de confirmación del mismo reembolso (doble toque o dos dispositivos),
   **When** el servidor los procesa, **Then** uno solo tiene éxito y el historial suma un único
   cambio a `REEMBOLSADA`; el otro se rechaza porque ya se reembolsó.

---

### User Story 3 - Que no se pueda cancelar lo que ya no corresponde (Priority: P1)

Ni el comprador ni nadie puede cancelar una compra cuyo evento ya empezó, que tiene alguna entrada
usada o que ya está cancelada o reembolsada; cuando no se puede, el comprador ve por qué en lugar
del botón.

**Why this priority**: es UC-08 en sentido estricto. Una cancelación fuera de regla reembolsa lo
que no corresponde o devuelve al cupo una entrada que alguien ya usó.

**Independent Test**: con el reloj del servidor fijado, intentar cancelar una confirmada a la hora
exacta de inicio del evento y un minuto antes (se rechaza / se acepta); con los datos de ejemplo,
elegir a Martín y abrir su compra de "Peña en La Rueda" (1 de 3 entradas usadas): no hay botón y
dice "Ya usaste una entrada"; verificar por el lado del servidor que cancelar una `UTILIZADA`, una
`CANCELADA`, una `REEMBOLSADA` o una compra ajena se rechaza sin cambiar nada.

**Acceptance Scenarios**:

1. **Given** una compra `CONFIRMADA` cuyo evento empieza ahora o ya empezó según el reloj del
   servidor (a la hora exacta de inicio, inclusive), **When** se intenta cancelar, **Then** el
   servidor lo rechaza porque el evento ya empezó (el mismo conflicto de "evento realizado" que
   ya usa el alta de compras, con un mensaje propio de la cancelación), y nada cambia.
2. **Given** una compra `CONFIRMADA` cuyo evento empieza dentro de un minuto, **When** se cancela,
   **Then** se acepta (no hay plazo extra antes del inicio).
3. **Given** una compra `UTILIZADA` (al menos una entrada usada, aunque le queden otras sin usar),
   **When** se intenta cancelar, **Then** se rechaza como transición inválida y nada cambia: ni la
   compra ni sus entradas sin usar.
4. **Given** una compra `CANCELADA` (con o sin reembolso pendiente) o `REEMBOLSADA`, **When** se
   intenta cancelar de nuevo, **Then** se rechaza como transición inválida y nada cambia (el cupo
   no se devuelve dos veces).
5. **Given** una compra de otro usuario (incluido el organizador del evento), **When** se intenta
   cancelar, **Then** se niega el acceso y nada cambia; sin usuario identificado se rechaza como
   no identificado y una compra inexistente, como inexistente.
6. **Given** una compra confirmada que no se puede cancelar, **When** el comprador abre "Tu
   compra", **Then** en lugar de "Cancelar compra" ve el motivo que informa el servidor: "El
   evento ya empezó" o "Ya usaste una entrada"; la app no lo calcula por su cuenta.
7. **Given** un pedido de cancelación inválido por varias razones a la vez, **When** el servidor
   lo procesa, **Then** responde en este orden: usuario no identificado → datos inválidos →
   compra inexistente → sin permiso → evento ya empezado (solo si la compra está `CONFIRMADA`) →
   transición inválida. Una `UTILIZADA`, `CANCELADA` o `REEMBOLSADA` se rechaza como transición
   inválida aunque el evento ya haya empezado.
8. **Given** una compra `PENDIENTE`, **When** el comprador la cancela, **Then** sigue funcionando
   como en la 006 (también con el evento empezado, autor el comprador, sin reembolso).

---

### User Story 4 - Operaciones que compiten (Priority: P2)

Durante la ventana de uso (desde 4 h antes del inicio), el organizador puede registrar el ingreso
de una entrada mientras el comprador intenta cancelar la misma compra. Solo una de las dos cosas
pasa, nunca las dos.

**Why this priority**: es el caso borde que deja la 008 para esta feature; protege la regla de que
una `UTILIZADA` no se cancela y de que no se usa una entrada cancelada. Es raro en la práctica,
por eso P2.

**Independent Test**: con el reloj fijado dentro de la ventana de uso y antes del inicio, lanzar
a la vez el uso de una entrada y la cancelación de su compra: una sola tiene éxito y la otra se
rechaza con su motivo; repetir varias veces y verificar que el historial y el cupo siempre son
coherentes.

**Acceptance Scenarios**:

1. **Given** un pedido de uso de una entrada y uno de cancelación de su compra que llegan a la vez,
   **When** el servidor los procesa, **Then** gana el primero que toma el cerrojo del evento: si
   fue el uso, la cancelación se rechaza como transición inválida; si fue la cancelación, el uso
   se rechaza porque la entrada está cancelada.
2. **Given** dos pedidos de cancelación de la misma compra (doble toque o dos dispositivos),
   **When** el servidor los procesa, **Then** uno solo tiene éxito; el cupo se devuelve una sola
   vez y el historial suma un único cambio a `CANCELADA`.
3. **Given** una cancelación concurrente con una compra nueva del mismo tipo de entrada, **When**
   ambas terminan, **Then** el cupo final es el inicial menos lo comprado más lo devuelto, nunca
   negativo ni de más.
4. **Given** un evento que empieza entre que el comprador abrió "Tu compra" y tocó "Cancelar",
   **When** confirma, **Then** el servidor lo rechaza porque el evento ya empezó (con el reloj
   leído en el momento de cancelar) y la app muestra el estado real.

---

### User Story 5 - Ver el resultado en todas las pantallas (Priority: P2)

Después de cancelar o de confirmar un reembolso, comprador y organizador ven el resultado en sus
pantallas, aunque se haya perdido la respuesta o el otro tuviera la pantalla abierta.

**Why this priority**: da confianza en lo anterior; no habilita nada nuevo.

**Independent Test**: cancelar una compra y recorrer "Tu compra", "Mis compras", el detalle del
evento, el catálogo y, como el organizador, "Compras del evento": todos muestran el estado y el
cupo nuevos; confirmar el reembolso y volver a las pantallas del comprador; simular la pérdida de
la respuesta y verificar que se muestra el estado real; cortar el servidor y verificar el error.

**Acceptance Scenarios**:

1. **Given** una compra cancelada con reembolso pendiente o reembolsada, **When** el comprador
   abre "Mis compras", **Then** su fila muestra el estado con texto y color y su aviso con el
   monto, distinto del de una pendiente vencida o cancelada sin pagar; en la fila no hay botón
   para cancelar.
2. **Given** una compra cancelada después de confirmada, **When** el organizador abre "Compras del
   evento", **Then** la ve con su estado, con quién la canceló (el comprador) y, si es paga, con
   el reembolso pendiente o confirmado; el resumen por tipo muestra sus entradas fuera de
   "vendidas" y de vuelta en "disponibles".
3. **Given** un pedido de cancelación o de confirmación de reembolso cuya respuesta se pierde,
   **When** el usuario vuelve a mirar la pantalla, **Then** ve el estado real que devuelve el
   servidor; la escritura no se reintenta sola.
4. **Given** un doble toque en una acción o en su confirmación, **When** se procesa, **Then** la
   app manda un solo pedido mientras el primero está en curso.
5. **Given** el servidor caído, **When** falla el pedido, **Then** la app informa el error como
   en el resto de la app y, al volver, muestra el estado que devuelva el servidor.
6. **Given** un rechazo del servidor (evento empezado, entrada usada, ya cancelada, ya
   reembolsada), **When** la app lo recibe, **Then** muestra el mensaje del servidor y vuelve a
   pedir los datos para mostrar el estado real.
7. **Given** un cambio de usuario, **When** el nuevo usuario abre la app, **Then** nunca ve las
   compras ni las acciones del usuario anterior.

### Edge Cases

- Cancelar exactamente a la hora de inicio del evento: se rechaza (inclusive); un minuto antes,
  se acepta.
- Evento que empieza mientras "Tu compra" está abierta: el botón puede seguir visible hasta que la
  pantalla se refresque, pero el servidor rechaza la cancelación con el reloj leído al cancelar.
- Compra con una entrada usada y otras sin usar (`UTILIZADA`): no se cancela, ni ella ni las
  entradas sin usar; el motivo es "Ya usaste una entrada", también con el evento ya empezado (el
  rechazo es transición inválida, no evento realizado).
- Compra gratis confirmada: se cancela, libera su cupo y su tope por tipo gratis y queda
  `CANCELADA` sin reembolso.
- Reembolso confirmado mucho después del evento: se acepta (sin plazo).
- El organizador intenta usar una entrada de una compra con reembolso pendiente: se rechaza
  porque la compra está cancelada.
- Evento agotado que recupera cupo al cancelar: vuelve a figurar disponible en el catálogo y en
  el detalle.
- Volver a comprar después de cancelar: el tope por persona ya no cuenta la compra cancelada,
  aunque su reembolso siga pendiente.
- Pendiente vencida "al día" que el comprador intenta cancelar: sigue la regla de la 006 (se
  responde que venció).
- Uso y cancelación simultáneos sobre la misma compra: gana el primero que toma el cerrojo.
- Doble toque, respuesta perdida, servidor caído: un solo pedido, sin reintentos automáticos, y
  la pantalla se dibuja con el estado real.
- Compra de otro usuario: el comprador no puede cancelar compras ajenas, el organizador no puede
  cancelar compras de su evento y el comprador no puede confirmar su propio reembolso.
- Cambio de usuario: no se ve nada del anterior.
- Evento borrado: no aplica, porque un evento con compras no se puede borrar (004).

## Requirements *(mandatory)*

### Functional Requirements

**Cancelar (comprador)**

- **FR-001**: El comprador DEBE poder cancelar una compra propia `CONFIRMADA`, sin entradas
  usadas, mientras su evento no haya empezado según el reloj del servidor; siempre la compra
  entera, con todas sus entradas.
- **FR-002**: La cancelación DEBE registrar el cambio a `CANCELADA` con el comprador como autor y
  la fecha y hora del servidor. Si el total de la compra es mayor que 0, la compra queda con su
  **reembolso pendiente**; si es 0, `CANCELADA` es su estado final.
- **FR-003**: Al cancelarse, todas las entradas de la compra DEBEN volver al cupo disponible de su
  tipo (exactamente la cantidad de la compra, una sola vez, en el momento de cancelar) y quedar
  canceladas: sus códigos ya no pueden usarse para registrar un ingreso y dejan de llegarle al
  comprador (la vista de una `CANCELADA` o `REEMBOLSADA` no trae entradas).
- **FR-004**: Una compra cancelada o reembolsada NO DEBE contar para el tope por persona, tenga o
  no el reembolso pendiente.
- **FR-005**: El monto a devolver DEBE ser el total fijado al comprar; el cliente no envía montos.
- **FR-006**: Cancelar una compra `PENDIENTE` DEBE seguir como en la 006; una pendiente cancelada
  (por el comprador o al vencer) nunca tiene reembolso.

**Reglas de cancelación (UC-08)**

- **FR-007**: Una compra `CONFIRMADA` NO DEBE poder cancelarse desde la fecha y hora de inicio de
  su evento, inclusive, según el reloj del servidor leído al cancelar; no hay otro plazo.
- **FR-008**: Una compra `UTILIZADA` NO DEBE poder cancelarse nunca, aunque le queden entradas sin
  usar; tampoco una `CANCELADA` ni una `REEMBOLSADA`. El rechazo es una transición inválida y no
  cambia nada.
- **FR-009**: Solo el comprador DEBE poder cancelar su compra; a cualquier otro usuario, incluido
  el organizador del evento, el sistema DEBE negarle el acceso. Sin usuario, se rechaza como no
  identificado; una compra inexistente, como inexistente.
- **FR-010**: Los rechazos de la cancelación DEBEN seguir el orden de US3, escenario 7. El
  rechazo por evento ya empezado (`EVENTO_REALIZADO`) solo se aplica a una compra `CONFIRMADA`;
  cualquier otro estado no cancelable se rechaza como transición inválida, empiece o no el evento,
  y la `PENDIENTE` sigue la regla de la 006 (una vencida "al día" se rechaza porque venció, antes
  que el evento empezado y la transición inválida).

**Confirmar el reembolso (organizador)**

- **FR-011**: El organizador del evento DEBE poder confirmar el reembolso de una compra
  `CANCELADA` con reembolso pendiente; la compra pasa a `REEMBOLSADA` con un cambio de estado
  cuyo autor es el organizador y la fecha y hora del servidor. Confirmar el reembolso NO DEBE
  cambiar el cupo ni las entradas.
- **FR-012**: El reembolso NO DEBE tener plazo: se puede confirmar en cualquier momento, también
  con el evento realizado. No se rechaza ni vence: queda pendiente hasta que el organizador lo
  confirma.
- **FR-013**: Solo el organizador del evento DEBE poder confirmar un reembolso; a cualquier otro
  usuario, incluido el comprador, el sistema DEBE negarle el acceso. Confirmar el reembolso de una
  compra sin reembolso pendiente (en cualquier otro estado, una cancelada sin pagar, una gratis o
  una ya reembolsada) DEBE rechazarse como transición inválida sin cambiar nada. Orden de los
  rechazos: usuario no identificado → datos inválidos → compra inexistente → sin permiso →
  transición inválida.

**Atomicidad**

- **FR-014**: Verificar las reglas y cancelar, y verificar y confirmar un reembolso, DEBEN ocurrir
  bajo el cerrojo del evento de la compra, volviendo a leer el reloj, el evento y la compra
  adentro (constitución, "Operaciones atómicas por evento"); al cancelar, se guarda primero la
  compra y después el evento con el cupo devuelto (nunca se ve cupo de más). Una cancelación y un
  uso de entrada, dos cancelaciones o dos confirmaciones de la misma compra nunca se aplican las
  dos.

**Lo que informa el servidor**

- **FR-015**: Al consultar una compra propia ("Tu compra") el servidor DEBE informar si se puede
  cancelar y, si no, por qué (evento ya empezado, entrada usada, ya cancelada o reembolsada),
  calculado "al día" con su reloj y sin guardar nada; la app no decide por su cuenta.
- **FR-016**: Las vistas de compras del comprador ("Tu compra", "Mis compras") y del organizador
  ("Compras del evento") DEBEN distinguir una compra cancelada después de confirmada de una
  pendiente vencida o cancelada sin pagar, con quién la canceló y, si es paga, si el reembolso está
  pendiente o confirmado y su monto. "Compras del evento" DEBE indicar en cada compra si su
  reembolso se puede confirmar.

**App**

- **FR-017**: "Tu compra" DEBE mostrar "Cancelar compra" en una `CONFIRMADA` cancelable y, si no
  lo es, el motivo en su lugar ("El evento ya empezó", "Ya usaste una entrada"). En "Mis compras"
  NO DEBE haber botón de cancelar.
- **FR-018**: Antes de cancelar una confirmada, la app DEBE pedir confirmación con la cantidad de
  entradas y el monto que se devuelve (o sin monto si es gratis), avisando que el reembolso lo
  confirma el organizador y que no se puede deshacer.
- **FR-019**: Los avisos DEBEN acompañar siempre al estado con texto y color (componente único de
  estado) en "Tu compra" y en la fila de "Mis compras": cancelada con reembolso pendiente ("El
  organizador tiene que confirmar el reembolso de $ X"), reembolsada ("Te devolvimos $ X") y
  cancelada gratis ("Cancelaste esta compra").
- **FR-020**: "Compras del evento" DEBE mostrar en la fila de una compra con reembolso pendiente
  "Reembolso pendiente" con el monto y la acción "Confirmar reembolso", que pide confirmación con
  el comprador y el monto; en una reembolsada, que el reembolso se confirmó.
- **FR-021**: Las escrituras (cancelar y confirmar el reembolso) NO DEBEN reintentarse solas;
  mientras una está en curso, la app NO DEBE mandar otro pedido. Al terminar (con éxito o error),
  la app DEBE volver a pedir las vistas que esa acción afecta, también las de otro usuario que
  estén guardadas en la app (comprador y organizador pueden usar el mismo dispositivo). Cancelar
  afecta la compra, "Mis compras", las compras del evento del comprador, el evento, el catálogo,
  las compras del evento del organizador y la entrada buscada en "Registrar ingreso". Confirmar el
  reembolso afecta las mismas salvo el evento y el catálogo, porque no cambia el cupo.
- **FR-022**: Ante un rechazo, la app DEBE mostrar el mensaje del servidor y redibujar la pantalla
  con el estado real; ante una respuesta perdida o el servidor caído, igual.
- **FR-023**: Los controles nuevos DEBEN ser accesibles (los botones con su texto; el motivo y los
  avisos leídos como texto; "Confirmar reembolso" enfocable aparte de la fila, que no es tocable)
  y usables en 360 px de ancho.

**Datos de ejemplo**

- **FR-024**: Los datos de ejemplo DEBEN incluir al menos: una compra `CONFIRMADA` cancelable de
  un evento futuro (la de Martín en "Festival Sonidos del Sur"); una `CONFIRMADA` de "Peña en La
  Rueda", que se puede cancelar hasta su inicio, unas 2 h después del arranque (la de Sofía); una
  `UTILIZADA` que muestre que no se cancela (la de Martín en la Peña); una compra `CANCELADA` por
  su comprador con el **reembolso pendiente**, para demostrar la confirmación del organizador; y
  una `REEMBOLSADA`, en eventos de un organizador del seed y sin interferir con las demás demos.

### Key Entities

- **Compra** (existente, 006/008): suma la cancelación de una `CONFIRMADA` por su comprador
  (`CONFIRMADA → CANCELADA`, sus entradas canceladas y su cupo devuelto) y el reembolso por el
  organizador (`CANCELADA → REEMBOLSADA`). Una cancelada tiene reembolso pendiente si y solo si
  venía de `CONFIRMADA` y su total es mayor que 0, hasta que se confirma. Informa, "al día", si se
  puede cancelar y por qué no.
- **Entrada** (existente, 008): al cancelarse su compra confirmada pasa a cancelada (y no se puede
  usar); el reembolso no la cambia.
- **CambioEstadoCompra** (existente): el de la cancelación tiene al comprador como autor; el del
  reembolso, al organizador.
- **TipoEntrada** (existente, 004): recupera en su cupo disponible la cantidad de la compra
  cancelada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un comprador cancela una compra confirmada en 3 toques o menos desde "Tu compra"
  (incluida la confirmación) y ve el resultado al instante.
- **SC-002**: Un organizador confirma un reembolso en 2 toques desde "Compras del evento"
  (la acción y su confirmación).
- **SC-003**: El 100 % de los intentos de cancelar fuera de regla (evento empezado, a la hora de
  inicio inclusive, compra utilizada, cancelada, reembolsada o ajena) y de confirmar reembolsos
  que no corresponden se rechazan sin cambiar estado, cupo ni historial.
- **SC-004**: Después de cada cancelación, el cupo disponible del tipo sube exactamente en la
  cantidad de la compra, y lo ven igual el comprador, el organizador y cualquier otro usuario en
  el catálogo y el detalle; confirmar el reembolso no lo cambia.
- **SC-005**: Ante N pedidos simultáneos de cancelación y uso sobre la misma compra, se aplica
  exactamente una operación y el cupo final es coherente en el 100 % de las repeticiones.
- **SC-006**: Todo código de una entrada de una compra cancelada o reembolsada se rechaza al
  registrar el ingreso.
- **SC-007**: En el 100 % de los casos, "Tu compra" muestra el botón o el motivo, y "Compras del
  evento" la acción de reembolso, según lo que informa el servidor, sin que la app calcule la
  regla.

## Assumptions

- Se cancela siempre la compra entera (como en la 006); cancelar entradas sueltas queda fuera.
- El organizador no cancela compras: UC-08 es una regla que el sistema hace cumplir; su única
  acción nueva es confirmar el reembolso. Cancelar un evento entero tampoco es de esta feature.
- Se reutiliza la operación de cancelación de la 006 (la misma acción del comprador sobre su
  compra), que ahora acepta también una `CONFIRMADA`; confirmar el reembolso es una operación
  nueva del organizador sobre la compra. El plan define sus contratos.
- El cupo vuelve al cancelar, no al reembolsar (constitución, "Cancelación": *las entradas de una
  compra cancelada vuelven al cupo*); el reembolso es solo un registro de que se devolvió la
  plata.
- "Empezó" es lo mismo que "realizado" en el resto de la app (fecha y hora de inicio, inclusive,
  según el reloj del servidor).
- El reembolso es simulado: no hay medio de pago real ni movimientos de dinero; el monto es el
  total de la compra.
- Que el reembolso dependa del organizador y no tenga plazo refina la constitución sin
  contradecirla: la transición `CANCELADA → REEMBOLSADA` existe y registra quién y cuándo. Que las
  gratis no lleguen a `REEMBOLSADA` tampoco la contradice (la transición es posible, no
  obligatoria).
- "Compras del evento" no suma filtros: la fila de una compra con reembolso pendiente se
  distingue por su texto y su acción. Un contador de reembolsos pendientes, si hiciera falta, lo
  propone el plan.
- Una cancelada o reembolsada deja de figurar entre las entradas válidas del comprador ("Ver mis
  entradas" solo lista confirmadas y utilizadas, 008), pero sigue en "Mis compras" y en "Compras
  del evento" con su estado.
- Las lecturas siguen "al día" y sin guardar nada (006): el motivo de no cancelable y si hay
  reembolso por confirmar se calculan al consultar.
- La compra de Sofía en la Peña sirve tanto para la demo de "Registrar ingreso" (008) como para la
  de cancelar: usar una entrada impide cancelarla; reiniciar el servidor vuelve al estado del seed.
- Depende de 007 ("Mis compras", `canceladaPor`) y usa 006 (compra, historial, vencimiento
  perezoso, "Tu compra", cancelación de pendientes) y 008 (entradas con código, uso bajo el
  cerrojo, "Compras del evento", su lectura del organizador).
