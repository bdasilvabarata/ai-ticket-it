# Feature Specification: Refactor de Mis compras, Compras del evento y Cancelación

**Feature Branch**: `feature/010-refactor-compras`

**Created**: 2026-11-20

**Status**: Draft

**Input**: User description: "Refactor de las features 007 (Mis compras), 008 (Compras de un evento y registrar ingreso) y 009 (Cancelar compra y reembolso), sin cambiar comportamiento visible ni contratos, antes de 011 (chat) y 012 (reseñas), que se apoyan en el modelo de Compra y Entrada. Sale de docs/Gemini/analisis-refactor-features-007-008-009.md, ya contrastado con el código y priorizado en docs/backlog.md, sección "Alcance de la 010", que es la fuente del alcance. Regla común: no cambian los tipos de shared/, las rutas ni las respuestas de la API, la OpenAPI ni nada de lo que ve el usuario en la app; los tests de backend/tests/api y mobile/tests/pantallas siguen pasando sin modificarse. Alcance, en orden de retorno: (1) resumenPorTipo usa compra.entradasUsadas; (2) useRegistrarUso deja de invalidar el evento y el catálogo; (3) Entrada con estado explícito (uso y cancelación con autor y fecha) e invariantes de Compra una por regla; (4) compra.reembolso como valor derivado único; (5) aCompraDelEventoVista y aEntradaDelEventoVista componen piezas comunes; (6) un solo dueño de RepositorioCompras: EntradaService delega el uso en CompraService, con el mismo cerrojo, orden de chequeos y un solo guardar; (7) RegistrarIngreso en componentes propios, sin ternarios anidados. Opcionales: useEnvioUnico y diasRestantes sin split. Fuera de alcance: lo descartado en el backlog. Al terminar, actualizar AGENTS.md y, si corresponde, las skills nuevo-endpoint y nueva-pantalla."

**Casos de uso**: ninguno directo (refactor técnico). Prepara el modelo de `Compra` y `Entrada`
del que dependen UC-05 y UC-06 (chat, 011) y UC-09 y UC-10 (reseñas, 012).

> Esta feature es un **refactor**: no cambia nada de lo que ve o hace quien usa la app ni de lo
> que responde el servidor. Sus destinatarios son quienes construyen las features siguientes. Por
> eso la spec nombra piezas que ya existen (la compra, sus entradas, las vistas, "Registrar
> ingreso") y lo que se espera de ellas; cómo se reescriben exactamente queda para el plan. El
> comportamiento de referencia es el de `specs/007-mis-compras/`, `specs/008-compras-de-evento/`
> y `specs/009-cancelar-compra/`, que siguen vigentes sin cambios. La fuente del alcance (qué se
> hace, qué es opcional y qué se descarta, con sus motivos) es `docs/backlog.md`, sección
> "Alcance de la 010".

## Clarifications

### Session 2026-11-20

- Q: Al registrar un ingreso, ¿quién toma el cerrojo del evento y hace los chequeos 404 evento /
  403 organizador? → A: el responsable de las compras entero (`CompraService.registrarUso`:
  cerrojo, `ahora`, 404/403, compra por código, ventana y un solo guardado);
  `EntradaService.registrarUso` solo delega y el controller no cambia.
- Q: ¿Hay que aclarar en la 010 la redacción de la constitución sobre la entrada ("un estado y sus
  cambios de estado propios")? → A: sí, con una aclaración PATCH en el mismo PR: la entrada
  registra su uso y su cancelación (quién y cuándo); las reglas no cambian.
- Q: ¿Los opcionales (doble envío y días restantes) entran en `tasks.md`? → A: sí, como última
  fase marcada como opcional; el PR puede cerrarse sin ella y el backlog registra cuáles se
  hicieron.
- Q: ¿Qué largo máximo debe tener `domain/compra.ts` al terminar (hoy 536 líneas)? → A: ≤ 300
  líneas, sin contar los módulos nuevos de la entrada y de las reglas.
- Q (plan): el test "registrar con éxito…" de `mobile/tests/pantallas/registrar-ingreso.test.tsx`
  verifica hoy que registrar un ingreso invalida el catálogo y el evento (lo que quita el punto 2).
  ¿Cómo se concilia con no tocar los tests de pantallas? → A: excepción acotada: en ese test solo
  cambian esas aserciones (pasan a verificar que el catálogo y el evento **no** se invalidan); el
  resto de `mobile/tests/pantallas/` no se modifica.
- Q (plan): `VencimientoService.vencerPendientes` también guarda compras (las vencidas, como
  `CANCELADA` del sistema). ¿Entra en "un solo responsable"? → A: no; queda como excepción
  documentada: es la pieza de abajo del mismo agregado que materializa vencimientos y existe para
  evitar el ciclo con `EventoService`. El responsable único es el de los **casos de uso** sobre
  compras.

## Alcance

**Incluye** (en orden de retorno, como en el backlog):

1. Una sola definición de "entrada usada": el resumen por tipo de "Compras del evento" la toma de
   la compra en vez de repetirla.
2. Registrar el ingreso deja de pedirle a la app que vuelva a consultar el evento y el catálogo
   (el uso no cambia el cupo).
3. La entrada con su estado explícito (su uso y su cancelación, cada uno con quién y cuándo) y las
   reglas internas de la compra escritas una por regla.
4. El reembolso de una compra como un único valor derivado (pendiente, confirmado o ninguno).
5. Las vistas de una compra para el organizador armadas con las mismas piezas que las del
   comprador.
6. Un único responsable de guardar compras: el registro de un ingreso lo guarda el dueño de la
   compra.
7. "Registrar ingreso" dividida en piezas propias (buscador y resultado), legibles sin ternarios
   anidados.
8. La guía para agentes (`AGENTS.md`) y, si cambia algo de lo que cubren, las skills
   `nuevo-endpoint` y `nueva-pantalla`; el estado de la 010 en el backlog; y una aclaración PATCH
   de la constitución sobre cómo se describe la entrada (sin cambiar reglas).

**Opcional** (solo si sobra tiempo al cerrar lo anterior, prioridad más baja): una pieza común
para evitar el doble envío en "Tu compra" y "Compras del evento"; el cálculo de los días
restantes sin partir textos de fecha, con la conversión de zona horaria todavía en un único lugar.

**No incluye** (descartado en el backlog, con sus motivos): achicar el cerrojo de registrar el
ingreso o de confirmar un reembolso; la entrada como agregado propio con su repositorio;
rediseñar rutas; estructuras nuevas en los contratos compartidos; reemplazar el refresco al
vencer por un sondeo periódico; ayudantes genéricos de invalidación; un índice de códigos usados
en el repositorio; unificar los textos de "no se puede usar" entre el servidor y la app. Tampoco
incluye ningún cambio de reglas de negocio, endpoints, pantallas, textos ni aspecto.

## User Scenarios & Testing *(mandatory)*

Los actores de esta feature son:

- **Desarrollador** (la persona que hace el TP y los agentes de IA que la asisten): va a sumar el
  chat de una compra (011) y las reseñas, que exigen una entrada utilizada (012). Necesita
  entender el modelo de compra y entrada sin reconstruir historiales cruzados, saber qué pieza
  guarda una compra y agregar un dato a una vista en un solo lugar.
- **Comprador y organizador** (usuarios de la app): no perciben ningún cambio. Mis compras, Tu
  compra, Compras del evento, Registrar ingreso, la cancelación y el reembolso se comportan igual
  que en la 007, la 008 y la 009.

### User Story 1 - Entender y extender el modelo de compra y entrada (Priority: P1)

Al empezar la 012, el desarrollador necesita saber si una entrada está utilizada, quién registró
su uso y cuándo. Abre el modelo de la compra y lo encuentra en la entrada misma: cada entrada
dice si se usó (quién y cuándo) y si se canceló (quién y cuándo), y su estado se lee sin recorrer
listas de cambios ni consultar reglas repartidas. Las reglas que la compra protege al construirse
están escritas una por regla, cada una con su propio mensaje, de modo que, al leer por qué se
rechazó una compra mal armada, se ve cuál de las reglas falló. El reembolso de una compra es un
dato único de la compra (pendiente, confirmado o ninguno), no una combinación que cada vista
arma por su cuenta. "Entrada usada" se define en un solo lugar y el resumen por tipo la reutiliza.

**Why this priority**: es el núcleo del problema y lo próximo pasa por acá: la 012 exige una
entrada utilizada y la 011 cuelga de una compra. El archivo del modelo de la compra tiene hoy 536
líneas y su regla de coherencia entre compra y entradas mezcla cinco casos en una sola función.

**Independent Test**: con el modelo reescrito, todos los tests de la API pasan sin modificarse;
los tests del modelo cubren cada regla de la compra por separado (con al menos un caso que la
cumple y uno que la viola), cada transición de las entradas y cada valor del reembolso, y no se
pierde ningún caso que cubrían los tests anteriores.

**Acceptance Scenarios**:

1. **Given** una compra pendiente (o cancelada, o vencida, sin haberse confirmado), **When** se
   consulta el estado de cualquiera de sus entradas, **Then** es el mismo de la compra, como hoy.
2. **Given** una compra confirmada, **When** el organizador registra el uso de una entrada,
   **Then** esa entrada queda utilizada con el organizador como autor y la fecha y hora del uso;
   con la primera usada, la compra pasa a utilizada con el mismo autor y la misma fecha y hora, y
   con las siguientes la compra no suma cambios.
3. **Given** una compra confirmada antes del inicio del evento, **When** su comprador la cancela,
   **Then** cada entrada queda cancelada con el comprador como autor y la misma fecha y hora, y su
   código ya no sirve para registrar el ingreso.
4. **Given** una compra cancelada después de confirmada y reembolsada por el organizador, **When**
   se consulta una de sus entradas, **Then** el estado de la entrada es el mismo que muestra hoy
   (cancelada), y la compra sigue reembolsada.
5. **Given** datos que violan una sola regla de la compra (por ejemplo, menos entradas que la
   cantidad, dos códigos repetidos, una entrada usada en una compra que no pasó por confirmada,
   una entrada usada y cancelada a la vez, o un reembolso en una compra gratis), **When** se
   intenta construir la compra, **Then** se rechaza con un detalle que nombra esa regla; si la
   cantidad ya es inválida, se informa la cantidad sin que otra regla dependa de ese resultado
   para decidir si se evalúa.
6. **Given** una compra en cada uno de sus estados posibles, **When** se pide su reembolso,
   **Then** es "pendiente" solo si está cancelada, se confirmó antes y es paga; "confirmado" si
   está reembolsada; y ninguno en cualquier otro caso (también en una compra gratis cancelada
   después de confirmada).
7. **Given** compras con entradas usadas, **When** se arma el resumen por tipo de "Compras del
   evento", **Then** las usadas que suma coinciden con las que informa cada compra, porque salen
   de la misma definición.
8. **Given** los datos de ejemplo del arranque (incluidas la compra de Diego con el reembolso
   pendiente, la de Valentina reembolsada y "Peña en La Rueda"), **When** se arranca el servidor,
   **Then** lo que responde la API sobre ellos es idéntico a antes del refactor.

---

### User Story 2 - Un solo responsable de guardar compras y vistas que se arman una vez (Priority: P2)

Para la 011, el desarrollador tiene que sumar algo a la compra y mostrarlo al comprador y al
organizador. Sabe que hay **un** responsable de guardar compras, así que la regla nueva va en un
solo lugar y no tiene que coordinarla con otra pieza que también las escribe. Y cuando un dato
nuevo de la compra tiene que aparecer en lo que ve el organizador (la lista de "Compras del
evento" y la entrada buscada en "Registrar ingreso"), lo suma en la pieza común que comparten
las vistas, no campo por campo en cada una.

**Why this priority**: hoy el registro del ingreso guarda compras por su cuenta, en paralelo con
el dueño de la compra, lo que contradice la regla de la constitución "cada service escribe solo
su agregado". Y la 009 tuvo que sumar los mismos dos datos (desde qué estado se canceló y el
reembolso) en tres vistas distintas.

**Independent Test**: los tests de la API de "Compras del evento", "Registrar ingreso" y la
consulta de una entrada pasan sin modificarse (mismas respuestas, mismos errores en el mismo
orden y un único guardado por uso registrado); los tests de los services cubren el registro del
uso desde el dueño de la compra con los mismos casos que hoy.

**Acceptance Scenarios**:

1. **Given** el organizador registra el ingreso de una entrada válida dentro de la ventana de uso,
   **When** termina, **Then** la respuesta es la misma que hoy, la compra se guarda una sola vez y
   quien la guarda es el responsable de las compras; la pieza que atiende las entradas ya no
   guarda compras.
2. **Given** un pedido de registrar ingreso con varios problemas a la vez, **When** se responde,
   **Then** el error es el mismo y en el mismo orden que hoy: usuario no identificado (401) →
   forma inválida (400) → evento inexistente (404) → no es el organizador (403) → código
   inexistente, de otro evento o con formato inválido (404) → fuera de la ventana de uso (409) →
   la entrada no se puede usar (409).
3. **Given** dos pedidos simultáneos de registrar el mismo código, o el uso de una entrada a la
   vez que se cancela su compra, **When** se resuelven, **Then** se comportan como hoy: corren uno
   después del otro bajo el cerrojo del evento y el segundo ve lo que hizo el primero.
4. **Given** cualquier compra en cualquier estado, **When** se la consulta como organizador (la
   lista de "Compras del evento" o la entrada buscada por código), **Then** cada dato coincide con
   el de hoy, y los datos que también ve el comprador (estado, desde qué estado se canceló,
   reembolso, entradas usadas) se calculan con las mismas piezas que la vista del comprador.

---

### User Story 3 - Leer y modificar "Registrar ingreso" (Priority: P3)

El desarrollador abre la pantalla de "Registrar ingreso" para entender qué muestra en cada caso.
Encuentra la pantalla armada con dos piezas con nombre propio: el buscador del código (campo,
aviso de formato y "Buscar") y el resultado (código no encontrado; o la entrada encontrada con el
motivo por el que no se puede usar o el botón para registrar el ingreso). Cada caso se lee en su
propio bloque, sin ternarios anidados. Al registrar un ingreso, la app actualiza lo que cambió (la
lista de compras del evento, la entrada y las compras del comprador que pudiera tener en el
dispositivo), pero ya no vuelve a pedir el evento ni el catálogo, que no cambiaron.

**Why this priority**: es la pantalla más difícil de leer de la app, pero su cambio queda
contenido en ella: sus tests de pantalla la cubren sin cambios y no la usa ninguna otra feature.

**Independent Test**: los tests de `mobile/tests/pantallas/` de "Registrar ingreso" y "Compras
del evento" pasan sin modificarse; un test de la mutación de registrar ingreso verifica qué
consultas vuelve a pedir y cuáles no.

**Acceptance Scenarios**:

1. **Given** la pantalla reorganizada, **When** se repite cada recorrido de "Registrar ingreso"
   de la 008 y la 009 (código mal escrito, código inexistente, entrada confirmada dentro y fuera
   de la ventana, entrada ya usada, compra pendiente, cancelada o reembolsada, uso confirmado con
   el diálogo), **Then** se ve y se comporta exactamente igual que antes, con los mismos textos,
   anuncios de accesibilidad y foco.
2. **Given** el organizador registró el ingreso de una entrada, **When** termina, **Then** la app
   vuelve a pedir la lista de compras del evento, esa entrada y, para cualquier usuario guardado
   en el dispositivo, "Tu compra", "Mis compras" y las compras del detalle del evento; **no**
   vuelve a pedir el detalle del evento ni el catálogo.
3. **Given** el código de la pantalla, **When** se lo lee, **Then** el buscador y el resultado
   son piezas separadas y ninguna expresión de lo que se muestra encadena un ternario dentro de
   otro.

---

### User Story 4 - Pequeñas deduplicaciones opcionales (Priority: P4)

Si sobra tiempo al cerrar las historias anteriores: la protección contra el doble envío que hoy
se repite en "Tu compra" y en "Compras del evento" (el diálogo de confirmación puede responder
antes de que la pantalla se actualice) pasa a una sola pieza que ambas usan; y el cálculo de los
días restantes deja de partir un texto de fecha, apoyándose en una conversión a la fecha de pared
de Buenos Aires que vive en el mismo y único lugar que hoy concentra la zona horaria.

**Why this priority**: beneficio bajo con esfuerzo bajo; no lo necesita ninguna feature
siguiente. Se puede omitir sin afectar a las demás historias. Va como **última fase de
`tasks.md`, marcada como opcional**: la feature y su PR se cierran sin ella si no hay tiempo, y
el backlog registra cuáles se hicieron (FR-023).

**Independent Test**: los tests de pantalla de "Tu compra" y "Compras del evento" (incluido el
doble toque en el diálogo) y los de días restantes pasan sin cambiar lo que verifican.

**Acceptance Scenarios**:

1. **Given** "Tu compra" o "Compras del evento", **When** se confirma dos veces seguidas el mismo
   diálogo, **Then** se envía un solo pedido, como hoy.
2. **Given** cualquier evento y cualquier instante, incluidos los bordes de medianoche de Buenos
   Aires, **When** se calculan los días restantes, **Then** el resultado es el mismo que hoy.

---

### Edge Cases

- **Compra reembolsada**: la compra está `REEMBOLSADA` y sus entradas siguen mostrando
  `CANCELADA`, como hoy. El refactor no unifica esos dos estados (cambiaría lo que responde la
  API).
- **Compra cancelada desde pendiente o vencida**: sus entradas no tienen uso ni cancelación
  propios; su estado sigue siendo el de la compra (`CANCELADA`), como hoy.
- **Entrada usada y cancelada a la vez**: no puede existir (una compra utilizada no se cancela);
  la compra la rechaza como dato inválido.
- **Compra utilizada sin ninguna entrada usada, o confirmada con alguna usada**: se rechaza como
  dato inválido (una compra está utilizada si y solo si alguna de sus entradas lo está).
- **Varias reglas violadas a la vez** al construir una compra: se informa cada regla que falla,
  cada una con su detalle; una regla no se salta porque otra ya falló, salvo que no tenga sentido
  evaluarla (por ejemplo, comparar la cantidad de entradas con una cantidad que no es un número),
  y esa dependencia queda escrita en la propia regla, no en una guarda combinada.
- **Pendiente vencida al registrar el ingreso**: se rechaza como hoy (la compra al día está
  cancelada), y el vencimiento se materializa igual que hoy antes de registrar el uso.
- **Error a mitad del registro del ingreso**: el cerrojo del evento se libera y la compra no
  queda guardada a medias, como hoy.
- **Datos de ejemplo**: la semilla arma las mismas compras y entradas (los mismos códigos, usos y
  cancelaciones) con la forma nueva de la entrada; lo que se ve al arrancar no cambia.
- **Tests que construyen entradas con la forma vieja**: los ayudantes de tests compartidos se
  adaptan a la forma nueva conservando sus firmas, para que los tests de la API que los usan no
  se modifiquen.

## Requirements *(mandatory)*

### Functional Requirements

**Sin cambios visibles (regla común)**

- **FR-001**: NO DEBEN cambiar los tipos de los contratos compartidos (`shared/`), las rutas, las
  respuestas de la API (datos, códigos de error, mensajes y orden de los chequeos) ni la
  especificación OpenAPI.
- **FR-002**: La app DEBE conservar el comportamiento, los textos, la accesibilidad y el aspecto
  definidos en la 007, la 008 y la 009.
- **FR-003**: Los tests de `backend/tests/api/` y de `mobile/tests/pantallas/` DEBEN seguir
  pasando **sin modificarse**, con una única excepción: en el test "registrar con éxito…" de
  `mobile/tests/pantallas/registrar-ingreso.test.tsx` cambian solo las aserciones de las
  invalidaciones del catálogo y del evento, que pasan a verificar que no ocurren (FR-018). Los de `backend/tests/domain/`, `backend/tests/services/`,
  `backend/tests/repositories/` y los ayudantes de tests compartidos PUEDEN adaptarse a las formas
  internas nuevas sin perder ningún caso cubierto (cada caso que hoy se verifica sigue
  verificándose, aunque cambie cómo se arma).
- **FR-004**: Los datos de ejemplo DEBEN producir exactamente las mismas respuestas de la API que
  antes del refactor.
- **FR-005**: Las reglas de dominio de la constitución sobre compras y entradas (estados y sus
  transiciones, estado de una entrada, cancelación, reembolso y operaciones atómicas por evento)
  NO cambian; el refactor solo cambia cómo se representan y verifican.

**Modelo de compra y entrada (US1)**

- **FR-006**: El resumen por tipo de "Compras del evento" DEBE contar las entradas usadas con la
  misma definición que usa la compra para informar sus entradas usadas; NO DEBE haber una segunda
  definición de "entrada usada".
- **FR-007**: Cada entrada DEBE registrar de forma explícita su uso (quién y cuándo) y su
  cancelación (quién y cuándo), cada uno presente o ausente, en lugar de una lista de cambios
  propios. Una entrada NO DEBE necesitar que le pasen su compra para decir si fue usada o
  cancelada.
- **FR-008**: El estado de una entrada DEBE seguir siendo el de hoy en todos los casos: el de la
  compra mientras la compra nunca se confirmó; desde la confirmación, `UTILIZADA` si se usó,
  `CANCELADA` si se canceló (también en una compra reembolsada) y `CONFIRMADA` si no.
- **FR-009**: Las reglas que la compra verifica al construirse DEBEN escribirse **una por regla**,
  cada una con su propio detalle de error: cantidad válida; total válido; historial válido;
  reembolso válido; una entrada por unidad; códigos con formato válido; códigos distintos; sin
  uso ni cancelación de entradas en una compra que no pasó por confirmada; ninguna entrada usada y
  cancelada a la vez; utilizada si y solo si alguna entrada está usada; y, en una compra cancelada
  o reembolsada después de confirmada, todas sus entradas canceladas (y ninguna en otro estado).
  La lista exacta y sus mensajes los fija el plan, cubriendo como mínimo lo que hoy se verifica.
- **FR-010**: NO DEBE quedar una regla de coherencia que combine en un único bloque los casos de
  todos los estados de la compra, ni una regla cuya evaluación dependa de una guarda combinada con
  el resultado de otra regla; cuando una regla solo tiene sentido si otra se cumple, esa condición
  DEBE estar escrita en la propia regla.
- **FR-011**: El modelo de la compra DEBE quedar legible: cada regla y cada transición se entiende
  sin leer las demás, y el archivo deja de concentrar en una sola pieza la coherencia entre la
  compra y sus entradas. El plan fija cómo se reparte (por ejemplo, separar la entrada o las
  reglas en su propio módulo) y lo justifica.
- **FR-012**: La compra DEBE exponer su **reembolso** como un único valor derivado de su
  historial y su total, sin guardarse aparte: "pendiente" (cancelada, se confirmó antes y es paga),
  "confirmado" (reembolsada) o ninguno. Las vistas, la confirmación del reembolso y los tests
  que lo verifican (incluidos los de la semilla) DEBEN usar ese valor en lugar de combinar por su cuenta si tiene un reembolso pendiente y desde
  qué estado se canceló.
- **FR-013**: Las transiciones de la compra (registrar, pagar, cancelar, vencer, registrar el uso,
  confirmar el reembolso, ponerse al día) y sus errores DEBEN conservar su comportamiento: mismos
  resultados, mismos códigos y mensajes de error y mismo orden de verificación.

**Un solo responsable de las compras (US2)**

- **FR-014**: El responsable de las compras DEBE ser el único service de casos de uso que guarda
  compras (la excepción es el vencimiento perezoso, que materializa las pendientes vencidas desde
  abajo del dueño del evento y no cambia). Registrar el
  ingreso de una entrada DEBE delegarse entero en una operación de ese responsable, que toma el
  cerrojo del evento y hace todos los chequeos del uso (404 evento, 403, código, ventana y
  transición) y el guardado, igual que ya hace con la cancelación y la confirmación del reembolso.
  La pieza que atiende las entradas conserva la consulta de una entrada (solo lectura) y, para el
  uso, solo delega (el controller y la ruta no cambian); NO DEBE guardar compras ni tomar el
  cerrojo.
- **FR-015**: Registrar el ingreso DEBE seguir ocurriendo entero bajo el cerrojo del evento, con un
  único "ahora" leído adentro, volviendo a leer el evento (al día, con los vencimientos
  materializados) y la compra por su código, con el mismo orden de chequeos (401 → 400 → 404
  `EVENTO_NO_ENCONTRADO` → 403 → 404 `ENTRADA_NO_ENCONTRADA` → 409 `FUERA_DE_HORARIO_DE_USO` → 409
  `TRANSICION_INVALIDA`) y **un solo** guardado de la compra; el cupo no cambia.
- **FR-016**: Las dependencias entre las piezas que atienden compras, entradas, eventos y
  usuarios NO DEBEN formar ciclos; si el orden en que se conectan cambia, DEBE quedar documentado.

**Vistas (US2)**

- **FR-017**: La vista de una compra en "Compras del evento" y la de la compra dentro de una
  entrada buscada DEBEN armarse componiendo piezas comunes con las vistas del comprador (como hoy
  hacen las de "Tu compra" y "Mis compras"), de modo que un dato de la compra que ven varias vistas
  se calcule en un solo lugar. Sin cambiar lo que devuelve cada vista (FR-001).

**"Registrar ingreso" (US3)**

- **FR-018**: Al terminar de registrar un ingreso, la app DEBE volver a pedir la lista de compras
  del evento, esa entrada y, por prefijo (para cualquier usuario guardado en el dispositivo), "Tu
  compra", "Mis compras" y las compras del detalle del evento; NO DEBE volver a pedir el detalle
  del evento ni el catálogo.
- **FR-019**: La pantalla "Registrar ingreso" DEBE separar el buscador del código y el resultado
  en piezas propias de la feature, y lo que muestra en cada caso NO DEBE expresarse con ternarios
  anidados. Las piezas nuevas siguen las reglas de la app (organización por feature, tema, cuatro
  estados, accesibilidad) y no se exportan fuera de su feature salvo que otra las necesite.

**Opcionales (US4)**

- **FR-020** *(opcional)*: La protección contra el doble envío de "Tu compra" y "Compras del
  evento" PUEDE pasar a una sola pieza reutilizable que conserve el comportamiento actual (un
  solo pedido aunque el diálogo responda dos veces antes de actualizarse la pantalla).
- **FR-021** *(opcional)*: El cálculo de los días restantes PUEDE dejar de partir un texto de
  fecha, apoyándose en una conversión a fecha de pared de Buenos Aires; la conversión de zona
  horaria DEBE seguir viviendo en un único lugar del dominio y el resultado no cambia.

**Documentación**

- **FR-022**: La guía para agentes (`AGENTS.md`) DEBE describir el estado nuevo: la entrada con
  su uso y su cancelación explícitos (en lugar de cambios propios y de un estado derivado pasando
  la compra), las reglas de la compra una por regla, el reembolso como valor de la compra, el
  responsable único de guardar compras (y el orden en que se conectan los services, si cambia),
  las vistas compuestas, las invalidaciones de registrar el ingreso y las piezas de "Registrar
  ingreso". Las skills `nuevo-endpoint` y `nueva-pantalla` DEBEN actualizarse solo si cambia algo
  de lo que cubren.
- **FR-023**: Al cerrar la feature, el backlog DEBE marcar el estado de la 010 y, si se hizo,
  registrar qué opcionales quedaron hechos y cuáles no.
- **FR-024**: La constitución DEBE recibir una aclaración PATCH (en el mismo PR) que describa la
  entrada con su uso y su cancelación, cada uno con quién y cuándo, en lugar de "un estado y sus
  cambios de estado propios"; ninguna regla de dominio cambia (FR-005) y la versión sube en un
  PATCH con su informe de sincronización.

### Key Entities

- **Compra**: la transacción de un comprador por entradas de un tipo; su estado sale de su
  historial de cambios (estado, quién y cuándo). Expone, derivados y sin guardarse aparte, sus
  entradas usadas, desde qué estado se canceló y su **reembolso**.
- **Entrada**: una por unidad de una compra, identificada por su código y guardada dentro de la
  compra. Registra su **uso** y su **cancelación**, cada uno con quién y cuándo, o ausente. Su
  estado visible se deriva de esos dos datos y, mientras la compra nunca se confirmó, del estado
  de la compra.
- **Reembolso** (valor derivado de la compra): pendiente, confirmado o ninguno; no es una entidad
  ni se guarda.
- **Responsable de las compras**: la única pieza del servidor que guarda compras; las demás le
  piden las operaciones que cambian una compra.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de los tests de `backend/tests/api/` y `mobile/tests/pantallas/` pasan sin
  que se modifique ninguno de sus archivos, salvo las aserciones de invalidación de
  `registrar-ingreso.test.tsx` (FR-003) (verificable comparando esos archivos con `development`), y `npm test`, `npm run lint`, `npm run typecheck` y `npm run format:check` pasan
  en local y en el CI.
- **SC-002**: Ningún archivo de `shared/` ni la especificación OpenAPI cambia respecto de
  `development`.
- **SC-003**: Ningún caso cubierto por los tests de dominio y de services anteriores se pierde:
  cada escenario que verificaban sigue verificado, y cada regla de la compra tiene al menos un
  caso que la cumple y uno que la viola.
- **SC-004**: Hay exactamente un service de casos de uso que guarda compras (además del
  vencimiento perezoso, FR-014), y exactamente una definición de "entrada usada".
- **SC-005**: El modelo de la compra no tiene ninguna función que reúna la coherencia de las
  entradas para todos los estados ni guardas combinadas entre reglas, y `domain/compra.ts` pasa
  de 536 líneas a **300 o menos** (sin contar los módulos nuevos de la entrada y de las reglas,
  que se miden aparte y se justifican en el plan).
- **SC-006**: Sumar un dato de la compra que ven el comprador y el organizador requiere tocar una
  sola pieza de las vistas del servidor (además del contrato, si el dato es nuevo).
- **SC-007**: Registrar un ingreso dispara, en la app, cero pedidos nuevos del detalle del evento
  y del catálogo.
- **SC-008**: Los recorridos de los quickstarts de la 007, la 008 y la 009 se repiten en el
  celular con el mismo resultado que antes del refactor.

## Assumptions

- Los tests de la API y de pantallas que hoy pasan son una red de seguridad suficiente para
  detectar un cambio de comportamiento visible; si el refactor revela un caso visible sin cubrir,
  se agrega su test antes de tocar el código (TDD), sin modificar los tests existentes.
- Los ayudantes de tests compartidos (por ejemplo, los que arman compras y entradas de prueba)
  cuentan como código de tests adaptable: se adaptan a la forma nueva de la entrada conservando
  sus firmas, porque los tests de la API los usan y no se modifican.
- La forma nueva de la entrada (uso y cancelación con quién y cuándo) sigue cumpliendo la
  constitución en lo sustancial (cambios propios con quién y cuándo, y el estado igual al de la
  compra hasta que se confirma); su redacción se alinea con una aclaración PATCH dentro de esta
  feature (FR-024), sin cambiar ninguna regla.
- El reembolso sigue derivado del historial, sin campo guardado (decisión del backlog).
- Los textos de "no se puede usar" del servidor y de la app siguen duplicados (descartado en el
  backlog: no son idénticos y unificarlos tocaría el contrato).
- Las features 011 y 012 no se empiezan sobre el modelo viejo: esta feature se integra antes.
- Si el reparto del modelo de la compra en varios módulos o una pieza nueva de la app suma un
  archivo, se justifica en el plan (constitución IX, simplicidad).
