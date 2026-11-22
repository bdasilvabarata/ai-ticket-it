# Research: Favoritos (014)

Decisiones de diseño de la feature. Cada una: **Decisión**, **Por qué** y **Alternativas
descartadas**. No quedan `NEEDS CLARIFICATION`: las cinco dudas de la descripción se resolvieron en
`/speckit-clarify` (spec, "Clarifications").

---

## R1 — Los favoritos viven en el agregado `Usuario`

**Decisión**: `Usuario.favoritos` (ya existe desde la 001: `readonly string[]`, vacío en todo el
seed) es el conjunto de ids de eventos favoritos y la **única fuente** (spec, Clarifications Q5).
`Usuario` suma comportamiento inmutable, como `Evento` y `Compra`:

- `tieneFavorito(eventoId): boolean`;
- `marcarFavorito(eventoId): Usuario` — agrega el id **al final**; si ya estaba, devuelve `this`
  (idempotente, FR-003);
- `desmarcarFavorito(eventoId): Usuario` — lo saca; si no estaba, devuelve `this`.

El constructor suma la invariante "sin repetir" (`DatosInvalidosError` sobre `favoritos`), para que
un seed mal escrito falle al arrancar y no muestre una tarjeta dos veces.

**Por qué**: la constitución define "**Usuario**: nombre, apellido, eventos favoritos" y la
consigna, `Usuario { favoritos: Evento[] }`. Un favorito no tiene datos propios (spec, Key
Entities: sin fecha de marcado), así que no justifica una entidad ni un repositorio.

**Alternativas**: un agregado `Favorito { usuarioId, eventoId }` con su repositorio (más piezas
sin datos propios, y contradice el modelo de la consigna); guardarlos en `Evento` (mezclaría datos
de cada usuario en un agregado público y haría que marcar compita con las compras, contra FR-007).

---

## R2 — Contrato: sub-recurso del usuario actual, `PUT`/`DELETE` idempotentes

**Decisión**:

| Método y ruta | Respuesta |
|---|---|
| `GET /api/usuarios/actual/favoritos` | `200 EventoCatalogoVista[]` |
| `PUT /api/usuarios/actual/favoritos/:eventoId` | `204` (marcar) |
| `DELETE /api/usuarios/actual/favoritos/:eventoId` | `204` (desmarcar) |

Las tres requieren usuario. Orden de rechazos: `401` → `400` (`params.eventoId`) → `404
EVENTO_NO_ENCONTRADO`. No hay `409` (FR-001). El detalle en `contracts/api.md`.

**Por qué**:

- Los favoritos son del usuario (R1), y `/usuarios/actual` ya existe: el recurso cuelga de ahí.
- `PUT` y `DELETE` sobre un elemento de un conjunto son idempotentes por definición en HTTP, que
  es exactamente FR-003: repetirlos no es un error ni duplica.
- `204` sin cuerpo: la app no necesita nada de la respuesta, porque vuelve a pedir la lista
  (R8); devolver la lista entera en cada toque armaría tarjetas que nadie lee.
- La lista es un arreglo, como `GET /eventos/mios` y `GET /compras` (no se pagina, FR-012: no hace
  falta un objeto con `pagina`).

**Alternativas**: `POST /favoritos` (no idempotente: un segundo `POST` tendría que ser un `409` o
un caso especial); `PUT /eventos/:eventoId/favorito` (cuelga del evento, que es público e igual
para todos, FR-013); un `PATCH` con `{ favorito: true | false }` (un solo endpoint, pero la acción
queda en el cuerpo y la validación se complica); `DELETE` de un evento inexistente como `204` (la
spec pide 404, FR-004).

---

## R3 — Quién orquesta: `EventoService`, que le pide la escritura a `UsuarioService`

**Decisión**:

- `UsuarioService` (dueño de `Usuario`) suma las **escrituras** del agregado:
  `marcarFavorito(usuarioId, eventoId)`, `desmarcarFavorito(usuarioId, eventoId)` y
  `quitarFavoritoDeTodos(eventoId)`. No sabe si el evento existe.
- `EventoService` suma los **casos de uso**: `marcarFavorito(eventoId, usuarioId)` y
  `desmarcarFavorito(eventoId, usuarioId)` (`this.obtenerOFallar(eventoId)` → 404; después,
  `usuarioService.…`) y `favoritosDe(usuarioId)` (la lista, R6).
- `EventoController` suma `favoritos`, `marcarFavorito` y `desmarcarFavorito`; las rutas van en
  `usuarios.routes.ts`, que pasa a recibir también `EventoController` (como `eventos.routes.ts`
  recibe `CompraController` para las reseñas, 012).
- `app.ts` no cambia de orden: `UsuarioService` ya se arma antes que `EventoService`.

**Por qué**:

- El 404 de un evento lo lanza **solo** su dueño (principio III), y `UsuarioService` no puede
  depender de `EventoService`: `EventoService → UsuarioService` ya existe y sería un ciclo.
- Es el mismo patrón que `CompraService.reseniar` (012): el caso de uso vive en el service que
  tiene las dependencias y la escritura la hace el dueño del agregado (`reseniaService.registrar`).
- La lista necesita armar tarjetas del catálogo (cupo al día, categorías, organizadores,
  puntajes): eso ya vive en `EventoService` (R6).

**Alternativas**: un `FavoritoService` nuevo que dependa de `EventoService` y `UsuarioService`
(una clase más para tres métodos, y la lista igual tendría que pedirle a `EventoService` las
tarjetas por ids, un método público más); `UsuarioService` con `eventos.existePorId` del
repositorio (repetiría el 404 del evento fuera de su dueño).

---

## R4 — Concurrencia: un cerrojo por usuario, separado del de eventos

**Decisión**:

- `app.ts` crea un **segundo** `CerrojoPorClave`, `cerrojoDeUsuarios`, que recibe solo
  `UsuarioService`. Cada escritura de un usuario corre bajo
  `cerrojoDeUsuarios.ejecutar(usuarioId, …)`: relee el usuario, aplica `marcar`/`desmarcar` y
  guarda solo si cambió (un `marcar` repetido no guarda).
- Marcar y desmarcar **no** toman el cerrojo del evento (FR-007): no esperan a las compras.
- Las lecturas (la lista) no toman ningún cerrojo.

**Por qué**: marcar es leer-modificar-guardar el usuario. Dos pedidos del mismo usuario (dos
teléfonos, FR-003 / US1-3) sobre eventos distintos no deben perder uno de los dos cambios. Con los
repositorios en memoria hoy no se intercalan, pero la regla del cerrojo existe para que el diseño
no dependa de eso (constitución, "Operaciones atómicas por evento"; la misma razón que el cerrojo
de eventos). Una instancia aparte deja claro qué protege cada una y evita mezclar ids de eventos y
de usuarios en las mismas claves.

**Alternativas**: el mismo cerrojo de eventos con claves `usuario:<id>` (mezcla dos espacios de
claves en la instancia que la constitución describe como "el cerrojo del evento"); sin cerrojo
(correcto hoy solo por un detalle de la implementación en memoria); tomar el cerrojo del evento
(haría esperar a marcar detrás de las compras, contra FR-007, y no protege al usuario: dos marcas
de eventos distintos toman cerrojos distintos).

---

## R5 — Eliminar un evento lo saca de todos los favoritos, después del cerrojo del evento

**Decisión**: `EventoService.eliminar` queda en dos tramos:

1. bajo el cerrojo del evento, como en la 004: 404 → 403 → reglas → `eventos.eliminarPorId`;
2. **después** de liberar ese cerrojo, solo si el tramo 1 terminó bien:
   `usuarioService.quitarFavoritoDeTodos(eventoId)`, que lista los usuarios que lo tienen
   (`RepositorioUsuarios.listarPorFavorito(eventoId)`) y, **de a uno**, bajo el cerrojo de cada
   usuario, lo relee, lo desmarca y lo guarda.

Si la eliminación falla (por ejemplo, el evento tiene compras), no se llega al paso 2 y ningún
favorito cambia (FR-010).

**Red de seguridad**: un marcar concurrente con la eliminación puede verificar que el evento
existe justo antes de que se elimine y guardar después de la limpieza. Ese id queda en el usuario,
pero la lista lee los eventos que existen y lo **omite sin fallar** (FR-010, R6), y la app solo
pinta estrellas sobre eventos que muestra. Desmarcarlo responde 404 (el evento no existe, FR-004);
es invisible para el usuario.

**Por qué**:

- Eliminar pasa a modificar otro agregado; lo escribe su dueño (`UsuarioService`), pedido por
  `EventoService`, que ya depende de él (spec, Assumptions 3).
- "Sin cerrojos anidados": la limpieza no puede tomar el cerrojo de cada usuario mientras tiene el
  del evento. Hacerlo después es seguro: el evento ya no existe, así que ningún marcar nuevo puede
  agregarlo (responde 404).

**Alternativas**: limpiar dentro del cerrojo del evento sin cerrojo de usuario (pierde cambios
concurrentes del usuario, R4); limpiar de forma perezosa al leer la lista (la clarificación pidió
"se limpia al eliminar"); hacer que marcar tome también el cerrojo del evento para cerrar la
carrera (anidaría cerrojos y lo haría competir con las compras, FR-007).

---

## R6 — La lista: tarjetas del catálogo armadas en lote, en el orden de "Mis eventos"

**Decisión**: `EventoService.favoritosDe(usuarioId)`:

1. `usuarioService.obtenerOFallar(usuarioId)` (el usuario actual existe: lo validó el middleware;
   el 404 es del dueño si no);
2. `eventos.listar()` una vez: de ahí salen los favoritos que **existen** (se omite el resto,
   FR-010) y los eventos de sus organizadores para el puntaje;
3. ordena con `ordenDeMisEventos(ahora)` (próximos por fecha ascendente, realizados por fecha
   descendente), que suma el desempate nombre → id (FR-009);
4. arma las tarjetas con un método privado `#tarjetasDelCatalogo(eventos, todos, ahora)`,
   **extraído** de `listar` (013): puntajes con `reseniaService.puntajesPorOrganizador`, cupo al
   día con `#conCupoAlDia`, categorías y organizadores con `obtenerPorIds`. `listar` pasa a usarlo
   para la página.

Lecturas fijas, sin importar la cantidad de favoritos (FR-011): usuario, eventos, reseñas,
pendientes (cupo), categorías y usuarios. Sin favoritos que existan, solo las dos primeras.

**Por qué**:

- FR-008 / SC-006: el organizador y el puntaje tienen que ser **los mismos** que en el catálogo;
  la manera de garantizarlo es que salgan del mismo código.
- El orden de FR-009 es el de "Mis eventos" (`ordenDeMisEventos`, 004) y el de "Mis compras" (007).
  Reusar el comparador y sumarle el desempate evita un tercero. En "Mis eventos" solo cambia el
  orden de dos eventos a la misma hora, que antes era el de inserción (no especificado).
- `eventos.listar()` en vez de `listarPorIds` + `listarPorOrganizador` por organizador: una sola
  lectura cubre las dos cosas, como en el catálogo.

**Alternativas**: un comparador nuevo `compararFavoritos` (duplica `ordenDeMisEventos`); devolver
`EventoResumenVista` (no trae organizador ni puntaje, contra FR-008); exigir que todos existan con
`obtenerPorIds` (un favorito huérfano rompería la lista, contra FR-010).

---

## R7 — App: todo en la feature `eventos`; dos hooks genéricos pasan a la base

**Decisión**:

- **`src/api/usuarios.ts`** suma `listarFavoritos`, `marcarFavorito` y `desmarcarFavorito`
  (`cliente.get/put/delete`; el `204` ya resuelve `undefined`).
- **`claves.favoritos(usuarioId)`** → `["favoritos", usuarioId]`.
- **`eventos/`** es dueña de todo lo de favoritos:
  - `useFavoritos()` (la query, con el usuario actual de la sesión);
  - `useIdsDeFavoritos(): ReadonlySet<string>`, un `Set` derivado con `select`; **vacío** mientras
    carga o si falló, sin estados propios (FR-018b);
  - `useCambiarFavorito(usuarioId, eventoId)` (R8);
  - `EstrellaFavorito` (el interruptor del detalle) y `MarcaFavorito` (la indicadora de las listas);
  - la pantalla `MisFavoritos`.
- `index.ts` de `eventos` exporta `MarcaFavorito`, `useIdsDeFavoritos` y `MisFavoritos`:
  `compras` (`FilaMiCompra`) los usa, y `eventos` no importa a nadie (FR-021).
- **Base**: `useEnvioUnico` y `useRefrescarAlFocalizar` se **mueven** de `features/compras/` a
  `src/componentes/` (son genéricos, sin imports de features). `compras` los importa desde ahí. Lo
  necesitan la estrella (FR-016) y "Mis favoritos" (FR-020), que están en `eventos`, y `eventos` no
  puede importar `compras`.
- **Ruta**: `app/favoritos.tsx` (re-export de `MisFavoritos`), apilada en el `Stack` raíz con
  `title: "Mis favoritos"` dentro del guard `conUsuario`. Perfil (feature `sesion`) suma el botón
  "Mis favoritos" con `router.push("/favoritos")` por la ruta tipada, sin importar `eventos`.

**Por qué**: las estrellas se dibujan en `eventos` (Explorar, Mis eventos, detalle, Mis
favoritos) y en `compras` (Mis compras). Como `compras → eventos` y nunca al revés, `eventos` es
el único dueño posible. Una feature `favoritos` nueva tendría que importar `TarjetaEvento` de
`eventos` y `eventos` a ella: ciclo.

**Alternativas**: dejar los dos hooks en `compras` y duplicarlos en `eventos` (dos copias de la
marca sincrónica de la 010); `MisFavoritos` en `sesion` (tendría que importar `eventos` para la
tarjeta: válido, pero la pantalla es de eventos y Perfil solo la abre); la ruta en
`(tabs)/perfil/favoritos` (convertiría la pestaña en un stack anidado; el resto de las pantallas
apiladas cuelgan del `Stack` raíz).

---

## R8 — El toque de la estrella: sin optimismo, pendiente hasta releer los favoritos

**Decisión**: `useCambiarFavorito(usuarioId, eventoId)` es una mutation sin reintentos
(`mutations.retry: false`, FR-017) con `variables: { marcar: boolean }`. En `onSettled` (éxito o
error) **devuelve** la promesa de `invalidateQueries({ queryKey: claves.favoritos(usuarioId) })`:
TanStack Query mantiene la mutation `isPending` hasta que se releen los favoritos. La estrella:

- deriva su estado **solo** de `useIdsDeFavoritos` (nunca de la mutation);
- mientras la mutation está pendiente, `disabled` y `accessibilityState.busy` (FR-016);
- envía con `useEnvioUnico`: un segundo toque antes del nuevo render no manda otro pedido;
- ante un error, el `QueryCache`/`MutationCache` lo lleva a la sesión (franja de servidor no
  disponible, como el resto) y la estrella, al releer, muestra el estado real (US1-6).

No invalida nada más: el catálogo, el detalle, "Mis compras" y "Mis eventos" no cambian (FR-018);
sus estrellas cambian porque leen la misma query. `useEliminarEvento` (004) suma la invalidación,
por prefijo, de `["favoritos"]` (los de todos los usuarios de la caché, R5).

**Por qué**: un cambio optimista tiene que deshacerse ante un error y convive mal con el doble
toque (FR-016 y el edge case "dos veces seguidas rápido"). Con un solo origen de verdad (la query)
y el botón ocupado hasta releer, lo que se ve siempre es lo que tiene el servidor. Con los
volúmenes de la demo, la relectura es instantánea en la práctica (SC-001).

**Alternativas**: `setQueryData` optimista con rollback en `onError` (más código y un estado
intermedio que puede no coincidir con el servidor); que el `PUT` devuelva la lista y escribirla en
la caché (acopla el contrato a la pantalla, R2).

---

## R9 — La estrella indicadora y la accesibilidad

**Decisión**:

- `MarcaFavorito`: un `Ionicons` `"star"` (forma llena, no solo color: FR-014/015) en
  `tema.colores.texto` sobre un círculo `resaltado`, en posición absoluta en la esquina superior
  derecha de la tarjeta o fila, con `accessible={false}` e
  `importantForAccessibility="no-hide-descendants"`: no es un elemento aparte. Quien la dibuja
  deja lugar para que no tape el nombre (padding a la derecha del título).
- `TarjetaEvento`, `FilaEvento` y `FilaMiCompra` suman la prop `esFavorito?: boolean`; con `true`
  dibujan la marca y su `accessibilityLabel` suma ", en favoritos" (US3-5). El que las lista lee
  `useIdsDeFavoritos()` una vez y pasa `esFavorito` (en `FilaMiCompra`, por `compra.evento.id`).
- `TarjetaEvento` suma `MarcaRealizado` cuando `evento.realizado` (solo pasa en "Mis favoritos":
  el catálogo no trae realizados) y "realizado" en la etiqueta.
- `EstrellaFavorito`: `Pressable` con `accessibilityRole="button"`,
  `accessibilityLabel` "Agregar a favoritos" / "Quitar de favoritos" y
  `accessibilityState={{ selected, busy, disabled }}`; ícono `"star"` / `"star-outline"`, tamaño
  táctil `tema.tamano` mínimo. Va al lado del nombre en `DetalleEvento` y no se dibuja hasta que la
  query de favoritos tiene datos (FR-018b).

**Por qué**: `selected` es lo que TalkBack anuncia como "seleccionado" (US1-1/2); la etiqueta
cambia con el estado para que el lector diga la acción. La marca de las listas solo indica
(FR-015), así que no debe ser enfocable ni tocable por separado.

**Alternativas**: `accessibilityRole="togglebutton"` (en RN se anuncia distinto según la
plataforma; `button` + `selected` se anuncia igual en las dos y lo verifica RNTL con
`toBeSelected`); `radio` (es un interruptor de una sola opción, no un grupo); un texto "Favorito" en
vez de la estrella (ocupa una línea más en cada tarjeta de 360 px).

---

## R10 — Seed

**Decisión** (FR-023, US4):

| Usuario | Favoritos |
|---|---|
| Diego | `evento-festival-sonidos-del-sur` (próximo, +30 d), `evento-clasico-de-basquet` (próximo, +5 d), `evento-noche-de-risas` (realizado, −3 d; Diego lo reseñó) |
| Valentina | `evento-noche-de-rock` (próximo), `evento-jazz-en-el-patio` (realizado) |
| Sofía | `evento-clasico-de-basquet` (**propio**: estrella en "Mis eventos"), `evento-maraton-10k` |
| Lucía, Martín | ninguno (el vacío) |

La lista de Diego queda: Clásico de básquet → Festival Sonidos del Sur → Noche de risas
(Realizado).

**Por qué**: cubre la lista con los dos grupos y la marca "Realizado" (US4-1), una estrella en
"Mis compras" (Diego tiene compras de la Noche de risas y del Festival) y en "Mis eventos" (Sofía),
y usuarios sin favoritos (US4-2). Ningún favorito es un evento sin otro uso en la demo.

**Alternativas**: dejar el seed sin favoritos (US4 pide verlos sin preparar nada).
