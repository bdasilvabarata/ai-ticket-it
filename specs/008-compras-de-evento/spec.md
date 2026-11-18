# Feature Specification: Compras de un evento

**Feature Branch**: `feature/008-compras-de-evento`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "Feature 008 — Compras de un evento (UC-02, organizador). Como organizador de un evento, quiero ver todas sus compras con su estado bien diferenciado (pendiente, confirmada, cancelada, utilizada) y cuántas entradas quedan disponibles de cada tipo de entrada, para seguir cómo viene la venta. También quiero registrar el uso de una entrada confirmada cuando el comprador llega al evento: la compra pasa a UTILIZADA y ya no se puede cancelar. Solo el organizador del evento puede ver sus compras y registrar usos. Depende de 004 (eventos y tipos de entrada) y de 006 (compras, historial de estados y vencimiento de las pendientes). Quedan abiertas para el clarify: desde cuándo se puede registrar el uso (¿solo el día del evento?) y con qué dato identifica el organizador la compra."

**Casos de uso**:

- UC-02 — *Como organizador, quiero visualizar las compras de un evento, diferenciando el estado
  y cuántas entradas quedan disponibles de cada tipo.*
- Transición `CONFIRMADA → UTILIZADA` de la constitución ("Estados de una compra": *el
  organizador registra el ingreso*), que habilita las reseñas de la 011.

## Alcance

**Incluye**: desde un evento propio (Mis eventos → el evento), la pantalla **"Compras del
evento"** con **todas las compras** de ese evento, de todos los compradores y en todos los
estados; por compra, el comprador, el tipo de entrada, la cantidad, el total, la fecha de compra y
el **estado con texto y color**; un **resumen por tipo de entrada** con cuántas entradas quedan
disponibles; las pendientes vencidas mostradas ya como `CANCELADA` y su cupo ya devuelto (lectura
"al día" de la 006); las **entradas** de cada compra (una por unidad comprada), cada una con su
**código**, que el comprador ve en sus pantallas una vez confirmada la compra; **registrar el uso**
de una entrada `CONFIRMADA` ingresando su código, que la pasa a `UTILIZADA` con su cambio de estado
(autor: el organizador); los cuatro estados de la pantalla; el
refresco después de registrar un uso; la restricción de todo esto al organizador del evento; las
consultas y la operación del servidor que lo sostienen.

**No incluye**: cancelar o reembolsar una compra confirmada, ni por el comprador ni por el
organizador (009; la 009 también prueba la carrera entre el uso de una entrada y la cancelación
de su compra confirmada); el chat de la compra (010); reseñar (011); escanear códigos QR o cualquier
lector físico (el código es texto que se ingresa a mano; el QR llega en el futuro); exportar la
lista; paginación, búsqueda o filtros dentro de la lista; notificar al
comprador del uso; deshacer un uso registrado; estadísticas de venta más allá de los disponibles
por tipo; pulido estético (013).

## Clarifications

### Session 2026-11-18

- Q: ¿Cómo identifica el organizador la compra a la que le registra el uso? → A: por
  **entrada**, no por compra: cada entrada de una compra (una por unidad) tiene su propio estado y
  su propio **código** (en el futuro, un QR). Hasta que la compra queda confirmada, el estado de
  cada entrada es idéntico al de la compra; una vez confirmada, el organizador ingresa el código
  de una entrada, se registra su uso y solo esa entrada pasa a `UTILIZADA`.
- Q: Con algunas entradas usadas y otras no, ¿en qué estado queda la compra? → A: la compra pasa
  a `UTILIZADA` con la **primera** entrada usada (un cambio de estado de la compra, autor el
  organizador); las demás entradas siguen `CONFIRMADA` y se pueden usar, pero la compra ya no se
  cancela; la lista muestra "N de M entradas usadas".
- Q: ¿Cuándo se puede registrar el uso de una entrada? → A: desde 4 horas antes del inicio del
  evento hasta 12 horas después del inicio, según el reloj del servidor (ambos extremos
  inclusive).
- Q: ¿Qué muestra el resumen por tipo de entrada, además de los disponibles? → A: por tipo,
  **disponibles**, **pendientes** (entradas de compras `PENDIENTE` no vencidas), **vendidas**
  (entradas de compras `CONFIRMADA` o `UTILIZADA`) y **usadas** (entradas `UTILIZADA`).

## User Scenarios & Testing *(mandatory)*

El actor es el **organizador**: el usuario actual en su relación con un evento que organiza
(constitución, "Roles"). El mismo usuario, cuando compra en eventos ajenos, sigue viendo sus
compras en "Mis compras" (007); acá ve solo las de sus eventos.

### User Story 1 - Ver las compras de mi evento con su estado (Priority: P1)

El organizador abre uno de sus eventos y entra a "Compras del evento": ve cada compra que se hizo
en ese evento, con quién la hizo, el tipo de entrada, la cantidad, el total y el estado, que se
distingue a simple vista por texto y color.

**Why this priority**: es UC-02 en sentido estricto. Hoy el organizador publica y edita eventos
pero no tiene forma de saber quién compró ni en qué estado está cada compra.

**Independent Test**: con los datos de ejemplo, elegir a Lucía, abrir "Festival Sonidos del Sur"
desde Mis eventos y entrar a sus compras: aparecen la compra de Martín ("VIP", "Confirmada") y la
de Diego ("General", "Cancelada"); con otro usuario comprar sin pagar en ese evento y verificar
que aparece como "Pendiente"; verificar por el lado del servidor que un usuario que no organiza el
evento no puede ver sus compras y que pedirlas sin usuario se rechaza.

**Acceptance Scenarios**:

1. **Given** un evento propio con compras de varios compradores, **When** el organizador abre
   "Compras del evento", **Then** ve todas las compras de ese evento, de todos los compradores y
   en todos los estados, una fila por compra.
2. **Given** una compra en la lista, **When** se muestra su fila, **Then** tiene el nombre y
   apellido del comprador, el nombre del tipo de entrada, la cantidad, el total fijado al comprar
   ("Gratis" si es 0), la fecha y hora de compra (hora de Buenos Aires) y el estado.
3. **Given** compras en cada uno de los estados (`PENDIENTE`, `CONFIRMADA`, `CANCELADA`,
   `UTILIZADA`, `REEMBOLSADA`), **When** se muestran, **Then** cada una tiene su estado con
   **texto y color** (el mismo texto y color que en el resto de la app), y dos estados distintos
   nunca se diferencian solo por el color.
4. **Given** una compra `PENDIENTE` no vencida, **When** se muestra su fila, **Then** indica hasta
   qué hora (de Buenos Aires) puede pagarla el comprador.
5. **Given** una pendiente cuyos 15 minutos ya pasaron según el reloj del servidor, aunque ninguna
   operación la haya registrado como vencida, **When** se consulta la lista, **Then** figura
   `CANCELADA`, con las mismas reglas de lectura "al día" de la 006 (consultar no guarda nada).
6. **Given** una compra `CANCELADA`, **When** se muestra su fila, **Then** indica si venció sin
   pagarse o si la canceló el comprador.
7. **Given** compras hechas en distintos momentos, **When** se muestra la lista, **Then** aparecen
   de la más reciente a la más antigua por fecha de compra (desempate por id).
8. **Given** un usuario que no es el organizador del evento (también un comprador de ese
   evento), **When** pide sus compras al servidor, **Then** se le niega el acceso, y la app no le
   ofrece la pantalla.
9. **Given** un pedido sin usuario identificado, **When** el servidor lo recibe, **Then** lo
   rechaza como usuario no identificado; y si el evento no existe, responde que no existe.
10. **Given** un evento ya realizado, **When** el organizador lo abre (en solo lectura, como en la
    004), **Then** también puede ver sus compras.

---

### User Story 2 - Ver cómo viene la venta de cada tipo (Priority: P1)

En la misma pantalla, el organizador ve, por cada tipo de entrada del evento, cuántas entradas
quedan disponibles, cuántas están pendientes de pago, cuántas se vendieron y cuántas ya se
usaron, para saber cómo viene la venta y, durante el evento, cuánta gente ingresó.

**Why this priority**: es la otra mitad explícita de UC-02 ("cuántas entradas quedan disponibles
de cada tipo"). Comparte prioridad con la US1 pero se prueba aparte.

**Independent Test**: con el reloj del servidor fijado, en un evento con un tipo de cupo 10,
comprar 3 sin pagar y 2 pagadas: el resumen dice 5 disponibles, 3 pendientes, 2 vendidas y 0
usadas; adelantar el reloj 15 minutos sin que nadie escriba: 8 disponibles, 0 pendientes, 2
vendidas (el cupo de la pendiente vencida ya vuelve); dentro de la ventana de uso, registrar el
uso de una de las entradas vendidas: 8 disponibles, 2 vendidas, 1 usada.

**Acceptance Scenarios**:

1. **Given** un evento con varios tipos de entrada, **When** se abre "Compras del evento",
   **Then** hay un resumen con cada tipo (nombre) y sus disponibles, pendientes, vendidas y
   usadas, en el mismo orden que en el detalle del evento.
2. **Given** pendientes vencidas sin materializar, **When** se muestra el resumen, **Then** sus
   entradas ya cuentan como disponibles y no como pendientes (lectura "al día" de la 006), y los
   disponibles coinciden con los que ve un comprador en el detalle.
3. **Given** una compra `CONFIRMADA` de 3 entradas con 1 usada (la compra ya está `UTILIZADA`),
   **When** se muestra el resumen, **Then** cuenta 3 vendidas y 1 usada para su tipo.
4. **Given** una compra cancelada (por el comprador o al vencer), **When** se muestra el resumen,
   **Then** sus entradas no cuentan como pendientes, vendidas ni usadas.
5. **Given** un tipo sin entradas disponibles, **When** se muestra el resumen, **Then** se
   indica "Agotado" (con texto, no solo con color), además del 0.
6. **Given** un tipo de entrada sin compras, **When** se muestra el resumen, **Then** igual
   aparece, con todo su cupo disponible y 0 en las demás cantidades.
7. **Given** una entrada que pasa a `UTILIZADA`, **When** se vuelve a mostrar el resumen,
   **Then** los disponibles y las vendidas no cambian y las usadas suben en 1: usar una entrada
   no devuelve ni consume cupo.

---

### User Story 3 - Registrar el uso de una entrada con su código (Priority: P1)

Cada compra tiene una entrada por unidad comprada, y cada entrada tiene su propio código. Cuando
un comprador llega al evento, muestra el código de una de sus entradas (en "Tu compra" o "Ver mis
entradas"); el organizador lo ingresa en "Compras del evento", ve a qué compra y tipo corresponde,
confirma y esa entrada pasa a `UTILIZADA`, con quién y cuándo en su historial. Las demás entradas
de la misma compra siguen como estaban.

**Why this priority**: es la única forma de alcanzar `UTILIZADA`, el estado que habilita las
reseñas (011) e impide la cancelación (009). Sin ella, el ciclo de vida de la compra queda
incompleto.

**Independent Test**: con el servidor recién arrancado (el seed incluye un evento cuya ventana de
uso está abierta, FR-016), elegir a Sofía y anotar el código de una de sus dos entradas de ese
evento; elegir a Lucía, abrir las compras del evento, ingresar ese código, confirmar y ver la
entrada como "Utilizada"; volver a Sofía y verificar que esa entrada figura "Utilizada" y la otra
sigue "Confirmada"; en la compra de 3 entradas con 1 ya usada, usar otra y verificar "2 de 3
entradas usadas"; verificar por el lado del servidor que un código inexistente, de otro evento
(por ejemplo, uno del Festival, cuya ventana además está cerrada), de una entrada no confirmada o
ya utilizada se rechaza, y que también se rechaza el intento de otro usuario.

**Acceptance Scenarios**:

1. **Given** una compra recién registrada (`PENDIENTE`), **When** se crean sus entradas, **Then**
   hay una por unidad comprada, cada una con un código propio, distinto del de cualquier otra
   entrada, y con el mismo estado que la compra.
2. **Given** una compra que cambia de estado antes de confirmarse o al confirmarse (`PENDIENTE →
   CONFIRMADA`, `PENDIENTE → CANCELADA`, incluido el vencimiento), **When** se consulta, **Then**
   todas sus entradas tienen ese mismo estado.
3. **Given** una compra `CONFIRMADA`, **When** el comprador la ve en "Tu compra" o en "Ver mis
   entradas", **Then** ve cada entrada con su código y su estado; en una compra no confirmada no
   se muestran códigos.
4. **Given** el código de una entrada `CONFIRMADA` de un evento propio, dentro de la ventana de
   FR-016, **When** el organizador lo ingresa, **Then** ve el comprador, el tipo de entrada y el
   estado de esa entrada, y se le pide confirmación antes de registrar el uso, porque no se puede
   deshacer.
5. **Given** la confirmación, **When** se registra el uso, **Then** esa entrada pasa a
   `UTILIZADA` con un cambio de estado cuyo autor es el organizador y la fecha y hora del
   servidor; las demás entradas de la compra no cambian. Si es la primera entrada usada, la
   compra también pasa a `UTILIZADA` (FR-012d); si no, la compra no cambia de estado.
6. **Given** un código que no corresponde a ninguna entrada de **ese** evento (inexistente, mal
   escrito o de otro evento), **When** el organizador lo ingresa, **Then** se le informa que no
   hay ninguna entrada con ese código en este evento, sin revelar datos de otros eventos.
7. **Given** el código de una entrada que no está `CONFIRMADA` (pendiente, cancelada —incluida
   una pendiente vencida "al día"—, ya utilizada o reembolsada), **When** se intenta registrar su
   uso, **Then** se rechaza con un mensaje que dice su estado (por ejemplo, "Esta entrada ya se
   utilizó") y nada cambia.
8. **Given** un usuario que no es el organizador del evento (incluido el propio comprador),
   **When** intenta registrar el uso de una entrada, **Then** se le niega el acceso y nada cambia.
9. **Given** el uso registrado, **When** el organizador vuelve a la lista, **Then** la compra
   refleja la entrada utilizada; y el comprador la ve "Utilizada" en sus pantallas.
10. **Given** dos pedidos simultáneos de uso sobre la misma entrada (por ejemplo, dos toques
    rápidos o dos dispositivos), **When** el servidor los procesa, **Then** uno solo tiene éxito y
    la entrada suma un único cambio a `UTILIZADA`; el otro se rechaza porque ya se utilizó.
11. **Given** un pedido de uso cuya respuesta se pierde, **When** el organizador vuelve a
    ingresar el código o a mirar la lista, **Then** ve el estado real que devuelve el servidor
    (sin reintentos automáticos de la escritura, como en la 006).

---

### User Story 4 - Lista al día y ante fallas (Priority: P2)

La lista refleja lo último que pasó y se comporta bien cuando no hay compras o el servidor no
responde.

**Why this priority**: mejora la confiabilidad de lo anterior; no habilita nada nuevo.

**Independent Test**: abrir las compras de un evento sin compras y ver el mensaje de vacío;
comprar con otro usuario y volver a la pantalla: aparece la compra nueva; cortar el servidor y
verificar el error con reintento.

**Acceptance Scenarios**:

1. **Given** un evento propio sin compras, **When** se abre "Compras del evento", **Then** el
   resumen por tipo se muestra igual y la lista dice "Todavía nadie compró entradas".
2. **Given** la pantalla, **When** se está cargando, falla o tiene datos, **Then** muestra los
   cuatro estados como el resto de la app (cargando, error con reintento, vacío y datos).
3. **Given** la pantalla abierta, **When** el organizador vuelve a ella desde otra pantalla,
   **Then** la lista y el resumen se vuelven a pedir.
4. **Given** un cambio de usuario, **When** el nuevo usuario abre la app, **Then** nunca ve las
   compras de eventos del usuario anterior.
5. **Given** un evento que se borró o dejó de existir mientras la pantalla estaba abierta,
   **When** se vuelve a pedir, **Then** la app informa que el evento no existe y vuelve a Mis
   eventos.

### Edge Cases

- Evento sin compras: resumen completo, lista vacía con su mensaje.
- Pendiente que vence con la pantalla abierta: al volver a pedir la lista figura `CANCELADA` y su
  cupo aparece disponible; no hace falta que se actualice sola en el momento exacto (a diferencia
  de la 007) — ver Assumptions.
- Registrar el uso fuera de la ventana permitida (FR-016): a las 4 h 01 min antes del inicio o a
  las 12 h 01 min después, se rechaza con un mensaje que dice desde y hasta qué hora se puede;
  exactamente a las 4 h antes o a las 12 h después, se acepta.
- Evento que empieza a las 23:00: se pueden usar entradas desde las 19:00 hasta las 11:00 del día
  siguiente.
- Evento ya realizado (empezó) pero dentro de las 12 h: se ven sus compras en solo lectura del
  evento y igual se pueden registrar usos.
- Para la demo, el seed necesita un evento cuya ventana incluya el momento de arranque del
  servidor (lo decide el plan).
- Registrar el uso de una compra que el comprador acaba de cancelar (cuando exista la 009) o que
  venció entre que se mostró la lista y se tocó la acción: se rechaza como transición inválida y
  la lista se refresca.
- Código ingresado con espacios o en minúsculas: se acepta igual (el código se compara sin
  espacios ni distinción de mayúsculas).
- El mismo código ingresado dos veces seguidas: la segunda vez informa "Esta entrada ya se
  utilizó".
- Compra de 4 entradas donde llegan 2 personas: se usan 2 entradas, las otras 2 siguen
  `CONFIRMADA` (usables más tarde) y la compra queda `UTILIZADA` ("2 de 4 entradas usadas"), ya
  sin poder cancelarse.
- Uso y cancelación simultáneos sobre la misma compra: ocurren bajo el cerrojo del evento; gana
  el primero y el otro se rechaza.
- El organizador que también compró en eventos ajenos: no se mezcla; no hay compras propias en
  sus eventos (la 006 no lo permite).
- Tipo de entrada agotado: "Agotado" con texto.
- Servidor caído: error con reintento, como en el resto de la app.

## Requirements *(mandatory)*

### Functional Requirements

**Ver las compras**

- **FR-001**: Desde la pantalla de un evento propio (la de la 004, editable o en solo lectura),
  el organizador DEBE poder abrir "Compras del evento".
- **FR-002**: El sistema DEBE devolver al organizador **todas** las compras del evento, de todos
  los compradores y en todos los estados, en una sola consulta que traiga lo que cada fila
  necesita (comprador, tipo, cantidad, total, fecha de compra, estado y, según el estado, la hora
  límite de pago o quién la canceló), sin que la app pida cada compra o comprador por separado.
- **FR-003**: Cada compra DEBE mostrar su estado con texto y color, con el mismo componente y los
  mismos textos y colores que el resto de la app.
- **FR-004**: La lista DEBE estar "al día": una pendiente vencida según el reloj del servidor se
  devuelve `CANCELADA` (cancelada por el sistema) aunque no se haya guardado, y consultar no
  guarda nada (reglas de lectura de la 006).
- **FR-005**: La lista DEBE ordenarse por fecha de compra descendente, con desempate por id.
- **FR-006**: Una `PENDIENTE` DEBE mostrar hasta qué hora puede pagarse; una `CANCELADA`, si
  venció sin pagarse o si la canceló el comprador.

**Disponibles por tipo**

- **FR-007**: La misma pantalla DEBE mostrar, por cada tipo de entrada del evento y en el orden
  del evento, su nombre y cuatro cantidades de entradas, todas calculadas "al día" (una pendiente
  vencida cuenta como cancelada y su cupo ya volvió):
  - **disponibles**: el cupo disponible del tipo;
  - **pendientes**: entradas de compras `PENDIENTE` no vencidas;
  - **vendidas**: entradas de compras `CONFIRMADA` o `UTILIZADA` (todas sus entradas, usadas o
    no);
  - **usadas**: entradas en estado `UTILIZADA` (un subconjunto de las vendidas).
  Las entradas de compras canceladas o reembolsadas no cuentan en pendientes, vendidas ni usadas.
- **FR-008**: Un tipo sin disponibles DEBE indicarse "Agotado" con texto.
- **FR-009**: Registrar un uso NO DEBE cambiar el cupo disponible.

**Autorización**

- **FR-010**: Solo el organizador del evento DEBE poder ver sus compras y registrar usos; a
  cualquier otro usuario el sistema DEBE negarle el acceso (sin permiso sobre un recurso
  existente), aunque sea comprador de ese evento.
- **FR-011**: Sin usuario identificado, el sistema DEBE rechazar el pedido como usuario no
  identificado; con un evento o una compra inexistentes, como recurso inexistente.

**Registrar el uso**

- **FR-012**: Cada compra DEBE tener una **entrada** por unidad comprada, creada al registrar la
  compra, con un **código** propio que no se repite entre entradas, corto y legible para
  dictarlo o tipearlo (pensado para mostrarse como QR en el futuro).
- **FR-012a**: Hasta que la compra se confirma, el estado de cada entrada DEBE ser idéntico al de
  la compra (también "al día": al vencer una pendiente, sus entradas figuran canceladas). Desde
  `CONFIRMADA`, cada entrada cambia de estado por separado.
- **FR-012b**: El comprador DEBE ver los códigos y el estado de cada entrada de sus compras
  `CONFIRMADA` (y de las que tengan entradas ya utilizadas) en "Tu compra" y en "Ver mis
  entradas"; en compras no confirmadas no se muestran códigos. Nadie más que el comprador ve los
  códigos.
- **FR-012c**: El organizador DEBE poder ingresar un código en "Compras del evento" y ver a qué
  entrada corresponde (comprador, tipo y estado) antes de registrar su uso.
- **FR-012d**: Al registrarse el uso de la **primera** entrada de una compra `CONFIRMADA`, la
  compra DEBE pasar a `UTILIZADA`, con su propio cambio de estado en el historial (autor: el
  organizador, misma fecha y hora que el de la entrada). Las demás entradas siguen `CONFIRMADA` y
  DEBEN poder usarse igual mientras la compra está `UTILIZADA`; usarlas no agrega cambios de
  estado a la compra. Una compra `UTILIZADA` no se cancela (ni ella ni sus entradas sin usar).
- **FR-012e**: La lista de "Compras del evento" y las pantallas del comprador DEBEN indicar, en
  una compra `UTILIZADA`, cuántas de sus entradas se usaron ("2 de 4 entradas usadas").
- **FR-013**: Todo uso registrado DEBE sumar un cambio de estado al historial de esa entrada, con
  el organizador como autor y la fecha y hora del reloj del servidor.
- **FR-014**: Registrar el uso de una entrada que no esté `CONFIRMADA` (incluida una de una
  pendiente vencida "al día") DEBE rechazarse como transición inválida, sin cambiar nada; un
  código que no es de una entrada del evento DEBE responderse como entrada inexistente en ese
  evento.
- **FR-015**: Verificar el estado y registrar el uso DEBEN ocurrir bajo el cerrojo del evento,
  volviendo a leer la compra, sus entradas y el reloj adentro (constitución, "Operaciones atómicas
  por evento"): dos usos simultáneos de la misma entrada, o un uso y una cancelación, nunca se
  aplican los dos.
- **FR-016**: El uso solo DEBE poder registrarse desde **4 horas antes** de la fecha y hora de
  inicio del evento hasta **12 horas después** del inicio, ambos extremos inclusive, según el
  reloj del servidor (leído dentro del cerrojo). Fuera de esa ventana, el sistema DEBE
  rechazarlo con un mensaje que indique desde y hasta qué hora (de Buenos Aires) se puede, sin
  cambiar nada. La ventana es fija para todos los eventos (no la configura el organizador).
- **FR-017**: El organizador DEBE identificar la entrada cuyo uso registra **ingresando su
  código** (FR-012c); no hay acción de uso por fila de compra.
- **FR-018**: Antes de registrar el uso, la app DEBE pedir confirmación mostrando comprador y
  tipo de la entrada, porque el uso no se puede deshacer.
- **FR-019**: Si el código corresponde a una entrada que no está `CONFIRMADA` (o se ingresa fuera
  de la ventana de FR-016), la app DEBE mostrar por qué no se puede usar y no ofrecer la
  confirmación; el servidor igual lo valida.
- **FR-020**: Una entrada `UTILIZADA` NO DEBE poder cancelarse nunca (constitución,
  "Cancelación").
- **FR-021**: La escritura del uso NO DEBE reintentarse sola; al terminar (con éxito o error),
  la app DEBE volver a pedir las compras del evento, el evento, y las vistas de compras del
  comprador ("Mis compras", "Tu compra", "Ver mis entradas"), para que todos vean el estado
  real.

**Pantalla**

- **FR-022**: La pantalla DEBE manejar cargando, error con reintento, vacío ("Todavía nadie
  compró entradas", con el resumen por tipo visible) y datos.
- **FR-023**: La pantalla DEBE volver a pedir los datos al volver a enfocarse, y nunca mostrar
  datos de otro usuario tras un cambio de usuario.
- **FR-024**: Ante un evento inexistente, la app DEBE informarlo y volver a Mis eventos.
- **FR-025**: Las pantallas "Compras del evento" y "Registrar ingreso" DEBEN ser accesibles
  (etiqueta en todo control sin texto propio; cada fila de compra, no tocable, se lee como un
  único elemento que resume comprador, tipo, cantidad, total y estado; el campo del código y sus
  botones, enfocables por separado; cada código se lee de a un carácter) y usables en 360 px de
  ancho.

### Key Entities

- **Compra** (existente, 006): suma sus **entradas**, una por unidad, y la transición
  `CONFIRMADA → UTILIZADA` al usarse su primera entrada (FR-012d).
- **Entrada** (nueva): pertenece a una única compra; tiene un **código** único y un estado con su
  historial. Hasta la confirmación de la compra, su estado es el de la compra; después, la
  transición propia es `CONFIRMADA → UTILIZADA`, que solo hace el organizador del evento.
- **CambioEstadoCompra** (existente): estado, autor (usuario o sistema) y fecha y hora; el del uso
  de una entrada tiene al organizador como autor.
- **Evento / TipoEntrada** (existentes, 004): el cupo disponible de cada tipo, "al día", es lo que
  muestra el resumen.
- **Compras del evento** (vista nueva): lo que ve el organizador: el resumen por tipo
  (disponibles, pendientes, vendidas y usadas) y las compras con su comprador, tipo, cantidad, total, fecha de compra, estado y
  los datos propios del estado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un organizador llega a las compras de uno de sus eventos en 2 toques o menos desde
  Mis eventos.
- **SC-002**: El 100 % de las compras de un evento aparecen en su lista, cada una con su estado
  con texto, y ninguna compra de otro evento.
- **SC-003**: Los disponibles por tipo coinciden en el 100 % de los casos con los que ve un
  comprador en el detalle del mismo evento en el mismo momento, también con pendientes vencidas
  sin materializar.
- **SC-004**: Registrar el uso de una entrada (ingresar el código, revisar y confirmar) lleva
  menos de 15 segundos con el comprador delante.
- **SC-005**: El 100 % de los intentos de ver compras o registrar usos por alguien que no es el
  organizador se rechazan, y ningún intento sobre una compra no confirmada la cambia.
- **SC-006**: Ante N pedidos simultáneos de uso sobre la misma compra, el historial termina con
  exactamente un cambio a `UTILIZADA`.

## Assumptions

- El organizador accede desde la pantalla del evento propio (004) y no hay una pestaña nueva.
- La lista no se actualiza sola cuando vence una pendiente (la 007 sí lo hace): se refresca al
  enfocarse y después de registrar un uso. Para el organizador, unos minutos de desfase en una
  pendiente no cambian ninguna decisión.
- Una fila de la lista no abre "Tu compra" (esa pantalla es del comprador); el detalle que el
  organizador necesita está en la fila. El chat de la compra (010) podrá sumar una entrada
  desde acá.
- Sin filtros, búsqueda ni agrupación por estado: los eventos del TP tienen pocas compras; el
  resumen por tipo cubre "cómo viene la venta".
- El uso es por entrada individual (Clarifications), pero la compra conserva su estado y su
  transición `CONFIRMADA → UTILIZADA` (con la primera entrada usada): refina la constitución sin
  contradecirla ("Estados de una compra", "Cancelación" y "Reseñas" siguen mirando la compra).
  Sí suma la entidad **Entrada**, que la constitución no lista: el plan propone agregarla en
  "Entidades" (enmienda MINOR).
- Un uso registrado no se deshace (fuera de alcance; la constitución no define
  `UTILIZADA → CONFIRMADA`).
- La cancelación de confirmadas y su interacción con el uso las completa la 009; acá basta con
  que `UTILIZADA` no tenga transición a `CANCELADA`.
- El total es el fijado al comprar (006) y la fecha de compra es la del primer cambio de estado.
- Depende de 004 (evento propio, cerrojo por evento) y 006 (compra, historial, vencimiento
  perezoso, lectura "al día"); reutiliza el componente único de estado de compra.
