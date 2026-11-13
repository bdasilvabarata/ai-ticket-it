# Feature Specification: Mis compras

**Feature Branch**: `feature/007-mis-compras`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "Feature 007 — Mis compras (UC-01, prioridad P1). Depende de 006: la entidad Compra con su historial de estados, el vencimiento perezoso de las PENDIENTE a los 15 minutos, la pantalla "Tu compra" (compras/[compraId]), "Ver mis entradas" y EtiquetaEstadoCompra, el único componente que muestra el estado con texto y color. Hoy la pestaña "Mis compras" muestra la sección pendiente. Qué quiero: el usuario actual ve en la pestaña "Mis compras" todas las compras que hizo como comprador, de todos los eventos, en una sola lista. El estado tiene que distinguirse bien, siempre con texto y color, nunca solo con color. Si la compra está CONFIRMADA, se muestran también los días que faltan para el evento. Cada fila muestra: nombre del evento, fecha y hora del evento, tipo de entrada, cantidad, total ("Gratis" si es $ 0) y estado. [default: una fila por compra; dos compras del mismo evento son dos filas] Según el estado: PENDIENTE: hasta qué hora se puede pagar, y "Pagar" lleva a "Tu compra". CONFIRMADA: los días restantes. CANCELADA: sin acciones. Una pendiente vencida se muestra ya CANCELADA, aunque nadie la haya materializado, con las mismas reglas de lectura "al día" que la 006. UTILIZADA y REEMBOLSADA: todavía no ocurren (llegan con la 008 y la 009), pero la lista ya tiene que mostrarlas bien. [default: tocar una fila abre "Tu compra"] Días restantes: los calcula el servidor al consultar, sin persistirlos, en la zona horaria America/Argentina/Buenos_Aires (constitución, "Días restantes"). Marcá como [NEEDS CLARIFICATION]: si se cuentan días de calendario o bloques de 24 horas; qué se muestra el mismo día del evento y al día siguiente (¿"Hoy"/"Mañana"?); qué muestra una CONFIRMADA cuyo evento ya empezó o ya se realizó. Orden de la lista: [NEEDS CLARIFICATION] ¿por fecha del evento, por fecha de compra, o agrupada por estado? ¿Hay filtro por estado o se muestran todas juntas? La pantalla tiene los cuatro estados (cargando, error, vacío y datos). El vacío ("Todavía no compraste entradas") tiene una acción que lleva a Explorar. La lista se refresca al volver a la pestaña y después de comprar, pagar o cancelar (las mutations de la 006). Al cambiar de usuario, nunca muestra compras de otro. En el servidor: un endpoint de listado de las compras del usuario actual, que requiere usuario. Cada compra trae lo necesario para la fila (evento, tipo, días restantes) sin que la app tenga que pedir cada evento por separado. Fuera de alcance: cancelar y reembolsar una compra confirmada (009); las compras de un evento vistas por su organizador y registrar el uso (008); el chat de la compra (010); reseñar (011); paginación, búsqueda dentro de mis compras y notificaciones; pulido estético (013). Casos borde: usuario sin compras; compra pendiente que vence mientras la lista está abierta; evento que empieza o se realiza con una compra confirmada; evento del día siguiente comprado a las 23:59; compras de un evento que dejó de estar en el catálogo; cambio de usuario; servidor caído. Cualquier hueco, además de los que marqué, ponelo como [NEEDS CLARIFICATION]."

**Casos de uso**:

- UC-01 — *Como comprador, quiero visualizar mis compras, diferenciando claramente el estado y
  cuántos días faltan para el evento si está confirmada.*

## Alcance

**Incluye**: la pestaña **"Mis compras"** (hoy una sección pendiente) con **todas las compras
del usuario actual como comprador**, de todos los eventos, en una sola lista; por compra, el
evento (nombre, fecha y hora), el tipo de entrada, la cantidad, el total y el **estado con texto
y color**; los **días restantes** hasta el evento en las compras `CONFIRMADA`, calculados por el
servidor al consultar; hasta qué hora se puede pagar y "Pagar" en las `PENDIENTE`; las
pendientes vencidas mostradas ya como `CANCELADA` (lectura "al día" de la 006); abrir "Tu compra"
(de la 006) desde cada fila; los cuatro estados de la pantalla; el refresco al volver a la
pestaña y después de comprar, pagar o cancelar; el aislamiento entre usuarios; la consulta del
servidor que devuelve la lista con todo lo que cada fila necesita.

**No incluye**: cancelar y reembolsar una compra confirmada (009, UC-07 y UC-08); las compras de
un evento vistas por su organizador y registrar el uso → `UTILIZADA` (008, UC-02); el chat de la
compra (010); reseñar (011); paginación, búsqueda dentro de mis compras y notificaciones
(por ejemplo, avisar que una pendiente está por vencer o que el evento es mañana); pulido
estético (013). Las acciones propias de `UTILIZADA` y `REEMBOLSADA` llegan con sus features: acá
solo se muestran.

## Clarifications

### Session 2026-11-12

- Q: ¿Cómo se cuentan y se muestran los días que faltan para el evento en una compra
  confirmada? → A: días de calendario en Buenos Aires (fecha del evento − fecha de hoy); 0 →
  "Hoy · HH:MM" (hora del evento), 1 → "Mañana", N ≥ 2 → "Faltan N días". El servidor devuelve el
  número y la app arma el texto.
- Q: ¿Qué muestra la fila de una compra confirmada cuando su evento ya empezó? → A: "Evento
  realizado" en lugar de los días; el servidor manda `diasRestantes: null` y el `realizado` del
  evento.
- Q: ¿En qué orden se muestran las compras y hay filtro por estado? → A: sin filtro; primero las
  de eventos no realizados por fecha del evento ascendente, después las de eventos realizados
  por fecha descendente; desempate: fecha de compra más reciente primero, después id.
- Q: Con la lista abierta, ¿qué pasa con una pendiente cuando llega su hora límite? → A: se
  actualiza sola: la app vuelve a pedir la lista al llegar la hora límite más próxima de las
  pendientes mostradas, y el servidor la devuelve `CANCELADA`.
- Q: ¿La fila de una cancelada distingue si venció o si la canceló el comprador? → A: sí:
  "Cancelada" más "Venció sin pagarse" o "La cancelaste"; el servidor manda quién la canceló
  (sistema o comprador), no el historial.

## User Scenarios & Testing *(mandatory)*

El actor es el **comprador**: el usuario actual en su relación con las compras que hizo
(constitución, "Roles"). Un usuario que además organiza eventos ve acá solo lo que compró, nunca
las compras de sus eventos (eso es de la 008); y no tiene compras de sus propios eventos, porque
la 006 no lo permite.

### User Story 1 - Ver todas mis compras con su estado (Priority: P1)

El comprador abre la pestaña "Mis compras" y ve, en una sola lista, cada compra que hizo en
cualquier evento: el nombre del evento, su fecha y hora, el tipo de entrada, la cantidad, el
total ("Gratis" si es $ 0) y el estado, que se distingue a simple vista por texto y color. Tocar
una fila abre "Tu compra" con el detalle de esa compra.

**Why this priority**: es UC-01 en sentido estricto. Hasta ahora las compras solo se ven
evento por evento (desde el detalle); sin esta lista el comprador no tiene dónde seguir lo que
compró.

**Independent Test**: con los datos de ejemplo, elegir a Martín y abrir "Mis compras": aparece su
compra confirmada de "Festival Sonidos del Sur" (tipo, cantidad, total y "Confirmada"); elegir a
Diego: aparece su compra del Festival como "Cancelada"; con un usuario, comprar en dos eventos
distintos (una de ellas sin pagar) y verificar que las tres o más compras aparecen como filas
separadas, cada una con su estado; verificar por el lado del servidor que la lista de un usuario
nunca incluye compras de otro y que pedirla sin usuario se rechaza.

**Acceptance Scenarios**:

1. **Given** un usuario con compras en varios eventos, **When** abre "Mis compras", **Then** ve
   todas sus compras, de todos los eventos y en todos los estados, en una sola lista, una fila
   por compra.
2. **Given** dos compras del mismo usuario en el mismo evento (por ejemplo, una "General" y una
   "VIP", o dos "General" en momentos distintos), **When** se muestra la lista, **Then** son dos
   filas distintas.
3. **Given** una compra en la lista, **When** se muestra su fila, **Then** tiene el nombre del
   evento, su fecha y hora (hora de Buenos Aires, como en el resto de la app), el nombre del tipo
   de entrada, la cantidad, el total fijado al comprar y el estado.
4. **Given** una compra de un tipo gratis (total 0), **When** se muestra su fila, **Then** el total
   dice "Gratis", no "$ 0".
5. **Given** compras en cada uno de los estados (`PENDIENTE`, `CONFIRMADA`, `CANCELADA`,
   `UTILIZADA`, `REEMBOLSADA`), **When** se muestran, **Then** cada una tiene su estado con
   **texto y color** (el mismo texto y color que en el resto de la app), y dos estados distintos
   nunca se diferencian solo por el color.
6. **Given** una fila cualquiera, **When** el comprador la toca, **Then** se abre "Tu compra" de
   esa compra (la pantalla de la 006), con su estado real.
7. **Given** el usuario actual, **When** se pide la lista al servidor, **Then** trae solo las
   compras en las que él es el comprador, nunca las de otro usuario, y tampoco las compras que
   otros hicieron en eventos que él organiza.
8. **Given** un pedido de la lista sin usuario identificado, **When** el servidor lo recibe,
   **Then** lo rechaza como usuario no identificado.
9. **Given** la lista abierta, **When** el servidor responde, **Then** cada fila se arma con lo
   que vino en esa única respuesta (evento, tipo, días restantes), sin que la app tenga que
   consultar cada evento por separado.
10. **Given** un evento cuyo nombre o fecha el organizador editó después de la compra, **When**
    se muestra la lista, **Then** la fila muestra el nombre y la fecha **actuales** del evento,
    y el total sigue siendo el fijado al comprar.
11. **Given** compras de eventos no realizados y de eventos realizados, **When** se muestra la
    lista, **Then** aparecen primero las de eventos no realizados (el más próximo arriba) y
    después las de eventos realizados (el más reciente arriba); dos compras del mismo evento van
    juntas, la comprada más recientemente primero (FR-006). No hay filtro por estado (FR-007).

---

### User Story 2 - Saber cuánto falta para mis eventos confirmados (Priority: P1)

En cada compra `CONFIRMADA`, el comprador ve cuántos días faltan para el evento, para saber de
un vistazo qué tiene por delante.

**Why this priority**: es la otra mitad explícita de UC-01 ("cuántos días faltan para el evento
si está confirmada") y una regla de la constitución ("Días restantes"). Comparte la prioridad
con la US1, pero se puede probar aparte con el reloj fijo.

**Independent Test**: con el reloj del servidor fijado, armar compras confirmadas de eventos
dentro de 10 días, mañana, hoy más tarde y ya empezados, y verificar el texto de cada fila según
FR-009 a FR-012; verificar que los días se calculan en cada consulta (el mismo pedido, con el
reloj adelantado un día, da un día menos) y que no quedan guardados en la compra.

**Acceptance Scenarios**:

1. **Given** una compra `CONFIRMADA` de un evento futuro, **When** se muestra su fila, **Then**
   indica cuántos días faltan para el evento, según FR-009.
2. **Given** una compra en un estado distinto de `CONFIRMADA`, **When** se muestra su fila,
   **Then** no indica días restantes.
3. **Given** la misma compra confirmada, **When** se consulta la lista en dos días distintos,
   **Then** los días restantes bajan con el paso del tiempo: los calcula el servidor en cada
   consulta, con su reloj y en la zona horaria de Buenos Aires, y no se guardan.
4. **Given** una compra confirmada de un evento que es **hoy** (en Buenos Aires) a las 21:00 y
   todavía no empezó, **When** se muestra su fila, **Then** dice "Hoy · 21:00" (FR-010).
5. **Given** una compra confirmada de un evento que es **mañana** (en Buenos Aires), a cualquier
   hora, **When** se muestra su fila, **Then** dice "Mañana" (FR-010).
6. **Given** una compra confirmada de un evento del día siguiente a las 21:00, **When** se
   muestra su fila a las 23:59, **Then** los días restantes son 1 y la fila dice "Mañana": se
   cuentan días de calendario, no bloques de 24 horas (FR-009). A las 00:00 del día del evento
   pasa a 0 ("Hoy · 21:00").
7. **Given** una compra confirmada de un evento dentro de 10 días (en fecha de Buenos Aires),
   **When** se muestra su fila, **Then** dice "Faltan 10 días".
8. **Given** una compra confirmada de un evento que ya empezó (su fecha y hora llegó según el
   reloj del servidor, inclusive), **When** se muestra su fila, **Then** dice "Confirmada" y
   "Evento realizado", sin días restantes (FR-011), también si es el mismo día.

---

### User Story 3 - Retomar el pago de una pendiente desde la lista (Priority: P2)

En cada compra `PENDIENTE`, el comprador ve hasta qué hora puede pagarla y tiene "Pagar", que lo
lleva a "Tu compra" para completar el pago sin tener que volver al detalle del evento. Una
pendiente que ya venció se ve directamente como cancelada.

**Why this priority**: la 006 ya permite retomar el pago desde el detalle del evento; tenerlo
también en la lista general es comodidad, no habilita nada nuevo. Sí es importante que una
vencida no aparezca como pagable.

**Independent Test**: con el reloj del servidor fijado, comprar sin pagar y abrir "Mis compras":
la fila dice "Pendiente", "Podés pagar hasta las HH:MM" y tiene "Pagar"; tocarlo y pagar, y
volver: la fila dice "Confirmada" con sus días restantes; adelantar el reloj 15 minutos con otra
pendiente y verificar que la lista la muestra "Cancelada", sin "Pagar", aunque nadie haya
escrito en ese evento.

**Acceptance Scenarios**:

1. **Given** una compra `PENDIENTE` no vencida, **When** se muestra su fila, **Then** indica hasta
   qué hora (de Buenos Aires) se puede pagar, con el mismo texto que la 006 ("Podés pagar hasta
   las 15:35"), y ofrece "Pagar".
2. **Given** la fila de una pendiente, **When** el comprador toca "Pagar", **Then** se abre "Tu
   compra" de esa compra, donde puede pagarla como en la 006.
3. **Given** una pendiente que el comprador pagó desde "Tu compra", **When** vuelve a "Mis
   compras", **Then** la fila ya figura `CONFIRMADA`, con sus días restantes y sin "Pagar".
4. **Given** una pendiente cuyos 15 minutos ya pasaron según el reloj del servidor, aunque
   ninguna operación la haya registrado como vencida, **When** se consulta la lista, **Then**
   figura `CANCELADA`, sin hora límite ni "Pagar", con las mismas reglas de lectura "al día" de la
   006 (consultar la lista no guarda nada).
5. **Given** una compra `CANCELADA` (vencida o cancelada por el comprador), **When** se muestra
   su fila, **Then** dice "Cancelada" y, debajo, "Venció sin pagarse" si la canceló el sistema
   al vencer o "La cancelaste" si la canceló el comprador (FR-014), y no ofrece ninguna acción
   propia (tocar la fila igual abre "Tu compra").
6. **Given** una compra `UTILIZADA` o `REEMBOLSADA` (estados que todavía no se alcanzan en la
   app, pero que el servidor puede devolver), **When** se muestra su fila, **Then** se ve con su
   texto y color propios y sin acciones ni días restantes.

---

### User Story 4 - Lista al día, sin compras ajenas y ante fallas (Priority: P2)

La lista refleja lo último que pasó: se actualiza al volver a la pestaña y después de comprar,
pagar o cancelar; al cambiar de usuario nunca muestra compras del anterior; sin compras, invita a
explorar; y con el servidor caído, avisa y deja reintentar.

**Why this priority**: sin esto la lista engaña (muestra una pendiente ya pagada o compras de
otro usuario), pero el valor principal ya lo dan la US1 y la US2.

**Independent Test**: con el fetch simulado de la app, abrir "Mis compras" sin compras y ver el
vacío con su acción a Explorar; comprar desde Explorar y volver: la compra aparece; cambiar de
usuario desde Perfil y verificar que no se ve, ni por un instante, ninguna compra del anterior;
simular el servidor caído y ver el error con reintento.

**Acceptance Scenarios**:

1. **Given** un usuario sin compras, **When** abre "Mis compras", **Then** ve "Todavía no
   compraste entradas" con una acción que lo lleva a Explorar.
2. **Given** la lista pedida al servidor y todavía sin respuesta, **When** se muestra la pestaña,
   **Then** indica que está cargando.
3. **Given** el servidor no disponible o un error al pedir la lista, **When** se muestra la
   pestaña, **Then** indica el error con un mensaje en español y permite reintentar, como el
   resto de las pantallas (y la franja de servidor no disponible, si corresponde).
4. **Given** el comprador acaba de comprar, pagar o cancelar una compra (desde el detalle del
   evento o "Tu compra"), **When** vuelve a "Mis compras", **Then** la lista ya refleja ese
   cambio.
5. **Given** la lista ya cargada, **When** el comprador vuelve a la pestaña desde otra, **Then**
   la lista se vuelve a pedir y refleja los cambios (por ejemplo, una pendiente que venció
   mientras tanto).
6. **Given** la lista abierta con una pendiente cuya hora límite llega **mientras se está
   mirando**, **When** pasa esa hora, **Then** la app vuelve a pedir la lista y la fila pasa a
   `CANCELADA`, sin hora límite ni "Pagar" (FR-018). Aunque se toque "Pagar" justo en el borde,
   nunca se puede pagarla: "Tu compra" la muestra vencida, como en la 006.
7. **Given** el usuario actual cambia por otro (desde Perfil), **When** se abre "Mis compras",
   **Then** muestra solo las compras del nuevo usuario y nunca, ni por un instante, las del
   anterior.
8. **Given** una compra de un evento que ya no figura en Explorar (porque ya se realizó), **When**
   se muestra la lista, **Then** la compra sigue apareciendo con los datos de su evento: la lista
   no depende del catálogo.

---

### Edge Cases

- **Usuario sin compras**: estado vacío con "Todavía no compraste entradas" y la acción a
  Explorar (US4, escenario 1). Un usuario que solo organiza eventos también ve el vacío: las
  compras de sus eventos no son suyas.
- **Pendiente que vence con la lista abierta**: al llegar su hora límite la app vuelve a pedir
  la lista y la fila figura `CANCELADA` (FR-018). Si se tocó "Pagar" justo antes, "Tu compra" la
  muestra vencida y no deja pagarla (006). Si el pedido falla (servidor caído), se ve el error
  o la franja como en cualquier consulta; la app no la cancela por su cuenta.
- **Pendiente vencida que nadie materializó**: figura `CANCELADA` en la lista (lectura al día),
  igual que en "Tu compra" y en el detalle del evento; consultar la lista no la guarda como
  cancelada ni devuelve cupo (eso lo hace la próxima escritura sobre ese evento, como en la 006).
- **Evento que empieza con una compra confirmada**: los días restantes dejan de contar hacia
  adelante y la fila muestra "Evento realizado" (FR-011), desde la hora de inicio aunque sea el
  mismo día. Para este sistema "empezó" y "se realizó" son
  lo mismo: desde la fecha y hora de inicio, inclusive, según el reloj del servidor (criterio de
  la 004 a la 006); no hay hora de fin.
- **Pendiente de un evento que ya empezó**: sigue `PENDIENTE` y pagable hasta sus 15 minutos (006,
  Clarifications); no muestra días restantes porque no está confirmada.
- **Evento del día siguiente comprado a las 23:59**: faltan 21 h, pero es 1 día de calendario:
  la fila dice "Mañana" (FR-009, US2 escenario 6).
- **Cambio de día a medianoche**: una confirmada de un evento a 2 días pasa a "Mañana" en la
  primera consulta después de las 00:00 de Buenos Aires, y a "Hoy · HH:MM" en la primera después
  de las 00:00 del día del evento (FR-009). Los días los cuenta el servidor en cada consulta; una
  lista abierta durante la medianoche se actualiza al volver a pedirse.
- **Evento que dejó de estar en el catálogo**: Explorar solo muestra eventos no realizados; sus
  compras siguen en "Mis compras" con nombre, fecha y tipo (US4, escenario 8). Un evento o tipo
  con compras no se puede eliminar (004), así que una compra nunca se queda sin su evento.
- **Evento editado después de comprar**: la fila muestra el nombre y la fecha actuales del evento
  y el nombre actual del tipo; el total no cambia (US1, escenario 10).
- **Muchas compras**: sin paginación; la lista se desplaza. Con el tope por persona de la 006
  (4 pagas por evento), una lista de decenas de filas es el caso realista.
- **Cambio de usuario**: nunca se muestran compras del usuario anterior, ni mientras carga la
  lista del nuevo (US4, escenario 7).
- **Servidor caído**: estado de error con reintento; las compras no cambian por fallar una
  consulta (US4, escenario 3). Si el servidor cae después de cargar la lista, la lista ya
  mostrada puede seguir visible junto con la franja de servidor no disponible, como en el resto
  de la app.
- **Pedido sin usuario o con un usuario inexistente**: el servidor lo rechaza como en el resto de
  los endpoints que requieren usuario.

## Requirements *(mandatory)*

### Functional Requirements

**Lista (servidor)**

- **FR-001**: El servidor DEBE ofrecer la lista de las compras del **usuario actual como
  comprador**, de todos los eventos y en todos los estados. Requiere usuario identificado (sin
  usuario: usuario no identificado). Nunca incluye compras de otro comprador.
- **FR-002**: Cada compra de la lista DEBE traer lo necesario para su fila sin consultas
  adicionales de la app: id de la compra, estado, cantidad, total; el evento (id, nombre, fecha y
  hora); el tipo de entrada (id, nombre); en las `PENDIENTE`, hasta cuándo se puede pagar; y en
  las `CONFIRMADA`, los días restantes (FR-009; `null` si el evento ya se realizó, FR-011), y si
  el evento ya se realizó; en las `CANCELADA`, quién la canceló (FR-014). El servidor DEBE armar la lista con una cantidad
  de lecturas que no crezca con el número de compras (sin una consulta por evento).
- **FR-003**: La lista DEBE mostrar cada compra **al día** según el reloj del servidor: una
  pendiente cuyos 15 minutos ya pasaron figura `CANCELADA`, con las mismas reglas de lectura de la
  006 (una lectura no guarda nada ni devuelve cupo).
- **FR-004**: Los datos del evento y del tipo DEBEN ser los **actuales** (si el organizador los
  editó, se ven editados); el total, la cantidad y el estado son los de la compra.
- **FR-005**: La lista DEBE ser una vista explícita (campos elegidos), como el resto de la API
  (constitución, principio VI): no expone el historial completo ni datos del comprador que la app
  no necesita para la fila.

**Orden y filtro**

- **FR-006**: El servidor DEBE devolver la lista ordenada en dos bloques: primero las compras de
  eventos **no realizados**, por fecha y hora del evento ascendente (el más próximo primero);
  después las de eventos **realizados** (FR-011), por fecha y hora del evento descendente (el
  más reciente primero). Dentro de una misma fecha y hora de evento, desempata la fecha de
  compra (el primer cambio del historial), la más reciente primero, y después el id de la
  compra. El orden es estable entre consultas iguales y no depende del estado de la compra.
- **FR-007**: La pantalla NO DEBE ofrecer filtro por estado: muestra siempre todas las compras
  juntas, con un único estado vacío.

**Fila (app)**

- **FR-008**: Cada fila DEBE mostrar el nombre del evento, su fecha y hora (hora de pared de
  Buenos Aires, con el mismo formato que el resto de la app), el nombre del tipo de entrada, la
  cantidad, el total ("Gratis" si es 0, pesos enteros como en la 006) y el estado con **texto y
  color**, con el único componente de la app que muestra el estado de una compra (constitución,
  principio VII). Los cinco estados (`PENDIENTE`, `CONFIRMADA`, `CANCELADA`, `UTILIZADA`,
  `REEMBOLSADA`) DEBEN tener cada uno su texto propio. Tocar la fila DEBE abrir "Tu compra" de esa
  compra.

**Días restantes**

- **FR-009**: En una compra `CONFIRMADA` de un evento que no empezó, el servidor DEBE calcular al
  responder (sin guardarlos) los días que faltan para el evento, con su reloj y en la zona
  horaria `America/Argentina/Buenos_Aires`, contando **días de calendario**: la diferencia entre
  la fecha (de pared de Buenos Aires) del evento y la fecha de hoy en Buenos Aires, no bloques de
  24 horas (un evento de mañana a las 21:00 es 1 día tanto a las 00:01 como a las 23:59). El
  servidor devuelve el número entero (`diasRestantes`, ≥ 0); ninguna otra compra lleva días
  restantes.
- **FR-010**: La app DEBE armar el texto a partir de los días restantes: 0 → "Hoy · HH:MM" (la
  hora de inicio del evento, de Buenos Aires), 1 → "Mañana", N ≥ 2 → "Faltan N días".
- **FR-011**: Una compra `CONFIRMADA` de un evento que ya empezó (desde su fecha y hora de
  inicio, inclusive, según el reloj del servidor) DEBE mostrar "Evento realizado" en lugar de
  los días restantes: el servidor manda `diasRestantes: null` y el evento con su `realizado`
  (el mismo criterio de la 004), y la app elige el texto con ese dato. Sigue figurando
  `CONFIRMADA` (pasar a `UTILIZADA` es de la 008).
- **FR-012**: El texto de los días restantes DEBE estar junto al estado y no reemplazarlo: la
  fila de una confirmada dice "Confirmada" **y** cuánto falta.

**Según el estado**

- **FR-013**: Una fila `PENDIENTE` DEBE mostrar hasta qué hora (de Buenos Aires) se puede pagar,
  con el texto de la 006 ("Podés pagar hasta las HH:MM"), y ofrecer "Pagar", que abre "Tu
  compra" de esa compra. Si el total es 0, la acción dice "Confirmar", como en la 006.
- **FR-014**: Una fila `CANCELADA` NO DEBE ofrecer acciones (ni "Pagar" ni cancelar ni
  reembolsar). DEBE distinguir el motivo junto al estado: "Venció sin pagarse" si la canceló el
  sistema (incluida una pendiente vencida que todavía nadie materializó, FR-003) o "La
  cancelaste" si la canceló el comprador. Para eso la vista trae quién la canceló (`sistema` o
  `usuario`, el autor del último cambio), no el historial completo (FR-005).
- **FR-015**: Las filas `UTILIZADA` y `REEMBOLSADA` DEBEN mostrarse con su texto y color propios,
  sin acciones ni días restantes. Sus acciones (reseñar, ver el reembolso) llegan con la 009 y la
  011.

**Pantalla**

- **FR-016**: La pestaña "Mis compras" DEBE reemplazar la sección pendiente actual y manejar los
  cuatro estados: cargando, error (con mensaje en español y reintento), vacío y datos. El vacío
  dice "Todavía no compraste entradas" y tiene una acción que lleva a Explorar.
- **FR-017**: La lista DEBE volver a pedirse al volver a la pestaña y quedar desactualizada (y
  pedirse de nuevo al mostrarse) después de comprar, pagar o cancelar una compra, sea desde el
  detalle del evento o "Tu compra" ("Mis entradas" no tiene acciones que cambien una compra:
  cancelar una confirmada llega con la 009).
- **FR-018**: Mientras la lista está abierta, la app DEBE volver a pedirla cuando llega la hora
  límite más próxima de las pendientes que muestra, para que el servidor (lectura al día) la
  devuelva `CANCELADA`. La app NO DEBE decidir por su cuenta que una compra venció: el estado
  siempre lo da el servidor. Sin pendientes en la lista, no se programa ningún pedido.
- **FR-019**: La lista DEBE pertenecer al usuario actual: al cambiar de usuario, la pestaña
  NUNCA muestra compras del anterior, ni mientras carga la del nuevo.
- **FR-020**: La pantalla DEBE ser usable en 360 px de ancho: el nombre del evento y del tipo se
  parten en varias líneas antes de recortarse, y el estado sigue legible.

**Documentación**

- **FR-021**: La consulta nueva del servidor DEBE quedar documentada en el contrato de la
  feature y en la documentación de la API, como las demás.

### Key Entities *(include if feature involves data)*

- **Compra** (de la 006): comprador, evento, tipo de entrada, cantidad, total fijado al comprar,
  estado actual (el último del historial, o `CANCELADA` si es una pendiente vencida) e historial
  de cambios de estado. Esta feature no le agrega datos ni cambia su máquina de estados: solo la
  lista.
- **Fila de "Mis compras"** (vista, no se guarda): una compra con los datos actuales de su evento
  (nombre, fecha y hora) y de su tipo (nombre), su hora límite de pago si está pendiente y sus
  días restantes si está confirmada.
- **Días restantes** (calculado, no se guarda): los días de calendario de Buenos Aires entre la
  fecha de hoy (según el reloj del servidor) y la fecha del evento, no bloques de 24 horas
  (FR-009 a FR-011).
- **Evento** y **TipoEntrada** (de la 004): aportan nombre y fecha a la fila; un evento
  realizado deja de estar en el catálogo pero no en "Mis compras".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde cualquier pestaña, el comprador llega a ver todas sus compras con un solo
  toque (la pestaña "Mis compras"), y a "Tu compra" de cualquiera de ellas con un toque más.
- **SC-002**: En el 100 % de las filas, el estado se puede identificar sin depender del color
  (cada estado tiene un texto distinto), incluidos los cinco estados de la constitución.
- **SC-003**: En el 100 % de las consultas, los días restantes de una confirmada coinciden con
  los calculados a mano según la regla de FR-009 para el reloj del servidor de ese momento,
  incluidos los bordes de medianoche, "hoy", "mañana" y evento ya empezado; y ninguna compra en
  otro estado los muestra.
- **SC-004**: Ninguna pendiente vencida sigue apareciendo como pagable en la lista después de
  su hora límite (con la lista abierta, la siguiente respuesta del servidor ya la trae
  `CANCELADA`), y ninguna se puede pagar desde la lista en ningún momento.
- **SC-005**: Después de comprar, pagar o cancelar, la lista refleja el cambio la primera vez que
  se vuelve a mostrar, sin acciones adicionales del usuario.
- **SC-006**: En el 100 % de los cambios de usuario, la pestaña no muestra ninguna compra del
  usuario anterior; y el servidor no devuelve, para ningún usuario, una compra de la que no sea
  el comprador.
- **SC-007**: La lista de un comprador con 30 compras en 10 eventos distintos se obtiene con una
  sola consulta de la app, y el servidor la arma sin una lectura por evento.
- **SC-008**: Cada regla de la feature (solo las compras propias, lectura al día de las
  vencidas, días restantes calculados al consultar en hora de Buenos Aires con sus bordes,
  días solo en confirmadas, orden de la lista, rechazo sin usuario) tiene al menos un test que la
  verifica, incluido su caso borde.

## Assumptions

- **Una fila por compra** (indicado en la descripción): dos compras del mismo evento, aunque
  sean del mismo tipo, son dos filas; la lista no agrupa por evento.
- **Tocar una fila abre "Tu compra"** (indicado en la descripción), en todos los estados; esa
  pantalla ya existe (006) y muestra el estado real de la compra.
- **"Pagar" de una gratis dice "Confirmar"**, como en la 006 (FR-013), para no tener dos textos
  distintos para la misma acción según la pantalla.
- **"Empezó" = "se realizó"**: el sistema no tiene hora de fin; un evento se considera realizado
  desde su fecha y hora de inicio, inclusive, según el reloj del servidor (004 a 006).
- **Datos actuales del evento** (FR-004): la compra guarda el total, no una copia del evento; si
  el organizador edita nombre o fecha, la lista muestra lo editado (y los días restantes se
  recalculan con la fecha nueva).
- **Los cinco estados se muestran aunque dos no ocurran todavía**: `UTILIZADA` (008) y
  `REEMBOLSADA` (009) se prueban con datos armados en los tests; los datos de ejemplo de la 006
  alcanzan para demostrar `CONFIRMADA` (Martín) y `CANCELADA` (Diego), y la demo crea pendientes
  comprando.
- **Sin paginación, búsqueda ni filtro por estado** (fuera de alcance; FR-007): el tope por persona de la 006 mantiene la
  lista en un tamaño razonable.
- **"Mis entradas" del detalle (006) se mantiene**: muestra las confirmadas de un evento; "Mis
  compras" es la lista general y no la reemplaza.
- **Identidad simulada**: el comprador es el usuario actual elegido en la app (constitución,
  principio VI).
- **Dependencias**: 006 (compra con historial, vencimiento perezoso, "Tu compra", componente de
  estado y mutations de comprar, pagar y cancelar), integrada en `development`.
