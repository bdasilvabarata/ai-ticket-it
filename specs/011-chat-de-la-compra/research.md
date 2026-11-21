# Research: Chat de la compra (011)

Decisiones de diseño de la feature. Cada una con su motivo y las alternativas que se descartaron.
Las referencias `FR-`, `US` y `SC-` son de [spec.md](./spec.md).

## R1 — `Mensaje` vive dentro del agregado `Compra`

**Decisión**:
- `domain/mensaje.ts` define la clase `Mensaje` (`autorId`, `texto`, `enviadoEn`), que protege sus
  invariantes al construirse. Es inmutable y no tiene id propio, como `Entrada`. `compra.ts` la
  re-exporta.
- `PropiedadesCompra` suma `mensajes?: readonly Mensaje[]`, en orden de envío. Si no viene, es
  `[]`.
- `Compra.mensajes` es `readonly Mensaje[]` y `Compra.registrar` arranca sin mensajes.
- `Compra.enviarMensaje(autorId, texto, ahora)` devuelve una `Compra` nueva con el mensaje al
  final, fechado en `ahora`. No cambia el estado, el historial, las entradas ni el total
  (FR-009).
- Todas las transiciones (`pagar`, `cancelar`, `vencer`, `registrarUso`, `confirmarReembolso`)
  conservan los mensajes porque arman la compra nueva con `#propiedades()`, que ahora los
  incluye. Hay un test por transición, porque olvidarse de esto borra la conversación al pagar
  o al vencer.
- `REGLAS_DE_COMPRA` (010) suma la regla `mensajes-en-orden` (campo `mensajes`): las fechas de
  envío no decrecen y ninguna es anterior al alta (`creadaEn`). Con eso, "orden de envío" (FR-003)
  y orden de las fechas coinciden, y el arreglo se puede mostrar tal como está.

**Por qué**: es lo que dicen la constitución ("Entidades": la compra tiene sus **Mensajes**) y la
consigna (`Compra.mensajes[]`, `Mensaje: usuario, mensaje, enviado`). Cualquier cambio de la compra
pasa por su único dueño, `CompraService`. `mensajes` es opcional en `PropiedadesCompra` porque hay
decenas de `new Compra({...})` en los tests y el seed que no tienen por qué cambiar; dentro de la
entidad, en cambio, siempre es un arreglo.

**Alternativas descartadas**:
- Un agregado `Mensaje` con su `RepositorioMensajes`. Le agrega un repositorio, un seed y una
  segunda escritura, y deja de garantizar que el autor pertenece a esa compra. La constitución lo
  pone dentro de la compra.
- Un id por mensaje que dé el repositorio. Nadie busca un mensaje por id, porque no se editan ni
  se borran. Para la clave de la lista de la app alcanza con la posición (R6).

## R2 — Quién es parte de la compra, y en qué orden se rechaza

**Decisión**:
- `Compra.rolDe(usuarioId, organizadorId): RolEnLaCompra | null` es una función pura:
  `"comprador"` si es su `compradorId`, `"organizador"` si es el `organizadorId` del evento y, si
  no, `null`. Nunca es las dos cosas, porque nadie compra entradas de su propio evento (006).
- `CompraService` lanza `SinPermisoError` ("Solo el comprador y el organizador del evento pueden
  ver y escribir en el chat de esta compra.") cuando `rolDe` da `null`. Es el 403 de FR-006.
- El dominio no repite el chequeo en `enviarMensaje`, porque no puede lanzar un 403 (`domain/` no
  importa `errors/`).
- Orden de los rechazos (FR-008):
  1. 401 `USUARIO_NO_IDENTIFICADO`, del middleware.
  2. 400 `ENTRADA_INVALIDA` por la forma: `params.compraId` y, en el `POST`, `body.texto`. Lo
     resuelve la validación antes de llegar al service.
  3. 404 `COMPRA_NO_ENCONTRADA`.
  4. 403 `SIN_PERMISO`.
- No hay ningún 409: el chat no depende del estado de la compra ni de la fecha del evento (FR-007).

**Por qué**: el rol se determina por la relación con el recurso (constitución, "Roles"). Con
`rolDe` en el dominio, la regla queda escrita una sola vez y la usan tanto el 403 como el rol que
muestra la vista (R6).

**Alternativa descartada**: usar `obtenerDelOrganizador` o `exigirQueEsSuya`. Cada uno deja
afuera a una de las dos partes.

## R3 — Validación del texto

**Decisión**:
- `shared/src/mensaje.ts` exporta `LIMITES_MENSAJE = { largoMaximo: 500 }` (clarify).
- El cuerpo del `POST` se valida con `textoObligatorio(LIMITES_MENSAJE.largoMaximo)` de
  `validations/comunes.ts`, que ya recorta y responde "Es obligatorio." o "Debe tener como máximo
  500 caracteres.". El detalle llega en `body.texto`. Las claves desconocidas (`autorId`,
  `enviadoEn`…) se descartan: el autor sale de `X-Usuario-Id` y la fecha, del reloj (FR-002).
- El constructor de `Mensaje` vuelve a exigir lo mismo como invariante (texto ya recortado, entre
  1 y 500 caracteres, autor no vacío y fecha válida), igual que las otras entidades.
- El largo se cuenta como lo cuenta `String.length` (unidades UTF-16): un emoji puede contar 2.

**Por qué**: toda entrada se valida en el servidor (principio V) y `textoObligatorio` ya existe
para eso. La app no valida por su cuenta: muestra el 400 junto al campo (R11).

## R4 — Enviar: bajo el cerrojo del evento, con un solo `guardar`

**Decisión**: `CompraService.enviarMensaje(compraId, usuarioId, { texto })`.
1. Fuera del cerrojo, `obtenerOFallar(compraId)` (404), solo para saber qué cerrojo tomar: el
   `eventoId` de una compra no cambia (igual que en `pagar`).
2. `cerrojo.ejecutar(eventoId, …)`. Adentro:
   1. Lee `ahora` del reloj.
   2. `eventoService.obtenerOFallar(eventoId)`.
   3. Relee la compra.
   4. Verifica `rolDe`; si da `null`, 403.
   5. `eventoService.obtenerAlDia(eventoId, ahora)`, que materializa los vencimientos del evento
      (también el de esta compra, si era una `PENDIENTE` vencida) y devuelve el cupo (006).
   6. Relee la compra, que ya está al día.
   7. `compra.enviarMensaje(usuarioId, texto, ahora)`.
   8. Hace **un** `compras.guardar`.
   9. Responde `201` con la `MensajeVista` del mensaje nuevo (R6). El autor se lo pide a
      `UsuarioService.obtenerOFallar`.
- El cupo no cambia por el mensaje. Si hubo pendientes vencidas en el evento (esta u otras), lo
  cambia la materialización,
  que hace lo mismo que cualquier otra escritura del evento.

**Por qué**:
- `guardar` reemplaza la instancia entera de la compra (las entidades son inmutables). Si un
  mensaje se arma afuera del cerrojo sobre una compra leída antes de un pago, al guardarse pisa el
  pago, y al revés. Bajo el cerrojo del evento, que es el mismo que usan el pago, la cancelación,
  el uso y el reembolso, nunca se pierde ninguno de los dos efectos (US4, escenarios 3 y 4;
  SC-005). Es la regla "Operaciones atómicas por evento".
- Se materializa **después** del 403 por lo mismo que hace `obtenerDelOrganizador`: un pedido sin
  permiso no cambia nada.
- Guardar `compra.alDia(ahora)` sin pasar por `obtenerAlDia` dejaría una compra `CANCELADA` sin
  haber devuelto su cupo al evento. Por eso la materialización la hace el dueño del vencimiento.
- Releer la compra dos veces dentro del cerrojo cuesta dos lecturas de un `Map` y mantiene cada
  paso en su dueño.

**Alternativa descartada**: verificar las partes afuera del cerrojo porque `compradorId` y
`organizadorId` no cambian. Es correcto, pero se aparta de la regla 1 del cerrojo ("adentro se
vuelve a leer lo que se verifica"), y el ahorro no se nota.

## R5 — Leer: sin cerrojo, al día y con tres lecturas fijas

**Decisión**: `CompraService.chat(compraId, usuarioId)`.
1. Lee `ahora`.
2. `obtenerOFallar(compraId)` (404).
3. `eventoService.obtenerOFallar(compra.eventoId)`.
4. `rolDe`; si da `null`, 403.
5. `usuarioService.obtenerPorIds([compradorId, organizadorId])`: un solo lote para los autores y
   la otra parte.
6. Arma la vista con `compra.alDia(ahora)`, sin guardar nada (FR-011).

Son siempre tres lecturas, haya cero o cien mensajes. No toma el cerrojo, como todas las
lecturas.

**Por qué**: el encabezado muestra el estado al día, por ejemplo una pendiente vencida que se ve
"Cancelada" (clarify). El evento se lee como está guardado, sin el cupo al día, porque la vista no
muestra cupo (como `obtenerPorIds` de la 007).

## R6 — Vistas: `ChatDeLaCompraVista` y `MensajeVista`

**Decisión** (los tipos van en `shared/src/mensaje.ts`; el detalle, en
[data-model.md](./data-model.md)):
- `GET` responde `ChatDeLaCompraVista`, con tres partes:
  - `compra`: `id`, `evento { id, nombre }`, `tipoEntrada { id, nombre }`, `cantidad` y `estado`
    al día. Es el encabezado del clarify.
  - `otraParte`: la parte que no es el usuario que pide, con `id`, `nombre`, `apellido` y `rol`.
  - `mensajes`: un arreglo de `MensajeVista`.
- `POST` responde `201 MensajeVista`, el mensaje creado (FR-012).
- `MensajeVista` tiene:
  - `numero`: la posición del mensaje, de 1 a n, que se deriva y no se guarda.
  - `autor`: `{ id, nombre, apellido, rol }`, el mismo tipo `ParteDeLaCompraVista`.
  - `texto`.
  - `enviadoEn`: instante ISO UTC.
  - `enviadoEnLocal`: `"YYYY-MM-DDTHH:mm"`, hora de pared de Buenos Aires, con
    `horaDeBuenosAires`.
- El `rol` de cada autor sale de `compra.rolDe(autorId, evento.organizadorId)`.
- Ninguna de las dos vistas trae códigos de entradas, historial, total ni datos del comprador
  fuera de su nombre (FR-013). El organizador ya ve el nombre del comprador en "Compras del
  evento".
- Las funciones `aChatDeLaCompraVista` y `aMensajeVista` van en un archivo nuevo,
  `services/mensaje.vistas.ts`, que reusa `aTipoDeLaCompra` de `compra.vistas.ts` (se exporta).

**Por qué**:
- La pantalla se dibuja solo con esta respuesta, porque el organizador no puede pedir
  `GET /compras/:id` (FR-016). Por eso la respuesta trae el encabezado.
- `numero` alcanza como clave de la lista: los mensajes solo se agregan al final.
- `enviadoEnLocal` sigue el patrón de `creadaEnLocal` y `usadaEnLocal`: la app no convierte zonas
  (clarify: formato "vie 20 nov 2026 · 14:35").

**Alternativas descartadas**:
- Que el `POST` devuelva el chat entero: la app igual vuelve a pedirlo (R10) y un `201` con el
  recurso creado es lo esperable.
- Un campo `propio` en cada mensaje: la app ya conoce al usuario actual y lo compara con
  `autor.id`; además, la vista quedaría distinta según quién la pide.

## R7 — Dónde va el código del backend

**Decisión**:
- `CompraService` suma `chat` y `enviarMensaje`. Sigue siendo el único service de casos de uso
  que guarda compras.
- `CompraController` suma `chat` y `enviarMensaje`.
- `compras.routes.ts` suma `GET /:compraId/mensajes` y `POST /:compraId/mensajes`.
- `compra.validation.ts` suma `mensajeNuevo`: `params.compraId` y `body.texto`.
- No hay service, controller ni router nuevos, y `app.ts` no cambia: `CompraService` ya recibe
  `EventoService`, `UsuarioService`, el cerrojo y el reloj.

**Por qué**:
- El mensaje es parte del agregado `Compra` y su dueño es `CompraService`.
- Un `MensajeService` que delegue la escritura, como `EntradaService` en la 010, sumaría una
  clase y su cableado sin aportar nada: la lectura también necesita la compra, el evento y los
  usuarios, que `CompraService` ya tiene.
- El sub-recurso `mensajes` sigue el patrón de `pago`, `cancelacion` y `reembolso` en
  `compras.routes.ts`. La ruta es el ejemplo de la constitución (principio V).

## R8 — Datos de ejemplo

**Decisión**: la compra `compra-martin-festival-vip` (Martín compra, Lucía organiza, `CONFIRMADA`)
suma tres mensajes, fechados entre la confirmación (alta + 5 min) y el arranque:

| # | Autor | Cuándo | Texto |
|---|---|---|---|
| 1 | Martín | alta + 10 min | "Hola, ¿la entrada VIP incluye estacionamiento?" |
| 2 | Lucía | alta + 2 h | "¡Hola, Martín! Sí: con la entrada VIP tenés lugar en el estacionamiento del predio. Mostrá tu código en la barrera." |
| 3 | Martín | alta + 3 h | "¡Genial, gracias!" |

Las demás compras del seed quedan sin mensajes, y en la demo muestran "Todavía no hay mensajes".

**Por qué**: es la compra que ya usan las demos de 007 y 009 en un evento futuro de Lucía, así que
Martín y Lucía la pueden abrir desde "Tu compra" y desde "Compras del evento". Que los mensajes
sean anteriores al arranque mantiene la conversación estable entre arranques y ninguna regla
depende de la hora del reloj. Cancelarla en la demo de la 009 no afecta al chat, que sigue abierto.

## R9 — La app: pantalla, ruta y accesos

**Decisión**:
- **Dónde vive**: en la feature `compras`, la misma de "Tu compra" y "Compras del evento". El chat
  es de la compra y usa `useEnvioUnico` y `useRefrescarAlFocalizar`, que ya están ahí.
- **Piezas**: la pantalla `pantallas/ChatDeLaCompra.tsx` y los componentes
  `componentes/EncabezadoDelChat.tsx` y `componentes/MensajeDelChat.tsx`.
- **Ruta**: `app/compras/[compraId]/chat.tsx`. Para que conviva con "Tu compra",
  `app/compras/[compraId].tsx` pasa a `app/compras/[compraId]/index.tsx`, como
  `explorar/[eventoId]/index`. El `href` `/compras/[compraId]` no cambia.
- **Navegación**: en `LayoutRaiz`, `Stack.Screen name="compras/[compraId]/index"` sigue con
  "Tu compra" y se suma `compras/[compraId]/chat` con "Chat de la compra", dentro del
  `Stack.Protected` de `con-usuario`.
- **Acceso del comprador**: en "Tu compra", en cualquier estado y debajo del resumen, un
  `Boton variante="aviso"` "Chat con el organizador" que hace
  `router.push({ pathname: "/compras/[compraId]/chat", … })`.
- **Acceso del organizador**: en `FilaCompraDelEvento`, un `Boton variante="texto"` "Abrir chat"
  con `accessibilityLabel` "Abrir el chat con <comprador>". Va como **hermano** del bloque
  accesible de la fila, igual que "Confirmar reembolso", y aparece en todas las filas y estados,
  también con el evento realizado (FR-015).
- `tests/tipos/rutas-tipadas.ts` suma un `@ts-expect-error` para `/compras/[compraId]/chat` sin
  el parámetro.

**Por qué**: una sola pantalla sirve a las dos partes, porque se dibuja solo con la respuesta del
chat. Con la ruta bajo `compras/[compraId]`, la URL dice de qué compra es el chat.

**Alternativa descartada**: una feature `chat/` propia. Tendría que importar `compras` por su
`index.ts` solo para dos hooks, y el chat no tiene vida fuera de una compra.

## R10 — Clave de consulta e invalidaciones

**Decisión**:
- **Clave**: `claves.chatDeLaCompra(usuarioId, compraId)` → `["chat-de-la-compra", usuarioId,
  compraId]`, con el usuario en la posición 1 (FR-020). No comparte prefijo con `["compra"]`.
- **Hook**: `useChatDeLaCompra(usuarioId, compraId)`.
- **Mutation**: `useEnviarMensaje(usuarioId, compraId)` va en nombre del usuario de la pantalla y
  no se reintenta. En `onSettled` (con éxito o con error) invalida **solo el chat de esa compra**,
  pero para todos los usuarios: el predicado es `queryKey[0] === "chat-de-la-compra" &&
  queryKey[2] === compraId` (FR-019).
- **Las otras mutations de la compra**: `usePagarCompra`, `useCancelarCompra`, `useRegistrarUso`
  y `useConfirmarReembolso` suman la invalidación de `["chat-de-la-compra"]` por prefijo, porque
  cambian el estado que muestra el encabezado.

**Por qué**:
- El `QueryClient` tiene `staleTime` de 30 s. En la demo, el comprador y el organizador alternan en
  el mismo celular: sin invalidar la caché del otro usuario, quien vuelve al chat antes de 30 s ve
  la conversación sin el último mensaje. Es el mismo criterio de las invalidaciones por prefijo de
  la 008 y la 009.
- Invalidar el chat en las otras mutations no es "otra vista que cambia por enviar": el mensaje no
  toca nada más. Es al revés: un cambio de estado afecta al encabezado del chat.

## R11 — La pantalla "Chat de la compra"

**Decisión**:
- **Estados**: los cuatro, con `SegunConsulta` y `useChatDeLaCompra`.
  - Un 403 muestra "No tenés permiso para ver este chat." y un 404, "No encontramos esta compra."
    con "Ir a Explorar", como "Tu compra".
  - Con datos: el encabezado (`EncabezadoDelChat`: evento, la otra parte, tipo · cantidad y
    `EtiquetaEstadoCompra`), la lista y el campo.
  - Sin mensajes, en lugar de la lista, el texto "Todavía no hay mensajes": el encabezado y el
    campo siguen a la vista (FR-016). Por eso el vacío no lo resuelve `SegunConsulta` (los datos
    nunca están vacíos), sino la pantalla.
- **Desplazamiento**: `PantallaDesplazable` suma la prop opcional `empezarAlFinal`. Con ella
  activa, al cambiar el tamaño del contenido desplaza hasta el final sin animación
  (`scrollToEnd`), así la pantalla abre mostrando los mensajes más recientes y el campo (US4,
  escenario 1). El campo va al final del contenido, y el teclado no lo tapa por el comportamiento
  que el componente ya tiene.
- **Campo**: `CampoDeTexto` de `eventos` (multilínea, etiqueta "Mensaje") y debajo `Boton`
  "Enviar" ("Enviando…" mientras está en curso).
  - Sin `maxLength` y sin deshabilitar "Enviar" con el campo vacío, porque la app no valida.
  - Envía con `useEnvioUnico` (un toque doble manda un solo pedido).
  - Con éxito, vacía el campo.
  - Ante un 400, muestra el detalle `body.texto` debajo del campo y conserva el texto.
  - Ante otro `ErrorDeApi`, muestra su mensaje con `AvisoDeFormulario`.
  - Sin servidor, muestra "No se pudo enviar. Probá de nuevo." (la franja global avisa igual).
- **Refresco**: `useRefrescarAlFocalizar(consulta.refetch)` vuelve a pedir el chat al volver a la
  pantalla (FR-019). No hay sondeo periódico.

**Por qué**: lo pide la spec (FR-016 a FR-021). Además, se reusan piezas que ya probó la app:
`PantallaDesplazable` para el teclado, `CampoDeTexto` y `AvisoDeFormulario` para los errores del
servidor, y `useEnvioUnico`.

**Alternativa descartada**: una `FlatList` invertida con el campo fijo abajo. Es la solución
típica de los chats largos, pero el teclado habría que manejarlo aparte de `PantallaDesplazable` y
las conversaciones del TP son cortas (spec, "Assumptions").

## R12 — Textos y accesibilidad

**Decisión** (en `features/compras/formato.ts`, cada función con su test):
- `textoRolEnLaCompra(rol)`: "Comprador" u "Organizador".
- `textoAutorDelMensaje(mensaje, usuarioId)`: "Vos" si el mensaje es propio y, si no, "Nombre
  Apellido".
- `textoOtraParte(parte)`: "Con Lucía Álvarez · Organizador".
- La hora sale de `textoFechaHora(enviadoEnLocal)` de `eventos`: "vie 20 nov 2026 · 14:35".
- `etiquetaDelMensaje(mensaje, usuarioId)`: el `accessibilityLabel` del mensaje, que TalkBack lee
  como una unidad (FR-021, SC-007). Por ejemplo, "Vos, comprador, vie 20 nov 2026 · 14:35: ¿A qué
  hora abren?" o "Lucía Álvarez, organizador, …: …".
- `MensajeDelChat` diferencia los propios con más que el color (FR-017):
  - **Propios**: alineados a la derecha, autor "Vos", fondo `resaltado` con `texto` encima.
  - **Del otro**: alineados a la izquierda, su nombre y su rol, fondo `superficie`.
  - Los dos llevan borde y `sombra.nivel1` del tema.

## R13 — Tests (principio II)

| Capa | Archivo | Qué cubre |
|---|---|---|
| domain | `tests/domain/mensaje.test.ts` (nuevo) | invariantes de `Mensaje`: texto vacío o de solo espacios, sin recortar, 500 sí y 501 no, autor vacío, fecha inválida |
| domain | `tests/domain/compra.test.ts` | `enviarMensaje` agrega al final con la fecha `ahora` y no cambia el estado, el historial, las entradas ni el total; funciona en los seis estados; cada transición conserva los mensajes; `rolDe` |
| domain | `tests/domain/reglas-de-compra.test.ts` | `mensajes-en-orden`: fechas que decrecen y un mensaje anterior al alta se rechazan; fechas iguales se aceptan |
| domain | `tests/domain/datos-ejemplo.test.ts` | la conversación del seed: tres mensajes de las dos partes, en orden y anteriores al arranque |
| services | `tests/services/compra.service.test.ts` | `chat`: el orden 404 → 403 (con otro comprador y con el organizador de otro evento), el estado al día sin guardar, una pendiente vencida, sin mensajes, la otra parte según quién pide. `enviarMensaje`: materializa una pendiente vencida, un único `guardar` de la compra, el cupo sin cambios, un 403 no guarda nada |
| services | `tests/services/mensaje.vistas.test.ts` (nuevo) | `aMensajeVista` y `aChatDeLaCompraVista`: `numero`, rol de cada autor, `enviadoEnLocal` de Buenos Aires, la otra parte según quién pide y las claves exactas (sin códigos, historial, total ni `compradorId`) |
| services | `tests/services/concurrencia-compras.test.ts` | N mensajes simultáneos se guardan todos; mensaje ‖ pago, mensaje ‖ cancelación, mensaje ‖ uso y mensaje ‖ reembolso conservan los dos efectos |
| api | `tests/api/mensajes.test.ts` (nuevo) | `GET` y `POST` contra el seed: 401 → 400 (`params.compraId`, `body.texto` vacío, de 501 y no string) → 404 → 403; `201` con la `MensajeVista`; claves extra ignoradas; sin códigos de entrada en la respuesta |
| api | `tests/api/docs.test.ts` | la OpenAPI cubre las dos rutas nuevas |
| mobile api | `tests/api/compras.test.ts` | `obtenerChatDeLaCompra` (GET, `signal`) y `enviarMensaje` (POST, cuerpo `{ texto }`, `X-Usuario-Id`) |
| mobile | `tests/features/compras/formato.test.ts` | los textos de R12 |
| mobile | `tests/pantallas/chat-de-la-compra.test.tsx` (nuevo) | los cuatro estados; el vacío con el encabezado y el campo; propios y ajenos; enviar (vacía el campo y vuelve a pedir el chat); el 400 junto al campo, conservando el texto; el doble toque manda un pedido; el 403; el acceso desde "Tu compra" y desde "Compras del evento"; el cambio de usuario |
| mobile | `tests/pantallas/{compra, compras-del-evento}.test.tsx` | los botones de acceso en cada estado |
| mobile | `tests/componentes/` | `PantallaDesplazable` con `empezarAlFinal` (llama a `scrollToEnd`) |

Se sigue TDD con stub de firma real (AGENTS.md, "TDD con stub").
