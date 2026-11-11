# Feature Specification: Explorar eventos

**Feature Branch**: `feature/005-explorar-eventos`

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "Feature 005 — Explorar eventos (UC-03, UC-11). Cualquier usuario explora el catálogo desde la pestaña Explorar, que hoy muestra la sección pendiente. Explorar: lista los eventos publicados [default: solo los que no se realizaron; también los del propio usuario y los agotados, marcados como "Agotado"]. Cada tarjeta muestra nombre, categoría, fecha y hora, precio "desde" (el menor precio de sus tipos de entrada; "Gratis" si es 0), nombre del organizador y su puntaje [default: con un decimal; "Sin reseñas" si no tiene]. Tiene los cuatro estados, con un vacío distinto para "no hay eventos" y para "ningún evento coincide con la búsqueda". Búsqueda por texto: un campo que busca en el nombre y la descripción del evento [default: coincidencia parcial, sin distinguir mayúsculas ni tildes, ignorando espacios al principio y al final; vacío = sin filtro; hasta 100 caracteres]. Filtro por categoría: una sola categoría del catálogo o "Todas" [default: "Todas"]. Texto y categoría se combinan (deben cumplirse los dos). Orden (UC-11): por fecha (la más próxima primero), por precio (el precio "desde" más bajo primero) o por puntaje del organizador (el más alto primero; los organizadores sin puntaje van al final) [default: por fecha; un solo sentido por criterio; los empates se desempatan por fecha y después por nombre]. El puntaje del organizador es el promedio de las reseñas de sus eventos: hasta que exista la 011 no hay reseñas, así que es siempre "sin puntaje" (no 0). Búsqueda, filtro y orden los resuelve el servidor en un endpoint público de listado [default: sin usuario requerido; una categoría inexistente da una lista vacía; un criterio de orden desconocido es entrada inválida]. Detalle del evento: al tocar una tarjeta se abre el detalle público, con nombre, descripción, categoría, fecha y hora, imágenes de multimedia [default: en una fila horizontal; si una imagen no carga, no se muestra], organizador con nombre y puntaje, y los tipos de entrada con nombre, descripción, precio y cupo disponible ("Agotado" si es 0). Amplía el GET público del evento que ya existe con el nombre y el puntaje del organizador, sin cambiar los campos actuales. Un evento inexistente muestra "no encontrado"; si el evento ya se realizó, el detalle lo indica. Fuera de alcance: comprar (006, el detalle todavía no tiene botón de compra), reseñas y su listado (011, UC-10), filtro por rango de precio, favoritos (012), y paginación."

> La descripción se conserva tal como llegó. Su default "una categoría inexistente da una
> lista vacía" quedó reemplazado por la clarificación del 2026-11-11 (constitución 2.2.0): ver
> FR-016.

**Casos de uso**:

- UC-03 — *Como comprador, quiero buscar Eventos por texto o explorarlos por categorías.*
- UC-11 — *Como comprador, quiero ordenar los Eventos buscados por precio, fecha del evento y
  puntaje del organizador.*

## Alcance

**Incluye**: la pestaña **Explorar** (listado público de los eventos que no se realizaron);
la **búsqueda por texto** en nombre y descripción; el **filtro por una categoría** del
catálogo; el **orden** por fecha, por precio "desde" o por puntaje del organizador; el
**detalle público** de un evento, al que se llega tocando su tarjeta; el **nombre y el puntaje
del organizador** en el listado y en el detalle (el puntaje sin reseñas es "sin puntaje");
los datos de ejemplo necesarios para demostrar "Gratis" y "Agotado".

**No incluye**: comprar entradas (006: el detalle todavía no tiene botón de compra); crear o
listar reseñas y ver las reseñas del organizador (011, UC-09 y UC-10); filtro por rango de
precio; favoritos (012); paginación o carga incremental; gestionar los eventos propios (eso
sigue en Mis eventos, 004); pulido estético (013).

## Clarifications

### Session 2026-11-10

- Q: ¿El precio "desde" se calcula sobre todos los tipos de entrada o solo sobre los que tienen cupo? → A: Sobre todos, agotados o no: el precio mostrado y el orden por precio no cambian a medida que se venden entradas (FR-004).
- Q: Con varias palabras ("rock club"), ¿coincide la frase tal cual o cada palabra por separado? → A: Cada palabra por separado: un evento coincide si contiene todas las palabras, en cualquier orden y lugar del nombre o la descripción; los espacios repetidos entre palabras no cuentan (FR-011).
- Q: Mientras la lista se vuelve a pedir, ¿qué ve el comprador? → A: Un skeleton (tarjetas de relleno con la forma de las tarjetas reales), siempre: en la primera carga y en cada cambio de texto, categoría u orden; los resultados anteriores no quedan a la vista y el campo de búsqueda y los selectores siguen visibles y usables (FR-007, FR-014). Volver a una combinación de texto, categoría y orden que ya se respondió mientras la app está abierta muestra la respuesta de **esa** combinación (no la de la anterior) mientras se revalida; no cuenta como "resultados anteriores".
- Q: Junto al puntaje del organizador, ¿se muestra cuántas reseñas tiene? → A: Sí, en la tarjeta y en el detalle: "4,5 · 12 reseñas" ("1 reseña" en singular); sin reseñas, "Sin reseñas". El servidor informa la cantidad (0 hasta la 011) junto al puntaje (FR-006, FR-009).

### Session 2026-11-11

- Alineación con la constitución 2.2.0 (principio III, "Una referencia que llega en la entrada (por ejemplo, `categoriaId`) se valida con `buscarReferenciada` del service dueño: si no existe, es un dato inválido (400 sobre el campo)"): un pedido con una categoría que no existe en el catálogo ya **no** responde una lista vacía, sino entrada inválida (400) con el detalle en la categoría. Reemplaza el default "una categoría inexistente da una lista vacía" de la descripción inicial (FR-016, US3 escenario 10, caso borde "Categoría inexistente"). En la app no cambia nada: solo se pueden elegir categorías del catálogo.

## User Scenarios & Testing *(mandatory)*

El actor es el **comprador**: cualquier usuario de la app, en su relación con los eventos que
explora (constitución, "Roles"). Explorar no depende de quién sea el usuario actual: todos ven
el mismo catálogo, incluidos los eventos que ellos mismos organizan.

### User Story 1 - Ver el catálogo de eventos próximos (Priority: P1)

El comprador abre la pestaña Explorar y ve los eventos que todavía no se realizaron, del más
próximo al más lejano. Cada tarjeta le dice qué es (nombre y categoría), cuándo es (fecha y
hora de Buenos Aires), cuánto sale como mínimo ("desde $ 8.000" o "Gratis"), quién lo organiza
y qué puntaje tiene el organizador ("Sin reseñas" mientras no haya reseñas). Un evento sin
entradas disponibles aparece igual, marcado como "Agotado".

**Why this priority**: es la puerta de entrada al recorrido de compra (006) y el núcleo de
UC-03: sin catálogo no hay nada que buscar, filtrar, ordenar ni comprar.

**Independent Test**: con los datos de ejemplo, abrir Explorar con cualquier usuario y ver
solo los eventos próximos (no los realizados), en orden de fecha, con los datos de cada
tarjeta; verificar por el lado del servidor que el listado no requiere usuario y no incluye
eventos realizados.

**Acceptance Scenarios**:

1. **Given** eventos próximos y realizados en el catálogo, **When** el comprador abre
   Explorar, **Then** ve solo los próximos, ordenados por fecha y hora, del más cercano al más
   lejano.
2. **Given** una tarjeta del listado, **When** se muestra, **Then** se ven el nombre del
   evento, el nombre de su categoría, su fecha y hora en hora de Buenos Aires, el precio
   "desde" (el menor precio de sus tipos de entrada), el nombre y apellido del organizador y su
   puntaje.
3. **Given** un evento cuyo tipo de entrada más barato cuesta $ 0, **When** se muestra su
   tarjeta, **Then** el precio dice "Gratis".
4. **Given** un evento en el que todos los tipos de entrada tienen cupo disponible 0, **When**
   se muestra su tarjeta, **Then** aparece en el listado con la marca "Agotado", junto a la
   etiqueta y no solo con un color.
5. **Given** un organizador sin reseñas (todos, hasta la 011), **When** se muestra la tarjeta
   de uno de sus eventos, **Then** su puntaje dice "Sin reseñas", nunca "0".
6. **Given** un organizador con puntaje (desde la 011), **When** se muestra la tarjeta, **Then**
   el puntaje se ve con un decimal junto a la cantidad de reseñas (por ejemplo, "4,5 · 12
   reseñas", o "5,0 · 1 reseña").
7. **Given** un evento que organiza el usuario actual, **When** abre Explorar, **Then** ese
   evento también aparece, como cualquier otro.
8. **Given** el listado cargando, con error o sin ningún evento próximo, **When** se muestra,
   **Then** usa los cuatro estados de la app: cargando (con tarjetas skeleton), error con
   "Reintentar", vacío ("Todavía no hay eventos próximos") y éxito.
9. **Given** un evento que pasa a realizado (su fecha y hora llegó según el reloj del
   servidor), **When** el listado se vuelve a pedir, **Then** ese evento ya no aparece.

---

### User Story 2 - Ver el detalle de un evento (Priority: P1)

Al tocar una tarjeta, el comprador abre el detalle del evento: nombre, descripción, categoría,
fecha y hora, las imágenes del evento en una fila que se desliza de costado, el organizador con
su nombre y su puntaje, y cada tipo de entrada con su nombre, descripción, precio y cuántas
entradas quedan ("Agotado" si no queda ninguna). Es la pantalla desde la que, en la 006, va a
comprar.

**Why this priority**: es lo que el comprador necesita para decidir y la pantalla que la 006
completa con la compra (dependencia del backlog). Va junto con US1 en el MVP.

**Independent Test**: tocar una tarjeta de Explorar y ver todos los datos del evento y de sus
tipos de entrada; pedir al servidor el detalle de un evento sin usuario y recibir los datos
actuales más el nombre y el puntaje del organizador; pedir uno inexistente y recibir "no
encontrado".

**Acceptance Scenarios**:

1. **Given** el listado de Explorar, **When** el comprador toca una tarjeta, **Then** se abre
   el detalle de ese evento, con la opción de volver a Explorar.
2. **Given** el detalle abierto, **When** se muestra, **Then** se ven nombre, descripción (si
   tiene), nombre de la categoría, fecha y hora en hora de Buenos Aires, el organizador (nombre,
   apellido y puntaje con el mismo formato que la tarjeta) y la lista de tipos de entrada.
3. **Given** cada tipo de entrada del detalle, **When** se muestra, **Then** se ven su nombre,
   su descripción (si tiene), su precio ("Gratis" si es 0) y su cupo disponible ("30
   disponibles", el formato de cupo que ya usa la app), o "Agotado" si el cupo disponible es 0.
4. **Given** un evento con URLs de multimedia, **When** se muestra el detalle, **Then** las
   imágenes aparecen en una fila horizontal que se desliza; una imagen que no se puede cargar
   no se muestra (sin hueco ni ícono roto), y si no queda ninguna, la fila no aparece.
5. **Given** un evento sin multimedia, **When** se muestra el detalle, **Then** no aparece la
   fila de imágenes.
6. **Given** un evento que ya se realizó (por ejemplo, abierto antes de que llegara su hora),
   **When** se muestra el detalle, **Then** indica claramente "Este evento ya se realizó".
7. **Given** un evento que no existe (por ejemplo, porque su organizador lo eliminó después de
   cargarse el listado), **When** el comprador intenta abrir su detalle, **Then** la app
   muestra "no encontrado" con la opción de volver a Explorar, y el listado deja de mostrarlo
   al volver.
8. **Given** el detalle cargando o con un error del servidor, **When** se muestra, **Then** usa
   los mismos estados que el resto de la app (cargando y error con "Reintentar").
9. **Given** el detalle de un evento, **When** se muestra, **Then** no hay botón de compra
   todavía (lo agrega la 006).

---

### User Story 3 - Buscar por texto y filtrar por categoría (Priority: P2)

El comprador escribe en un campo de búsqueda (por ejemplo, "rock" o "basquet") y la lista se
reduce a los eventos cuyo nombre o descripción contienen ese texto, sin importar mayúsculas ni
tildes. Puede además elegir una categoría ("Música", "Deportes"…) o dejar "Todas". Las dos
condiciones se combinan. Si nada coincide, la app lo dice con un mensaje distinto del de "no
hay eventos" y le sugiere cambiar la búsqueda.

**Why this priority**: es UC-03 en sentido estricto; con pocos eventos el catálogo ya es útil
sin buscar, pero a medida que crece es la forma de encontrar algo.

**Independent Test**: con los datos de ejemplo, buscar "rock" y ver solo los eventos que lo
contienen; buscar "BASQUET" y encontrar "Clásico de básquet"; elegir "Música" y ver solo los
de esa categoría; combinar texto y categoría sin coincidencias y ver el vacío de búsqueda;
verificar por el lado del servidor la misma lógica con pedidos directos.

**Acceptance Scenarios**:

1. **Given** el campo de búsqueda, **When** el comprador escribe un texto, **Then** la lista
   muestra solo los eventos próximos cuyo nombre o descripción contienen ese texto, como parte
   de una palabra o completo, sin distinguir mayúsculas ni tildes ("basquet", "Básquet" y
   "BÁSQUET" encuentran lo mismo).
2. **Given** un texto de varias palabras, como "rock club" o "club   rock", **When** se busca,
   **Then** aparecen los eventos que contienen todas esas palabras en cualquier orden y lugar
   del nombre o la descripción ("Noche de Rock en el Club"); un evento que contiene solo una de
   ellas no aparece.
3. **Given** un texto con espacios al principio o al final, **When** se busca, **Then** esos
   espacios se ignoran; un texto vacío o solo de espacios no filtra nada.
4. **Given** el comprador escribiendo, **When** deja de escribir, **Then** la lista se
   actualiza sola, sin botón de buscar, y siempre refleja el último texto escrito (nunca el
   resultado de un texto anterior); mientras llegan los resultados, la lista muestra tarjetas
   skeleton y el campo conserva el foco y lo escrito.
5. **Given** el campo de búsqueda, **When** el comprador intenta escribir más de 100
   caracteres, **Then** el campo no acepta más; y si el servidor recibe un texto más largo, lo
   rechaza como entrada inválida.
6. **Given** el selector de categoría, **When** se muestra, **Then** ofrece "Todas" (elegida
   al abrir) y cada categoría del catálogo; se puede elegir una sola a la vez.
7. **Given** una categoría elegida, **When** se muestra la lista, **Then** solo aparecen los
   eventos próximos de esa categoría.
8. **Given** un texto y una categoría a la vez, **When** se muestra la lista, **Then** solo
   aparecen los eventos que cumplen las dos condiciones.
9. **Given** una búsqueda o un filtro sin coincidencias, **When** se muestra la lista, **Then**
   aparece un vacío propio ("Ningún evento coincide con tu búsqueda") distinto del vacío de
   catálogo sin eventos, con una acción para limpiar la búsqueda y el filtro.
10. **Given** un pedido directo al servidor con una categoría que no existe en el catálogo,
   **When** el servidor lo recibe, **Then** lo rechaza como entrada inválida con el detalle en
   la categoría.
11. **Given** el comprador que abrió el detalle de un evento desde una búsqueda, **When**
    vuelve a Explorar, **Then** encuentra el mismo texto, la misma categoría y el mismo orden
    que había dejado.

---

### User Story 4 - Ordenar los eventos (Priority: P2)

El comprador elige cómo ordenar la lista: por fecha (lo más próximo primero, el orden de
siempre), por precio (lo más barato primero, según el precio "desde") o por puntaje del
organizador (los mejor calificados primero; los organizadores sin puntaje al final). El orden
se combina con la búsqueda y el filtro.

**Why this priority**: es UC-11. Aporta sobre una lista ya filtrada; el orden por fecha ya
viene por defecto con US1.

**Independent Test**: con los datos de ejemplo, ordenar por precio y verificar que el evento
"desde $ 2.000" queda antes que el "desde $ 8.000"; ordenar por puntaje y verificar que, sin
reseñas, la lista queda en orden de fecha; verificar por el lado del servidor cada criterio,
sus desempates y que un criterio desconocido se rechaza.

**Acceptance Scenarios**:

1. **Given** el selector de orden, **When** se abre Explorar, **Then** el orden elegido es
   "Fecha".
2. **Given** el orden por fecha, **When** se muestra la lista, **Then** los eventos van del
   más próximo al más lejano.
3. **Given** el orden por precio, **When** se muestra la lista, **Then** los eventos van del
   precio "desde" más bajo al más alto, con los gratis primero.
4. **Given** el orden por puntaje del organizador, **When** se muestra la lista, **Then** van
   primero los eventos cuyo organizador tiene el puntaje más alto, y al final los de
   organizadores sin puntaje.
5. **Given** dos eventos empatados en el criterio elegido (mismo precio "desde", mismo puntaje
   o ambos sin puntaje), **When** se ordenan, **Then** va primero el de fecha más próxima, y si
   también empatan en fecha, el de nombre anterior en orden alfabético (sin distinguir
   mayúsculas ni tildes).
6. **Given** un orden, un texto y una categoría elegidos, **When** se muestra la lista,
   **Then** el orden se aplica sobre los eventos que cumplen el texto y la categoría.
7. **Given** un pedido directo al servidor con un criterio de orden desconocido, **When** el
   servidor lo recibe, **Then** lo rechaza como entrada inválida con el detalle en el criterio.
8. **Given** que todavía no hay reseñas (antes de la 011), **When** se ordena por puntaje,
   **Then** todos los organizadores están "sin puntaje" y la lista queda en orden de fecha por
   el desempate; cuando la 011 agregue reseñas, el orden por puntaje funciona sin cambios en
   esta feature.

---

### Edge Cases

- **Momento de "realizado"**: un evento está realizado desde su fecha y hora de inicio
  (inclusive) según el reloj del servidor, igual que en la 004. Lo decide siempre el servidor;
  la app no usa el reloj ni la zona horaria del teléfono para filtrar ni para marcar el
  detalle.
- **Evento que se realiza con la lista abierta**: la lista ya cargada puede seguir mostrándolo
  hasta que se vuelva a pedir; su detalle sí indica "Este evento ya se realizó".
- **Precio "desde" con tipos agotados**: el precio "desde" es el menor precio entre **todos**
  los tipos de entrada del evento, tengan o no cupo; así el precio que se muestra y por el que
  se ordena no cambia a medida que se venden entradas.
- **Agotado parcial**: un evento con algún tipo agotado y otro con cupo no está "Agotado"; en
  el detalle, solo el tipo sin cupo dice "Agotado".
- **Tildes y mayúsculas en la búsqueda**: "cafe" encuentra "Café", "Café" encuentra "cafe" y
  "ROCK" encuentra "Noche de Rock"; la "ñ" se distingue de la "n".
- **Texto con caracteres especiales**: la búsqueda trata cada palabra como texto literal
  (signos, puntos o asteriscos no tienen significado especial).
- **Palabras repartidas**: con "hamlet butacas", un evento cuyo nombre tiene "Hamlet" y cuya
  descripción tiene "butacas" coincide; las palabras no necesitan estar juntas ni en el mismo
  campo.
- **Búsqueda sin resultados vs. catálogo vacío**: si no hay ningún evento próximo, se muestra
  el vacío de catálogo aunque haya un texto o una categoría elegidos; si hay eventos pero
  ninguno coincide, se muestra el vacío de búsqueda.
- **Categoría inexistente**: en la app solo se pueden elegir categorías del catálogo; un
  pedido directo con otra categoría es "entrada inválida" (constitución, principio III: una
  referencia de la entrada que no existe es un dato inválido), no una lista vacía.
- **Multimedia rota**: una URL que no responde o no es una imagen no deja un hueco; las demás
  imágenes se muestran igual.
- **Evento eliminado o editado entre el listado y el detalle**: el detalle siempre muestra lo
  que el servidor tiene en ese momento (el precio o el cupo pueden diferir de la tarjeta); si
  ya no existe, "no encontrado".
- **Servidor no disponible**: Explorar y el detalle muestran el mismo estado de servidor no
  disponible que el resto de la app y se recuperan solos al volver el servidor.
- **Usuario cambiado**: el catálogo es el mismo para todos; cambiar de usuario no cambia lo que
  se ve en Explorar ni en el detalle.
- **Evento propio en Explorar**: tocar un evento que organiza el usuario actual abre el mismo
  detalle público que ve cualquiera (gestionarlo sigue siendo desde Mis eventos).
- **Puntaje sin reseñas**: un organizador sin reseñas no tiene puntaje: se muestra "Sin
  reseñas" y en el orden por puntaje va al final, nunca como si tuviera 0.

## Requirements *(mandatory)*

### Functional Requirements

**Listado de Explorar (US1)**

- **FR-001**: El sistema DEBE ofrecer un listado público de eventos que no requiere usuario
  identificado.
- **FR-002**: El listado DEBE incluir solo los eventos que no se realizaron según el reloj del
  servidor, sin importar quién los organiza (incluidos los del usuario actual) y aunque estén
  agotados.
- **FR-003**: Cada evento del listado DEBE mostrar: nombre, nombre de la categoría, fecha y
  hora en hora de Buenos Aires, precio "desde", nombre y apellido del organizador, puntaje del
  organizador y, si corresponde, la marca "Agotado".
- **FR-004**: El precio "desde" DEBE ser el menor precio entre todos los tipos de entrada del
  evento, tengan o no cupo disponible (no cambia a medida que se venden entradas); si es 0,
  DEBE mostrarse "Gratis".
- **FR-005**: Un evento DEBE marcarse "Agotado" cuando todos sus tipos de entrada tienen cupo
  disponible 0. La marca DEBE ser un texto, no solo un color.
- **FR-006**: El puntaje del organizador DEBE mostrarse con un decimal (coma decimal) junto a
  la cantidad de reseñas, por ejemplo "4,5 · 12 reseñas" ("1 reseña" en singular); un
  organizador sin puntaje DEBE mostrarse como "Sin reseñas". Mismo formato en la tarjeta y en
  el detalle.
- **FR-007**: La pantalla DEBE manejar los cuatro estados (cargando, error con "Reintentar",
  vacío y éxito). El estado cargando DEBE mostrarse como tarjetas skeleton (de relleno, con la
  forma de las tarjetas reales y anunciadas como "Cargando eventos" al lector de pantalla), en
  la primera carga y cada vez que cambian el texto, la categoría o el orden; los resultados
  anteriores NO DEBEN quedar a la vista (volver a una combinación ya respondida en la sesión
  puede mostrar su propia respuesta mientras se revalida) y el campo de búsqueda y los selectores DEBEN seguir
  visibles y usables. Hay dos vacíos distintos: uno para "no hay eventos próximos" y otro para
  "ningún evento coincide con la búsqueda", este último con una acción para limpiar la
  búsqueda y el filtro.
- **FR-008**: Tocar un evento del listado DEBE abrir su detalle público (US2).

**Puntaje del organizador**

- **FR-009**: El puntaje de un organizador DEBE ser el promedio de las puntuaciones de las
  reseñas de todos sus eventos (constitución, "Puntaje del organizador"). Sin reseñas, el
  organizador NO tiene puntaje: el sistema lo informa como ausente, no como 0. Junto al
  puntaje, el sistema DEBE informar la cantidad de reseñas en las que se basa (0 si no tiene).
- **FR-010**: Hasta que exista la 011 no hay reseñas, así que todo organizador está "sin
  puntaje"; el cálculo DEBE quedar listo para que, al existir reseñas, el puntaje, su
  presentación y el orden funcionen sin cambiar esta feature.

**Búsqueda y filtro (US3)**

- **FR-011**: El comprador DEBE poder buscar por un texto que se compara con el nombre y la
  descripción de cada evento. El texto se separa en palabras (uno o más espacios entre ellas)
  y un evento coincide si **cada** palabra aparece en su nombre o en su descripción, en
  cualquier orden y lugar (pueden repartirse entre los dos), como parte de una palabra o
  completa, sin distinguir mayúsculas ni tildes.
- **FR-012**: Los espacios al principio y al final del texto DEBEN ignorarse; un texto vacío o
  solo de espacios NO DEBE filtrar.
- **FR-013**: El texto de búsqueda DEBE tener como máximo 100 caracteres: el campo de la app no
  acepta más, y el servidor rechaza un texto más largo como entrada inválida (400) con el
  detalle en ese campo.
- **FR-014**: La lista DEBE actualizarse sola mientras el comprador escribe (al dejar de
  escribir), sin botón de buscar, y DEBE mostrar siempre el resultado del último texto escrito;
  mientras tanto, muestra el skeleton de FR-007 sin quitarle el foco ni lo escrito al campo.
- **FR-015**: El comprador DEBE poder filtrar por una sola categoría del catálogo o por
  "Todas", que es la opción inicial.
- **FR-016**: Un pedido con una categoría que no existe en el catálogo DEBE rechazarse como
  entrada inválida (400) con el detalle en la categoría (constitución, principio III).
- **FR-017**: El texto y la categoría DEBEN combinarse: un evento aparece solo si cumple los
  dos.

**Orden (US4)**

- **FR-018**: El comprador DEBE poder ordenar por **fecha** (la más próxima primero), por
  **precio** (el precio "desde" más bajo primero) o por **puntaje del organizador** (el más
  alto primero, con los organizadores sin puntaje al final). Cada criterio tiene un único
  sentido.
- **FR-019**: El orden inicial DEBE ser por fecha.
- **FR-020**: Los empates en el criterio elegido DEBEN desempatarse por fecha (la más próxima
  primero) y, si persisten, por nombre en orden alfabético sin distinguir mayúsculas ni
  tildes; para los mismos datos, el orden resultante DEBE ser siempre el mismo.
- **FR-021**: El orden DEBE aplicarse sobre los eventos que cumplen la búsqueda y el filtro.
- **FR-022**: Un pedido con un criterio de orden desconocido DEBE rechazarse como entrada
  inválida (400) con el detalle en el criterio.
- **FR-023**: La búsqueda, el filtro y el orden DEBE resolverlos el servidor; la app envía el
  texto, la categoría y el criterio, y muestra la lista tal como llega.
- **FR-024**: Al volver del detalle a Explorar, la app DEBE conservar el texto, la categoría y
  el orden que el comprador había elegido.

**Detalle del evento (US2)**

- **FR-025**: El detalle DEBE mostrar: nombre, descripción (si tiene), nombre de la categoría,
  fecha y hora en hora de Buenos Aires, imágenes de multimedia, organizador (nombre, apellido y
  puntaje con el formato de FR-006) y los tipos de entrada.
- **FR-026**: Cada tipo de entrada del detalle DEBE mostrar nombre, descripción (si tiene),
  precio ("Gratis" si es 0) y cupo disponible, o "Agotado" si el cupo disponible es 0.
- **FR-027**: Las imágenes DEBEN mostrarse en una fila horizontal desplazable; una imagen que
  no se puede cargar NO DEBE mostrarse, y si el evento no tiene imágenes (o ninguna carga) la
  fila NO DEBE aparecer. Cada imagen DEBE tener una descripción accesible.
- **FR-028**: Si el evento ya se realizó, el detalle DEBE indicarlo con un texto claro ("Este
  evento ya se realizó"), según lo que informa el servidor.
- **FR-029**: Un evento inexistente DEBE responder "no encontrado" (404) y la app DEBE
  mostrarlo con la opción de volver a Explorar.
- **FR-030**: El detalle público de un evento DEBE seguir disponible sin usuario identificado,
  con todos los datos que ya informa hoy (sin quitar ni cambiar ninguno) más el nombre, el
  apellido, el puntaje y la cantidad de reseñas del organizador. Las pantallas de la 004 que usan ese detalle DEBEN
  seguir funcionando igual.
- **FR-031**: El detalle NO DEBE ofrecer comprar todavía (lo agrega la 006).

**Contrato y datos de ejemplo**

- **FR-032**: Las respuestas del listado y del detalle DEBEN ser vistas explícitas (campos
  elegidos), con los mismos datos que muestra la app; el listado DEBE informar, por evento, si
  está agotado, su precio "desde" y los datos del organizador, para que la app no tenga que
  calcularlos.
- **FR-033**: Los datos de ejemplo DEBEN incluir al menos un evento próximo con un tipo de
  entrada gratis y al menos un evento próximo agotado (todos sus tipos con cupo 0), para que
  "Gratis" y "Agotado" se puedan demostrar desde la app.

### Key Entities *(include if feature involves data)*

- **Evento** (existente): nombre, descripción, categoría, fecha y hora, multimedia, organizador
  y tipos de entrada. En esta feature se lo **consulta**: está realizado cuando su fecha y hora
  llegó; su **precio "desde"** es el menor precio de sus tipos; está **agotado** cuando ninguno
  de sus tipos tiene cupo disponible.
- **TipoEntrada** (existente): nombre, descripción, precio y cupo disponible; está agotado con
  cupo 0.
- **Categoria** (existente): catálogo precargado; se usa para filtrar y para mostrar el nombre.
- **Usuario como organizador** (existente): se muestran su nombre y apellido.
- **Puntaje del organizador** (derivado, no se guarda): promedio de las puntuaciones de las
  reseñas de sus eventos, o ausente si no tiene reseñas, junto con la cantidad de reseñas. Las
  **Reseñas** llegan con la 011; hasta entonces el puntaje es siempre ausente y la cantidad, 0.
- **Consulta del catálogo** (no se guarda): texto, categoría y criterio de orden elegidos por
  el comprador.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un comprador encuentra un evento conocido de los datos de ejemplo (por ejemplo,
  escribiendo parte de su nombre sin tildes) y abre su detalle en menos de 30 segundos desde
  que abre Explorar.
- **SC-002**: El 100 % de los eventos listados cumplen a la vez el texto, la categoría y el
  "no realizado", y ningún evento que los cumple queda afuera, verificado con tests sobre los
  datos de cada caso.
- **SC-003**: Para cada criterio de orden (fecha, precio, puntaje) y sus desempates, la lista
  sale en el orden esperado en el 100 % de los casos de prueba, incluidos los organizadores sin
  puntaje al final.
- **SC-004**: La lista refleja un cambio de texto, categoría u orden en menos de 1 segundo
  después de que el comprador deja de escribir o elige una opción, con los datos de ejemplo y
  el servidor en la red local.
- **SC-005**: Ningún organizador sin reseñas se muestra con puntaje "0" ni queda por delante de
  uno con puntaje en el orden por puntaje.
- **SC-006**: Cada regla de la feature (no realizado, búsqueda sin mayúsculas ni tildes, texto
  vacío, máximo de 100 caracteres, categoría inexistente, criterio desconocido, precio "desde",
  "Gratis", "Agotado", puntaje ausente, desempates, evento inexistente) tiene al menos un test
  que la verifica, incluido su caso borde (constitución, principio II).
- **SC-007**: Las pantallas de la feature se usan sin cortes ni desplazamiento horizontal de la
  página en pantallas de 360 px de ancho (solo se desliza la fila de imágenes), con todos los
  controles e imágenes anunciados por el lector de pantalla.
- **SC-008**: Las pantallas de la 004 que usan el detalle de un evento (editar y solo lectura)
  siguen pasando todos sus tests sin cambios de comportamiento.

## Assumptions

- "Realizado" tiene el mismo significado que en la 004: la fecha y hora de inicio ya llegó
  según el reloj del servidor, en hora de Buenos Aires.
- El precio "desde" considera todos los tipos de entrada, agotados o no (ver casos borde): es
  estable mientras se venden entradas y coincide con lo que el organizador cargó.
- Un evento "Agotado" sigue apareciendo en el listado y se puede abrir su detalle; ordenar por
  precio no lo manda al final.
- El puntaje se presenta con un decimal y coma decimal, redondeado al décimo más cercano; el
  orden por puntaje usa el valor sin redondear.
- "Al dejar de escribir" significa una pausa breve (alrededor de medio segundo); los detalles
  de cómo se evita pedir de más son del plan.
- La búsqueda trata la "ñ" como una letra distinta de la "n" y solo ignora las tildes y la
  diéresis de las vocales.
- El estado de la búsqueda (texto, categoría y orden) se conserva mientras la app está abierta
  y se vuelve a los valores iniciales al reiniciarla; no se recuerda entre sesiones.
- El listado no se pagina: el catálogo del TP es chico y se devuelve completo.
- El listado y el detalle son públicos en el servidor; en la app se llega a ellos con un
  usuario elegido, como al resto de las pestañas.
- Los eventos realizados no aparecen en Explorar, pero su detalle público sigue disponible
  (por ejemplo, para la 007 y la 011, que llevan a eventos ya realizados).
- Depende de la 001 (servidor, datos de ejemplo), la 003 (piezas base de pantalla, cuatro
  estados y acceso al servidor) y la 004 (catálogo de categorías, detalle público del evento y
  cupo disponible de los tipos). La 011 aporta las reseñas que alimentan el puntaje; la 006
  agrega la compra desde el detalle.
