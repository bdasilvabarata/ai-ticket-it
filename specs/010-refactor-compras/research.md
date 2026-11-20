# Research: Refactor de Mis compras, Compras del evento y Cancelación

No quedaron `NEEDS CLARIFICATION` en el contexto técnico: es un refactor sobre tecnología conocida,
sin dependencias nuevas. Lo que sigue son las decisiones de diseño, contrastadas con el código
actual (`backend/src/domain/compra.ts`, `services/entrada.service.ts`, `services/compra.vistas.ts`,
`mobile/src/features/compras/`).

## R1. Forma de la `Entrada`: uso y cancelación explícitos

**Decision**: `Entrada { codigo; uso: RegistroDeEntrada | null; cancelacion: RegistroDeEntrada |
null }` con `RegistroDeEntrada { usuarioId: string; fechaHora: Date }`, en `domain/entrada.ts`.
Expone `usada`, `cancelada`, `usadaEn` (= `uso?.fechaHora ?? null`), `estadoPropio`
(`UTILIZADA` si usada, `CANCELADA` si cancelada, si no `CONFIRMADA`: el estado **desde** la
confirmación), `usar(organizadorId, ahora)` y `cancelar(compradorId, ahora)`, que devuelven una
`Entrada` nueva. El estado visible lo da la compra: `Compra.estadoDe(entrada)` = el de la compra si
nunca se confirmó; si no, `entrada.estadoPropio` (FR-008). `estadoEn(compra)`, `cambios`,
`ultimoEstadoPropio` y `tieneCambioA` desaparecen.

**Rationale**: la entrada solo tiene dos cambios posibles y cada uno ocurre a lo sumo una vez; una
lista de `CambioEstadoCompra` obligaba a recorrerla y a validar su largo (`cambios.length === 1`).
El autor siempre es un usuario (el organizador que usa, el comprador que cancela), así que no hace
falta `AutorDelCambio`. Con `entrada.ts` sin importar `Compra` no hay dependencia circular entre
los dos módulos. Que el estado visible lo calcule la compra respeta "hasta que la compra se
confirma, el estado de cada entrada es el de la compra" sin pasarle la compra a la entrada (FR-007).

**Alternatives considered**: (a) `estado` guardado en la entrada: duplicaría el estado de la
compra antes de confirmarse, contra la constitución ("no se guarda por separado"). (b) Mantener
`cambios` y solo agregar getters: no reduce las invariantes ni la lectura. (c) Entrada como
agregado propio: descartado en el backlog.

## R2. Invariantes de `Compra`: una lista de reglas con nombre

**Decision**: `domain/reglas-de-compra.ts` exporta `REGLAS_DE_COMPRA: readonly ReglaDeCompra[]`
con `ReglaDeCompra { nombre; campo; mensaje; cumple(propiedades): boolean }` y los predicados que
también usa la compra (`pasoPorConfirmada`, `canceladaTrasConfirmar`). El constructor de `Compra`
hace `for (const regla of REGLAS_DE_COMPRA) invariantes.exigir(regla.cumple(p), regla.campo,
regla.mensaje)` y `verificar()`. Las once reglas y sus mensajes están en `data-model.md`. Cuando una
regla solo tiene sentido si otra se cumple (una entrada por unidad exige una cantidad entera ≥ 1),
la condición está escrita en la propia regla con el mismo predicado (`esCantidadValida`), no en una
guarda que combine resultados (FR-010). Se evalúan todas y se informan todas las que fallan.

`reglas-de-compra.ts` importa **solo tipos** de `compra.ts` (`PropiedadesCompra`,
`CambioEstadoCompra`): `import type` se borra al compilar, no hay ciclo en tiempo de ejecución, y el
lint del backend no aplica `import-x/no-cycle` (solo `mobile/`).

**Rationale**: hoy `sonEntradasValidas` + `entradasCoherentes` mezclan cinco casos en un `switch` y
devuelven un solo mensaje genérico ("Debe haber una por unidad, con códigos válidos y distintos, y
cambios propios coherentes…"): al fallar no se sabe qué regla se rompió. Con una regla por
predicado, cada test de dominio prueba una regla aislada (SC-003) y el mensaje la nombra.

**Alternatives considered**: métodos privados `#exigirX` en `Compra` (mantiene todo en el mismo
archivo y no llega a ≤ 300 líneas); un esquema zod (mezcla validación de forma con reglas de
dominio y trae una dependencia a `domain/`).

**Compatibilidad**: los campos de los detalles no cambian (`cantidad`, `total`, `historial`,
`entradas`); cambian los mensajes de `entradas`, que solo verifican los tests de dominio (los de API
nunca construyen una compra inválida). `camposInvalidos` de `compra.test.ts` sigue funcionando; un
campo puede aparecer más de una vez si fallan dos reglas del mismo campo (los tests que comparan
con `["entradas"]` pasan a comparar el conjunto o el mensaje, sin perder el caso).

## R3. Un solo dueño de las compras: `EntradaService` delega en `CompraService`

**Decision**:

- `CompraService.obtenerPorCodigoOFallar(eventoId, codigo)` (público): recibe el código canónico;
  si el formato no es válido, no hay compra con ese código o es de otro evento →
  `EntradaNoEncontradaError` (404 `ENTRADA_NO_ENCONTRADA`). Es el único lugar que busca una compra
  por código (convención `obtenerOFallar`).
- `CompraService.registrarUso(eventoId, codigo, usuarioId): Promise<EntradaDelEventoVista>`: el
  cuerpo que hoy tiene `EntradaService.registrarUso`, sin cambios de orden (R4).
- `EntradaService` recibe `{ compraService, eventoService, usuarioService, reloj }`: ya no recibe
  `compras` ni `cerrojo`. `obtener` sigue siendo suyo (lectura) y usa
  `compraService.obtenerPorCodigoOFallar`; `registrarUso` es una línea que delega. El controller y
  la ruta no cambian.
- `app.ts`: el orden `VencimientoService → EventoService → TipoEntradaService → CompraService →
  EntradaService` no cambia; la arista nueva `EntradaService → CompraService` va del que usa al
  dueño, sin ciclo (FR-016).

**Rationale**: elimina la segunda pieza que hace `guardar` de compras en casos de uso, contra
"cada service escribe solo su agregado". `CompraService` ya tiene `UsuarioService` para armar la
vista con el comprador, y ya hace lo mismo en `cancelar` y `confirmarReembolso`.

**Excepción documentada**: `VencimientoService.vencerPendientes` sigue guardando las pendientes
vencidas (no cambia; spec, Clarifications).

**Alternatives considered**: (a) borrar `EntradaService` y mover también `obtener` a
`CompraService` (cambia el controller; la spec pide conservarlo). (b) Que `EntradaService` siga
leyendo con `RepositorioCompras` para `obtener`: dejaría dos lugares que buscan una compra por
código y lanzan el 404.

## R4. Orden de chequeos y cerrojo de `CompraService.registrarUso`

**Decision**: idéntico al actual, dentro de `cerrojo.ejecutar(eventoId, …)`:
`ahora = reloj.ahora()` → `eventoService.obtenerDelOrganizador(eventoId, usuarioId, ahora)` (404
`EVENTO_NO_ENCONTRADO` → 403, y materializa los vencimientos) → `normalizarCodigo` →
`obtenerPorCodigoOFallar` (404 `ENTRADA_NO_ENCONTRADA`, relee la compra después de materializar) →
`exigirVentanaAbierta` (409 `FUERA_DE_HORARIO_DE_USO`) → `compra.alDia(ahora).registrarUso(…)`
(409 `TRANSICION_INVALIDA`) → **un** `guardar` → vista. El 401 y el 400 siguen en middlewares.

**Rationale**: FR-015. Los tests de `concurrencia-compras.test.ts` (dos usos del mismo código; uso
y cancelación a la vez) cubren que el segundo ve lo que hizo el primero.

## R5. `compra.reembolso` como valor derivado único

**Decision**: `get reembolso(): EstadoDeReembolso | null` con `EstadoDeReembolso = "pendiente" |
"confirmado"`: `"confirmado"` si el estado es `REEMBOLSADA`; `"pendiente"` si es `CANCELADA`, se
confirmó antes y `total > 0`; si no, `null`. Reemplaza a `tieneReembolsoPendiente()` (se borra).
`confirmarReembolso` usa `this.reembolso` (`"confirmado"` → «ya se confirmó»; `null` → «no tiene un
reembolso pendiente»; mismos mensajes y orden). `aReembolsoVista` queda en una línea:
`compra.reembolso ? { estado: compra.reembolso, monto: compra.total } : null`. `canceladaDesde` se
conserva (es un campo de las vistas).

**Rationale**: FR-012. El tipo literal se declara en `domain/` (estructuralmente igual a
`ReembolsoVista["estado"]` de `shared/`, que no cambia); así `domain/` no depende de un tipo de
vista.

## R6. Vistas compuestas en `compra.vistas.ts`

**Decision**: piezas privadas que devuelven un subconjunto de campos, compartidas por las cinco
vistas de compra:

| Pieza | Campos | La usan |
|---|---|---|
| `aTipoDeLaCompra(compra, evento)` | `{ id, nombre }` del tipo (nombre del evento actual) | `datosComunes`, `aCompraDelEventoVista`, `aEntradaDelEventoVista` |
| `aCompradorVista(usuario)` | `{ id, nombre, apellido }` | `aCompraDelEventoVista`, `aEntradaDelEventoVista` |
| `vencimiento(compra)` | `venceEn`, `venceEnLocal` (solo en `PENDIENTE`) | `datosComunes`, `aCompraDelEventoVista` |
| `estadoDeLaCompra(compra)` | `estado`, `entradasUsadas`, `canceladaDesde`, `reembolso` | `datosComunes`, `aCompraDelEventoVista` |
| `canceladaPor(compra)` (ya existe) | `"sistema" \| "usuario" \| null` | `aMiCompraVista`, `aCompraDelEventoVista` |

`aEntradaDelEventoVista` toma `estado` y `entradasUsadas` con `pick` de `estadoDeLaCompra` (su
tipo de `shared/` no tiene `canceladaDesde` ni `reembolso`). `aCompraDelEventoVista(compra,
comprador, evento)` recibe el evento en lugar del tipo (firma interna; `compraService` ya lo
tiene en los dos lugares que la llaman). Un dato nuevo que ven comprador y organizador se suma en
`estadoDeLaCompra` (SC-006).

**Rationale**: la 009 sumó `canceladaDesde` y `reembolso` en tres vistas; con estas piezas es un
lugar. Los tipos de `shared/` no cambian (descartado en el backlog).

**Alternatives considered**: sub-estructuras nuevas en `shared/` (cambia contratos, descartado).

## R7. `resumenPorTipo` y la única definición de "entrada usada"

**Decision**: `resumen.usadas += compra.entradasUsadas`; `Compra.entradasUsadas =
entradas.filter((e) => e.usada).length`. `Entrada.usada` es la definición única (`uso !== null`);
la regla 8 garantiza que una compra no confirmada no tiene usos, así que coincide con "estado
UTILIZADA" de FR-008.

## R8. App: invalidaciones y piezas de "Registrar ingreso"

**Decision (invalidaciones)**: `useRegistrarUso.onSettled` invalida `comprasDelEvento(usuarioId,
eventoId)`, `entradaDelEvento(usuarioId, eventoId, codigo)` y, por prefijo, `["compra"]`,
`["mis-compras"]` y `["mis-compras-del-evento"]`; ya no `delEvento(eventoId)` ni `["catalogo"]`
(FR-018). En `registrar-ingreso.test.tsx` cambian solo esas aserciones: `["catalogo"]` sale del
`arrayContaining` y se agrega que ninguna invalidación usa `["catalogo"]` ni un `predicate`
(spec, Clarifications).

**Decision (piezas)**:

- `componentes/BuscadorDeCodigo.tsx`: `{ texto, alCambiar, alBuscar, refCampo }`; el
  `CampoDeTexto` "Código de la entrada" y "Buscar" (deshabilitado si el normalizado es vacío). El
  ref se pasa como prop con nombre (`refCampo`) para que la pantalla siga enfocando el campo tras
  registrar.
- `componentes/ResultadoDeIngreso.tsx`: `{ consulta, enCurso, alRegistrar }`; con un `if` por caso:
  código no encontrado (`ENTRADA_NO_ENCONTRADA`) → el texto con `accessibilityLiveRegion`; si no,
  `SegunConsulta` con `TarjetaEntrada` y la acción (`AccionDeIngreso`, interna del archivo: el
  motivo de `textoMotivoNoUsable` o "Registrar ingreso").
- La pantalla conserva el estado (texto, código buscado, aviso), la mutation y el `Alert`; dibuja
  `BuscadorDeCodigo`, el aviso (un `&&`) y `{codigo !== null && <ResultadoDeIngreso … />}`.

**Rationale**: FR-019. Los textos, roles, anuncios y foco no cambian, así que los tests de pantalla
pasan sin tocarse. Las piezas no se exportan por `index.ts` (solo las usa esta pantalla).

## R9. Constitución: aclaración PATCH

**Decision**: versión `2.5.1 → 2.5.2`. En "Entidades", la **Entrada** pasa a decir: "un **código**
propio […] (es su identificador), su **uso** y su **cancelación**, cada uno con quién y cuándo (o
ninguno)". En "Estado de una entrada", "con su propio cambio de estado (quién y cuándo)" pasa a
"registrando su uso (quién y cuándo)". Se agrega el informe de sincronización (Sync Impact Report)
al principio. Ninguna regla cambia.

**Rationale**: FR-024; se hace con `/speckit-constitution` en la fase de documentación.

## R10. Estrategia de tests sin perder casos

**Decision**:

- `tests/domain/entrada.test.ts` (nuevo): `usar`, `cancelar`, `usada`, `cancelada`, `usadaEn`,
  `estadoPropio`, inmutabilidad, `motivoNoUsable` por estado.
- `tests/domain/reglas-de-compra.test.ts` (nuevo): por cada regla, un caso que la cumple y uno que
  la viola, probando `regla.cumple` directamente (SC-003), más un caso de varias reglas fallidas a
  la vez y el de cantidad inválida (que no hace fallar "una por unidad").
- `tests/domain/compra.test.ts`: los casos existentes se conservan; cambia cómo se arman las
  entradas (`uso`/`cancelacion`) y cómo se leen (`compra.estadoDe(e)`, `e.usada`, `e.cancelada`,
  `compra.reembolso`). Se agrega un caso por valor de `reembolso` en cada estado.
- `tests/helpers/eventos.ts`: `entradasDePrueba(cantidad, historial)` y `compra(…)` conservan sus
  firmas; arman `uso`/`cancelacion` a partir del cambio `UTILIZADA` / `CANCELADA` del historial.
- `tests/services/entrada.service.test.ts`: los casos de `registrarUso` se conservan contra
  `EntradaService` (que delega) y se suman, en `compra.service.test.ts`, los de
  `CompraService.registrarUso` y `obtenerPorCodigoOFallar` con los mismos escenarios, incluido "un
  solo `guardar`" (espía sobre el repositorio).
- `tests/domain/datos-ejemplo.test.ts`: misma semilla con la forma nueva; la comparación final por
  la API la hace quickstart §1/§5.
- Verificación de "sin cambios": `git diff development -- backend/tests/api shared
  backend/src/docs mobile/tests/pantallas` solo muestra las aserciones de invalidación permitidas.

**Rationale**: FR-003, SC-001, SC-003.

## R11. Opcionales

**Decision (doble envío)**: `useEnvioUnico()` en `features/compras/` devuelve `enviarUnaVez(enviar:
(alTerminar: () => void) => void)`: si hay un envío en curso no hace nada; si no, marca y llama a
`enviar` con la función que desmarca (para el `onSettled` de la mutation). Lo usan `Cancelacion`
de `Compra.tsx` y `Contenido` de `ComprasDelEvento.tsx`. El `Pago` de `Compra.tsx` también, si usa
la misma marca (hoy hay dos `useRef` en `Compra.tsx`).

**Decision (días restantes)**: `diaDeCalendarioDeBuenosAires(instante): number` en
`hora-buenos-aires.ts` (milisegundos de la medianoche UTC de la fecha de pared de Buenos Aires,
con el mismo desfase); `diasRestantes` la usa y deja de partir `horaDeBuenosAires(...)`. Los tests
de `dias-restantes.test.ts` (incluidos los bordes de medianoche) no cambian lo que verifican.
