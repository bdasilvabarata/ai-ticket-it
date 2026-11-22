# Feature Specification: Reseñas de eventos

**Feature Branch**: `feature/012-resenias-de-eventos`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "Reseñas de eventos (feature 012, UC-09 y UC-10). Un comprador con una compra UTILIZADA de un evento puede reseñarlo una sola vez: una puntuación entera de 1 a 5 y un comentario de texto. Es una reseña por comprador y por evento, aunque tenga varias compras utilizadas de ese evento. […] Las reseñas alimentan el puntaje del organizador que ya existe desde la 005 […]; ese cálculo no cambia, solo deja de estar vacío." (descripción completa —reglas, app, seed y decisiones abiertas— en la invocación de `/speckit-specify`).

**Casos de uso**:

- UC-09 — *Como organizador, quiero que, una vez utilizada una entrada, el comprador pueda puntuar
  el Evento numéricamente y dejar un comentario.*
- UC-10 — *Como comprador, quiero ver las reseñas de eventos anteriores en los Eventos de cada
  organizador.*
- Regla "Reseñas" de la constitución: *solo puede reseñar un evento quien tenga una compra
  `UTILIZADA` de ese evento, una única vez por evento. La puntuación es un entero de 1 a 5.*
- Regla "Puntaje del organizador": *promedio de las puntuaciones de las reseñas de sus eventos.
  Sin reseñas, el organizador no tiene puntaje (no es 0).*

## Alcance

**Incluye**: reseñar un evento (puntuación entera de 1 a 5 y comentario) quien tenga al menos una
compra `UTILIZADA` de ese evento, una única vez por comprador y evento; los rechazos del servidor
(sin compra utilizada, ya reseñado, organizador del evento, datos inválidos); el acceso "Reseñar
evento" desde "Tu compra" y desde cada fila de "Mis compras" de una compra `UTILIZADA` sin reseña,
y la reseña propia en su lugar cuando ya existe; la sección "Reseñas del organizador" en el detalle
público del evento (Explorar) con el puntaje, la cantidad y la lista de reseñas de todos sus
eventos, de la más reciente a la más vieja; el puntaje del organizador de la 005 (tarjetas del
catálogo, detalle y orden por puntaje) calculado con las reseñas reales; reseñas en los datos de
ejemplo.

**No incluye**: respuestas del organizador a una reseña; "me gusta", reportes o moderación de
reseñas; reseñas de organizadores o de usuarios (solo de eventos); fotos o adjuntos; reseñas
anónimas; notificaciones al organizador; filtrar u ordenar las reseñas de otra forma que la
cronológica; paginación de la lista; cambiar cómo se calcula o se redondea el puntaje (005);
favoritos (013); pulido estético (014); editar o borrar una reseña (una vez enviada, queda como
está); una pantalla propia de reseñas del organizador o un "Ver todas" (la lista completa vive en
el detalle del evento).

## Clarifications

### Session 2026-11-21

- Q: ¿Un comprador puede editar o borrar su reseña después de enviarla? → A: **No**: una vez
  enviada, la reseña queda como está (ni edición ni borrado), como los mensajes del chat (011).
- Q: ¿El comentario es obligatorio y cuál es su largo máximo, recortado? → A: **Opcional** (puede
  ir vacío o solo con espacios, que cuenta como sin comentario), **hasta 500 caracteres**
  recortado (500 se acepta; 501 se rechaza); sin comentario, la reseña muestra solo la puntuación.
- Q: ¿Alcanza con la compra `UTILIZADA` o además el evento tiene que estar realizado? → A:
  **Alcanza con la compra `UTILIZADA`**: se puede reseñar apenas se registra el ingreso, aunque el
  evento todavía no haya empezado; no hay chequeo de "realizado" ni plazo.
- Q: ¿Las reseñas del organizador se ven solo en el detalle del evento o también en una pantalla
  propia? → A: **Solo en la sección "Reseñas del organizador" del detalle del evento**, con la
  lista completa; sin pantalla propia ni "Ver todas".
- Q: ¿Dónde completa el comprador la reseña al tocar "Reseñar evento"? → A: en una **pantalla
  propia "Reseñar evento"**, colgada de la compra (como "Chat de la compra"); se llega igual desde
  "Tu compra" y desde la fila de "Mis compras", y al enviar vuelve atrás, donde la compra ya
  muestra la reseña.

## User Scenarios & Testing *(mandatory)*

Los actores son el **comprador** que asistió a un evento (tiene una compra `UTILIZADA` de él) y
cualquier **usuario** que mira el detalle público de un evento en Explorar. El organizador de un
evento nunca es comprador de ese evento (006), y el rol sale de la relación con la compra o el
evento, no de un atributo del usuario (constitución, "Roles").

### User Story 1 - El comprador reseña un evento al que asistió (Priority: P1)

Un comprador fue a un evento (al menos una de sus entradas se registró en el ingreso, así que su
compra quedó `UTILIZADA`). Desde "Tu compra" o desde "Mis compras" toca "Reseñar evento", elige una
puntuación de 1 a 5, si quiere escribe un comentario y la envía. A partir de ahí ve su reseña en lugar del
botón, y el puntaje del organizador la incluye.

**Why this priority**: es UC-09 y la fuente de todos los datos: sin altas no hay reseñas que
listar ni puntaje que mostrar.

**Independent Test**: con los datos de ejemplo, elegir a un comprador con una compra `UTILIZADA`
sin reseña, abrir la compra desde "Mis compras", tocar "Reseñar evento", elegir 4 y escribir
"Muy buena organización"; enviar y ver la reseña propia (4 y el comentario) en "Tu compra" y en la
fila de "Mis compras", sin el botón; verificar del lado del servidor que quedó una reseña con ese
comprador, ese evento, la puntuación, el comentario y la fecha y hora del servidor, y que la
compra, sus entradas y el cupo del evento no cambiaron.

**Acceptance Scenarios**:

1. **Given** un comprador con una compra `UTILIZADA` de un evento que todavía no reseñó, **When**
   abre "Tu compra" o mira esa fila en "Mis compras", **Then** ve "Reseñar evento".
2. **Given** la pantalla "Reseñar evento" (abierta desde "Tu compra" o desde "Mis compras"), **When** el comprador elige una puntuación de 1 a 5,
   escribe o no un comentario de hasta 500 caracteres y envía, **Then** el servidor guarda la reseña con la fecha y hora
   del servidor, la app vuelve a la pantalla anterior y ahí muestra la reseña propia en lugar del
   botón.
3. **Given** un comprador que ya reseñó el evento, **When** abre cualquiera de sus compras
   `UTILIZADA` de ese evento, **Then** ve su reseña (puntuación y comentario) y no ve "Reseñar
   evento".
4. **Given** un comprador con **dos** compras `UTILIZADA` del mismo evento, **When** lo reseña
   desde una de ellas, **Then** la otra también muestra la misma reseña y no ofrece reseñar de nuevo.
5. **Given** una compra en cualquier estado distinto de `UTILIZADA` (`PENDIENTE`, `CONFIRMADA`,
   `CANCELADA`, `REEMBOLSADA`), **When** el comprador la mira, **Then** no ve "Reseñar evento" (aunque
   el evento ya se haya realizado).
6. **Given** una puntuación fuera de 1 a 5, no entera o ausente, o un comentario de más de 500 caracteres (recortado), **When**
   el comprador envía, **Then** el servidor la rechaza con el detalle junto a cada campo, la app
   conserva lo escrito y no se guarda nada.
7. **Given** un comprador que intenta reseñar un evento del que no tiene ninguna compra
   `UTILIZADA` (por ejemplo, solo una `CONFIRMADA`), **When** envía, **Then** el servidor lo rechaza
   con un motivo claro.
8. **Given** un comprador que ya reseñó el evento, **When** intenta enviar otra reseña de ese
   evento (por ejemplo, con dos pedidos casi simultáneos o desde una pantalla desactualizada),
   **Then** el servidor rechaza la segunda con un motivo claro y queda una sola reseña.
9. **Given** el organizador de un evento, **When** intenta reseñar su propio evento, **Then** el
   servidor lo rechaza.
10. **Given** un evento que no existe, **When** alguien intenta reseñarlo, **Then** el servidor
    responde que el evento no existe.

---

### User Story 2 - Ver las reseñas del organizador en el detalle del evento (Priority: P2)

Un usuario mira el detalle de un evento en Explorar y, para decidir si confía en quien lo
organiza, ve la sección "Reseñas del organizador": el puntaje promedio, cuántas reseñas tiene y
las reseñas de sus eventos (puntuación, comentario, autor, evento y fecha), de la más reciente a
la más vieja.

**Why this priority**: es UC-10; le da sentido al puntaje que el catálogo ya muestra. Depende de
que existan reseñas (US1 o el seed).

**Independent Test**: con los datos de ejemplo, abrir en Explorar un evento de un organizador con
reseñas y ver la sección con su puntaje y cantidad (iguales a los de la tarjeta del catálogo) y la
lista ordenada de la más reciente a la más vieja, cada una con su puntuación, su comentario, el
nombre del autor, el nombre del evento reseñado y la fecha; abrir un evento de un organizador sin
reseñas y ver "Todavía no tiene reseñas", sin puntaje 0.

**Acceptance Scenarios**:

1. **Given** un organizador con reseñas en cualquiera de sus eventos, **When** un usuario abre el
   detalle de **cualquier** evento suyo, **Then** ve "Reseñas del organizador" con el puntaje (el
   mismo valor y redondeo que la tarjeta del catálogo), la cantidad y todas sus reseñas.
2. **Given** esa lista, **When** se muestra, **Then** está ordenada por fecha de la reseña de la
   más reciente a la más vieja, y cada reseña muestra puntuación, comentario, nombre del autor,
   nombre del evento reseñado y fecha.
3. **Given** un organizador sin reseñas, **When** se abre el detalle de un evento suyo, **Then** la
   sección dice "Todavía no tiene reseñas" y no muestra un puntaje (ni 0 ni vacío).
4. **Given** un usuario que es el organizador del evento, **When** abre su detalle en Explorar,
   **Then** ve la misma sección que cualquier otro usuario.
5. **Given** una reseña nueva, **When** cualquier usuario vuelve a abrir el detalle de un evento de
   ese organizador o el catálogo, **Then** la reseña aparece primera en la lista y el puntaje y la
   cantidad la incluyen.

---

### User Story 3 - El puntaje del organizador se calcula con reseñas reales (Priority: P3)

El catálogo de Explorar ya muestra el puntaje de cada organizador y permite ordenar por puntaje
(005), pero hasta ahora siempre decía "Sin reseñas". Con las reseñas, el puntaje deja de estar
vacío y el orden por puntaje ordena de verdad.

**Why this priority**: UC-11 (orden por puntaje) queda completo sin cambiar su cálculo; es un
efecto de US1 y del seed, sin pantallas nuevas.

**Independent Test**: con los datos de ejemplo, ordenar el catálogo por "Mejor puntaje primero" y
ver primero los eventos del organizador con mejor promedio y al final los de organizadores sin
reseñas; ver en cada tarjeta el puntaje y la cantidad que corresponden a las reseñas del seed.

**Acceptance Scenarios**:

1. **Given** las reseñas del seed, **When** se abre el catálogo, **Then** cada tarjeta muestra el
   promedio y la cantidad de reseñas de su organizador, y "Sin reseñas" para los que no tienen.
2. **Given** el orden por puntaje, **When** se elige, **Then** los eventos se ordenan por el puntaje
   de su organizador según la regla de la 005 (sin puntaje, al final), con organizadores de
   puntajes distintos en el seed para que el orden se note.

---

### Edge Cases

- Un comprador con varias compras `UTILIZADA` del mismo evento: una sola reseña, visible desde
  todas ellas (US1, escenario 4).
- Una compra `UTILIZADA` con solo algunas de sus entradas usadas ("1 de 3"): alcanza para reseñar;
  la regla es "compra `UTILIZADA`", definida por la compra (010), sin contar entradas.
- Una compra `UTILIZADA` de un evento que todavía no empezó (la ventana de uso abre 4 h antes del
  inicio): ya puede reseñarse; no hace falta que el evento esté realizado (Clarifications).
- Dos envíos casi simultáneos de la misma reseña (doble toque o dos dispositivos): queda una sola;
  el segundo se rechaza como "ya reseñado" y la app no manda un segundo pedido desde el mismo
  formulario.
- Un comprador que reseñó y después compra más entradas del mismo evento: no puede reseñar de nuevo.
- Un comentario con espacios al principio o al final: se recortan antes de validar y de guardar;
  si queda vacío, la reseña es solo la puntuación (sin comentario), no un rechazo.
- Una reseña sin comentario: en la lista y en "Tu compra" / "Mis compras" se muestra solo la
  puntuación, sin un texto de relleno.
- Un evento que se elimina: un evento con compras no se puede eliminar (004), y un evento con
  reseñas siempre tiene compras `UTILIZADA`, así que no hay reseñas huérfanas.
- El nombre del autor de una reseña: se muestra el nombre del usuario tal como está al leer.
- Muchas reseñas de un organizador: la lista se muestra completa, sin paginar (datos en memoria de
  un TP).
- El servidor no disponible al enviar: la app muestra el error de conexión de siempre, no da la
  reseña por guardada y no reintenta sola.

## Requirements *(mandatory)*

### Functional Requirements

**Alta de una reseña (UC-09)**

- **FR-001**: El sistema MUST permitir que un usuario reseñe un evento solo si tiene **al menos una
  compra `UTILIZADA`** de ese evento. "Compra `UTILIZADA`" es la definición de la compra (010), sin
  redefinirla. No hace falta que el evento esté realizado ni hay plazo: se puede reseñar desde que
  se registra el ingreso, en cualquier momento después.
- **FR-002**: El sistema MUST permitir **una sola reseña por comprador y por evento**, aunque el
  comprador tenga varias compras `UTILIZADA` de ese evento; un segundo intento se rechaza, también
  si llega casi a la vez que el primero.
- **FR-003**: El sistema MUST rechazar la reseña del organizador de su propio evento.
- **FR-004**: Una reseña MUST tener una puntuación **entera de 1 a 5** (obligatoria) y MAY tener
  un comentario **opcional** de hasta **500 caracteres**, contados después de recortar los espacios
  del principio y del final; un comentario ausente, vacío o solo con espacios se guarda como "sin
  comentario". El servidor valida ambos y devuelve el detalle por campo.
- **FR-005**: El sistema MUST registrar en cada reseña su autor, su evento, la puntuación, el
  comentario y la **fecha y hora del servidor** en que se recibió (no la del celular).
- **FR-006**: Los rechazos MUST distinguirse entre sí con un motivo claro: no identificado, datos
  inválidos, evento inexistente, organizador del evento, sin compra `UTILIZADA` del evento y ya
  reseñado; la reseña rechazada no deja nada guardado.
- **FR-006b**: Una reseña enviada MUST NOT poder editarse ni borrarse: no hay operación para
  cambiarla ni para quitarla.
- **FR-007**: Reseñar MUST NOT cambiar la compra (estado, historial, entradas, total, mensajes) ni
  el cupo del evento.

**Reseña en "Tu compra" y "Mis compras"**

- **FR-008**: "Tu compra" y cada fila de "Mis compras" MUST mostrar "Reseñar evento" cuando la
  compra está `UTILIZADA` y su comprador todavía no reseñó el evento, y la **reseña propia**
  (puntuación y comentario) en su lugar cuando ya lo reseñó; en cualquier otro estado, ninguna de
  las dos cosas. Lo decide el servidor en los datos de la compra, al día en cada consulta.
- **FR-009**: "Reseñar evento" MUST abrir una pantalla propia "Reseñar evento" de esa compra (la
  misma desde "Tu compra" y desde "Mis compras"), con el nombre del evento, la elección de la
  puntuación de 1 a 5 (cada valor accesible por separado, con el elegido anunciado) y el campo
  "Comentario (opcional)"; al enviar con éxito vuelve a la pantalla anterior, que ya muestra la
  reseña. La app no valida por su cuenta: muestra los detalles del servidor junto a cada campo y
  conserva lo escrito ante un rechazo. Si el servidor responde que ya está reseñado o que la compra
  no está `UTILIZADA`, muestra su motivo. Salir con algo elegido o escrito sin enviar pide
  confirmar el descarte, como los demás formularios.
- **FR-010**: Un toque repetido en "Enviar" MUST NOT mandar un segundo pedido, y el envío no se
  reintenta solo.
- **FR-011**: Después de una reseña, la app MUST mostrar los datos al día en las pantallas que la
  muestran: "Tu compra" y "Mis compras" del comprador, el puntaje del organizador en el catálogo y
  en el detalle de sus eventos, y la sección "Reseñas del organizador".
- **FR-012**: En "Mis compras", "Reseñar evento" MUST ser un elemento accesible propio, hermano de
  los datos tocables de la fila (como "Pagar"), para que el lector de pantalla los enfoque por
  separado.

**Reseñas del organizador (UC-10)**

- **FR-013**: El detalle público de todo evento en Explorar MUST tener la sección "Reseñas del
  organizador", visible para cualquier usuario (también el propio organizador), con el puntaje del
  organizador, la cantidad de reseñas y la lista de **todas** las reseñas de **todos** sus eventos
  (también del evento que se está mirando). Es el **único** lugar donde se listan: no hay pantalla
  propia de reseñas.
- **FR-014**: Cada reseña de la lista MUST mostrar la puntuación, el comentario (si tiene), el nombre del
  autor, el nombre del evento reseñado y la fecha (día de calendario de Buenos Aires, dado por el
  servidor), y la lista MUST estar ordenada de la más reciente a la más vieja (con un desempate
  estable para reseñas de la misma fecha y hora).
- **FR-015**: Sin reseñas, la sección MUST decir "Todavía no tiene reseñas" y MUST NOT mostrar un
  puntaje (ni 0).
- **FR-016**: La lista MUST NOT exponer datos de las compras (códigos de entradas, totales,
  estados) ni identificadores internos del autor más allá de lo necesario para mostrarla.

**Puntaje del organizador (005)**

- **FR-017**: El puntaje del organizador (promedio sin redondear y cantidad) MUST seguir
  calculándose como en la 005 (promedio de las puntuaciones de las reseñas de todos sus eventos,
  sin puntaje si no hay reseñas), ahora con las reseñas guardadas; el redondeo y el texto siguen
  siendo los de la app (005), y el orden por puntaje del catálogo no cambia de regla.
- **FR-018**: El puntaje de la sección "Reseñas del organizador" MUST coincidir con el de la
  tarjeta del catálogo y el del detalle del mismo organizador.

**Datos de ejemplo**

- **FR-019**: Los datos de ejemplo MUST incluir reseñas de compras `UTILIZADA` (y las compras y
  eventos necesarios para que cumplan las reglas) de al menos dos organizadores con puntajes
  distintos, y al menos un organizador sin reseñas, para probar el orden por puntaje, la sección
  con reseñas, la sección vacía y "Reseñar evento" (al menos una compra `UTILIZADA` sin reseña).

### Key Entities

- **Reseña** (amplía la mínima de la 005): autor (el comprador), evento, puntuación entera de 1 a
  5, comentario opcional (hasta 500 caracteres) y fecha y hora en que el servidor la recibió. Única por autor y evento. Es su
  propio agregado: no vive dentro de la compra ni del evento.
- **Compra** (sin cambios de modelo): de ella sale si el comprador puede reseñar (`UTILIZADA`); la
  vista de la compra suma si su comprador ya reseñó el evento y, si lo hizo, su reseña.
- **Puntaje del organizador** (derivado, no se guarda, 005): promedio y cantidad de las reseñas
  de los eventos del organizador.
- **Reseñas del organizador** (vista): el puntaje y la lista de reseñas de sus eventos, cada una con
  el nombre del autor y del evento.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un comprador con una compra `UTILIZADA` reseña el evento desde "Mis compras" en menos
  de 1 minuto y 3 toques más el texto (abrir, puntuar, enviar).
- **SC-002**: En el 100 % de los intentos fuera de las reglas (sin compra `UTILIZADA`, ya reseñado,
  organizador del evento, puntuación fuera de 1 a 5) el servidor rechaza y no queda nada guardado;
  nunca hay dos reseñas del mismo comprador para el mismo evento.
- **SC-003**: Un usuario ve el puntaje, la cantidad y las reseñas del organizador en el detalle de
  cualquiera de sus eventos sin salir de esa pantalla.
- **SC-004**: El puntaje y la cantidad de un organizador son iguales en la tarjeta del catálogo, el
  detalle y la sección de reseñas, y nunca se muestra un puntaje 0 a un organizador sin reseñas.
- **SC-005**: Con los datos de ejemplo, el orden "Mejor puntaje primero" deja al menos dos
  organizadores en orden distinto del de fecha, con los organizadores sin reseñas al final.
- **SC-006**: Después de enviar una reseña, el comprador ve la suya y el nuevo puntaje en la
  próxima visita a cada pantalla, sin reiniciar la app.

## Assumptions

- Las cuatro decisiones que quedaron abiertas en la especificación (editar o borrar, comentario,
  evento realizado y pantalla propia) están resueltas en "Clarifications".
- El nombre del autor es el que la app ya usa para un usuario (nombre y apellido).
- La fecha de la reseña se muestra como día de calendario de Buenos Aires con el formato de fechas
  de la app; el servidor guarda la fecha y hora completas.
- La sección "Reseñas del organizador" usa la misma respuesta del detalle del evento o una
  consulta propia: lo decide el plan; para el usuario es parte del mismo detalle.
- La identificación del usuario sigue siendo la simulada de las features anteriores (usuario
  elegido en la app); el detalle público no exige usuario para leer las reseñas.
- No hay base de datos: las reseñas viven en memoria como el resto, y cada reinicio vuelve a las del
  seed.
- Depende de 008 (ingreso: compras `UTILIZADA`), 010 (definición de compra/entrada usada) y 005
  (puntaje y orden por puntaje, la entidad `Resenia` mínima y su repositorio y service, que esta
  feature amplía sin reemplazar).
