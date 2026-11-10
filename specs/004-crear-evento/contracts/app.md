# Contrato de la app: Crear evento (004)

Pantallas, rutas, textos, estados y diálogos de la feature. Sigue la skill `nueva-pantalla`:
la organización por feature, `SegunConsulta`, el `tema` y la accesibilidad. Los textos de
abajo son los que buscan los tests.

## Rutas

| Ruta (`app/`) | Pantalla (feature `eventos`) | Título del header | Confirma al salir |
|---|---|---|---|
| `(tabs)/mis-eventos.tsx` | `MisEventos` | "Mis eventos" | — |
| `eventos/nuevo.tsx` | `CrearEvento` | "Crear evento" | sí |
| `eventos/[eventoId]/index.tsx` | `EventoDelOrganizador` → `EditarEvento` o `VerEventoRealizado` | "Editar evento" / "Evento realizado" | solo `EditarEvento` |
| `eventos/[eventoId]/tipos-entrada/nuevo.tsx` | `AgregarTipoEntrada` | "Agregar tipo de entrada" | sí |
| `eventos/[eventoId]/tipos-entrada/[tipoEntradaId].tsx` | `EditarTipoEntrada` | "Editar tipo de entrada" | sí |

- Cada archivo de `app/` es un re-export de una línea.
- Las cuatro rutas apiladas se declaran en el `Stack.Protected` de `con-usuario` de
  `LayoutRaiz`.
- `EventoDelOrganizador` elige qué mostrar según `realizado` del servidor, nunca según el
  reloj del teléfono (FR-010a).

## Funciones de `src/api/`

| Función | Pedido |
|---|---|
| `listarCategorias(cliente, { signal })` | `GET /categorias` (sin `X-Usuario-Id`) |
| `listarMisEventos(cliente, { signal })` | `GET /eventos/mios` |
| `obtenerEvento(cliente, eventoId, { signal })` | `GET /eventos/:eventoId` |
| `crearEvento(cliente, datos, { usuarioId })` | `POST /eventos` |
| `actualizarEvento(cliente, eventoId, datos, { usuarioId })` | `PUT /eventos/:eventoId` |
| `eliminarEvento(cliente, eventoId, { usuarioId })` | `DELETE /eventos/:eventoId` → `undefined` |
| `agregarTipoEntrada(cliente, eventoId, datos, { usuarioId })` | `POST /eventos/:eventoId/tipos-entrada` |
| `editarTipoEntrada(cliente, eventoId, tipoId, datos, { usuarioId })` | `PUT …/tipos-entrada/:tipoId` |
| `quitarTipoEntrada(cliente, eventoId, tipoId, { usuarioId })` | `DELETE …/tipos-entrada/:tipoId` → `undefined` |

- Las escrituras envían el `usuarioId` **del formulario** (research R12) y no se reintentan
  solas.
- Hooks: `useCategorias()` en la feature `categorias`, y `useMisEventos(usuarioId)`,
  `useEvento(usuarioId, eventoId)` y las mutations de `mutaciones.ts` en `eventos`.
- Invalidaciones: research R15.

## Mis eventos (US2)

- Cuatro estados con `SegunConsulta`:
  - **Cargando**.
  - **Error**: el mensaje del servidor con "Reintentar", o servidor no disponible.
  - **Vacío**: "Todavía no organizás eventos." y el botón primario **"Crear tu primer
    evento"**.
  - **Con datos**.
- Con datos: botón primario **"Crear evento"** arriba de la lista (FR-006) y un `FlatList` de
  `FilaEvento`. Cada fila muestra:
  - el nombre (`tema.texto.destacado`, `peso.fuerte`);
  - `textoFechaHora(fechaHoraLocal)` · `categoria.nombre`;
  - `textoCantidadTipos(n)`;
  - si `realizado`, la marca **"Realizado"** (`MarcaRealizado`: texto sobre
    `tema.colores.neutro`, con la etiqueta escrita y no solo el color).
- La fila es un `Pressable` con `accessibilityRole="button"` y `accessibilityLabel`:
  - no realizado: `"Editar <nombre>, <fecha y hora>"`;
  - realizado: `"Ver <nombre>, realizado, <fecha y hora>"`.
- Tocar una fila lleva a `/eventos/[eventoId]`.
- Si cambia el usuario, se ven los eventos del nuevo (la clave lleva el `usuarioId`).

## Crear evento (US1)

Formulario en un `ScrollView`, en este orden:

1. **Nombre** (`TextInput`, `maxLength` 100, `accessibilityLabel` "Nombre del evento").
2. **Descripción (opcional)** (multilínea, `maxLength` 2000).
3. **Categoría**: `SelectorCategoria`, opciones con `accessibilityRole="radio"` y
   `accessibilityState.checked`. Tiene sus cuatro estados propios ("Cargando categorías…",
   error con "Reintentar").
4. **Fecha y hora**: `SelectorFechaHora`.
   - Muestra "Sin elegir" o `textoFechaHora(valor)`, con la nota "Hora de Buenos Aires".
   - Botones **"Elegir fecha"** y **"Elegir hora"** (sin campo de texto).
5. **Imágenes (opcional)**: lista de URLs con "Quitar imagen N" y el botón **"Agregar
   imagen"**, que se deshabilita con 5 URLs ("Máximo 5 imágenes").
6. **Tipos de entrada**: una o más tarjetas `CamposTipoEntrada`, con nombre, descripción
   (opcional), precio (`number-pad`, nota "0 = gratis") y cupo (`number-pad`).
   - Cada tarjeta tiene **"Quitar tipo N"**, deshabilitado cuando hay uno solo.
   - Debajo, el botón **"Agregar otro tipo de entrada"**.
7. Botón primario **"Crear evento"** (`textoEnCurso` "Creando…").

- Con éxito, vuelve a Mis eventos sin confirmar, y el evento aparece (FR-011).
- **400**: cada detalle se muestra **debajo de su campo**, en `tema.colores.peligro`, con
  `accessibilityLiveRegion="polite"`. Los detalles `body.tiposEntrada.<i>.<campo>` van en la
  tarjeta `i`.
- **409**:
  - `FECHA_NO_FUTURA` → debajo de Fecha y hora;
  - `NOMBRE_TIPO_ENTRADA_REPETIDO` → mensaje arriba de la sección de tipos.
- Cualquier otro error va en un aviso arriba del botón. **Nunca se pierde lo cargado**
  (FR-026).

## Editar evento (US3; `realizado: false`)

- Sección **Datos del evento**: los campos 1 a 5 de Crear evento, precargados desde la
  `EventoVista` (la fecha desde `fechaHoraLocal`). Botón **"Guardar cambios"**
  (`textoEnCurso` "Guardando…"); con éxito vuelve a Mis eventos sin confirmar.
- Sección **Tipos de entrada**: lista con nombre, `textoPrecio(precio)` y
  `textoCupo(cupo)`. Cada fila tiene:
  - **"Editar <nombre>"**, que lleva al formulario de tipo;
  - **"Quitar <nombre>"**, que pide confirmación: "¿Quitar <nombre>?" con
    "Cancelar" / "Quitar".

  Debajo, **"Agregar tipo de entrada"**.
- Sección final: botón **"Eliminar evento"** (variante `aviso`). Abre "¿Eliminar
  "<nombre>"?" / "Esta acción no se puede deshacer." con "Cancelar" / "Eliminar" (FR-019).
  Al confirmar, elimina y vuelve a Mis eventos sin confirmar.
- Respuestas de error:

  | Respuesta | La app |
  |---|---|
  | 400 / `FECHA_NO_FUTURA` | junto al campo |
  | `ULTIMO_TIPO_ENTRADA`, `TIPO_ENTRADA_CON_COMPRAS`, `EVENTO_CON_COMPRAS`, `403` | aviso en la pantalla con el mensaje del servidor; nada cambia |
  | `EVENTO_REALIZADO` | invalida el evento → la misma ruta pasa a `VerEventoRealizado`, con el aviso "El evento ya se realizó: no se puede modificar." |
  | `404` | `Alert` "El evento ya no existe." → vuelve a Mis eventos actualizado (US3-11), sin confirmar |

## Formulario de tipo de entrada (agregar y editar)

- Campos: **Nombre**, **Descripción (opcional)**, **Precio** y **Cupo**. Al editar, la
  etiqueta es **"Cupo disponible"** (FR-014).
- Botón **"Agregar tipo de entrada"** / **"Guardar cambios"**. Con éxito vuelve a Editar
  evento, que muestra el cambio.
- Errores: igual que arriba. `NOMBRE_TIPO_ENTRADA_REPETIDO` va debajo de Nombre. Un 404 del
  tipo o del evento vuelve a Mis eventos.

## Ver evento realizado (FR-006a; `realizado: true`)

- Muestra la marca "Realizado", el nombre (header), la categoría, la fecha y hora, la
  descripción, las URLs de multimedia como texto y los tipos (nombre, descripción, precio y
  cupo disponible).
- **Sin** acciones de editar, agregar, quitar ni eliminar. **No** pide confirmación al salir.

## Confirmación al salir (FR-026a)

- En Crear evento, Editar evento y el formulario de tipo, el atrás del header, el atrás de
  Android y el gesto de iOS abren el diálogo **"¿Descartar los cambios?"** con:
  - **"Seguir editando"** (cancel): queda en el formulario con lo cargado;
  - **"Descartar"** (destructive): sale sin guardar.
- Se pide **siempre**, haya cambios o no.
- **No** se pide:
  - después de guardar o eliminar con éxito;
  - ante un 404 que vuelve a Mis eventos;
  - cuando la salida la provoca el cambio de usuario (un 401 que olvida al usuario).

## Accesibilidad y 360 px

- Los títulos de sección (`Datos del evento`, `Tipos de entrada`) llevan
  `accessibilityRole="header"`.
- Cada `TextInput` tiene su etiqueta visible y `accessibilityLabel`. En el formulario de
  creación, los de una tarjeta de tipo llevan el número (`"Precio del tipo 2"`).
- Los errores se anuncian (`accessibilityLiveRegion="polite"`).
- Todo con `StyleSheet` + flex y valores del `tema`: sin hex ni números sueltos ni anchos
  fijos. El selector de categoría usa `flexWrap`.
- Tema nuevo: `colores.neutro` (`#52606d`) y `colores.sobreNeutro` (`#ffffff`) para
  "Realizado". El contraste es mayor que 4,5:1.
