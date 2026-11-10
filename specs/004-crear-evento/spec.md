# Feature Specification: Crear evento

**Feature Branch**: `feature/004-crear-evento`

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "Feature 004 — Crear evento (UC-04). Un organizador (el usuario actual) gestiona sus eventos desde la pestaña Mis eventos, que hoy muestra la sección pendiente. Mis eventos: lista los eventos que organiza el usuario actual con nombre, fecha y hora, categoría y cantidad de tipos de entrada [default: primero los próximos por fecha ascendente, y después los ya realizados, marcados como tales]. Tiene los cuatro estados y una acción para crear un evento. Crear evento: nombre (obligatorio), descripción [default: opcional], categoría (obligatoria, del catálogo precargado), fecha y hora elegidas con un selector (sin escribirlas a mano), interpretadas en hora de Buenos Aires y siempre futuras, y multimedia como cero o más URLs http(s) [default: hasta 5]. Lleva uno o más tipos de entrada, cada uno con nombre (único dentro del evento, sin distinguir mayúsculas ni tildes), descripción opcional, precio en pesos enteros ≥ 0 (se permiten entradas gratis) y cupo entero ≥ 1. Al crearlo, el evento aparece en Mis eventos. Editar evento: mientras el evento no se haya realizado, el organizador puede editar todos sus campos, incluida la fecha (siempre futura), y agregar, editar o quitar tipos de entrada de a uno. El cupo que se edita es el disponible (entero ≥ 0). Un cambio de precio no afecta las compras existentes, porque su total quedó fijo al comprar. Un tipo de entrada con compras no se puede quitar, y el evento siempre conserva al menos un tipo. Eliminar evento: solo si no se realizó y no tiene compras, con confirmación previa. Compras: la feature incluye lo mínimo de Compra para saber si un evento o un tipo de entrada tiene compras, y así aplicar esas reglas. Crear compras sigue siendo de la 006. Reglas de acceso y errores: solo el organizador de un evento lo edita o elimina; los demás reciben 'sin permiso'. Un evento inexistente da 'no encontrado'. Una operación que viola una regla (evento realizado, tipo o evento con compras, último tipo, nombre de tipo repetido) se rechaza con un mensaje claro. El servidor valida toda la entrada, aunque la app ya lo haga. Fuera de alcance: detalle público del evento, búsqueda, filtros y orden (005); crear, pagar o cancelar compras (006 y 009); subir imágenes; favoritos."

**Casos de uso**: UC-04 — *Como organizador, quiero crear un Evento con distintos tipos de
entrada, cada uno con precio y cupo.*

## Alcance

**Incluye**: la pestaña **Mis eventos** (listado de los eventos que organiza el usuario
actual); **crear** un evento con sus tipos de entrada; **editar** un evento no realizado y
**agregar, editar o quitar** sus tipos de entrada de a uno; **eliminar** un evento no realizado
y sin compras; el **catálogo de categorías** para elegir la del evento; lo mínimo de **Compra**
para saber si un evento o un tipo de entrada tiene compras; las reglas de acceso y los mensajes
de error de todas esas operaciones, validadas también por el servidor.

**No incluye**: el detalle público de un evento, la búsqueda, los filtros y el orden del
catálogo (005); crear, pagar, cancelar o listar compras (006, 007, 009); ver las compras de un
evento (008); subir imágenes (la multimedia son URLs); favoritos (012); pulido estético (013).

## Clarifications

### Session 2026-11-10

- Q: ¿Una compra cancelada o reembolsada cuenta como "compra" para impedir quitar un tipo de entrada o eliminar el evento? → A: Sí: toda compra cuenta, en cualquier estado (conserva historial y chat que dependen del evento y del tipo).
- Q: ¿Los datos de ejemplo traen compras para demostrar las reglas de "tiene compras" antes de la 006? → A: Sí: 1 o 2 compras fijas (ids legibles) sobre un evento próximo y un tipo de entrada de un organizador de ejemplo, sin endpoints ni pantallas de compras.
- Q: ¿Al salir de crear o editar un evento con cambios sin guardar, la app pide confirmación? → A: Sí, siempre que se sale del formulario sin guardar, haya cambios o no: diálogo "¿Descartar los cambios?" con Descartar / Seguir editando.
- Q: ¿En Mis eventos, un evento ya realizado se puede abrir para ver sus datos, o su fila no se puede tocar? → A: Se abre en una vista de solo lectura con todos sus datos y tipos de entrada, sin acciones.
- Q: ¿Qué prioridad tiene que dos operaciones simultáneas sobre un mismo evento no se pisen (por ejemplo, eliminarlo mientras entra una compra, o dos tipos con el mismo nombre agregados a la vez)? → A: Es prioritaria: ninguna operación que verifica una regla y después modifica un evento, sus tipos de entrada o sus compras puede intercalarse con otra sobre el mismo evento; ante dos pedidos simultáneos, uno se completa y el otro se evalúa sobre el resultado del primero (FR-029).
- Q: ¿Qué reloj y qué zona horaria deciden si una fecha es futura o si un evento ya se realizó? → A: Siempre el reloj del servidor, en hora de Buenos Aires. La app no usa el reloj ni la zona horaria del teléfono para decidirlo: muestra lo que informa el servidor y el servidor es quien acepta o rechaza (FR-010, FR-010a).

## User Scenarios & Testing *(mandatory)*

El actor es el **organizador**: el usuario actual de la app, en su relación con los eventos que
organiza (constitución, "Roles"). Cualquier usuario puede crear eventos y pasa a ser su
organizador.

### User Story 1 - Crear un evento con sus tipos de entrada (Priority: P1)

Desde Mis eventos, el organizador elige crear un evento. Completa el nombre, opcionalmente una
descripción, elige una categoría del catálogo, elige la fecha y la hora con un selector y, si
quiere, agrega hasta cinco URLs de imágenes. Agrega uno o más tipos de entrada (por ejemplo,
"General" a $ 15.000 con 200 lugares y "VIP" a $ 60.000 con 30), cada uno con nombre,
descripción opcional, precio y cupo. Al guardar, el evento queda publicado con él como
organizador y aparece en Mis eventos.

**Why this priority**: es exactamente UC-04 y el origen de los datos que usan las features
siguientes (explorar, comprar, compras de un evento). Sin crear, no hay nada que listar, editar
ni eliminar.

**Independent Test**: con un usuario elegido, crear un evento con dos tipos de entrada desde la
app y verlo en Mis eventos; por el lado del servidor, crear un evento válido y verificar que se
guarda con el usuario actual como organizador, y que cada dato inválido se rechaza con su
detalle por campo.

**Acceptance Scenarios**:

1. **Given** el organizador en el formulario de crear evento con nombre, categoría, una fecha y
   hora futuras y un tipo de entrada válido, **When** guarda, **Then** el evento se crea con él
   como organizador, la app vuelve a Mis eventos y el evento aparece en la lista.
2. **Given** el formulario sin nombre, sin categoría, sin fecha o sin ningún tipo de entrada,
   **When** el organizador intenta guardar, **Then** no se crea nada y cada campo faltante
   muestra qué le falta.
3. **Given** una fecha y hora elegidas que ya pasaron (o que pasan mientras completa el
   formulario), **When** guarda, **Then** se rechaza indicando que la fecha debe ser futura.
4. **Given** dos tipos de entrada llamados "VIP" y " vip " (o "Platea" y "Plátea"), **When** guarda, **Then** se rechaza indicando que el nombre del tipo
   está repetido.
5. **Given** un tipo de entrada con precio 0, **When** guarda, **Then** se acepta (entrada
   gratis) y se muestra como "Gratis".
6. **Given** un tipo con precio negativo o con decimales, o con cupo 0, negativo o con
   decimales, **When** guarda, **Then** se rechaza indicando el campo y la regla.
7. **Given** una URL de multimedia que no empieza con `http://` o `https://`, o más de cinco
   URLs, **When** guarda, **Then** se rechaza indicando cuál es la inválida o que se superó el
   máximo.
8. **Given** el organizador eligiendo la fecha y la hora, **When** usa el selector, **Then** la
   fecha y la hora que ve y elige son las de Buenos Aires, cualquiera sea la zona horaria del
   teléfono, y no puede escribirlas a mano.
9. **Given** un teléfono con el reloj adelantado, atrasado o en otra zona horaria, **When** el
   organizador guarda una fecha, **Then** si es futura o no lo decide el reloj del servidor, y
   el evento queda en el mismo instante que si se hubiera cargado desde un teléfono en hora.
10. **Given** un pedido de creación que llega al servidor con datos inválidos sin pasar por la
    app, **When** el servidor lo recibe, **Then** lo rechaza como entrada inválida con un
    detalle por campo, igual que si la app no lo hubiera validado.

---

### User Story 2 - Ver mis eventos (Priority: P1)

En la pestaña Mis eventos, el organizador ve los eventos que organiza: nombre, fecha y hora (de
Buenos Aires), categoría y cuántos tipos de entrada tiene. Primero aparecen los próximos, del
más cercano al más lejano, y después los ya realizados, marcados como tales. Desde ahí puede
crear un evento nuevo y entrar a uno para editarlo.

**Why this priority**: es la puerta de entrada a todo lo demás de la feature y donde el
organizador confirma que su evento se creó. Va junto con US1 en el MVP.

**Independent Test**: con los datos de ejemplo, elegir a Lucía y ver sus eventos (sin los de
otros organizadores), en el orden indicado; elegir un usuario sin eventos y ver el estado
vacío con la acción de crear.

**Acceptance Scenarios**:

1. **Given** un usuario que organiza eventos próximos y realizados, **When** abre Mis eventos,
   **Then** ve solo sus eventos: primero los próximos por fecha ascendente y después los
   realizados, cada uno con su marca "Realizado".
2. **Given** cada evento de la lista, **When** se muestra, **Then** se ven su nombre, su fecha
   y hora en hora de Buenos Aires, el nombre de su categoría y la cantidad de tipos de entrada
   ("1 tipo de entrada", "3 tipos de entrada").
3. **Given** un usuario que no organiza ningún evento, **When** abre Mis eventos, **Then** ve
   un estado vacío que lo invita a crear su primer evento, con la acción de crear.
4. **Given** la lista cargando, con error o con datos, **When** se muestra, **Then** usa los
   cuatro estados de la app (cargando, error con "Reintentar", vacío y éxito) y la acción de
   crear un evento está disponible cuando la lista cargó.
5. **Given** que el usuario actual cambia (desde Perfil), **When** vuelve a Mis eventos,
   **Then** ve los eventos del nuevo usuario, nunca los del anterior.

---

### User Story 3 - Editar un evento y sus tipos de entrada (Priority: P2)

Mientras el evento no se realizó, el organizador entra a él desde Mis eventos y puede cambiar
cualquiera de sus datos (nombre, descripción, categoría, fecha y hora, multimedia). Además,
administra los tipos de entrada de a uno: agrega uno nuevo, edita uno existente (nombre,
descripción, precio y cupo disponible) o quita uno que no tenga compras, siempre dejando al
menos uno. Los cambios se ven en Mis eventos.

**Why this priority**: corrige errores de carga y ajusta precios y cupos, pero un evento recién
creado ya es útil sin editarlo.

**Independent Test**: editar el nombre y la fecha de un evento propio y verlos en Mis eventos;
agregar, editar y quitar un tipo de entrada; comprobar por el lado del servidor cada regla
(evento realizado, tipo con compras, último tipo, nombre repetido, sin permiso, no encontrado).

**Acceptance Scenarios**:

1. **Given** un evento propio no realizado, **When** el organizador cambia sus datos y guarda,
   **Then** se guardan y Mis eventos los muestra actualizados (incluida su nueva posición si
   cambió la fecha).
2. **Given** la edición de la fecha, **When** el organizador elige una fecha y hora que ya
   pasaron, **Then** se rechaza indicando que debe ser futura.
3. **Given** un evento propio ya realizado, **When** el organizador lo abre, **Then** ve sus
   datos sin opciones de editar ni eliminar; y si el servidor recibe igualmente un cambio sobre
   ese evento o sus tipos, lo rechaza indicando que el evento ya se realizó.
4. **Given** un evento propio no realizado, **When** el organizador agrega un tipo de entrada
   válido con un nombre que no se repite, **Then** el tipo queda en el evento con su cupo
   inicial.
5. **Given** un tipo de entrada existente, **When** el organizador cambia su nombre a uno que ya
   usa otro tipo del mismo evento (sin distinguir mayúsculas ni tildes), **Then** se rechaza
   indicando que el nombre está repetido; conservar el mismo nombre del propio tipo se acepta.
6. **Given** un tipo de entrada existente, **When** el organizador edita su cupo, **Then** lo
   que edita es el cupo **disponible**: acepta cualquier entero ≥ 0 (0 deja el tipo agotado) y
   rechaza negativos y decimales.
7. **Given** un tipo de entrada con compras, **When** el organizador cambia su precio, **Then**
   se acepta y las compras existentes conservan el total con el que se hicieron.
8. **Given** un tipo de entrada con compras, **When** el organizador intenta quitarlo, **Then**
   se rechaza indicando que el tipo tiene compras.
9. **Given** un evento con un solo tipo de entrada, **When** el organizador intenta quitarlo,
   **Then** se rechaza indicando que el evento debe conservar al menos un tipo.
10. **Given** un evento de otro organizador, **When** el usuario actual intenta editarlo o
    administrar sus tipos (por ejemplo, con un pedido directo al servidor), **Then** se rechaza
    como "sin permiso" y nada cambia.
11. **Given** un evento o un tipo de entrada que no existe (por ejemplo, porque se eliminó en
    otro dispositivo), **When** se intenta editarlo, **Then** se responde "no encontrado" y la
    app lo informa y vuelve a Mis eventos actualizado.

---

### User Story 4 - Eliminar un evento (Priority: P3)

El organizador elimina un evento propio que no se realizó y que no tiene compras (por ejemplo,
uno que creó por error). La app le pide confirmación antes de eliminarlo; al confirmar, el
evento desaparece de Mis eventos.

**Why this priority**: es una operación de corrección poco frecuente; las demás historias no la
necesitan.

**Independent Test**: crear un evento, eliminarlo confirmando y verificar que no aparece en Mis
eventos; cancelar la confirmación y verificar que sigue; comprobar por el lado del servidor el
rechazo de un evento realizado, con compras, ajeno o inexistente.

**Acceptance Scenarios**:

1. **Given** un evento propio no realizado y sin compras, **When** el organizador elige
   eliminarlo, **Then** la app le pide confirmación nombrando el evento.
2. **Given** la confirmación abierta, **When** la cancela, **Then** no se elimina nada.
3. **Given** la confirmación abierta, **When** confirma, **Then** el evento se elimina y
   desaparece de Mis eventos.
4. **Given** un evento propio con compras, **When** el organizador intenta eliminarlo, **Then**
   se rechaza indicando que el evento tiene compras.
5. **Given** un evento propio realizado, **When** se intenta eliminarlo, **Then** se rechaza
   indicando que el evento ya se realizó.
6. **Given** un evento de otro organizador o inexistente, **When** se intenta eliminarlo,
   **Then** se responde "sin permiso" o "no encontrado", respectivamente, y nada cambia.

---

### Edge Cases

- **Momento de "realizado"**: un evento se considera realizado desde su fecha y hora de inicio
  (inclusive), según el reloj del servidor. Un evento que pasa a realizado mientras el organizador lo está editando se
  rechaza al guardar con el mensaje de evento realizado, aunque la app lo haya mostrado como
  editable.
- **Fecha futura al guardar**: la regla "siempre futura" se evalúa en el servidor, con su reloj,
  al momento de guardar, no al elegir la fecha; un formulario abierto mucho tiempo puede quedar
  con una fecha ya pasada.
- **Reloj del teléfono desfasado**: un teléfono con la hora mal configurada no cambia qué fechas
  se aceptan ni qué eventos aparecen como realizados: lo decide siempre el servidor.
- **Hora de Buenos Aires**: la misma fecha y hora elegida representa el mismo instante en
  cualquier teléfono; un teléfono configurado en otra zona horaria no corre la hora del evento.
  Buenos Aires no tiene horario de verano vigente, así que no hay horas ambiguas ni inexistentes.
- **Nombres de tipo "iguales"**: la comparación ignora mayúsculas, tildes y espacios al
  principio y al final ("Platea", " PLATEA " y "Plátea" son el mismo nombre). Los espacios del
  principio y del final se descartan también al guardar.
- **Textos solo con espacios**: un nombre de evento o de tipo que solo tiene espacios cuenta
  como vacío.
- **Categoría inexistente**: un pedido con una categoría que no está en el catálogo se rechaza
  como entrada inválida, con el detalle en el campo categoría.
- **Cupo editado con compras**: bajar el cupo disponible de un tipo con compras no afecta esas
  compras (sus entradas ya se descontaron); dejarlo en 0 lo deja agotado para compras nuevas.
- **Doble envío**: mientras se guarda o elimina, la acción queda deshabilitada; la app no
  repite sola un guardado que no llegó a confirmarse (una escritura sin respuesta del servidor
  puede haberse procesado) y muestra el error para que el organizador decida.
- **Servidor no disponible**: la lista y los formularios muestran el mismo estado de servidor
  no disponible que el resto de la app; lo cargado en un formulario no se pierde por un error
  al guardar.
- **Usuario cambiado**: si el usuario actual cambia con un formulario abierto, el formulario no
  se envía en nombre del usuario nuevo; la app vuelve a Mis eventos del usuario nuevo (esa
  salida la provoca el cambio de usuario y no pide confirmación de descarte).
- **Salir del formulario**: tanto el botón "atrás" de la pantalla como el gesto o botón atrás
  del sistema piden la confirmación de FR-026a.
- **Operaciones simultáneas sobre un mismo evento** (FR-029): verificar que el evento (o el
  tipo) no tiene compras y eliminarlo ocurre de una sola vez, sin que una compra pueda
  intercalarse entre la verificación y la eliminación (constitución, "Cupo atómico"). Lo mismo
  vale para dos tipos agregados o renombrados a la vez con el mismo nombre (uno se acepta y el
  otro se rechaza como repetido), para quitar a la vez los dos tipos de un evento que tiene dos
  (uno se acepta y el otro se rechaza como último tipo) y para editar un evento justo cuando
  pasa a realizado.
- **Eventos del seed**: los eventos de ejemplo se gestionan igual que los creados; los ya
  realizados del seed (por ejemplo, de Sofía y Martín) aparecen como realizados y no se pueden
  editar ni eliminar.

## Requirements *(mandatory)*

### Functional Requirements

**Catálogo de categorías**

- **FR-001**: El sistema DEBE exponer el catálogo precargado de categorías (nombre y
  descripción) para elegir la del evento. El catálogo es de solo lectura en esta feature.

**Mis eventos (US2)**

- **FR-002**: El sistema DEBE listar los eventos que organiza el usuario actual, y solo esos.
- **FR-003**: Cada evento del listado DEBE mostrar nombre, fecha y hora en hora de Buenos
  Aires, nombre de la categoría y cantidad de tipos de entrada, y una marca "Realizado" si ya
  se realizó.
- **FR-004**: El listado DEBE ordenar primero los eventos próximos por fecha y hora ascendente
  y después los realizados (del más reciente al más antiguo).
- **FR-005**: La pantalla DEBE manejar los cuatro estados (cargando, error, vacío y éxito); el
  estado vacío DEBE invitar a crear el primer evento.
- **FR-006**: La pantalla DEBE ofrecer una acción para crear un evento y permitir entrar a cada
  evento propio para editarlo (si no se realizó) o verlo (si se realizó).
- **FR-006a**: Un evento realizado DEBE abrirse en una vista de solo lectura con todos sus
  datos (nombre, descripción, categoría, fecha y hora, multimedia) y sus tipos de entrada
  (nombre, descripción, precio y cupo disponible), sin acciones de editar, agregar, quitar ni
  eliminar. Esa vista no pide confirmación al salir (no es un formulario).

**Crear evento (US1)**

- **FR-007**: El organizador DEBE poder crear un evento con: nombre (obligatorio), descripción
  (opcional), categoría del catálogo (obligatoria), fecha y hora (obligatoria, futura),
  multimedia (de 0 a 5 URLs `http` o `https`) y uno o más tipos de entrada.
- **FR-008**: Cada tipo de entrada DEBE tener nombre (obligatorio, único dentro del evento sin
  distinguir mayúsculas, tildes ni espacios al principio y al final), descripción (opcional),
  precio en pesos enteros ≥ 0 y cupo inicial entero ≥ 1.
- **FR-009**: El evento creado DEBE tener como organizador al usuario actual; el pedido no
  puede elegir otro organizador.
- **FR-010**: La fecha y la hora DEBEN elegirse con un selector (sin escribirlas a mano) e
  interpretarse en hora de Buenos Aires, independientemente de la zona horaria del teléfono.
- **FR-010a**: El reloj de referencia DEBE ser siempre el del servidor, en hora de Buenos Aires:
  el servidor decide si una fecha es futura y si un evento ya se realizó, e informa a la app si
  cada evento está realizado. La app NO DEBE usar el reloj ni la zona horaria del teléfono para
  decidir si un evento es editable o si una fecha es válida.
- **FR-011**: Al crearse, el evento DEBE aparecer en Mis eventos sin que el organizador tenga
  que recargar la lista.

**Editar evento (US3)**

- **FR-012**: Mientras el evento no se realizó, su organizador DEBE poder cambiar nombre,
  descripción, categoría, fecha y hora (siempre futura) y multimedia, con las mismas reglas que
  al crearlo.
- **FR-013**: Mientras el evento no se realizó, su organizador DEBE poder, de a un tipo por
  vez: agregar un tipo de entrada (con las reglas de FR-008), editar nombre, descripción,
  precio y cupo de uno existente, y quitar uno.
- **FR-014**: El cupo que se edita en un tipo existente DEBE ser el cupo **disponible**, un
  entero ≥ 0.
- **FR-015**: Cambiar el precio de un tipo de entrada NO DEBE modificar el total de ninguna
  compra existente.
- **FR-016**: El sistema DEBE rechazar quitar un tipo de entrada que tenga compras, y quitar el
  único tipo de entrada de un evento.
- **FR-017**: El sistema DEBE rechazar todo cambio sobre un evento realizado o sobre sus tipos
  de entrada. En la app, un evento realizado se abre en la vista de solo lectura de FR-006a.
- **FR-018**: Los cambios guardados DEBEN verse en Mis eventos sin recargar la lista a mano.

**Eliminar evento (US4)**

- **FR-019**: El organizador DEBE poder eliminar un evento propio que no se realizó y que no
  tiene compras, después de confirmar en un diálogo que nombra el evento.
- **FR-020**: El sistema DEBE rechazar eliminar un evento realizado o con compras.

**Compras (lo mínimo para estas reglas)**

- **FR-021**: El sistema DEBE poder saber si un evento tiene compras y si un tipo de entrada
  tiene compras. Toda compra cuenta, en cualquier estado (`PENDIENTE`, `CONFIRMADA`,
  `UTILIZADA`, `CANCELADA` o `REEMBOLSADA`). Esta feature no crea, lista ni
  modifica compras (eso es de 006 en adelante).
- **FR-021a**: Los datos de ejemplo DEBEN incluir 1 o 2 compras fijas, con ids legibles, sobre
  un evento próximo y uno de sus tipos de entrada de un organizador de ejemplo, para que las
  reglas de "tiene compras" se puedan demostrar desde la app.

**Acceso, validación y errores**

- **FR-022**: Solo el organizador de un evento DEBE poder editarlo, administrar sus tipos de
  entrada o eliminarlo; a cualquier otro usuario se le responde "sin permiso" (403) sin cambiar
  nada.
- **FR-023**: Un evento o un tipo de entrada inexistente DEBE responder "no encontrado" (404).
  Un tipo de entrada que existe pero pertenece a otro evento cuenta como inexistente para ese
  evento.
- **FR-024**: El servidor DEBE validar toda la entrada aunque la app ya lo haya hecho; los
  datos con forma inválida se rechazan como entrada inválida (400) con un detalle por campo.
- **FR-025**: Las operaciones que violan una regla del dominio DEBEN rechazarse como conflicto
  (409) con un código propio y un mensaje claro en español: evento realizado, evento con
  compras, tipo de entrada con compras, último tipo de entrada y nombre de tipo repetido.
- **FR-026**: La app DEBE mostrar el mensaje de cada error junto al campo correspondiente
  (entrada inválida) o en la pantalla (conflicto, sin permiso, no encontrado), conservando lo
  que el organizador cargó en el formulario.
- **FR-026a**: Al salir de un formulario de crear o editar (evento o tipo de entrada) sin
  guardar, la app DEBE pedir siempre confirmación, haya cambios o no, con un diálogo
  "¿Descartar los cambios?" y las opciones Descartar (sale sin guardar) y Seguir editando
  (vuelve al formulario con lo cargado). Salir después de guardar con éxito no pregunta.
- **FR-027**: Un pedido sin usuario identificado DEBE rechazarse como hoy (401), sin crear ni
  modificar nada.
- **FR-028**: Las respuestas DEBEN devolver vistas explícitas de los eventos y sus tipos de
  entrada (campos elegidos), con los mismos datos que muestra la app.

**Operaciones simultáneas**

- **FR-029**: Toda operación que verifica una regla y después modifica un evento, sus tipos de
  entrada o (desde la 006) sus compras DEBE ser atómica respecto de las demás operaciones sobre
  el mismo evento: ninguna otra puede intercalarse entre la verificación y la modificación. Ante
  dos pedidos simultáneos sobre el mismo evento, el resultado DEBE ser el mismo que si se
  hubieran procesado uno después del otro, y ninguno puede dejar el evento en un estado que
  viole las reglas de esta spec (sin tipos, con nombres repetidos, eliminado con compras).
  Las operaciones sobre eventos distintos no se esperan entre sí.

### Key Entities *(include if feature involves data)*

- **Categoria** (existente): catálogo precargado con nombre y descripción; cada evento tiene
  una.
- **Evento** (existente, se amplía su gestión): nombre, descripción, categoría, fecha y hora
  (instante), multimedia (0 a 5 URLs), organizador (un Usuario) y uno o más tipos de entrada.
  Está **realizado** cuando su fecha y hora ya llegó.
- **TipoEntrada** (existente): pertenece a un único evento; nombre único dentro del evento,
  descripción, precio en pesos enteros ≥ 0 y cupo disponible entero ≥ 0 (≥ 1 al crearse).
- **Compra** (mínima): referencia a un evento y a uno de sus tipos de entrada, con el total
  fijado al comprar. En esta feature solo importa si existe alguna para un evento o un tipo.
- **Usuario** (existente): el organizador de un evento es el usuario que lo creó.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un organizador crea un evento con dos tipos de entrada desde la app, de punta a
  punta, en menos de 3 minutos y sin escribir la fecha ni la hora a mano.
- **SC-002**: El 100 % de los eventos creados aparecen en Mis eventos de su organizador
  inmediatamente después de guardar, y en ningún caso en Mis eventos de otro usuario.
- **SC-003**: Cada regla de la feature (fecha futura, nombre de tipo único, precio y cupo
  válidos, multimedia válida, evento realizado, tipo o evento con compras, último tipo, sin
  permiso, no encontrado) tiene al menos un test que la verifica, incluido su caso borde
  (constitución, principio II).
- **SC-004**: Ningún pedido inválido o no permitido, enviado a la app o directo al servidor,
  deja un evento o un tipo de entrada modificado.
- **SC-005**: El 100 % de los rechazos muestran un mensaje en español que dice qué regla se
  violó o qué campo corregir, sin perder lo cargado en el formulario.
- **SC-006**: La fecha y hora de un evento se ve idéntica en hora de Buenos Aires en teléfonos
  configurados en zonas horarias distintas.
- **SC-007**: Las pantallas de la feature se usan sin cortes ni desplazamiento horizontal en
  pantallas de 360 px de ancho, con todos los controles anunciados por el lector de pantalla.
- **SC-008**: Ante pedidos simultáneos sobre un mismo evento (eliminarlo, agregar, renombrar o
  quitar tipos), el 100 % de los casos termina en un estado válido y equivalente a procesarlos
  de a uno, verificado con tests de pedidos concurrentes.

## Assumptions

- "Realizado" significa que la fecha y hora de inicio del evento ya llegó según el reloj del
  servidor; no hay fecha de fin. Es el mismo criterio que usará la cancelación de compras (009).
- El orden de los realizados en Mis eventos es del más reciente al más antiguo (el pedido solo
  fijaba "después de los próximos").
- Límites de texto para validar en el servidor: nombre de evento hasta 100 caracteres,
  descripción de evento hasta 2000, nombre de tipo hasta 50 y descripción de tipo hasta 300.
  No se fija un máximo de precio ni de cupo más allá de ser enteros.
- No se controla que las URLs de multimedia apunten a una imagen real ni que no se repitan; solo
  que sean `http` o `https` y que no superen cinco.
- Editar los datos del evento y administrar sus tipos de entrada son operaciones separadas:
  guardar los datos del evento no toca sus tipos, y cada tipo se agrega, edita o quita por su
  cuenta.
- Un evento creado o editado no se notifica a quienes ya compraron (no hay notificaciones en el
  TP); cambiar la fecha de un evento con compras está permitido.
- La vista de solo lectura del evento realizado (FR-006a) es del organizador; el detalle
  público del evento (para compradores) es de la 005.
- Depende de la 001 (servidor, datos de ejemplo, usuario actual) y de la 003 (piezas base de
  pantalla, cuatro estados y acceso al servidor con todos los métodos).
