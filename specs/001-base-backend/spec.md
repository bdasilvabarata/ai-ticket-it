# Feature Specification: Base backend

**Feature Branch**: `feature/001-base-backend`

**Created**: 2026-11-03

**Status**: Draft

**Input**: User description: "001 Base técnica: monorepo con npm workspaces (backend, mobile, shared), backend Express en capas con middlewares y error handler, Mongo en memoria con seed, app Expo con navegación, cliente HTTP y selector de usuario" — **acotada al módulo de back-end** (la base de la app móvil pasa a la feature 002 del backlog).

**Casos de uso**: ninguno directo (P0, habilita a todas las demás features del backlog).

> El stack (gestor de paquetes, frameworks, base de datos, librerías de test) ya está fijado
> por la constitución ("Stack y Restricciones Técnicas"). Esta spec describe **qué** debe
> ofrecer la base del servidor y **por qué**; el **cómo** queda para el plan.

## Alcance

**Incluye**: el paquete del servidor y el de tipos compartidos; arranque con almacenamiento en
memoria y datos de ejemplo; comportamiento transversal (identificación de usuario, validación,
registro de pedidos, 404, error handler); el recurso Usuarios como referencia completa de las
capas; y el modelo de persistencia de Categoria, Evento y TipoEntrada que usa el seed.

**No incluye**: la app móvil (feature 002), endpoints de eventos o categorías (features 003 y
004), compras, mensajes y reseñas.

## Clarifications

### Session 2026-11-03

- Q: Al cargar los datos de ejemplo en una base real, ¿qué pasa con los datos existentes? → A: Se vacían las colecciones que maneja el seed (categorías, usuarios, eventos) y se cargan los datos de ejemplo; el resto de esas colecciones se pierde.
- Q: ¿Con qué código HTTP se responde un cuerpo JSON demasiado grande? → A: 413 con el formato único de error y un código propio (`CUERPO_DEMASIADO_GRANDE`); el límite en bytes lo fija el plan.
- Q: ¿En qué orden se devuelve el listado de usuarios? → A: Alfabético por apellido y luego por nombre.
- Q: ¿La cantidad de eventos que organiza un usuario incluye los ya realizados? → A: Sí, cuenta todos los eventos que organiza, pasados y futuros.

## User Scenarios & Testing *(mandatory)*

Los actores de esta feature son:

- **Desarrollador** (la persona que hace el TP y los agentes de IA que la asisten): necesita un
  servidor que arranque, se pruebe y se verifique con pocos comandos, y una estructura donde
  cada feature siguiente sepa dónde va cada cosa.
- **Consumidor de la API** (la app móvil de la feature 002, o una herramienta como curl o
  Postman durante el desarrollo): necesita un contrato predecible para identificarse, consultar
  datos y entender los errores.

### User Story 1 - Arrancar el servidor con datos de ejemplo (Priority: P1)

Desde un clon limpio del repositorio, el desarrollador instala las dependencias con un único
comando en la raíz y levanta el servidor con otro. Sin instalar ni configurar ninguna base de
datos, el servidor arranca, crea su almacenamiento en memoria y lo carga con datos de ejemplo
(categorías, usuarios y eventos con tipos de entrada), de modo que el sistema es demostrable
desde el primer arranque y accesible desde otro dispositivo de la misma red.

**Why this priority**: sin un servidor que arranque con datos no hay nada sobre qué construir;
todas las features del backlog dependen de esto.

**Independent Test**: en un clon limpio, ejecutar la instalación y el arranque, y consultar el
estado del servicio y el listado de usuarios desde la misma computadora y desde otro
dispositivo de la red: responde y devuelve los usuarios precargados.

**Acceptance Scenarios**:

1. **Given** un clon limpio sin base de datos instalada, **When** el desarrollador instala y
   arranca el servidor sin configurar nada, **Then** el servidor queda escuchando, informa en
   su salida las direcciones donde atiende (local y de red) y que usa almacenamiento en memoria
   con datos de ejemplo.
2. **Given** el servidor recién arrancado, **When** se consulta el estado del servicio,
   **Then** responde que está operativo e indica el tipo de almacenamiento en uso.
3. **Given** el servidor recién arrancado, **When** otro dispositivo de la misma red local
   consulta el estado del servicio usando la dirección de red informada, **Then** recibe la
   respuesta.
4. **Given** el servidor detenido y vuelto a arrancar en memoria, **When** se consultan los
   datos, **Then** se encuentran los mismos datos de ejemplo iniciales, con los mismos
   identificadores, sin duplicados ni restos de la ejecución anterior.
5. **Given** la dirección de una base de datos real configurada, **When** el servidor arranca,
   **Then** se conecta a esa base en lugar de crear una en memoria y no carga datos de ejemplo
   automáticamente.
6. **Given** una base de datos real configurada, **When** el desarrollador ejecuta el comando
   de carga de datos de ejemplo, **Then** las colecciones del seed (categorías, usuarios y
   eventos) quedan con exactamente los datos de ejemplo, descartando lo que tuvieran antes, y
   ejecutarlo de nuevo no genera duplicados.

---

### User Story 2 - Base de servidor predecible para construir features (Priority: P1)

El desarrollador agrega endpoints en las features siguientes sobre una base que ya resuelve lo
transversal: identifica al usuario que hace cada pedido, valida la forma de los datos de
entrada, registra cada pedido, responde a rutas inexistentes y traduce cualquier error a un
formato único. El recurso Usuarios recorre todas las capas y sirve de modelo a copiar, así
cada feature solo escribe su caso de uso.

**Why this priority**: garantiza que todas las features cumplan el contrato de API (principio
V) y la identidad simulada (principio VI) sin reimplementarlos, y le da a la app móvil (002)
los endpoints que necesita para su selector de usuario.

**Independent Test**: con pruebas automatizadas sobre el servidor (sin levantar un puerto):
consultar usuarios, pedir una ruta inexistente, mandar un usuario inválido, mandar un
identificador mal formado, mandar un cuerpo que no es JSON y provocar un error inesperado;
verificar código y formato de cada respuesta.

**Acceptance Scenarios**:

1. **Given** el servidor con datos de ejemplo, **When** se pide el listado de usuarios sin
   indicar usuario, **Then** devuelve todos los usuarios con identificador, nombre, apellido y
   cantidad de eventos que organiza, ordenados alfabéticamente por apellido y luego por nombre.
2. **Given** un usuario existente, **When** se lo pide por su identificador, **Then** devuelve
   su vista con los mismos campos.
3. **Given** un identificador con formato válido que no corresponde a ningún usuario, **When**
   se lo pide, **Then** responde 404 con el formato de error único.
4. **Given** un identificador con formato inválido en la ruta, **When** se lo pide, **Then**
   responde 400 con el formato de error único y un detalle sobre ese parámetro.
5. **Given** un pedido que indica un usuario existente, **When** consulta el usuario actual,
   **Then** devuelve la vista de ese usuario.
6. **Given** un endpoint que requiere usuario, **When** el pedido no indica usuario, o indica
   uno inexistente o mal formado, **Then** responde 401 con el formato de error único.
7. **Given** el servidor, **When** se pide una ruta inexistente bajo la API, **Then** responde
   404 con el formato de error único y un código que identifica "ruta no encontrada".
8. **Given** un pedido cuyo cuerpo no es JSON válido, **When** llega al servidor, **Then**
   responde 400 con el formato de error único.
9. **Given** un error inesperado durante un pedido, **When** el servidor responde, **Then**
   devuelve 500 con el formato de error único y un mensaje genérico, sin trazas ni detalles
   internos; el detalle completo queda solo en el registro del servidor.
10. **Given** cualquier pedido, **When** se completa, **Then** el servidor registra método,
    ruta, código de respuesta y duración.
11. **Given** cualquier recurso devuelto por la API, **When** se inspecciona, **Then** su
    identificador es un campo `id` de tipo texto y no aparecen campos internos de la base.

---

### User Story 3 - Verificar calidad con tres comandos (Priority: P2)

Antes de cerrar una tarea o abrir un PR, el desarrollador corre desde la raíz los comandos de
tests, lint y verificación de tipos, que recorren el servidor y los tipos compartidos y
terminan en verde sobre la base recién creada.

**Why this priority**: la constitución (principios II y IX) exige estos tres comandos en verde
antes de integrar; la base debe dejarlos funcionando para que cada feature los use.

**Independent Test**: en un clon limpio con dependencias instaladas, correr los tres comandos
desde la raíz y comprobar que terminan sin errores; introducir a propósito un error de tipos o
de lint y comprobar que el comando correspondiente falla.

**Acceptance Scenarios**:

1. **Given** la base recién creada, **When** se ejecutan tests, lint y verificación de tipos
   desde la raíz, **Then** los tres terminan sin errores e incluyen el servidor y los tipos
   compartidos.
2. **Given** un tipo compartido (por ejemplo, el estado de una compra), **When** el servidor
   lo usa, **Then** lo toma de la definición compartida y un cambio incompatible en ella rompe
   la verificación de tipos del servidor.
3. **Given** las pruebas automatizadas del servidor, **When** se ejecutan, **Then** cada suite
   usa su propio almacenamiento aislado y no depende de un servidor corriendo ni de los datos
   de otra suite.
4. **Given** las reglas puras del dominio, **When** se prueban, **Then** sus pruebas no
   necesitan base de datos.

---

### Edge Cases

- El puerto configurado ya está en uso → el servidor no arranca y lo informa con un mensaje
  claro (no queda colgado).
- La base de datos real configurada no es accesible → el servidor no arranca y lo informa; no
  cae silenciosamente a la base en memoria.
- Primer arranque sin conexión a internet y sin el motor de base en memoria descargado → el
  servidor termina con un mensaje que explica que falta la descarga inicial.
- El firewall del sistema operativo bloquea el puerto para otros dispositivos → el README
  explica cómo habilitarlo; el servidor sigue respondiendo localmente.
- Encabezado de usuario presente pero vacío → se trata como "sin usuario" (401 donde se
  requiera).
- Un endpoint público recibe un encabezado de usuario inválido → lo ignora y responde
  normalmente (la identificación solo se exige donde se requiere).
- Cuerpo JSON que supera el límite de tamaño → 413 con el formato de error único y el código
  `CUERPO_DEMASIADO_GRANDE` (el límite en bytes lo fija el plan).

## Requirements *(mandatory)*

### Functional Requirements

**Estructura del repositorio**

- **FR-001**: El repositorio DEBE organizarse como monorepo con un paquete de servidor y uno de
  tipos compartidos (la app móvil se suma en la feature 002), que se instalan juntos con un
  único comando desde la raíz.
- **FR-002**: Los comandos de tests, lint y verificación de tipos DEBEN ejecutarse desde la
  raíz y abarcar todos los paquetes existentes.
- **FR-003**: El paquete de tipos compartidos DEBE contener al menos los estados de una compra
  (`PENDIENTE`, `CONFIRMADA`, `UTILIZADA`, `CANCELADA`, `REEMBOLSADA`), el formato único de
  error y la vista de usuario, y el servidor DEBE usarlos desde ahí.
- **FR-004**: El servidor DEBE incluir un archivo de ejemplo de configuración de entorno; la
  configuración real NO DEBE versionarse.

**Arranque y datos**

- **FR-005**: Sin configuración, el servidor DEBE usar almacenamiento en memoria y cargar al
  arrancar los datos de ejemplo.
- **FR-006**: Si se configura la dirección de una base de datos real, el servidor DEBE usarla
  y NO DEBE cargar datos de ejemplo automáticamente.
- **FR-007**: DEBE existir un comando para cargar los datos de ejemplo en la base configurada,
  idempotente: vacía las colecciones que maneja el seed (categorías, usuarios y eventos) y
  carga los datos de ejemplo; todo otro dato de esas colecciones se pierde. El README DEBE
  advertirlo.
- **FR-008**: Los datos de ejemplo DEBEN tener identificadores fijos entre arranques y fechas
  de eventos relativas al día de arranque.
- **FR-009**: Los datos de ejemplo DEBEN incluir como mínimo:
  - al menos 5 categorías;
  - al menos 4 usuarios: al menos 2 que organicen eventos y al menos 1 que no organice ninguno;
  - al menos 8 eventos de distintos organizadores y categorías, cada uno con al menos un tipo
    de entrada con precio y cupo, entre los que haya:
    - al menos 2 eventos ya realizados;
    - al menos 1 evento en las próximas 48 horas;
    - al menos 1 evento con varios tipos de entrada;
    - al menos 1 tipo de entrada con cupo de 3 o menos;
    - precios que difieran en al menos un orden de magnitud entre el más barato y el más caro.
- **FR-010**: El servidor DEBE atender pedidos tanto locales como de otros dispositivos de la
  red local, y DEBE informar al arrancar sus direcciones local y de red y el tipo de
  almacenamiento en uso.
- **FR-011**: Si no puede arrancar (puerto ocupado, base inaccesible, motor en memoria no
  disponible), el servidor DEBE terminar con un mensaje claro y un código de salida de error.
- **FR-012**: La base DEBE dejar definido el modelo de persistencia de Categoria, Evento y
  TipoEntrada usado por los datos de ejemplo; las features de eventos agregan casos de uso
  sobre ese modelo sin redefinirlo.

**Endpoints**

- **FR-013**: El servidor DEBE exponer un endpoint de estado del servicio, público, que
  informe que está operativo y el tipo de almacenamiento.
- **FR-014**: El servidor DEBE exponer, sin requerir usuario, el listado de usuarios y la
  consulta de un usuario por identificador, con identificador, nombre, apellido y cantidad de
  eventos que organiza (todos, pasados y futuros). El listado DEBE devolverse ordenado
  alfabéticamente por apellido y luego por nombre.
- **FR-015**: El servidor DEBE exponer la consulta del usuario actual, que requiere usuario.

**Comportamiento transversal**

- **FR-016**: El servidor DEBE identificar al usuario de cada pedido mediante el identificador
  enviado en el encabezado definido por la constitución, y los endpoints que lo requieran DEBEN
  rechazar con 401 los pedidos sin usuario o con un usuario inexistente o mal formado.
- **FR-017**: El servidor DEBE validar la forma de los datos de entrada (cuerpo, parámetros de
  ruta y consulta) contra un esquema declarado por endpoint, y rechazar con 400 indicando cada
  campo inválido. Un identificador mal formado en la ruta es entrada inválida (400); uno bien
  formado e inexistente es recurso inexistente (404).
- **FR-018**: Todos los errores DEBEN responderse con el formato único de la constitución
  (`codigo`, `mensaje` en español y `detalles` opcionales) y los códigos HTTP que esta define,
  incluido un cuerpo que no es JSON válido (400). Como refinamiento del contrato, un cuerpo
  que supera el límite de tamaño responde 413 con el código `CUERPO_DEMASIADO_GRANDE`.
- **FR-019**: Los errores inesperados DEBEN responder 500 sin exponer trazas ni detalles
  internos, y registrarse completos en el servidor.
- **FR-020**: Las rutas inexistentes bajo la API DEBEN responder 404 con el formato único.
- **FR-021**: El servidor DEBE registrar cada pedido con método, ruta, código de respuesta y
  duración; durante las pruebas automatizadas ese registro no debe ensuciar la salida.
- **FR-022**: Los recursos expuestos DEBEN identificarse con un campo `id` de texto y NO DEBEN
  exponer campos internos de la base de datos.
- **FR-023**: El recurso Usuarios DEBE recorrer todas las capas de la constitución (principio
  III) para servir de referencia a las features siguientes.

**Documentación**

- **FR-024**: El README y `AGENTS.md` DEBEN documentar los requisitos previos, cómo instalar,
  arrancar el servidor (en memoria y con base real), cargar los datos de ejemplo, consultarlo
  desde otro dispositivo (incluido el firewall) y correr tests, lint y verificación de tipos.
- **FR-025**: Los endpoints de esta feature DEBEN quedar documentados en
  `specs/001-base-backend/contracts/`.

### Key Entities *(include if feature involves data)*

- **Usuario**: persona que usa el sistema; nombre, apellido y eventos favoritos (vacío en el
  seed). Es comprador u organizador según su relación con cada recurso; su vista expone cuántos
  eventos organiza, contando todos (pasados y futuros).
- **Categoria**: catálogo precargado de tipos de evento; nombre y descripción.
- **Evento**: lo publica un usuario (organizador); nombre, descripción, categoría, fecha y
  hora, multimedia (direcciones de imágenes) y uno o más tipos de entrada. En esta feature solo
  se persiste para el seed; sus endpoints llegan en las features 003 y 004.
- **TipoEntrada**: parte de un evento; nombre, descripción, precio y cupo.
- **Error de API**: respuesta de error con código legible por máquina, mensaje en español y
  detalles opcionales (por ejemplo, un detalle por campo inválido).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde un clon limpio, con los requisitos previos documentados y el motor en
  memoria ya descargado, una persona deja el servidor funcionando con datos de ejemplo en menos
  de 5 minutos ejecutando no más de 2 comandos.
- **SC-002**: Un dispositivo de la misma red obtiene respuesta del servidor siguiendo solo el
  README.
- **SC-003**: El 100 % de los casos de error definidos (ruta inexistente, usuario ausente o
  inválido, identificador mal formado, recurso inexistente, entrada inválida, cuerpo mal
  formado, cuerpo demasiado grande, error inesperado) responde con el formato único y el
  código correspondiente, verificado por pruebas automatizadas.
- **SC-004**: Tests, lint y verificación de tipos terminan en verde desde la raíz con una sola
  ejecución de cada comando, y las pruebas del servidor corren en menos de 1 minuto.
- **SC-005**: Reiniciar el servidor en memoria 3 veces seguidas deja siempre exactamente los
  mismos datos de ejemplo con los mismos identificadores.

## Assumptions

- El stack es el fijado por la constitución; esta spec no lo reabre.
- La primera ejecución descarga el motor de base de datos en memoria (requiere internet una
  vez); el README lo indica como paso de preparación.
- El seed de esta feature carga solo categorías, usuarios y eventos con tipos de entrada. Las
  compras, mensajes y reseñas de ejemplo los agrega cada feature que introduce esas entidades,
  extendiendo el mismo seed.
- El servidor no se expone a internet: solo a la red local.
- La app móvil consume la API como cliente nativo; no se contempla un cliente web, por lo que
  no se requiere configuración de orígenes cruzados.
- El endpoint de estado y los de usuarios son públicos porque se usan antes de elegir usuario;
  cualquier endpoint futuro requiere usuario salvo que su spec diga lo contrario.
- No hay internacionalización: todos los mensajes están en español.
