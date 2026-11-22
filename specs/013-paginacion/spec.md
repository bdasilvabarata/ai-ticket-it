# Feature Specification: Paginación

**Feature Branch**: `feature/013-paginacion`

**Created**: 2026-11-22

**Status**: Draft

**Input**: User description: "Feature 013 — Paginación. Hoy tres listas llegan enteras al teléfono y con volúmenes realistas la app se vuelve pesada: el catálogo de Explorar (no es raro que haya 50 eventos a la venta), Compras del evento del organizador (100 compras es un número lógico) y las reseñas del organizador en el detalle del evento (un organizador puede tener 100 reseñas). Queremos una lógica de paginación común que se aplique en esos lugares." (descripción completa —tamaño de página, paginador, las tres listas y las preguntas abiertas— en la invocación de `/speckit-specify`).

**Casos de uso**:

- UC-03 — *Como comprador, quiero buscar eventos* (catálogo de Explorar, con su búsqueda, categoría
  y orden de la 005).
- UC-02 — *Como organizador, quiero ver las compras de mis eventos* (Compras del evento, 008).
- UC-10 — *Como comprador, quiero ver las reseñas de eventos anteriores en los Eventos de cada
  organizador* (sección "Reseñas del organizador" del detalle, 012).

## Alcance

**Incluye**: páginas de **hasta 10 elementos** armadas por el servidor, con el total de elementos
y de páginas en la respuesta; un **paginador común** en la app (el mismo componente en todas las
listas paginadas) con hasta 5 botones de página y la regla de cuáles se muestran; la paginación del
catálogo de Explorar (con búsqueda, categoría y orden aplicados sobre todos los eventos antes de
paginar, y vuelta a la página 1 al cambiarlos); la paginación de la lista de Compras del evento del
organizador (con el resumen por tipo, la ventana de uso y el contador de mensajes sin responder
calculados sobre todas las compras); el recorte de la sección "Reseñas del organizador" del detalle
del evento a las **3 reseñas más recientes**, con el puntaje y la cantidad reales; la pantalla
pública "Ver todas las reseñas" del organizador, paginada con el mismo paginador; datos de ejemplo
suficientes para ver el paginador en cada lista.

**No incluye**: desplazamiento infinito o "cargar más" (la navegación es por páginas); elegir el
tamaño de página desde la app; botones "anterior" / "siguiente" aparte de los de número (salvo que
el plan los justifique); recordar la página al salir de la pantalla y volver; paginar listas que no
se nombran acá (Mis compras, Mis eventos, el chat de una compra, los tipos de entrada, "Ver mis
entradas");
cambiar cómo se ordenan, filtran o calculan las listas (005, 008, 012); favoritos (014); pulido
estético (015). Las preguntas abiertas quedaron resueltas en "Clarifications".

## Clarifications

### Session 2026-11-22

- Q: ¿El filtro por estado y el chip "Sin responder" de Compras del evento filtran en el servidor
  antes de paginar, y cambiar de filtro vuelve a la página 1? → A: Sí: pasan al servidor (`estado` y
  `sinResponder` en el pedido), se aplican antes de paginar y cambiar de filtro vuelve a la página
  1; el resumen por tipo, la ventana de uso y el contador siguen siendo de todas las compras, y los
  chips se muestran solo si el evento tiene compras.
- Q: ¿Qué pasa si se pide una página posterior a la última? → A: El servidor devuelve la última
  página que exista, con su número real en la respuesta, y la app marca esa como actual; con la
  lista vacía, la página 1 sin elementos.
- Q: ¿Las reseñas que no entran en las 3 del detalle se ven en una pantalla "Ver todas las
  reseñas" paginada? → A: Sí: botón "Ver todas las reseñas" bajo las 3, solo si el organizador
  tiene más de 3; abre una pantalla pública con puntaje, cantidad y todas las reseñas en páginas de
  10 (orden de la 012) con el paginador común.
- Q: ¿"Mis compras" (la pestaña del comprador) también se pagina? → A: No: queda entera, como las
  demás listas que esta feature no nombra.

## User Scenarios & Testing *(mandatory)*

Los actores son cualquier **usuario** que explora el catálogo o mira el detalle público de un
evento, y el **organizador** de un evento que mira sus compras. El rol sale de la relación con el
evento, no de un atributo del usuario (constitución, "Roles").

### User Story 1 - Explorar el catálogo por páginas (Priority: P1)

Un usuario abre Explorar y ve los primeros 10 eventos del catálogo (los no realizados, filtrados y
ordenados como en la 005), y debajo el paginador. Toca otra página y ve los 10 eventos siguientes
en el mismo orden. Si escribe una búsqueda, elige una categoría o cambia el orden, vuelve a la
página 1 de los nuevos resultados.

**Why this priority**: es la lista más usada de la app y la primera que crece (50 eventos a la
venta es normal); además, define el paginador común que usan las otras dos historias.

**Independent Test**: con los datos de ejemplo ampliados (más de 10 eventos a la venta), abrir
Explorar y ver 10 tarjetas y el paginador con la página 1 marcada; tocar la última página y ver los
eventos restantes en el mismo orden que tendría la lista completa; escribir una búsqueda y ver los
resultados desde la página 1 (o sin paginador si entran en una sola página).

**Acceptance Scenarios**:

1. **Given** un catálogo con más de 10 eventos que cumplen la búsqueda y la categoría, **When** el
   usuario abre Explorar, **Then** ve los 10 primeros según el orden elegido y el paginador con la
   página 1 marcada como actual.
2. **Given** el catálogo en la página 1, **When** el usuario toca el botón de otra página,
   **Then** ve los eventos de esa página, que son los que ocupan esas posiciones en la lista
   completa filtrada y ordenada, y el paginador marca esa página.
3. **Given** el usuario en una página distinta de la 1, **When** cambia el texto de búsqueda, la
   categoría o el orden (también al invertir el sentido), **Then** el catálogo vuelve a la página 1
   de los nuevos resultados.
4. **Given** un orden o un filtro elegido, **When** se arma cualquier página, **Then** el orden y
   el filtro se aplicaron sobre **todos** los eventos antes de cortar la página (por ejemplo, el
   evento de mejor puntaje está en la página 1, no "el mejor de cada página").
5. **Given** una búsqueda cuyos resultados entran en una sola página (10 o menos), **When** se
   muestra, **Then** no aparece el paginador.
6. **Given** una búsqueda sin resultados, **When** se muestra, **Then** el catálogo muestra su
   vacío de siempre y no aparece el paginador.
7. **Given** el aviso de "hay eventos próximos" de la 005, **When** se pagina, **Then** sigue
   valiendo para el catálogo completo, no para la página.

---

### User Story 2 - El paginador común (Priority: P1)

En cualquier lista paginada, el usuario ve el mismo paginador: hasta 5 botones de página, siempre
la primera y la última, la actual y sus vecinas, con la actual distinguible sin depender del color
y anunciada por el lector de pantalla.

**Why this priority**: es la pieza común que piden las tres listas; sin él, ninguna paginación se
puede usar.

**Independent Test**: con distintas combinaciones de total de páginas y página actual, verificar
qué botones se muestran (los ejemplos de abajo), que la actual se distingue por algo más que el
color y que cada botón se anuncia como "Página N", con la actual marcada.

**Acceptance Scenarios**:

1. **Given** 10 páginas y la actual es la 1, **When** se muestra el paginador, **Then** los
   botones son `1 2 3 4 10`.
2. **Given** 10 páginas y la actual es la 6, **When** se muestra, **Then** son `1 5 6 7 10`.
3. **Given** 10 páginas y la actual es la 9, **When** se muestra, **Then** son `1 7 8 9 10`.
4. **Given** 3 páginas (o cualquier total de 5 o menos), **When** se muestra, **Then** están
   todas: `1 2 3`.
5. **Given** una sola página, **When** se muestra la lista, **Then** no hay paginador.
6. **Given** cualquier paginador, **When** se lo recorre con el lector de pantalla, **Then** cada
   botón se anuncia como "Página N" y el de la página actual se anuncia como seleccionado.
7. **Given** cualquier paginador, **When** se mira sin distinguir colores, **Then** la página
   actual se reconoce igual (por forma, relleno, borde o peso del texto, no solo por color).
8. **Given** el botón de la página actual, **When** se lo toca, **Then** no cambia nada (no vuelve
   a pedir la misma página como si fuera otra).

---

### User Story 3 - Compras del evento por páginas (Priority: P2)

El organizador abre Compras del evento y ve la ventana de uso, el resumen por tipo de entrada y el
contador de compras con mensajes sin responder como hasta ahora —todo calculado sobre todas las
compras— y debajo la lista de compras de a 10, con el paginador.

**Why this priority**: es la segunda lista que crece (100 compras de un evento es lo esperable) y
el organizador la usa en el ingreso; depende del paginador común (US2).

**Independent Test**: con un evento del seed con más de 10 compras, abrir Compras del evento como
su organizador; ver 10 filas y el paginador; verificar que el resumen por tipo (vendidas, usadas,
agotado) y el contador de mensajes sin responder cuentan todas las compras, también las de las
páginas no visibles; pasar a la última página y ver las restantes en el mismo orden (de la más
nueva a la más vieja, 008).

**Acceptance Scenarios**:

1. **Given** un evento con más de 10 compras, **When** su organizador abre Compras del evento,
   **Then** ve las 10 primeras según el orden de la 008 y el paginador con la página 1 marcada.
2. **Given** esa pantalla, **When** el organizador cambia de página, **Then** ve las compras de
   esa página y el resumen por tipo, la ventana de uso y el contador de mensajes sin responder no
   cambian (son de todas las compras).
3. **Given** una compra de una página no visible con un mensaje sin responder, **When** el
   organizador mira el contador, **Then** esa compra está contada.
4. **Given** una acción sobre una fila (confirmar un reembolso, abrir el chat), **When** termina y
   la lista se vuelve a pedir, **Then** el organizador sigue en la misma página o, si ya no existe,
   en la última que exista (FR-005, FR-018).
5. **Given** un evento con 10 compras o menos, **When** se abre la pantalla, **Then** no hay
   paginador.
6. **Given** el organizador en la página 3 sin filtro, **When** elige un estado o el chip "Sin
   responder", **Then** ve la página 1 de las compras de **todo** el evento que cumplen el filtro
   (filtradas en el servidor antes de paginar), con el paginador según el total filtrado, y el
   resumen por tipo, la ventana de uso y el contador no cambian.
7. **Given** un filtro cuyo resultado está vacío, **When** se muestra, **Then** aparece el vacío
   propio de ese filtro, sin paginador, y los chips siguen visibles para cambiarlo.

---

### User Story 4 - Las 3 reseñas más recientes en el detalle del evento (Priority: P3)

Un usuario abre el detalle de un evento y, en "Reseñas del organizador", ve el puntaje y la
cantidad reales del organizador (calculados con todas sus reseñas) y solo las 3 reseñas más
recientes.

**Why this priority**: la sección ya existe (012) y hoy lista todas; recortarla aligera el detalle
sin perder información del puntaje. Es el cambio más chico.

**Independent Test**: con un organizador del seed con más de 3 reseñas, abrir el detalle de un
evento suyo y ver exactamente 3 reseñas, las más recientes, con el puntaje y la cantidad iguales a
los de la tarjeta del catálogo (que cuentan todas).

**Acceptance Scenarios**:

1. **Given** un organizador con más de 3 reseñas, **When** se abre el detalle de cualquier evento
   suyo, **Then** la sección muestra las 3 más recientes (orden de la 012) y el puntaje y la
   cantidad de **todas**.
2. **Given** un organizador con 3 reseñas o menos, **When** se abre el detalle, **Then** se ven
   todas, como en la 012.
3. **Given** un organizador sin reseñas, **When** se abre el detalle, **Then** la sección sigue
   diciendo "Todavía no tiene reseñas", sin puntaje.
4. **Given** una reseña nueva, **When** se vuelve a abrir el detalle, **Then** aparece primera
   entre las 3, la más vieja de las 3 anteriores deja de verse y la cantidad suma una.
5. **Given** un organizador con más de 3 reseñas, **When** se abre el detalle, **Then** debajo de
   las 3 aparece "Ver todas las reseñas"; con 3 o menos (o ninguna), no aparece.

---

### User Story 5 - Ver todas las reseñas del organizador (Priority: P3)

Desde la sección "Reseñas del organizador" del detalle, el usuario toca "Ver todas las reseñas" y
llega a una pantalla pública con el puntaje y la cantidad del organizador y todas sus reseñas, de a
10, con el paginador común.

**Why this priority**: sin ella, el recorte a 3 (US4) deja reseñas que nadie puede leer (UC-10);
depende del paginador común (US2) y de US4.

**Independent Test**: con un organizador del seed con más de 10 reseñas, tocar "Ver todas las
reseñas" en el detalle de un evento suyo; ver 10 reseñas, el paginador y el mismo puntaje y
cantidad que en el detalle; pasar a la última página y ver las restantes en el orden de la 012.

**Acceptance Scenarios**:

1. **Given** el detalle de un evento cuyo organizador tiene más de 3 reseñas, **When** el usuario
   toca "Ver todas las reseñas", **Then** llega a la pantalla con el puntaje, la cantidad y la
   página 1 de las reseñas (las más recientes primero).
2. **Given** un organizador con más de 10 reseñas, **When** el usuario cambia de página, **Then**
   ve las reseñas de esa página y el puntaje y la cantidad no cambian.
3. **Given** un organizador con entre 4 y 10 reseñas, **When** se abre la pantalla, **Then** se
   ven todas, sin paginador.
4. **Given** cualquier usuario (también el propio organizador o uno sin compras), **When** abre la
   pantalla, **Then** la ve igual: es pública, como la sección del detalle (012).
5. **Given** un evento que ya no existe, **When** se abre la pantalla, **Then** se muestra el
   error de "no encontrado" de siempre.

---

### Edge Cases

- Una lista con exactamente 10 elementos: una sola página, sin paginador; con 11, dos páginas
  (`1 2`), la segunda con un elemento.
- Una lista vacía: cero elementos y su vacío de siempre, sin paginador (y sin decir "página 1 de
  0").
- Totales de páginas entre 2 y 5: se ven todos los botones; de 6 en adelante, la regla de los 5
  botones (US2).
- Página actual en los extremos (la primera o la última): la anterior o la siguiente no existen y
  los botones se completan con las contiguas hasta llegar a 5 (`1 2 3 4 10`, `1 7 8 9 10`).
- Una lista que se achica mientras el usuario mira una página alta (un evento pasó a realizado y
  salió del catálogo, una compra pendiente venció y otro filtro la excluye, etc.): al volver a
  pedirla, el servidor devuelve la última página que exista y el paginador marca esa (FR-005).
- Una lista que crece mientras se navega (otro usuario compra o publica): una página puede
  repetir o saltear un elemento respecto de la anterior; es aceptable, porque cada página es la
  foto del momento en que se pide.
- Elementos con el mismo valor de orden (misma fecha, mismo puntaje): el desempate estable de cada
  lista (005, 008, 012) garantiza que un elemento no aparezca en dos páginas de la misma consulta.
- Un número de página que no es un entero positivo (0, negativo, texto): el servidor lo rechaza
  como dato inválido, con el detalle del campo.
- Sin número de página en el pedido: es la página 1.
- El servidor no disponible al cambiar de página: la lista muestra el error de conexión de
  siempre y el paginador no da por hecho el cambio.
- Cambiar de página mientras la anterior todavía carga: se muestra la última pedida, nunca una
  página vieja encima de la nueva.

## Requirements *(mandatory)*

### Functional Requirements

**Paginación común (servidor)**

- **FR-001**: Las listas paginadas MUST entregarse por páginas de **hasta 10 elementos**, armadas
  por el servidor: la app pide una página y recibe solo sus elementos, nunca la lista completa.
- **FR-002**: Cada respuesta paginada MUST informar, además de los elementos, el número de la
  página entregada, el tamaño de página, el **total de elementos** y el **total de páginas** de la
  lista completa (con los filtros aplicados).
- **FR-003**: El orden y los filtros de cada lista MUST aplicarse sobre **todos** sus elementos
  antes de cortar la página, con un desempate estable, de modo que concatenar las páginas de una
  misma consulta da la lista completa, sin repetidos ni faltantes.
- **FR-004**: Un pedido sin número de página MUST tratarse como la página 1; un número que no sea
  un entero mayor o igual a 1 MUST rechazarse como dato inválido, con el detalle del campo.
- **FR-005**: Un pedido de una página posterior a la última MUST responderse con la **última
  página que exista** (no es un error), informando en la respuesta su número real; la app MUST
  marcar como actual la página que informa la respuesta, no la que pidió. Una lista vacía tiene 0
  elementos y 0 páginas, y cualquier página pedida se responde como la página 1 sin elementos.
- **FR-006**: El tamaño de página MUST ser el mismo (10) en todas las listas y lo fija el servidor;
  la app no lo elige.

**Paginador (app)**

- **FR-007**: La app MUST usar **un único componente de paginador** en todas las listas paginadas.
- **FR-008**: El paginador MUST mostrar hasta 5 botones de página según esta regla: si hay 5
  páginas o menos, todas; si no, siempre la primera, la última y la actual, y la anterior y la
  siguiente a la actual cuando existen; si con eso hay menos de 5 botones, se completa con las
  páginas contiguas a las ya elegidas hasta llegar a 5. Los botones van en orden ascendente.
  Ejemplos con 10 páginas: actual 1 → `1 2 3 4 10`; actual 6 → `1 5 6 7 10`; actual 9 →
  `1 7 8 9 10`; con 3 páginas → `1 2 3`.
- **FR-009**: La página actual MUST distinguirse por algo más que el color, y cada botón MUST ser
  un elemento accesible propio, anunciado como "Página N", con la actual marcada como
  seleccionada.
- **FR-010**: Con una sola página (o una lista vacía), el paginador MUST NOT mostrarse.
- **FR-011**: Al tocar otra página, la lista MUST mostrar esa página (con su estado de cargando y
  de error como cualquier consulta) y el paginador MUST marcarla como actual; tocar la actual no
  hace nada.

**Catálogo de Explorar (UC-03)**

- **FR-012**: El catálogo MUST paginarse con FR-001 a FR-006, con la búsqueda, la categoría y el
  orden (y su sentido) de la 005 aplicados antes de paginar.
- **FR-013**: Cambiar el texto de búsqueda, la categoría, el orden o su sentido MUST volver a la
  página 1.
- **FR-014**: El indicador de que hay eventos próximos (005) MUST seguir calculándose sobre el
  catálogo completo, no sobre la página.

**Compras del evento (UC-02, organizador)**

- **FR-015**: La lista de compras de Compras del evento MUST paginarse con FR-001 a FR-006, en el
  orden de la 008.
- **FR-016**: La ventana de uso, el resumen por tipo de entrada (vendidas, usadas, agotado) y el
  contador de compras con mensajes sin responder MUST calcularse sobre **todas** las compras del
  evento, no sobre la página, y no cambian al cambiar de página.
- **FR-017**: El filtro por estado (uno de los cinco estados o "Todas") y el chip "Sin responder"
  MUST aplicarse en el **servidor**, sobre todas las compras del evento y antes de paginar: el
  pedido los lleva como datos (`estado`, `sinResponder`), y el total de elementos y de páginas es
  el de la lista filtrada. Un estado inválido MUST rechazarse como dato inválido, con el detalle del
  campo. Cambiar de filtro MUST volver a la página 1. El resumen por tipo, la ventana de uso y el
  contador de mensajes sin responder MUST NOT depender del filtro (FR-016). Los chips se muestran
  solo si el evento tiene alguna compra (no si solo el filtro dejó la lista vacía).
- **FR-018**: Después de una acción sobre una compra de la lista (confirmar un reembolso, abrir el
  chat, registrar un ingreso que la cambia), la lista MUST volver a mostrarse al día en la misma
  página y con el mismo filtro, sujeto a FR-005.
- **FR-019**: La lista paginada MUST seguir siendo solo para el organizador del evento y sin
  códigos de entradas (008).

**Reseñas del organizador en el detalle (UC-10)**

- **FR-020**: La sección "Reseñas del organizador" del detalle del evento MUST mostrar solo las
  **3 reseñas más recientes** del organizador (de todos sus eventos, en el orden de la 012).
- **FR-021**: El puntaje y la cantidad de reseñas de la sección MUST ser los reales, calculados
  sobre **todas** las reseñas del organizador, y MUST seguir coincidiendo con los de la tarjeta del
  catálogo (012, FR-018).
- **FR-022**: Cuando el organizador tiene más de 3 reseñas, la sección MUST ofrecer "Ver todas
  las reseñas", que abre una pantalla **pública** con el puntaje y la cantidad reales (los mismos
  de FR-021) y todas las reseñas del organizador paginadas con FR-001 a FR-006 y el paginador común
  (FR-007 a FR-011), en el orden de la 012. Con 3 reseñas o menos, el acceso MUST NOT mostrarse.
  Cada reseña se muestra igual que en la sección del detalle (012), sin datos del comprador más
  allá de los que ya muestra.

**Otras listas**

- **FR-023**: "Mis compras" (UC-01) MUST NOT paginarse: sigue llegando entera, con su orden y su
  refresco de la 007. Ninguna otra lista cambia.

**Datos de ejemplo**

- **FR-024**: Los datos de ejemplo MUST permitir ver el paginador en cada lista paginada: más de 10
  eventos a la venta en el catálogo (para ver al menos 2 páginas sin filtros), al menos un evento
  con más de 10 compras y al menos un organizador con más de 10 reseñas (para ver el recorte a 3 y
  al menos 2 páginas en "Ver todas las reseñas"); los datos agregados MUST
  cumplir las reglas de las features anteriores (cupo, estados, reseñas solo con compra
  `UTILIZADA`, etc.) y los ids fijos existentes MUST NOT cambiar.

### Key Entities

- **Página** (vista, no se guarda): los elementos de una porción de una lista ordenada y filtrada,
  con el número de página, el tamaño de página, el total de elementos y el total de páginas.
- **Pedido de página** (entrada): el número de página que pide la app (1 si falta), junto con los
  filtros y el orden propios de cada lista.
- **Catálogo** (005, sin cambios de reglas): pasa a entregarse por páginas.
- **Compras del evento** (008, sin cambios de reglas): su lista de compras pasa a entregarse por
  páginas; el resumen, la ventana de uso y el contador siguen siendo del total.
- **Reseñas del organizador** (012, sin cambios de reglas): la sección del detalle muestra las 3
  más recientes con el puntaje y la cantidad del total, y la pantalla "Ver todas las reseñas" las
  entrega por páginas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con 50 eventos a la venta o 100 compras de un evento, cada pantalla recibe y muestra
  como máximo 10 elementos de la lista por vez, y la sección de reseñas del detalle, como máximo 3;
  con 100 reseñas, "Ver todas las reseñas" muestra como máximo 10 por vez.
- **SC-002**: Recorrer todas las páginas de una lista (sin cambios en los datos mientras tanto) da
  exactamente los mismos elementos y en el mismo orden que la lista completa, sin repetidos ni
  faltantes.
- **SC-003**: En el 100 % de las combinaciones de total de páginas (1 a 20) y página actual, el
  paginador muestra los botones de la regla de FR-008 y nunca más de 5.
- **SC-004**: Un usuario llega a cualquier página de una lista de 10 páginas en 3 toques o menos
  desde la página 1.
- **SC-005**: El puntaje y la cantidad de reseñas de un organizador son iguales en la tarjeta del
  catálogo y en la sección del detalle, aunque la sección muestre solo 3.
- **SC-006**: El resumen por tipo y el contador de mensajes sin responder de Compras del evento son
  iguales en todas las páginas y cuentan todas las compras.
- **SC-007**: Con el lector de pantalla, un usuario identifica la página actual y llega a otra sin
  ver la pantalla.

## Assumptions

- El tamaño de página (10), la regla de los 5 botones y las 3 reseñas del detalle son fijos, como
  pide la descripción; no se configuran desde la app.
- Las cuatro preguntas abiertas quedaron resueltas en `/speckit-clarify` (ver "Clarifications").
- El orden de cada lista es el que ya tiene (005 para el catálogo, 008 para Compras del evento, 012
  para las reseñas); esta feature no cambia órdenes ni filtros, solo corta la lista en páginas.
- La página elegida vive en la pantalla: al salir y volver (o al reiniciar la app) se empieza por
  la página 1. Al volver a pedir la misma lista por un refresco (foco, una acción sobre una fila),
  se conserva la página actual. Abrir el detalle de un evento desde Explorar y volver **no** es
  salir de la pantalla: la pestaña no se desmonta y sigue en la misma página.
- Las listas se piden de a una página por vez; la app no guarda páginas anteriores para mostrarlas
  sin pedirlas de nuevo más allá de la caché de consultas que ya usa.
- Cada página es la foto de la lista en el momento en que se pide; no hay "cursor" que congele la
  lista entre páginas (datos en memoria de un TP, sin consistencia entre pedidos).
- El catálogo sigue siendo público y Compras del evento sigue siendo solo del organizador; la
  paginación no cambia quién ve qué.
- Depende de 005 (catálogo, búsqueda, orden y puntaje), 008 (Compras del evento, resumen y ventana
  de uso; el filtro por estado y "Sin responder" de las mejoras del organizador) y 012 (reseñas del
  organizador). La 012 decidía "lista completa, sin paginar ni Ver todas"; esta feature la
  reemplaza: la sección del detalle muestra 3 y suma la pantalla "Ver todas las reseñas".
