# AI Ticket It — instrucciones para agentes

Plataforma móvil de venta de entradas para eventos: organizadores publican eventos con tipos de
entrada; compradores buscan, compran, siguen sus compras, chatean y reseñan. TP individual de
Desarrollo con IA (DDS UTN FRBA, 2C 2026).

## Antes de tocar código

- Leé `.specify/memory/constitution.md`: dominio, reglas de negocio y principios no negociables.
- La consigna y los casos de uso (UC-01 a UC-12) están en `docs/consigna/consigna.md`.
- El orden y las dependencias de las features están en `docs/backlog.md`.
- Toda feature sigue Spec Kit: `/speckit-specify → /speckit-clarify → /speckit-plan →
  /speckit-tasks → /speckit-implement`, con revisión humana entre etapas.

## Ramas (ver constitución, "Flujo de Trabajo")

- `main` ← solo merges desde `development`.
- `development` ← PRs de features.
- `feature/NNN-slug` ← la crea `/speckit-specify`. **Antes de correrlo, posicionate en
  `development` actualizada** (`git switch development && git pull`), porque la rama nueva
  nace del HEAD actual.
- Al terminar una feature: tests, lint y typecheck en verde → PR a `development` → actualizar
  el estado en `docs/backlog.md`.

## Mapa

- `shared/` — tipos de contratos y enums compartidos (ej.: `EstadoCompra`, `CompraVista`) y los
  límites de compra `LIMITES_COMPRA` (4 entradas pagas por evento, 1 por tipo gratis, 15 minutos
  para pagar), que usan el backend y la app. Desde la 011, `shared/src/mensaje.ts`:
  `LIMITES_MENSAJE` (`largoMaximo: 500`), `DatosMensaje`, `RolEnLaCompra`, `ParteDeLaCompraVista`,
  `MensajeVista` y `ChatDeLaCompraVista`.
- `backend/src/` — Express en capas:
  `routes/ → controllers/ → services/ → repositories/ → domain/`, más `middlewares/`
  (usuario actual, logging, 404, registro y respuesta de errores), `validations/` (zod),
  `errors/`, `config/` y `docs/` (OpenAPI, servida en `/api/docs`).
  - `app.ts` es el **composition root**: el único lugar que instancia y conecta las clases;
    cada clase recibe sus dependencias por constructor (nada de instancias globales).
  - `domain/` son clases con comportamiento (sin Express ni IO) y las interfaces de
    repositorio de las que dependen los services.
  - `repositories/` son repositorios **en memoria** (un `Map` privado por repositorio); no hay
    base de datos. `seed/` arma los datos de ejemplo y `crearRepositoriosDeEjemplo()` (desde la
    008, con "Peña en La Rueda" de Lucía a la hora en punto más cercana a `ahora + 2 h` del
    arranque: su ventana de uso está abierta para probar "Registrar ingreso"; desde la 009, con dos
    compras canceladas del Maratón de Lucía: la de Diego con el reembolso pendiente y la de
    Valentina `REEMBOLSADA`; desde la 010, las entradas del seed llevan su `uso` o su `cancelacion`
    explícitos; desde la 011, `compra-martin-festival-vip` trae una conversación de tres mensajes
    entre Martín y Lucía, fechada desde el alta de la compra, y ninguna otra compra tiene mensajes);
    `crearApp()` los usa por defecto. Las entidades son inmutables: `guardar` reemplaza la
    instancia (las operaciones de `Evento` devuelven un `Evento` nuevo).
  - **Recursos**: `usuarios`, `categorias` (solo lectura), `eventos` y su router hijo
    `eventos/:eventoId/tipos-entrada` (`TipoEntrada` vive dentro del agregado `Evento`: tiene
    controller y service, pero se guarda con `RepositorioEventos`), `compras` (feature 006:
    `POST /eventos/:eventoId/compras` y `GET /eventos/:eventoId/mis-compras` (pendientes,
    confirmadas y restantes por tipo) en el router de eventos, `GET /compras/:compraId`,
    `POST /compras/:compraId/pago` y `POST /compras/:compraId/cancelacion` en `compras.routes.ts`;
    todos con usuario, y una compra solo la ve, la paga y la cancela su comprador; la 007 suma
    `GET /compras`: las del usuario actual como comprador, de todos los eventos, al día sin guardar
    nada, ordenadas y como `MiCompraVista`, sin `historial` ni `compradorId`, con `diasRestantes` y
    `canceladaPor`; la 008 suma `GET /eventos/:eventoId/compras`: solo para su organizador, al día y
    sin guardar, `ComprasDelEventoVista` con la ventana de uso, el resumen por tipo y las compras de
    todos los compradores **sin códigos**; la 009 amplía `POST /compras/:compraId/cancelacion` a una
    `CONFIRMADA` —antes del inicio del evento y sin entradas usadas; orden de rechazos 401 → 400 →
    404 `COMPRA_NO_ENCONTRADA` → 403 → 409 `COMPRA_VENCIDA` → 409 `EVENTO_REALIZADO` (solo en una
    `CONFIRMADA`; una `PENDIENTE` se cancela también con el evento empezado) → 409
    `TRANSICION_INVALIDA`— y suma `POST /compras/:compraId/reembolso`: solo el organizador del
    evento, sin plazo, bajo el cerrojo con `obtenerDelOrganizador`, **un** `guardar` (el cupo no
    cambia) y responde `CompraDelEventoVista`; rechazos 401 → 400 → 404 → 403 → 409
    `TRANSICION_INVALIDA`; la 011 suma el sub-recurso `GET` y `POST /compras/:compraId/mensajes`, el
    chat de la compra: solo el comprador y el organizador del evento, en **cualquier** estado y con
    el evento realizado, **sin 409**; orden de rechazos 401 → 400 (`params.compraId`; en el `POST`,
    `body.texto`, recortado, de 1 a 500) → 404 `COMPRA_NO_ENCONTRADA` → 403 `SIN_PERMISO`;
    `CompraService.chat` lee al día sin guardar ni cerrojo, con tres lecturas fijas (compra, evento,
    las dos partes en lote) y responde `ChatDeLaCompraVista`; `CompraService.enviarMensaje` lee la
    compra afuera solo para saber el `eventoId` y, bajo el cerrojo, relee evento y compra, verifica
    el rol (403 antes de materializar nada), materializa el vencimiento con `obtenerAlDia`, relee la
    compra y hace **un** `compras.guardar` (el cupo no cambia); responde `201 MensajeVista`; no hay
    `PUT`, `PATCH` ni `DELETE`: los mensajes no se editan ni se borran), `entradas` (feature 008: router hijo
    `eventos/:eventoId/entradas` con `GET /:codigo` y `POST /:codigo/uso`, solo el organizador;
    `EntradaService` con `obtener` (lectura: busca la compra con
    `CompraService.obtenerPorCodigoOFallar`) y `registrarUso`, que desde la 010 **delega** en
    `CompraService.registrarUso` (bajo el cerrojo, con el mismo orden de chequeos); orden de chequeos
    del uso: 401 → 400 → 404 `EVENTO_NO_ENCONTRADO` → 403 → 404 `ENTRADA_NO_ENCONTRADA`
    (`EntradaNoEncontradaError`, también para un código de otro evento o con formato inválido) →
    409 `FUERA_DE_HORARIO_DE_USO` → 409 `TRANSICION_INVALIDA`) y `resenias` **mínimo** (feature 005: entidad `Resenia`,
    `RepositorioResenias.listarPorEventos` y `ReseniaService` con `puntajesPorOrganizador` /
    `puntajeDe`, sin endpoints; lo amplía la 012; vacío en el seed).
  - **Eventos públicos** (feature 005): `GET /eventos` es el catálogo (público, `CatalogoVista`:
    los no realizados filtrados por `texto` y `categoriaId` y ordenados por `orden` y `sentido`, más
    `hayEventosProximos`) y `GET /eventos/:eventoId` también es público. Toda `EventoVista` trae
    `organizador` (`OrganizadorVista` con `puntaje` sin redondear o `null` y `cantidadResenias`).
    Módulos puros del dominio: `domain/busqueda.ts` (`normalizarParaBuscar`, `palabrasDeBusqueda`:
    sin mayúsculas, acentos ni diéresis, ñ ≠ n) y `domain/orden-catalogo.ts` (`ordenarCatalogo`
    sobre elementos `Ordenable`, desempates fecha → nombre → id).
  - **Compras** (feature 006): `domain/compra.ts` es una `Compra` con **historial** de cambios de
    estado (`{ estado, autor: usuario | sistema, fechaHora }`; el estado es el del último, el primero
    siempre `PENDIENTE`) y transiciones que devuelven una `Compra` nueva (`registrar`, `pagar`,
    `cancelar` —una `PENDIENTE` por su comprador—, `vencer`, `alDia` y, en la 008, `registrarUso`).
    La 009 cambia la firma a `cancelar(usuarioId, ahora, inicioDelEvento)` (también una
    `CONFIRMADA`, hasta el inicio exclusive, con la `cancelacion` registrada en cada entrada) y suma
    `confirmarReembolso(organizadorId, ahora)` (`CANCELADA → REEMBOLSADA`) y
    `motivoNoCancelable(inicioDelEvento, ahora)` (`evento-empezado` · `entrada-usada` · `cancelada` ·
    `reembolsada` o `null`). Lo nuevo se **deriva del historial**, sin campos guardados:
    `fueConfirmada`, `canceladaDesde` (`PENDIENTE`/`CONFIRMADA` en una `CANCELADA` o
    `REEMBOLSADA`), `cambioDeCancelacion` y, desde la 010, `compra.reembolso` (`"confirmado"` en
    una `REEMBOLSADA`; `"pendiente"` en una `CANCELADA` que pasó por `CONFIRMADA` con `total > 0`;
    si no, `null`: una gratis cancelada no tiene reembolso); un `REEMBOLSADA` solo es el último
    cambio y sigue a un `CANCELADA`. Las invariantes del constructor son
    `domain/reglas-de-compra.ts` (feature 010): `REGLAS_DE_COMPRA`, una por regla, cada una con
    `nombre`, `campo`, `mensaje` y `cumple`; el constructor junta en un `DatosInvalidosError` un
    detalle por regla violada. `domain/tope-por-persona.ts` (`entradasRestantes`, `exigirTopePorPersona`)
    aplica `LIMITES_COMPRA` sobre las compras **vigentes**. `RepositorioCompras` suma `siguienteId`,
    `buscarPorId`, `listarPorEventoYComprador` y `listarPendientesPorEventos` (las guardadas
    `PENDIENTE`, vencidas o no); `existePorEvento` / `existePorTipoEntrada` cuentan toda compra,
    también una cancelada.
  - **Mis compras** (feature 007): `RepositorioCompras.listarPorComprador` (todas, de todos los
    eventos y en cualquier estado), `RepositorioEventos.listarPorIds` y `EventoService.obtenerPorIds`
    (un `Map` en una sola lectura, sin cerrojo ni cupo al día; 404 si falta alguno).
    `CompraService.misCompras` las pone al día, les busca los eventos en lote y las ordena con
    `domain/orden-mis-compras.ts` (`compararMisCompras`: las de eventos no realizados primero por
    fecha ascendente, las de realizados por fecha descendente, desempates `creadaEn` descendente →
    `id`). `domain/dias-restantes.ts` (`diasRestantes(fechaHoraEvento, ahora)`: días de calendario
    de Buenos Aires con `diaDeCalendarioDeBuenosAires` de `hora-buenos-aires.ts`, `null` si el
    evento ya empezó) solo se calcula en una `CONFIRMADA`, en cada
    consulta. `services/compra.vistas.ts` compone las vistas con piezas (feature 010):
    `estadoDeLaCompra` (estado, `canceladaDesde` y `reembolso`), `aTipoDeLaCompra`,
    `aCompradorVista` y `vencimiento`; `datosComunes` las junta para `aCompraVista` (la de la 006) y
    `aMiCompraVista`, y `aCompraDelEventoVista(compra, comprador, evento)` usa las mismas.
  - **Entradas y uso** (feature 008): cada `Compra` tiene una `Entrada` por unidad
    (`domain/entrada.ts`, re-exportada por `compra.ts`, sin id aparte: su `codigo`, y desde la 010
    su `uso` y su `cancelacion`, cada uno `{ usuarioId, fechaHora }` o `null`; getters `usada`
    —la **única** definición de "entrada usada"—, `cancelada`, `usadaEn` y `estadoPropio`, métodos
    `usar` y `cancelar`, y `motivoNoUsable(estado)`, el mensaje del 409). El código lo da el
    repositorio (`siguientesCodigosDeEntrada(cantidad)`, únicos entre todas las compras) y lo valida
    y normaliza `domain/codigo-de-entrada.ts` (8 caracteres Crockford, se muestra `XXXX-XXXX`). El
    estado de una entrada se **deriva** del de la compra hasta que se confirma; después,
    `Compra.registrarUso(codigo, organizadorId, ahora)` la pasa a `UTILIZADA` y, con la **primera**
    usada, también la compra (un único cambio `UTILIZADA` en su historial). `esVigente` incluye
    `UTILIZADA` (cuenta para el tope) y una `UTILIZADA` no se cancela. Al cancelar una confirmada
    (009), cada entrada registra su `cancelacion` (`Entrada.cancelar`); `compra.estadoDe(entrada)`
    devuelve el de la compra si nunca se confirmó y, si no, el `estadoPropio` de la entrada, y las
    reglas de `REGLAS_DE_COMPRA` exigen, en una `CANCELADA` o `REEMBOLSADA` después de confirmada,
    todas las entradas canceladas (su código ya no sirve en "Registrar ingreso"), ninguna usada o
    cancelada antes de confirmar y la compra `UTILIZADA` si alguna se usó. `domain/ventana-de-uso.ts`
    (del inicio − 4 h al inicio + 12 h, inclusive; `estadoDeVentana`: `antes` · `abierta` ·
    `despues`; `exigirVentanaAbierta`) y `domain/compras-del-evento.ts` (`resumenPorTipo` en el orden
    del evento, con las usadas de `compra.entradasUsadas`, y `compararComprasDelEvento`: `creadaEn` descendente → `id`) son puros.
    `RepositorioCompras` suma `listarPorEvento` y `buscarPorCodigoDeEntrada`.
    `EventoService.leerDelOrganizador(id, usuarioId, ahora)` es la lectura del organizador (404 →
    403 → cupo al día, sin guardar ni cerrojo). `CompraService` recibe también `UsuarioService`
    (compradores en lote) y `comprasDelEvento` hace cuatro lecturas fijas. Los códigos solo llegan
    al comprador (`CompraVista.entradas`, vacía salvo en `CONFIRMADA`/`UTILIZADA`; `entradasUsadas`
    también en `MiCompraVista`), y `mis-compras.confirmadas` incluye las `UTILIZADA`.
    `CompraService.registrarUso` toma el cerrojo del evento, lee `ahora` adentro, materializa con
    `obtenerDelOrganizador`, relee la compra por código y hace **un** `guardar`; el cupo no cambia.
  - **Cancelación y reembolso** (feature 009): las vistas suman `canceladaDesde` y `reembolso`
    (`ReembolsoVista`: `pendiente` · `confirmado` con el `monto` = total, o `null`) en
    `CompraVista`, `MiCompraVista` y `CompraDelEventoVista` (`aReembolsoVista` en
    `compra.vistas.ts`), y `cancelable`/`motivoNoCancelable` (tipo `MotivoNoCancelable` de `shared/`)
    solo en `CompraVista`, calculados al día en cada consulta. `canceladaPor` sale del cambio a
    `CANCELADA` y llega también en una `REEMBOLSADA`. `CompraService.cancelar` de una confirmada
    guarda primero la compra y después el evento con el cupo devuelto (como la de una pendiente);
    `CompraService.confirmarReembolso` lee la compra afuera solo para saber qué cerrojo tomar.
  - **Chat de la compra** (feature 011): `domain/mensaje.ts` es un `Mensaje` inmutable **sin id**
    (`autorId`, `texto` ya recortado de 1 a `LIMITES_MENSAJE.largoMaximo` y `enviadoEn` del reloj
    del servidor; su posición en la conversación lo identifica), re-exportado por `compra.ts`. Los
    mensajes viven en el agregado `Compra` y se guardan con ella (sin repositorio, service ni ids
    nuevos; `app.ts` no cambia): `compra.mensajes` (congelado, `[]` por defecto y en
    `Compra.registrar`), `enviarMensaje(autorId, texto, ahora)` (agrega al final y devuelve una
    `Compra` nueva sin tocar estado, historial, entradas ni total; vale en los seis estados) y
    `rolDe(usuarioId, organizadorId)` (`"comprador"` · `"organizador"` · `null`; no lanza: el 403 lo
    decide el service). **Toda transición conserva los mensajes** (`#propiedades()` los incluye).
    `REGLAS_DE_COMPRA` suma `mensajes-en-orden`: cada `enviadoEn` mayor o igual que el anterior y
    que el alta de la compra. `services/mensaje.vistas.ts` arma `aChatDeLaCompraVista(compra,
    evento, usuarios, usuarioId)` (encabezado con la compra al día, `otraParte` y los mensajes) y
    `aMensajeVista` (`numero` desde 1, autor con su rol, `enviadoEn` ISO y `enviadoEnLocal` de Buenos
    Aires), reusando `aTipoDeLaCompra`; sin códigos, historial, total ni `compradorId`. Las vistas de
    la compra (`CompraVista`, `MiCompraVista`, `CompraDelEventoVista`) no traen los mensajes.
  - **Vencimiento perezoso** (feature 006): una `PENDIENTE` vence a los 15 minutos sin que corra
    nada en segundo plano. `VencimientoService` (solo el agregado `Compra`) calcula el cupo liberado
    (`cupoLiberadoPorTipo`, sin guardar, **una** `listarPendientesPorEventos` por pedido) o lo
    materializa (`vencerPendientes`: guarda las `CANCELADA` del sistema fechadas en `venceEn`). Las
    **lecturas** (`EventoService.obtener`/`listar`, `GET /compras/:id`, `mis-compras`) muestran todo
    al día sin guardar nada; **toda escritura** de un evento (alta y pago de compras, ediciones de
    la 004) materializa antes con `EventoService.obtenerAlDia(id, ahora)`, y por eso
    `obtenerDelOrganizador(id, usuarioId, ahora)` recibe el `ahora` leído dentro del cerrojo. Orden
    de guardado: en el alta, primero el evento con el cupo descontado y después la compra; al vencer,
    primero las compras y después el evento con el cupo devuelto (nunca se ve cupo de más).
  - **Reloj**: `domain/reloj.ts` (interfaz `Reloj { ahora() }`) y `config/reloj.ts`
    (`relojDelSistema`). Es la única referencia de "ahora": llega a los services por constructor
    y `crearApp({ reloj })` permite fijarlo en los tests. `domain/` recibe `ahora` como
    argumento. La hora de pared de Buenos Aires (UTC−3) vive solo en `domain/hora-buenos-aires.ts`.
  - **Cerrojo por evento** (constitución, "Operaciones atómicas por evento"):
    `services/cerrojo-por-clave.ts`. `app.ts` crea **una** instancia y la comparten los services
    que modifican eventos. Reglas: (1) adentro de `cerrojo.ejecutar(eventoId, …)` se **vuelve a
    leer** el evento y el reloj, se verifica y recién después se guarda; (2) se libera siempre
    (`finally`) y el error llega al que llamó; (3) sin cerrojos anidados; (4) las lecturas no lo
    usan. Crear un evento no lo usa (su id es nuevo). El alta y el pago de una compra lo toman con
    el `eventoId` del evento (el pago, el de la compra, y relee la compra adentro).
    `EventoService.obtenerAlDia`, `TipoEntradaService.buscarReferenciada` y
    `TipoEntradaService.descontarCupo` / `devolverCupo` se usan **dentro** del cerrojo del que
    llama y no lo toman. La cancelación de una pendiente sigue el orden de guardado del vencimiento
    (primero la compra, después el evento con el cupo devuelto).
  - Orden de los chequeos de una escritura: 401 → 400 de forma → 404 evento → 403 → 404 tipo →
    400 categoría → 409 `EVENTO_REALIZADO` → otros 409. Los 404/403 los lanza el service con
    `errors/`; los 409, `domain/`.
  - **Services que se apoyan en otros** (como la referencia `2026-2c-lu-sa-grupo-1`): cada entidad
    tiene **un** service que la busca por id y lanza su 404 (`obtenerOFallar`, público); los demás
    se lo piden a él en vez de repetir la búsqueda. `TipoEntradaService` recibe `EventoService` y
    usa `obtenerDelOrganizador(id, usuarioId)` (404 + 403); `EventoService` recibe
    `CategoriaService` y valida la categoría elegida con `buscarReferenciada(id, origen)` (si no
    existe, `ReferenciaInvalidaError` → 400 sobre `body.categoriaId` con origen `"datos"` o
    `query.categoriaId` con `"consulta"`) y, para varias, le pide el lote con `obtenerPorIds` (una
    sola lectura, sin N+1). También recibe `UsuarioService` (`obtenerOFallar` público y
    `obtenerPorIds`) y `ReseniaService` para el organizador y su puntaje; `ReseniaService` recibe
    los eventos por parámetro y no depende de `EventoService` (sin ciclos). `EventoService` recibe
    también `VencimientoService`, y `CompraService` (dueño de `Compra`, con `obtenerOFallar`) recibe
    `EventoService` y `TipoEntradaService`; cada uno escribe solo su agregado. `CompraService` es el
    **único** service de casos de uso que guarda compras (la excepción es
    `VencimientoService.vencerPendientes`). `EntradaService` (feature 008; desde la 010) recibe
    `CompraService`, `EventoService` y `UsuarioService`, **no** `RepositorioCompras` ni el cerrojo.
    `app.ts` los arma en el orden `VencimientoService → EventoService →
    TipoEntradaService → CompraService → EntradaService`. Orden de
    chequeos del alta: 401 → 400 forma → 404 evento → 400 `body.tipoEntradaId` → 409
    `EVENTO_REALIZADO` → `COMPRA_PROPIO_EVENTO` → `TOPE_POR_PERSONA` → `CUPO_INSUFICIENTE`; del
    pago: 401 → 400 → 404 `COMPRA_NO_ENCONTRADA` → 403 → 409 `COMPRA_VENCIDA` →
    `TRANSICION_INVALIDA`. Los ids nuevos los da el
    repositorio (`siguienteId()`), y los órdenes son comparadores del dominio
    (`ordenDeMisEventos`, `compararPorNombre`).
  - `errors/` no conoce HTTP: cada error lleva código y mensaje, y el status lo asigna
    `statusDe` (tabla clase → status) en `middlewares/traducir-error.ts`.
  - `domain/errores.ts`: `DatosInvalidosError` y `ReglaDeNegocioError` (sin HTTP); el
    error handler los traduce a 400 y 409. `domain/` no importa `errors/` (lo controla el lint).
- `backend/tests/{domain,repositories,services,api}` — Vitest; `services/` usa los
  repositorios en memoria construidos con los datos de cada caso; `api/` usa supertest con
  `crearApp()` (repositorios nuevos por test).
- `mobile/` — Expo (SDK 58) + Expo Router + TanStack Query, organizado en **base**, **features** y
  **conectores** (feature 003). Para crear o cambiar una pantalla, usá la skill `nueva-pantalla`.
  - `app/` — **solo rutas**: cada archivo es un re-export de una línea
    (`export { Perfil as default } from "../../src/features/sesion";`); las secciones pendientes
    renderizan `<SeccionPendiente nombre="…" />`. `(tabs)/` tiene las pestañas Explorar · Mis
    compras · Mis eventos · Perfil; `seleccionar-usuario` es el selector (pantalla completa sin
    usuario, modal desde Perfil) y `cargando`, la espera inicial. Las rutas de compra (feature 006)
    son `explorar/[eventoId]/index` (el detalle con las compras), `explorar/[eventoId]/comprar/[tipoEntradaId]`,
    `explorar/[eventoId]/mis-entradas` (sus compras confirmadas del evento) y
    `compras/[compraId]/index` ("Tu compra"; desde la 011 en una carpeta, con el mismo `href`
    `/compras/[compraId]`, junto a `compras/[compraId]/chat`, "Chat de la compra"); la pestaña `(tabs)/mis-compras` re-exporta `MisCompras` (feature 007), y las del
    organizador (feature 008) son `eventos/[eventoId]/compras` (`ComprasDelEvento`) y
    `eventos/[eventoId]/ingreso` (`RegistrarIngreso`). El lint prohíbe importar
    `react`, `react-native`, `@tanstack/react-query`, `@expo/vector-icons` o `expo-router` en `app/`.
  - **Base** (no importa features):
    - `src/api/` — el cliente HTTP y un archivo por recurso con sus funciones de endpoint,
      exportados por `index.ts`. **Todo `fetch` vive acá** (el lint lo prohíbe en el resto de
      `mobile/`). `pedir(metodo, ruta, { cuerpo, signal, usuarioId })` y los atajos
      `get/post/put/patch/delete`: agrega `X-Usuario-Id`, manda el cuerpo como JSON, resuelve
      `undefined` ante un 204 y traduce errores a `ErrorDeApi` / `ServidorNoDisponibleError`.
      Un endpoint de escritura es una línea: `cliente.post<EventoVista>("/eventos", datos)`. Las
      escrituras **no se reintentan solas** (`mutations.retry: false`; la secuencia solo vuelve a
      pedir queries).
    - `src/consultas/` — `QueryClient` (sin reintentos propios; todo error de query o mutation va a
      la sesión vía `QueryCache`/`MutationCache`), claves en `claves.ts` (`catalogo` es la excepción
      documentada: **sin usuario**, porque el catálogo es el mismo para todos; la 006 suma
      `misComprasDelEvento(usuarioId, eventoId)` y `compra(usuarioId, compraId)`, y la 007,
      `misCompras(usuarioId)`, con el usuario en la posición 1 y sin compartir prefijo con
      `mis-compras-del-evento`; la 008, `comprasDelEvento(usuarioId, eventoId)` y
      `entradaDelEvento(usuarioId, eventoId, codigo)`; la 011, `chatDeLaCompra(usuarioId, compraId)`
      → `["chat-de-la-compra", usuarioId, compraId]`, sin prefijo común con `["compra"]`) y `cliente-api.tsx`
      (`ClienteApiProvider`, `useClienteApi()`), contrato que provee la sesión.
    - `src/conexion/` — contrato `EstadoConexion` + `ConexionProvider` + `useConexion()`; lo provee
      la sesión y lo leen la franja y `SegunConsulta`.
    - `src/componentes/` — `tema` (sistema visual "Pop Brutal": colores, espacios, `tipografia`,
      fuentes, radios, grosores, `tamano`, `sombra` dura con `boxShadow`, opacidad: nada suelto),
      `fuentes` (Archivo y Archivo Black, que `RaizDeLaApp` carga con `useFonts`), `hundido` (lo que
      se desplaza al presionar un elemento con sombra), `Boton` (`primario` · `aviso` = secundaria
      sobre superficie · `texto`), `Ilustracion`, `SegunConsulta` (los cuatro estados; `cargando` y
      `vacio` opcionales reemplazan a `Cargando` y a `ListaVacia`), `Cargando`, `MensajeError`,
      `ListaVacia` (con `accion` opcional), `SeccionPendiente`, `PantallaDesplazable` (scroll de las pantallas
      apiladas con header: margen sobre la barra de navegación del sistema y teclado que no tapa el
      campo; úsenla en vez de un `ScrollView` suelto; con `empezarAlFinal`, desde la 011, baja al
      final cada vez que cambia el tamaño del contenido), `EtiquetaEstadoCompra` (el **único**
      componente que muestra el estado de una compra, con su etiqueta y color), la franja, `Logo` y `CargandoInicio`
      (la ruta `cargando`); todo por `index.ts`. Los textos usan un estilo de `tema.tipografia`
      (`...tema.tipografia.cuerpo, color: …`): con fuentes propias el peso es la familia, nunca
      `fontWeight`. El primario es azul (`marca`, el verde exacto del logo, solo para acentos sin
      texto encima); el `resaltado` amarillo lleva siempre `texto` encima; los estados de compra usan
      `exito` (CONFIRMADA, UTILIZADA), `peligro` (CANCELADA, REEMBOLSADA) y `advertencia`
      (PENDIENTE), cada uno con su `sobre…`, y siempre junto a la etiqueta del estado.
  - **Features** — `src/features/<dominio>/` con `pantallas/`, `componentes/`, hooks de consulta,
    `formato.ts` (textos derivados puros) e `index.ts`, su **único punto de entrada público**:
    - `usuarios/` — `useUsuarios`, `FilaUsuario`, `nombreCompleto`, `textoEventosOrganizados`;
    - `sesion/` — usuario actual (reducer puro + controlador sin React + `SesionProvider`), usuario
      recordado en AsyncStorage y su validación, la secuencia única de reintentos (1, 2, 4, 8, 16,
      32 s), `useSesion()` y las pantallas `SeleccionarUsuario` y `Perfil`;
    - `categorias/` — `useCategorias`;
    - `eventos/` — Explorar (la pestaña de inicio: buscador con `useValorDemorado` de 500 ms,
      `BotonCategoria` (a la derecha del buscador) que abre `SelectorCategoria` en modo `conTodas` como
      desplegable, `SelectorOrden` (tocar el elegido invierte el `sentido`), `TarjetaEvento`/`TarjetaSkeleton` y
      `useCatalogo`), el detalle público `DetalleEvento` (lo monta `DetalleEventoConCompras` de `compras` en
      `explorar/[eventoId]/index`, `FilaImagenes`;
      ante un 404 llama a `useInvalidarCatalogo`), Mis eventos, Crear evento, `EventoDelOrganizador`
      (edita o muestra en solo lectura según el `realizado` del servidor), los formularios de tipo
      de entrada, `useMisEventos`/`useEvento`, las mutations de `mutaciones.ts` (en nombre del
      usuario **del formulario**, invalidan al terminar, también `["catalogo"]`), `fecha-de-pared.ts` (selector ⇄ `"YYYY-MM-DDTHH:mm"`,
      sin convertir zonas), `errores-de-formulario.ts` (la app no valida: muestra los detalles del
      400 junto a cada campo) y `useConfirmarDescarte` ("¿Descartar los cambios?" al salir de un
      formulario **solo si hay cambios** (`hayCambios`, con `mismosValores` de `formulario.ts`), con `usePreventRemove`; `salirSinConfirmar(navegar)` tras guardar o ante un 404).
      `DetalleEvento` acepta `complementos` opcionales (`ComplementosDelDetalle`: `AccionDeTipo` al
      lado de cada tipo, vía la prop `accionDeTipo` de `ListaTiposEntrada`, y `SeccionPropia` antes
      de "Tipos de entrada"): así otra feature le suma cosas **sin que `eventos` la importe**;
    - `compras/` (feature 006; **depende de `eventos`** por su `index.ts`, nunca al revés: el lint
      lo rechaza como ciclo) — `DetalleEventoConCompras` (el detalle con "Comprar" por tipo, "Sos el
      organizador de este evento", "Ver mis entradas" y "Tus compras pendientes" con "Pagar" y
      "Cancelar"), `MisEntradasDelEvento`, `ComprarEntradas` (`SelectorCantidad`
      y total estimado; el tope lo informa el servidor en `restantesPorTipo`), `Compra` ("Tu compra":
      `ResumenCompra`, "Pagar"/"Confirmar" y "Cancelar compra" en una `PENDIENTE`; "Volver al evento"
      va a `explorar/[eventoId]` con `dismissTo`, también si se llegó desde "Mis compras"; dibujada siempre desde `useCompra`, así un pago con la
      respuesta perdida muestra el estado real), `useMisComprasDelEvento`/`useCompra`, las mutations
      `useComprarEntradas`/`usePagarCompra`/`useCancelarCompra` (sin reintentos; al terminar invalidan el evento para
      todos los usuarios, `misComprasDelEvento`, `misCompras`, la compra y `["catalogo"]`) y
      `formato.ts` (con `textoAccionDePago`, "Pagar"/"Confirmar", que comparten "Tu compra" y la
      lista). La 007 suma la pestaña `MisCompras` (`useMisCompras`, `SegunConsulta`, vacío con "Ir
      a Explorar") con una `FilaMiCompra` por compra (los datos tocables abren "Tu compra"; en una
      `PENDIENTE`, "Pagar" va **como hermano** de ese `Pressable`, nunca adentro, para que TalkBack
      los enfoque por separado), avisos por estado (`textoAvisoDeMiCompra`, `textoDiasRestantes`) y
      la lista al día: vuelve a pedirse en cada foco salvo el primero (`useFocusEffect`) y al
      vencer la próxima pendiente (`useRefrescarAlVencer` con `vencimientos.ts`). La 008 suma, para
      el organizador, `ComprasDelEvento` (ventana de uso, `ResumenPorTipo` con "Agotado" y una
      `FilaCompraDelEvento` no tocable por compra; vacío "Todavía nadie compró entradas" sin tapar
      el resumen) y `RegistrarIngreso` (desde la 010, en dos piezas internas: `BuscadorDeCodigo`
      —el campo y "Buscar"— y `ResultadoDeIngreso` —`TarjetaEntrada`, el motivo de
      `textoMotivoNoUsable` en lugar del botón o "No hay ninguna entrada…"—; la pantalla busca con
      `useEntradaDelEvento` y confirma con `Alert`); la mutation `useRegistrarUso` (sin reintentos)
      invalida `comprasDelEvento`, la entrada y, **por prefijo**, `["compra"]`, `["mis-compras"]` y
      `["mis-compras-del-evento"]` (el comprador es otro usuario que puede estar en la caché); no el
      evento ni el catálogo, porque el uso no cambia el cupo (010). Las dos pantallas se refrescan al
      volver con `useRefrescarAlFocalizar` (compartido con `MisCompras`) y ante un 404 del evento
      salen a "Mis eventos" con `useSalirSiNoExisteElEvento` (`evento-inexistente.ts`). Para el
      comprador, `ListaDeEntradas` muestra los códigos ("Tus entradas") en "Tu compra" y en "Ver mis
      entradas", y "N de M entradas usadas" acompaña a una `UTILIZADA`. La 009 suma, en "Tu
      compra", la sección `Cancelacion` de una confirmada: "Cancelar compra" solo si el servidor dice
      `cancelable` (confirmado con `Alert` y `textoConfirmarCancelacion`; un 409 se muestra con el
      mensaje del servidor) o, en su lugar, el motivo de `textoMotivoNoCancelable`, y "Te devolvimos
      $ N" en una `REEMBOLSADA`; avisos de reembolso pendiente o confirmado en las tres listas. Para
      el organizador, "Confirmar reembolso" en `FilaCompraDelEvento` (solo con `reembolso.estado ===
      "pendiente"`), **como hermano** del bloque accesible de la fila, con la mutation
      `useConfirmarReembolso(usuarioId, eventoId)` (`confirmarReembolso` de `src/api`, sin
      reintentos; una para todas las filas, con la fila en curso en `variables`), que invalida
      `comprasDelEvento` y, por prefijo, `["entrada-del-evento"]`, `["compra"]`, `["mis-compras"]` y
      `["mis-compras-del-evento"]` (no el evento ni el catálogo: el cupo no cambia).
      Pagar y cancelar en "Tu compra" y "Confirmar reembolso" envían con `useEnvioUnico` (010:
      una marca sincrónica, porque el `Alert` responde antes de que se vuelva a dibujar: un
      segundo toque no manda otro pedido). `useCancelarCompra` invalida además, por prefijo,
      `["compras-del-evento"]` y `["entrada-del-evento"]` (lo del organizador). "Ver compras", en la edición
      y la solo lectura del evento propio, está en `eventos` y navega **por la ruta tipada** (sin
      importar `compras`). La 011 suma `ChatDeLaCompra` ("Chat de la compra", en
      `PantallaDesplazable` con `empezarAlFinal`): `EncabezadoDelChat` (evento, "Con … · <rol>",
      tipo y cantidad, `EtiquetaEstadoCompra`), un `MensajeDelChat` por mensaje (propio a la derecha
      como "Vos" sobre `resaltado`, ajeno a la izquierda con nombre y rol; cada uno un elemento
      accesible con `etiquetaDelMensaje`), "Todavía no hay mensajes" sin tapar encabezado ni campo, y
      el `CampoDeTexto` "Mensaje" con "Enviar" (`useEnvioUnico`; la app no valida: el 400 va junto al
      campo y conserva el texto); un 403/404 al leer lo muestra `AvisoDeLaCompra` (compartido con "Tu
      compra"). `useChatDeLaCompra` y `useEnviarMensaje(usuarioId, compraId)` (sin reintentos;
      invalida **solo** `["chat-de-la-compra", *, compraId]`, para todos los usuarios de la caché, y
      nada más: un mensaje no cambia la compra); la pantalla se refresca al volver con
      `useRefrescarAlFocalizar`, sin sondeo. `usePagarCompra`, `useCancelarCompra`,
      `useRegistrarUso` y `useConfirmarReembolso` invalidan además, por prefijo,
      `["chat-de-la-compra"]` (el encabezado muestra el estado). Los accesos son "Chat con el
      organizador" en "Tu compra" (en todos los estados) y "Abrir chat" en cada
      `FilaCompraDelEvento`, **como hermano** del bloque accesible de la fila.
  - **Conectores** (los únicos fuera de `features/` que importan features):
    - `src/composicion.ts` — **composition root** de la app, sin contexto: `crearDependencias({
      fetch, almacenamiento, urlEntorno, hostUri })` y `crearDependenciasDeProduccion()` arman la
      dirección, el `QueryClient`, el usuario recordado y la fábrica del cliente
      (`Dependencias = DependenciasSesion`), que llegan por props a `SesionProvider`.
    - `src/navegacion/` — `RaizDeLaApp` (dependencias de producción), `LayoutRaiz` (providers,
      franja de servidor no disponible y el `Stack` con los guards `Stack.Protected` por fase de
      la sesión) y `LayoutPestanas` (pestañas e íconos).
  - **Reglas de dependencia** (las verifica el lint con `eslint-plugin-import-x`, y
    `tests/arquitectura/reglas-de-dependencia.test.ts` comprueba que fallan cuando corresponde):
    (1) sin ciclos (`import-x/no-cycle`); (2) la base no importa features; (3) desde afuera de una
    feature solo se importa su `index.ts`, y adentro, por archivo (nunca el `index.ts` propio);
    (4) `app/` sin lógica, estado ni estilos. Imports relativos, sin alias `@/`; dentro de la base,
    lo de la misma carpeta por archivo y lo de otra carpeta por su `index.ts`.
  - **Rutas tipadas** (`experiments.typedRoutes`): `npm run typecheck` de `mobile/` corre primero
    `scripts/generar-tipos-rutas.js` (genera `.expo/types/router.d.ts` sin levantar Expo) y después
    `tsc`; una ruta mal escrita no compila, también en el CI. `tests/tipos/rutas-tipadas.ts` es la
    guarda (`@ts-expect-error` sobre una ruta inexistente).
  - `tests/` — Jest + React Native Testing Library, sin red: `helpers/` tiene
    `renderConDependencias` (la app real con `fetch` falso; si un test no registra lo que pide
    Explorar al entrar —el catálogo y las categorías—, el detalle —`mis-compras`— o la pestaña
    "Mis compras" —`GET /compras`— responde vacío) y `crearFetchFalso`/`porRuta`
    (registra método, encabezados y cuerpo). Tests por capa en `api/`, `componentes/`, `consultas/`,
    `conexion/` y `pantallas/`, y los de cada feature en `features/<dominio>/`.
- `specs/NNN-slug/` — spec, plan, research, data-model, contracts y tasks de cada feature.

## Comandos

Desde la raíz del repo:

| Comando | Efecto |
|---|---|
| `npm install` | instala todos los workspaces (`backend`, `shared`, `mobile`) |
| `npm start` | arranca el servidor con los datos de ejemplo en memoria |
| `npm run dev` | igual, recargando ante cambios (cada recarga vuelve a los datos de ejemplo) |
| `npm run mobile` | arranca Metro (`expo start`) para abrir la app con Expo Go (ver README) |
| `npm test` · `npm run lint` · `npm run typecheck` | calidad, en todos los paquetes (sin caché, como el CI) |
| `npm run format` · `npm run format:check` | Prettier (escribe / verifica); no toca los `.md` |
| `npm run test:foco -w backend -- <archivos>` | Vitest solo sobre esos tests, salida `dot` |
| `npm run test:afectados -w backend` | Vitest sobre los tests que dependen de lo que cambió sin commitear (`--changed`) |
| `npm run test:foco -w mobile -- <archivos>` | Jest solo sobre esos tests, `--silent` |

### Cuándo se corre cada cosa (constitución, "Verificación durante el desarrollo")

| Momento | Qué se corre |
|---|---|
| Cada ciclo rojo/verde de TDD | **solo** el test de la tarea: `test:foco` con su archivo (o `test:afectados` en el backend) |
| Fin de cada turno | el hook `Stop` (automático, ver abajo) |
| Al cerrar una fase de `tasks.md` y antes del PR | la suite completa: `npm test`, `npm run lint`, `npm run typecheck` y `npm run format:check` en verde |
| Cada PR y cada push a `development`/`main` | el CI (`.github/workflows/ci.yml`): todo, sin caché |

- Se corre el test por archivo y no la suite: la suite de mobile tarda entre 1 y 1,5 minutos;
  un test de mobile de lógica pura, ~4 s, y uno de `tests/pantallas/` (renderiza la app), entre 10
  y 20 s; un test del backend, ~4 s.
- En `mobile/`, `jest --findRelatedTests` / `-o` **no sirven para las pantallas**: los tests de
  `tests/pantallas/` llegan a ellas a través de las rutas de `app/` (que Expo Router carga con
  `require.context`), así que Jest no las relaciona. Se nombra el archivo del test.
- Un cambio en `shared/` lo consumen los dos paquetes: los tests de mobile no lo detectan con
  `-o`; se corren los tests que lo usan o la suite completa.
- Los tests focalizados no reemplazan a la suite: un cambio puede romper un test de otra
  pantalla. Por eso la suite completa al cerrar cada fase.

### Hook `Stop`

Un hook `Stop` de Claude Code (`.claude/settings.json` → `.claude/hooks/verificar-al-terminar.mjs`)
verifica tipos y lint al terminar cada turno y, si fallan, **no deja cerrar el turno** hasta
corregirlos. Compara cada archivo con la última verificación exitosa y verifica solo lo afectado:

| Cambió | Typecheck | Lint |
|---|---|---|
| solo `.md` | nada | nada |
| `backend/` | backend | `backend/` |
| `mobile/` | mobile (regenera las rutas tipadas solo si cambió `mobile/app/`) | `mobile/` |
| `shared/` | shared, backend y mobile | los tres |
| `eslint.config.js`, `tsconfig.base.json`, `package.json`, `package-lock.json` | los tres | todo el repo |
| otro `.js`/`.mjs`/`.ts` de la raíz (por ejemplo, el hook) | — | ese archivo |

Usa `tsc --incremental` y `eslint --cache --cache-strategy content`, con las cachés en
`node_modules/.cache/` (fuera de git), y corre typecheck y lint en paralelo. **No corre tests**:
esos van según la tabla de arriba. Si sospechás de la caché, borrá `node_modules/.cache/` o corré
`npm run typecheck` / `npm run lint`, que no la usan.

### TDD con stub

Como el hook bloquea el turno con el typecheck en rojo, en TDD el test y un **stub con la firma
real** del módulo que importa (que lanza `new Error("no implementado")`) se escriben en el mismo
turno: el typecheck queda en verde y el test falla por comportamiento, no por un import
inexistente. El rojo se comprueba con `test:foco` sobre ese test, y el verde, con el mismo comando.
Vale igual en `mobile/`: el test de una pantalla, hook o función de `src/api/` va en el mismo
turno que el stub de lo que importa (la pantalla con su export con nombre y la ruta de `app/` con
su re-export, el hook o la función con su firma real).

### Implement por fases

- `/speckit-tasks` **agrupa las tareas triviales** en una sola: los stubs con firma real y los
  re-exports de `app/` van junto con el test que los necesita (o en una tarea "stubs y rutas de la
  fase"), no una tarea por archivo.
- `/speckit-implement` se corre **de a una fase de `tasks.md`** (por ejemplo,
  `/speckit-implement fase 3`), con **contexto limpio entre fases** (`/clear`): lo que la fase
  siguiente necesita está en `tasks.md`, el plan y el código, no en la conversación. Cada fase
  cierra con la suite completa en verde, las tareas marcadas en `tasks.md` y su commit.

## Convención de nombres (repositories y services)

| Capa | Método | Devuelve / hace |
|---|---|---|
| Repository | `listar()` | todas las entidades |
| Repository | `buscarPorId(id)` · `buscarPor<Criterio>(...)` | la entidad o `null` (nunca lanza 404) |
| Repository | `listarPor<Criterio>(...)` | las entidades que cumplen el criterio (arreglo, posiblemente vacío) |
| Repository | `listarPorIds(ids)` | las que existen de esos ids, sin repetir (para las búsquedas en lote; categorías y usuarios) |
| Repository | `contarPor<Criterio>(...)` · `existe<Algo>(...)` | números / booleanos |
| Repository | `guardar(entidad)` · `eliminarPorId(id)` | persistencia |
| Repository | `siguienteId()` | un id nuevo para una entidad (el service no genera ids) |
| Service | `listar()` · `obtener(id)` · `crear(datos)` · `actualizar(id, datos)` · `eliminar(id)` | casos de uso para el controller (devuelven vistas); `obtener` lanza 404 |
| Service | `obtenerOFallar(id)` | la **entidad**; **único** lugar que la busca por id y lanza 404. Público si otro service la necesita (si no, `#obtenerOFallar`) |
| Service | `obtenerPorIds(ids)` | búsqueda en lote para otro service: un `Map` por id en una sola lectura; si falta alguna, 404 |
| Service | `buscarReferenciada(id)` | la entidad a la que apunta un dato de la entrada; si no existe, `ReferenciaInvalidaError` (400 sobre el campo) |

