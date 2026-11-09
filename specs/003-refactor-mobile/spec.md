# Feature Specification: Refactor de la arquitectura mobile

**Feature Branch**: `feature/003-refactor-mobile`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "Refactor de la arquitectura de la app móvil (mobile/), sin cambiar comportamiento visible, antes de las features de dominio. Surge de comparar mobile/ con el cliente React de referencia de la cátedra (ddso-utn/ejercicio-megasuper-2026, rama clase11-integracion-front-back). Alcance: 1) organización por feature en src/features/<dominio>/, app/ como re-exports de una línea, corte de las dependencias circulares entre carpetas con una regla de lint que las impida, y rutas tipadas de Expo Router con typecheck en verde también en CI; 2) componentes base de UI (Boton y un tema que reemplace el objeto colores), separación de componentes genéricos y de dominio, un componente SegunConsulta para los cuatro estados de una consulta y funciones de formato de vista puras; 3) generalizar ClienteApi a pedir(método, ruta, {cuerpo, signal, usuarioId}) con get/post/put/patch/delete, JSON con Content-Type, tiempo límite, traducción de errores, 401 USUARIO_NO_IDENTIFICADO y respuestas 204 sin cuerpo. Fuera de alcance: controlador de sesión como store externo (deuda técnica en el backlog). useSesion, useClienteApi y useConexion mantienen su firma. Los tests existentes siguen pasando. Actualizar AGENTS.md y la skill nueva-pantalla. En el backlog esta pasa a ser la 003 y las features 003–011 se renumeran a 004–012."

**Casos de uso**: ninguno directo (P0 técnico; prepara la base de las pantallas de UC-01 a UC-12).

> Esta feature es un **refactor**: no cambia nada de lo que ve o hace quien usa la app. Sus
> destinatarios son quienes construyen las features siguientes. Por eso la spec nombra piezas
> de la base de la app que ya existen (pantallas, cliente HTTP, sesión) y lo que se espera de
> ellas; cómo se reorganizan exactamente queda para el plan. El comportamiento de referencia es
> el de `specs/002-base-mobile/spec.md`, que sigue vigente sin cambios.

## Alcance

**Incluye**: reorganizar el código de la app por feature, con la navegación como capa fina;
eliminar las dependencias circulares entre módulos y evitar que vuelvan; que una ruta mal
escrita se detecte al verificar tipos; piezas base reutilizables para armar pantallas (botón,
tema visual, manejo de los cuatro estados de una consulta, formato de vista); un acceso al
servidor que admita todos los métodos HTTP que van a necesitar las features 004 en adelante;
actualizar la guía para agentes, la skill `nueva-pantalla` y el backlog.

**No incluye**: cambios de comportamiento, textos o aspecto visible de la app; pantallas o
endpoints nuevos; modo oscuro; reemplazar la doble copia del estado de la sesión por un store
externo (se registra como deuda técnica); cambios en el backend.

## Clarifications

### Session 2026-11-08

- Q: ¿Las funciones de endpoint se mueven a su feature o se quedan en la base de acceso al servidor? → A: Se quedan en la base (`src/api/`), un archivo por recurso; las features las importan. No requiere enmendar la constitución (VII) y coincide con el `service/` centralizado de la referencia.
- Q: ¿La sesión y los usuarios son una feature o dos? → A: Dos: `usuarios` (lista, fila del selector, formato) y `sesion` (estado, controlador, conexión, selector y Perfil). Entre features solo se importa por el punto de entrada público.
- Q: ¿Dónde vive el estado de conexión para que la pieza de cuatro estados lo use sin que la base importe la feature `sesion`? → A: La base define el contrato de conexión (`EstadoConexion`), su context y `useConexion()`; la feature `sesion` lo implementa y lo provee en el layout raíz. La pieza de cuatro estados y la franja de servidor no disponible quedan en la base.
- Q: ¿El lint hace cumplir las reglas de dependencia entre features o solo detecta ciclos? → A: Hace cumplir las tres: sin ciclos, la base no importa features (salvo composición y navegación) y entre features solo por el punto de entrada público.

## User Scenarios & Testing *(mandatory)*

Los actores de esta feature son:

- **Desarrollador** (la persona que hace el TP y los agentes de IA que la asisten): necesita
  saber dónde va cada pieza de una pantalla nueva, armarla con piezas que ya resuelven lo
  repetitivo y enterarse antes de correr la app si rompió una regla de estructura o escribió
  mal una ruta.
- **Usuario de la app**: no percibe ningún cambio. Todo lo de la 002 se comporta igual.

### User Story 1 - Encontrar y ubicar cada pieza de una pantalla por feature (Priority: P1)

Al empezar una feature de dominio (por ejemplo, Crear evento), el desarrollador crea una
carpeta para esa feature y pone ahí su pantalla, sus componentes propios, sus consultas y su
formato de vista. En la carpeta de navegación solo agrega un archivo de una línea que expone
esa pantalla en su ruta. Lo compartido por todas las features (acceso al servidor, consultas,
composición de dependencias, componentes genéricos) está en un lugar común y conocido. Si al
reorganizar o al agregar código introduce una dependencia circular entre módulos, el lint
falla y le dice cuál. Si navega a una ruta que no existe o le falta un parámetro, la
verificación de tipos falla, también en el CI.

**Why this priority**: es la base de todo lo demás y cuanto más tarde se haga, más archivos
hay que mover. Las features 004 a 012 suman entre 10 y 15 pantallas; sin esta organización
crecen todas las carpetas por capa a la vez y las pantallas siguen acumulando lógica en la
navegación.

**Independent Test**: con el refactor aplicado, la app abre en el celular y hace exactamente
lo mismo que en la 002, todos los tests pasan, cada archivo de navegación es una línea, el
lint falla si se agrega a propósito un import circular y la verificación de tipos falla si se
escribe mal el nombre de una ruta.

**Acceptance Scenarios**:

1. **Given** el código reorganizado, **When** se abre cualquier archivo de navegación
   (rutas y layouts), **Then** no contiene lógica, estado, estilos ni textos propios: solo
   expone una pantalla o un layout definidos en una feature o en la base de navegación.
2. **Given** el código reorganizado, **When** se corre el lint, **Then** no hay ninguna
   dependencia circular entre módulos de la app (en particular, desaparecen las de sesión ↔
   conexión y composición ↔ sesión).
3. **Given** el código reorganizado, **When** un desarrollador agrega un import que cierra un
   ciclo entre dos módulos, **Then** el lint falla e identifica los módulos del ciclo.
4. **Given** el código reorganizado, **When** un desarrollador importa una feature desde la
   base, o un archivo interno de otra feature en lugar de su punto de entrada público,
   **Then** el lint falla e indica la regla violada.
5. **Given** las rutas tipadas activas, **When** un desarrollador navega a una ruta que no
   existe (por ejemplo, `"/seleccionar-usuarios"`), **Then** la verificación de tipos falla,
   tanto en su máquina como en el CI.
6. **Given** la app con el refactor, **When** se repiten los recorridos de la 002 (primer
   arranque, usuario recordado, cambio de usuario, servidor no disponible, usuario
   inexistente), **Then** todo se ve y se comporta igual que antes.

---

### User Story 2 - Armar una pantalla con piezas base (Priority: P2)

Para una pantalla que muestra datos del servidor, el desarrollador no vuelve a escribir los
cuatro estados: usa una pieza que, dada la consulta, muestra "cargando", el error correcto
(servidor no disponible con el reintento de la conexión, o el mensaje del servidor con
"Reintentar" de esa consulta), el estado vacío con el texto que la pantalla indique, o los
datos. Los botones de acción se arman con un botón base, y colores, espaciados y tamaños de
texto salen de un tema único. Los textos derivados de los datos (nombre completo, "Organiza 2
eventos") salen de funciones de formato puras de la feature, testeables sin renderizar.

**Why this priority**: cada pantalla de las features siguientes necesita los cuatro estados
(constitución, principio VII) y botones; sin estas piezas, cada una copia el mismo bloque y el
mismo estilo. Depende poco de US1: las piezas sirven aunque la reorganización no estuviera.

**Independent Test**: el selector de usuario migrado a estas piezas muestra los mismos cuatro
estados que en la 002 (con los mismos textos y acciones), los tests de pantalla existentes
siguen pasando y las funciones de formato tienen sus propios tests.

**Acceptance Scenarios**:

1. **Given** una consulta pendiente, **When** la pantalla la muestra con la pieza de cuatro
   estados, **Then** se ve el indicador de carga.
2. **Given** una consulta que falló porque el servidor no respondió, **When** se muestra,
   **Then** se ve "Servidor no disponible" con la dirección intentada y un "Reintentar" que
   usa la secuencia única de reintentos de la app (no un reintento propio de la consulta).
3. **Given** una consulta que falló con un error respondido por el servidor, **When** se
   muestra, **Then** se ve el mensaje del servidor y un "Reintentar" que vuelve a pedir esa
   consulta; ante un error no reconocido se ve "Ocurrió un error inesperado.".
4. **Given** una consulta exitosa sin resultados, **When** se muestra, **Then** se ve el
   estado vacío con el texto que indicó la pantalla.
5. **Given** una consulta exitosa con resultados, **When** se muestra, **Then** se ven los
   datos tal como los arma la pantalla.
6. **Given** el botón base deshabilitado o en curso, **When** se lo toca, **Then** no hace
   nada y lo anuncia como deshabilitado al lector de pantalla.

---

### User Story 3 - Usar el servidor con cualquier método HTTP (Priority: P3)

Las features siguientes crean, modifican y cancelan cosas (crear evento, comprar, pagar,
cancelar, enviar mensajes, reseñar). El desarrollador agrega la función de un endpoint de
escritura con la misma facilidad que una de lectura: indica método, ruta y cuerpo, y el acceso
al servidor se ocupa de enviar el cuerpo como JSON, identificar al usuario, aplicar el tiempo
límite y traducir los errores igual que hoy.

**Why this priority**: la 004 (Crear evento) es la primera que lo necesita; hoy solo existe la
lectura. Es independiente de US1 y US2.

**Independent Test**: tests del acceso al servidor (sin red) que cubren cada método con y sin
cuerpo, una respuesta sin contenido, los errores del servidor, el tiempo límite y el 401 de
usuario no identificado; los tests de lectura de la 002 siguen pasando sin cambios de
comportamiento.

**Acceptance Scenarios**:

1. **Given** un pedido de escritura con cuerpo, **When** se envía, **Then** el servidor lo
   recibe como JSON, declarado como tal, con el usuario actual identificado.
2. **Given** un pedido cuya respuesta exitosa no tiene contenido, **When** termina, **Then** se
   resuelve sin valor y sin error.
3. **Given** un pedido de escritura que el servidor rechaza con el formato de error de la API,
   **When** termina, **Then** produce el mismo error tipado que un pedido de lectura (código,
   mensaje y detalles por campo).
4. **Given** un pedido de escritura que vence el tiempo límite o no llega al servidor, **When**
   termina, **Then** produce "servidor no disponible" y la app **no** lo repite sola.
5. **Given** un pedido de escritura respondido con 401 `USUARIO_NO_IDENTIFICADO` en nombre del
   usuario actual, **When** termina, **Then** la app olvida al usuario igual que con una
   lectura (002, FR-013).

---

### Edge Cases

- Una respuesta exitosa que debería tener contenido pero llega vacía o con un cuerpo que no es
  JSON se trata como hoy: error "El servidor respondió de forma inesperada.".
- Una respuesta sin contenido en un pedido de lectura (no debería pasar) se resuelve sin valor;
  la pantalla la trata como dato ausente.
- Un pedido de escritura que vence el tiempo límite puede haber sido procesado por el servidor.
  La app no lo repite automáticamente: la secuencia de reintentos solo revalida al usuario y
  vuelve a pedir lecturas. Decidir si reintentar es de la pantalla que lo envió (features
  siguientes).
- Una consulta cancelada (por ejemplo, al cambiar de usuario) no muestra error en la pieza de
  cuatro estados, igual que hoy.
- Las secciones todavía vacías (Explorar, Mis compras, Mis eventos) siguen mostrando "Próximamente"
  sin crear carpetas de features que todavía no existen.
- Los tests que hoy importan módulos por su ruta actual se adaptan a las rutas nuevas sin
  cambiar lo que verifican.

## Requirements *(mandatory)*

### Functional Requirements

**Sin cambios visibles**

- **FR-001**: La app DEBE conservar el comportamiento, los textos, la accesibilidad y el
  aspecto definidos en la 002 (`specs/002-base-mobile/spec.md` y sus clarificaciones).
- **FR-002**: Los hooks públicos `useSesion`, `useClienteApi` y `useConexion` DEBEN mantener
  su firma y su comportamiento.
- **FR-003**: Todos los tests existentes de `mobile/` DEBEN seguir pasando; solo pueden cambiar
  de ubicación o en sus imports, no en lo que verifican.

**Organización por feature (US1)**

- **FR-004**: El código de la app DEBE organizarse en **features** (una carpeta por dominio
  funcional, empezando por la de la sesión y los usuarios) y una **base compartida** (acceso
  al servidor, consultas, composición de dependencias, navegación y componentes genéricos).
- **FR-005**: Cada feature DEBE contener sus pantallas, sus componentes propios, sus hooks de
  consulta y su formato de vista. Las funciones de endpoint (`listarUsuarios`,
  `obtenerUsuarioActual` y las de las features siguientes) se quedan en la base de acceso al
  servidor, con un archivo por recurso, como pide la constitución (VII); las features las
  importan desde ahí.
- **FR-006**: Los archivos de navegación (rutas y layouts de Expo Router) NO DEBEN contener
  lógica, estado, estilos ni textos propios: cada uno expone una pantalla o un layout definido
  fuera de la navegación. Las secciones todavía vacías pueden renderizar directamente el
  componente genérico de sección pendiente.
- **FR-007**: Los componentes genéricos (indicador de carga, mensaje de error, lista vacía,
  sección pendiente, botón) DEBEN estar separados de los componentes de dominio; un componente
  de dominio (como la fila de usuario del selector) vive en su feature.
- **FR-008**: NO DEBE haber dependencias circulares entre módulos de la app, y el lint DEBE
  fallar si aparece una.
- **FR-009**: Las rutas de la app DEBEN estar tipadas: navegar a una ruta inexistente o sin sus
  parámetros obligatorios DEBE hacer fallar la verificación de tipos, tanto local como en el CI.
- **FR-010**: La sesión y los usuarios DEBEN ser dos features: **usuarios** (consulta de la
  lista, fila del selector, formato de usuario) y **sesion** (estado, controlador, conexión,
  selector y Perfil). Una feature DEBE poder importar de la base y, de otra feature, solo lo
  que esa feature expone en su punto de entrada público; la base NO DEBE importar de ninguna
  feature salvo la composición y la navegación, que las conectan. Estas reglas DEBEN quedar
  documentadas en la guía para agentes y verificadas por el lint: un import de una feature
  desde la base (fuera de la composición y la navegación), o de un archivo interno de otra
  feature en lugar de su punto de entrada público, DEBE hacer fallar el lint.
- **FR-010a**: El estado de conexión DEBE definirse en la base como un contrato (servidor
  disponible o no, intento en curso, reintentos automáticos restantes, "reintentar ahora" y
  dirección del servidor) con su `useConexion()`; la feature `sesion` lo implementa y lo provee
  en el layout raíz. La pieza de cuatro estados y la franja de servidor no disponible son de la
  base y solo dependen de ese contrato, nunca de la feature `sesion`.

**Piezas base de pantalla (US2)**

- **FR-011**: DEBE existir un **tema** único con los colores, espaciados y tamaños de texto de
  la app, que reemplace al objeto de colores actual; los componentes DEBEN tomar de ahí sus
  valores en lugar de repetirlos.
- **FR-012**: DEBE existir un **botón base** accesible (rol de botón, estado deshabilitado y
  "en curso" anunciados) con las variantes que usan las pantallas actuales; el estilo de botón
  duplicado entre el mensaje de error, Perfil y la franja DEBE desaparecer.
- **FR-013**: DEBE existir una pieza de **cuatro estados** que, dada una consulta, muestre
  cargando, error, vacío o datos según US2, clasificando el error en "servidor no disponible"
  (reintento de la secuencia única) o error del servidor (reintento de esa consulta).
- **FR-014**: El selector de usuario DEBE migrarse a la pieza de cuatro estados y al botón
  base sin cambiar lo que muestra.
- **FR-015**: Los textos derivados de los datos de un usuario (nombre completo, cantidad de
  eventos organizados) DEBEN calcularse con funciones de formato puras de la feature, con sus
  tests, y usarse en todas las pantallas que hoy los arman.

**Acceso al servidor (US3)**

- **FR-016**: El acceso al servidor DEBE ofrecer pedidos con los métodos GET, POST, PUT, PATCH
  y DELETE, con cuerpo opcional, cancelación y usuario explícito por pedido como hoy.
- **FR-017**: Un pedido con cuerpo DEBE enviarlo como JSON y declararlo en el encabezado de
  tipo de contenido; uno sin cuerpo no envía ese encabezado.
- **FR-018**: Una respuesta exitosa sin contenido (204) DEBE resolverse sin valor.
- **FR-019**: Todo pedido, de cualquier método, DEBE conservar el tiempo límite, la traducción
  de errores (`ErrorDeApi`, `ServidorNoDisponibleError`) y el manejo del 401
  `USUARIO_NO_IDENTIFICADO` de la 002.
- **FR-020**: Los pedidos de escritura NO DEBEN repetirse automáticamente (ni por el cliente de
  consultas ni por la secuencia de reintentos).

**Documentación y backlog**

- **FR-021**: La guía para agentes (`AGENTS.md`, mapa de `mobile/`) y la skill
  `nueva-pantalla` DEBEN describir la organización nueva, las piezas base y cómo agregar un
  endpoint de escritura.
- **FR-022**: El backlog DEBE registrar esta feature como 003, renumerar las features
  anteriores 003–011 a 004–012 (con sus dependencias y el grafo) y anotar como deuda técnica
  el store externo de la sesión.

### Key Entities

- **Feature (módulo de dominio)**: carpeta que agrupa todo lo propio de un dominio funcional
  (pantallas, componentes, consultas, formato). Se relaciona con la base compartida y, según
  las reglas de FR-010, con otras features.
- **Base compartida**: acceso al servidor, consultas, composición de dependencias, navegación y
  componentes genéricos. No depende de ninguna feature, salvo la composición y la navegación,
  que son las que las conectan (FR-010).
- **Tema**: valores visuales con nombre (colores, espaciados, tamaños de texto).
- **Pedido**: método, ruta, cuerpo opcional, cancelación y usuario; su resultado es un valor,
  ningún valor (sin contenido) o un error tipado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de los tests existentes de la app pasan después del refactor, y
  `npm test`, `npm run lint`, `npm run typecheck` y `npm run format:check` pasan en local y en
  el CI.
- **SC-002**: Los recorridos de la 002 (quickstart de la 002) se repiten en el celular con el
  mismo resultado que antes del refactor, sin diferencias visibles.
- **SC-003**: El 100 % de los archivos de navegación tienen a lo sumo una sentencia propia
  (exponer una pantalla o layout), y ninguno define estilos.
- **SC-004**: Cero dependencias circulares entre módulos de la app; un ciclo, un import de una
  feature desde la base o un import interno entre features introducidos a propósito hacen
  fallar el lint, y una ruta mal escrita a propósito hace fallar la
  verificación de tipos en el CI.
- **SC-005**: El selector de usuario dedica a sus cuatro estados una sola pieza reutilizable
  en lugar de un bloque propio de ramas, y no queda ningún estilo de botón repetido entre
  componentes.
- **SC-006**: Agregar la función de un endpoint de escritura requiere una sola función de
  pocas líneas (método, ruta y cuerpo) en el archivo de su recurso, sin tocar el cliente HTTP.

## Assumptions

- Los tests de la app se reorganizan reflejando la estructura nueva (features y base), con los
  mismos helpers de la 002 (`renderConDependencias`, `crearFetchFalso`).
- Las variantes del botón base son las que usan las pantallas actuales; las features siguientes
  agregan variantes cuando las necesiten (constitución IX, YAGNI).
- El tema no incluye modo oscuro: la app sigue configurada en modo claro.
- La deuda técnica del store externo de la sesión no bloquea ninguna feature del backlog: las
  features 004–012 solo consumen los hooks públicos de la sesión.
- Las specs anteriores (001, 002) no se reescriben: sus referencias a "features 003 en
  adelante" quedan como registro histórico.
- Si para cortar ciclos o tipar rutas hace falta una dependencia de desarrollo nueva o un paso
  previo a la verificación de tipos en el CI, se justifica en el plan.
