# Research: Comprar entradas (006)

Decisiones de diseño de la feature, en el formato de la 004 y la 005: **Decision**, **Rationale**
y **Alternatives considered**. Primero las de backend (R1–R11) y después las de mobile
(R12–R19). Repiten los patrones de la 004 y la 005 salvo donde se dice lo contrario.

## R1. Endpoints: la compra nace bajo el evento y se opera como recurso propio

- **Decision**:

  | Método y ruta | Usuario | Qué hace |
  |---|---|---|
  | `POST /api/eventos/:eventoId/compras` | sí | alta de la compra (`{ tipoEntradaId, cantidad }`) → `201 CompraVista` `PENDIENTE` |
  | `GET /api/eventos/:eventoId/mis-compras` | sí | las compras pendientes no vencidas del usuario actual en ese evento y cuántas entradas más puede comprar de cada tipo → `200 MisComprasDelEventoVista` |
  | `GET /api/compras/:compraId` | sí (solo el comprador) | la compra, con su estado al día → `200 CompraVista` |
  | `POST /api/compras/:compraId/pago` | sí (solo el comprador) | pago simulado, sin cuerpo → `200 CompraVista` `CONFIRMADA` |

  - El `eventoId` va en la **ruta** del alta: un evento inexistente es `404 EVENTO_NO_ENCONTRADO`
    (US3-6). El `tipoEntradaId` va en el **cuerpo**: es una referencia de la entrada y, si no es
    de ese evento, `400 ENTRADA_INVALIDA` sobre `body.tipoEntradaId` (constitución, principio III;
    US3-5 "no existe en ese evento").
  - `mis-compras` es del comprador; la 008 usará `GET /api/eventos/:eventoId/compras` para el
    organizador (todas las compras del evento). Nombres distintos, sin parámetros que cambien el
    significado del recurso.
  - El pago es un sub-recurso (`/pago`) y no un `PATCH { estado }`: un `PATCH` genérico invita a
    pedir cualquier transición; la 009 sumará `POST /compras/:compraId/cancelacion` con el mismo
    criterio.
- **Rationale**: plural y kebab-case (principio V). El organizador y la persona que compra
  consultan cosas distintas del mismo evento, y cada endpoint devuelve solo lo que su usuario
  puede ver.
- **Alternatives considered**: `POST /api/compras { eventoId, tipoEntradaId, cantidad }` (el evento
  inexistente sería un 400 de referencia, no el 404 que pide la spec);
  `POST /api/eventos/:eventoId/tipos-entrada/:tipoId/compras` (el tipo inexistente sería un 404 y
  la ruta queda larga para lo que aporta); un `GET /api/compras?eventoId=…&estado=PENDIENTE`
  genérico (adelanta el listado de la 007 y no trae el tope).

## R2. Orden de los chequeos y códigos de error

- **Decision**:
  - **Alta**: `401` → `400` de forma (`cantidad` entero de 1 a 4; `tipoEntradaId` con forma de id)
    → `404 EVENTO_NO_ENCONTRADO` → `400` `body.tipoEntradaId` "No existe el tipo de entrada en este
    evento." → `409 EVENTO_REALIZADO` → `409 COMPRA_PROPIO_EVENTO` → `409 TOPE_POR_PERSONA` →
    `409 CUPO_INSUFICIENTE`. Es el orden de FR-007 y el de AGENTS.md ("400 de referencia → 409
    `EVENTO_REALIZADO` → otros 409").
  - **Pago**: `401` → `400` id → `404 COMPRA_NO_ENCONTRADA` → `403 SIN_PERMISO` →
    `409 COMPRA_VENCIDA` → `409 TRANSICION_INVALIDA`. El pago **no** mira si el evento empezó:
    una compra pendiente no vencida se paga aunque haya empezado (R9). Una compra ya confirmada
    responde "no está pendiente", que es lo que la app necesita para recuperar el estado real
    (FR-021).
  - **Ver una compra**: `401` → `400` id → `404 COMPRA_NO_ENCONTRADA` → `403 SIN_PERMISO`.
  - **Mis compras del evento**: `401` → `400` id → `404 EVENTO_NO_ENCONTRADO`.
  - Los 404 y 403 los lanzan los services con `errors/`; los 409, el dominio con
    `ReglaDeNegocioError`. Mensajes en [contracts/api.md](./contracts/api.md).
  - `TRANSICION_INVALIDA` es genérico a propósito: la 008 (`UTILIZADA`) y la 009 (`CANCELADA`,
    `REEMBOLSADA`) lo reutilizan.
- **Rationale**: tope antes que cupo, como lo enumera la spec: el tope depende solo de la persona
  (y no de lo que compren otros a la vez), y el mensaje de cupo ("quedan N") sirve cuando, por su
  tope, esa persona podría comprar más.
- **Alternatives considered**: cupo antes que tope (con cupo 0 y tope agotado, "no quedan
  entradas" es igual de cierto; se prefirió seguir el orden de la spec); 404 para el tipo
  inexistente (el tipo no es el recurso pedido, sino un dato del cuerpo).

## R3. Vencimiento a los 15 minutos: perezoso, sin temporizadores (FR-014, FR-014a)

- **Decision**:
  - Una compra `PENDIENTE` **está vencida** si `ahora ≥ creadaEn + 15 min` (reloj del servidor;
    a los 15 minutos exactos ya venció). Es un cálculo puro del dominio
    (`Compra.estaVencida(ahora)`, `Compra.venceEn`).
  - **Lecturas** (sin cerrojo): se muestran **al día**. `Compra.alDia(ahora)` devuelve la compra
    ya vencida (`CANCELADA` con el cambio del sistema fechado en `venceEn`) sin guardarla, y el
    cupo de cada tipo se muestra sumándole las entradas de sus compras pendientes vencidas
    (`Evento.devolverCupos(…)` sobre la instancia leída, sin guardarla). Así el detalle, Explorar
    (cupo y "Agotado") y el alta ven el cupo liberado aunque nadie haya consultado la compra
    vencida (FR-014a).
  - **Escrituras sobre un evento** (bajo su cerrojo): antes de verificar nada, se **materializa**
    el vencimiento de sus compras pendientes vencidas: se guardan `CANCELADA` (cambio del sistema
    en `venceEn`) y después se guarda el evento con el cupo devuelto. Lo hacen **todas** las
    escrituras del evento (alta y pago de compras, y también editar el evento, eliminarlo y
    agregar, editar o quitar tipos), con el mismo `ahora` que usa la operación.
  - Una compra se materializa **una sola vez**: solo se vencen las que siguen `PENDIENTE` en el
    repositorio, y todo pasa bajo el cerrojo del evento (FR-014a, "su cupo se devuelve una sola
    vez").
  - El cambio de estado del vencimiento se fecha en `venceEn`, no en el momento en que se
    materializa: el historial dice cuándo venció de verdad (FR-014) y la lectura al día y la
    materializada coinciden.
- **Rationale**:
  - Por qué materializar también en las ediciones del organizador: si el organizador viera
    el cupo al día (por ejemplo, 10 = 8 guardadas + 2 vencidas) y guardara 10 sin materializar,
    la próxima lectura le volvería a sumar las 2. Materializar antes de cada escritura deja el
    cupo guardado igual al que se mostró.
  - Es determinista con el reloj inyectado (`crearApp({ reloj })`): los tests mueven el reloj
    15 minutos y verifican, sin temporizadores falsos.
- **Alternatives considered**:
  - `setTimeout` por compra o un barrido periódico: no es determinista en los tests, el `Reloj`
    no es un planificador, deja timers vivos entre instancias de la app, y de todos modos el pago
    necesita el chequeo exacto del límite.
  - Materializar también en las lecturas: obligaría a escribir (y a tomar el cerrojo) en un
    `GET`, contra la regla 4 del cerrojo.
  - Calcular el cupo como `cupo inicial − compras vigentes`: cambia el significado del cupo de la
    004 (que es el **disponible** y lo edita el organizador) y de la constitución ("disminuye en
    la cantidad de cada compra que se registra").

## R4. Services: dueños, dependencias sin ciclos y escritura de cada agregado

- **Decision**: grafo (de quien usa a su dueño; lo conecta `app.ts`, en este orden):

  ```text
  VencimientoService ──► RepositorioCompras
  EventoService ───────► VencimientoService (+ categorías, usuarios, reseñas, como en la 005)
  TipoEntradaService ──► EventoService
  CompraService ───────► EventoService, TipoEntradaService, RepositorioCompras
  ```

  - **`CompraService`** es el **dueño** de `Compra`: `obtenerOFallar(id)` (404) y los casos de uso
    `crear`, `obtener`, `pagar` y `misComprasDelEvento`.
  - **`VencimientoService`** (`services/vencimiento.service.ts`) es la pieza de abajo que el
    dueño del evento necesita y que no puede pedirle a `CompraService` sin formar un ciclo:
    `cupoLiberadoPorTipo(eventoIds, ahora)` (lectura: entradas de las compras pendientes vencidas,
    por tipo) y `vencerPendientes(eventoId, ahora)` (escritura bajo el cerrojo del que llama:
    guarda las vencidas como `CANCELADA` y devuelve el cupo liberado por tipo). Trabaja solo sobre
    el agregado `Compra` (`listarPendientesPorEventos` y `guardar`).
  - **`EventoService`** suma:
    - `obtenerAlDia(id, ahora)`: 404 → `vencerPendientes` → si liberó cupo, guarda el evento con
      `evento.devolverCupos(…)` → lo devuelve. Se llama **dentro** del cerrojo del evento.
    - `obtenerDelOrganizador(id, usuarioId, ahora)`: suma `ahora` y llama a `obtenerAlDia`
      después del 404 y del 403 (un pedido sin permiso no materializa nada).
    - `obtener` y `listar` aplican `cupoLiberadoPorTipo` a lo que muestran (una lectura en lote
      por pedido, sin N+1).
  - **`TipoEntradaService`** (dueño de los tipos dentro del evento) suma, para usar **dentro** del
    cerrojo que ya tomó quien llama (sin cerrojos anidados):
    - `buscarReferenciada(evento, tipoId)`: el tipo, o `ReferenciaInvalidaError("tipoEntradaId",
      "No existe el tipo de entrada en este evento.")`;
    - `descontarCupo(evento, tipoId, cantidad, ahora)`: `evento.descontarCupo(…)` (realizado →
      cupo) y guarda con `RepositorioEventos`.
  - Las escrituras de la 004 leen `ahora` **una vez** dentro del cerrojo, antes de
    `obtenerDelOrganizador`, y usan ese mismo valor para la operación.
- **Rationale**: la constitución pide un dueño por entidad, sin ciclos, y que cada service
  escriba solo su agregado. Una compra cambia dos agregados (el cupo del evento y la compra):
  `CompraService` guarda la compra y le pide al dueño del tipo que guarde el cupo, todo bajo el
  mismo cerrojo. El vencimiento lo necesita el dueño del evento antes de cualquier escritura; si
  viviera en `CompraService`, `EventoService → CompraService → EventoService` sería un ciclo.
- **Alternatives considered**: que `EventoService` cancele compras con `RepositorioCompras`
  (escribe un agregado ajeno); un `EventoService.guardar(evento)` genérico para que
  `CompraService` guarde el cupo (deja que otro service decida qué se guarda en el evento sin
  pasar por las reglas del dueño); poner todo en `CompraService` (ciclo).

## R5. `Compra` con historial: estado y alta derivados

- **Decision**:
  - `Compra` guarda `historial: CambioEstadoCompra[]` (no vacío, el primero `PENDIENTE`, fechas no
    decrecientes) y **deriva** `estado` (el del último cambio) y `creadaEn` (la fecha del primero).
    Se quitan `estado` de las propiedades del constructor: no hay dos fuentes de verdad.
  - `CambioEstadoCompra { estado, autor, fechaHora }` con `autor` = `{ tipo: "usuario", usuarioId }`
    o `{ tipo: "sistema" }` (FR-015; el vencimiento lo hace el sistema).
  - Operaciones (devuelven una `Compra` nueva, como `Evento`): `Compra.registrar(…)` (fábrica de
    alta: `PENDIENTE` por el comprador en `ahora`, total = precio × cantidad), `pagar(usuarioId,
    ahora)` (sin chequeo del evento: R9), `vencer()` y `alDia(ahora)`. Consultas: `venceEn`,
    `estaVencida(ahora)`, `fueVencida()` (`CANCELADA` por el sistema), `esVigente(ahora)`
    (`PENDIENTE` no vencida o `CONFIRMADA`) y `esGratis()` (`total === 0`).
  - Las transiciones válidas en esta feature son `PENDIENTE → CONFIRMADA` (pago) y
    `PENDIENTE → CANCELADA` (vencimiento); cualquier otra lanza `TRANSICION_INVALIDA`.
- **Rationale**: la entidad protege sus invariantes al construirse (principio III); derivar el
  estado del historial hace imposible un estado sin su cambio registrado.
- **Alternatives considered**: guardar `estado` y `historial` por separado (dos fuentes que
  pueden divergir); `autorId: string | null` con `null` = sistema (menos explícito en el contrato).

## R6. Tope por persona: función pura y "restantes" que da el servidor (FR-002, FR-002a)

- **Decision**:
  - `domain/tope-por-persona.ts` (puro):
    - `entradasRestantes(tipo, vigentes)`: si el tipo es gratis (`precio === 0`), `1 −` las
      entradas de compras vigentes **de ese tipo** con total 0; si es pago, `4 −` las entradas de
      compras vigentes del evento con total > 0. Nunca menos de 0.
    - `exigirTopePorPersona(tipo, cantidad, vigentes)`: `409 TOPE_POR_PERSONA` si `cantidad`
      supera las restantes, con un mensaje que dice cuántas quedan.
  - Una compra cuenta como gratis por **su total** (lo que pagó), y el tope se evalúa con el
    **precio vigente** del tipo pedido (edge case "Tope y precio cambiado").
  - Los límites viven en `shared/` (`LIMITES_COMPRA = { entradasPorEvento: 4,
    entradasPorTipoGratis: 1, minutosParaPagar: 15 }`): los usan la validación (máximo 4 por
    pedido), el dominio y los textos de la app.
  - `GET /eventos/:eventoId/mis-compras` responde `restantesPorTipo` para **todos** los tipos del
    evento. Para el organizador de ese evento, `0` en todos (no puede comprar; FR-008). La app usa
    `min(cupo, restantes)` como máximo del selector y no repite la regla del tope.
  - El tope se verifica dentro del cerrojo del evento, con las compras releídas
    (`listarPorEventoYComprador`): dos compras simultáneas de la misma persona se evalúan una
    sobre la otra.
- **Rationale**: la regla vive en un solo lugar (el dominio) y la app solo muestra lo que el
  servidor calcula, como con "realizado".
- **Alternatives considered**: que la app calcule el tope con las compras que ve (duplica la
  regla, y la app no ve las confirmadas hasta la 007); exponer el tope en la `EventoVista`
  pública (es un dato del usuario actual, y el detalle es público).

## R7. Pago simulado y reintento (FR-011 a FR-013, FR-021)

- **Decision**:
  - `CompraService.pagar(compraId, usuarioId)`: lee la compra (404) para saber su evento y, bajo
    el cerrojo de **ese** evento: lee `ahora`, `obtenerAlDia(evento)` (materializa también esta
    compra si venció), **relee** la compra, 403 si no es suya, `compra.pagar(…)` y guarda.
  - Dos pagos simultáneos de la misma compra: el segundo, ya dentro del cerrojo, la relee
    `CONFIRMADA` y responde `409 TRANSICION_INVALIDA`; hay un único cambio a `CONFIRMADA`
    (FR-013).
  - El servidor no es idempotente con el pago (pagar dos veces es un 409, US2-5): la
    recuperación del estado real la hace la app (R17).
- **Rationale**: misma regla del cerrojo que el resto (releer adentro, una sola escritura), y un
  contrato simple que no esconde un segundo pago.
- **Alternatives considered**: responder `200` si ya estaba `CONFIRMADA` (idempotente: tapa el
  doble pago que la spec pide rechazar); una clave de idempotencia (sin necesidad: la app
  consulta el estado).

## R8. Lecturas sin cerrojo y orden de guardado

- **Decision**: las lecturas no toman el cerrojo (regla 4) y pueden caer entre dos `guardar` de
  una escritura. El orden de guardado se elige para que una lectura intermedia nunca muestre
  **más** cupo que el real:
  - **alta**: primero el evento con el cupo descontado, después la compra;
  - **vencimiento**: primero las compras `CANCELADA`, después el evento con el cupo devuelto (en
    el medio, el cupo se ve sin las vencidas: de menos, nunca de más).
  - Las verificaciones de las escrituras siempre ocurren bajo el cerrojo, con datos releídos: una
    lectura intermedia no decide nada.
- **Rationale**: es la misma garantía de la 004 (entidades inmutables, `guardar` reemplaza la
  referencia) extendida a dos repositorios.
- **Alternatives considered**: tomar el cerrojo en las lecturas (contra la regla 4 y frena
  Explorar con cada compra); un repositorio que guarde evento y compra juntos (mezcla agregados
  en la persistencia).

## R9. Compras pendientes cuando el evento empieza (decisión de la revisión del plan)

- **Decision** (Clarifications de la spec, 2026-11-12):
  - el inicio del evento (`ahora ≥ fechaHora`, el mismo "realizado" de la 004) **corta el alta**:
    `409 EVENTO_REALIZADO` al registrar una compra;
  - **no corta el pago**: una compra pendiente creada antes se paga con el evento empezado
    mientras no venza; `Compra.pagar` no recibe nada del evento;
  - si no se paga, **vence igual** a los 15 minutos de su alta: `CANCELADA` por el sistema y su
    cupo vuelve.
- **Rationale**: la persona reservó cuando el evento todavía no había empezado; la ventana de
  15 minutos es la misma para todos (una compra hecha 1 minuto antes del inicio vence 14 minutos
  después de empezado). La regla "Cancelación" de la constitución ("una compra NO PUEDE
  cancelarse si está `UTILIZADA` o si el evento ya se realizó") **se mantiene** y rige las
  compras confirmadas: se cancelan con reembolso hasta que el evento empieza o la entrada se usa
  (009). Para una compra `PENDIENTE` prevalece la regla de los 15 minutos: un refinamiento que
  confirmó la revisión humana del plan, sin enmendar la constitución ("Una spec PUEDE refinar
  estas reglas").
- **Alternatives considered**: rechazar el pago con el evento empezado (la versión anterior del
  plan; obligaba a interpretar la regla de cancelación y dejaba sin entrada a quien reservó a
  tiempo); no vencer las compras de eventos empezados (quedarían pendientes para siempre,
  contando para el tope y ocupando cupo).

## R10. Datos de ejemplo (FR-024)

- **Decision**: no se suman eventos. Las dos compras fijas de la 004 pasan a tener historial
  coherente:
  - `compra-martin-festival-vip` (2 VIP, $ 240.000): `PENDIENTE` por Martín 2 días antes de
    `ahora` y `CONFIRMADA` por Martín 5 minutos después;
  - `compra-diego-festival-general` (1 General, $ 45.000): `PENDIENTE` por Diego 1 día antes y
    `CANCELADA` por el **sistema** a los 15 minutos (una compra vencida, que no devuelve cupo de
    nuevo: ya está cancelada).
  - El cupo del seed es el **disponible** (VIP 50, Backstage 3, Carrera kids 200 gratis, Hamlet
    agotado): alcanza para el cupo justo, el agotado y el gratis (FR-024). Martín ya tiene 2
    entradas pagas del Festival (puede comprar 2 más), lo que permite mostrar el tope.
- **Rationale**: mismos eventos que la 005; las compras fijas siguen bloqueando quitar VIP y
  General y eliminar el Festival (reglas de la 004).
- **Alternatives considered**: una compra pendiente en el seed (vencería a los 15 minutos del
  arranque y la demo dependería de la hora).

## R11. Tests de concurrencia y de reglas (SC-002, SC-005)

- **Decision**: en `backend/tests/services/concurrencia-compras.test.ts`, con `Promise.allSettled`
  sobre los services reales (los repositorios devuelven promesas y cada `await` cede el turno):
  - 50 compras de 1 entrada de 50 compradores distintos sobre un tipo con cupo 10 → 10 cumplidas,
    40 `CUPO_INSUFICIENTE`, cupo final 0;
  - dos compras simultáneas de la misma persona que juntas superan el tope → una sola pasa;
  - pago y vencimiento en el límite (reloj en `venceEn`) → el pago da `COMPRA_VENCIDA`;
  - pago con el evento ya empezado y la compra sin vencer → `CONFIRMADA` (R9);
  - dos pagos simultáneos → uno cumplido y uno `TRANSICION_INVALIDA`;
  - una edición del organizador mientras vence una compra → el cupo se devuelve una sola vez.
  Las reglas puras (vencimiento exacto, tope gratis y pago, precio cambiado, transiciones) van en
  `tests/domain/`.
- **Rationale**: es el mismo enfoque que `concurrencia.test.ts` de la 004, que ya probó que sin
  cerrojo las operaciones se intercalan.
- **Alternatives considered**: probar la concurrencia por HTTP con supertest (más lento y no
  agrega nada: el cerrojo vive en los services).

## R12. Mobile: feature `compras` que depende de `eventos`, sin ciclo

- **Decision**:
  - Feature nueva `src/features/compras/` (la amplían la 007 a la 010): hooks de consulta,
    mutations, `formato.ts`, componentes y las pantallas `ComprarEntradas`, `Compra` (resumen,
    pago y confirmación) y `DetalleEventoConCompras`.
  - `compras` importa de `eventos` (por su `index.ts`): `DetalleEvento`, `useEvento`,
    `textoPrecio`, `textoFechaHora`. `eventos` **no** importa `compras`.
  - Para que el detalle muestre "Comprar" y las compras pendientes sin que `eventos` conozca a
    `compras`, `DetalleEvento` suma una prop opcional `complementos` con dos componentes:
    `AccionDeTipo` (`{ evento, tipo }`, a la derecha de cada tipo) y `SeccionPropia`
    (`{ evento }`, antes de "Tipos de entrada"). `compras` exporta `DetalleEventoConCompras`,
    que renderiza `<DetalleEvento complementos={…} />`, y la ruta del detalle lo re-exporta.
  - `ListaTiposEntrada` suma la prop opcional `accionDeTipo(tipo)` (el lugar de cada fila donde
    va la acción); sin ella, se ve como hasta ahora.
- **Rationale**: las reglas de dependencia prohíben ciclos entre features (`import-x/no-cycle`).
  La 005 resolvió lo mismo poniendo Explorar dentro de `eventos` (R11 de la 005); acá las
  compras son un dominio propio que crece en cuatro features más, así que se invierte la
  dependencia con una composición explícita en lugar de meterlas en `eventos`.
- **Alternatives considered**: todo dentro de `eventos` (la feature crece con un dominio ajeno y la
  007 tendría que importar las compras desde `eventos`); que `eventos` importe `compras` (ciclo,
  porque `compras` usa `useEvento` y el formato de precio); duplicar `useEvento` en `compras`.

## R13. Rutas y navegación

- **Decision**:

  | Ruta (`app/`) | Pantalla | Título |
  |---|---|---|
  | `explorar/[eventoId]/index.tsx` (se mueve desde `explorar/[eventoId].tsx`) | `DetalleEventoConCompras` | Evento |
  | `explorar/[eventoId]/comprar/[tipoEntradaId].tsx` (nueva) | `ComprarEntradas` | Comprar entradas |
  | `compras/[compraId].tsx` (nueva) | `Compra` | Tu compra |

  - La URL pública `/explorar/[eventoId]` no cambia (las rutas tipadas y los tests de la 005
    siguen valiendo). `LayoutRaiz` declara las tres en el `Stack.Protected` con usuario
    (`explorar/[eventoId]/index` reemplaza a `explorar/[eventoId]`).
  - Al registrarse la compra: `router.replace` a `/compras/[compraId]` (volver lleva al detalle,
    no al selector de cantidad). Desde la confirmación: "Volver al evento" (`router.back()`) e
    "Ir a Explorar" (`router.dismissTo("/")`). "Pagar" en una compra pendiente del detalle hace
    `router.push` a `/compras/[compraId]`.
  - `compras/[compraId]` queda fuera de `explorar/` porque la 007 (Mis compras) abre la misma
    pantalla.
- **Rationale**: SC-001 (Comprar → cantidad → Confirmar → Pagar → Volver: 5 toques). Una pantalla
  para la cantidad deja el detalle sin estado de formulario y es fácil de testear.
- **Alternatives considered**: elegir la cantidad dentro del detalle (mezcla el formulario con la
  lectura y complica `SegunConsulta`); un modal (Expo Router lo soporta, pero el selector de
  usuario ya usa el modal y el formulario necesita teclado y scroll como cualquier pantalla).

## R14. Estado de la compra con texto y color: `EtiquetaEstadoCompra` en la base

- **Decision**: `src/componentes/EtiquetaEstadoCompra.tsx` (base, exportado por `index.ts`):
  recibe un `EstadoCompra` y muestra su etiqueta ("Pendiente", "Confirmada", "Utilizada",
  "Cancelada", "Reembolsada") sobre el color del tema (`advertencia`, `exito`, `peligro`, con su
  `sobre…`), con `accessibilityLabel` "Estado: Pendiente". Es **el único** componente de estado
  de compra (principio VII; FR-017) y ya contempla los cinco estados (la 007 a la 009 lo usan
  sin cambiarlo).
- **Rationale**: no depende de ninguna feature (solo de `shared` y del tema), así que la base es
  su lugar; la 008 lo necesita desde `eventos` (compras de un evento) y la 007 desde `compras`.
- **Alternatives considered**: dentro de `features/compras` (la 008 lo importaría desde `eventos`
  y formaría un ciclo); un mapa de colores suelto por pantalla (prohibido por el principio VII).

## R15. Consultas, claves e invalidaciones

- **Decision**:
  - `src/api/compras.ts`: `comprarEntradas(cliente, eventoId, datos, { usuarioId })`,
    `obtenerMisComprasDelEvento(cliente, eventoId, { signal })`, `obtenerCompra(cliente,
    compraId, { signal })`, `pagarCompra(cliente, compraId, { usuarioId })`. El cuerpo del alta
    es `{ tipoEntradaId, cantidad }`: nunca precio ni total (FR-004).
  - Claves nuevas (usuario en la posición 1): `claves.misComprasDelEvento(usuarioId, eventoId)` y
    `claves.compra(usuarioId, compraId)`.
  - Las mutations (`useComprarEntradas`, `usePagarCompra`), con éxito o error, invalidan el
    evento **para todos los usuarios** (predicado `["evento", *, eventoId]`: Mis eventos del
    organizador usa su propia clave; FR-022), `misComprasDelEvento`, la compra y `["catalogo"]`.
    El pago invalida también el evento: al pagar puede materializarse un vencimiento que cambia
    el cupo. Ante un 404 del evento, el evento no se vuelve a pedir y se invalida el catálogo (como
    en la 005).
  - Al pagar con éxito, la respuesta se escribe en `claves.compra` (`setQueryData`): la
    confirmación aparece sin esperar otro pedido.
- **Rationale**: la única fuente de verdad es el servidor (patrón de la 004 y la 005); el
  predicado por `eventoId` cubre el caso del organizador sin conocer su id.
- **Alternatives considered**: actualizar el cupo en el caché a mano (duplica la regla y queda
  mal ante un vencimiento); invalidar `["evento"]` completo (vuelve a pedir eventos que no
  cambiaron).

## R16. Errores al comprar (FR-019, FR-020; US3, US4)

- **Decision**: la pantalla `ComprarEntradas` muestra el mensaje del servidor arriba del botón
  (`AvisoDeFormulario` o equivalente) y conserva tipo y cantidad:
  - `CUPO_INSUFICIENTE`, `TOPE_POR_PERSONA`: se invalidan el evento y `mis-compras`; el selector
    se ajusta al nuevo máximo (`min(cupo, restantes)`, recortando la cantidad elegida) y se puede
    elegir otra cantidad o volver al detalle para otro tipo.
  - `EVENTO_REALIZADO`: se invalida el evento; la pantalla pasa a "Este evento ya se realizó" sin
    confirmar, con "Volver al evento".
  - `400` sobre `body.tipoEntradaId` (el tipo ya no existe): "Este tipo de entrada ya no está
    disponible." y "Volver al evento".
  - `404 EVENTO_NO_ENCONTRADO`: "No encontramos este evento." y "Volver a Explorar"
    (`router.dismissTo("/")`), invalidando el catálogo.
  - `ServidorNoDisponibleError`: "No se pudo registrar la compra. Probá de nuevo." con el botón
    disponible para reintentar; no se reintenta solo (`mutations.retry: false`). Si la compra sí
    llegó, la persona la encuentra en "Tus compras pendientes" del detalle (FR-023).
  - Mientras el pedido está en curso, "Confirmar compra" queda en curso y deshabilitado
    (`enCurso`, `textoEnCurso`; FR-018).
- **Rationale**: la app no valida (patrón de la 004): muestra lo que dice el servidor y se
  actualiza con los datos reales.
- **Alternatives considered**: volver al detalle ante cualquier error (se pierde la cantidad
  elegida, contra US3-9).

## R17. Pago, reintento y estado real (US2, US4; FR-021)

- **Decision**: la pantalla `Compra` se dibuja **siempre** desde `useCompra` (el estado del
  servidor), no desde el resultado de la mutation:
  - `PENDIENTE` → resumen, "Podés pagar hasta las HH:mm", y "Pagar" (o "Confirmar" si el total es
    0). Si el último intento falló, el mensaje va arriba del botón.
  - `CONFIRMADA` → la confirmación (estado "Confirmada", "Volver al evento", "Ir a Explorar"); un
    error anterior **no** se muestra.
  - `CANCELADA` por vencimiento → "Esta compra venció: sus entradas volvieron a estar
    disponibles." y "Volver al evento".
  - Con cualquier error del pago, la mutation invalida `claves.compra`: si el pago había llegado
    (respuesta perdida o `TRANSICION_INVALIDA`), la consulta trae `CONFIRMADA` y la pantalla
    muestra la confirmación sin error (FR-021, SC-006). Ante `ServidorNoDisponibleError`, la
    compra sigue pendiente con "Pagar" para reintentar a mano.
  - `403` (por ejemplo, se cambió de usuario desde Perfil y la clave ahora es del otro usuario):
    "No tenés permiso para ver esta compra." sin acciones de pago.
- **Rationale**: un único lugar decide qué se ve (el estado real), y el reintento queda resuelto
  sin lógica especial de idempotencia.
- **Alternatives considered**: consultar el estado antes de cada reintento (un pedido más en el
  caso normal); mostrar la confirmación con la respuesta de la mutation sin escribirla en la
  consulta (dos fuentes de verdad).

## R18. El detalle con compras: acción por tipo y compras pendientes (FR-001, FR-002, FR-008, FR-023)

- **Decision**: `DetalleEventoConCompras` usa `useMisComprasDelEvento(usuarioId, eventoId)`:
  - `SeccionPropia`: si el usuario es el organizador (`evento.organizadorId === usuarioId`), el
    aviso "Sos el organizador de este evento"; si no, "Tus compras pendientes" con cada compra
    (tipo, cantidad, total, "Podés pagar hasta las HH:mm", `EtiquetaEstadoCompra`) y "Pagar". Sin
    pendientes, la sección no aparece. Si la consulta falla, la sección no aparece (el detalle se
    sigue viendo; la franja ya avisa si el servidor no está).
  - `AccionDeTipo`, en este orden: evento realizado, organizador o tipo agotado → nada (el cupo
    ya dice "Agotado"); `restantes === 0` → "Ya tenés el máximo de entradas para este evento";
    si no → "Comprar" (`accessibilityLabel` "Comprar VIP"), que lleva a
    `/explorar/[eventoId]/comprar/[tipoEntradaId]`. Mientras `mis-compras` carga, "Comprar" se
    muestra (el servidor decide igual).
- **Rationale**: el detalle sigue siendo público y legible sin la consulta propia; la acción solo
  se esconde cuando hay certeza.
- **Alternatives considered**: esperar `mis-compras` para mostrar el detalle (un pedido más que
  bloquea la lectura pública).

## R19. Tests de mobile

- **Decision**:
  - `renderConDependencias` responde por defecto `GET /eventos/:id/mis-compras` con
    `{ pendientes: [], restantesPorTipo: [] }` cuando el test no lo registra (como hace con el
    catálogo y las categorías), para que los tests del detalle de la 005 no cambien.
  - Tests nuevos: `api/compras.test.ts`, `componentes/etiqueta-estado-compra.test.tsx`,
    `features/compras/formato.test.ts`, `pantallas/comprar-entradas.test.tsx`,
    `pantallas/compra.test.tsx`; ampliados: `pantallas/detalle-evento.test.tsx` (Comprar,
    organizador, agotado, tope, pendientes), `tipos/rutas-tipadas.ts` y
    `arquitectura/reglas-de-dependencia.test.ts` si hace falta un caso de `compras → eventos`.
  - Fixtures en `tests/helpers/compras.ts`.
- **Rationale**: mismo patrón de la 005 (`porRuta`, sin red).
- **Alternatives considered**: mocks de los hooks (no prueban la integración con el cliente ni
  las claves).
