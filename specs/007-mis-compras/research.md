# Research: Mis compras (007)

Decisiones del plan. Cada una dice qué se eligió, por qué y qué se descartó. Se apoya en lo que
ya construyó la 006 (`specs/006-comprar-entradas/research.md`, R1–R19) y no lo repite.

## R1. Endpoint: `GET /api/compras`, las compras del usuario actual

**Decisión**: `GET /api/compras` en `compras.routes.ts`, con `requerirUsuario` y sin parámetros
(no hay filtro, búsqueda ni paginación: FR-007, "No incluye"). Devuelve `MiCompraVista[]`, ya
ordenado (R5). Si llega una query, se ignora (como en el resto de las rutas sin query).

**Por qué**:
- Es el recurso `compras` de la 006 visto desde el comprador, que es el usuario actual
  (principio VI): no hace falta `compradorId` en la ruta ni en la query, y así nadie puede pedir
  las compras de otro (FR-001, SC-006).
- `router.get("/")` no choca con `/:compraId`.
- Devuelve un arreglo, como `GET /eventos/mios` (Mis eventos), porque la lista no lleva datos
  extra (el vacío es uno solo: FR-007).

**Descartado**:
- `GET /usuarios/:id/compras`: abre la puerta a pedir las de otro y obliga a un 403 que no aporta.
- `GET /compras?compradorId=…`: mismo problema, y un parámetro que siempre sería el usuario actual.
- Un objeto `{ compras: [...] }`: no hay nada más que poner al lado.

Orden de chequeos: 401 (sin usuario o con uno inexistente, el middleware de siempre) → 200. No hay
404, 403 ni 409.

## R2. Lectura "al día": `Compra.alDia(ahora)`, sin cerrojo y sin guardar

**Decisión** (consultada con el autor durante el plan): `CompraService.misCompras(usuarioId)` lee
el reloj **una vez**, pide `listarPorComprador(usuarioId)` y pasa cada compra por
`compra.alDia(ahora)`, como ya hacen `CompraService.obtener` y `misComprasDelEvento`. No toma el
cerrojo ni guarda nada (FR-003). Una pendiente vencida sale `CANCELADA` por el sistema, fechada
en `venceEn` (006, R3), y por eso su fila dice "Venció sin pagarse" (R6).

**Por qué**: la lectura al día de **una compra** es dominio puro desde la 006. `VencimientoService`
hace otras dos cosas: calcular el cupo que liberan las vencidas (para mostrar eventos) y
materializarlas dentro del cerrojo (para escribir). "Mis compras" no muestra cupo y es una
lectura, así que no lo necesita.

**Descartado**: un método nuevo `VencimientoService.alDia(compras, ahora)`, como pedía el input
del plan. Solo envolvería a `Compra.alDia` y dejaría dos caminos para lo mismo. Se le consultó al
autor y eligió `Compra.alDia`.

## R3. Los eventos en lote: `EventoService.obtenerPorIds`

**Decisión**:
- `RepositorioEventos.listarPorIds(ids)`: los eventos que existen de esos ids, sin repetir, como
  el de usuarios y categorías.
- `EventoService.obtenerPorIds(ids)`: un `Map` por id en **una** lectura; si falta alguno, 404
  `EVENTO_NO_ENCONTRADO` (convención de nombres de AGENTS.md).

`CompraService.misCompras` le pide a `EventoService` los eventos de las compras con los ids sin
repetir. En total son **dos lecturas por pedido**, una de compras y una de eventos, sin importar
cuántas compras haya (FR-002, SC-007).

**Por qué**:
- Es el patrón de la constitución para un agregado ajeno: "búsquedas en lote, sin N+1", y el
  cruce lo hace el dueño.
- `CompraService` ya depende de `EventoService` (006, R4), así que no aparece ningún ciclo.
- El 404 no debería ocurrir nunca: un evento con compras no se puede eliminar (004). Si ocurriera,
  hay una inconsistencia y conviene que salte.

**Descartado**:
- `obtenerOFallar` por compra: N+1.
- Que `CompraService` lea `RepositorioEventos`: es un agregado ajeno (principio III).
- Mostrar el cupo al día de esos eventos (`#conCupoAlDia`): la fila no lo usa.

## R4. Días restantes: `domain/dias-restantes.ts`, días de calendario en Buenos Aires

**Decisión**: una función pura nueva:

```ts
diasRestantes(fechaHoraEvento: Date, ahora: Date): number | null
```

- `null` si el evento ya empezó (`ahora ≥ fechaHoraEvento`, inclusive). Es el mismo criterio que
  `Evento.estaRealizado` (FR-011).
- Si no empezó: la diferencia en días entre la **fecha de pared** del evento y la de `ahora`,
  las dos sacadas con `horaDeBuenosAires(...)` (los primeros 10 caracteres, `"YYYY-MM-DD"`) y
  restadas como fechas UTC de medianoche (`Date.UTC(a, m − 1, d)`, diferencia / 86 400 000).
  Siempre es un entero ≥ 0 (FR-009).

El `ahora` lo lee `CompraService` de su `Reloj` inyectado y lo pasa como argumento, porque
`domain/` no conoce el reloj (AGENTS.md, "Reloj"). La zona horaria solo la conoce
`hora-buenos-aires.ts`; esta función se apoya en ella y no repite el desfase.

Solo una `CONFIRMADA` lleva días restantes: en las demás, el mapeo de la vista (R6) manda
`diasRestantes: null` sin llamar a la función.

**Por qué**:
- Días de calendario y no bloques de 24 horas (Clarifications): un evento de mañana a las 21:00
  es 1 tanto a las 00:01 como a las 23:59.
- Restar fechas de medianoche UTC no tiene problemas de horario de verano (Argentina no lo usa,
  y además las dos fechas están en la misma escala).

**Descartado**:
- `Math.ceil((evento − ahora) / 24 h)`: falla el caso de las 23:59 (FR-009).
- `Intl` o `toLocaleDateString` con zona horaria: depende del ICU del proceso y duplica lo que ya
  resuelve `hora-buenos-aires.ts`.
- Un método de `Evento`: los días no son una regla del evento; con una función aparte, los tests
  de borde son más directos.

Tests de borde (SC-003): 10 días; mañana a las 00:01 y a las 23:59; hoy, más tarde; el instante
exacto de inicio (`null`); ya empezado el mismo día (`null`); medianoche de Buenos Aires
(02:59:59 Z → 03:00 Z, cuando pasa de 1 a 0).

## R5. Orden: `domain/orden-mis-compras.ts`, comparador puro

**Decisión**: un comparador sobre un `OrdenableMiCompra`:

```ts
interface OrdenableMiCompra {
  id: string;
  creadaEn: Date;
  fechaHoraEvento: Date;
  eventoRealizado: boolean;
}
compararMisCompras(a, b): number
```

El orden es el de FR-006:
1. primero las de eventos no realizados;
2. las no realizadas, por `fechaHoraEvento` ascendente, y las realizadas, descendente;
3. desempata `creadaEn` descendente y después `id` ascendente.

`eventoRealizado` lo calcula el service con `evento.estaRealizado(ahora)`, así el criterio de
"realizado" queda en un solo lugar. El comparador no recibe `ahora`. Como en el catálogo (005),
se ordenan elementos con los datos de la entidad y su vista ya armada, y sale la vista.

**Por qué**: es el mismo patrón que `ordenarCatalogo` y `ordenDeMisEventos`, testeable sin
service, y el orden es estable (termina en el id).

**Descartado**: ordenar en la app; FR-006 dice que el orden lo da el servidor.

## R6. Vista `MiCompraVista` en `shared/`, armada con la base de `CompraVista`

**Decisión**:

```ts
type MiCompraVista = Omit<CompraVista, "compradorId" | "historial"> & {
  diasRestantes: number | null;
  canceladaPor: "sistema" | "usuario" | null;
};
```

- Reusa el evento (con `fechaHoraLocal` y `realizado`), el tipo, el total, `venceEn` y
  `venceEnLocal` de la 006. Así la fila y "Tu compra" leen los mismos campos y con el mismo
  significado.
- Saca el historial y el comprador (FR-005): la fila no los necesita.
- `diasRestantes`: R4, y solo en `CONFIRMADA`.
- `canceladaPor`: solo en `CANCELADA`. Vale `"sistema"` si `compra.fueVencida()` y `"usuario"` si
  no (FR-014). Se usa el método que ya existe; no se agrega nada al dominio.

En `compra.vistas.ts`, los campos comunes salen a una función privada (`datosComunes(compra,
evento, ahora)`). `aCompraVista` le suma `compradorId` e `historial`, y `aMiCompraVista` le suma
`diasRestantes` y `canceladaPor`. Las dos vistas no se pueden desalinear.

**Descartado**:
- Devolver `CompraVista` completa: expone el historial (FR-005) y no trae días ni motivo.
- Un tipo con los campos copiados uno por uno: se desalinearía de `CompraVista`.
- Mandar el texto ("Mañana") desde el servidor: los textos son de la app (Clarifications: "El
  servidor devuelve el número y la app arma el texto").

## R7. Mobile: `useMisCompras`, clave por usuario e invalidaciones

**Decisión**:
- `claves.misCompras(usuarioId)` = `["mis-compras", usuarioId]` (el usuario en la posición 1).
- `useMisCompras(usuarioId)` en `features/compras/` y `obtenerMisCompras(cliente, { signal })` en
  `src/api/compras.ts`.
- Las tres mutations de `mutaciones.ts` suman
  `invalidateQueries({ queryKey: claves.misCompras(usuarioId) })` a su `onSettled`, con éxito y
  con error (FR-017, SC-005).

**Por qué**:
- La clave con el usuario hace que, al cambiarlo, la query sea otra: sin datos y en "cargando".
  No se usa `placeholderData`, así nunca se ve una compra del anterior (FR-019, SC-006).
- `"mis-compras"` y `"mis-compras-del-evento"` son primeros elementos distintos, así que no se
  invalidan una a la otra por prefijo.
- La pestaña queda montada mientras se navega a "Tu compra", así que la query sigue activa y la
  invalidación la vuelve a pedir enseguida.

## R8. Refresco al enfocar la pestaña

**Decisión**: la pantalla usa `useFocusEffect` de `expo-router` (ya es dependencia) y llama a
`refetch()` cada vez que la pestaña recibe el foco, **salvo el primero**: el montaje ya pide la
lista y así no se pide dos veces. El primer foco se reconoce con un `useRef`.

**Por qué**: FR-017 y US4-5 piden volver a pedir la lista al volver a la pestaña aunque no haya
pasado el `staleTime` de 30 s (por ejemplo, una pendiente que venció mientras tanto). El
`focusManager` de TanStack solo mira el `AppState` (la app en primer plano), no el foco de la
pestaña.

**Descartado**:
- `staleTime: 0` con `refetchOnMount`: las pestañas no se desmontan al cambiar de una a otra, así
  que no alcanza.
- `useIsFocused` con un efecto: hace lo mismo con más código.

## R9. Volver a pedir la lista al llegar la hora límite más próxima

**Decisión**:
- Una función pura `esperaHastaElProximoVencimiento(compras, ahoraMs): number | null` en
  `features/compras/vencimientos.ts`:
  - sin pendientes, `null` (FR-018: no se programa nada);
  - si hay, `max(min(venceEn) − ahoraMs + 1 000, 5 000)` ms.
- Un hook `useRefrescarAlVencer(compras, refetch)` que, con los datos de cada respuesta, programa
  un único `setTimeout` con esa espera y lo cancela al cambiar los datos o al desmontar.

El reloj del teléfono **solo se usa para programar** el pedido. Quién decide que venció es el
servidor: si todavía no venció según él, la respuesta trae la pendiente y se programa otro pedido.

**Por qué**:
- El margen de 1 s cubre el redondeo y que el servidor considera vencida desde el instante exacto
  (006, R3).
- El mínimo de 5 s evita una ráfaga de pedidos si el reloj del teléfono adelanta: en ese caso se
  pide cada 5 s hasta que el servidor la venza.
- No hace falta nada fuera de `features/compras`.

**Descartado**:
- `refetchInterval`: pediría la lista todo el tiempo, también sin pendientes.
- Que la app marque la compra como `CANCELADA` por su cuenta: FR-018 lo prohíbe.
- Un temporizador por compra: alcanza con la próxima, porque cada respuesta reprograma el pedido.

Tests: la función pura con reloj fijo (sin pendientes, una, varias, ya pasada → 5 s) y, en la
pantalla, timers falsos de Jest. Con una pendiente que vence en 2 minutos, la lista se vuelve a
pedir a los 2 min + 1 s y la segunda respuesta (`CANCELADA`) la muestra sin "Pagar".

## R10. Pantalla, fila y textos

**Decisión**:
- `MisCompras` (`features/compras/pantallas/MisCompras.tsx`) con `SegunConsulta` (los cuatro
  estados). El vacío es `ListaVacia` con "Todavía no compraste entradas" y la acción "Ir a
  Explorar" → `router.navigate("/")`. Es una pestaña: `dismissTo` no corresponde.
- `FilaMiCompra` (`features/compras/componentes/`): un contenedor (`View`, sin rol) con dos
  hermanos:
  - un `Pressable` con los datos (nombre del evento, `textoFechaHora(evento.fechaHoraLocal)`, el
    tipo · cantidad · total, `EtiquetaEstadoCompra` y su aviso), que abre "Tu compra"
    (`router.push` a `/compras/[compraId]`);
  - solo si es una `PENDIENTE`, **debajo y fuera de ese `Pressable`**, el botón "Pagar"
    ("Confirmar" si el total es 0), que abre "Tu compra" igual.
- Los textos van en `features/compras/formato.ts`, puros:
  - `textoDiasRestantes(dias, fechaHoraLocal)`: 0 → "Hoy · HH:MM", 1 → "Mañana", N → "Faltan N
    días";
  - `textoAvisoDeMiCompra(compra)`: el aviso de la fila según el estado, o `null`. Para una
    `CANCELADA` usa `canceladaPor` ("Venció sin pagarse" / "La cancelaste"). Convive a propósito
    con `textoCancelada` de la 006: aquella es el aviso largo de "Tu compra", sale del historial
    y dice qué pasó con las entradas; esta es el aviso corto de la fila. Las dos distinguen lo
    mismo (el sistema al vencer o el comprador), y la 007 no cambia la de la 006;
  - `textoAccionDePago(total)`: "Pagar" o "Confirmar". La usa también "Tu compra", que hoy tiene
    ese texto suelto.
- Para la fecha y el total se reusan `textoFechaHora`, `textoTotal`, `textoCantidad` y
  `textoVencimiento`, que ya existen.

**Por qué**:
- El `Pressable` de los datos ocupa casi toda la fila, así que el área de toque es grande.
- "Pagar" va como **hermano** y no anidado (principio VII, accesibilidad). Un `Pressable` con
  `accessibilityRole="button"` es accesible y agrupa a sus hijos: TalkBack lo lee como un solo
  elemento y no puede enfocar un botón que esté adentro. Los tests de RNTL lo encontrarían igual,
  así que la falla no se vería. Con hermanos, TalkBack anuncia por separado "Ver la compra de …"
  y "Pagar la compra de …".
- Los textos se ajustan a 360 px con `flexShrink` y `flexWrap` (FR-020), como en
  `FilaCompraConfirmada`.

**Descartado**:
- Reusar `FilaCompraPendiente` o `FilaCompraConfirmada` del detalle: no muestran el evento y
  tienen acciones propias del detalle ("Cancelar").
- Agrupar por evento: va contra "una fila por compra".
- "Pagar" como `Pressable` anidado dentro de la fila: TalkBack no podría enfocarlo (ver arriba).
- Toda la fila como un botón con `accessibilityActions` para "Pagar": esconde una acción
  principal en el menú de acciones del lector de pantalla y suma código que los tests apenas
  cubren.
- Reusar `textoCancelada` en la fila: es una oración larga, pensada para "Tu compra".

## R11. Tests

| Capa | Archivo | Qué verifica |
|---|---|---|
| domain | `tests/domain/dias-restantes.test.ts` (nuevo) | los bordes de R4 |
| domain | `tests/domain/orden-mis-compras.test.ts` (nuevo) | los bloques, el sentido de cada uno, los desempates y la estabilidad (FR-006) |
| repositories | `compra.repository.test.ts` y `evento.repository.test.ts` (+) | `listarPorComprador` (solo las suyas, en todos los estados); `listarPorIds` (sin repetir, ignora los que no existen) |
| services | `compra.service.test.ts` (+) | solo las propias, ni las de sus eventos; pendiente vencida → `CANCELADA` del sistema sin guardar (el repositorio sigue `PENDIENTE`); días solo en confirmadas y bajan al adelantar el reloj un día; `canceladaPor`; nombre y fecha actuales; total fijo; orden; dos lecturas (repositorios espiados) con 30 compras en 10 eventos (SC-007) |
| services | `evento.service.test.ts` (+) | `obtenerPorIds`: el `Map`, una lectura y 404 si falta uno |
| api | `tests/api/compras.test.ts` (+) | 401 sin usuario o con uno inexistente; 200 con la forma de `MiCompraVista` (sin `historial` ni `compradorId`); seed: Martín `CONFIRMADA`, Diego `CANCELADA` con `canceladaPor: "sistema"`, Lucía `[]` |
| api | `tests/api/docs.test.ts` (sin cambios) | ya exige que OpenAPI cubra la ruta nueva |
| mobile | `tests/api/compras.test.ts` (+) | `obtenerMisCompras` → `GET /compras` con `X-Usuario-Id` |
| mobile | `tests/features/compras/formato.test.ts` (+) y `vencimientos.test.ts` (nuevo) | textos y espera |
| mobile | `tests/pantallas/mis-compras.test.tsx` (nuevo) | los cuatro estados; la fila de cada estado (los cinco); tocar la fila y "Pagar" abre "Tu compra"; volver a la pestaña la vuelve a pedir; volver a pedirla al vencer; el cambio de usuario sin ver las del anterior; la lista refrescada después de pagar desde "Tu compra" |

`renderConDependencias` responde `GET /compras` con `[]` si el test no lo registra, como ya hace
con `mis-compras` del evento: así los tests de otras pantallas que pasan por la pestaña no se
rompen.
