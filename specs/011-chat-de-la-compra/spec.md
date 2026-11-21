# Feature Specification: Chat de la compra

**Feature Branch**: `feature/011-chat-de-la-compra`

**Created**: 2026-11-20

**Status**: Draft

**Input**: User description: "Chat de la compra entre comprador y organizador (UC-05 y UC-06). Cada compra tiene un chat simple en el que solo leen y escriben su comprador y el organizador del evento, en cualquier momento y en cualquier estado de la compra (PENDIENTE, también vencida, CONFIRMADA, UTILIZADA, CANCELADA, REEMBOLSADA) y aunque el evento ya se haya realizado. Depende de 007, 008 y 010." (descripción completa —dominio, backend, app y fuera de alcance— en la invocación de `/speckit-specify`).

**Casos de uso**:

- UC-05 — *Como comprador, quiero enviar mensajes en cualquier momento sobre una compra, mediante
  un chat dentro de la misma.*
- UC-06 — *Como organizador, quiero responder mensajes en cualquier momento sobre una compra,
  mediante el chat de la misma.*
- Regla "Chat" de la constitución: *en una compra solo escriben y leen su comprador y el
  organizador del evento, en cualquier estado de la compra*; y principio VI: *el chat de una
  compra es solo de sus dos partes*.

## Alcance

**Incluye**: un chat por compra, del que participan solo su comprador y el organizador de su
evento; leer la conversación y enviar mensajes de texto en cualquier estado de la compra (también
una pendiente vencida) y aunque el evento ya se haya realizado; cada mensaje con su autor (nombre
y rol en la compra: comprador u organizador), su texto y la fecha y hora en que el servidor lo
recibió, en orden de envío; la validación del texto en el servidor; una pantalla "Chat de la
compra" a la que el comprador llega desde "Tu compra" y el organizador desde cada fila de
"Compras del evento"; el refresco de la conversación al volver a la pantalla y después de enviar;
una conversación de ejemplo en los datos de ejemplo.

**No incluye**: tiempo real (la conversación no se actualiza sola mientras la pantalla está
abierta: websockets, push o sondeo periódico); notificaciones; contador de mensajes no leídos o
marca de leído; adjuntos, imágenes o emojis especiales (más allá del texto que el teclado
permita); editar o borrar mensajes; chats entre usuarios que no cuelguen de una compra o de más de
dos partes; una lista de "mis conversaciones"; un acceso al chat desde la fila de "Mis compras";
moderación o bloqueo de usuarios; reseñas (012); pulido estético (014).

## Clarifications

### Session 2026-11-20

- Q: ¿Cuál es el largo máximo de un mensaje, contado después de recortar los espacios del
  principio y del final? → A: **500 caracteres** (se acepta el texto de exactamente 500; uno de
  501 se rechaza).
- Q: Además de los mensajes, ¿qué tiene que mostrar arriba la pantalla del chat para que cada
  parte sepa de qué compra se trata? → A: un **encabezado** con el nombre del evento, la otra
  parte (nombre y rol: "organizador" para el comprador, "comprador" para el organizador) y un
  resumen de la compra: tipo de entrada, cantidad y estado al día (con texto y color). Sin códigos
  de entradas ni otros datos de la compra; lo trae la misma respuesta de la conversación.
- Q: ¿Cómo se muestra la fecha y hora de cada mensaje en el chat? → A: **siempre fecha y hora**,
  con el formato que la app ya usa en los eventos ("vie 20 nov 2026 · 14:35", hora de pared de
  Buenos Aires que da el servidor); sin "hoy" ni horas relativas, y sin depender del reloj ni de la
  zona del celular.

## User Scenarios & Testing *(mandatory)*

Los actores son el **comprador** de una compra y el **organizador** del evento de esa compra, que
son siempre usuarios distintos (nadie compra entradas de su propio evento, 006). El rol de cada
uno sale de su relación con la compra, no de un atributo del usuario (constitución, "Roles").

### User Story 1 - El comprador escribe sobre su compra (Priority: P1)

Un comprador tiene una duda sobre su compra (por ejemplo, cómo es el acceso VIP). Abre "Tu
compra", entra al chat, escribe su mensaje y lo envía; el mensaje aparece en la conversación con
su nombre y la hora.

**Why this priority**: es UC-05 y la mitad que inicia la conversación. Sin poder enviar, no hay
chat.

**Independent Test**: con los datos de ejemplo, elegir a Martín, abrir su compra de "Festival
Sonidos del Sur" desde "Mis compras", tocar el acceso al chat, ver la conversación de ejemplo,
escribir "¿A qué hora abren las puertas?" y enviarlo; verlo al final de la conversación como
propio, con la hora de Buenos Aires; verificar por el lado del servidor que la compra guardó el
mensaje con Martín como autor y la fecha y hora del servidor, y que su estado, su historial, sus
entradas y el cupo del evento no cambiaron.

**Acceptance Scenarios**:

1. **Given** una compra propia en cualquier estado, **When** el comprador abre "Tu compra",
   **Then** ve el acceso al chat de esa compra.
2. **Given** el chat abierto, **When** el comprador escribe un texto válido y toca "Enviar",
   **Then** el servidor guarda el mensaje con el comprador como autor y la fecha y hora del
   servidor (no la del celular), el campo se vacía y el mensaje aparece último en la
   conversación, diferenciado como propio.
3. **Given** una compra `PENDIENTE`, `CONFIRMADA`, `UTILIZADA`, `CANCELADA` (por el comprador o
   por vencimiento) o `REEMBOLSADA`, **When** el comprador envía un mensaje, **Then** se acepta
   igual; enviar un mensaje no cambia el estado, el historial, las entradas, el total ni el cupo.
4. **Given** una compra de un evento que ya se realizó, **When** el comprador envía un mensaje,
   **Then** se acepta igual: no hay plazo.
5. **Given** una compra `PENDIENTE` que ya venció sin pagarse pero todavía no se registró como
   cancelada, **When** el comprador envía un mensaje, **Then** el mensaje se acepta y la compra
   queda registrada como cancelada por vencimiento (como en cualquier escritura de la 006); el
   comprador la sigue viendo "Cancelada", como ya la veía.

---

### User Story 2 - El organizador responde (Priority: P1)

El organizador abre "Compras del evento", elige la compra de un comprador, entra a su chat, lee lo
que le escribió y responde.

**Why this priority**: es UC-06; sin respuesta, el chat no sirve para resolver nada.

**Independent Test**: con los datos de ejemplo, elegir a Lucía, abrir las compras de "Festival
Sonidos del Sur", tocar el acceso al chat en la fila de la compra de Martín, leer la conversación
(los mensajes de Martín identificados como del comprador), responder y ver la respuesta como
propia; elegir otra vez a Martín y ver la respuesta de Lucía en su chat, identificada como del
organizador.

**Acceptance Scenarios**:

1. **Given** "Compras del evento" de un evento propio, **When** el organizador mira cualquier
   fila, **Then** ve un acceso al chat de esa compra, enfocable por separado del resto de la fila
   (que no es tocable), en cualquier estado de la compra y también con el evento realizado.
2. **Given** el chat de una compra de su evento, **When** el organizador lo abre, **Then** ve
   todos los mensajes de las dos partes en orden de envío, cada uno con su autor (los del otro,
   con su nombre y su rol, "Comprador" u "Organizador"; los propios, como "Vos") y la hora de
   Buenos Aires.
3. **Given** el chat abierto, **When** el organizador envía un texto válido, **Then** el mensaje
   se guarda con él como autor y la fecha y hora del servidor, y aparece último y como propio.
4. **Given** el chat de una compra, **When** cualquiera de las dos partes lo abre, **Then** ve
   arriba el encabezado: el nombre del evento, la otra parte con su nombre y su rol, y el tipo de
   entrada, la cantidad y el estado al día de la compra (con texto y color; una pendiente vencida
   figura "Cancelada").
5. **Given** el chat de una compra, **When** el organizador lo abre, **Then** NO ve los códigos de
   las entradas ni ningún otro dato de la compra fuera del encabezado y la conversación.

---

### User Story 3 - Nadie más lee ni escribe (Priority: P1)

Un usuario que no es ni el comprador ni el organizador del evento de una compra no puede leer su
chat ni escribir en él.

**Why this priority**: es la regla "Chat" de la constitución y el principio VI; un chat que lee
cualquiera expone conversaciones privadas.

**Independent Test**: por el lado del servidor, pedir y enviar mensajes de la compra de Martín
como Sofía (ni compradora ni organizadora de ese evento) y verificar que se le niega el acceso y
que la conversación no cambió; sin usuario, que se rechaza como no identificado; con una compra
inexistente, que se rechaza como inexistente.

**Acceptance Scenarios**:

1. **Given** un usuario que no es el comprador de la compra ni el organizador de su evento
   (incluido el organizador de **otro** evento y otro comprador del mismo evento), **When** pide
   la conversación o envía un mensaje, **Then** se le niega el acceso y nada cambia.
2. **Given** un pedido sin usuario, **When** llega al servidor, **Then** se rechaza como usuario
   no identificado.
3. **Given** una compra inexistente, **When** una persona identificada pide su conversación o
   envía un mensaje, **Then** se rechaza como compra inexistente.
4. **Given** un mensaje inválido (sin texto, solo espacios o más largo que el máximo), **When** lo
   envía cualquiera, **Then** se rechaza como dato inválido sobre el texto, con un mensaje que lo
   explica, y nada se guarda.
5. **Given** varios problemas a la vez, **When** llega el pedido, **Then** se informa el primero
   en este orden: usuario no identificado → datos inválidos → compra inexistente → sin permiso.

---

### User Story 4 - Una conversación ordenada y al día (Priority: P2)

Las dos partes ven la misma conversación, en el mismo orden, y la pantalla se pone al día cuando
vuelven a ella o después de enviar.

**Why this priority**: sin orden ni refresco, cada parte ve una conversación distinta; pero el
chat ya sirve con las historias 1 a 3.

**Independent Test**: enviar mensajes alternando entre Martín y Lucía en el mismo celular (cambiando
de usuario) y verificar que los dos ven la misma secuencia; dejar el chat abierto, ir a otra
pantalla y volver, y ver los mensajes nuevos del otro; enviar dos mensajes casi a la vez desde dos
dispositivos y ver que se guardan los dos.

**Acceptance Scenarios**:

1. **Given** una conversación con mensajes de las dos partes, **When** cualquiera de las dos la
   abre, **Then** los ve en el orden en que el servidor los recibió (el más viejo primero) y la
   pantalla muestra los más recientes al abrir.
2. **Given** el chat abierto, **When** el usuario vuelve a la pantalla desde otra, **Then** la app
   vuelve a pedir la conversación y muestra los mensajes nuevos; mientras la pantalla está a la
   vista, no se actualiza sola (sin tiempo real).
3. **Given** dos mensajes enviados a la vez (por las dos partes o por la misma desde dos
   dispositivos), **When** el servidor los procesa, **Then** se guardan los dos, ninguno pisa al
   otro, y quedan en el orden en que llegaron.
4. **Given** un mensaje enviado mientras otra operación cambia la misma compra (un pago, una
   cancelación, el uso de una entrada o la confirmación de un reembolso), **When** el servidor los
   procesa, **Then** se conservan los dos efectos: ni el mensaje se pierde ni el cambio de estado.
5. **Given** "Enviar" tocado dos veces seguidas, **When** la app procesa los toques, **Then**
   manda un solo pedido; si el pedido falla o se pierde la respuesta, no lo reintenta sola y la
   conversación se vuelve a pedir para mostrar lo que realmente quedó guardado.

---

### User Story 5 - La pantalla en todos sus estados (Priority: P2)

La pantalla del chat se comporta bien mientras carga, ante un error, sin mensajes y con mensajes,
y es usable con el teclado abierto y con TalkBack.

**Why this priority**: lo pide la constitución para toda pantalla con datos remotos (principio
VII); la funcionalidad ya existe con las historias anteriores.

**Independent Test**: abrir el chat de una compra sin mensajes y ver "Todavía no hay mensajes" con
el campo disponible; cortar el servidor y ver el error con la opción de reintentar; escribir con
el teclado abierto y ver el campo y "Enviar" sin tapar; recorrer la conversación con TalkBack y
oír autor, hora y texto de cada mensaje.

**Acceptance Scenarios**:

1. **Given** la conversación pidiéndose, **When** se abre la pantalla, **Then** se ve el estado
   de carga.
2. **Given** un error al pedir la conversación (servidor caído, compra inexistente, sin permiso),
   **When** se abre la pantalla, **Then** se ve el error con su mensaje y, si corresponde, la
   opción de reintentar.
3. **Given** una compra sin mensajes, **When** se abre el chat, **Then** se ve "Todavía no hay
   mensajes" y el campo para escribir el primero.
4. **Given** un mensaje rechazado por inválido, **When** vuelve la respuesta, **Then** el mensaje
   del servidor se muestra junto al campo y el texto escrito se conserva para corregirlo.
5. **Given** el teclado abierto, **When** el usuario escribe, **Then** el campo y "Enviar" quedan
   a la vista, en una pantalla de 360 px de ancho.
6. **Given** TalkBack activo, **When** recorre la conversación, **Then** lee cada mensaje como una
   unidad con su autor (y si es propio), su hora y su texto; el campo y "Enviar" tienen su nombre
   accesible.
7. **Given** un cambio de usuario en el mismo celular, **When** el nuevo usuario abre un chat,
   **Then** no ve nada guardado de la conversación del usuario anterior.

### Edge Cases

- Compra `PENDIENTE` vencida "al día" pero no registrada: la lectura la muestra al día sin guardar
  nada; un envío registra el vencimiento antes de guardar el mensaje (US1, escenario 5). Como en
  toda escritura de un evento (006), ese registro alcanza a **todas** las pendientes vencidas del
  evento, no solo a la de esta compra, y les devuelve el cupo: es el único cambio que acompaña a
  un mensaje.
- Evento realizado, compra cancelada o reembolsada: el chat sigue abierto para las dos partes.
- Texto con espacios al principio o al final: se guarda recortado; solo espacios o saltos de línea
  es un texto vacío.
- Texto con saltos de línea internos: se acepta y se muestra con sus saltos.
- Texto de exactamente 500 caracteres (recortado): se acepta; uno de 501 se rechaza.
- Dos mensajes con la misma fecha y hora del servidor: se conservan en el orden en que llegaron.
- El comprador y el organizador alternando en el mismo celular: cada uno ve sus mensajes como
  propios y los del otro como ajenos.
- Organizador de otro evento, otro comprador del mismo evento: sin permiso, para leer y para
  escribir.
- Comprador igual a organizador: no puede pasar (no se compran entradas del propio evento, 006).
- Respuesta perdida al enviar: no se reintenta; la conversación se vuelve a pedir y muestra si el
  mensaje quedó guardado.
- Conversación larga: se muestra entera (sin paginar); el usuario se desplaza.
- Evento o compra borrados: no aplica, porque un evento con compras no se borra (004) y las
  compras no se borran.

## Requirements *(mandatory)*

### Functional Requirements

**Mensajes de una compra**

- **FR-001**: Cada compra DEBE tener una conversación propia, formada por sus mensajes; un
  mensaje pertenece a una única compra y vive con ella.
- **FR-002**: Cada mensaje DEBE registrar su autor (el comprador o el organizador del evento de la
  compra), su texto y la fecha y hora de envío, que DEBE fijar el servidor con su reloj al
  recibirlo; el cliente no envía fechas ni autores.
- **FR-003**: Los mensajes DEBEN conservarse y mostrarse en orden de envío (el orden en que el
  servidor los aceptó), del más viejo al más nuevo.
- **FR-004**: Un mensaje NO DEBE poder editarse ni borrarse.
- **FR-005**: El texto DEBE validarse en el servidor: se recorta (espacios y saltos de línea al
  principio y al final), NO DEBE quedar vacío y NO DEBE superar **500 caracteres** después de
  recortado. Un texto inválido se rechaza como dato inválido sobre el campo del texto, con un
  mensaje en español.

**Quién y cuándo**

- **FR-006**: Solo el comprador de la compra y el organizador de su evento DEBEN poder leer la
  conversación y enviar mensajes; a cualquier otro usuario el sistema DEBE negarle el acceso, sin
  revelar los mensajes.
- **FR-007**: Leer y enviar DEBEN estar permitidos en cualquier estado de la compra (`PENDIENTE`,
  también vencida, `CONFIRMADA`, `UTILIZADA`, `CANCELADA`, `REEMBOLSADA`) y en cualquier momento,
  también con el evento realizado.
- **FR-008**: Los rechazos DEBEN seguir este orden: usuario no identificado → datos inválidos (el
  texto, al enviar) → compra inexistente → sin permiso.

**Efectos y atomicidad**

- **FR-009**: El mensaje en sí NO DEBE cambiar el estado, el historial, las entradas, el total
  de la compra ni el cupo de ningún tipo de entrada. La única excepción es el registro previo de
  los vencimientos del evento (FR-010), que hace cualquier escritura y que puede cancelar
  pendientes vencidas (esta u otras del mismo evento) y devolverles el cupo.
- **FR-010**: Enviar un mensaje DEBE ocurrir bajo el cerrojo del evento de la compra, volviendo a
  leer la compra y el reloj adentro y registrando antes los vencimientos de las pendientes
  vencidas del evento (como toda escritura, 006), de modo que un mensaje y otra operación sobre la misma compra (pago,
  cancelación, uso de una entrada, confirmación de un reembolso u otro mensaje) nunca se pisen.
- **FR-011**: Leer la conversación NO DEBE guardar nada: muestra la compra al día (por ejemplo, una
  pendiente vencida) sin registrar el vencimiento.

**Lo que informa el servidor**

- **FR-012**: La conversación que devuelve el servidor DEBE traer, por cada mensaje, el autor con
  su nombre y su rol en la compra (comprador u organizador), el texto y la fecha y hora de envío;
  al enviar, el servidor DEBE devolver el mensaje creado. La conversación DEBE traer también el
  encabezado: el nombre del evento, la otra parte respecto del usuario que pide (nombre y rol) y
  el tipo de entrada, la cantidad y el estado de la compra, calculado al día y sin guardar nada.
- **FR-013**: La conversación NO DEBE incluir la compra completa ni ningún dato fuera de los del
  encabezado y los mensajes (en particular, los códigos de las entradas).

**App**

- **FR-014**: "Tu compra" DEBE ofrecer al comprador el acceso al chat de esa compra en cualquier
  estado.
- **FR-015**: Cada fila de "Compras del evento" DEBE ofrecer al organizador el acceso al chat de
  esa compra, como un control enfocable aparte del bloque accesible de la fila (como "Confirmar
  reembolso"), con un nombre accesible que identifique al comprador.
- **FR-016**: La pantalla "Chat de la compra" DEBE dibujarse solo con lo que devuelve la
  conversación (el organizador no puede pedir "Tu compra"), con el encabezado arriba (el estado
  con el componente único de estado de compra, texto y color) y los cuatro estados (cargando,
  error, vacío "Todavía no hay mensajes" —que no oculta el encabezado— y con mensajes).
- **FR-017**: Cada mensaje DEBE mostrar su autor y la fecha y hora de envío en la hora de pared
  de Buenos Aires, siempre con fecha y hora y en el formato de la app ("vie 20 nov 2026 · 14:35"),
  sin depender del reloj ni de la zona del celular. Los del otro muestran su nombre y su rol
  ("Lucía Álvarez · Organizador"); los propios, "Vos" (el rol propio lo anuncia la etiqueta
  accesible, FR-021). Los propios DEBEN diferenciarse de los del otro con algo más que el color
  (posición y texto).
- **FR-018**: El campo y "Enviar" DEBEN estar siempre disponibles (también con la conversación
  vacía) y no quedar tapados por el teclado. "Enviar" NO DEBE reintentarse solo y, mientras un
  envío está en curso, la app NO DEBE mandar otro. Ante un rechazo por texto inválido, el mensaje
  del servidor DEBE mostrarse junto al campo y el texto escrito conservarse; ante otro error, se
  muestra el mensaje del servidor.
- **FR-019**: Al terminar un envío (con éxito o error), la app DEBE volver a pedir solo la
  conversación de esa compra (ninguna otra vista cambia); y DEBE volver a pedirla también cada vez
  que el usuario vuelve a la pantalla.
- **FR-020**: La conversación guardada en la app DEBE ser por usuario y por compra: al cambiar de
  usuario no se ve la del anterior.
- **FR-021**: La pantalla DEBE ser accesible (cada mensaje leído como una unidad con autor, rol,
  hora y texto, también los propios: "Vos, comprador, …"; el campo y "Enviar" con su nombre) y usable en 360 px de ancho, con el sistema visual de
  la app.

**Datos de ejemplo**

- **FR-022**: Los datos de ejemplo DEBEN incluir una conversación con mensajes de las dos partes en
  una compra existente: la de Martín en "Festival Sonidos del Sur" (organizadora: Lucía), con
  fechas anteriores al arranque y sin cambiar el estado ni las demás demos. Las demás compras del
  seed quedan sin mensajes (muestran el vacío).

### Key Entities

- **Compra** (existente, 006 a 010): suma sus **mensajes**, en orden de envío. Agregar un mensaje
  es una operación de la compra que verifica que el autor es una de sus dos partes y no cambia
  nada más de ella.
- **Mensaje** (nuevo): autor (usuario: el comprador o el organizador del evento), texto y fecha y
  hora de envío (consigna: *usuario, mensaje, enviado*). Vive dentro de la compra, como las
  entradas; no se edita ni se borra.
- **Usuario** (existente): aporta el nombre del autor de cada mensaje.
- **Evento** (existente): aporta el organizador, que define quién es la otra parte del chat.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde "Tu compra" o desde "Compras del evento", un usuario llega al chat en 1 toque
  y envía un mensaje ya escrito en 1 toque más, y lo ve en la conversación en cuanto la app la
  vuelve a pedir al terminar el envío (sin actualización optimista ni otro toque).
- **SC-002**: El 100 % de los pedidos de leer o escribir de un usuario que no es parte de la
  compra se rechazan sin revelar mensajes ni cambiar la conversación.
- **SC-003**: El 100 % de los textos vacíos, de solo espacios o más largos que el máximo se
  rechazan con su mensaje junto al campo, y nada se guarda.
- **SC-004**: Enviar mensajes en cualquiera de los seis estados de la compra (contando la
  pendiente vencida) y con el evento realizado se acepta en el 100 % de los casos, sin que el
  mensaje cambie estado, historial, entradas ni cupo (solo los cambia el registro previo de los
  vencimientos, FR-009).
- **SC-005**: Ante N mensajes simultáneos, y ante un mensaje simultáneo con un pago, una
  cancelación, un uso o un reembolso de la misma compra, en el 100 % de las repeticiones se
  conservan todos los mensajes y el cambio de estado.
- **SC-006**: Las dos partes ven la misma conversación en el mismo orden, y al volver a la pantalla
  ven los mensajes nuevos de la otra parte.
- **SC-007**: Con TalkBack, cada mensaje se anuncia con su autor, su hora y su texto.

## Assumptions

- El chat no tiene tiempo real: la conversación se pone al día al abrir la pantalla, al volver a
  ella y después de enviar. Es suficiente para un TP con datos en memoria y un solo proceso; el
  tiempo real está fuera de alcance.
- El comprador y el organizador son siempre usuarios distintos (006), así que el rol de cada autor
  es único.
- "Orden de envío" es el orden en que el servidor aceptó los mensajes bajo el cerrojo; coincide con
  el de sus fechas y horas, y ante fechas iguales manda el de llegada.
- El texto se guarda recortado y con sus saltos de línea internos; el largo máximo es de 500
  caracteres (clarify).
- La conversación se muestra entera, sin paginar: las conversaciones de un TP son cortas.
- La app distingue los mensajes propios comparando el autor con el usuario actual; el servidor
  informa el rol en la compra de cada autor.
- Los textos de los accesos al chat ("Tu compra" y la fila de "Compras del evento") los propone el
  plan; el de la fila nombra al comprador para que TalkBack los distinga entre filas.
- Enviar un mensaje no avisa a la otra parte (sin notificaciones ni contador de no leídos).
- Lineamientos técnicos que vienen de la descripción y aplica el plan: el recurso es
  `/api/compras/:compraId/mensajes` (leer y enviar), los tipos nuevos van en `shared/`, los
  endpoints en `specs/011-chat-de-la-compra/contracts/` y en la OpenAPI; `CompraService` sigue
  siendo el único que guarda compras, con un solo guardado por mensaje; la pantalla sigue las
  skills `nueva-pantalla` y `nuevo-endpoint`, con una clave de consulta por usuario y compra,
  `useEnvioUnico`, `SegunConsulta`, `PantallaDesplazable` y `useRefrescarAlFocalizar`.
- Al cerrar la feature se actualizan `AGENTS.md` (recurso mensajes, la compra con mensajes, la
  pantalla y su clave de consulta) y el estado de la 011 en `docs/backlog.md`.
- Depende de 007 y 006 ("Tu compra", vencimiento perezoso, cerrojo del evento), de 008 ("Compras
  del evento", lectura del organizador) y de 010 (modelo de `Compra` y `useEnvioUnico`).
