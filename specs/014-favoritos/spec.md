# Feature Specification: Favoritos

**Feature Branch**: `feature/014-favoritos`

**Created**: 2026-11-22

**Status**: Draft

**Input**: User description: "Feature 014 — Favoritos (opcional, P4; depende de la 005). Qué quiero: que el usuario actual pueda marcar y desmarcar un evento como favorito y ver la lista de sus favoritos." (descripción completa —contexto de la consigna, punto de partida en el código, alcance por capa, seed, fuera de alcance y las cinco dudas para el clarify— en la invocación de `/speckit-specify`).

**Casos de uso**: ninguno propio. Sale del contexto de la consigna ("los compradores exploran el
catálogo, filtran por categoría, buscan por texto, **guardan favoritos** y compran entradas") y de
su modelo (`Usuario { nombre, apellido, favoritos: Evento[] }`; constitución, "Entidades":
"**Usuario**: nombre, apellido, eventos favoritos"). Se apoya en UC-03 (*buscar eventos*, 005).

## Alcance

**Incluye**: marcar y desmarcar un evento como favorito del usuario actual **solo desde el
detalle del evento**, tocando una estrella accesible que dice en qué estado está; que marcar uno
que ya es favorito o desmarcar uno que no lo es no sea un error; una **estrella indicadora** (solo
de lectura) en una esquina de cada evento favorito en las listas de eventos de la app (Explorar,
Mis compras, Mis eventos y Mis favoritos); la lista "Mis favoritos" del usuario actual, con los
mismos datos de cada evento que la tarjeta del catálogo (organizador y su puntaje incluidos) y sus
cuatro estados (cargando, error, vacío y con favoritos); que las estrellas reflejen los favoritos
del usuario actual sin que el catálogo deje de ser el mismo para todos; favoritos de ejemplo en
los datos de la demo.

**No incluye**: notificaciones (por ejemplo, "un favorito está por agotarse"); contadores públicos
("a N personas les gusta"); ordenar o filtrar el catálogo por favoritos; compartir la lista;
paginar la lista de favoritos (ver Assumptions); marcar o desmarcar desde una lista (la estrella
de las listas no se toca: solo indica); pulido estético (015).

Las cinco dudas de la descripción (evento propio y realizado, dónde vive "Mis favoritos", evento
eliminado, orden y paginación, cómo se sabe si un evento del catálogo es favorito) quedaron
resueltas en "Clarifications".

## Clarifications

### Session 2026-11-22

- Q: ¿Qué eventos se pueden marcar como favoritos y los realizados siguen en "Mis favoritos"? → A:
  Cualquier evento existente, también los propios y los realizados; los realizados quedan en la
  lista, después de los próximos y con la marca "Realizado".
- Q: ¿Dónde vive "Mis favoritos" en la app? → A: Dentro de Perfil: un botón "Mis favoritos" que
  abre una pantalla apilada (con header y "atrás"); la barra inferior no cambia. Se consideraron y
  descartaron una quinta pestaña (la primera respuesta, revisada después) y un filtro "Solo
  favoritos" en Explorar (el catálogo no muestra realizados, dejaría sin lugar a los favoritos
  realizados, y haría que el catálogo dependa del usuario).
- Q: ¿Qué pasa con un favorito cuando el organizador elimina ese evento? → A: Se limpia al
  eliminar: eliminar un evento lo saca de los favoritos de todos los usuarios que lo tenían.
- Q: ¿En qué orden se muestra "Mis favoritos" y se pagina? → A: Primero los próximos por fecha del
  evento ascendente, después los realizados por fecha descendente (como "Mis compras"), sin
  guardar cuándo se marcó y sin paginar.
- Q: ¿Cómo sabe la app si un evento del catálogo o del detalle es favorito del usuario actual? →
  A: Los favoritos son el arreglo de ids de eventos guardado en el usuario, y esa es la única
  fuente: la app consulta los favoritos del usuario actual (armados desde ese arreglo) y con eso
  decide el estado de cada estrella. El catálogo y el detalle no suman `esFavorito`: siguen públicos,
  iguales para todos y con su clave de consulta sin usuario.
- Q: (agregado por el usuario después de las cinco preguntas) ¿Desde dónde se marca un favorito y
  dónde se ve? → A: Se marca y desmarca **solo** entrando al detalle del evento y tocando la
  estrella. En cualquier pantalla donde aparezcan eventos (Explorar, Mis compras, Mis eventos, Mis
  favoritos) se ve una estrella en una esquina del evento si es favorito del usuario actual; esa
  estrella solo indica, no se toca. Reemplaza el botón de favorito en `TarjetaEvento` de la
  descripción original.

## User Scenarios & Testing *(mandatory)*

El actor es el **usuario actual** (el elegido en "Seleccionar usuario"). Cualquier usuario puede
tener favoritos: no depende de haber comprado ni de organizar (constitución, "Roles").

### User Story 1 - Marcar y desmarcar un favorito desde el detalle (Priority: P1)

Diego abre el detalle de "Festival de Rock" y ve una estrella vacía ("Agregar a favoritos"). La
toca: la estrella se llena ("Quitar de favoritos"). Sale, vuelve a entrar y sigue llena. La toca
otra vez y vuelve a quedar vacía.

**Why this priority**: es la acción que define la feature; sin ella no hay favoritos que listar.

**Independent Test**: con un usuario sin favoritos, abrir el detalle de un evento, tocar la
estrella y comprobar que queda llena al volver a entrar; tocarla de nuevo y comprobar que queda
vacía.

**Acceptance Scenarios**:

1. **Given** un evento que no es favorito del usuario actual, **When** toca la estrella del
   detalle, **Then** el evento queda en sus favoritos, la estrella se ve llena, su etiqueta dice
   "Quitar de favoritos" y se anuncia como seleccionada.
2. **Given** un evento favorito, **When** toca la estrella del detalle, **Then** deja de estar en
   sus favoritos, la estrella se ve vacía, su etiqueta dice "Agregar a favoritos" y se anuncia
   como no seleccionada.
3. **Given** un evento que ya es favorito, **When** se pide marcarlo otra vez (por ejemplo, desde
   otro teléfono con el mismo usuario), **Then** no es un error y sigue siendo favorito una sola
   vez.
4. **Given** un evento que no es favorito, **When** se pide desmarcarlo, **Then** no es un error y
   sigue sin serlo.
5. **Given** un evento favorito de Diego, **When** Lucía abre el mismo detalle, **Then** para ella
   la estrella está vacía: los favoritos son de cada usuario.
6. **Given** el servidor no disponible, **When** el usuario toca la estrella, **Then** la estrella
   vuelve a mostrar el estado real (no queda marcado como si hubiera funcionado) y se ve el aviso
   de conexión de siempre.

---

### User Story 2 - Ver "Mis favoritos" (Priority: P1)

Diego entra a Perfil, toca "Mis favoritos" y ve los eventos que marcó, cada uno con nombre, fecha, categoría,
organizador y puntaje como en Explorar. Toca uno y llega a su detalle. Si no tiene favoritos, ve
"Todavía no tenés favoritos" y un botón "Ir a Explorar".

**Why this priority**: guardar favoritos solo tiene valor si se pueden volver a encontrar; es la
otra mitad del MVP.

**Independent Test**: con el seed (Diego con favoritos de ejemplo), abrir "Mis favoritos" y
comprobar que aparecen sus eventos en el orden esperado; con un usuario sin favoritos, comprobar
el vacío y que "Ir a Explorar" lleva a Explorar.

**Acceptance Scenarios**:

1. **Given** un usuario con favoritos, **When** abre "Mis favoritos", **Then** ve cada favorito
   una vez, con los mismos datos que su tarjeta en Explorar (incluidos el organizador, su puntaje
   y la cantidad de reseñas) y la estrella indicadora en su esquina.
2. **Given** favoritos próximos y realizados, **When** abre la lista, **Then** primero ve los
   próximos (del más cercano al más lejano) y después los realizados (del más reciente al más
   antiguo), cada realizado con la marca "Realizado".
3. **Given** un usuario sin favoritos, **When** abre la lista, **Then** ve el vacío con "Ir a
   Explorar", que lo lleva a la pestaña Explorar.
4. **Given** la lista abierta, **When** toca un favorito, **Then** llega al detalle de ese evento.
5. **Given** el usuario desmarca un favorito desde su detalle y vuelve a la lista,
   **When** la lista se muestra, **Then** ese evento ya no está; y uno recién marcado, sí.
6. **Given** la lista pidiéndose, **When** el servidor tarda o falla, **Then** se ve el cargando o
   el error de siempre (con reintentar), nunca una lista vacía falsa.

---

### User Story 3 - Ver la estrella en las listas de eventos (Priority: P2)

En Explorar, Mis compras, Mis eventos y Mis favoritos, cada evento favorito del usuario actual
muestra una estrella en una esquina; los que no son favoritos no la muestran. Diego marca un
evento desde su detalle, vuelve a Explorar y ve la estrella en su tarjeta; en "Mis compras", la
fila de su compra de ese evento también la tiene.

**Why this priority**: deja ver de un vistazo qué eventos guardó en cualquier lista, pero el
detalle (US1) y la lista (US2) ya alcanzan para tener la funcionalidad completa.

**Independent Test**: marcar un evento desde su detalle y comprobar que la estrella aparece en su
tarjeta de Explorar, en la fila de una compra suya en "Mis compras", en "Mis eventos" si es propio
y en "Mis favoritos"; desmarcarlo y comprobar que desaparece de todas.

**Acceptance Scenarios**:

1. **Given** el catálogo en Explorar, **When** el usuario mira cada tarjeta, **Then** las de sus
   favoritos tienen la estrella en una esquina y las demás no.
2. **Given** compras de eventos favoritos y no favoritos, **When** el usuario abre "Mis compras",
   **Then** cada fila de una compra de un evento favorito tiene la estrella (todas las compras de
   ese evento) y las demás no.
3. **Given** un organizador con eventos propios marcados como favoritos, **When** abre "Mis
   eventos", **Then** esos eventos tienen la estrella.
4. **Given** una tarjeta o fila con la estrella, **When** el usuario la toca, **Then** pasa lo
   mismo que al tocar el resto de la tarjeta o fila (abrir el detalle o "Tu compra"): la estrella
   de una lista no cambia el favorito.
5. **Given** el lector de pantalla, **When** recorre una tarjeta o fila de un evento favorito,
   **Then** su etiqueta termina en ", en favoritos"; la estrella no es un elemento aparte.
6. **Given** dos usuarios que miran el mismo catálogo, **When** cada uno ve las tarjetas, **Then**
   los eventos, su orden y sus páginas son los mismos para los dos; solo cambia dónde está la
   estrella.
7. **Given** la consulta de favoritos todavía cargando o con error, **When** se muestra una lista
   de eventos, **Then** la lista se ve igual, sin estrellas, y sin tapar su contenido con un
   cargando o un error propio de los favoritos.

---

### User Story 4 - Favoritos de ejemplo para la demo (Priority: P3)

Al arrancar el servidor, algunos usuarios ya tienen favoritos: Diego, dos eventos próximos y uno
realizado; así la lista, la marca "Realizado" y las estrellas se ven sin preparar nada.

**Why this priority**: solo facilita la demo; la funcionalidad no depende de esto.

**Independent Test**: arrancar el servidor, elegir a Diego y comprobar su lista y la estrella en
esos eventos; elegir a otro usuario sin favoritos y comprobar el vacío.

**Acceptance Scenarios**:

1. **Given** el servidor recién arrancado, **When** Diego abre "Mis favoritos", **Then** ve dos
   eventos próximos y uno realizado, en el orden de US2.
2. **Given** el servidor recién arrancado, **When** un usuario sin favoritos de ejemplo abre la
   lista, **Then** ve el vacío (al menos un usuario queda sin favoritos para mostrarlo).
3. **Given** el servidor reiniciado, **When** se consulta, **Then** los favoritos vuelven a los de
   ejemplo (como el resto de los datos en memoria).

---

### Edge Cases

- Marcar o desmarcar un evento que no existe (id inventado o un evento recién eliminado): "no
  encontrado", y los favoritos no cambian.
- Un evento favorito que su organizador elimina (solo se puede eliminar sin compras, 004): al
  eliminarlo, sale de los favoritos de todos los usuarios que lo tenían, y deja de aparecer en sus
  listas. Si la eliminación falla (por ejemplo, porque el evento tiene compras), ningún favorito
  cambia.
- Un usuario que marca un evento justo mientras su organizador lo elimina: puede quedar guardado
  el id de un evento que ya no existe. La lista lo omite sin fallar (FR-010), ninguna estrella lo
  muestra y no vuelve a aparecer, porque los ids de eventos nuevos no se reusan. Desmarcarlo
  responde "no encontrado", como cualquier evento inexistente (FR-004).
- El propio evento: el organizador puede marcarlo como favorito desde su detalle público como
  cualquier otro, y ve la estrella indicadora en su tarjeta de Explorar y en "Mis eventos". El hub
  del evento propio (al que lleva "Mis eventos") no tiene la estrella para marcar: se marca desde
  el detalle del evento.
- Un evento realizado: se puede marcar y desmarcar desde su detalle (al que se llega, por ejemplo,
  desde "Mis compras" o desde la misma lista) y sigue en la lista con "Realizado".
  En Explorar no aparece, porque el catálogo no muestra realizados (005).
- Un favorito próximo que pasa a realizado mientras está en la lista: al volver a pedirla, se
  mueve al grupo de realizados con su marca.
- Tocar la estrella del detalle dos veces seguidas rápido: el resultado final es el que el usuario
  ve en la estrella; nunca queda un estado distinto del que muestra, ni se envían pedidos de más que dejen
  el favorito al revés.
- Sin usuario actual (pedido directo a la API sin identificar): marcar, desmarcar y listar se
  rechazan como "usuario no identificado". El catálogo y el detalle siguen siendo públicos.
- Muchos favoritos: la lista entera llega de una vez (sin páginas); no hay límite de cantidad.
- El catálogo y el detalle de un evento no cambian por marcar o desmarcar: no se tocan el evento,
  sus tipos de entrada ni el cupo.

## Requirements *(mandatory)*

### Functional Requirements

**Marcar y desmarcar**

- **FR-001**: El usuario actual DEBE poder marcar cualquier evento existente como favorito,
  incluidos los propios y los realizados, sin ningún rechazo por regla de negocio (no hay 409).
- **FR-002**: El usuario actual DEBE poder desmarcar un evento de sus favoritos.
- **FR-003**: Marcar un evento que ya es favorito y desmarcar uno que no lo es DEBEN terminar bien,
  sin error y sin duplicados: el resultado es el mismo que tras una sola vez.
- **FR-004**: Marcar o desmarcar un evento que no existe DEBE responder "evento no encontrado" sin
  cambiar los favoritos.
- **FR-005**: Marcar, desmarcar y listar favoritos DEBEN exigir un usuario identificado; sin él, se
  rechazan como "usuario no identificado", antes de cualquier otro chequeo (orden de la
  constitución: no identificado → dato inválido → no encontrado).
- **FR-006**: Los favoritos DEBEN ser de cada usuario: lo que marca uno no cambia lo que ve otro.
- **FR-007**: Marcar o desmarcar NO DEBE modificar el evento, sus tipos de entrada, su cupo ni sus
  compras; por eso no compite con las compras del mismo evento (no espera su turno con ellas).

**Lista "Mis favoritos"**

- **FR-008**: El sistema DEBE devolver los favoritos del usuario actual como eventos con los
  mismos datos que una tarjeta del catálogo, incluidos el organizador, su puntaje (sin redondear,
  o ninguno si no tiene reseñas) y la cantidad de reseñas, calculados igual que en el catálogo.
- **FR-009**: La lista DEBE ordenar primero los eventos no realizados por fecha ascendente y
  después los realizados por fecha descendente, con un desempate estable (el mismo criterio que
  "Mis compras", 007, y los desempates del catálogo: nombre → id), e indicar cuáles están
  realizados.
- **FR-010**: Eliminar un evento (004) DEBE quitarlo de los favoritos de todos los usuarios que lo
  tenían, solo si la eliminación se concreta. Como red de seguridad, si la lista encontrara un
  favorito cuyo evento ya no existe, NO DEBE mostrarlo ni fallar.
- **FR-011**: Armar la lista DEBE pedir los eventos, sus categorías, sus organizadores y los
  puntajes en lote, con una cantidad de lecturas que no crece con la cantidad de favoritos.
- **FR-012**: La lista NO se pagina: llega entera, como "Mis compras", sin paginador.

**El catálogo y el detalle**

- **FR-013**: El catálogo y el detalle de un evento DEBEN seguir siendo públicos y el catálogo,
  idéntico para todos los usuarios (mismos eventos, orden y páginas); saber si un evento es
  favorito del usuario actual NO DEBE hacer que el catálogo dependa del usuario: las vistas del
  evento no suman ningún dato de favoritos, y la app cruza lo que muestra con los favoritos del
  usuario actual, cuya única fuente es el arreglo de ids de eventos guardado en el usuario.

**App**

- **FR-014**: El detalle de un evento DEBE tener una **estrella** tocable que funcione como
  interruptor y sea el **único** lugar de la app donde se marca o desmarca un favorito: vacía con
  la etiqueta "Agregar a favoritos" cuando no lo es y llena con "Quitar de favoritos" cuando sí,
  anunciada al lector de pantalla con su estado de seleccionado, y distinguible también sin color
  (llena o vacía por forma, no solo por color).
- **FR-015**: Toda lista de la app que muestre eventos para el usuario actual —las tarjetas de
  Explorar, las filas de "Mis compras" (por el evento de cada compra), las de "Mis eventos" y las
  de "Mis favoritos"— DEBE mostrar una **estrella indicadora** en una esquina de cada evento que
  sea favorito del usuario actual, y ninguna en los demás. La estrella indicadora NO es tocable
  por separado (tocarla es tocar la tarjeta o fila) y NO es un elemento accesible aparte: la
  etiqueta de la tarjeta o fila suma ", en favoritos". No se agrega a listas de un solo evento
  (Compras del evento, Registrar ingreso, "Ver mis entradas").
- **FR-016**: Mientras un cambio de favorito está en curso, un segundo toque sobre la estrella del
  detalle NO DEBE enviar otro pedido; la estrella muestra que está en curso.
- **FR-017**: El cambio de favorito NO DEBE reintentarse solo; ante un error, la estrella del
  detalle vuelve a mostrar el estado real y el error se informa como los demás de la app.
- **FR-018**: Tras marcar o desmarcar, la estrella del detalle, las estrellas indicadoras de las
  listas y "Mis favoritos" DEBEN reflejar el cambio sin que el usuario tenga que refrescar a mano,
  y sin volver a pedir el catálogo, el detalle, "Mis compras" ni "Mis eventos" (que no cambian).
- **FR-018b**: Si los favoritos del usuario todavía cargan o no se pudieron pedir, las listas de
  eventos DEBEN mostrarse igual, sin estrellas indicadoras y sin un cargando o un error propio de
  los favoritos que tape su contenido; en el detalle, la estrella no se muestra (o se muestra
  deshabilitada) hasta conocer el estado real.
- **FR-019**: "Mis favoritos" DEBE mostrar los cuatro estados (cargando, error con reintentar,
  vacío "Todavía no tenés favoritos" con "Ir a Explorar", y la lista), y cada favorito DEBE abrir
  el detalle del evento.
- **FR-020**: "Mis favoritos" DEBE ser una pantalla apilada (con header "Mis favoritos" y
  "atrás") a la que se llega desde un botón "Mis favoritos" en Perfil, y volver a pedirse cada vez
  que vuelve a quedar en primer plano (por ejemplo, al volver del detalle de un evento). La barra
  inferior no cambia (Explorar · Mis compras · Mis eventos · Perfil) y Explorar no suma ningún
  filtro por favoritos. "Ir a Explorar", en el vacío, lleva a la pestaña Explorar.
- **FR-021**: La pantalla y las estrellas DEBEN seguir el sistema visual de la app ("Pop Brutal")
  y las reglas de organización de la app (sin ciclos entre features: la feature de eventos no
  depende de otras, y la estrella indicadora llega a las listas de `eventos` y `compras` sin que
  `eventos` importe a otra feature).

**Contrato y datos**

- **FR-022**: Los nuevos pedidos y la lista DEBEN documentarse en el contrato de la feature y en
  la documentación de la API servida por el backend.
- **FR-023**: Los datos de ejemplo DEBEN incluir favoritos: Diego con dos eventos próximos y uno
  realizado, al menos otro usuario con algún favorito y al menos uno sin favoritos.

### Key Entities

- **Usuario**: ya existe; suma el comportamiento de marcar y desmarcar un favorito. Sus favoritos
  son un conjunto de ids de eventos sin repetir y se guardan con el usuario (el agregado
  `Usuario`), no con el evento.
- **Favorito**: no es una entidad aparte; es la pertenencia de un evento al conjunto de favoritos
  de un usuario. No guarda fecha de marcado (el orden de FR-009 sale de la fecha del evento).
- **Lista de favoritos** (vista): los eventos favoritos del usuario actual con los datos de la
  tarjeta del catálogo y la marca de realizado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario marca un evento como favorito desde su detalle con un solo toque en la
  estrella, y lo encuentra en "Mis favoritos" en menos de 10 segundos desde que lo marcó.
- **SC-002**: En el 100 % de los casos, la estrella del detalle y las estrellas indicadoras de
  Explorar, Mis compras y Mis eventos coinciden con lo que muestra "Mis favoritos" para el mismo
  usuario después de cada cambio.
- **SC-003**: Repetir una misma acción (marcar dos veces, desmarcar dos veces) nunca produce un
  error visible ni un favorito duplicado.
- **SC-004**: Dos usuarios distintos ven exactamente el mismo catálogo (eventos, orden y páginas);
  solo difiere dónde aparece la estrella.
- **SC-005**: Con el lector de pantalla, un usuario sabe si un evento es favorito en cualquier
  lista de eventos, y lo cambia desde el detalle, sin ver la pantalla.
- **SC-006**: El organizador, el puntaje y la cantidad de reseñas de un evento son iguales en su
  tarjeta del catálogo y en "Mis favoritos".
- **SC-007**: Con los datos de ejemplo recién cargados, la lista de Diego muestra sus tres
  favoritos (dos próximos y uno realizado) sin preparar nada.

## Assumptions

- **Respuestas a las dudas de la descripción** (resueltas en `/speckit-clarify`, ver
  "Clarifications"):
  1. *(Confirmada en Clarifications.)* Se puede marcar un evento propio y uno realizado; los
     realizados siguen en la lista, después de los próximos y con la marca "Realizado".
  2. *(Cambiada en Clarifications.)* "Mis favoritos" es una pantalla apilada a la que se llega
     desde Perfil; la barra inferior no cambia.
  3. *(Cambiada en Clarifications.)* Eliminar un evento lo saca de los favoritos de todos los
     usuarios. La eliminación del evento (004) pasa a modificar también usuarios, otro agregado:
     el plan decide cómo, respetando que cada agregado lo escribe su service dueño.
  4. *(Confirmada en Clarifications.)* Orden como "Mis compras" (próximos por fecha ascendente, realizados por fecha descendente),
     sin guardar cuándo se marcó y sin paginar.
  5. *(Confirmada en Clarifications.)* Los favoritos son el arreglo de ids guardado en el usuario;
     el catálogo y el detalle no cambian y la app cruza lo que muestra con los favoritos del
     usuario actual, así el catálogo sigue público e igual para todos.
- Marcar, desmarcar y listar exigen usuario; el catálogo y el detalle siguen públicos (005).
- No hay límite de cantidad de favoritos; con los volúmenes de la demo, la lista entera es chica.
- Los favoritos viven en memoria, como el resto de los datos: reiniciar el servidor vuelve a los de
  ejemplo (constitución, "Persistencia en Memoria").
- Las estrellas no se muestran sin usuario actual porque la app no deja ver Explorar ni el detalle
  sin elegir uno (002/003).
- Las listas que muestran la estrella indicadora (Explorar, Mis compras, Mis eventos, Mis
  favoritos) necesitan los favoritos del usuario actual además de sus propios datos; con los
  volúmenes de la demo es una consulta chica por usuario, compartida entre esas pantallas.
- Depende de 005 (catálogo, tarjeta, detalle público, organizador y puntaje) y usa la paginación
  del catálogo de la 013 tal como está; no cambia la búsqueda, el filtro, el orden ni las páginas.
