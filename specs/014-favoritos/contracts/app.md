# Contrato de la app: Favoritos (014)

Todo lo de favoritos es de la feature `eventos` (research R7); `compras` usa lo que exporta su
`index.ts`. Visual "Pop Brutal" (`tema`), sin estilos sueltos.

## Base

- `src/api/usuarios.ts`: `listarFavoritos(cliente, usuarioId, { signal })` →
  `GET /usuarios/actual/favoritos`; `marcarFavorito(cliente, usuarioId, eventoId)` → `PUT`;
  `desmarcarFavorito(cliente, usuarioId, eventoId)` → `DELETE` (los dos resuelven `undefined`).
  Exportadas por `src/api/index.ts`.
- `claves.favoritos(usuarioId)` → `["favoritos", usuarioId]`.
- `useEnvioUnico` y `useRefrescarAlFocalizar` se mueven de `features/compras/` a
  `src/componentes/` (exportados por su `index.ts`), sin cambiar su comportamiento; `compras` los
  importa desde ahí y sus tests se mueven con ellos.

## `eventos`: hooks

| Hook | Contrato |
|---|---|
| `useFavoritos()` | query `claves.favoritos(usuarioId)` con el usuario de la sesión; `EventoCatalogoVista[]` |
| `useIdsDeFavoritos()` | `ReadonlySet<string>` con los ids de los favoritos; **vacío** mientras carga o con error (FR-018b). Comparte la query de `useFavoritos` (una sola consulta por usuario) |
| `useCambiarFavorito(usuarioId, eventoId)` | mutation sin reintentos, `variables: { marcar }`; `onSettled` devuelve la invalidación de `claves.favoritos(usuarioId)` (pendiente hasta releer, R8). No invalida catálogo, detalle, "Mis compras" ni "Mis eventos" (FR-018) |
| `useEliminarEvento` (cambia) | suma la invalidación, por prefijo, de `["favoritos"]` |

## `EstrellaFavorito` (en `DetalleEvento`)

- Al lado del nombre del evento, en el encabezado del detalle. Es el **único** lugar donde se marca
  o desmarca (FR-014). La ven todos, también el organizador del evento.
- No se dibuja hasta que `useFavoritos` tiene datos (FR-018b).
- Estado leído **solo** de `useIdsDeFavoritos().has(evento.id)`:

| Estado | Ícono | `accessibilityLabel` | `accessibilityState` |
|---|---|---|---|
| no favorito | `star-outline` | "Agregar a favoritos" | `selected: false` |
| favorito | `star` | "Quitar de favoritos" | `selected: true` |
| cambio en curso | el del estado actual, atenuado | igual | `busy: true, disabled: true` |

- `accessibilityRole="button"`, área táctil mínima del tema.
- Al tocar: `useEnvioUnico` → `mutate({ marcar: !esFavorito })`. Un segundo toque durante el envío no
  manda otro pedido (FR-016). Error: lo informa la sesión (franja), la estrella muestra el estado
  releído (FR-017, US1-6).

## `MarcaFavorito` (indicadora, solo lectura)

- Estrella llena (`star`) sobre un círculo `resaltado` con borde, en **posición absoluta** en la
  esquina superior derecha de la tarjeta o fila. El contenido deja lugar para no quedar tapado.
- No es tocable aparte ni accesible aparte (`accessible={false}`,
  `importantForAccessibility="no-hide-descendants"`) (FR-015).
- La usan, con la prop `esFavorito?: boolean` (por defecto `false`):

| Componente | Lista | Etiqueta con `esFavorito` |
|---|---|---|
| `TarjetaEvento` | Explorar, Mis favoritos | la actual + ", en favoritos" |
| `FilaEvento` | Mis eventos | la actual + ", en favoritos" |
| `FilaMiCompra` (`compras`) | Mis compras | la del `Pressable` + ", en favoritos" (por `compra.evento.id`) |

- La pantalla que lista llama a `useIdsDeFavoritos()` una vez y pasa `esFavorito` a cada fila. Sin
  favoritos cargados, ninguna estrella y la lista se ve igual (US3-7).
- No se agrega a Compras del evento, Registrar ingreso ni "Ver mis entradas" (FR-015).
- `TarjetaEvento` suma `MarcaRealizado` y ", realizado" en la etiqueta cuando `evento.realizado`.

## Pantalla `MisFavoritos` (`app/favoritos.tsx`)

- Ruta `/favoritos`, apilada en el `Stack` raíz (guard `conUsuario`), header "Mis favoritos" con
  atrás (FR-020). `app/favoritos.tsx` es un re-export de una línea.
- Se llega desde **Perfil**: botón "Mis favoritos" (`Boton` primario o `aviso`), encima de "Cambiar
  usuario", con `router.push("/favoritos")`.
- `SegunConsulta` con `useFavoritos()` (FR-019):
  - **cargando**: `Cargando` (o esqueletos de tarjeta);
  - **error**: `MensajeError` con reintentar;
  - **vacío**: `ListaVacia` "Todavía no tenés favoritos" con la acción "Ir a Explorar", que lleva
    a la pestaña Explorar (`router.navigate("/")`, como "Mis compras");
  - **con favoritos**: una `TarjetaEvento` por favorito con `esFavorito`, en el orden del servidor;
    tocarla abre `/explorar/[eventoId]` (US2-4).
- Se vuelve a pedir en cada foco salvo el primero (`useRefrescarAlFocalizar`), así desmarcar en el
  detalle y volver muestra la lista nueva (US2-5).

## `Perfil` (`sesion`)

Suma el botón "Mis favoritos" (navega por la ruta tipada; `sesion` no importa `eventos`). La barra
inferior no cambia (Explorar · Mis compras · Mis eventos · Perfil).

## Tests esperados (resumen)

- `tests/features/eventos/`: `useIdsDeFavoritos` (vacío sin datos), `EstrellaFavorito` (etiquetas,
  `selected`, `busy`, doble toque = un pedido, error → estado real).
- `tests/pantallas/`: detalle (marcar y desmarcar, con el `PUT`/`DELETE` registrado por
  `crearFetchFalso`), Mis favoritos (cuatro estados, orden, "Ir a Explorar", abrir el detalle,
  refresco al volver), Explorar / Mis compras / Mis eventos (estrella y etiqueta "en favoritos" solo
  en los favoritos; sin estrellas con la consulta de favoritos fallando), Perfil (botón).
- `renderConDependencias`: si un test no registra `GET /usuarios/actual/favoritos`, responde `[]`
  (como el catálogo y "Mis compras").
