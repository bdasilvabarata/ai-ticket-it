# Contrato de la app: Paginación (013)

Qué ve y qué hace el usuario en cada pantalla. Lo que no se nombra acá no cambia.

## Paginador (componente común, `src/componentes/Paginador.tsx`)

Props: `pagina: PaginaVista` (la de la respuesta) y `alCambiar(numero)`.

| Situación | Se ve |
|---|---|
| `totalPaginas ≤ 1` (también una lista vacía) | nada (FR-010) |
| 2 a 5 páginas | un botón por página: `1 2 3` |
| 6 o más | 5 botones según `botonesDelPaginador` (FR-008): con 10 páginas, actual 1 → `1 2 3 4 10`; 6 → `1 5 6 7 10`; 9 → `1 7 8 9 10` |

- **Cada botón** es un elemento accesible propio: `accessibilityRole="button"`,
  `accessibilityLabel="Página N"` y, en la actual, `accessibilityState={{ selected: true }}`.
  TalkBack dice "Página 6, seleccionado, botón".
- **La actual** se ve con relleno `resaltado` (con `texto` encima), la sombra dura `nivel1` y el
  número en Archivo Black. Las demás van sobre `superficie`, con el mismo borde, sin sombra y en
  Archivo. Se distingue sin ver colores, por la sombra y el peso (FR-009, SC-007). No suma tokens
  nuevos al tema.
- **Tocar la actual** no hace nada (no llama a `alCambiar`). No está `disabled`.
- Mide `tema.tamano` de toque mínimo y entra en 360 px con 5 botones.
- Usa solo `tema`, sin valores sueltos.

## Explorar

- Debajo de la última tarjeta, el `Paginador` con la `pagina` del catálogo.
- Tocar otra página:
  - muestra el skeleton "Cargando eventos" y después las tarjetas de esa página;
  - la lista empieza arriba;
  - los controles (buscador, categoría, orden) no se mueven ni pierden lo escrito.
- Cambiar el texto (después de la demora de 500 ms), la categoría, el orden o el sentido vuelve a
  la página 1 (FR-013).
- Los vacíos no cambian ("Ningún evento coincide…" con "Limpiar búsqueda", o "Todavía no hay
  eventos próximos."), y en ellos no se ve el paginador.
- Al volver del detalle (la pestaña no se desmonta) sigue en la misma página.

## Compras del evento (organizador)

- El encabezado, la ventana de uso, "Registrar ingreso", el resumen por tipo y el contador "N
  compras con mensajes sin responder" se ven siempre. Son de **todas** las compras y no cambian con
  la página ni con el filtro (FR-016).
- **Los chips** ("Todas", "Sin responder" y los cinco estados) se muestran si `cantidadCompras > 0`.
  Con `0`, el texto "Todavía nadie compró entradas" en su lugar y sin paginador.
- **Elegir un chip** pide al servidor la página 1 con ese filtro:
  - "Sin responder" manda `sinResponder=true`;
  - un estado manda `estado=<ESTADO>`;
  - "Todas" no manda ninguno.
- **Mientras llega** una página o un filtro nuevo, en lugar de las filas y del paginador se ve
  "Cargando compras…". El resto sigue a la vista y las filas anteriores no se muestran.
- **Un filtro sin resultados** muestra su vacío ("No hay compras canceladas", "No hay mensajes sin
  responder"…), sin paginador y con los chips visibles.
- **El paginador** va debajo de la última fila. Al cambiar de página, la pantalla vuelve arriba.
- Después de "Confirmar reembolso", de volver de "Registrar ingreso" o del chat (foco), la lista se
  vuelve a pedir **en la misma página y con el mismo filtro**. Si esa página ya no existe, se ve la
  última y el paginador la marca (FR-005, FR-018).
- Salir de la pantalla y volver a entrar empieza en la página 1, con "Todas".

## Detalle del evento: "Reseñas del organizador"

- Pide `…/resenias-del-organizador/resumen`.
- Muestra el puntaje y la cantidad reales (`textoPuntaje`, el mismo de la tarjeta) y hasta **3**
  `FilaResenia`.
- Si `organizador.cantidadResenias > 3`, debajo de las 3 aparece el botón "Ver todas las reseñas"
  (`Boton` variante `texto`), que abre `/explorar/[eventoId]/resenias`. Con 3 o menos, o sin
  reseñas, no aparece.
- El vacío ("Todavía no tiene reseñas", sin puntaje), el cargando y el error siguen siendo propios
  de la sección (012).

## "Ver todas las reseñas" (nueva: `app/explorar/[eventoId]/resenias.tsx` → `TodasLasResenias`)

- El título del `Stack` es "Reseñas del organizador".
- Se arma con `PantallaDesplazable` y `SegunConsulta`:
  - **cargando**: "Cargando reseñas…";
  - **error**: el `MensajeError` de siempre, con reintento; un 404 muestra "No existe el evento."
    (US5-5);
  - **vacío**: `SIN_RESENIAS`;
  - **éxito**: el nombre del organizador como encabezado, `textoPuntaje(organizador)`, una
    `FilaResenia` por reseña (hasta 10, en el orden del servidor) y el `Paginador`.
- Al cambiar de página, la pantalla vuelve arriba y el puntaje no cambia.
- Es pública: la ve igual cualquier usuario, también el organizador.

## Consultas y claves (`src/consultas/claves.ts`)

| Clave | Cambia |
|---|---|
| `catalogo(consulta)` | `ClaveCatalogo` suma `pagina: number` (sin usuario, como en la 005) |
| `comprasDelEvento(usuarioId, eventoId, filtroYPagina?)` | `["compras-del-evento", usuarioId, eventoId, { filtro, pagina }]`. Sin el tercer argumento es el prefijo, que siguen usando las mutations de la 008 a la 011 |
| `reseniasDelOrganizador(usuarioId, eventoId)` | ahora es la del **resumen** (la sección): `["resenias-del-organizador", usuarioId, eventoId]` |
| `paginaDeResenias(usuarioId, eventoId, pagina)` (nueva) | `["resenias-del-organizador", usuarioId, eventoId, "pagina", pagina]` |

- `useReseniarEvento` ya invalida el prefijo `["resenias-del-organizador"]`: alcanza también a las
  páginas.
- Las mutations de compras ya invalidan por prefijo `comprasDelEvento(usuarioId, eventoId)` o
  `["compras-del-evento"]`: alcanzan todas las páginas y filtros.

## Funciones de `src/api/`

| Función | Pedido |
|---|---|
| `listarEventos(cliente, { …, pagina })` | agrega `pagina` solo si es distinta de 1 (así las URLs de la 005 siguen iguales para la página 1) |
| `obtenerComprasDelEvento(cliente, eventoId, { pagina, estado, sinResponder }, { signal })` | agrega cada parámetro solo si tiene valor (`pagina ≠ 1`, `estado` definido, `sinResponder === true`) |
| `obtenerResumenDeResenias(cliente, eventoId, { signal })` (renombra la de la 012) | `GET …/resenias-del-organizador/resumen`, sin usuario |
| `obtenerReseniasDelOrganizador(cliente, eventoId, pagina, { signal })` | `GET …/resenias-del-organizador?pagina=N` (`pagina` solo si ≠ 1), sin usuario |

## Tests de apoyo

- `renderConDependencias` responde por defecto, si el test no lo registra:
  - `/resenias-del-organizador/resumen` con la vista vacía;
  - el catálogo y Compras del evento con `pagina` de lista vacía.
- Los helpers de compras (`tests/helpers/compras.ts`) suman `pagina` y `cantidadCompras` a la vista
  de ejemplo.
