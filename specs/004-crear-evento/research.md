# Research: Crear evento (004)

Decisiones de diseño de la feature, en el formato de la 001 y la 003: **Decision**,
**Rationale** y **Alternatives considered**. Las de backend van primero (R1–R9) y después las
de mobile (R10–R18).

## R1. Atomicidad: cerrojo por evento (FR-029, SC-008)

- **Decision**: toda operación que lee, verifica y modifica un evento corre dentro de
  `cerrojo.ejecutar(eventoId, operación)`. Eso incluye editar los datos, agregar, editar y
  quitar tipos y eliminar el evento, y desde la 006 también crear compras, descontar o
  devolver cupo y cambiar estados. `CerrojoPorClave` es una cola de promesas por clave: la
  operación de un pedido empieza cuando termina la anterior **sobre la misma clave**, y las
  claves distintas no se esperan. Crear un evento no usa el cerrojo, porque su id es nuevo y
  nadie más puede tocarlo todavía.
- **Riesgos que cubre** (los repositorios devuelven `Promise` y cada `await` deja que otro
  pedido avance):
  1. **Verificar y modificar.** Ejemplos:
     - eliminar un evento mientras entra una compra (006): se verifica "sin compras", se
       registra la compra y se elimina un evento con compras;
     - dos tipos con el mismo nombre agregados a la vez;
     - quitar a la vez los dos tipos de un evento que tiene dos: ambos ven "quedan 2" y el
       evento queda sin tipos.
  2. **Actualización perdida del agregado.** Dos pedidos leen el mismo `Evento`, cada uno
     agrega o edita un tipo distinto, y el segundo `guardar` pisa al primero sin error.
- **Rationale**:
  - Cubre los dos riesgos con una sola regla fácil de revisar: "todo lo que modifica un
    evento, adentro de su cerrojo".
  - Ante dos pedidos simultáneos, el segundo se evalúa sobre el resultado del primero,
    exactamente lo que pide FR-029, sin errores espurios. Si el segundo falla, es por una
    regla real (nombre repetido, último tipo), no por la carrera.
  - Es una pieza chica, sin Express ni IO, testeable sola, y la 006 la reutiliza para el cupo.
- **Alternatives considered**:
  - **Interfaces de repositorio sincrónicas**, para que verificar y guardar quede en un tramo
    sin `await`: rompen R23 de la 001 (interfaces async, que permitirían cambiar la
    persistencia sin tocar services). Además no cubren "verificar en compras, modificar en
    eventos" sin acoplar repositorios.
  - **Operación combinada en un repositorio** (por ejemplo, `eliminarSiNoTieneCompras`):
    mezcla eventos y compras en una pieza y lleva reglas de negocio al repositorio.
  - **Versión optimista** (el evento lleva `version` y `guardar` falla si cambió): cumple la
    letra de la constitución y se parece a una base real. Pero ante concurrencia uno de los
    pedidos recibe 409 o el service tiene que reintentar. Se prioriza que no haya errores ni
    incongruencias.
  - **Un cerrojo global**: serializa también los eventos distintos, lo que viola FR-029.
- **Antecedente revisado**: el otro proyecto de la cátedra (`2026-2c-lu-sa-grupo-1`, `main`
  antes de Mongo) verificaba y guardaba con `await` en el medio, sin ninguna protección.
  Recién con Mongo lo resolvió con índices `unique` (error E11000 → 409). Anti-patrones de ese
  proyecto que este plan evita:
  - repositorios con estado `static`;
  - un service que llama a otro service;
  - `Object.assign` sobre la instancia guardada;
  - borrar sin verificar los dependientes.
- **Enmienda MINOR propuesta** (2.0.0 → 2.1.0), con `/speckit-constitution` **antes de
  implementar**:
  - Dominio, "Cupo atómico" → **"Operaciones atómicas por evento"**: *"Verificar una regla y
    modificar un evento, sus tipos de entrada o sus compras (por ejemplo, que hay cupo y
    descontarlo) DEBEN ocurrir en un mismo tramo síncrono o bajo el cerrojo de ese evento, de
    modo que ninguna otra operación sobre el mismo evento se intercale entre la verificación y
    la modificación. Dentro del cerrojo la operación vuelve a leer lo que verifica. Lo mismo
    vale para devolver cupo al cancelar y para todo cambio de estado de una compra. Las
    operaciones sobre eventos distintos no se esperan entre sí."*
  - Principio IV, viñeta de atomicidad: *"…cumplen la regla de operaciones atómicas por
    evento: verificar y modificar en un mismo tramo síncrono o bajo el cerrojo del evento."*
  - Es MINOR porque amplía la regla sin quitarle garantías: el tramo síncrono sigue siendo
    válido.

## R2. Uso del cerrojo

- **Decision**:
  - `interface Cerrojo { ejecutar<T>(clave: string, operacion: () => Promise<T>): Promise<T> }`
    y `class CerrojoPorClave implements Cerrojo`, en `services/cerrojo-por-clave.ts`. Guarda
    un `Map<string, Promise<void>>` privado con la cola de cada clave y borra la entrada
    cuando la cola queda vacía, para no acumular claves.
  - **Reglas de uso**, comentadas en la clase y en AGENTS.md:
    1. Dentro del cerrojo, la operación **vuelve a leer** el evento y no reutiliza lecturas
       anteriores. Después verifica existencia, permiso y reglas, y recién entonces guarda.
    2. El cerrojo se libera **siempre**, también si la operación lanza (`finally`); el error
       llega al que llamó.
    3. **Sin cerrojos anidados**: una operación bajo el cerrojo nunca pide otro. Con una sola
       clave por operación no hay interbloqueos.
    4. Las lecturas (`GET`) no usan el cerrojo: las entidades son inmutables y `guardar`
       reemplaza la referencia de una vez, así que una lectura ve el estado anterior completo
       o el nuevo completo.
  - Hay **una única instancia** compartida por `EventoService` y `TipoEntradaService` (y
    después por el service de compras de la 006). La crea `app.ts` y llega por constructor:
    nada de estado global ni `static`. Cada `crearApp()` (y cada test) tiene la suya.
- **Rationale**: dos instancias distintas no se excluirían entre sí. Inyectarla permite que
  los tests de concurrencia compartan el cerrojo con una operación simulada de la 006.
- **Alternatives considered**: un decorador o un *wrapper* del repositorio que tome el
  cerrojo (esconde dónde empieza y termina la sección crítica); una biblioteca de mutex
  (`async-mutex`: dependencia para 20 líneas).

## R3. Reloj del servidor (FR-010a)

- **Decision**:
  - `domain/reloj.ts` define `interface Reloj { ahora(): Date }`.
  - `config/reloj.ts` exporta `relojDelSistema` (`ahora: () => new Date()`).
  - `crearApp({ reloj = relojDelSistema })` lo pasa a los services, y los datos de ejemplo se
    arman con `reloj.ahora()`.
  - Las operaciones de dominio reciben `ahora` como argumento (no el reloj), así `domain/`
    sigue siendo puro.
  - El service lee `this.#reloj.ahora()` **dentro del cerrojo**, justo antes de verificar.
    Un evento que pasa a realizado mientras alguien lo edita se rechaza al guardar (edge case
    de la spec).
  - "Realizado" = `ahora ≥ fechaHora` (inclusive, desde el inicio). "Futura" = `fechaHora >
    ahora`. Son complementarias: un evento no realizado conserva una fecha futura, así que
    editar otro dato con la misma fecha siempre pasa.
- **Rationale**: los tests fijan el instante exacto, un milisegundo antes y en el borde. La
  zona de Buenos Aires solo importa para **interpretar** la hora de pared (R10); comparar
  instantes no depende de la zona.
- **Alternatives considered**: `vi.useFakeTimers` (frágil con promesas y supertest); un reloj
  dentro de `domain/` con estado (ensucia el dominio).

## R4. Fecha no futura: 409 `FECHA_NO_FUTURA`

- **Decision**: una fecha bien formada que no es futura se rechaza con **`409
  FECHA_NO_FUTURA`** ("La fecha y hora del evento deben ser futuras."). Lo lanza el dominio
  (`ReglaDeNegocioError`) en `Evento.crear` y en `evento.actualizar`. La app muestra ese
  código **junto al campo** fecha (contracts/app.md).
- **Rationale**:
  - El mismo cuerpo puede ser válido ahora y no serlo en un minuto. Depende del estado del
    mundo (el reloj), no de la forma del pedido, igual que `EVENTO_REALIZADO`.
  - La constitución separa la forma (`validations/`, 400) de las reglas de negocio (`domain/`
    y `services/`, 409).
  - zod no tiene reloj, y meterle uno mezclaría responsabilidades.
- **Alternatives considered**: `400 ENTRADA_INVALIDA` con detalle en `body.fechaHora` (el
  dominio tendría que conocer el nombre del campo en el cuerpo HTTP, o el service armar un
  error de `errors/` con una regla que es de dominio).

## R5. Orden de los chequeos y códigos de error

- **Decision**: cada operación sigue este orden, y el primero que falla responde:
  1. **401**: `requerirUsuario`.
  2. **400 de forma**: middleware de `validations/` (parámetros y cuerpo, todo junto).
  3. Dentro del cerrojo:
     1. **404 `EVENTO_NO_ENCONTRADO`**;
     2. **403 `SIN_PERMISO`** (no es el organizador);
     3. **404 `TIPO_ENTRADA_NO_ENCONTRADO`** (el tipo no está en **ese** evento, FR-023);
     4. **400 `ENTRADA_INVALIDA`** con detalle `body.categoriaId` ("No existe la categoría.");
     5. **409** con este orden:
        - `EVENTO_REALIZADO`;
        - después, según la operación: `FECHA_NO_FUTURA`, `NOMBRE_TIPO_ENTRADA_REPETIDO`,
          `ULTIMO_TIPO_ENTRADA`, `TIPO_ENTRADA_CON_COMPRAS` o `EVENTO_CON_COMPRAS`.
  - Crear un evento no tiene 404 ni 403: va de la categoría a la fecha futura y a los nombres
    repetidos.
  - Quitar un tipo verifica `ULTIMO_TIPO_ENTRADA` antes que `TIPO_ENTRADA_CON_COMPRAS`, porque
    no depende de otro repositorio.
- **Rationale**:
  - El 403 va antes que el 404 del tipo: a quien no organiza el evento no se le revela qué
    tipos tiene.
  - "Realizado" va antes que las demás reglas: es lo que explica por qué nada se puede tocar,
    y la app lo usa para pasar a solo lectura.
  - Los 404 y 403 los lanza el service con `errors/`, como `UsuarioService`. Los 409 los lanza
    `domain/` con `ReglaDeNegocioError` y el error handler los traduce.
- **Alternatives considered**: verificar la categoría en zod (necesita el repositorio en la
  validación); tratar el tipo de otro evento como 403 (FR-023 dice 404).

## R6. Repositorios: eventos ampliado y compras mínimo

- **Decision**:
  - `RepositorioEventos` suma tres métodos:
    - `listarPorOrganizador(organizadorId): Promise<Evento[]>`;
    - `guardar(evento): Promise<void>` (alta o reemplazo por id);
    - `eliminarPorId(id): Promise<void>`.
  - `RepositorioCompras` (nuevo) tiene:
    - `existePorEvento(eventoId): Promise<boolean>`;
    - `existePorTipoEntrada(tipoEntradaId): Promise<boolean>`;
    - `guardar(compra): Promise<void>`, para el seed y los tests (la 006 lo usa de verdad).
  - Los dos se construyen con sus entidades iniciales y guardan un `Map` privado por
    instancia.
  - `Repositorios` y `crearRepositoriosDeEjemplo()` suman `compras`.
  - Los services dependen de la **interfaz** `RepositorioCompras`, nunca de un service de
    compras (que no existe hasta la 006 y causaría un ciclo después).
- **Convención**: la tabla de AGENTS.md suma `listarPor<Criterio>(...)` → "las entidades que
  cumplen el criterio (arreglo, posiblemente vacío)", porque `buscarPor<Criterio>` devuelve
  una entidad o `null`.
- **Rationale**: `existePorTipoEntrada` recibe solo el id del tipo porque los ids de tipo son
  únicos en todo el sistema (UUID o `tipo-<evento>-<tipo>`). Toda compra cuenta, en cualquier
  estado (clarificación 1), así que no hace falta filtrar por estado.
- **Alternatives considered**: filtrar `listar()` en el service (expone todos los eventos para
  usar algunos); que el evento cuente sus compras (no las conoce: son otro agregado).

## R7. Agregado inmutable: las operaciones devuelven un `Evento` nuevo

- **Decision**:
  - `Evento` y `TipoEntrada` siguen con propiedades `readonly` y arreglos copiados.
  - Cada operación (`actualizar`, `agregarTipoEntrada`, `editarTipoEntrada`,
    `quitarTipoEntrada`) verifica sus reglas y **devuelve un `Evento` nuevo**, construido con
    el constructor. Así sus invariantes (nombre, fecha válida, ≥ 1 tipo, nombres únicos) se
    vuelven a verificar.
  - El service guarda el nuevo y nunca modifica en el lugar la instancia que está en el `Map`.
  - `Evento.crear(datos, ahora)` es la fábrica de alta: verifica que la fecha sea futura y
    construye.
- **Rationale**:
  - Si una regla falla a mitad de camino (por ejemplo, el nombre repetido se descubre al
    construir), lo guardado queda **intacto**, sin estados a medio modificar ni rollback.
  - Un lector que tiene la instancia vieja ve un estado completo y consistente (R2.4).
  - Se elimina el anti-patrón `Object.assign` sobre la instancia guardada.
  - Los tests pueden afirmar "el original no cambió".
  - Con un `Map` en memoria, el costo de copiar un evento con pocos tipos es despreciable.
- **Alternatives considered**: métodos que mutan (`this.tiposEntrada.push`): rompen
  `readonly`, y un fallo después de mutar deja lo guardado modificado; clonar antes de mutar
  (el mismo resultado con más pasos y sin invariantes al final).

## R8. `GET /api/eventos/:eventoId` y las vistas

- **Decision**:
  - `GET /api/eventos/:eventoId` es **público** y devuelve `EventoVista` con
    `organizadorId`. Lo usan editar, la vista de solo lectura (FR-006a) y, en la 005, el
    detalle público, que **amplía la misma vista** con campos nuevos (nombre y puntaje del
    organizador) sin cambiar los existentes.
  - `GET /api/eventos/mios` requiere usuario y devuelve `EventoResumenVista[]` (sin
    descripción, multimedia ni tipos, con `cantidadTiposEntrada`). Se declara antes de
    `/:eventoId`. `"mios"` tampoco es un id válido (no tiene guion), así que no hay
    ambigüedad.
  - Las dos vistas traen:
    - `categoria: { id, nombre }`;
    - `fechaHora` (instante ISO) y `fechaHoraLocal` (pared de Buenos Aires, R10);
    - `realizado`, calculado al consultar con el reloj del servidor (no se persiste).
  - `TipoEntradaVista` trae `{ id, nombre, descripcion, precio, cupo }`, con el cupo
    disponible.
- **Rationale**: los datos de un evento publicado no son privados (la 005 los muestra a
  cualquiera). Con una sola ruta y una sola vista no hay dos lecturas que mantener alineadas.
  La autorización vive en las escrituras (403), que es lo que protege FR-022.
- **Alternatives considered**: `GET /api/eventos/:id` solo para el organizador, y otro
  público en la 005 (dos endpoints con los mismos datos); `/api/eventos/mios/:id` (una ruta
  más sin beneficio).

## R9. Forma de las escrituras

- **Decision**:
  - `POST /api/eventos` recibe los datos del evento y `tiposEntrada` (1 o más). Responde
    `201` con la `EventoVista`.
  - `PUT /api/eventos/:eventoId` **reemplaza todos los datos** del evento (nombre,
    descripción, categoría, fecha, multimedia) y **no toca los tipos** (spec, Assumptions).
    Responde `200` con la `EventoVista`.
  - `DELETE /api/eventos/:eventoId` responde `204`.
  - `POST /api/eventos/:eventoId/tipos-entrada` responde `201` con la `TipoEntradaVista`.
  - `PUT` de un tipo reemplaza nombre, descripción, precio y cupo (≥ 0) y responde `200`.
    `DELETE` de un tipo responde `204`.
  - Las claves desconocidas del cuerpo **se descartan** (`z.object` por defecto). En
    particular, `organizadorId` se ignora: el organizador es siempre el usuario actual, y un
    test lo verifica (FR-009).
  - `descripcion` y `multimedia` son opcionales y valen `""` y `[]` por defecto. Los textos se
    recortan con `trim`.
  - Los ids nuevos los genera el service con `crypto.randomUUID()`.
- **Rationale**: un `PUT` completo es más simple de validar que un `PATCH` parcial, y la app
  siempre envía el formulario completo. Descartar las claves desconocidas sigue el
  comportamiento de la 001.
- **Alternatives considered**: `PATCH` parcial; `z.strictObject` (un 400 por una clave de más
  no le sirve al organizador); un `PUT` del evento que también reemplace los tipos (choca con
  las reglas de compras por tipo y con "de a uno" de FR-013).

## R10. Fecha y hora de pared en el contrato

- **Decision**:
  - **Entrada**: `fechaHora: "YYYY-MM-DDTHH:mm"`, la hora de pared de Buenos Aires **sin
    zona**. Un esquema compartido `fechaDeParedSchema` en `validations/comunes.ts` hace dos
    cosas:
    - valida el formato y que la fecha exista (rechaza `2026-02-30` y `24:00` con "Debe ser
      una fecha y hora válidas (AAAA-MM-DDTHH:mm).");
    - la transforma en instante con `instanteDesdeHoraDeBuenosAires` de
      `domain/hora-buenos-aires.ts`: `Date.UTC(a, m − 1, d, h + 3, min)`.
  - **Salida**: `fechaHora` (ISO UTC, `"2026-12-01T23:00:00.000Z"`) **y** `fechaHoraLocal`
    (`"2026-12-01T20:00"`), armada en el servidor con `horaDeBuenosAires(instante)` (UTC−3
    fijo y getters UTC).
  - La app muestra y precarga los formularios **solo** con `fechaHoraLocal`, y nunca convierte
    zonas.
  - El desfase −3 h vive en **un solo lugar**, que el seed también usa: se reemplaza su
    `DESFASE_UTC_HORAS`.
- **Rationale**:
  - El resultado no depende de la zona ni del reloj del teléfono (SC-006): la app envía lo que
    la persona eligió y recibe lo que tiene que mostrar.
  - Argentina no tiene horario de verano vigente (spec, Edge Cases), así que el desfase fijo
    es exacto y no deja horas ambiguas. Si eso cambiara, se toca una sola función.
  - **Hermes / Intl**: no se depende de `Intl.DateTimeFormat` con `timeZone` en el teléfono.
    El soporte de Hermes varía entre versiones y plataformas, y los tests corren en Node (ICU
    completo), así que un test en verde no garantizaría el mismo resultado en el teléfono.
    Con `fechaHoraLocal` la pregunta deja de importar.
- **Alternatives considered**:
  - ISO con zona (`"2026-12-01T20:00-03:00"`): la app tendría que conocer el desfase.
  - Instante UTC armado en la app: depende de la zona del teléfono.
  - Solo el instante en la salida y conversión con `Intl` en la app: el problema de Hermes de
    arriba.
  - `Intl` con `timeZone` en el servidor para la salida: funciona en Node, pero son dos
    mecanismos para el mismo desfase.

## R11. Selector de fecha y hora

- **Decision**:
  - `@react-native-community/datetimepicker` **9.2.1**, la versión que
    `expo/bundledNativeModules.json` fija para el SDK 58. Viene incluido en Expo Go, así que
    no hace falta un *development build*. Se instala con `npx expo install` desde `mobile/`.
  - El componente `SelectorFechaHora` de la feature `eventos` muestra la fecha y la hora
    elegidas (con `formato.ts`) y dos botones, "Elegir fecha" y "Elegir hora":
    - en Android abre `DateTimePickerAndroid.open({ mode: "date" | "time", is24Hour: true })`;
    - en iOS usa el componente en modo `date` y `time`.
  - **Sin `minimumDate`**: la regla de fecha futura es del servidor (FR-010a).
  - La conversión vive en `fecha-de-pared.ts`, con funciones puras:
    - `aFechaDelSelector("2026-12-01T20:00")` → `new Date(2026, 11, 1, 20, 0)`, en la hora
      local del teléfono;
    - `aFechaDePared(date)` → `"YYYY-MM-DDTHH:mm"` con `getFullYear`/`getMonth`/…/`getMinutes`.
  - Ida y vuelta usan la misma zona del teléfono, así que los componentes de pared se
    conservan en cualquier zona, aunque el teléfono no esté en Buenos Aires. El selector solo
    muestra los componentes.
  - Valor inicial en un evento nuevo: la fecha actual del teléfono, **solo como punto de
    partida** del selector, sin decidir nada con ella.
- **Rationale**: es el selector nativo que Expo documenta para el SDK y no suma UI pesada
  (principio VII). La persona no escribe la fecha (FR-010).
- **Riesgo conocido**: si el teléfono está en una zona **con** horario de verano, una hora que
  no existe ahí (el salto de primavera) puede correrse una hora en `new Date(a, m, d, h)`. Se
  documenta. Un test con `TZ` de una zona con horario de verano fija el comportamiento
  aceptado. En la práctica el público usa la hora argentina.
- **Alternatives considered**: `react-native-modal-datetime-picker` (otra dependencia sobre
  la misma); escribir la fecha a mano (prohibido por FR-010); un calendario propio (mucho
  código y accesibilidad por resolver).

## R12. Confirmar al descartar (FR-026a)

- **Decision**:
  - Hook `useConfirmarDescarte({ habilitado })` en la feature `eventos`. Usa
    `usePreventRemove` (lo exporta `expo-router`) y `Alert.alert("¿Descartar los cambios?",
    …, [Seguir editando (cancel), Descartar (destructive)])`.
  - "Descartar" despacha la acción retenida (`navigation.dispatch(data.action)`). "Seguir
    editando" no hace nada y lo cargado sigue en el formulario.
  - Cubre el botón atrás del header, el atrás de Android y el gesto de iOS, porque los tres
    remueven la pantalla del Stack.
  - **`habilitado`** es `true` salvo en tres casos:
    1. ya se guardó con éxito: un estado `salidaPermitida` se pone en `true` y la navegación
       ocurre en un `useEffect`, después de que el hook ya no retiene;
    2. la sesión ya no es la del formulario (`fase !== "con-usuario"` o un `usuarioId`
       distinto del que abrió el formulario): esa salida la provoca el cambio de usuario
       (spec, Edge Cases) y no pregunta;
    3. un 404 manda de vuelta a Mis eventos (R15).
  - Se usa en Crear evento, Editar evento y el formulario de tipo de entrada. Ver evento
    realizado no lo usa (FR-006a).
- **Cambio de usuario con un formulario abierto**: el formulario está apilado sobre las
  pestañas, así que para llegar a Perfil hay que salir de él (y eso pregunta). El caso real
  es un **401** que olvida al usuario: la fase pasa a `sin-usuario` y el guard saca las rutas.
  Con `habilitado` ligado a la sesión, el hook deja de retener en el mismo render.
  Además, las mutations envían el `usuarioId` **del formulario** (`OpcionesPedido.usuarioId`),
  así un envío nunca sale en nombre de otro usuario.
  **Riesgo**: que el guard remueva la ruta antes de que el hook se actualice. Lo cubre un test
  de pantalla. Si falla, el plan B es poner `key={usuarioId}` en el `Stack.Protected` de
  `con-usuario` para remontar la pila.
- **Rationale**: es la API documentada de React Navigation 7 / Expo Router para esto, y
  `Alert` es nativo y accesible.
- **Alternatives considered**: el evento `beforeRemove` a mano (lo mismo que hace
  `usePreventRemove`, con más código); un modal propio (se haría si `Alert` complicara los
  tests, pero se testea con `jest.spyOn(Alert, "alert")`); `gestureEnabled: false` sin
  confirmar (no cumple "el gesto pide confirmación").

## R13. Validación en la app

- **Decision**:
  - La app **no duplica** las reglas: el servidor las valida (FR-024) y la app muestra los
    `detalles` del 400 **junto a cada campo**. `errores-de-formulario.ts` traduce
    `body.nombre` → `nombre` y `body.tiposEntrada.1.precio` → tipo 1, precio.
  - Los 409 que corresponden a un campo también van junto a él:
    - `FECHA_NO_FUTURA` → fecha;
    - `NOMBRE_TIPO_ENTRADA_REPETIDO` → nombre del tipo.
  - El resto (403, 404 y los otros 409) se muestra en la pantalla. Siempre se conserva lo
    cargado (FR-026).
  - Lo único compartido son los **límites** (`LIMITES_EVENTO`, `LIMITES_TIPO_ENTRADA` en
    `shared/`): el servidor los usa en zod y la app los usa en `maxLength` y en el contador de
    URLs.
  - **Números**: el texto de precio y cupo se envía como número si es un entero sin signo
    (`/^\d+$/`). Si está vacío se envía `null`, y si no, el texto tal cual. El servidor
    responde "Es obligatorio." o "Debe ser un entero mayor o igual a 0." (≥ 1 en el cupo
    inicial). Teclado `number-pad`.
- **Rationale**: una sola fuente de verdad. Los mensajes son los mismos venga el pedido de la
  app o de Postman (AS9). Se ahorra una capa de validación con sus tests. El viaje extra al
  servidor no se nota en una red local.
- **Alternatives considered**: esquemas zod en `shared/` usados por los dos (agrega zod a
  mobile y a `shared`, y `shared` exporta TypeScript sin compilar, R2 de la 001); validación
  duplicada en funciones puras de la feature (dos implementaciones que pueden divergir).

## R14. Nombre de tipo único sin mayúsculas, tildes ni espacios

- **Decision**: la función de dominio `mismoNombreDeTipo(a, b)` compara
  `new Intl.Collator("es", { sensitivity: "base" }).compare(a.trim(), b.trim()) === 0`, igual
  que el comparador de usuarios de la 001. El constructor de `Evento` verifica que no haya dos
  tipos con el mismo nombre y lanza `ReglaDeNegocioError("NOMBRE_TIPO_ENTRADA_REPETIDO")`.
  Editar un tipo conservando su nombre (o cambiándole solo las mayúsculas) se acepta, porque
  se compara contra los **otros** tipos.
- **Rationale**: con `sensitivity: "base"`, "Platea", " PLATEA " y "Plátea" son iguales, pero
  en el locale `es` la **ñ** sigue siendo distinta de la n: "Año" ≠ "Ano". Quitar diacríticos
  con NFD las confundiría.
- **Alternatives considered**: NFD y quitar las marcas (confunde ñ con n); comparar en
  minúsculas (no ignora tildes).

## R15. Mutations, invalidación y navegación tras un error

- **Decision**:
  - Hay una mutation por escritura en `features/eventos/mutaciones.ts`, sin reintentos (el
    `QueryClient` ya trae `mutations.retry: false`). Al terminar, con éxito o error, invalida:
    - `claves.misEventos(usuarioId)` y `claves.evento(usuarioId, eventoId)`;
    - al crear o eliminar, también `claves.usuarios()`, porque cambia
      `cantidadEventosOrganizados`, que muestra el selector de usuario.
  - Mientras se envía, el botón queda en `enCurso` (doble envío, Edge Cases).
  - **404** (`EVENTO_NO_ENCONTRADO` o `TIPO_ENTRADA_NO_ENCONTRADO`): mensaje en la pantalla y
    vuelta a Mis eventos actualizado (US3-11), con `router.dismissTo("/mis-eventos")` sin
    pedir confirmación.
  - **409 `EVENTO_REALIZADO`**: se invalida `evento` y la ruta `/eventos/[eventoId]` vuelve a
    renderizar como solo lectura, porque ahora `realizado: true` (R16). Desde un formulario de
    tipo, se vuelve a esa ruta.
  - **Servidor no disponible**: lo maneja la franja global (003). El formulario conserva lo
    cargado y la persona decide si vuelve a intentar.
- **Rationale**: invalidar en lugar de escribir la caché a mano mantiene la única fuente de
  verdad en el servidor (orden de FR-004, `realizado`).
- **Alternatives considered**: `setQueryData` con la respuesta (duplica el orden del servidor
  en la app); refetch manual en `useFocusEffect` (FR-011 ya se cumple con la invalidación).

## R16. Rutas y pantallas de mobile

- **Decision**:
  - Rutas apiladas, declaradas una vez en el `Stack.Protected` de `con-usuario` de
    `LayoutRaiz`, con su `title`:
    - `eventos/nuevo` ("Crear evento");
    - `eventos/[eventoId]/index` ("Evento");
    - `eventos/[eventoId]/tipos-entrada/nuevo` ("Agregar tipo de entrada");
    - `eventos/[eventoId]/tipos-entrada/[tipoEntradaId]` ("Editar tipo de entrada").
  - `eventos/[eventoId]` muestra `EventoDelOrganizador`, que según el `realizado` del
    servidor renderiza `EditarEvento` o `VerEventoRealizado`. Así, un 409 `EVENTO_REALIZADO`
    pasa a solo lectura sin navegar.
  - Mis eventos reemplaza la `SeccionPendiente` de la pestaña.
  - Es la primera ruta dinámica, así que `tests/tipos/rutas-tipadas.ts` suma un caso con
    `@ts-expect-error`: el `pathname` `/eventos/[eventoId]` sin `params`.
  - El selector de categoría es una fila de opciones (`Pressable` con
    `accessibilityRole="radio"` y `accessibilityState.checked`) con `flexWrap`, para seis
    categorías en 360 px. No se usa una biblioteca de *picker*.
- **Rationale**: una ruta por recurso es lo que espera Expo Router. Decidir editar o ver con
  el dato del servidor cumple FR-010a.
- **Alternatives considered**: `eventos/[eventoId]/ver` aparte (habría que navegar ante el
  409 y elegir la ruta desde la lista); `@react-native-picker/picker` (otra dependencia
  nativa para una lista de seis).

## R17. Datos de ejemplo de compras (FR-021a)

- **Decision**: dos compras fijas sobre `evento-festival-sonidos-del-sur`, de Lucía y próximo
  (+30 días):
  - `compra-martin-festival-vip`: Martín, `tipo-festival-sonidos-del-sur-vip`, 2 entradas,
    total 240000, `CONFIRMADA`.
  - `compra-diego-festival-general`: Diego, `tipo-festival-sonidos-del-sur-general`, 1
    entrada, total 45000, `CANCELADA`.

  Con Lucía se demuestra todo:
  - el Festival no se puede eliminar (`EVENTO_CON_COMPRAS`);
  - VIP y General no se pueden quitar (`TIPO_ENTRADA_CON_COMPRAS`; la cancelada **también**
    cuenta, clarificación 1);
  - Backstage sí se puede quitar;
  - Noche de Rock y Maratón no tienen compras: se pueden eliminar.

  El cupo del seed sigue siendo el **disponible** (ya descontado).
- **Rationale**: dos estados distintos muestran que el estado no importa, y caen en un evento
  con tres tipos para que también haya uno que se puede quitar.
- **Alternatives considered**: una sola compra (no muestra que una cancelada también cuenta);
  compras sobre un evento realizado (no demuestran nada, porque "realizado" gana antes).

## R18. Formato en la app (`formato.ts`)

- **Decision**: funciones puras sin `Intl`:
  - `textoFechaHora("2026-12-01T20:00")` → `"mar 1 dic 2026 · 20:00"`. Los nombres de días y
    meses son arreglos propios, y el día de la semana sale de `new Date(Date.UTC(a, m − 1,
    d)).getUTCDay()`, que no depende de la zona.
  - `textoPrecio(0)` → `"Gratis"`; `textoPrecio(15000)` → `"$ 15.000"` (separador de miles
    con una expresión regular).
  - `textoCantidadTipos(1)` → `"1 tipo de entrada"`; `(3)` → `"3 tipos de entrada"`.
  - `textoCupo(0)` → `"Agotado"`; `(30)` → `"30 disponibles"`.
- **Rationale**: el mismo resultado en Node (tests) y en Hermes (teléfono); `Intl.NumberFormat`
  en `es-AR` puede usar espacios duros distintos según el motor.
- **Alternatives considered**: `Intl.NumberFormat` / `Intl.DateTimeFormat` (ver R10).
