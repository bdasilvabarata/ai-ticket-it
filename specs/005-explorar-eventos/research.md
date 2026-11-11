# Research: Explorar eventos (005)

Decisiones de diseño de la feature, en el formato de la 004: **Decision**, **Rationale** y
**Alternatives considered**. Primero las de backend (R1–R10) y después las de mobile
(R11–R20). Repiten los patrones de la 004 (`specs/004-crear-evento/research.md`) salvo donde se
dice lo contrario.

## R1. `GET /api/eventos`: público, con la consulta en la query (FR-001, FR-013, FR-016, FR-022)

- **Decision**:
  - Ruta nueva `GET /api/eventos`, **sin** `requerirUsuario`, declarada en
    `routes/eventos.routes.ts` junto a las actuales (`router.get("/", consultaCatalogo.middleware,
    controller.listar)`). Un `X-Usuario-Id` inválido se ignora, como en `GET /api/usuarios`.
  - Validación `consultaCatalogo = crearValidacion({ query })` en
    `validations/evento.validation.ts`, con un `z.object` (las claves desconocidas se descartan,
    como en los cuerpos):

    | Parámetro | Regla | Mensaje (detalle en `query.<campo>`) |
    |---|---|---|
    | `texto` | string opcional, `trim`, ≤ `LIMITES_BUSQUEDA.texto` (100), `""` por defecto | "Debe tener como máximo 100 caracteres." / "Debe ser un texto." |
    | `categoriaId` | string opcional, `trim`; vacío = sin filtro | "Debe ser un texto." |
    | `orden` | `z.enum(ORDENES_CATALOGO)`, `"fecha"` por defecto | "Debe ser fecha, precio o puntaje." |

  - `categoriaId` **no** usa `idSchema` ni se busca en el repositorio: un valor que no es una
    categoría del catálogo (también uno mal formado) no coincide con ningún evento y la respuesta
    es la lista vacía (FR-016).
  - Un parámetro repetido (`?orden=fecha&orden=precio`) llega como arreglo con el parser
    `"simple"` de Express 5 y falla el `z.string` → 400 con el detalle en ese campo.
  - El 100 se cuenta **después** del `trim`, igual que en los textos de los cuerpos: "  rock  "
    con 100 letras más los espacios pasa.
- **Rationale**: la consulta es un filtro de lectura, no un recurso; va en la query como en
  cualquier listado REST. Mismo `crearValidacion` y mismos mensajes que el resto
  (`textoOpcional` de `comunes.ts` sirve para `texto`).
- **Alternatives considered**: `GET /api/eventos/buscar` (otro recurso para lo mismo); `POST` con
  cuerpo (no es cacheable ni idempotente en la semántica HTTP); validar que la categoría exista y
  responder 400 (la spec pide lista vacía).

## R2. Respuesta del listado: `CatalogoVista` (los dos vacíos sin pedir de más; FR-007)

- **Decision**: el listado responde un objeto, no un arreglo:
  `CatalogoVista { eventos: EventoCatalogoVista[]; hayEventosProximos: boolean }`.
  `hayEventosProximos` es `true` si hay **algún** evento no realizado, antes de aplicar el texto
  y la categoría. La app decide el vacío solo con la respuesta:
  - `eventos` no vacío → la lista;
  - vacío y `hayEventosProximos: false` → "Todavía no hay eventos próximos." (aunque haya
    texto o categoría: edge case "Búsqueda sin resultados vs. catálogo vacío");
  - vacío y `hayEventosProximos: true` → "Ningún evento coincide con tu búsqueda." con
    "Limpiar búsqueda".
- **Rationale**:
  - El service ya calcula los próximos para filtrarlos: el dato cuesta una comparación.
  - Un solo pedido por consulta y la decisión es del servidor (FR-023), con un test de API
    directo. La app no tiene que mirar la consulta para elegir el vacío.
- **Alternatives considered**:
  - **Arreglo + segundo pedido sin filtros** cuando el filtrado vuelve vacío (o leer de la caché
    la consulta inicial): pide de más o depende de una caché que puede estar vencida o haber sido
    recolectada; además deja un instante con el vacío equivocado.
  - **Arreglo + "si hay filtros, es sin coincidencias"**: contradice el edge case (catálogo vacío
    con un texto escrito tiene que decir "no hay eventos próximos").
  - **Encabezado HTTP** (`X-Hay-Eventos-Proximos`): esconde un dato del contrato fuera del JSON.

## R3. Normalización de búsqueda (FR-011, edge cases de tildes y ñ)

- **Decision**: módulo puro `domain/busqueda.ts`:
  - `normalizarParaBuscar(texto)`:
    1. `texto.normalize("NFD")`: separa cada letra de sus marcas (`"é"` → `"e" + U+0301`,
       `"ü"` → `"u" + U+0308`, `"ñ"` → `"n" + U+0303`).
    2. Quita **solo** el acento agudo (U+0301) y la diéresis (U+0308) **detrás de una vocal**:
       `/([aeiouAEIOU])[́̈]+/g` → `"$1"`. La virgulilla de la ñ (U+0303) no se toca.
    3. `normalize("NFC")` recompone lo que queda (`"n" + U+0303` vuelve a ser `"ñ"`).
    4. `toLowerCase()`.
  - `palabrasDeBusqueda(texto)`: normaliza y separa por `/\s+/`, sin vacíos. `""` o solo
    espacios → `[]` (sin filtro, FR-012).
  - La coincidencia es `String.prototype.includes` sobre los textos normalizados: **literal**,
    sin expresiones regulares armadas con lo que escribe el comprador (puntos, asteriscos y
    corchetes no significan nada; no hay que escapar).
- **Coherencia con `mismoNombreDeTipo` (R14 de la 004)**: los dos criterios dan las mismas
  equivalencias para el español: ignoran mayúsculas, acentos y diéresis, y distinguen ñ de n
  ("Año" ≠ "Ano"). Un test de dominio recorre una tabla de pares (`"Café"/"cafe"`,
  `"PINGÜINO"/"pinguino"`, `"Año"/"Ano"`, `"Plátea"/" PLATEA "`, …) y verifica que
  `normalizarParaBuscar(a.trim()) === normalizarParaBuscar(b.trim())` coincide con
  `mismoNombreDeTipo(a, b)`. Diferencia aceptada y documentada: el Collator `base` también
  ignora marcas que no son del español (`ç`, `à`); la búsqueda no (la spec dice "solo las tildes
  y la diéresis de las vocales").
- **Por qué no `Intl.Collator`**: compara cadenas completas, no busca subcadenas. Usarlo para
  "contiene" obliga a comparar la palabra contra cada ventana del texto (O(n·m) comparaciones) y
  falla cuando la forma normalizada cambia de largo (ligaduras, marcas sueltas). Además no hay
  `indexOf` con collation en JavaScript.
- **Alternatives considered**: quitar **todas** las marcas con NFD (`/[̀-ͯ]/g`, como el
  `slug` del seed): confunde ñ con n; una tabla de reemplazos `á→a, é→e…` (frágil con las formas
  precompuestas y descompuestas que puede mandar un teclado); expresión regular con `i` y clases
  de acentos por letra (hay que escapar la entrada y no es literal).

## R4. Coincidencia por palabras: `Evento.coincideCon(palabras)` (FR-011, FR-017)

- **Decision**: `coincideCon(palabras: readonly string[]): boolean` en `Evento`: recibe las
  palabras **ya normalizadas** (las arma una vez por pedido `palabrasDeBusqueda`) y devuelve
  `true` si **cada** palabra está en `normalizarParaBuscar(nombre)` **o** en
  `normalizarParaBuscar(descripcion)`. Con `[]` devuelve `true`. Nombre y descripción se
  comparan por separado: una palabra nunca coincide "pegando" el final del nombre con el
  principio de la descripción, pero palabras distintas sí pueden repartirse entre los dos campos
  ("hamlet butacas").
- **Rationale**: es una pregunta sobre el evento, al estilo de `tuPrecioEstaEntre` del
  diagrama; queda en el dominio y se testea sin service. Normalizar las palabras una sola vez
  evita repetir el trabajo por evento.
- **Alternatives considered**: concatenar `nombre + " " + descripcion` (equivalente para
  palabras sin espacios, pero menos explícito); filtrar en el service con funciones sueltas
  (lógica de dominio fuera del dominio).

## R5. Precio "desde" y agotado (FR-004, FR-005)

- **Decision**: dos métodos de `Evento`:
  - `precioDesde(): number` → `Math.min(...tiposEntrada.map((t) => t.precio))`, sobre **todos**
    los tipos, con o sin cupo (clarificación 1). Siempre hay al menos un tipo (invariante).
  - `estaAgotado(): boolean` → `tiposEntrada.every((t) => t.cupo === 0)`.
  - `tuPrecioEstaEntre` **no cambia**; solo se corrige su comentario: el filtro por rango de
    precio quedó fuera de alcance de la 005 (lo pide el diagrama de la consigna, sin feature
    que lo use todavía).
- **Rationale**: los dos datos van en la vista (FR-032): la app no los calcula.
- **Alternatives considered**: precio "desde" solo entre tipos con cupo (descartado en la
  clarificación 1: cambiaría el precio y el orden a medida que se vende).

## R6. Orden y desempates: `domain/orden-catalogo.ts` (FR-018–FR-021, SC-003)

- **Decision**: función pura
  `ordenarCatalogo<T extends Ordenable>(elementos: readonly T[], orden: OrdenCatalogo): T[]`,
  con `Ordenable = { id; nombre; fechaHora: Date; precioDesde: number; puntaje: number | null }`.
  Recibe los puntajes **ya calculados** (R7) y devuelve un arreglo nuevo (`toSorted`):
  1. criterio principal:
     - `fecha`: `fechaHora` ascendente;
     - `precio`: `precioDesde` ascendente (los gratis primero);
     - `puntaje`: `puntaje` descendente con el valor **sin redondear**; `null` siempre al final
       (nunca como 0);
  2. desempate por `fechaHora` ascendente;
  3. después por `nombre` con `new Intl.Collator("es", { sensitivity: "base" })` (el mismo
     criterio que `compararPorApellidoYNombre` y `mismoNombreDeTipo`);
  4. por último, por `id`: dos eventos con el mismo nombre y la misma fecha salen siempre en el
     mismo orden (FR-020, "siempre el mismo").
  - `OrdenCatalogo` y `ORDENES_CATALOGO = ["fecha", "precio", "puntaje"] as const` viven en
    `shared/` (los usan la validación, el dominio y la app), como `EstadoCompra`.
- **Rationale**: el orden es una regla de producto con casos borde (SC-003); como función pura se
  testea con datos armados en el test, sin repositorios. Recibir el puntaje calculado evita que
  el dominio de eventos conozca las reseñas.
- **Alternatives considered**: ordenar las vistas en el service (mezcla reglas con armado de
  respuesta); `Collator` también para el criterio de fecha (no aplica); `localeCompare` sin
  opciones (distingue mayúsculas).

## R7. Reseña mínima y puntaje del organizador (FR-009, FR-010, SC-005)

- **Decision** (lo mismo que hizo la 004 con `Compra`):
  - **Entidad** `domain/resenia.ts`: `Resenia { id, compradorId, eventoId, puntuacion }`, con la
    invariante "entero de 1 a 5" (`DatosInvalidosError` con detalle en `puntuacion`). El
    `detalle` y la regla "solo con compra `UTILIZADA`, una vez por evento" los agrega la 011.
  - **Interfaz** en `domain/repositorios.ts`:
    `RepositorioResenias { listarPorEventos(eventoIds: readonly string[]): Promise<Resenia[]> }`.
    Un solo método, con la convención `listarPor<Criterio>`: devuelve las reseñas de esos eventos
    (posiblemente ninguna). La 011 suma `guardar` y lo que necesite.
  - **Repositorio** `repositories/resenia.repository.ts`: `ReseniaRepository` con un `Map`
    privado, construido con sus reseñas iniciales (los tests arman las suyas); **vacío** en el
    seed. Sin endpoints.
  - **Cálculo** puro en `domain/resenia.ts`:
    - `type Puntaje = { promedio: number | null; cantidad: number }`;
    - `calcularPuntaje(puntuaciones: readonly number[]): Puntaje` → `{ promedio: null,
      cantidad: 0 }` sin reseñas; si no, el promedio **sin redondear** y la cantidad;
    - `puntajesPorOrganizador(eventos: readonly Evento[], resenias: readonly Resenia[]):
      Map<string, Puntaje>`: agrupa las reseñas por el organizador del evento reseñado. Un
      organizador sin reseñas no aparece y el service usa `calcularPuntaje([])`.
  - **Sin N+1**: el listado hace un número fijo de lecturas por pedido, sin importar cuántos
    eventos haya: `eventos.listar()`, `categorias.listar()`, `usuarios.listar()` y **un**
    `resenias.listarPorEventos(ids)` con los ids de **todos** los eventos (próximos y realizados)
    de los organizadores que aparecen en la lista.
- **Por qué todos los eventos del organizador**: el puntaje es el de "las reseñas de sus eventos"
  y solo se reseñan eventos realizados (constitución): filtrar por próximos dejaría todo puntaje
  vacío para siempre.
- **Rationale**: con la 011 las reseñas se guardan en este repositorio y el puntaje, su
  presentación y el orden funcionan sin tocar la 005 (FR-010, US4-AS8). Hoy todos salen "sin
  puntaje" con `cantidad: 0`.
- **Alternatives considered**:
  - `contarPorEventos` / un agregado `{ suma, cantidad }` calculado en el repositorio: lleva la
    regla del promedio al repositorio.
  - Guardar el puntaje en el usuario: se desincroniza (la spec lo define derivado, "no se
    guarda").
  - Devolver siempre `null` sin repositorio (constante): cumple hoy, pero obliga a la 011 a
    cambiar la 005 (FR-010).
  - Un `ReseniaService` que llame `EventoService` o al revés: un service no llama a otro (R1 de
    la 004, anti-patrones).

## R8. `EventoService.listar(consulta)` y el organizador en `EventoVista` (FR-002, FR-030)

- **Decision**:
  - `EventoService` recibe por constructor también `usuarios: RepositorioUsuarios` y
    `resenias: RepositorioResenias` (conectados en `app.ts`).
  - `listar({ texto, categoriaId, orden }): Promise<CatalogoVista>`, sin cerrojo (lectura, R2.4
    de la 004):
    1. `ahora = reloj.ahora()` **una vez** por pedido (todos los eventos se juzgan con el mismo
       instante);
    2. `proximos = todos.filter((e) => !e.estaRealizado(ahora))`;
    3. `palabras = palabrasDeBusqueda(texto)`; filtra por `categoriaId` (si viene) y por
       `coincideCon(palabras)`;
    4. arma los puntajes de los organizadores de la lista en una pasada (R7) y las vistas
       (`aEventoCatalogoVista`);
    5. ordena con `ordenarCatalogo` (R6) y responde `{ eventos, hayEventosProximos:
       proximos.length > 0 }`.
  - **Toda** `EventoVista` (la de `GET /:eventoId` y también las respuestas de `POST` y `PUT`)
    suma `organizador: OrganizadorVista`; ningún campo se quita ni cambia (`organizadorId`
    sigue). Un helper privado `#organizadorVista(organizadorId)` lee el usuario, los eventos del
    organizador (`listarPorOrganizador`) y sus reseñas.
  - El organizador de un evento guardado siempre existe (los usuarios son fijos): si no, es un
    error de programación (`Error`, 500), igual que `categoriaDe`.
- **Rationale**: una sola vista de detalle para todos (R8 de la 004): el detalle público no
  necesita otra ruta ni otro tipo. Las pantallas de la 004 ignoran el campo nuevo (SC-008).
- **Alternatives considered**: `organizador` solo en el `GET` (dos formas de `EventoVista`, o un
  campo opcional que la app tendría que chequear); un `CatalogoService` aparte (más piezas para
  dos métodos de lectura sobre el mismo agregado).

## R9. Datos de ejemplo: "Gratis" y "Agotado" (FR-033)

- **Decision**: se modifican dos eventos existentes, sin agregar eventos:
  - **Agotado**: `evento-hamlet` (Martín, +10 días): Platea y Pullman pasan a cupo **0**.
  - **Gratis**: `evento-maraton-10k` (Lucía, +45 días) suma un segundo tipo **"Carrera kids"**
    (`tipo-maraton-10k-carrera-kids`, "Circuito de 2 km para menores de 12.", precio 0, cupo
    200): su precio "desde" es "Gratis".
  - El dominio acepta cupo 0 (`TipoEntrada` exige `esEnteroNoNegativo`); el ≥ 1 es solo del alta
    de un tipo (`tipoEntradaSchema(1)` y `agregarTipoEntrada`), y el seed construye entidades.
- **Rationale**:
  - Siguen siendo 8 eventos con la misma distribución por organizador (3, 3, 2, 0, 0): no se
    rompen `datos-ejemplo.test.ts`, `GET /api/usuarios` ni `GET /api/eventos/mios`.
  - La Charla de IA queda en $ 2.000 y el Clásico en $ 8.000, como pide la prueba de US4.
  - Noche de Rock sigue con un solo tipo (lo usa el test de `ULTIMO_TIPO_ENTRADA`); el Festival
    conserva sus compras y sus tres tipos (R17 de la 004).
  - "precios muy distintos (máximo ≥ 10 × mínimo)" sigue en verde (con mínimo 0 el cociente es
    infinito); se ajusta su texto si confunde.
  - Orden por precio del seed: Maratón (Gratis), Charla ($ 2.000), Clásico ($ 8.000), Noche de
    Rock ($ 15.000), Hamlet ($ 18.000, Agotado), Festival ($ 45.000).
- **Alternatives considered**: dos eventos nuevos (cambian las cuentas de varios tests y del
  selector de usuario); la Charla de IA gratis (rompe el ejemplo "$ 2.000 antes que $ 8.000"
  de la spec); un evento agotado de Lucía (mezcla la demo de la 004 con la de la 005).

## R10. Contrato y documentación

- **Decision**: `contracts/api.md` de esta feature; `openapi.json` suma `GET /eventos` (tag
  **Eventos**) con sus parámetros, `CatalogoVista`, `EventoCatalogoVista` y `OrganizadorVista`, y
  amplía el esquema `EventoVista`; el test de cobertura (`docs.test.ts`) sigue en verde. La
  colección de Postman suma "Explorar eventos" (sin filtros, `texto=basquet`,
  `categoriaId=categoria-musica`, `orden=precio`, `orden=puntaje`, categoría inexistente,
  `orden=nombre` → 400, texto de 101 caracteres → 400).

## R11. Mobile: Explorar dentro de `features/eventos`

- **Decision**: Explorar y el detalle público van en `features/eventos` (pantallas `Explorar` y
  `DetalleEvento`), sin feature nueva.
- **Rationale** (reglas de dependencia del lint):
  - Las piezas que reusa son internas de `eventos`: `useEvento`, `formato.ts`,
    `SelectorCategoria`, `MarcaRealizado`, `ListaTiposEntrada` y `esNoEncontrado`. Una feature
    `explorar` solo podría importarlas por el `index.ts` de `eventos` (regla 3), así que habría
    que **publicarlas** todas: el índice dejaría de ser un punto de entrada chico.
  - Las mutations de `eventos` invalidan el catálogo (R15): con una sola feature es un import
    por archivo; con dos, `eventos` tendría que conocer la clave de otra feature (vía base), sin
    ciclo pero con una dependencia más que justificar.
  - La feature es por **dominio** (eventos), no por pestaña: Mis eventos y Explorar son dos
    vistas del mismo recurso.
- **Alternatives considered**: `features/explorar` (ver arriba); mover las piezas compartidas a
  la base `componentes/` (son de dominio, no genéricas).

## R12. Rutas

- **Decision**:
  - `app/(tabs)/index.tsx` → `export { Explorar as default } from "../../src/features/eventos";`
    (reemplaza la `SeccionPendiente`).
  - `app/explorar/[eventoId].tsx` → `export { DetalleEvento as default } from
    "../../src/features/eventos";`. Distinta de `eventos/[eventoId]` (la del organizador):
    tocar un evento propio en Explorar abre el mismo detalle público (edge case).
  - `Stack.Screen name="explorar/[eventoId]"` con `title: "Evento"` dentro del
    `Stack.Protected` de `con-usuario` de `LayoutRaiz`.
  - `tests/tipos/rutas-tipadas.ts` suma el caso con parámetro de `/explorar/[eventoId]`.
- **Rationale**: apilada sobre las pestañas, la pestaña Explorar **no se desmonta** al abrir el
  detalle: su estado (texto, categoría, orden) sigue ahí al volver (FR-024) sin guardarlo en
  ningún lado.
- **Alternatives considered**: guardar la consulta en parámetros de la URL de la pestaña (más
  código, y el estado tampoco tiene que sobrevivir a un reinicio); un contexto propio (estado
  global que la spec no pide).

## R13. `listarEventos` en `src/api/eventos.ts`

- **Decision**: `listarEventos(cliente, consulta: ConsultaCatalogo, { signal })` →
  `cliente.get<CatalogoVista>(ruta, { signal, usuarioId: null })`:
  - arma la query con `URLSearchParams`, agregando solo los parámetros con valor (`texto` ya
    recortado y no vacío, `categoriaId` si no es "Todas", `orden` siempre). Sin parámetros
    queda `/eventos?orden=fecha`.
  - Sin `X-Usuario-Id` (`usuarioId: null`): el catálogo es público, como `listarCategorias`.
  - `URLSearchParams` codifica el espacio como `+`; el parser de Express (`querystring`) lo
    vuelve a espacio. Expo (SDK ≥ 52) trae `URL`/`URLSearchParams` estándar en Hermes; en Jest
    es el de Node. Un test de `api/` fija la URL exacta (incluidos acentos, `&` y `+`).
- **Alternatives considered**: concatenar con `encodeURIComponent` a mano (más fácil de
  equivocarse con los `&`); mandar siempre los tres parámetros (pide "texto=" vacío y ensucia
  los logs).

## R14. Consulta del catálogo: clave, debounce y skeleton (FR-007, FR-014)

- **Decision**:
  - Clave `claves.catalogo(consulta) => ["catalogo", consulta] as const`, **sin `usuarioId`**,
    con la consulta normalizada (`texto` recortado, `categoriaId` `null` = "Todas"). Se
    documenta en `claves.ts` como la excepción a "el usuario en la posición 1": el catálogo es
    el mismo para todos (spec, edge case "Usuario cambiado"). El prefijo `["catalogo"]` sirve
    para invalidar todas las consultas a la vez (R15).
  - `useCatalogo(consulta)` en la feature: `useQuery({ queryKey: claves.catalogo(consulta),
    queryFn: ({ signal }) => listarEventos(cliente, consulta, { signal }) })`, **sin**
    `placeholderData`/`keepPreviousData`: con una clave nueva la query no tiene datos y
    `isPending` es `true` → skeleton (FR-007).
  - **Debounce** de 500 ms solo para el texto: `useValorDemorado(valor, 500)` (un `useEffect`
    con `setTimeout`, en la feature). La categoría y el orden entran a la clave al instante.
  - **Skeleton desde la primera tecla**: mientras el texto escrito (recortado) no es igual al
    demorado, la pantalla muestra el skeleton aunque la clave todavía no cambió; así, los
    resultados del texto anterior nunca quedan a la vista (FR-007).
  - **"Siempre el último texto"** (FR-014): lo que se muestra es siempre la query de la clave
    actual; una respuesta tardía de una clave vieja se guarda en su entrada de la caché y no se
    ve. Además, al consumir el `signal`, TanStack aborta el pedido de una query que se quedó sin
    observadores.
  - Volver a una consulta ya respondida en la sesión (por ejemplo, Fecha → Precio → Fecha)
    muestra su respuesta cacheada (la de **esa** consulta, no una anterior) y la revalida si
    venció el `staleTime` (30 s): no son "resultados anteriores".
- **Alternatives considered**: `keepPreviousData` (deja a la vista los resultados del criterio
  anterior: lo prohíbe FR-007); `gcTime: 0` para forzar el skeleton también al volver a una
  consulta ya vista (no lo pide la spec y pide de más); un debounce en la base (solo lo usa
  esta pantalla); botón "Buscar" (FR-014 lo excluye).

## R15. Invalidación del catálogo (US2-AS7, edge case "eliminado o editado")

- **Decision**:
  - Las mutations de `features/eventos/mutaciones.ts` (crear, actualizar, eliminar, agregar,
    editar y quitar tipo) suman `["catalogo"]` (prefijo) a lo que invalidan al terminar, con
    éxito o error: un cambio de nombre, fecha, precio o cupo cambia el catálogo.
  - El detalle público, ante un **404** (`esNoEncontrado`), invalida `["catalogo"]` una vez
    (`useEffect`), así al volver a Explorar el evento ya no aparece. Lo expone la feature como
    `useInvalidarCatalogo()` (junto a `useCatalogo`).
  - Los tests de la 004 que cuentan invalidaciones siguen en verde (el prefijo es adicional).
- **Rationale**: misma estrategia que la 004 (R15): invalidar en vez de escribir la caché; el
  servidor es la única fuente de verdad del orden y del filtro.
- **Alternatives considered**: `setQueryData` para quitar el evento de cada consulta en caché
  (duplica el filtro y el orden en la app); refetch al enfocar la pestaña (pide de más).

## R16. Pantalla Explorar

- **Decision**:
  - Arriba, **fuera** de `SegunConsulta`, en un `View` que no se desmonta: el buscador
    (`TextInput` con `maxLength={LIMITES_BUSQUEDA.texto}`, `accessibilityLabel="Buscar
    eventos"`, `returnKeyType="search"`, `clearButtonMode`), el selector de categoría y el
    selector de orden. Así, el skeleton y la lista cambian sin quitarle el foco ni lo escrito al
    campo (US3-AS4).
  - Debajo, `SegunConsulta` con la `FlatList` de `TarjetaEvento`. Toca una tarjeta →
    `router.push({ pathname: "/explorar/[eventoId]", params: { eventoId } })`.
  - Las dos piezas base se amplían, sin cambiar su comportamiento por defecto (los tests de la
    003 y la 004 siguen igual):
    - `SegunConsulta` suma dos props opcionales: `cargando?: ReactNode` (por defecto
      `<Cargando />`) y `vacio?: ReactNode`, que reemplaza a `ListaVacia` con `mensajeVacio`
      (una de las dos es obligatoria).
    - `ListaVacia` suma `accion?: { texto: string; alPresionar: () => void }`, un `Boton`
      `aviso` debajo del mensaje.
  - `SelectorCategoria` suma el modo con "Todas": props discriminadas (`conTodas: true`,
    `valor: string | null`, `alCambiar(categoriaId: string | null)`). "Todas" va primera y
    queda elegida con `null`. Los formularios de la 004 no cambian.
  - `SelectorOrden` (nuevo, en `componentes/`): un `radiogroup` de tres opciones con el mismo
    estilo de chips ("Fecha", "Precio", "Puntaje").
  - "Limpiar búsqueda" vuelve el texto a `""`, la categoría a "Todas" y deja el orden.
  - El estado (`texto`, `categoriaId`, `orden`) es `useState` de la pantalla de la pestaña
    (R12), que no se desmonta al apilar el detalle (FR-024). Al reiniciar la app vuelve a los
    valores iniciales (spec, Assumptions).
  - Los chips usan `flexWrap`: con las 6 categorías + "Todas" ocupan 2–3 renglones a 360 px,
    sin desplazamiento horizontal de la página (SC-007).
- **Alternatives considered**: el buscador como `ListHeaderComponent` de la `FlatList` (al pasar
  a skeleton la lista se reemplaza y el campo pierde el foco); chips de categoría en un
  `ScrollView` horizontal (SC-007 solo admite el de imágenes); un componente nuevo de vacío en
  la feature, sin tocar la base (repetiría `ListaVacia`).

## R17. Detalle público (`DetalleEvento`)

- **Decision**:
  - Lee `eventoId` de la ruta y el usuario de la sesión, y reusa `useEvento(usuarioId,
    eventoId)` y `claves.evento` de la 004 (FR-030: la misma vista).
  - Antes de `SegunConsulta`: si el error es un 404 (`esNoEncontrado`), muestra "No encontramos
    este evento." con `Boton` "Volver a Explorar" (`router.back()`) e invalida el catálogo
    (R15). El resto de los errores y el cargando van por `SegunConsulta` (US2-AS8).
  - Con datos, en un `PantallaDesplazable`:
    - si `realizado`, la `MarcaRealizado` y el aviso "Este evento ya se realizó" (FR-028, según
      el servidor);
    - nombre (`header`), categoría, `textoFechaHora(fechaHoraLocal)`, descripción si tiene;
    - `FilaImagenes` (R19);
    - "Organiza" con nombre, apellido y `textoPuntaje` (mismo formato que la tarjeta);
    - "Tipos de entrada" con `ListaTiposEntrada` **sin acciones** (precio con `textoPrecio` y
      cupo con `textoCupo`: "30 disponibles" / "Agotado", el formato de cupo que ya usa la app;
      la spec admite "Quedan 30 o similar");
    - sin botón de compra (FR-031; lo agrega la 006).
- **Alternatives considered**: un `obtenerEventoPublico` con clave sin usuario (otra clave para
  la misma respuesta; la del organizador ya la invalidan las mutations); `textoQuedan` nuevo
  ("Quedan 30") solo para el detalle (dos formatos de cupo en la app para el mismo dato).

## R18. `formato.ts`: textos nuevos

- **Decision**: funciones puras sin `Intl` (R18 de la 004), con su test:
  - `textoPrecioDesde(precio)`: `0` → `"Gratis"`; `8000` → `"desde $ 8.000"`, como lo escribe
    la spec (usa `textoPrecio`).
  - `textoPuntaje({ puntaje, cantidadResenias })`: `null` → `"Sin reseñas"`; si no,
    `"4,5 · 12 reseñas"` / `"5,0 · 1 reseña"`. Redondeo al décimo con `Math.round(p * 10) / 10`
    y `toFixed(1)` con coma decimal (`4.45` → `"4,5"`, `4.04` → `"4,0"`). Nunca muestra "0".
  - El nombre del organizador reusa `nombreCompleto` de la feature `usuarios` (por su
    `index.ts`; `usuarios` no importa `eventos`, así que no hay ciclo).
  - "Agotado" del evento es un texto fijo de la tarjeta (`agotado` lo informa el servidor).
- **Rationale**: un solo lugar para cada texto derivado, el mismo en Node y en Hermes.

## R19. Componentes nuevos, accesibilidad y 360 px (FR-027, SC-007)

- **Decision** (en `features/eventos/componentes/`, todo con `tema`):
  - `TarjetaEvento`: `Pressable` con `accessibilityRole="button"` y un `accessibilityLabel`
    con todo lo que se ve ("Clásico de básquet, Deportes, vie 15 nov 2026 · 19:00, desde
    $ 8.000, organiza Sofía Castro, sin reseñas"; "…, agotado"). Se hunde al presionar como
    `FilaEvento`. "Agotado" va como badge con texto (`neutro`/`sobreNeutro`, como
    `MarcaRealizado`): nunca solo un color.
  - `TarjetaSkeleton`: bloques `neutro` con la forma de la tarjeta, sin animación (la 013).
    Explorar muestra tres dentro de un `View` con `accessible`, `accessibilityLabel="Cargando
    eventos"` y `accessibilityLiveRegion="polite"`.
  - `SelectorOrden`: ver R16.
  - `FilaImagenes`: `ScrollView` horizontal de `Image` (tamaño de `tema.tamano`, nuevo
    `imagenDetalle` si falta). Guarda en estado las URLs que fallaron (`onError`) y las quita;
    si no queda ninguna (o no hay multimedia), no renderiza nada. Cada imagen con
    `accessibilityLabel="Imagen N de M de <evento>"`.
- **Alternatives considered**: `FlatList` horizontal para las imágenes (≤ 5 URLs: no hace
  falta virtualizar); `expo-image` (dependencia nueva; `Image` alcanza).

## R20. Tests de mobile

- **Decision**:
  - `tests/api/eventos.test.ts`: `listarEventos` arma `/eventos?orden=fecha` sin filtros, con
    texto con acentos y espacios, con categoría; sin `X-Usuario-Id`; pasa el `signal`.
  - `tests/features/eventos/formato.test.ts`: `textoPrecioDesde`, `textoPuntaje` (null, 1, 12,
    redondeos).
  - `tests/componentes/segun-consulta.test.tsx` y `lista-vacia`: las props nuevas y que lo de
    siempre no cambió.
  - `tests/pantallas/explorar.test.tsx` y `detalle-evento.test.tsx` con `renderConDependencias`
    y `porRuta`. `porRuta` compara por **sufijo de la URL con la query** (`url.endsWith`): las
    respuestas se registran con la query completa (`"/eventos?orden=precio"`) o con una función
    que mira `url`; los parámetros enviados se verifican con `falso.pedidos`. Casos: los
    parámetros, el debounce con `jest.advanceTimersByTimeAsync` (antes de 500 ms no se pide;
    después, una vez con el último texto), skeleton al cambiar de criterio, los dos vacíos y
    "Limpiar búsqueda", conservar la consulta al volver del detalle, el detalle con imágenes
    rotas (disparar `onError`), realizado, 404 con "Volver a Explorar" e invalidación.
  - Fixtures de `tests/helpers/eventos.ts` con `EventoVista` suman `organizador` (cambia el
    tipo); los tests de la 004 no cambian de comportamiento (SC-008).
