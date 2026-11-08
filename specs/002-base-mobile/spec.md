# Feature Specification: Base mobile

**Feature Branch**: `feature/002-base-mobile`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "Base mobile (002): app Expo con Expo Router en el workspace mobile/ del monorepo, ejecutada en el celular con Expo Go. Navegación base con pestañas vacías (Explorar, Mis compras, Mis eventos, Perfil). Cliente HTTP tipado en mobile/src/api/ con los tipos de @ai-ticket-it/shared, traducción del formato ErrorApi y envío de X-Usuario-Id. Selector de usuario sobre GET /api/usuarios que recuerda la elección entre reinicios de la app y la valida con GET /api/usuarios/actual; si el servidor no responde se conserva el usuario recordado, y solo se descarta si el servidor responde que no existe. Desde Perfil se puede cambiar de usuario. Dirección del servidor tomada del host de Expo, con EXPO_PUBLIC_API_URL para cambiarla, y estado visible de \"servidor no disponible\". mobile/ se integra a npm test, lint, typecheck, format:check y al CI. Sin funcionalidad de negocio."

**Casos de uso**: ninguno directo (P0, habilita las pantallas de todas las features siguientes).

> El stack de la app (framework, navegación, librerías de test) ya está fijado por la
> constitución (principio VII y "Stack y Restricciones Técnicas"). Esta spec describe **qué**
> debe ofrecer la base de la app y **por qué**; el **cómo** queda para el plan. Los endpoints
> que consume ya existen y están documentados en `specs/001-base-backend/contracts/api.md`.

## Alcance

**Incluye**: el paquete de la app dentro del monorepo, ejecutable en un celular físico contra
el servidor local; la navegación principal con cuatro secciones vacías; el acceso al servidor
centralizado (identificación del usuario, traducción de errores, tipos compartidos); la
elección, el recuerdo y la validación del usuario actual; el cambio de usuario desde Perfil;
la configuración de la dirección del servidor y el aviso de "servidor no disponible"; y la
integración de la app a los comandos de calidad y al CI.

**No incluye**: contenido de negocio en las secciones (eventos, compras, organización:
features 003 en adelante), endpoints nuevos en el servidor, registro o contraseñas
(constitución, principio VI), cliente web, publicación en tiendas.

## Clarifications

### Session 2026-11-08

- Q: Cuando el servidor no está disponible y ya hay un usuario elegido, ¿dónde y cómo se muestra el aviso de "servidor no disponible"? → A: Una franja fija y no bloqueante arriba de la navegación principal, visible en las cuatro secciones, con la dirección intentada y "Reintentar".
- Q: Cuando aparece la franja de "servidor no disponible", ¿la app vuelve a revalidar sola o solo cuando el usuario toca "Reintentar"? → A: Ambas: "Reintentar" manual y reintento automático con espera exponencial 1, 2, 4, 8, 16 y 32 s (6 intentos); después solo manual. "Reintentar" reintenta en el acto y reinicia la secuencia.
- Q: Cuando todavía no hay usuario elegido y el selector no puede cargar la lista porque el servidor no responde, ¿se aplica el mismo reintento automático o solo "Reintentar"? → A: La misma secuencia automática y "Reintentar" con reinicio, también en el selector (primer arranque y al abrirlo desde Perfil).
- Revisión del checklist `sesion-y-ux` (después del plan):
  - CHK013 → durante el uso, solo un 401 `USUARIO_NO_IDENTIFICADO` aplica la regla de FR-013 (olvidar). Cualquier otro error respondido por el servidor en un pedido que no sea la validación lo muestra la pantalla que hizo el pedido. En esos pedidos, la franja aparece solo por servidor no disponible.
- Revisión de `/speckit-analyze` (después de tasks):
  - I1 → en la **validación del usuario actual**, un error inesperado (por ejemplo, 500) se trata igual que servidor no disponible en todo: conserva al usuario, muestra la franja y, si ocurre en un reintento, cuenta como intento fallido y la secuencia sigue. Un reintento solo es exitoso si la validación confirma al usuario o determina que hay que olvidarlo.
  - A1 → elegir un usuario detiene la secuencia de reintentos y marca el servidor como disponible, porque para elegirlo la lista tuvo que llegar del servidor.
  - U2 → olvidar al usuario es idempotente: si ya se lo olvidó o se eligió otro, no hace nada.
  - CHK014 → si el usuario se conservó sin confirmarlo, Perfil muestra su identificador y un aviso, y pasa a nombre y apellido cuando se confirma.
  - CHK002/CHK008 → hay una única secuencia de reintentos para toda la app. Sigue corriendo aunque el modal del selector tape la franja, y nunca hay dos intentos a la vez entre franja y selector.
  - CHK020 → un 401 con el selector abierto como modal lo convierte en el selector a pantalla completa, sin "Cerrar" y con el aviso de usuario inexistente.
  - CHK022 → el botón "atrás" de Android equivale a "Cerrar" en el modal. Sin usuario elegido, hace lo normal del sistema (sale de la app).
  - CHK026/CHK027 → los avisos se anuncian al lector de pantalla al aparecer, y la marca "Actual" forma parte de la etiqueta accesible de la fila.
- Revisión del checklist `sesion-y-ux` (antes de `/speckit-implement`):
  - CHK018 → al elegir otro usuario desde el selector abierto como modal, la app vuelve a Perfil (`router.back()`) y Perfil muestra al nuevo usuario. Desde el selector a pantalla completa (sin usuario elegido), se entra a Explorar. US3-4 queda ajustado.
  - CHK016 → ante un error inesperado (por ejemplo, 500) en la validación del usuario actual, la franja muestra el mismo texto "Servidor no disponible" (decisión I1); no hay un texto aparte.
  - CHK004 → si falla guardar el usuario recordado al elegir, la app entra igual con el usuario elegido, sin recordarlo, y registra un `console.warn`.
  - CHK005 → no hay pausa manual en segundo plano. Al volver la app a primer plano (`AppState` `active`) con la franja visible, se llama a `reintentarAhora()`.

## User Scenarios & Testing *(mandatory)*

Los actores de esta feature son:

- **Usuario de la app** (quien demuestra el TP en el celular, en el rol de comprador u
  organizador): necesita elegir con qué usuario precargado opera, moverse entre las secciones
  y entender cuándo el servidor no está disponible.
- **Desarrollador** (la persona que hace el TP y los agentes de IA que la asisten): necesita
  abrir la app en el celular con pocos pasos y una base donde cada feature siguiente solo
  agregue sus pantallas y sus llamadas al servidor.

### User Story 1 - Abrir la app en el celular y elegir un usuario (Priority: P1)

Con el servidor corriendo en la computadora, el desarrollador arranca la app desde la raíz del
repositorio y la abre en su celular escaneando el código que se muestra. Sin configurar la
dirección del servidor, la app lo encuentra en la misma computadora desde la que se sirve.
Como es la primera vez, la app muestra la lista de usuarios precargados (nombre, apellido y
cuántos eventos organiza) y, al elegir uno, entra a la navegación principal.

**Why this priority**: sin una app que abra en el celular y sepa quién la usa no se puede
construir ni demostrar ninguna pantalla del backlog; toda llamada que requiere usuario depende
de esta elección.

**Independent Test**: con el servidor y la app corriendo en la computadora, abrir la app en un
celular de la misma red sin configurar nada: aparece la lista de usuarios del servidor; elegir
uno lleva a la navegación principal.

**Acceptance Scenarios**:

1. **Given** el servidor corriendo con los datos de ejemplo y la app abierta por primera vez
   en el celular, **When** la app termina de cargar, **Then** muestra todos los usuarios
   precargados, en el orden que entrega el servidor, con nombre, apellido y cantidad de
   eventos que organiza.
2. **Given** la lista de usuarios, **When** el usuario elige uno, **Then** la app entra a la
   navegación principal y todo pedido posterior que requiera usuario se hace en nombre del
   elegido.
3. **Given** la lista de usuarios cargando, **When** el servidor todavía no respondió,
   **Then** la app muestra un indicador de carga.
4. **Given** la app abierta por primera vez y el servidor detenido, **When** la app intenta
   cargar los usuarios, **Then** muestra el aviso de "servidor no disponible" con la dirección
   a la que intentó conectarse y una acción para reintentar; al levantar el servidor y
   reintentar (o al llegar el siguiente reintento automático), aparece la lista.
5. **Given** el servidor sin usuarios (caso hipotético), **When** la app carga la lista,
   **Then** muestra un mensaje de lista vacía en lugar de una pantalla en blanco.

---

### User Story 2 - Volver a la app con el usuario recordado (Priority: P1)

El usuario cierra la app (o el celular la descarta) y la vuelve a abrir. La app recuerda con
qué usuario estaba operando y entra directo a la navegación principal, después de confirmar con
el servidor que ese usuario sigue existiendo. Si el servidor no responde, conserva igual al
usuario recordado y avisa que el servidor no está disponible; solo lo olvida, y vuelve a pedir
que se elija uno, si el servidor responde que ese usuario no existe (por ejemplo, porque cambió
el seed).

**Why this priority**: durante el desarrollo la app se recarga constantemente; volver a elegir
el usuario en cada recarga haría inviable la demo y el trabajo diario. Y perder la elección por
un corte momentáneo del servidor obligaría a repetirla sin motivo.

**Independent Test**: elegir un usuario, cerrar y reabrir la app: entra directo como ese
usuario. Repetir con el servidor detenido: entra como ese usuario y muestra el aviso de servidor
no disponible. Repetir con un usuario recordado que el servidor no reconoce: vuelve al selector.

**Acceptance Scenarios**:

1. **Given** un usuario elegido previamente, **When** se cierra y se vuelve a abrir la app con
   el servidor disponible, **Then** la app confirma el usuario con el servidor y entra directo
   a la navegación principal como ese usuario, sin mostrar el selector.
2. **Given** un usuario recordado, **When** se abre la app con el servidor detenido o sin
   conexión, **Then** la app entra a la navegación principal como el usuario recordado y
   muestra de forma visible que el servidor no está disponible.
3. **Given** el aviso de servidor no disponible visible, **When** el servidor vuelve a estar
   disponible y el usuario reintenta (o llega el siguiente reintento automático), **Then** la
   app revalida al usuario y el aviso desaparece.
4. **Given** un usuario recordado, **When** el servidor responde que no reconoce a ese usuario,
   **Then** la app lo olvida, muestra el selector e informa que el usuario anterior ya no
   existe.
5. **Given** un usuario recordado, **When** el servidor responde con un error inesperado (no un
   "usuario inexistente"), **Then** la app conserva al usuario recordado y lo trata como
   servidor no disponible.
6. **Given** la validación del usuario recordado en curso, **When** la app arranca, **Then**
   muestra un indicador de carga y no muestra el selector ni datos de otro usuario mientras
   tanto.

---

### User Story 3 - Navegar entre secciones y cambiar de usuario desde Perfil (Priority: P1)

Con un usuario elegido, la app ofrece una navegación principal de cuatro secciones: Explorar,
Mis compras, Mis eventos y Perfil. Las tres primeras todavía no tienen contenido (lo agregan
las features siguientes) y lo dicen. En Perfil se ve con qué usuario se está operando y hay
una acción para cambiarlo, que lleva al selector; al elegir otro, la app pasa a operar en su
nombre. Así se pueden demostrar los dos roles (comprador y organizador) en un mismo celular.

**Why this priority**: es el esqueleto donde cada feature del backlog agrega su pantalla, y el
cambio de usuario es el mecanismo de la constitución para demostrar ambos roles sin
autenticación.

**Independent Test**: con un usuario elegido, recorrer las cuatro secciones; en Perfil
verificar el nombre del usuario actual, cambiar a otro y verificar que Perfil muestra al nuevo
y que, al reabrir la app, se recuerda al nuevo.

**Acceptance Scenarios**:

1. **Given** un usuario elegido, **When** se entra a la navegación principal, **Then** se ven
   las cuatro secciones (Explorar, Mis compras, Mis eventos, Perfil), cada una identificada con
   texto, y se abre Explorar.
2. **Given** la navegación principal, **When** se entra a Explorar, Mis compras o Mis eventos,
   **Then** la sección indica su nombre y que su contenido todavía no está disponible.
3. **Given** la navegación principal, **When** se entra a Perfil, **Then** se ven el nombre y
   el apellido del usuario actual y la acción "Cambiar usuario".
4. **Given** Perfil, **When** se elige "Cambiar usuario" y luego otro usuario, **Then** el
   selector se cierra y la app vuelve a Perfil operando como el nuevo usuario, Perfil lo
   muestra y es el que se recuerda al reabrir la app. (Desde el selector a pantalla completa,
   sin usuario elegido, se entra a Explorar: US1-2.)
5. **Given** el selector abierto desde Perfil, **When** el usuario sale sin elegir otro,
   **Then** la app vuelve a Perfil y sigue operando como el usuario anterior.
6. **Given** el selector abierto desde Perfil, **When** se muestra la lista, **Then** el usuario
   actual aparece marcado como tal.

---

### User Story 4 - Base predecible para hablar con el servidor (Priority: P2)

El desarrollador de una feature siguiente agrega una llamada al servidor en un único lugar de
la app y la usa desde su pantalla, sin ocuparse de la dirección del servidor, de identificar al
usuario ni de interpretar errores: la base ya envía el usuario actual en cada pedido, toma los
tipos de los contratos de la definición compartida con el servidor y convierte toda respuesta
de error en un error de la app con el código y el mensaje en español del servidor, listo para
mostrar. La dirección del servidor se toma automáticamente de la computadora que sirve la app,
y se puede cambiar con una variable de entorno.

**Why this priority**: garantiza que todas las pantallas futuras cumplan el principio VII (sin
llamadas al servidor fuera de su lugar) y muestren mensajes de error útiles, sin reimplementar
nada; no tiene valor visible propio, por eso va después de las historias de uso.

**Independent Test**: con pruebas automatizadas del acceso al servidor (sin servidor real):
verificar que un pedido con usuario actual lleva su identificador; que una respuesta con el
formato de error único se convierte en un error con su código, mensaje y detalles; que una
respuesta de error sin ese formato y una falla de red se distinguen entre sí y de un error del
servidor; y que la dirección se toma de la variable de entorno cuando está definida.

**Acceptance Scenarios**:

1. **Given** un usuario actual, **When** la app hace cualquier pedido al servidor, **Then** el
   pedido lo identifica con el encabezado definido por la constitución.
2. **Given** ningún usuario elegido todavía, **When** la app pide el listado de usuarios,
   **Then** el pedido sale sin identificación de usuario.
3. **Given** una respuesta de error con el formato único (por ejemplo, 409 con un código de
   regla), **When** la recibe la app, **Then** la convierte en un error que expone el estado
   HTTP, el código, el mensaje en español y los detalles por campo, si los hay.
4. **Given** una respuesta de error que no respeta el formato único, **When** la recibe la app,
   **Then** la convierte en un error genérico con un mensaje en español, sin romper la app.
5. **Given** el servidor apagado o inalcanzable (o un pedido que no responde dentro del tiempo
   límite), **When** la app hace un pedido, **Then** obtiene un error de "servidor no
   disponible", distinguible de un error que respondió el servidor.
6. **Given** la variable de entorno de la dirección del servidor definida, **When** arranca la
   app, **Then** usa esa dirección; **Given** que no está definida, **Then** usa la computadora
   desde la que se sirve la app, en el puerto por defecto del servidor.
7. **Given** un tipo de contrato compartido (por ejemplo, la vista de usuario), **When** la app
   lo usa, **Then** lo toma de la definición compartida, y un cambio incompatible en ella rompe
   la verificación de tipos de la app.

---

### User Story 5 - La app entra en los comandos de calidad y en el CI (Priority: P2)

Antes de cerrar una tarea o abrir un PR, el desarrollador corre desde la raíz los comandos de
tests, lint, verificación de tipos y formato, que ahora también recorren la app; el CI los
corre igual en cada PR.

**Why this priority**: la constitución (principios II y IX) exige esos comandos en verde en
todos los paquetes; sin integrarla, la app quedaría fuera del control de calidad desde el
primer día.

**Independent Test**: en un clon limpio con dependencias instaladas, correr los cuatro comandos
desde la raíz y verificar que incluyen la app y terminan en verde; introducir a propósito un
error de tipos, de lint, de formato o un test fallido en la app y verificar que el comando
correspondiente falla, localmente y en el CI.

**Acceptance Scenarios**:

1. **Given** la base de la app recién creada, **When** se ejecutan tests, lint, verificación de
   tipos y formato desde la raíz, **Then** los cuatro terminan sin errores e incluyen la app,
   el servidor y los tipos compartidos.
2. **Given** un PR con un error en la app, **When** corre el CI, **Then** el CI falla.
3. **Given** la instalación desde la raíz, **When** se ejecuta, **Then** instala también las
   dependencias de la app con el mismo único comando.
4. **Given** las pruebas de la app, **When** se ejecutan, **Then** no necesitan un servidor
   corriendo ni un celular, y cada test parte de un estado propio (sin usuario recordado de
   otro test).

---

### Edge Cases

- **El celular no llega a la computadora** (otra red, firewall, aislamiento de clientes en la
  red Wi-Fi) → la app muestra el aviso de servidor no disponible con la dirección que intentó;
  el README explica cómo diagnosticarlo y cómo fijar la dirección a mano.
- **La app se abre con una dirección del servidor que no es la de la computadora** (por
  ejemplo, Expo servido por túnel) → la detección automática no sirve; la variable de entorno
  permite fijarla y el README lo indica.
- **Servidor reiniciado mientras la app está abierta** → los usuarios del seed tienen
  identificadores fijos (feature 001), así que el usuario recordado sigue siendo válido y la
  app sigue funcionando sin volver a elegir.
- **El servidor responde que el usuario recordado no existe mientras la app está en uso** (no
  solo al abrirla) → la app lo olvida y vuelve al selector con el mismo aviso que al abrir. Si
  en ese momento el selector estaba abierto como modal desde Perfil, pasa a ser el selector a
  pantalla completa, sin "Cerrar" y con el aviso.
- **Un pedido durante el uso falla con un error respondido por el servidor** (por ejemplo, 500)
  → lo muestra la pantalla que hizo el pedido, en su estado de error. No es "servidor no
  disponible" y no muestra la franja.
- **Botón "atrás" de Android en el selector** → en el modal abierto desde Perfil, equivale a
  "Cerrar" y conserva al usuario actual. En el selector a pantalla completa (sin usuario
  elegido) no hay pantalla anterior, así que hace lo normal del sistema y sale de la app.
- **El usuario cambia a otro usuario mientras un pedido del anterior está en curso** → la
  respuesta del pedido viejo no debe mostrarse como si fuera del usuario nuevo.
- **Lo guardado en el celular está dañado o tiene un formato viejo** → la app lo descarta y
  muestra el selector, sin cerrarse.
- **Pantallas angostas (360 px)** → las cuatro secciones, el selector y Perfil se leen y se
  usan sin cortes ni desplazamiento horizontal.
- **Doble toque al elegir un usuario** → la elección se registra una sola vez y no deja la
  navegación en un estado inconsistente.

## Requirements *(mandatory)*

### Functional Requirements

**Estructura y ejecución**

- **FR-001**: El monorepo DEBE incluir el paquete de la app móvil, que se instala junto con el
  resto mediante el único comando de instalación de la raíz.
- **FR-002**: La app DEBE poder arrancarse con un comando documentado desde la raíz del
  repositorio y abrirse en un celular físico con la aplicación cliente gratuita de Expo, sin
  compilar una app nativa propia.
- **FR-003**: La versión de la plataforma de la app DEBE ser compatible con la aplicación
  cliente de Expo disponible en las tiendas al momento de implementar, y el README DEBE
  indicar cuál es.

**Dirección del servidor**

- **FR-004**: Si no se configura nada, la app DEBE dirigirse al servidor en la misma
  computadora desde la que se sirve la app, en el puerto por defecto del servidor.
- **FR-005**: La dirección del servidor DEBE poder fijarse con la variable de entorno
  `EXPO_PUBLIC_API_URL`, que tiene prioridad sobre la detección automática; el paquete DEBE
  incluir un archivo de ejemplo de configuración y la configuración real NO DEBE versionarse.

**Acceso al servidor**

- **FR-006**: Todo pedido al servidor DEBE hacerse desde la capa de acceso al servidor de la
  app; las pantallas y componentes NO DEBEN hacer pedidos directamente (constitución,
  principio VII).
- **FR-007**: El acceso al servidor DEBE usar los tipos de contrato de la definición compartida
  con el servidor (vista de usuario, formato de error), sin redefinirlos en la app.
- **FR-008**: Cuando haya un usuario actual, todo pedido DEBE identificarlo con el encabezado
  definido por la constitución; sin usuario actual, el pedido sale sin ese encabezado.
- **FR-009**: Toda respuesta de error DEBE convertirse en un error de la app que exponga el
  estado HTTP, el código, el mensaje en español y los detalles del formato único; una respuesta
  de error sin ese formato DEBE convertirse en un error genérico con mensaje en español.
- **FR-010**: Una falla de conexión o un pedido que supera un tiempo límite DEBE convertirse
  en un error de "servidor no disponible", distinguible de los errores respondidos por el
  servidor. El tiempo límite lo fija el plan.

**Usuario actual**

- **FR-011**: Sin usuario recordado, la app DEBE mostrar el selector con los usuarios que
  entrega el servidor (nombre, apellido y cantidad de eventos que organiza), en el orden en
  que los entrega, y NO DEBE permitir entrar a la navegación principal sin elegir uno.
- **FR-012**: La app DEBE recordar el usuario elegido en el celular, de modo que sobreviva a
  cerrar y reabrir la app.
- **FR-013**: Al abrirse con un usuario recordado, la app DEBE validarlo con la consulta del
  usuario actual del servidor antes de mostrar datos que dependan de él:
  - si el servidor lo confirma, entra a la navegación principal;
  - si el servidor responde que el usuario no está identificado o no existe, lo olvida y
    muestra el selector con un aviso;
  - ante cualquier otra falla (sin conexión, tiempo agotado, error inesperado), conserva al
    usuario recordado, entra a la navegación principal y muestra el aviso de servidor no
    disponible.
- **FR-014**: Si durante el uso cualquier pedido recibe del servidor la respuesta de usuario no
  identificado o inexistente (401 `USUARIO_NO_IDENTIFICADO`), la app DEBE olvidar al usuario y
  mostrar el selector con el aviso de FR-013, aunque el selector estuviera abierto como modal
  (pasa a pantalla completa, sin "Cerrar"). Las otras ramas de FR-013 solo aplican a la
  validación del usuario actual. En los demás pedidos, un servidor no disponible se maneja con la
  franja y la secuencia de FR-021 y FR-021a, y cualquier otro error respondido por el servidor
  lo muestra la pantalla que hizo el pedido, en su estado de error, sin la franja. Olvidar al
  usuario es idempotente: si ya se lo olvidó o se eligió otro, no tiene efecto.
- **FR-015**: Desde Perfil DEBE poder abrirse el selector para elegir otro usuario; al elegir,
  el nuevo pasa a ser el usuario actual y el recordado; al salir sin elegir, se conserva el
  anterior. En el selector, el usuario actual DEBE aparecer marcado. En el modal, el botón
  "atrás" de Android DEBE equivaler a salir sin elegir. En el selector a pantalla completa (sin
  usuario elegido), "atrás" conserva el comportamiento del sistema.
- **FR-016**: Al cambiar de usuario, la app NO DEBE mostrar al nuevo usuario datos obtenidos
  en nombre del anterior.

**Navegación y pantallas**

- **FR-017**: La navegación principal DEBE tener cuatro secciones, en este orden: Explorar, Mis
  compras, Mis eventos y Perfil, cada una identificada con texto (no solo con un ícono), y abrir
  en Explorar.
- **FR-018**: Explorar, Mis compras y Mis eventos DEBEN mostrar su nombre y un mensaje de que
  el contenido todavía no está disponible; no muestran datos de negocio.
- **FR-019**: Perfil DEBE mostrar el nombre y el apellido del usuario actual y la acción
  "Cambiar usuario". Si el usuario se conservó sin poder confirmarlo con el servidor (FR-013),
  Perfil DEBE mostrar su identificador y un aviso de que no se pudieron cargar sus datos. Cuando
  una validación posterior lo confirma, DEBE pasar a mostrar nombre y apellido.
- **FR-020**: El selector DEBE manejar los estados de cargando, error (con acción de
  reintentar), vacío y éxito (constitución, principio VII).
- **FR-021**: Cuando el servidor no está disponible, la app DEBE mostrarlo de forma visible y
  con texto (no solo con color), indicando la dirección a la que intentó conectarse y con una
  acción para reintentar; el aviso DEBE desaparecer cuando un reintento tiene éxito. Con un
  usuario elegido, el aviso es una franja fija y **no bloqueante** arriba de la navegación
  principal, la misma en las cuatro secciones y en toda pantalla que se apile sobre ellas en
  features siguientes (se puede seguir navegando). La única excepción es el selector abierto
  como modal: ahí la franja se oculta para no duplicar el estado de error del selector. Sin
  usuario elegido, el aviso es el estado de error del selector (FR-020). La franja aparece
  cuando la validación del usuario actual no puede confirmarlo ni descartarlo (sin conexión,
  tiempo agotado o error inesperado, FR-013) o cuando cualquier otro pedido falla por servidor
  no disponible (no ante otros errores, FR-014).
- **FR-021a**: Mientras la franja de servidor no disponible está visible, la app DEBE
  reintentar automáticamente la validación del usuario actual con esperas de 1, 2, 4, 8, 16 y
  32 s entre intentos (6 reintentos automáticos) y luego detenerse, quedando solo la acción
  manual. Hay **una única secuencia para toda la app**: no se detiene ni se pausa mientras el
  selector abierto como modal oculta la franja, y al cerrarlo la franja muestra el estado
  vigente. Un reintento de la validación solo es exitoso si confirma al usuario o determina que
  hay que olvidarlo; un error inesperado (por ejemplo, 500) cuenta como fallido y la secuencia
  sigue. Elegir un usuario en el selector detiene la secuencia, porque la lista llegó del
  servidor. Tocar "Reintentar" DEBE reintentar en el acto y reiniciar la secuencia desde 1 s. Un
  reintento exitoso (manual o automático) oculta la franja y cancela los reintentos
  pendientes; no DEBE haber dos reintentos en curso a la vez **en toda la app**: la franja y el
  selector comparten la secuencia, y un intento exitoso oculta los dos avisos y vuelve a pedir
  los datos que habían fallado. Cada reintento aplica la regla
  de FR-013 (si el servidor responde que el usuario no existe, se lo olvida y se va al
  selector). La misma secuencia y el mismo reinicio con "Reintentar" DEBEN aplicarse al estado
  de error del selector cuando no puede cargar la lista de usuarios por servidor no
  disponible (al primer arranque y al abrirlo desde Perfil), reintentando la carga de la lista.
  Si la lista falla con un error respondido por el servidor, no hay reintentos automáticos y
  queda solo "Reintentar".
- **FR-022**: Las pantallas de esta feature DEBEN ser usables en pantallas de 360 px de ancho,
  y los controles sin texto DEBEN tener una etiqueta de accesibilidad. El aviso de servidor no
  disponible y el de usuario inexistente DEBEN anunciarse al lector de pantalla cuando aparecen.
  En el selector, la fila del usuario actual DEBE comunicar esa condición también al lector de
  pantalla (en su etiqueta y como elemento seleccionado), no solo con el texto visible
  "Actual".

**Calidad y CI**

- **FR-023**: Los comandos de tests, lint, verificación de tipos y formato de la raíz DEBEN
  abarcar la app, y el CI DEBE correrlos sobre ella en cada PR.
- **FR-024**: La app DEBE tener pruebas automatizadas de su lógica con comportamiento: la
  conversión de respuestas y fallas en errores, el envío del usuario actual, la elección de la
  dirección del servidor, la regla de validación del usuario recordado (FR-013) y la secuencia
  de reintentos automáticos (FR-021a), además de los
  componentes con comportamiento (selector, aviso de servidor no disponible, Perfil).
- **FR-025**: Las pruebas de la app NO DEBEN depender de un servidor corriendo, de un celular
  ni de un usuario recordado por otra prueba.

**Documentación**

- **FR-026**: El README y `AGENTS.md` DEBEN documentar cómo arrancar la app, abrirla en el
  celular, fijar la dirección del servidor, diagnosticar el aviso de servidor no disponible y
  correr la calidad de la app; `docs/backlog.md` DEBE reflejar el estado de la feature.

### Key Entities *(include if feature involves data)*

- **Usuario** (definido en 001): persona precargada con nombre, apellido y cantidad de eventos
  que organiza. La app lo consume tal como lo entrega el servidor.
- **Usuario actual**: el usuario con el que opera la app en este celular. Se recuerda entre
  aperturas (solo su identificador) y se valida contra el servidor al abrirse.
- **Estado de conexión**: si el servidor está disponible o no, a qué dirección intentó
  conectarse la app y en qué punto de la secuencia de reintentos automáticos está (FR-021a);
  alimenta la franja de "servidor no disponible" y el estado de error del selector.
- **Error de la app**: lo que obtiene una pantalla cuando un pedido falla; distingue "servidor
  no disponible" de un error respondido por el servidor (con estado, código, mensaje en español
  y detalles).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con el servidor corriendo y siguiendo solo el README, una persona abre la app en
  su celular y elige un usuario en menos de 5 minutos, sin configurar la dirección del
  servidor (misma red, sin túnel).
- **SC-002**: Al reabrir la app con un usuario recordado y el servidor disponible, se llega a
  la navegación principal sin pasar por el selector en el 100 % de las aperturas, en menos de
  3 segundos.
- **SC-003**: Al abrir la app con el servidor apagado, en menos de 10 segundos se ve el aviso
  de servidor no disponible (con la dirección intentada) y, si había usuario recordado, se
  conserva en el 100 % de los casos.
- **SC-004**: Cambiar de usuario desde Perfil toma como máximo 3 toques.
- **SC-005**: El 100 % de los casos de la regla de validación del usuario recordado
  (confirmado, inexistente, sin conexión, tiempo agotado, error inesperado) y de la conversión
  de errores (formato único, formato desconocido, falla de red) está cubierto por pruebas
  automatizadas, igual que la secuencia de reintentos automáticos (esperas de 1 a 32 s, corte
  tras el sexto, reinicio con "Reintentar", cancelación al tener éxito), en la franja y en el
  selector, probada con tiempo simulado.
- **SC-006**: Tests, lint, verificación de tipos y formato terminan en verde desde la raíz con
  una sola ejecución de cada comando, incluyendo la app, y las pruebas de la app corren en
  menos de 1 minuto.

## Assumptions

- El stack de la app es el fijado por la constitución; esta spec no lo reabre.
- El celular y la computadora están en la misma red local, y el servidor ya acepta pedidos de
  otros dispositivos de la red (feature 001). El modo túnel de Expo no se usa por defecto; si se
  usa, la dirección del servidor se fija con la variable de entorno.
- Los endpoints que se consumen (listado de usuarios y usuario actual) son los de
  `specs/001-base-backend/contracts/api.md`; esta feature no agrega ni cambia endpoints. "El
  servidor responde que el usuario no existe" corresponde a su respuesta 401
  `USUARIO_NO_IDENTIFICADO` de la consulta del usuario actual.
- Elegir un usuario no es una autenticación: cualquiera con la app puede operar como cualquier
  usuario precargado (constitución, principio VI). Lo recordado es solo el identificador, que
  no es un dato sensible.
- La app no tiene modo sin conexión: con el servidor no disponible solo muestra el aviso y las
  secciones vacías; las features siguientes definen qué muestra cada pantalla ante un error.
- Mis compras y Mis eventos se muestran a todo usuario: el rol se determina por la relación con
  cada recurso, no por un atributo del usuario (constitución, "Roles").
- La app solo se usa en celulares (Android o iOS con Expo Go); no se contempla web.
- No hay internacionalización: todos los textos están en español.
