# Research: Compras de un evento

Decisiones de diseño de la 008. Cada una trae la decisión, por qué y qué otras opciones se
descartaron. Se apoyan en el código de la 004 a la 007 (`Compra` con historial, vencimiento
perezoso, cerrojo por evento, vistas de `compra.vistas.ts`).

## R1. La `Entrada` vive dentro del agregado `Compra`

**Decisión**: `Entrada` es una clase de `domain/compra.ts` (o `domain/entrada.ts`, importada por
`compra.ts`) embebida en la `Compra`: `compra.entradas`, una por unidad (`entradas.length ===
cantidad`). Se guarda con `RepositorioCompras`, como `TipoEntrada` se guarda con
`RepositorioEventos`. Tiene **código** (su identificador) y sus **cambios propios**
(`cambios: CambioEstadoCompra[]`, los posteriores a la confirmación; hoy, como mucho uno a
`UTILIZADA`). No tiene id aparte: el código ya es único.

**Estado de una entrada** (derivado, FR-012a): si la compra está `CONFIRMADA` o `UTILIZADA`, el
del último cambio propio o, sin cambios, `CONFIRMADA`; si no, el estado de la compra (también al
día: `compra.alDia(ahora)` vence la compra y con ella sus entradas). Así el "estado idéntico al
de la compra hasta confirmarse" no se puede desincronizar: no se guarda dos veces.

**Historial de una entrada** (FR-013): el de la compra hasta la confirmación inclusive, más sus
cambios propios. El dominio lo expone si hace falta; ninguna vista lo necesita hoy.

**Invariantes nuevas de `Compra`** (constructor): `entradas.length === cantidad`; códigos
distintos dentro de la compra y con el formato de R2; una entrada con cambios solo si la compra
llegó a `CONFIRMADA`; la compra está `UTILIZADA` si y solo si al menos una entrada lo está.

**Alternativas**: un agregado `Entrada` con repositorio propio (descartada: el uso cambia la
entrada **y** la compra —la primera vez—, y tenerlas en dos agregados obliga a dos guardados y a
un orden entre ellos; dentro de la compra es un solo `guardar`); guardar el estado en cada
entrada desde el alta (descartada: duplicaría el estado de la compra en cada transición de la 006
y del vencimiento).

## R2. Código: 8 caracteres de un alfabeto sin ambigüedades, lo da el repositorio

**Decisión**: el código son 8 caracteres del alfabeto Crockford base 32 sin ambiguos
(`0123456789ABCDEFGHJKMNPQRSTVWXYZ`: sin I, L, O ni U), al azar con `crypto.randomInt`. Se guarda
y viaja **canónico** (`7K3MQ9TB`); la app lo muestra en dos grupos (`7K3M-Q9TB`). Lo genera el
repositorio (constitución: los ids nuevos los da el repositorio):
`RepositorioCompras.siguientesCodigosDeEntrada(cantidad)` devuelve `cantidad` códigos distintos
entre sí y de todos los ya guardados (reintenta ante una colisión; con 32⁸ ≈ 10¹² combinaciones
no ocurre en la práctica).

**Normalización** (edge case "con espacios o en minúsculas"): `normalizarCodigo(texto)` en
`domain/codigo-de-entrada.ts` (puro): mayúsculas y sin espacios ni guiones. Se aplica a lo que
llega por la URL antes de buscar. Un texto que normalizado no tiene el formato no es un 400: es
"no hay ninguna entrada con ese código en este evento" (404), igual que uno inexistente; así la
validación de forma solo exige un texto no vacío de hasta 32 caracteres.

**Seed**: códigos fijos y válidos para la demo y los tests (por ejemplo, `VPM4RT1N`…), elegidos
a mano en el alfabeto.

**Alternativas**: UUID (descartado: no se dicta ni se tipea); un correlativo por evento
(descartado: adivinable, y el código va a ser un QR); generar el código en el dominio o en el
service (descartado por la constitución).

## R3. Recursos y rutas

**Decisión** (todas con usuario, contrato en [contracts/api.md](./contracts/api.md)):

| Método y ruta | Qué hace |
|---|---|
| `GET /api/eventos/:eventoId/compras` | "Compras del evento": resumen por tipo + todas las compras, al día |
| `GET /api/eventos/:eventoId/entradas/:codigo` | busca una entrada del evento por su código (lo que la app muestra antes de confirmar) |
| `POST /api/eventos/:eventoId/entradas/:codigo/uso` | registra el uso de esa entrada (sin cuerpo) |

- El `GET` sobre la colección `compras` del evento complementa el `POST` de la 006 (alta): el
  mismo recurso, otro verbo y otro rol.
- `entradas` es un router hijo de `eventos/:eventoId` (`mergeParams`), como `tipos-entrada`. El
  código va **bajo el evento**: un código de otro evento es un 404 de este (FR-014), sin revelar
  nada del otro.
- El uso es un sub-recurso `uso` con `POST` sin cuerpo, como `/pago` y `/cancelacion` de la 006.

**Alternativas**: `POST /eventos/:eventoId/usos` con `{ codigo }` en el cuerpo (descartada: la
búsqueda previa igual necesita un `GET` por código, y tener los dos sobre el mismo recurso es más
legible); `/compras/:compraId/entradas/:codigo/uso` (descartada: el organizador no conoce la
compra, solo el código).

## R4. `EntradaService`, dueño de las operaciones sobre entradas

**Decisión**: un service nuevo, `EntradaService`, como `TipoEntradaService` para `TipoEntrada`:
vive dentro de un agregado ajeno (`Compra`) y escribe con el repositorio de ese agregado
(`RepositorioCompras`). Métodos: `obtener(eventoId, codigo, usuarioId)` (lectura) y
`registrarUso(eventoId, codigo, usuarioId)` (escritura). Recibe `compras`, `eventoService`,
`usuarioService`, `cerrojo` y `reloj`. `app.ts` lo arma después de `CompraService`
(`VencimientoService → EventoService → TipoEntradaService → CompraService → EntradaService`); no
depende de `CompraService` (no lo necesita: busca la compra por código, no por id), así que no hay
ciclo ni orden forzado entre ellos.

"Compras del evento" (la lista y el resumen) sí es de `CompraService.comprasDelEvento`: lista
compras, que son suyas.

**Búsqueda por código**: `RepositorioCompras.buscarPorCodigoDeEntrada(codigo)` → la `Compra` o
`null`. El service exige `compra.eventoId === eventoId`; si no, 404 `ENTRADA_NO_ENCONTRADA` (el
mismo que un código inexistente).

**Alternativas**: todo en `CompraService` (descartada: ya tiene siete casos de uso y el de
entradas tiene sus propias reglas de ventana y de estado); un repositorio de entradas (R1).

## R5. Orden de los chequeos y códigos de error

**`GET /eventos/:eventoId/compras`**: 401 → 400 (forma del id) → 404 `EVENTO_NO_ENCONTRADO` →
403 `SIN_PERMISO`.

**`GET …/entradas/:codigo`**: 401 → 400 → 404 evento → 403 → 404 `ENTRADA_NO_ENCONTRADA`. No es
un 409 que la entrada no se pueda usar: la búsqueda devuelve el estado y la ventana, y la app dice
por qué (FR-019).

**`POST …/entradas/:codigo/uso`**: 401 → 400 → 404 evento → 403 → 404 entrada → 409
`FUERA_DE_HORARIO_DE_USO` → 409 `TRANSICION_INVALIDA`. La ventana va primero, como
`EVENTO_REALIZADO` antes que los demás 409 (AGENTS.md, "Orden de los chequeos de una
escritura"): es una regla del evento, no de la entrada.

- `FUERA_DE_HORARIO_DE_USO`: "El ingreso se registra desde el 18/11 19:00 hasta el 19/11 11:00."
  (horas de Buenos Aires, FR-016).
- `TRANSICION_INVALIDA` con un mensaje según el estado de la entrada (acceptance 7 de la US3):
  `UTILIZADA` → "Esta entrada ya se utilizó."; `PENDIENTE` → "La compra de esta entrada todavía
  no se pagó."; `CANCELADA` → "La compra de esta entrada está cancelada."; `REEMBOLSADA` → "La
  compra de esta entrada fue reembolsada.". Un mismo código para todos, como pide FR-014; el
  mensaje es lo que cambia.

Los 404 y 403 los lanza el service con `errors/` (`EntradaNoEncontradaError` nuevo, como
`CompraNoEncontradaError`); los 409, el dominio con `ReglaDeNegocioError`.

## R6. Lectura de "Compras del evento": al día, sin cerrojo, lecturas fijas

**Decisión**: `CompraService.comprasDelEvento(eventoId, usuarioId)`:

1. `ahora` del reloj (uno por pedido).
2. `EventoService.leerDelOrganizador(id, usuarioId, ahora)` (**nuevo**): 404 → 403 → el evento
   con el **cupo al día sin guardar** (el `#conCupoAlDia` que ya usan `obtener` y `listar`). Es la
   contraparte de lectura de `obtenerDelOrganizador`, que materializa y solo se usa dentro de un
   cerrojo. Mensaje del 403: "Solo el organizador del evento puede ver sus compras.".
3. `RepositorioCompras.listarPorEvento(eventoId)` (**nuevo**) → `compra.alDia(ahora)` a cada una.
4. `UsuarioService.obtenerPorIds(compradores)` (ya existe), en lote; sin compras, no se llama.
5. Resumen y orden con funciones puras del dominio (R7).

Cuatro lecturas como máximo, cualquiera sea la cantidad de compras (evento, pendientes del
vencimiento, compras del evento, compradores): sin N+1 (FR-002). Sin cerrojo y sin guardar
(FR-004, reglas de lectura de la 006). `CompraService` pasa a recibir `UsuarioService` (no forma
ciclo: `UsuarioService` solo depende de repositorios).

**Alternativas**: calcular los disponibles desde las compras en vez de pedir el evento al día
(descartada: los disponibles los define el cupo del evento y SC-003 exige que coincidan con el
detalle; recalcularlos sería una segunda fuente de verdad); usar `obtenerDelOrganizador`
(descartada: guarda, y las lecturas no guardan).

## R7. Resumen por tipo y orden de la lista: funciones puras

**Decisión**: `domain/compras-del-evento.ts`:

- `resumenPorTipo(tipos, comprasAlDia)` → por tipo y en el orden del evento: `disponibles` =
  `tipo.cupo` (el evento ya viene al día), `pendientes` = Σ cantidad de las `PENDIENTE` (al día,
  las vencidas ya son `CANCELADA`), `vendidas` = Σ cantidad de las `CONFIRMADA` y `UTILIZADA`,
  `usadas` = Σ entradas `UTILIZADA`. Las canceladas y reembolsadas no suman (FR-007). Un tipo sin
  compras sale con su cupo y ceros (US2, acceptance 6).
- `compararComprasDelEvento(a, b)`: `creadaEn` descendente, desempate por `id` (FR-005).

Usar una entrada no toca el cupo (FR-009): `registrarUso` no llama a `TipoEntradaService`.

## R8. Ventana de uso: módulo puro con la hora de Buenos Aires en el mensaje

**Decisión**: `domain/ventana-de-uso.ts`:

- `HORAS_ANTES_DEL_INICIO = 4`, `HORAS_DESPUES_DEL_INICIO = 12` (fijas, FR-016; no van a
  `shared/`: la app recibe la ventana ya calculada).
- `ventanaDeUso(fechaHoraEvento)` → `{ desde, hasta }`.
- `estadoDeVentana(ventana, ahora)`: `"antes"` si `ahora < desde`, `"abierta"` si `desde ≤ ahora ≤
  hasta` (ambos inclusive), `"despues"` si `ahora > hasta`. La vista lo manda tal cual: la app
  arma "desde…" o "hasta…" sin leer su reloj.
- `exigirVentanaAbierta(fechaHoraEvento, ahora)`: si no, `ReglaDeNegocioError`
  `FUERA_DE_HORARIO_DE_USO` con desde y hasta en hora de Buenos Aires (`horaDeBuenosAires`,
  formato "DD/MM HH:mm").

La ventana se calcula con el reloj del servidor leído **dentro** del cerrojo (FR-016). El evento
de las 23:00 da 19:00 → 11:00 del día siguiente (edge case) sin casos especiales: son
milisegundos.

## R9. `Compra.registrarUso` y la transición `CONFIRMADA → UTILIZADA`

**Decisión**: `compra.registrarUso(codigo, organizadorId, ahora)` devuelve una `Compra` nueva:

1. Busca la entrada por código (el service ya la encontró por ese código; si no está, es un error
   de programación: lanza `TRANSICION_INVALIDA` igual, nunca un 404 desde el dominio).
2. Si el estado de la entrada no es `CONFIRMADA` → `TRANSICION_INVALIDA` con el mensaje de R5.
3. La entrada suma `{ estado: UTILIZADA, autor: organizador, fechaHora: ahora }`.
4. Si la compra estaba `CONFIRMADA` (primera entrada usada), la compra suma el mismo cambio
   (FR-012d); si ya estaba `UTILIZADA`, su historial no cambia.

Se llama sobre `compra.alDia(ahora)` (una pendiente vencida no materializada falla como
`CANCELADA`, FR-014), aunque dentro del cerrojo los vencimientos del evento ya se materializaron.

**Efectos sobre lo existente** (la 006 y la 007 solo conocían `CONFIRMADA`):

- `esVigente(ahora)` suma `UTILIZADA`: una compra usada sigue contando para el tope por persona
  (si no, usar una entrada liberaría tope para comprar más).
- `cancelar` ya rechaza todo lo que no es `PENDIENTE`: una `UTILIZADA` no se cancela (FR-020). La
  009 parte de ahí.
- `MisComprasDelEventoVista.confirmadas` incluye las `UTILIZADA` ("Ver mis entradas" muestra sus
  códigos, FR-012b); el nombre del campo no cambia para no romper el contrato de la 006.
- `diasRestantes` sigue solo para `CONFIRMADA` (una `UTILIZADA` muestra "N de M entradas
  usadas").

**Alternativas**: pasar la compra a `UTILIZADA` recién al usar **todas** sus entradas (descartada
en el clarify).

## R10. Escritura del uso bajo el cerrojo del evento

**Decisión**: `EntradaService.registrarUso` hace todo dentro de
`cerrojo.ejecutar(eventoId, …)` (FR-015):

1. `ahora` del reloj.
2. `eventoService.obtenerDelOrganizador(eventoId, usuarioId, ahora)`: 404 → 403 → materializa los
   vencimientos del evento (toda escritura de un evento lo hace, AGENTS.md).
3. Relee la compra con `buscarPorCodigoDeEntrada(normalizarCodigo(codigo))`; 404 si no existe o es
   de otro evento.
4. `exigirVentanaAbierta(evento.fechaHora, ahora)`.
5. `compra.alDia(ahora).registrarUso(codigo, usuarioId, ahora)` y `compras.guardar`.
6. Devuelve la vista de la entrada (R11) con el comprador (`usuarioService.obtenerOFallar`).

Dos usos simultáneos de la misma entrada (o un uso y una cancelación de la compra, que toma el
mismo cerrojo) se serializan: el segundo relee y falla con "Esta entrada ya se utilizó"
(US3, acceptance 10; SC-006). Un solo `guardar`: no hay orden de guardado que cuidar.

La búsqueda (`obtener`) es una lectura: sin cerrojo, con `leerDelOrganizador` y la compra al día.

## R11. Vistas: códigos solo para el comprador

**Decisión** (`shared/src/compra.ts`, detalle en [data-model.md](./data-model.md)):

- `EntradaVista { codigo, estado, usadaEn, usadaEnLocal }`.
- `CompraVista` (006) suma `entradas: EntradaVista[]` (vacío si la compra no está `CONFIRMADA` ni
  `UTILIZADA`: en una no confirmada no se muestran códigos, FR-012b) y `entradasUsadas`.
- `MiCompraVista` (007) omite `entradas` y conserva `entradasUsadas` ("2 de 4 entradas usadas" en
  la fila, FR-012e).
- `ComprasDelEventoVista` (nueva, del organizador): `ventanaDeUso`, `resumenPorTipo` y
  `compras: CompraDelEventoVista[]`, **sin códigos** (FR-012b: nadie más que el comprador los ve;
  el organizador conoce solo el que le dictan).
- `EntradaDelEventoVista` (nueva): la entrada que el organizador buscó, con su código (el que
  ingresó), estado, comprador, tipo, `entradasUsadas` y la `ventanaDeUso` con su `estado`. Con eso la
  app decide si ofrece "Registrar ingreso" y, si no, por qué (FR-019), sin leer su reloj.

`CompraDelEventoVista` lleva el comprador (`{ id, nombre, apellido }`), `creadaEnLocal` (la app no
convierte zonas) y `canceladaPor` (como la 007).

## R12. Seed: un evento con la ventana abierta al arrancar

**Decisión** (edge case "Para la demo…"): un evento nuevo de Lucía, **"Peña en La Rueda"**
(Música), que empieza a la hora en punto más cercana a `ahora + 2 h` (entre 1,5 y 2,5 h después
del arranque): la ventana está abierta desde el arranque y durante unas 14 horas. Tipos "General"
(6.000, cupo 120) y "Con cena" (15.000, cupo 40). Con compras de ejemplo:

- Martín: 3 "General", `CONFIRMADA`, con 1 entrada ya usada (la compra `UTILIZADA`: "1 de 3").
- Sofía: 2 "Con cena", `CONFIRMADA`, sin usar (sus códigos se usan en la demo).

Las compras existentes del Festival suman sus entradas con códigos fijos (Martín, 2 VIP; Diego, 1
General cancelada). Ninguna `PENDIENTE`, como hasta ahora (la demo no depende de la hora).

**Impacto**: el catálogo del seed pasa de 6 a 7 eventos próximos y Lucía organiza 4; los tests que
cuentan eventos del seed (`api/eventos.test.ts`, `domain/datos-ejemplo.test.ts`,
`repositories/repositorios-de-ejemplo.test.ts`, y los de mobile que usen esos números) se ajustan
en la misma tarea.

**Alternativas**: mover la fecha de "Noche de Rock" (descartada: hoy prueba el redondeo a 24 h y
la usan varios tests); depender del reloj fijo de los tests para la demo (descartada: la demo se
hace con el servidor real).

## R13. App: dos pantallas dentro de `features/compras`

**Decisión**:

- **"Compras del evento"** (`ComprasDelEvento`, ruta `eventos/[eventoId]/compras`): el botón
  "Registrar ingreso", la ventana de uso, el resumen por tipo y la lista. Se abre con "Ver
  compras" desde `EditarEvento` y `VerEventoRealizado` (FR-001, SC-001: Mis eventos → evento →
  "Ver compras").
- **"Registrar ingreso"** (`RegistrarIngreso`, ruta `eventos/[eventoId]/ingreso`): el campo del
  código, "Buscar", la tarjeta de la entrada encontrada (comprador, tipo, estado, "N de M
  entradas usadas") y "Registrar ingreso" con confirmación (`Alert.alert`, como "Cancelar" de la
  006; FR-018). Tras registrar, el campo se vacía y queda listo para el siguiente (SC-004).
  Está dentro de "Compras del evento" en el sentido de la spec (FR-012c): se llega solo desde ahí
  y al volver la lista se refresca por foco. Separarla deja el teclado y el estado de la búsqueda
  fuera de la lista.

`eventos` **no importa** `compras` (sería un ciclo, AGENTS.md): el botón navega por ruta tipada
(`router.push({ pathname: "/eventos/[eventoId]/compras", params })`), y las rutas de `app/`
re-exportan las pantallas de `compras`.

**Consultas y claves** (`consultas/claves.ts`):

- `comprasDelEvento(usuarioId, eventoId)` → `["compras-del-evento", usuarioId, eventoId]` (sin
  prefijo compartido con `mis-compras-del-evento`).
- `entradaDelEvento(usuarioId, eventoId, codigo)` → `["entrada-del-evento", usuarioId, eventoId,
  codigo]`, con el código normalizado en la app solo para la clave (mayúsculas, sin espacios ni
  guiones; el servidor vuelve a normalizar).

**Refresco** (FR-023, US4): `ComprasDelEvento` vuelve a pedir al enfocarse salvo la primera vez,
con el mismo patrón de `MisCompras` (`useFocusEffect`); sin refresco por vencimiento (Assumptions).
La búsqueda es una query habilitada solo con un código enviado; "Buscar" de nuevo con el mismo
código hace `refetch`.

**Mutation `useRegistrarUso(usuarioId, eventoId)`** (FR-021): sin reintentos; con éxito escribe
la respuesta en la clave de la entrada; al terminar invalida `comprasDelEvento`, la entrada, el
evento de todos los usuarios (`["evento", *, eventoId]`: los vencimientos que materializó pueden
cambiar el cupo), `["catalogo"]` y las vistas del comprador **de cualquier usuario** por prefijo
(`["compra"]`, `["mis-compras"]`, `["mis-compras-del-evento"]`): el comprador es otro usuario y
puede estar en caché en el mismo dispositivo.

**404 del evento** (FR-024): como `DetalleEvento`, `esNoEncontrado` → aviso y
`router.dismissTo("/mis-eventos")`. El 403 no tiene camino en la app (solo se llega desde un
evento propio): si llega, `SegunConsulta` muestra el error.

## R14. Vistas del comprador

**Decisión**:

- "Tu compra" (`Compra.tsx`) y "Ver mis entradas" (`FilaCompraConfirmada`) muestran, en una
  `CONFIRMADA` o `UTILIZADA`, la lista de sus entradas con el código en grupos (`7K3M-Q9TB`,
  `textoCodigo`) y su estado con `EtiquetaEstadoCompra` (el único componente de estado: una
  entrada usa los mismos estados que una compra). Componente nuevo `ListaDeEntradas` en
  `features/compras/componentes/`.
- En una `UTILIZADA`, "Tu compra", "Ver mis entradas" y la fila de "Mis compras" dicen "N de M
  entradas usadas" (`textoEntradasUsadas`; FR-012e). `textoAvisoDeMiCompra` suma el caso
  `UTILIZADA`.
- `Compra.tsx` trata `UTILIZADA` como `CONFIRMADA` donde hoy pregunta por `CONFIRMADA` (lo que
  muestra de una compra pagada), sin acciones nuevas.
- Accesibilidad: cada código se lee de a un carácter (`accessibilityLabel` con los caracteres
  separados por espacios, `textoCodigoAccesible`) para que TalkBack no lo lea como palabra.

## R15. Constitución: enmienda MINOR (2.5.0)

**Decisión**: la spec suma la entidad **Entrada**, que la constitución no lista (Assumptions de la
spec). Se agrega en "Entidades" (`Compra` suma "sus **Entradas**, una por unidad, cada una con
código y estado") y se aclara en "Estados de una compra" que `CONFIRMADA → UTILIZADA` ocurre con
la primera entrada usada. No contradice ninguna regla: refina. Es una enmienda MINOR (se amplía
una sección) con `/speckit-constitution`, como primera tarea de la feature y antes del código.

## R16. Tests

- **domain**: `codigo-de-entrada` (normalizar, formato), `ventana-de-uso` (bordes exactos de 4 h y
  12 h, 1 minuto afuera de cada lado, evento a las 23:00), `compra` (entradas al registrar,
  invariantes, estado derivado, al día, `registrarUso` con primera y siguientes, cada estado
  inválido con su mensaje, `esVigente` con `UTILIZADA`), `compras-del-evento` (resumen con cada
  estado, pendiente vencida, tipo sin compras; orden con desempate), `datos-ejemplo`.
- **repositories**: `listarPorEvento`, `buscarPorCodigoDeEntrada`, `siguientesCodigosDeEntrada`
  (distintos entre sí y de los guardados, formato).
- **services**: `CompraService.comprasDelEvento` (al día sin guardar, 403/404, lecturas fijas con
  repositorios espiados), `EventoService.leerDelOrganizador`, `EntradaService` (búsqueda, uso,
  orden de chequeos, ventana con reloj movible, uso no toca el cupo) y `concurrencia` (N usos
  simultáneos → un cambio `UTILIZADA`; uso y cancelación).
- **api**: los tres endpoints con cada status, la normalización del código, y la cobertura de
  OpenAPI (test existente).
- **mobile**: `api/compras` (tres funciones), `formato` (textos nuevos), pantallas
  `compras-del-evento` y `registrar-ingreso` (cuatro estados, resumen, "Agotado", confirmación,
  rechazo con motivo, invalidaciones, foco, 404), y las del comprador (códigos en "Tu compra" y
  "Ver mis entradas", "N de M" en "Mis compras").
