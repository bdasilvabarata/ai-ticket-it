# Research: Paginación (013)

Decisiones del plan. Cada una: **Decisión**, **Por qué** y **Alternativas descartadas**.

## R1. Una función de paginación pura en `domain/` y un `PaginaVista` en `shared/`

**Decisión**:

- `shared/src/paginacion.ts` (nuevo):
  - `LIMITES_PAGINACION = { tamanoDePagina: 10, reseniasEnElDetalle: 3 }`;
  - `PaginaVista { numero, tamano, totalElementos, totalPaginas }`.
- `backend/src/domain/paginacion.ts` (nuevo, puro):
  `paginar<T>(elementos: readonly T[], numeroPedido: number): { elementos: T[]; pagina: PaginaVista }`.
  - `totalPaginas = ceil(totalElementos / 10)`; con 0 elementos, `0`.
  - `numero = min(numeroPedido, max(totalPaginas, 1))`: una página posterior a la última devuelve la
    última; con la lista vacía, la 1 sin elementos (FR-005).
  - `elementos = slice((numero − 1) · 10, numero · 10)` sobre la lista **ya filtrada y ordenada**
    por el que llama (FR-003).
- Cada respuesta paginada conserva su forma y su nombre de lista (`eventos`, `compras`, `resenias`)
  y **suma** `pagina: PaginaVista`.

**Por qué**: la "lógica común" que pide la descripción es una sola: cortar una lista ordenada y
calcular los totales. Como función pura se testea con todos sus bordes (0, 10, 11 elementos; página
0 ya la rechaza zod; página mayor que la última) sin servidor. Sumar `pagina` sin renombrar la lista
deja intactos los demás campos de cada vista (`hayEventosProximos`, `resumenPorTipo`, `organizador`)
y el código que ya los lee.

**Alternativas descartadas**:

- Un `Pagina<T> { elementos, ... }` genérico como respuesta: obliga a anidar los campos propios de
  cada vista o a renombrar `eventos`/`compras`/`resenias` en el backend, la app y los tests.
- Paginar en el repositorio (`listarPagina`): el orden y los filtros dependen del reloj y de datos de
  otros agregados (puntaje, estado al día); el repositorio no los conoce.
- Un 404 o un 400 ante una página posterior a la última: lo descarta la clarificación (FR-005).

## R2. El número de página en la query: `pagina`, validado con un esquema común

**Decisión**: `paginaSchema` en `validations/comunes.ts`, usado por las tres consultas:

- ausente → `1` (FR-004);
- un texto de dígitos sin signo que represente un entero seguro ≥ 1 → ese número;
- cualquier otra cosa (`0`, `-1`, `1.5`, `abc`, vacío, repetido) → `400 ENTRADA_INVALIDA` con el
  detalle `query.pagina`: "Debe ser un entero mayor o igual a 1."

El tamaño de página **no** se recibe: un `tamano` en la query se descarta como cualquier clave
desconocida (FR-006).

**Por qué**: es el patrón de `consultaCatalogo` (claves desconocidas descartadas, detalle por campo).
`z.coerce.number()` aceptaría `""` (→ 0) y `"1e1"`; la regex de dígitos es explícita.

**Alternativas descartadas**: `?offset=&limit=` (la app elegiría el tamaño, contra FR-006); un
cursor (no hace falta: cada página es la foto del momento, Assumptions).

## R3. Catálogo: ordenar todo, cortar y armar la vista solo de la página

**Decisión**: `EventoService.listar(consulta)` recibe además `pagina`:

1. Igual que hoy: la categoría referenciada (400), los eventos, `hayEventosProximos` (sobre todos
   los próximos, FR-014) y el filtro por texto y categoría.
2. Los puntajes de los organizadores de **todos** los coincidentes (hacen falta para ordenar por
   puntaje) y `ordenarCatalogo` sobre todos (FR-003, US1-4).
3. `paginar(ordenados, pagina)`.
4. Solo para los eventos de la página: el cupo al día (`#conCupoAlDia`, que define "Agotado"), las
   categorías y los organizadores en lote, y `aEventoCatalogoVista`.

Las lecturas siguen siendo un número fijo (las mismas de hoy). Con la lista vacía responde
`{ eventos: [], pagina: { numero: 1, tamano: 10, totalElementos: 0, totalPaginas: 0 },
hayEventosProximos }`.

**Por qué**: el orden usa la fecha, el `precioDesde` (precios, no cupo) y el puntaje; ninguno
depende del cupo al día, así que el cupo, las categorías y los organizadores se calculan para 10
eventos y no para 50 (SC-001), sin cambiar el orden de la 005.

**Alternativas descartadas**: armar todas las vistas y cortar al final (más simple, pero hace el
trabajo de 50 eventos para mostrar 10).

## R4. Compras del evento: filtros en el servidor, totales sobre todas

**Decisión**: `GET /eventos/:eventoId/compras?pagina=&estado=&sinResponder=`.

- `estado`: uno de los cinco de `EstadoCompra`; inválido → 400 `query.estado`.
- `sinResponder`: `"true"` o `"false"` (por defecto `false`); otro valor → 400
  `query.sinResponder`. Si llegan los dos, se aplican juntos (y); la app manda uno a la vez.
- `CompraService.comprasDelEvento(eventoId, usuarioId, consulta)`:
  1. Igual que hoy: `leerDelOrganizador` (404 → 403), las compras del evento **al día** y ordenadas
     con `compararComprasDelEvento`.
  2. Sobre **todas**: `ventanaDeUso`, `resumenPorTipo`, `comprasConMensajesSinResponder` y el nuevo
     `cantidadCompras` (cuántas tiene el evento, sin filtro).
  3. `filtrarComprasDelEvento(compras, { estado, sinResponder })` (puro, nuevo en
     `domain/compras-del-evento.ts`, sobre el estado **al día**: una pendiente vencida es
     `CANCELADA`) y `paginar`.
  4. Los compradores en lote **solo de la página** (ninguna lectura si está vacía).
- La vista suma `pagina` y `cantidadCompras`.

**Por qué**: es la clarificación (FR-017). `cantidadCompras` hace falta porque la app ya no recibe
todas las compras y tiene que decidir si muestra los chips ("solo si el evento tiene alguna compra,
no si solo el filtro dejó la lista vacía") y el vacío "Todavía nadie compró entradas".

**Alternativas descartadas**:

- Un único `filtro=todas|sin-responder|<estado>`: copia la forma del chip de la app en el contrato;
  `estado` y `sinResponder` son dos criterios independientes y así los nombra la clarificación.
- Derivar "tiene compras" del `resumenPorTipo`: no cuenta las canceladas ni las reembolsadas.

## R5. Reseñas del organizador: la colección paginada y un resumen de 3

**Decisión**: dos lecturas públicas, con el mismo cálculo del puntaje (FR-021):

| Ruta | Para | Responde |
|---|---|---|
| `GET /eventos/:eventoId/resenias-del-organizador?pagina=N` | "Ver todas las reseñas" (US5) | `PaginaDeReseniasVista`: `organizador`, `resenias` (hasta 10) y `pagina` |
| `GET /eventos/:eventoId/resenias-del-organizador/resumen` | la sección del detalle (US4) | `ReseniasDelOrganizadorVista` (la forma de la 012): `organizador` y las 3 más recientes |

- `EventoService` tiene un `#reseniasDelOrganizador(eventoId)` privado con las lecturas de la 012
  (evento → 404, eventos del organizador, sus reseñas ordenadas) y dos públicos:
  `reseniasDelOrganizador(eventoId, pagina)` (con `paginar`) y `resumenDeResenias(eventoId)` (las
  primeras `LIMITES_PAGINACION.reseniasEnElDetalle`). Los usuarios se piden en **un** lote, solo el
  organizador y los autores de las reseñas que se devuelven.
- La app muestra "Ver todas las reseñas" si `organizador.cantidadResenias > 3` (FR-022).

**Por qué**: la colección "reseñas del organizador" se pagina igual que las otras dos (`?pagina`), y
el resumen es una vista de tamaño fijo, como el 10, que decide el servidor (la app no elige
tamaños, FR-006). El detalle recibe 3, no 10 (SC-001). La sección de la 012 conserva su forma: solo
cambia la URL.

**Alternativas descartadas**:

- Que el detalle pida la página 1 y muestre 3: recibe 10 para mostrar 3 y el "3" queda en la app.
- Un `?limite=3`: la app elegiría un tamaño (FR-006).
- Reseñas en `EventoVista`: el detalle perdería los estados propios de la sección (012) y la vista
  del evento la usan muchas pantallas y mutations.
- `GET /usuarios/:id/resenias`: la pantalla se abre desde un evento y su "no encontrado" es el del
  evento (US5-5).

## R6. El paginador: un componente de la base con la regla como función pura

**Decisión**:

- `mobile/src/componentes/botones-del-paginador.ts`: `botonesDelPaginador(totalPaginas, actual): number[]`.
  No se llama `paginador.ts`: junto a `Paginador.tsx`, en un sistema de archivos que no distingue
  mayúsculas (Windows), `./Paginador` resolvería a `paginador.ts`.
  - Con 5 páginas o menos, todas.
  - Si no, una ventana `[actual − 1, actual + 1]` recortada a `[1, total]`, más la 1 y la última.
    Mientras haya menos de 5 botones, la ventana crece **hacia adentro** (hacia la última si toca la
    1, hacia la 1 si toca la última). Con la actual entre 3 y `total − 2` ya hay 5, así que la
    dirección de crecimiento es siempre una sola.
  - Da `1 2 3 4 10` (actual 1 o 2), `1 3 4 5 10` (4), `1 5 6 7 10` (6), `1 7 8 9 10` (9 o 10).
- `mobile/src/componentes/Paginador.tsx`: `Paginador({ pagina: PaginaVista, alCambiar })`.
  - Con `totalPaginas ≤ 1` no dibuja nada (FR-010).
  - Un `Pressable` por botón con `accessibilityRole="button"`, `accessibilityLabel="Página N"` y
    `accessibilityState={{ selected }}` (FR-009).
  - La actual: relleno `resaltado`, sombra dura y `Archivo Black` (sombra y peso, no solo color).
  - Tocar la actual no llama a `alCambiar` y no se marca `disabled` (TalkBack diría "desactivado" en
    vez de "seleccionado").
  - La actual sale de `pagina.numero` de la **respuesta**, no de lo pedido (FR-005).
  - Sin "…" entre números no contiguos ni botones anterior/siguiente: la spec no los pide y con 5
    botones se llega a cualquier página de 10 en 3 toques o menos (SC-004, lo verifica un test que
    recorre todas las combinaciones).
- Se exporta por `componentes/index.ts`, porque lo usan `eventos` y `compras` (la base no importa
  features).

**Por qué**: la regla es lo que más se puede equivocar (SC-003, de 1 a 20 páginas), y una función
pura se prueba entera sin renderizar.

**Alternativas descartadas**: un paginador por feature (FR-007 pide uno solo); una biblioteca de
paginación (principio VII; son 60 líneas).

## R7. La página vive en la pantalla y vuelve a 1 al cambiar el criterio

**Decisión**: `usePagina(criterio: string): [numero, cambiar]` en `mobile/src/componentes/`.

- Guarda `{ criterio, numero }`. Si el criterio que recibe no es el guardado, devuelve `1` (estado
  derivado, sin efectos).
- Explorar le pasa `JSON.stringify({ textoDemorado, categoriaId, orden, sentido })`: escribir, elegir
  categoría, orden o sentido vuelven a la página 1 (FR-013), también cuando el texto cambia después
  de la demora.
- Compras del evento le pasa el filtro (FR-017).
- La página entra en la clave de la consulta:
  - `claves.catalogo({ ...consulta, pagina })`;
  - `claves.comprasDelEvento(usuarioId, eventoId, { filtro, pagina })`, con
    `claves.comprasDelEvento(usuarioId, eventoId)` como prefijo para que las invalidaciones de hoy
    (`useConfirmarReembolso`, `useRegistrarUso`, `useCancelarCompra`) sigan alcanzando todas las
    páginas;
  - `claves.paginaDeResenias(usuarioId, eventoId, pagina)`.
- Al refrescar (foco, acción sobre una fila) se vuelve a pedir la misma página; si ya no existe, el
  servidor devuelve la última y el paginador la marca (FR-005, FR-018). El estado no se sincroniza
  con la respuesta: al tocar otra página se guarda la nueva y listo. Es a propósito que, si se pidió
  la 9 y llegó la 2, la clave siga con la 9 hasta el próximo toque: el paginador marca la 2 (lee
  `pagina.numero`), tocarla no hace nada y tocar otra reemplaza el número.
- Salir y volver a la pantalla empieza por la página 1 (Assumptions); Explorar es una pestaña que no
  se desmonta, así que conserva la página mientras se apila el detalle, igual que la consulta (005).

**Por qué**: una sola regla de "volver a 1", testeable, sin `useEffect` que dispare un pedido de
más con la página vieja.

**Alternativas descartadas**: `setPagina(1)` en cada handler (el texto demorado no tiene handler y
se olvidaría alguno); la página en los parámetros de la ruta (recordar la página está fuera del
alcance).

## R8. Cargando al cambiar de página

**Decisión**:

- **Explorar** y **Ver todas las reseñas**: sin `placeholderData`, como el catálogo de la 005. Una
  página nueva es una consulta nueva: se ve el skeleton o "Cargando…" y nunca la página anterior.
  Los controles de Explorar están fuera de `SegunConsulta` y no se desmontan.
- **Compras del evento**: `placeholderData: keepPreviousData`. Mientras `isPlaceholderData`, el
  encabezado, la ventana, el resumen, el contador y los chips siguen a la vista (no cambian con la
  página ni con el filtro, FR-016), y en lugar de las filas y del paginador se ve "Cargando
  compras…". Nunca se muestran las filas de la página anterior.
- Un error al cambiar de página se ve con el `MensajeError` de siempre y su reintento. La página
  pedida queda guardada y el reintento la vuelve a pedir.

**Por qué**: en Compras del evento una sola consulta trae el resumen y la lista. Sin el placeholder,
cada toque de un chip o de una página taparía toda la pantalla con el cargando. En Explorar y en
"Ver todas", lo que queda fuera de la lista ya no se desmonta, o es solo el puntaje.

**Alternativas descartadas**: separar el resumen y la lista en dos endpoints (dos lecturas del
evento y de las compras para la misma foto, que podrían no coincidir).

## R9. Dónde va el paginador en cada pantalla

**Decisión**:

- **Explorar**: `ListFooterComponent` de la `FlatList`, después de la última tarjeta.
- **Compras del evento**: después de la última fila, dentro de la sección "Compras".
- **Ver todas las reseñas**: después de la última reseña.
- Al cambiar de página, la lista vuelve arriba:
  - en Explorar, porque la `FlatList` se monta de nuevo después del skeleton;
  - en las otras dos, con la prop opcional nueva `volverArribaCon` de `PantallaDesplazable`: un
    valor (la página) que, al cambiar, hace `scrollTo({ y: 0 })` con la `ref` interna que ya
    tiene. Es el mismo mecanismo que `empezarAlFinal` (011).

**Por qué**: el usuario toca el paginador al terminar de leer la página. Si la pantalla quedara
abajo, la página nueva empezaría fuera de la vista.

## R10. "Ver todas las reseñas": una pantalla pública de `eventos`

**Decisión**:

- La ruta es `explorar/[eventoId]/resenias` (re-export de una línea) y la pantalla,
  `TodasLasResenias` en `features/eventos/pantallas/`, con el título "Reseñas del organizador".
- Contenido:
  - el nombre del organizador y `textoPuntaje` (el mismo texto de la tarjeta y de la sección);
  - una `FilaResenia` por reseña (la de la 012, sin cambios: FR-022 "igual que en la sección");
  - el `Paginador`.
- Los cuatro estados con `SegunConsulta`: vacío `SIN_RESENIAS` y, ante un 404, el error de siempre
  (US5-5).
- `ReseniasDelOrganizador` (la sección) pasa a usar el resumen y suma el botón "Ver todas las
  reseñas" (`Boton` variante `texto`), debajo de las 3, solo si `cantidadResenias > 3`. Navega con
  `router.push` por la ruta tipada.

**Por qué**: la sección y la pantalla son del mismo dominio (`eventos`), así que `compras` no
cambia. La ruta cuelga del evento, como la sección.

## R11. Datos de ejemplo: más eventos, un evento con 12 compras y un organizador con 11 reseñas

**Decisión** (FR-024; los ids fijos existentes no cambian):

- **Catálogo**: 5 eventos próximos nuevos, de organizadores y categorías variados y con fechas
  repartidas en las próximas semanas, sin compras. Los próximos pasan de 7 a 12, es decir, 2 páginas
  sin filtros (10 + 2).
- **Compras del evento**: 10 compras nuevas en el Festival Sonidos del Sur (de Lucía, a 30 días),
  que pasa de 2 a 12 (2 páginas).
  - De una entrada cada una, de Diego, Sofía, Valentina y Martín, sin pasar el tope de 4 pagas por
    persona (Martín ya tiene 2 VIP).
  - Mezcla de `CONFIRMADA` y `CANCELADA` (vencidas por el sistema o canceladas después de pagar, con
    el reembolso pendiente). Sin `PENDIENTE`, para que la demo no dependa de la hora de arranque.
  - Al menos una con un mensaje sin responder fuera de la página 1, para ver que el contador la
    cuenta (US3-3).
  - Los cupos de General y VIP descuentan las vigentes.
- **Reseñas**: 2 eventos **realizados** nuevos de Martín, cada uno con 4 compras `UTILIZADA` (Lucía,
  Sofía, Diego y Valentina) y su reseña posterior al uso.
  - Martín pasa de 3 a 11 reseñas (2 páginas en "Ver todas", 10 + 1).
  - Las 8 nuevas suman 38 puntos (seis 5 y dos 4, por ejemplo `5 5 5 4 5 5 4 5`). El
    promedio queda en 52 / 11 ≈ 4,73: sigue viéndose "4,7" y la demo de la 012 no cambia.
  - Sus fechas de reseña son posteriores a las de Jazz, así que el detalle muestra 3 de las nuevas.
- Sofía (2,5 con 2), Lucía sin reseñas y `compra-martin-pena-general` sin reseñar quedan como
  estaban.
- Los 12 eventos del catálogo y los dos realizados nuevos se describen en `data-model.md`; los
  nombres exactos los elige la tarea del seed.

**Por qué**: es el mínimo para ver el paginador en las tres listas y el recorte a 3. Concentrarlo en
eventos y compras nuevos (salvo las 10 del Festival) no toca las demos de 008 a 012. Se eligió el
Festival porque es de Lucía, falta mucho, y ya tiene compras y el chat de la 011.

**Alternativas descartadas**: subir el tamaño del seed a "50 eventos" (ruido en todas las demás
pantallas); poner las 10 compras en la Peña (es la demo de "Registrar ingreso" y sus códigos están
en Postman).

## R12. Qué se testea

- **Dominio**: `paginar` con 0, 1, 10, 11 y 25 elementos; páginas 1, la última, la última + 1 y 99;
  concatenar todas las páginas da la lista (SC-002). `filtrarComprasDelEvento` por cada estado, por
  `sinResponder` y por los dos juntos.
- **Validación y api**:
  - `pagina` ausente, `"2"`, `"0"`, `"-1"`, `"1.5"`, `"abc"` y repetida;
  - `estado` inválido y `sinResponder=si`;
  - `tamano` ignorado;
  - el orden de rechazos 401 → 400 → 404 → 403 en Compras del evento;
  - el catálogo con más de 10 eventos y orden por puntaje: el mejor en la página 1 (US1-4);
  - `hayEventosProximos` en una página sin elementos;
  - el resumen, la ventana y el contador iguales en todas las páginas y con cualquier filtro
    (SC-006);
  - `/resumen` con 3 y la colección paginada con el mismo `organizador` (SC-005).
- **Services**: las lecturas fijas (los compradores y los usuarios solo de la página, y ninguna
  lectura de compradores con la página vacía).
- **Seed**: 12 próximos, 12 compras en el Festival, 11 reseñas de Martín ≈ 4,73, y las reglas de
  las features anteriores (los tests de `datos-ejemplo` ya validan cupos y estados).
- **Mobile**:
  - `botonesDelPaginador` para todos los totales de 1 a 20 y todas las actuales (≤ 5 botones,
    incluye 1, la última, la actual y sus vecinas, ascendente), con los ejemplos de la spec, más un
    recorrido de SC-004;
  - `Paginador`: oculto con 1 página, "Página N", `selected`, y tocar la actual no hace nada;
  - `usePagina`: vuelve a 1 al cambiar el criterio;
  - las pantallas: Explorar (página 2 y vuelta a 1 al buscar), Compras del evento (filtro en la
    query, el resumen intacto mientras carga, los chips con `cantidadCompras`), la sección con 3 y
    "Ver todas", y la pantalla nueva.
- La OpenAPI cubre la ruta nueva (el test de docs ya lo exige).
