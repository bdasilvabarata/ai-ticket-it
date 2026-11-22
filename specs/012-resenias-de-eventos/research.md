# Research: Reseñas de eventos (012)

Decisiones del plan. Cada una: **Decisión**, **Por qué** y **Alternativas**.

## R1. La `Resenia` como agregado propio, ampliada

**Decisión**: `domain/resenia.ts` amplía la clase mínima de la 005, sin reemplazarla:

- `id`: UUID del repositorio (`siguienteId()`); en el seed, `resenia-<autor>-<evento>`.
- `compradorId` y `eventoId`, como hasta ahora.
- `puntuacion`: entero de 1 a 5, como hasta ahora.
- `comentario`: `string | null`. Ya recortado, de 1 a `LIMITES_RESENIA.comentarioLargoMaximo`
  (500) caracteres, o `null` sin comentario. Un `""` no llega al dominio: el service lo pasa a
  `null`.
- `creadaEn`: `Date`, del reloj del servidor.

El constructor protege las invariantes con `Invariantes`: la puntuación; el comentario `null` o de 1 a
500 caracteres sin espacios en los bordes. Un `Resenia.crear(datos, ahora)` normaliza el comentario
(`""` → `null`) y fija `creadaEn`.

El campo se llama **`comentario`**, no `detalle` como en la tabla de la consigna:

- UC-09 y la spec dicen "comentario", y la app lo muestra como "Comentario (opcional)".
- Un 400 sobre `body.detalle` se confundiría con los `detalles` del formato de error.

La constitución ("Entidades": "puntuación y detalle") no cambia de sentido. Se puede alinear la
palabra con un PATCH al cerrar la feature (opcional).

**Por qué agregado propio**: lo pide la spec ("Key Entities"). La reseña es única por comprador y
evento, no por compra: si viviera en una `Compra`, un comprador con dos compras `UTILIZADA` tendría
dónde guardar dos.

**Alternativas**:
- Dentro de `Compra`, como los mensajes: se descartó por lo anterior.
- Dentro de `Evento`: haría que cada reseña reescriba el evento entero y que compita con el cupo.

## R2. El alta vive en `CompraService.reseniar`; `ReseniaService.registrar` escribe

**Decisión**: el caso de uso "reseñar un evento" es `CompraService.reseniar(eventoId, usuarioId,
datos)`. Bajo el cerrojo del evento:

1. lee el reloj;
2. le pide el evento a `EventoService.obtenerOFallar` (404);
3. con las compras del comprador en el evento (`listarPorEventoYComprador`, de su propio
   repositorio), la regla del dominio `exigirQuePuedeReseniar` decide 409 propio evento → 409 sin
   compra utilizada;
4. delega la escritura en `ReseniaService.registrar(datos, ahora)`: busca la reseña de ese comprador
   y evento, 409 si ya existe, pide el id y guarda.

`ReseniaService` sigue sin depender de otros services. Solo suma `RepositorioResenias` ampliado.

**Por qué**:
- `EventoService` ya depende de `ReseniaService` (los puntajes). Si `ReseniaService` pidiera el
  evento a `EventoService`, habría un ciclo, y la constitución lo prohíbe (principio III).
- La regla ("compra `UTILIZADA`") es de compras, y `CompraService` es su dueño: las lee de su
  repositorio sin consultar otro agregado.
- `CompraService` necesita igual a `ReseniaService` para las vistas de la compra (R6). La
  dependencia nueva `CompraService → ReseniaService` no forma ciclo.
- Cada service escribe solo su agregado: la reseña la guarda `ReseniaService`. Es el patrón de
  `TipoEntradaService.descontarCupo`, que se usa dentro del cerrojo del que llama.

**Alternativas**:
- `ReseniaService.crear` con `EventoService`: forma un ciclo.
- `EventoService.reseniar`: tiene el repositorio de compras, pero solo para existencia. Además
  sumaría otro caso de uso que no es del evento.
- Un service nuevo (`AltaReseniaService`): es una pieza más sin necesidad (YAGNI).
- El controller orquestando dos services: los controllers no tienen lógica.

## R3. Un cerrojo por evento para la unicidad

**Decisión**: `reseniar` corre en `cerrojo.ejecutar(eventoId, …)`. Adentro relee el reloj, el evento,
las compras y la reseña existente, y recién después guarda. Se libera en `finally` y no se anida.

**Por qué**:
- "Una reseña por comprador y evento" es verificar y después escribir. Entre la búsqueda y el
  `guardar` hay `await`. Dos pedidos casi a la vez (FR-002, edge case del doble toque) podrían
  pasar los dos la verificación.
- El cerrojo del evento serializa todas las reseñas de ese evento. Es la regla de "Operaciones
  atómicas por evento", con la instancia que ya comparten los services.
- Reseñas de eventos distintos no se esperan.

**No materializa vencimientos** (`obtenerAlDia`): la reseña no escribe el evento ni las compras.
Una `UTILIZADA` es terminal y el vencimiento solo cambia `PENDIENTE`, así que el estado guardado de
las compras que deciden la regla es el real.

**Alternativas**:
- Unicidad en `guardar` del repositorio (que rechace un duplicado): mezcla una regla del dominio
  con la persistencia y no la expresa el puerto.
- Sin cerrojo, confiando en que el `Map` es síncrono: la verificación y el guardado están separados
  por `await`.

## R4. Orden de los rechazos del alta

**Decisión**: `POST /eventos/:eventoId/resenias`:

1. 401 `USUARIO_NO_IDENTIFICADO`;
2. 400 `ENTRADA_INVALIDA`: `params.eventoId`, `body.puntuacion` y `body.comentario`;
3. 404 `EVENTO_NO_ENCONTRADO`;
4. 409 `RESENIA_PROPIO_EVENTO`: el organizador del evento;
5. 409 `SIN_COMPRA_UTILIZADA`: no tiene ninguna compra `UTILIZADA` de ese evento;
6. 409 `RESENIA_REPETIDA`: ya lo reseñó.

**Por qué**:
- Sigue el orden general del repo: 401 → 400 forma → 404 → 409.
- El organizador es un 409 de regla, como `COMPRA_PROPIO_EVENTO` del alta de compra, y no un 403.
  Sobre el evento sí tiene relación; lo que lo impide es una regla del dominio.
- "Sin compra utilizada" va antes que "repetida": quien ya reseñó siempre tiene una `UTILIZADA`, así
  que el orden solo importa para dar el motivo más útil.
- Los 409 los lanza `domain/` (`ReglaDeNegocioError`) y el 404, `EventoService` con `errors/`.

## R5. Validación de forma

**Decisión**: `validations/resenia.validation.ts` define `reseniaNueva`:

- `params.eventoId`: `idSchema`.
- `body.puntuacion`: `z.number()` entero de 1 a 5. El mensaje es "Debe ser un entero de 1 a 5."
  (`obligatorio(...)` si falta).
- `body.comentario`: `textoOpcional(500)`, que recorta y deja `""` si falta. El service lo pasa a
  `null`.

Los límites salen de `LIMITES_RESENIA` en `shared/`.

**Por qué**: es la forma de las features anteriores (zod en `validations/`, detalle por campo). El
dominio repite la invariante de puntuación, como hasta ahora.

## R6. Qué muestra la compra: `resenia` y `puedeReseniar`

**Decisión**: `CompraVista` y `MiCompraVista` suman dos campos:

- `resenia: ReseniaVista | null`: la del comprador para ese evento, **solo** si la compra está
  `UTILIZADA`. Si no, `null`.
- `puedeReseniar: boolean`: `UTILIZADA` y todavía sin reseña de ese comprador y evento.

El servidor lo decide al día en cada consulta (FR-008), con la pieza
`reseniaDeLaCompra(compra, resenia)` de `compra.vistas.ts`. `aCompraVista` y `aMiCompraVista` la
suman; `datosComunes` no, así que `CompraDelEventoVista` no cambia.

Lecturas extra, fijas:
- `obtener` y `misComprasDelEvento`: una, con `ReseniaService.deCompradorEnEvento`.
- `misCompras`: una, con `ReseniaService.deComprador`, un `Map` por `eventoId`.
- `crear`, `pagar` y `cancelar`: ninguna; su compra nunca queda `UTILIZADA` y pasan `null`.

**Por qué**:
- La app no decide reglas: muestra lo que dice el servidor, como `cancelable`.
- Dos compras `UTILIZADA` del mismo evento muestran la misma reseña (escenario 4).
- Una `CANCELADA` del mismo evento no muestra nada (FR-008, "en cualquier otro estado, ninguna").

**Alternativas**:
- Una consulta aparte de "mi reseña de este evento": un pedido más por pantalla y por fila de
  "Mis compras" (N+1 en la app).

## R7. "Reseñas del organizador": endpoint propio, público

**Decisión**: `GET /eventos/:eventoId/resenias-del-organizador`. Es público, como el detalle.

- Lo atiende `EventoService.reseniasDelOrganizador(eventoId)` con cuatro lecturas fijas: el evento
  (404), los eventos del organizador (`listarPorOrganizador`), sus reseñas
  (`ReseniaService.listarDeEventos`) y los usuarios en lote (organizador y autores, con
  `UsuarioService.obtenerPorIds`).
- Responde `ReseniasDelOrganizadorVista`: el organizador con `puntaje` y `cantidadResenias`, y las
  reseñas.

El puntaje sale de `calcularPuntaje` sobre las mismas reseñas que usan la tarjeta y el detalle
(todos los eventos del organizador). Por eso coincide (FR-018).

**Por qué**:
- `EventoVista` sale también de crear y editar. Sumarle una lista sin paginar la agrandaría en cada
  respuesta.
- La sección tiene sus propios cuatro estados en la app, sin tapar el detalle si falla.
- Va bajo el evento porque la app tiene el `eventoId` y porque el 404 es el del evento que se mira.
- `EventoService` ya arma el organizador con su puntaje y lista los eventos de un organizador.
  `UsuarioService` no puede listar eventos (sobre otro agregado, solo existencia o conteo).

**Alternativas**:
- `GET /usuarios/:usuarioId/resenias`: es el recurso "más puro", pero lo atendería un service que
  no puede leer eventos.
- Embebido en `GET /eventos/:eventoId`: descartado por lo anterior.

## R8. Orden y forma de la lista

**Decisión**: `compararResenias` en `domain/resenia.ts` ordena por `creadaEn` descendente y desempata
por `id` ascendente (FR-014).

Cada `ReseniaDelOrganizadorVista` trae:
- `id`, `puntuacion` y `comentario`;
- `autor: { nombre, apellido }`, **sin id** (FR-016);
- `evento: { id, nombre }`;
- `creadaEn` (ISO) y `creadaEnLocal` (`"YYYY-MM-DDTHH:mm"` de Buenos Aires). La app muestra el día.

No trae compras, códigos, totales ni estados.

**Por qué**:
- El `id` de la reseña sirve de clave de lista y no es del autor.
- El evento lleva id por si la app quiere distinguirlos. No se navega a él (fuera de alcance).
- `creadaEnLocal` es la convención de las demás vistas (`fechaHoraLocal`, `enviadoEnLocal`).

## R9. El repositorio

**Decisión**: `RepositorioResenias` suma:

- `siguienteId()`;
- `buscarPorEventoYComprador(eventoId, compradorId)` → `Resenia | null`;
- `listarPorComprador(compradorId)`;
- `guardar(resenia)`.

`listarPorEventos` ya existe. No hay `eliminarPorId` ni reemplazo (FR-006b).

**Por qué**: es la convención de nombres de `AGENTS.md`. `guardar` es "alta o reemplazo por id",
como los demás; la unicidad por autor y evento la garantiza el service bajo el cerrojo (R3).

## R10. Seed: dos organizadores con puntajes distintos y uno sin reseñas

**Decisión**:

- **Jazz en el Patio** (Martín, realizado hace 10 días): tres compras `UTILIZADA` de una entrada,
  de Lucía, Diego y Valentina, con el uso dentro de la ventana. Sus reseñas son 5, 4 y 5. Martín
  queda en ≈ 4,7 con 3 reseñas.
- **Stand-up: Noche de risas** (Sofía, realizado hace 3 días): dos compras `UTILIZADA`, de Diego y
  Valentina. Sus reseñas son 3 y 2, una **sin comentario**. Sofía queda en 2,5 con 2 reseñas.
- **Lucía**: sin reseñas.
- La compra `compra-martin-pena-general` (`UTILIZADA`, 1 de 3) sigue **sin reseña**: es la demo de
  "Reseñar evento".

Los cupos de esos eventos descuentan las entradas nuevas. Cada reseña tiene `creadaEn` después del
uso y antes de `ahora`, con fechas distintas para que el orden se note.

**Por qué**: cumple FR-019 y SC-005. "Mejor puntaje primero" deja Martín → Sofía → Lucía, distinto
del orden por fecha (la Peña de Lucía es la más próxima). Después de la demo, Lucía pasa a tener
puntaje.

## R11. La app: pantalla, accesos y sección

**Decisión**:

- **Ruta**: `app/compras/[compraId]/resenia.tsx` → `ReseniarEvento` (feature `compras`), como
  `chat`. Se dibuja desde `useCompra` (nombre del evento, `eventoId`, `puedeReseniar`).
  - Si ya no se puede reseñar, muestra el motivo en lugar del formulario: ya reseñado, con la
    reseña, o "no `UTILIZADA`".
- **Formulario**:
  - `SelectorPuntuacion`: 5 botones `radio` ("1 de 5" … "5 de 5", `accessibilityState.checked`),
    sin preselección.
  - `CampoDeTexto` "Comentario (opcional)", con `maxLength` del límite compartido.
  - "Enviar" con `useEnvioUnico`.
  - La app no valida: el 400 va junto a cada campo y conserva lo escrito. Un 409 se muestra con el
    mensaje del servidor.
  - `useConfirmarDescarte` solo si hay puntuación elegida o texto. Al guardar,
    `salirSinConfirmar(() => router.back())`.
- **Accesos**:
  - "Tu compra": la sección `ReseniaDeLaCompra`, con "Reseñar evento" si `puedeReseniar` o la
    reseña propia si `resenia`.
  - `FilaMiCompra`: lo mismo. El botón va **como hermano** del `Pressable` de la fila (FR-012).
- **Detalle**: `DetalleEvento` (feature `eventos`) suma al final la sección `ReseniasDelOrganizador`:
  - `useReseniasDelOrganizador` con `SegunConsulta`;
  - el puntaje con `textoPuntaje` (la misma función de la tarjeta: mismo redondeo);
  - el vacío "Todavía no tiene reseñas", sin puntaje;
  - una `FilaResenia` por reseña.
  - `Puntuacion` (5 marcas, accesible como "Puntuación: N de 5") lo usan la fila, la reseña propia y
    "Tu compra". Se exporta desde `eventos`.
- **Consultas**:
  - clave `reseniasDelOrganizador(usuarioId, eventoId)` → `["resenias-del-organizador", usuarioId,
    eventoId]`;
  - mutation `useReseniarEvento(usuarioId, eventoId)`, sin reintentos. Invalida por prefijo
    `["compra"]`, `["mis-compras"]`, `["mis-compras-del-evento"]`, `["evento"]`, `["catalogo"]` y
    `["resenias-del-organizador"]`.
- `eventos/index.ts` exporta además `useConfirmarDescarte` y lo que el formulario necesita de
  `errores-de-formulario.ts` para mostrar los detalles.

**Por qué**:
- Sigue la forma del chat (pantalla colgada de la compra) y de los formularios de `eventos`
  (descarte, errores por campo).
- `compras` depende de `eventos`, nunca al revés. La sección del detalle es de `eventos`: no
  necesita nada de `compras`.
- La clave lleva el usuario en la posición 1 (la regla general). El catálogo sigue siendo la única
  excepción.
- Invalidar `["evento"]` por prefijo refresca el puntaje en el detalle de cualquier evento del
  organizador. La reseña no cambia cupos, pero sí el `organizador.puntaje` de esos detalles.

**Alternativas**:
- La puntuación como `Slider` o un número escrito: es menos accesible y no muestra los cinco
  valores.
- La sección en `DetalleEventoConCompras` vía `complementos`: no es de compras y debe verse también
  sin comprar.

## R12. Tests

**Decisión**:

- **Backend**:
  - `domain/resenia.test.ts`: puntuación 0, 1, 5, 6 y 4,5; comentario `""`, solo espacios, 500 y
    501; `crear`; `exigirQuePuedeReseniar` con cada código, incluida una `UTILIZADA` "1 de 3", dos
    compras y solo `CONFIRMADA`, `CANCELADA` o `REEMBOLSADA`; `compararResenias` con empate.
  - `repositories/resenia.repository.test.ts`.
  - `services/resenia.service.test.ts`, `compra.service.test.ts` (`reseniar`, vistas con `resenia` y
    `puedeReseniar`; la compra, las entradas y el cupo no cambian), `evento.service.test.ts`
    (`reseniasDelOrganizador`) y `concurrencia-compras.test.ts` (dos reseñas a la vez → una).
  - `api/resenias.test.ts`: orden de rechazos y 201.
  - `api/docs.test.ts` (cobertura OpenAPI) y `domain/datos-ejemplo.test.ts` (seed coherente con las
    reglas y orden por puntaje).
- **Mobile**:
  - `api/resenias.test.ts`;
  - `features/eventos/formato.test.ts` y `features/compras/formato.test.ts`;
  - `pantallas/reseniar-evento.test.tsx` (envío, doble toque, 400 por campo, 409, descarte,
    vuelta atrás);
  - `pantallas/compra.test.tsx` y `pantallas/mis-compras.test.tsx` (botón o reseña según el
    servidor, hermano accesible);
  - `pantallas/detalle-evento.test.tsx` (sección con reseñas, vacía, error propio);
  - `tipos/rutas-tipadas.ts`.

**Por qué**: cada regla de la constitución ("Reseñas", "Puntaje del organizador") con su borde
(principio II), y TDD con stub de firma real.
