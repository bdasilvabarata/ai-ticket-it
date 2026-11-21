---

description: "Tareas de implementación de la feature 011 — Chat de la compra"
---

# Tasks: Chat de la compra

**Input**: documentos de diseño en `specs/011-chat-de-la-compra/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md),
[contracts/app.md](./contracts/app.md), [quickstart.md](./quickstart.md)

**Tests**: obligatorios (constitución II, research R13): cada regla con su borde en `domain` (500 y
501 caracteres, solo espacios, sin recortar, los seis estados, cada transición que conserva los
mensajes, fechas iguales y decrecientes), `services` (reloj fijo y movible, repositorios armados por
caso y espiados para contar los `guardar`), concurrencia (N mensajes, mensaje ‖ pago, cancelación,
uso y reembolso) y `api`; en mobile, `api/`, `formato`, `PantallaDesplazable` y las pantallas con
`renderConDependencias` y `porRuta`.

**Organización**: una fase por historia de usuario, en el orden de la spec (US1, US2 y US3 son P1;
US4 y US5 son P2). El `Mensaje`, la compra con mensajes, `rolDe`, la regla nueva, los tipos
compartidos, las vistas del backend y la ruta movida de "Tu compra" van en Foundational porque los
usan las tres historias P1. Los endpoints, el seed y la pantalla con el acceso del comprador llegan
en la US1; el lado del organizador, en la US2; los rechazos y sus pantallas de error, en la US3; la
concurrencia y el refresco, en la US4; los estados, el teclado y la accesibilidad, en la US5.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: puede hacerse en paralelo (archivo distinto, sin dependencias pendientes).
- **[Story]**: historia a la que pertenece (US1–US5).
- Rutas relativas a la raíz del repo.

## Convenciones para todas las tareas

- **Test primero con stub en el mismo turno** (AGENTS.md, "TDD con stub"): el hook `Stop` exige
  typecheck y lint en verde al cerrar cada turno. Cada tarea "Test" crea **en el mismo turno** los
  módulos o miembros que importa como **stub con la firma real** que lanza
  `new Error("no implementado")` (un componente que devuelve `null`; una ruta de `app/` con su
  re-export de una línea). Se corre el test con `test:foco` (o `test:afectados -w backend`), **se lo
  ve fallar** por comportamiento y recién después se implementa.
- Endpoints: skill **`nuevo-endpoint`**. Pantallas, hooks y funciones de `src/api/`: skill
  **`nueva-pantalla`**.
- Backend en capas: `domain/` puro (sin Express, sin `errors/`, sin reloj: `ahora` y
  `organizadorId` llegan como argumentos). `CompraService` es el **único** que guarda compras; le
  pide el evento a `EventoService` y los usuarios a `UsuarioService`. **Sin** services,
  controllers, routers, repositorios, métodos de repositorio ni ids nuevos, y `app.ts` no cambia
  (R7). Los mensajes se guardan con la compra.
- **Enviar** (R4): `obtenerOFallar(compraId)` afuera solo para saber el `eventoId`; adentro de
  `cerrojo.ejecutar(eventoId, …)`: leer `ahora` → `eventoService.obtenerOFallar(eventoId)` →
  releer la compra → `rolDe` (`null` → `SinPermisoError`) → `eventoService.obtenerAlDia(eventoId,
  ahora)` (materializa el vencimiento **después** del 403) → releer la compra → `enviarMensaje` →
  **un** `compras.guardar`. Cerrojo liberado en `finally`, sin anidar. **Leer** (R5): sin cerrojo,
  sin guardar, tres lecturas fijas (compra, evento, usuarios en lote) y `compra.alDia(ahora)`.
- Orden de rechazos (FR-008, contracts/api.md): `401 USUARIO_NO_IDENTIFICADO → 400 ENTRADA_INVALIDA
  (params.compraId; en el POST, body.texto) → 404 COMPRA_NO_ENCONTRADA → 403 SIN_PERMISO`. **Ningún
  409**. Mensaje del 403, al pie de la letra: "Solo el comprador y el organizador del evento pueden
  ver y escribir en el chat de esta compra.".
- **Los contratos existentes no cambian**: `CompraVista`, `MiCompraVista` y `CompraDelEventoVista`
  no suman los mensajes. `ChatDeLaCompraVista` y `MensajeVista` no traen códigos de entradas,
  historial, total ni `compradorId` (FR-013).
- Textos de la app: los de `contracts/app.md` (son los que buscan los tests). El estado lo pone
  siempre `EtiquetaEstadoCompra`. La app **no valida** el texto: sin `maxLength` y "Enviar" no se
  deshabilita con el campo vacío; muestra el 400 del servidor junto al campo.
- Mobile: todo lo nuevo vive en `features/compras`; afuera solo cambian `src/api/compras.ts`
  (+ `index.ts`), `src/consultas/claves.ts`, `src/componentes/PantallaDesplazable.tsx`,
  `src/navegacion/LayoutRaiz.tsx` y las rutas de `app/compras/`. `CampoDeTexto` y
  `AvisoDeFormulario` se importan del `index.ts` de `eventos`. Imports relativos sin alias `@/`;
  todo `fetch` en `src/api/`; estilos con `StyleSheet` y valores del `tema`; textos con
  `...tema.tipografia.<estilo>` (nunca `fontWeight`). Las escrituras no se reintentan solas.
- Prohibidos `any`, `@ts-ignore` y `eslint-disable` sin descripción (principio IX).
- Commits: Conventional Commits con scope `011-chat-de-la-compra`, uno por tarea o grupo coherente.
  Cada fase cierra con la suite completa en verde (`npm test`, `npm run lint`,
  `npm run typecheck`, `npm run format:check`), sus tareas marcadas y su commit.

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: el estado del backlog y los tipos compartidos nuevos (aditivos: todavía no los usa
nadie).

- [X] T001 [P] En `docs/backlog.md`, pasar la 011 de `plan` a `tasks`.
- [X] T002 [P] Crear `shared/src/mensaje.ts` con el contenido de data-model.md ("Tipos compartidos") al pie de la letra, JSDoc incluido: `LIMITES_MENSAJE = { largoMaximo: 500 } as const`, `DatosMensaje { texto: string }`, `RolEnLaCompra = "comprador" | "organizador"`, `ParteDeLaCompraVista { id, nombre, apellido, rol }`, `MensajeVista { numero, autor, texto, enviadoEn, enviadoEnLocal }` y `ChatDeLaCompraVista { compra: { id, evento: { id, nombre }, tipoEntrada: { id, nombre }, cantidad, estado }, otraParte, mensajes }`. Exportarlos desde `shared/src/index.ts` (`LIMITES_MENSAJE` como valor; el resto como tipos). En `backend/tests/domain/tipos-compartidos.test.ts` (que ya verifica `LIMITES_COMPRA`, `LIMITES_EVENTO` y los demás), sumar que `LIMITES_MENSAJE.largoMaximo` es `500`. `npm run typecheck` en verde en los tres paquetes.

---

## Phase 2: Foundational (prerequisitos bloqueantes)

**Purpose**: el `Mensaje`, la compra que lleva y conserva sus mensajes, `rolDe`, la invariante de
orden, las vistas del backend y la ruta movida de "Tu compra". Ningún endpoint ni pantalla
todavía.

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

### Dominio

- [X] T003 [P] Test `backend/tests/domain/mensaje.test.ts` (nuevo) + stub `backend/src/domain/mensaje.ts` (clase `Mensaje` con `constructor({ autorId, texto, enviadoEn }: { autorId: string; texto: string; enviadoEn: Date })`, campos `readonly autorId: string`, `readonly texto: string`, `readonly enviadoEn: Date`). Casos (data-model "Mensaje"): se construye con texto de 1 y de exactamente 500 caracteres; rechaza con `DatosInvalidosError` y un detalle en `texto` el vacío, el de solo espacios o saltos de línea, el **sin recortar** (`" hola "`, `"hola\n"`: la regla es `texto === texto.trim()`) y el de 501; acepta saltos de línea **internos**; un detalle en `autorId` si es `""`; uno en `enviadoEn` si es `new Date(NaN)`; varios problemas a la vez dan un detalle por campo; es inmutable (`Object.freeze`; `enviadoEn` se copia, mutar la `Date` de entrada no lo cambia). Luego implementar con `domain/invariantes.ts` (como `Entrada`) y `LIMITES_MENSAJE.largoMaximo` de `shared/`.
- [X] T004 Test en `backend/tests/domain/compra.test.ts` + stubs en `backend/src/domain/compra.ts`: `PropiedadesCompra.mensajes?: readonly Mensaje[]`, `readonly mensajes: readonly Mensaje[]`, `enviarMensaje(autorId: string, texto: string, ahora: Date): Compra`, `rolDe(usuarioId: string, organizadorId: string): RolEnLaCompra | null`, y re-export de `Mensaje` desde `compra.ts`. Casos: sin `mensajes` en las propiedades la compra tiene `[]`, y `Compra.registrar` arranca con `[]`; `mensajes` está congelado (como `entradas`); `enviarMensaje` agrega al final un `Mensaje` con `autorId`, `texto` y `enviadoEn = ahora`, devuelve una compra **nueva** (la original no cambia) y **no** cambia `estado`, `historial`, `entradas`, `total`, `cantidad` ni `reembolso`; funciona en los seis estados (`PENDIENTE`, `PENDIENTE` vencida sin materializar, `CONFIRMADA`, `UTILIZADA`, `CANCELADA` —por el comprador y por vencimiento— y `REEMBOLSADA`) y no recibe la fecha del evento; dos mensajes seguidos quedan en orden; **cada transición conserva los mensajes** (un test por cada una: `pagar`, `cancelar` de una pendiente y de una confirmada, `vencer`, `alDia` de una vencida, `registrarUso` y `confirmarReembolso`); `rolDe` da `"comprador"` con `compradorId`, `"organizador"` con el `organizadorId` recibido y `null` con otro usuario. Luego implementar: `#propiedades()` incluye `mensajes`, el constructor los congela y `enviarMensaje` arma `new Compra({ ...this.#propiedades(), mensajes: [...this.mensajes, new Mensaje({ autorId, texto, enviadoEn: ahora })] })`. `rolDe` no lanza (el 403 lo decide el service, R2).
- [X] T005 Test en `backend/tests/domain/reglas-de-compra.test.ts` + la regla en `backend/src/domain/reglas-de-compra.ts` (data-model "REGLAS_DE_COMPRA"): nombre `mensajes-en-orden`, campo `mensajes`, mensaje "Los mensajes van en orden de envío y no son anteriores al alta de la compra.". Cumple si cada `enviadoEn` es mayor o igual que el del mensaje anterior **y** que la fecha del primer cambio del historial; con un historial inválido (vacío) la regla no se evalúa contra el alta (ya lo informa `historial-valido`). Casos: sin mensajes cumple; fechas **iguales** cumplen; fechas que decrecen fallan; un mensaje anterior a `creadaEn` falla; un mensaje igual a `creadaEn` cumple; el constructor de `Compra` informa el detalle en `mensajes` junto con los de otras reglas violadas.

### Vistas del backend

- [X] T006 Test de las vistas + stub `backend/src/services/mensaje.vistas.ts` con `aMensajeVista(mensaje: Mensaje, numero: number, compra: Compra, evento: Evento, autor: Usuario): MensajeVista` y `aChatDeLaCompraVista(compra: Compra, evento: Evento, usuarios: Map<string, Usuario>, usuarioId: string): ChatDeLaCompraVista` (el test va en `backend/tests/services/mensaje.vistas.test.ts`, nuevo: las vistas de la 010 no tienen test propio y estas son funciones puras). Exportar `aTipoDeLaCompra` desde `backend/src/services/compra.vistas.ts` y reusarla para `compra.tipoEntrada` (`{ id, nombre }`). Casos (R6): `numero` es la posición desde 1; `autor` es `{ id, nombre, apellido, rol }` con `rol` de `compra.rolDe(autor.id, evento.organizadorId)`; `enviadoEn` es ISO UTC y `enviadoEnLocal` es `"YYYY-MM-DDTHH:mm"` de Buenos Aires con `horaDeBuenosAires` (un mensaje a las 23:30 UTC cae a las 20:30 locales); `compra` trae `id`, `evento { id, nombre }`, `tipoEntrada { id, nombre }`, `cantidad` y `estado` de la compra recibida (el service le pasa la compra al día); `otraParte` es el organizador si `usuarioId` es el comprador y el comprador si es el organizador; `mensajes` en el orden del arreglo; las claves del JSON son **exactamente** las de `shared/src/mensaje.ts` (sin `entradas`, `historial`, `total` ni `compradorId`).

### Mobile

- [X] T007 [P] Mover `mobile/app/compras/[compraId].tsx` a `mobile/app/compras/[compraId]/index.tsx` (mismo re-export de `Compra`) y en `mobile/src/navegacion/LayoutRaiz.tsx` cambiar `Stack.Screen name="compras/[compraId]"` por `name="compras/[compraId]/index"` con el título "Tu compra" (R9). El `href` `/compras/[compraId]` no cambia: `FilaCompraConfirmada`, `FilaCompraPendiente`, `FilaMiCompra` y `ComprarEntradas` siguen igual. Verificar con `npm run typecheck -w mobile` (regenera las rutas tipadas) y `test:foco -w mobile -- tests/pantallas/compra.test.tsx tests/pantallas/mis-compras.test.tsx tests/pantallas/navegacion.test.tsx` en verde (el header sigue diciendo "Tu compra").

**Checkpoint**: la compra lleva y conserva sus mensajes; suite completa en verde.

---

## Phase 3: User Story 1 — El comprador escribe sobre su compra (Priority: P1) 🎯 MVP

**Goal**: el comprador abre el chat desde "Tu compra", ve la conversación y envía un mensaje que el
servidor guarda con su autor y la hora del servidor, en cualquier estado y con el evento realizado,
sin cambiar nada más de la compra.

**Independent Test**: con el seed, como Martín, abrir "Tu compra" del Festival, tocar "Chat con el
organizador", ver los tres mensajes del seed, enviar "¿A qué hora abren las puertas?" y verlo
último como "Vos"; por el lado del servidor, la compra sumó el mensaje y el estado, el historial,
las entradas y el cupo no cambiaron.

### Backend

- [X] T008 [US1] Test en `backend/tests/services/compra.service.test.ts` + stubs `CompraService.chat(compraId: string, usuarioId: string): ChatDeLaCompraVista` y `CompraService.enviarMensaje(compraId: string, usuarioId: string, datos: DatosMensaje): Promise<MensajeVista>` en `backend/src/services/compra.service.ts` (reloj fijo, repositorios en memoria armados por caso y **espiados**). Casos del comprador: `chat` devuelve los mensajes en orden con `otraParte` = organizador y el estado **al día** de una `PENDIENTE` vencida (`CANCELADA`) **sin guardar nada** (cero `guardar` en compras y eventos) y sin tomar el cerrojo; `chat` hace tres lecturas fijas con 0 y con 3 mensajes (espiar `usuarioService.obtenerPorIds`: una llamada con `[compradorId, organizadorId]`); `enviarMensaje`, sobre un evento **sin pendientes vencidas**, guarda **un** `compras.guardar` con el mensaje al final, `autorId` = el usuario y `enviadoEn` = el reloj, y responde la `MensajeVista` con `numero` = largo de la conversación y `rol: "comprador"`; no cambia estado, historial, entradas, total ni el cupo del evento (`eventos.guardar` no se llama); se acepta en cada uno de los seis estados y con el evento **realizado**; con una `PENDIENTE` vencida sin materializar, primero se materializa el vencimiento con `obtenerAlDia` (la compra queda `CANCELADA` por el sistema y el cupo vuelve, con el orden de guardado de la 006) y después se guarda el mensaje sobre la compra ya cancelada; con **otra** compra `PENDIENTE` vencida en el mismo evento (FR-009/FR-010), el envío también la registra cancelada por el sistema y le devuelve el cupo (como toda escritura del evento), y la compra del mensaje solo suma el mensaje. Luego implementar según R4 y R5 (ver "Convenciones").
- [X] T009 [P] [US1] Seed (R8): en `backend/src/seed/datos-ejemplo.ts`, `compra-martin-festival-vip` suma tres mensajes, de `usuario-martin` (alta + 10 min) "Hola, ¿la entrada VIP incluye estacionamiento?", de `usuario-lucia` (alta + 2 h) "¡Hola, Martín! Sí: con la entrada VIP tenés lugar en el estacionamiento del predio. Mostrá tu código en la barrera." y de `usuario-martin` (alta + 3 h) "¡Genial, gracias!", con las fechas calculadas desde el alta de esa compra como las de su historial. Test primero en `backend/tests/domain/datos-ejemplo.test.ts`: tres mensajes, de las dos partes, en orden, todos anteriores al arranque y posteriores a la confirmación; la compra sigue `CONFIRMADA`; **ninguna otra** compra del seed tiene mensajes; las demos de 007 a 010 no cambian (los tests existentes del seed siguen en verde).
- [X] T010 [US1] Validación, controller y rutas (skill `nuevo-endpoint`): en `backend/src/validations/compra.validation.ts`, `mensajeNuevo = crearValidacion({ params: z.object({ compraId: idSchema }), body: z.object({ texto: textoObligatorio(LIMITES_MENSAJE.largoMaximo) }) })` (las claves desconocidas se descartan); en `backend/src/controllers/compra.controller.ts`, `chat` (`200`) y `enviarMensaje` (`201`), con el usuario de `X-Usuario-Id`; en `backend/src/routes/compras.routes.ts`, `router.get("/:compraId/mensajes", requerirUsuario, compraPorId.middleware, controller.chat)` y `router.post("/:compraId/mensajes", requerirUsuario, mensajeNuevo.middleware, controller.enviarMensaje)`, con su comentario. Test primero en `backend/tests/api/mensajes.test.ts` (nuevo, supertest con `crearApp()` y el seed): `GET` como Martín de `compra-martin-festival-vip` → `200` con la conversación del seed (depende del seed de T009) y `otraParte` Lucía organizadora; `POST` como Martín con `{ "texto": "  ¿A qué hora abren las puertas?  " }` → `201` con `texto` recortado, `numero` 4, autor Martín `comprador`; el `GET` siguiente lo trae último; claves extra (`autorId: "usuario-lucia"`, `enviadoEn`, `numero`) se ignoran; el `GET /api/eventos/evento-festival-sonidos-del-sur` muestra el mismo cupo antes y después; la respuesta no contiene ningún código de entrada de la compra (buscarlos en el JSON serializado); `POST` en la compra cancelada de Diego del Maratón → `201` y la compra sigue `CANCELADA` en `GET /compras/:id`.
- [X] T011 [P] [US1] OpenAPI y Postman: en `backend/src/docs/openapi.json`, el path `/compras/{compraId}/mensajes` con `get` (`200 ChatDeLaCompraVista`, 400, 401, 403, 404) y `post` (cuerpo `DatosMensaje`, `201 MensajeVista`, 400, 401, 403, 404), y los esquemas `DatosMensaje`, `RolEnLaCompra`, `ParteDeLaCompraVista`, `MensajeVista` y `ChatDeLaCompraVista` (con `texto` `minLength: 1`, `maxLength: 500`); en `backend/src/docs/ai-ticket-it.postman_collection.json`, los cinco pedidos de contracts/api.md ("Chat de la compra (Martín, Festival)", "Chat de la compra (Lucía, organizadora)", "Enviar mensaje (Martín)", "Enviar mensaje vacío → 400", "Chat de la compra como Sofía → 403"). `test:foco -w backend -- tests/api/docs.test.ts` en verde (cubre las rutas nuevas).

### Mobile

- [X] T012 [P] [US1] Test en `mobile/tests/api/compras.test.ts` + stubs en `mobile/src/api/compras.ts` (exportados por `mobile/src/api/index.ts`): `obtenerChatDeLaCompra(cliente, compraId, { signal })` → `cliente.get<ChatDeLaCompraVista>(\`/compras/${compraId}/mensajes\`, …)` y `enviarMensaje(cliente, compraId, datos: DatosMensaje, { usuarioId })` → `cliente.post<MensajeVista>(…, datos, { usuarioId })`. Casos: método, ruta, `signal`, cuerpo `{ texto }` y `X-Usuario-Id` con `crearFetchFalso`. Sumar en `mobile/src/consultas/claves.ts` `chatDeLaCompra(usuarioId, compraId)` → `["chat-de-la-compra", usuarioId, compraId]` (usuario en la posición 1; sin prefijo común con `["compra"]`); `tests/consultas/` no prueba las claves, así que la cubren los tests de pantalla (T015, T023 y T026).
- [X] T013 [P] [US1] Test en `mobile/tests/features/compras/formato.test.ts` + stubs en `mobile/src/features/compras/formato.ts` (R12, contracts/app.md "Textos"): `textoRolEnLaCompra(rol)` ("Comprador" / "Organizador"), `textoOtraParte(parte)` ("Con Lucía Álvarez · Organizador"), `textoAutorDelMensaje(mensaje, usuarioId)` ("Vos" si `autor.id === usuarioId`; si no, "Lucía Álvarez · Organizador"), `etiquetaDelMensaje(mensaje, usuarioId)` ("Vos, comprador, vie 20 nov 2026 · 14:35: <texto>" / "Lucía Álvarez, organizador, …: <texto>", con la hora de `textoFechaHora(enviadoEnLocal)` de `eventos`) y la constante `SIN_MENSAJES = "Todavía no hay mensajes"`. Luego implementar.
- [X] T014 [US1] Helpers en `mobile/tests/helpers/compras.ts`: `mensajeDeEjemplo(parcial?)` y `chatDeEjemplo(parcial?)` (el chat del seed visto por Martín: Festival, VIP, 2 entradas, `CONFIRMADA`, `otraParte` Lucía organizadora, los tres mensajes de R8 con `enviadoEnLocal` fijos) y una variante vista por Lucía (`otraParte` Martín comprador).
- [X] T015 [US1] Test `mobile/tests/pantallas/chat-de-la-compra.test.tsx` (nuevo, `renderConDependencias` + `porRuta`) + stubs: `useChatDeLaCompra(usuarioId, compraId)` en `mobile/src/features/compras/useChatDeLaCompra.ts`, `useEnviarMensaje(usuarioId, compraId)` en `mobile/src/features/compras/mutaciones.ts`, la pantalla `ChatDeLaCompra` en `mobile/src/features/compras/pantallas/ChatDeLaCompra.tsx` (exportada por `mobile/src/features/compras/index.ts`), `EncabezadoDelChat` y `MensajeDelChat` en `mobile/src/features/compras/componentes/`, la ruta `mobile/app/compras/[compraId]/chat.tsx` (`export { ChatDeLaCompra as default } from "../../../src/features/compras";`) y en `LayoutRaiz.tsx` `Stack.Screen name="compras/[compraId]/chat"` con el título "Chat de la compra" dentro del `Stack.Protected` de `con-usuario`. Casos del comprador: desde "Tu compra" de Martín (`GET /compras/:id`), el botón "Chat con el organizador" abre la pantalla (header "Chat de la compra"), que pide `GET /compras/compra-martin-festival-vip/mensajes` con `X-Usuario-Id: usuario-martin`; el encabezado muestra "Festival Sonidos del Sur", "Con Lucía Álvarez · Organizador", "VIP · 2 entradas" y la etiqueta "Confirmada"; los tres mensajes con su texto y su hora "vie … · HH:mm"; los de Martín con autor "Vos", el de Lucía con "Lucía Álvarez · Organizador"; escribir en el campo "Mensaje" y tocar "Enviar" manda `POST` con `{ "texto": "…" }` (sin recortar: la app no valida), vacía el campo y vuelve a pedir el chat, que ya trae el mensaje nuevo último. Sumar en `mobile/tests/pantallas/compra.test.tsx` que "Chat con el organizador" aparece en cada estado (`PENDIENTE`, `CONFIRMADA`, `UTILIZADA`, `CANCELADA`, `REEMBOLSADA`). Sumar en `mobile/tests/tipos/rutas-tipadas.ts` un `@ts-expect-error` para `{ pathname: "/compras/[compraId]/chat" }` sin `compraId` y una válida con el parámetro.
- [X] T016 [US1] Implementar para que T015 pase: `useChatDeLaCompra` (`useQuery` con `claves.chatDeLaCompra(usuarioId, compraId)` y `obtenerChatDeLaCompra` del `useClienteApi()`); `useEnviarMensaje` (en nombre de `usuarioId`, sin reintentos; en `onSettled` invalida con el predicado `queryKey[0] === "chat-de-la-compra" && queryKey[2] === compraId`, y **nada más**: FR-019); `EncabezadoDelChat` (nombre del evento con `accessibilityRole="header"`, `textoOtraParte`, "<tipo> · <n> entradas" con el texto de cantidad que ya usa la feature y `EtiquetaEstadoCompra`); `MensajeDelChat` (R12: propio a la derecha con "Vos" y fondo `resaltado` con `texto` encima; ajeno a la izquierda con nombre y rol y fondo `superficie`; el rol propio no se dibuja, lo anuncia la etiqueta accesible (FR-017, FR-021); borde y `sombra.nivel1`; la hora con `textoFechaHora`; el texto respeta los saltos de línea); `ChatDeLaCompra` (con `useSesion()` para el usuario, `SegunConsulta`, encabezado, lista con clave `numero`, `CampoDeTexto` multilínea "Mensaje" de `eventos` y `Boton` "Enviar" / "Enviando…" con `useEnvioUnico`; con éxito vacía el campo) dentro de `PantallaDesplazable`; en `mobile/src/features/compras/pantallas/Compra.tsx`, debajo de `ResumenCompra` y en todos los estados, `Boton variante="aviso"` "Chat con el organizador" con `router.push({ pathname: "/compras/[compraId]/chat", params: { compraId } })`.

**Checkpoint**: el comprador chatea desde "Tu compra" (MVP); suite completa en verde.

---

## Phase 4: User Story 2 — El organizador responde (Priority: P1)

**Goal**: el organizador abre el chat desde cada fila de "Compras del evento", ve los mensajes del
comprador identificados como tales y responde.

**Independent Test**: como Lucía, en "Compras del evento" del Festival, tocar "Abrir chat" en la
fila de Martín, ver "Con Martín Benítez · Comprador", responder y verla como "Vos"; como Martín, ver
la respuesta como de la organizadora.

- [X] T017 [US2] Test en `backend/tests/services/compra.service.test.ts` y `backend/tests/api/mensajes.test.ts`, casos del organizador: `chat` como el organizador devuelve los mismos mensajes con `otraParte` = el comprador (`rol: "comprador"`) y los autores con su rol correcto; `enviarMensaje` como el organizador guarda el mensaje con su `autorId` y responde `rol: "organizador"`; vale con el evento realizado y en una `REEMBOLSADA`; en el API, Lucía hace `POST` y Martín lo ve en su `GET` como `organizador`. Debería pasar con lo de la US1; si no, corregir `CompraService` o `mensaje.vistas.ts`.
- [X] T018 [US2] Test en `mobile/tests/pantallas/compras-del-evento.test.tsx`: cada fila (en cada estado, también con el evento realizado) tiene un botón "Abrir chat" con `accessibilityLabel` "Abrir el chat con Martín Benítez", enfocable aparte del bloque accesible de la fila (como "Confirmar reembolso"); tocarlo abre "Chat de la compra" de esa compra. Sumar en `mobile/tests/pantallas/chat-de-la-compra.test.tsx` el caso de Lucía (chat visto por Lucía): "Con Martín Benítez · Comprador", los mensajes de Martín con "Martín Benítez · Comprador", el de Lucía como "Vos"; enviar manda `X-Usuario-Id: usuario-lucia`. Luego implementar en `mobile/src/features/compras/componentes/FilaCompraDelEvento.tsx` el `Boton variante="texto"` "Abrir chat" al pie de la tarjeta, **hermano** del bloque accesible (nunca adentro), con `router.push({ pathname: "/compras/[compraId]/chat", params: { compraId: compra.id } })` y el `accessibilityLabel` con el nombre completo del comprador (`nombreCompleto` de `usuarios`).

**Checkpoint**: las dos partes chatean; suite completa en verde.

---

## Phase 5: User Story 3 — Nadie más lee ni escribe (Priority: P1)

**Goal**: solo las dos partes leen y escriben; los rechazos siguen el orden 401 → 400 → 404 → 403 y
no cambian nada.

**Independent Test**: como Sofía, `GET` y `POST` en la compra de Martín → 403 y la conversación no
cambió; sin usuario → 401; compra inexistente → 404; texto vacío o de 501 → 400 en `body.texto`.

- [X] T019 [US3] Test en `backend/tests/services/compra.service.test.ts`: `chat` y `enviarMensaje` lanzan `CompraNoEncontradaError` (404) con una compra inexistente y `SinPermisoError` con el mensaje de contracts/api.md para **otro comprador del mismo evento** y para **el organizador de otro evento**; un 403 de `enviarMensaje` **no guarda nada** (ni la compra ni el evento) y **no materializa** el vencimiento de una `PENDIENTE` vencida (la compra sigue guardada `PENDIENTE`); el 404 va antes del 403. Corregir `CompraService` si hace falta.
- [X] T020 [US3] Test en `backend/tests/api/mensajes.test.ts`, en el orden de contracts/api.md para `GET` y `POST`: sin `X-Usuario-Id` y con usuario inexistente → `401 USUARIO_NO_IDENTIFICADO`; `compraId` con formato inválido → `400 ENTRADA_INVALIDA` en `params.compraId`; en el `POST`, `texto` faltante, `null`, número, `""` y `"   \n "` → `400` con `body.texto` "Es obligatorio."; 500 caracteres (con espacios alrededor que se recortan) → `201`; 501 → `400` "Debe tener como máximo 500 caracteres."; compra inexistente → `404 COMPRA_NO_ENCONTRADA`; Sofía → `403 SIN_PERMISO`; combinaciones (sin usuario + texto vacío → 401; texto vacío + compra inexistente → 400; inexistente como Sofía → 404); después de cada rechazo, el `GET` como Martín sigue con tres mensajes. FR-004 (no se editan ni se borran): `PUT`, `PATCH` y `DELETE` sobre `/api/compras/compra-martin-festival-vip/mensajes` y `DELETE` sobre `/api/compras/compra-martin-festival-vip/mensajes/1` → `404 RUTA_NO_ENCONTRADA`, y la conversación no cambia.
- [X] T021 [US3] Test en `mobile/tests/pantallas/chat-de-la-compra.test.tsx` + implementación en `ChatDeLaCompra.tsx` (contracts/app.md "Estados"): un `403` al pedir el chat muestra `Ilustracion` con un candado y "No tenés permiso para ver este chat."; un `404`, "No encontramos esta compra." con "Ir a Explorar" (como "Tu compra"); un `403`/`404` al **enviar** muestra su `mensaje` con `AvisoDeFormulario` y conserva el texto.

**Checkpoint**: la regla "Chat" de la constitución está cubierta; suite completa en verde.

---

## Phase 6: User Story 4 — Una conversación ordenada y al día (Priority: P2)

**Goal**: los mensajes simultáneos y los que se cruzan con otra operación se conservan todos; la
app manda un solo pedido por toque y se pone al día al volver a la pantalla y al cambiar el estado.

**Independent Test**: N mensajes simultáneos se guardan todos; mensaje ‖ pago, cancelación, uso o
reembolso conservan los dos efectos; volver al chat lo pide de nuevo; un doble toque en "Enviar"
manda un pedido.

- [X] T022 [US4] Test en `backend/tests/services/concurrencia-compras.test.ts` (con el patrón de los tests de concurrencia de la 006 a la 009): **N** `enviarMensaje` simultáneos (`Promise.all`, de las dos partes) → la compra guarda los N, en el orden en que entraron al cerrojo, y la regla `mensajes-en-orden` se cumple; mensaje ‖ `pagar` de una `PENDIENTE` → queda `CONFIRMADA` **y** con el mensaje; mensaje ‖ `cancelar` de una `CONFIRMADA` → `CANCELADA` con el cupo devuelto **y** el mensaje; mensaje ‖ `registrarUso` → `UTILIZADA` **y** el mensaje; mensaje ‖ `confirmarReembolso` → `REEMBOLSADA` **y** el mensaje; cada caso en los dos órdenes de llegada. Corregir `CompraService.enviarMensaje` si alguno pierde un efecto (todo adentro del cerrojo, releyendo la compra).
- [X] T023 [US4] Test en `mobile/tests/pantallas/chat-de-la-compra.test.tsx`: dos toques seguidos en "Enviar" mandan **un** `POST` (`useEnvioUnico`); un `POST` que falla sin servidor muestra "No se pudo enviar. Probá de nuevo.", conserva el texto, **no** se reintenta solo y el chat se vuelve a pedir; volver a la pantalla desde otra (navegar a otra y `back`) vuelve a pedir el chat (`useRefrescarAlFocalizar(consulta.refetch)`), pero no al montarse por primera vez (un solo `GET` al abrir); mientras la pantalla está a la vista no hay sondeo (con temporizadores falsos, no hay otro `GET` después de 60 s); enviar como Martín y cambiar a Lucía en el mismo celular → al abrir el chat de Lucía antes de 30 s se pide de nuevo y aparece el mensaje (la invalidación alcanza a la clave del otro usuario). Implementar lo que falte en `ChatDeLaCompra.tsx`.
- [X] T024 [US4] Test y cambio en `mobile/src/features/compras/mutaciones.ts` (R10): `usePagarCompra`, `useCancelarCompra`, `useRegistrarUso` y `useConfirmarReembolso` suman `queryClient.invalidateQueries({ queryKey: ["chat-de-la-compra"] })` por prefijo; `useEnviarMensaje` **no** invalida `["compra"]`, `["mis-compras"]`, `["compras-del-evento"]`, el evento ni el catálogo. Cubrirlo en `mobile/tests/pantallas/chat-de-la-compra.test.tsx` (o en el test de pantalla de cada mutation): después de pagar en "Tu compra" y abrir el chat, el encabezado muestra "Confirmada" con un `GET` nuevo; después de enviar, `GET /compras/:id` no se vuelve a pedir.

**Checkpoint**: sin carreras y con la conversación al día; suite completa en verde.

---

## Phase 7: User Story 5 — La pantalla en todos sus estados (Priority: P2)

**Goal**: carga, error, vacío y con mensajes; el 400 junto al campo; el teclado no tapa el campo; la
pantalla abre mostrando lo más reciente; TalkBack lee cada mensaje como una unidad; nada se filtra
entre usuarios.

**Independent Test**: chat sin mensajes con "Todavía no hay mensajes", encabezado y campo; error con
"Reintentar"; un 400 junto al campo con el texto conservado; TalkBack lee autor, hora y texto.

- [X] T025 [P] [US5] Test en `mobile/tests/componentes/pantalla-desplazable.test.tsx` + prop opcional `empezarAlFinal?: boolean` en `mobile/src/componentes/PantallaDesplazable.tsx` (R11): con la prop, al cambiar el tamaño del contenido (`onContentSizeChange`) llama a `scrollToEnd({ animated: false })` del `ScrollView`; sin la prop, no lo llama y el comportamiento existente (margen inferior, teclado) no cambia. Documentarla en el JSDoc de `PropsPantallaDesplazable`.
- [X] T026 [US5] Test en `mobile/tests/pantallas/chat-de-la-compra.test.tsx` + implementación en `ChatDeLaCompra.tsx`, `MensajeDelChat.tsx` y `EncabezadoDelChat.tsx`: mientras se pide, `Cargando`; un error de servidor muestra el mensaje y "Reintentar", que vuelve a pedir; con `mensajes: []`, "Todavía no hay mensajes" **con** el encabezado y el campo a la vista (el vacío lo resuelve la pantalla, no `SegunConsulta`); un `400` al enviar con detalle `body.texto` muestra "Es obligatorio." (o el mensaje del servidor) debajo del campo y conserva el texto escrito; "Enviar" con el campo vacío manda el pedido igual (no se deshabilita); cada mensaje es un elemento `accessible` con `accessibilityLabel` = `etiquetaDelMensaje` (propio: "Vos, comprador, …: …"); el campo tiene la etiqueta accesible "Mensaje" y el botón, "Enviar"; un mensaje con saltos de línea internos los muestra; la pantalla usa `PantallaDesplazable` con `empezarAlFinal`; cambiar de usuario (Martín → Lucía) no muestra la conversación del anterior (la clave lleva el usuario: se pide de nuevo con el `X-Usuario-Id` nuevo).
- [X] T027 [US5] Revisión manual de 360 px y del teclado: los estilos de `MensajeDelChat` (ancho máximo del globo, `flexShrink` del texto, sin desborde horizontal) y del campo con "Enviar" usan solo valores del `tema`; el campo queda al final del contenido y el teclado no lo tapa (comportamiento de `PantallaDesplazable`). Anotar en el commit y en el PR lo verificado (es la única verificación de FR-021 en 360 px y de US5-5; no hay test automático de layout).

**Checkpoint**: la pantalla cumple el principio VII; suite completa en verde.

---

## Phase 8: Polish y documentación

**Purpose**: documentación, validación de punta a punta y cierre de la feature.

- [X] T028 [P] Actualizar `AGENTS.md`: en `backend/src/` → "Recursos", el sub-recurso `GET` y `POST /compras/:compraId/mensajes` (solo las dos partes, en cualquier estado, sin 409; orden 401 → 400 → 404 `COMPRA_NO_ENCONTRADA` → 403; el `POST` bajo el cerrojo con un `guardar`, el `GET` al día sin guardar y con tres lecturas); en "Compras", `domain/mensaje.ts` (`Mensaje` sin id, re-exportado por `compra.ts`), `compra.mensajes`, `enviarMensaje`, `rolDe`, la regla `mensajes-en-orden` y que las transiciones conservan los mensajes; `services/mensaje.vistas.ts` (`aChatDeLaCompraVista`, `aMensajeVista`); `shared/src/mensaje.ts` y `LIMITES_MENSAJE`; el seed con la conversación de Martín y Lucía; en mobile, la ruta movida `compras/[compraId]/index` y la nueva `compras/[compraId]/chat`, `ChatDeLaCompra` (con `EncabezadoDelChat` y `MensajeDelChat`), la clave `chatDeLaCompra(usuarioId, compraId)`, `useChatDeLaCompra`, `useEnviarMensaje` (invalida solo ese chat, para todos los usuarios), que pago, cancelación, uso y reembolso invalidan `["chat-de-la-compra"]`, los accesos "Chat con el organizador" y "Abrir chat" (hermano del bloque de la fila) y la prop `empezarAlFinal` de `PantallaDesplazable`.
- [X] T029 [P] En `docs/backlog.md`, pasar la 011 a `implement` (y a `PR` al abrirlo).
- [X] T030 Validar [quickstart.md](./quickstart.md): los `curl` de la sección 1 contra `npm start` (incluidos los rechazos y el cupo sin cambios) y Swagger en `/api/docs`; los pasos 1 a 9 de la sección 2 en el celular con Expo Go (los que no se puedan hacer, anotarlos en el PR).
- [X] T031 Suite completa en verde desde la raíz: `npm test`, `npm run lint`, `npm run typecheck` y `npm run format:check`; commit y PR a `development` con el resumen de la feature.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T002 bloquea todo lo que usa los tipos nuevos.
- **Foundational (Phase 2)**: depende de T002. T003 → T004 → T005 (mismo agregado); T006 depende
  de T004; T007 es independiente del backend. Bloquea todas las historias.
- **US1 (Phase 3)**: depende de Foundational. T008 y T009 (seed) en paralelo; los dos → T010 (el
  test del API usa el service y el seed); T011, T012 y T013 en paralelo; T014 → T015 → T016.
- **US2 (Phase 4)**: depende de la US1 (usa los endpoints y la pantalla).
- **US3 (Phase 5)**: depende de la US1 (endpoints y pantalla); independiente de la US2.
- **US4 (Phase 6)**: depende de la US1; T022 es solo backend y puede ir en paralelo con T023/T024.
- **US5 (Phase 7)**: depende de la US1; T025 se puede adelantar en cualquier momento después de
  Foundational.
- **Polish (Phase 8)**: depende de todas las historias.

### User Story Dependencies

- **US1 (P1)**: la base de las demás (endpoints, seed, pantalla y acceso del comprador).
- **US2 (P1)**: solo agrega el acceso del organizador y verifica el rol; prueba independiente.
- **US3 (P1)**: solo rechazos y sus pantallas; prueba independiente.
- **US4 / US5 (P2)**: robustez y estados de la misma pantalla; independientes entre sí.

### Within Each User Story

- Test con stub de firma real → verlo fallar → implementar → `test:foco` en verde.
- Dominio → vistas → service → validación/controller/rutas → OpenAPI → app (api → claves → hooks →
  pantalla → accesos).

### Parallel Opportunities

- T001 y T002.
- T003 y T007 (backend y mobile).
- En la US1: T008 (service) y T009 (seed); después, T011 (docs), T012 (api mobile) y T013 (formato)
  en paralelo con T010 o una vez hecho.
- T022 (concurrencia del backend) en paralelo con T023–T024 (mobile).
- T025 en paralelo con cualquier tarea de pantalla.
- T028 y T029.

---

## Parallel Example: User Story 1

```bash
# Primero, en paralelo:
Task: "T008 CompraService.chat y enviarMensaje en backend/src/services/compra.service.ts"
Task: "T009 Seed con la conversación de Martín y Lucía en backend/src/seed/datos-ejemplo.ts"

# Después de T008–T010 (service, seed y endpoints del comprador):
Task: "T011 OpenAPI y Postman de /compras/{compraId}/mensajes en backend/src/docs/"
Task: "T012 obtenerChatDeLaCompra y enviarMensaje en mobile/src/api/compras.ts + clave chatDeLaCompra"
Task: "T013 Textos del chat en mobile/src/features/compras/formato.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (Setup) y Phase 2 (Foundational).
2. Phase 3 (US1): el comprador lee y escribe desde "Tu compra".
3. **Parar y validar**: quickstart sección 1 (`curl` como Martín) y pasos 1–2 de la sección 2.

### Incremental Delivery

1. US1 → el comprador chatea (MVP).
2. US2 → el organizador responde desde "Compras del evento".
3. US3 → solo las dos partes (rechazos en el servidor y en la pantalla).
4. US4 → concurrencia y refresco.
5. US5 → estados, teclado y accesibilidad.
6. Polish → AGENTS.md, backlog, quickstart y PR.

Cada fase se corre con `/speckit-implement fase N` y contexto limpio entre fases (`/clear`); cierra
con la suite completa en verde, sus tareas marcadas en este archivo y su commit.

---

## Notes

- [P] = archivo distinto y sin dependencias pendientes.
- Las historias US2–US5 agregan casos sobre los mismos archivos de la US1
  (`compra.service.test.ts`, `mensajes.test.ts`, `chat-de-la-compra.test.tsx`): por eso casi no
  llevan [P] entre ellas.
- Si una tarea "Debería pasar con lo de la US1" pasa de entrada, igual se deja el test: documenta la
  regla (principio II).
