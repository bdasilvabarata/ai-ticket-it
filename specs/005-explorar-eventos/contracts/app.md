# Contrato de la app: Explorar eventos (005)

Pantallas, rutas, textos, estados y componentes de la feature. Sigue la skill `nueva-pantalla`
y los patrones de `specs/004-crear-evento/contracts/app.md`. Los textos de abajo son los que
buscan los tests.

## Rutas

| Ruta (`app/`) | Pantalla (feature `eventos`) | Título del header |
|---|---|---|
| `(tabs)/index.tsx` | `Explorar` (reemplaza la `SeccionPendiente`) | "Explorar" (el de la pestaña) |
| `explorar/[eventoId].tsx` **(nueva)** | `DetalleEvento` | "Evento" |

- Los dos archivos son un re-export de una línea.
- `explorar/[eventoId]` se declara en el `Stack.Protected` de `con-usuario` de `LayoutRaiz`.
- Tocar una tarjeta → `router.push({ pathname: "/explorar/[eventoId]", params: { eventoId } })`.
  Un evento propio abre el mismo detalle público.
- `tests/tipos/rutas-tipadas.ts` suma `/explorar/[eventoId]` con su parámetro.

## Funciones de `src/api/` y hooks

| Función | Pedido |
|---|---|
| `listarEventos(cliente, consulta, { signal })` **(nueva)** | `GET /eventos?…` sin `X-Usuario-Id`; solo los parámetros con valor, `orden` siempre |
| `obtenerEvento(cliente, eventoId, { signal })` | sin cambios (la vista suma `organizador`) |

| Hook (feature `eventos`) | Clave |
|---|---|
| `useCatalogo(consulta)` **(nuevo)** | `claves.catalogo(consulta)` = `["catalogo", { texto, categoriaId, orden }]` (sin usuario) |
| `useInvalidarCatalogo()` **(nuevo)** | invalida el prefijo `["catalogo"]` |
| `useValorDemorado(valor, ms)` **(nuevo)** | — (debounce de 500 ms del texto) |
| `useEvento(usuarioId, eventoId)` | `claves.evento(usuarioId, eventoId)` (reusado) |

Las mutations de la 004 suman `["catalogo"]` a sus invalidaciones.

## Explorar

Arriba (fuera de los estados, siempre visible y usable):

| Control | Accesibilidad | Comportamiento |
|---|---|---|
| Buscador, placeholder "Buscar por nombre o descripción" | `accessibilityLabel="Buscar eventos"` | `maxLength = LIMITES_BUSQUEDA.texto` (100); la lista se actualiza 500 ms después de la última tecla; el skeleton aparece desde la primera tecla |
| Categoría: "Todas" + las del catálogo | `radiogroup` "Categoría"; cada opción `radio` con `checked` | una sola; "Todas" al abrir; cambio inmediato |
| Orden: "Fecha" · "Precio" · "Puntaje" | `radiogroup` "Ordenar por"; `radio` con `checked` | "Fecha" al abrir; cambio inmediato |

Debajo, los estados:

| Estado | Qué se ve |
|---|---|
| Cargando (primera carga, cada cambio de texto, categoría u orden) | 3 `TarjetaSkeleton`, anunciadas como "Cargando eventos" |
| Error (servidor no disponible) | el de `SegunConsulta` ("Servidor no disponible" + "Reintentar"), además de la franja global |
| Error (otro) | el mensaje del servidor o "Ocurrió un error inesperado." + "Reintentar" |
| Vacío, `hayEventosProximos: false` | "Todavía no hay eventos próximos." (aunque haya texto o categoría) |
| Vacío, `hayEventosProximos: true` | "Ningún evento coincide con tu búsqueda." + botón "Limpiar búsqueda" (texto `""`, categoría "Todas"; el orden queda) |
| Éxito | `FlatList` de `TarjetaEvento`, en el orden del servidor |

Las categorías tienen sus propios estados dentro del selector (como en la 004): "Cargando
categorías…" y el error con "Reintentar"; mientras tanto el catálogo funciona con "Todas".

### TarjetaEvento

| Línea | Texto |
|---|---|
| Nombre | `evento.nombre` |
| Categoría · fecha | `categoria.nombre` · `textoFechaHora(fechaHoraLocal)` ("vie 15 nov 2026 · 19:00") |
| Precio | `textoPrecioDesde(precioDesde)`: "Gratis" / "desde $ 8.000" |
| Organizador | "Organiza Sofía Castro" · `textoPuntaje`: "Sin reseñas" / "4,5 · 12 reseñas" / "5,0 · 1 reseña" |
| Marca | badge "Agotado" si `agotado` (texto, no solo color) |

`Pressable` con `accessibilityRole="button"` y un `accessibilityLabel` con todos esos textos
separados por comas.

## Detalle del evento

| Estado | Qué se ve |
|---|---|
| Cargando / error ≠ 404 | los de `SegunConsulta` |
| 404 | "No encontramos este evento." + `Boton` "Volver a Explorar"; invalida el catálogo |
| Éxito | lo de abajo |

En orden:
1. Si `realizado`: `MarcaRealizado` y el texto "Este evento ya se realizó".
2. Nombre (`header`), categoría, fecha y hora, descripción (si tiene).
3. `FilaImagenes`: fila horizontal desplazable; cada imagen con `accessibilityLabel="Imagen N de
   M de <nombre>"`; una imagen que falla (`onError`) se quita sin dejar hueco; sin multimedia o
   sin ninguna que cargue, la fila no aparece.
4. "Organiza" (`header`): "Martín Benítez" · `textoPuntaje`.
5. "Tipos de entrada" (`header`): `ListaTiposEntrada` sin acciones: nombre, descripción (si
   tiene) y "`textoPrecio` · `textoCupo`" ("$ 25.000 · Agotado", "Gratis · 200 disponibles").
6. Sin botón de compra (lo agrega la 006).

## Textos derivados (`formato.ts`)

| Función | Ejemplos |
|---|---|
| `textoPrecioDesde(precio)` | `0` → "Gratis" · `8000` → "desde $ 8.000" |
| `textoPuntaje({ puntaje, cantidadResenias })` | `null` → "Sin reseñas" · `4.5, 12` → "4,5 · 12 reseñas" · `5, 1` → "5,0 · 1 reseña" · `4.45` → "4,5" · `4.04` → "4,0" |
| `textoPrecio`, `textoCupo`, `textoFechaHora` (004) | sin cambios |

## Piezas base ampliadas

| Pieza | Cambio (lo de siempre no cambia) |
|---|---|
| `SegunConsulta` | `cargando?: ReactNode` (por defecto `<Cargando />`) · `vacio?: ReactNode` en lugar de `mensajeVacio` |
| `ListaVacia` | `accion?: { texto, alPresionar }` → `Boton` `aviso` debajo del mensaje |
| `SelectorCategoria` (feature) | modo `conTodas` con `valor: string \| null` y `alCambiar(string \| null)` |
| `tema` | lo que falte para la tarjeta, el skeleton y las imágenes (por ejemplo `tamano.imagenDetalle`), nunca un número suelto en la pantalla |
