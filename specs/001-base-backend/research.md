# Research: Base backend (001)

Decisiones técnicas que resuelven el **cómo** de la spec. El stack lo fija la constitución;
acá se eligen versiones, herramientas auxiliares y patrones. Versiones verificadas en el
registro de npm el 2026-11-03.

## R1. Versiones del stack

- **Decision**: Node ≥ 22.12 (se desarrolla con 24) · Express 5.3 · Mongoose 9 · zod 4 ·
  mongodb-memory-server 11 (binario MongoDB 8.2 por defecto) · Vitest 5 · supertest 7 ·
  TypeScript **6.0.x** · ESLint 10 + typescript-eslint 8 · tsx 4.
- **Rationale**: son las estables vigentes. TypeScript queda en `~6.0` porque
  typescript-eslint 8 declara `typescript >=4.8.4 <6.1.0`; TypeScript 7 rompería el lint.
  Vitest 5 exige Node `^22.12 || ^24 || >=26`, de ahí el piso de Node.
- **Alternatives considered**: TypeScript 7 (más rápido, pero incompatible con
  typescript-eslint hoy); Jest en backend (la constitución fija Vitest).

## R2. Monorepo y consumo de `shared/`

- **Decision**: npm workspaces `backend` y `shared` (se suma `mobile` en 002). `shared` es el
  paquete `@ai-ticket-it/shared`, **sin build**: su `package.json` exporta `./src/index.ts`
  directamente. Backend lo declara como dependencia `"@ai-ticket-it/shared": "*"`.
  Todos los paquetes son `"type": "module"`; `tsconfig.base.json` en la raíz con `strict`,
  `module: ESNext`, `moduleResolution: Bundler`, `noEmit`, `verbatimModuleSyntax`.
- **Rationale**: tsx, Vitest y Metro (Expo, en 002) entienden TypeScript de un workspace sin
  compilarlo; un paso de build en `shared` solo agregaría complejidad. `Bundler` evita las
  extensiones `.js` en los imports.
- **Alternatives considered**: project references con `tsc -b` y `dist/` en `shared`
  (más ceremonia, y la app móvil no lo necesita); `paths` en tsconfig (no lo resuelve Node).

## R3. Ejecución del servidor

- **Decision**: el servidor corre con **tsx** también en `start` (`tsx src/server.ts`) y con
  `tsx watch` en `dev`. No hay build a JavaScript. La verificación de tipos es `tsc --noEmit`
  por paquete.
- **Rationale**: es un TP que corre localmente; compilar a `dist/` no aporta nada a la demo
  y duplica configuración. tsx no chequea tipos, por eso `typecheck` es un comando aparte
  (principio IX).
- **Alternatives considered**: `tsc` + `node dist/` (build innecesario); `node
  --experimental-strip-types` (no soporta todas las construcciones de TS ni los imports sin
  extensión).

## R4. Configuración de entorno

- **Decision**: `config/env.ts` llama a `process.loadEnvFile(ruta)` si existe `backend/.env`
  (nativo de Node, sin `dotenv`) y valida `process.env` con zod. El esquema vive aparte, en
  `config/env-esquema.ts` (`parsearEnv`, puro y testeable sin efectos al importarse). Con
  `NODE_ENV=test` no se lee `backend/.env` y el nivel de log es siempre `silent`: los tests no
  dependen de la configuración local. La `ruta` se resuelve desde
  la ubicación del módulo (`path.resolve(import.meta.dirname, "../../.env")`), **nunca** desde
  `process.cwd()`: así funciona igual si el comando se lanza desde la raíz o desde `backend/`.
  Además, los scripts de la raíz delegan en el workspace (`npm run <x> -w backend`).
  Variables:
  `PORT` (default `3000`), `HOST` (default `0.0.0.0`), `MONGO_URI` (opcional),
  `LOG_LEVEL` (`info` | `silent`; siempre `silent` cuando `NODE_ENV=test`).
  Se versiona `backend/.env.example`.
- **Rationale**: cero dependencias nuevas y error claro al arrancar si una variable tiene un
  valor inválido. `HOST=0.0.0.0` cumple FR-010 (atiende pedidos de la red local).
- **Alternatives considered**: `dotenv` (dependencia evitable); `--env-file` de Node (falla
  si el archivo no existe).

## R5. Conexión a la base y arranque

- **Decision**: `config/db.ts` expone `conectarBase(mongoUri = env.MONGO_URI, { timeoutMs })`
  (parámetros inyectables para testear las fallas): si hay URI se conecta con
  `serverSelectionTimeoutMS: 5000` y devuelve `almacenamiento: "externo"`; si no, crea un
  `MongoMemoryServer` **standalone**, se conecta y devuelve `"memoria"`. `server.ts`
  orquesta: env → base → (seed si es memoria) → `listen` → imprime direcciones (`localhost`
  y cada IPv4 no interna de `os.networkInterfaces()`) y almacenamiento.
  Fallas de arranque → `ErrorArranque` con mensaje en español (armado por la función pura
  `mensajeFallaArranque` de `config/fallas-arranque.ts`) en `stderr` y `process.exit(1)`:
  - `EADDRINUSE` en `listen` → "El puerto N ya está en uso".
  - Timeout de selección de servidor → "No se pudo conectar a MONGO_URI".
  - Error al crear el servidor en memoria (sin red y sin binario en caché) → "No se pudo
    preparar MongoDB en memoria; la primera ejecución necesita internet para descargarlo".
  `SIGINT`/`SIGTERM` cierran el servidor HTTP, Mongoose y el `MongoMemoryServer`.
- **Rationale**: cumple FR-005, FR-006, FR-011 y los edge cases sin caer silenciosamente a
  memoria cuando hay `MONGO_URI`.
- **Alternatives considered**: `MongoMemoryReplSet` para tener transacciones. Se descarta:
  cada suite de tests levantaría un replica set (arranque más lento, riesgo para SC-004).
  En Mongo una actualización condicional es atómica **solo sobre un documento**, así que el
  invariante de cupo se protege con un contador en el propio evento (ver R15). Si una feature
  futura necesita transacciones de verdad, cambia solo `config/db.ts`.

## R6. Datos de ejemplo (seed)

- **Decision**:
  - `seed/datos-ejemplo.ts`: función **pura** `crearDatosEjemplo(ahora: Date)` que devuelve
    categorías, usuarios y eventos como objetos de dominio. Ids fijos de 24 hex con un
    prefijo por tipo (usuarios `…0001xx`, categorías `…0002xx`, eventos `…0003xx`, tipos de
    entrada `…0004xx`), detallados en [data-model.md](./data-model.md#datos-de-ejemplo).
  - Fechas de eventos = día de `ahora` en `America/Argentina/Buenos_Aires` + desplazamiento
    en días + hora fija local (por ejemplo, `+1 día 21:00`). El evento "próximo" se ubica en
    `ahora + 24 h` redondeado a la hora, para quedar siempre dentro de las 48 h.
  - `seed/cargar-seed.ts`: `cargarSeed()` hace `deleteMany({})` en las colecciones
    `categorias`, `usuarios` y `eventos` e inserta los datos (clarificación 1). Usa los
    modelos de `repositories/models/`.
  - `scripts/seed.ts` + `npm run seed`: conecta a `MONGO_URI` (si no hay, termina con error:
    sembrar una base en memoria que muere con el proceso no tiene sentido), corre
    `cargarSeed()` y se desconecta. **Protección**: sin el flag `--forzar`
    (`npm run seed -- --forzar`) no borra nada: imprime host y nombre de la base (sin
    credenciales), explica que vaciará `categorias`, `usuarios` y `eventos`, y termina con
    código 1. El parseo del flag (`planificarSeed`) y la orquestación con dependencias
    inyectadas (`ejecutarSeed`) viven en `scripts/seed-opciones.ts` y se testean sin base;
    `scripts/seed.ts` solo los cablea.
  - En una base real las fechas quedan fijas al día de la carga y envejecen; el README
    recomienda volver a correr el seed antes de una demo (edge case de la spec).
- **Rationale**: separar los datos (puros) de la carga permite testear los mínimos de FR-009
  en `tests/domain/` sin base, y la carga idempotente en `tests/api/`. Ids fijos (FR-008)
  hacen que la app y los tests puedan referirlos.
- **Alternatives considered**: upsert por id conservando datos ajenos (descartado en
  clarificación 1); JSON estático con fechas absolutas (envejece y deja de tener eventos
  futuros); confirmación interactiva por teclado (no sirve en scripts ni en tests, el flag sí).

## R7. Validación de entrada

- **Decision**: `crearValidacion({ params?, query?, body? })` (en `middlewares/validar.ts`)
  recibe esquemas zod y devuelve `{ middleware, leer }`:
  - `middleware` valida las partes presentes; si alguna falla, lanza `EntradaInvalidaError`
    con `detalles: [{ campo, mensaje }]` de todas las partes, donde `campo` es la ruta del
    valor (`params.id`, `body.precio`, `query.categoria`).
  - `leer(req, parte)` devuelve el valor **ya validado y transformado**, tipado como la salida
    del esquema (`z.output`). Los valores se guardan en un `WeakMap` propio de cada validación
    (no en `req`), así `leer` solo devuelve lo que produjeron esos esquemas, sin volver a
    validar. Leer sin haber pasado por el middleware es un error de programación → 500.
  - Esquemas reutilizables en `middlewares/esquemas-comunes.ts` (`idSchema`: 24 caracteres hex,
    `esIdValido`). Las validaciones de cada recurso viven junto a sus controllers
    (`controllers/usuario.schemas.ts`): las rutas montan `.middleware` y los controllers usan
    `.leer`, y las dependencias siguen hacia abajo (routes → controllers → middlewares).
- **Rationale**: FR-017 pide validación declarativa por endpoint y un detalle por campo. La
  primera versión guardaba lo parseado en `req.validado` y lo re-validaba al leerlo para
  recuperar el tipo: se rompía con esquemas que transforman (texto → `Date` responde 500 a un
  pedido válido). Además, los esquemas en `routes/` obligaban a controllers y middlewares a
  importar de la capa de rutas (revisión de la implementación).
- **Alternatives considered**: validar en el controller (viola el principio III); mutar
  `req.query` (no es posible en Express 5); `req.validado` + re-validación (descartada, ver
  rationale); `req.validado` + cast en cada controller (casts repartidos y sin garantía de que
  el esquema leído sea el que validó).

## R8. Identificación del usuario

- **Decision**: middleware por ruta `requerirUsuario`. Lee `X-Usuario-Id`; si falta, está
  vacío, no es un id válido o no existe el usuario → `UsuarioNoIdentificadoError` (401,
  `USUARIO_NO_IDENTIFICADO`). Si existe, deja el `Usuario` de dominio en `req.usuario`. Las
  rutas públicas no lo usan, así que ignoran el encabezado (edge case de la spec).
  Lo resuelve llamando a `usuarioService.buscarPorId`.
- **Rationale**: solo consulta la base donde hace falta. Un middleware global que intentara
  resolver el encabezado en todas las rutas consultaría la base en pedidos públicos.
- **Alternatives considered**: middleware global "opcional" + guardia (dos piezas para el
  mismo efecto, por ahora innecesario).

## R9. Errores y error handler

- **Decision**: `errors/` define `ErrorAplicacion` (`status`, `codigo`, `mensaje`,
  `detalles?`) y subclases:
  | Clase | HTTP | `codigo` por defecto |
  |---|---|---|
  | `EntradaInvalidaError` | 400 | `ENTRADA_INVALIDA` |
  | `UsuarioNoIdentificadoError` | 401 | `USUARIO_NO_IDENTIFICADO` |
  | `SinPermisoError` | 403 | `SIN_PERMISO` |
  | `NoEncontradoError` | 404 | el que pase el service (ej.: `USUARIO_NO_ENCONTRADO`) |
  | `ConflictoError` | 409 | el que pase el service (ej.: `CUPO_INSUFICIENTE`) |

  El error handler (último middleware) traduce:
  - `ErrorAplicacion` → su status y cuerpo.
  - Error de `express.json()` con `type === "entity.parse.failed"` → 400 `JSON_INVALIDO`.
  - `type === "entity.too.large"` → 413 `CUERPO_DEMASIADO_GRANDE` (clarificación 2).
  - Errores de Mongo/Mongoose, traducidos por `traducirErrorPersistencia`
    (`repositories/errores-persistencia.ts`, la única capa que conoce Mongoose):
    `ValidationError` → 400 `ENTRADA_INVALIDA` con un detalle por campo (ruta completa, ej.
    `tiposEntrada.0.precio`; mensajes en español), `CastError` → 400 `ENTRADA_INVALIDA`, clave
    única duplicada (`11000`) → 409 `RECURSO_DUPLICADO`, sin filtrar el detalle de Mongo. Es una
    red de seguridad: zod filtra antes y cada feature puede lanzar errores más específicos.
  - Cualquier otro → 500 `ERROR_INTERNO`, "Ocurrió un error inesperado", y el error completo
    (con stack) al log.
  El 404 de rutas inexistentes es un middleware previo que lanza `RUTA_NO_ENCONTRADA`.
  Express 5 lleva al error handler tanto los `throw` síncronos como las promesas rechazadas
  de handlers `async` (esto último es lo nuevo respecto de Express 4), así que los
  controllers no usan `try/catch` (principio III).
- **Rationale**: un único punto traduce errores a HTTP; las clases de 403 y 409 se dejan
  definidas porque la constitución las fija y las usan las features siguientes. Cada una es
  una clase de pocas líneas.
- **Alternatives considered**: un único `ErrorAplicacion` con status libre (menos
  expresivo en los services, más fácil equivocarse de código).

## R10. Límite de tamaño del cuerpo

- **Decision**: `express.json({ limit: "100kb" })`.
- **Rationale**: es el default de Express y sobra para cualquier pedido del dominio (el más
  grande será crear un evento con sus tipos de entrada y URLs de multimedia).
- **Alternatives considered**: 1 MB (no hay subida de archivos; multimedia son URLs).

## R11. Registro de pedidos (logging)

- **Decision**: `config/logger.ts` con `info`, `error` y nivel `silent`; escribe con
  `console`. El middleware `registrarPedido` mide con `process.hrtime.bigint()` y al evento
  `finish` registra `GET /api/usuarios 200 3.2ms`. En `NODE_ENV=test` (lo fija Vitest) el
  nivel es `silent`, así que ni el registro ni los errores 500 ensucian la salida de tests
  (FR-021); un test puede espiar el logger para verificar que se registró.
- **Rationale**: FR-021 pide cuatro datos por línea; un logger estructurado (pino) o morgan
  serían dependencias para algo de 20 líneas (principio IX, YAGNI).
- **Alternatives considered**: morgan (no comparte nivel con los errores); pino (JSON poco
  legible en la consola de la demo).

## R12. Vistas, ids y orden del listado de usuarios

- **Decision**:
  - Los repositories usan `.lean()` y una función `aDominio()` por entidad que convierte
    `_id`/`ObjectId` en `id: string` y descarta `__v`; nunca devuelven documentos.
  - El service arma la `UsuarioVista` (`id`, `nombre`, `apellido`,
    `cantidadEventosOrganizados`) con una función explícita, nunca `{ ...usuario }`.
  - `cantidadEventosOrganizados`: el repository de eventos expone
    `contarPorOrganizador(ids)` (una agregación `$group` por organizador) para que listar no
    sea N+1. Cuenta todos los eventos, pasados y futuros (clarificación 4).
  - **`aggregate()` no castea**: a diferencia de `find`, `findById` o `insertMany`, Mongoose no
    aplica el esquema a los pipelines, así que los ids string se convierten a
    `Types.ObjectId` antes del `$match` (si no, no matchean y todo cuenta 0). Aplica a toda
    agregación de las features siguientes.
  - Orden (clarificación 3): función pura `compararPorApellidoYNombre` en
    `domain/usuario.ts`, con `Intl.Collator("es", { sensitivity: "base" })`, para que
    "Álvarez" quede antes que "Benítez" y el orden no dependa de la collation de Mongo.
- **Rationale**: FR-022 y el principio VI; la regla de orden queda testeada sin base.
- **Alternatives considered**: `sort` + `collation: { locale: "es" }` en Mongo (funciona,
  pero la regla no queda en `domain/` ni se testea sin base).

## R13. Tests

- **Decision**: `backend/vitest.config.ts` con `environment: "node"`, `hookTimeout: 60000`
  (primera descarga del binario) y `testTimeout` corto. Cada archivo de `tests/api/` usa el
  helper `tests/api/helpers/base-de-prueba.ts`: `beforeAll` crea su propio `MongoMemoryServer`
  y conecta; `beforeEach` corre `cargarSeed()`; `afterAll` desconecta y detiene. Vitest corre
  cada archivo en un worker aparte, así que cada suite tiene su base (principio II, US3-3).
  Las pruebas de API usan `supertest(crearApp())` sin `listen`. El caso 500 se provoca con
  `vi.spyOn(usuarioService, "listar").mockRejectedValue(...)`, por eso los services se
  exportan como objetos.
  US3-2 se cubre con `tests/domain/tipos-compartidos.test.ts`: importa `EstadoCompra` de
  `@ai-ticket-it/shared` y fija sus valores con `expectTypeOf` y una aserción. El `tsconfig`
  del backend incluye `tests/`, así que un cambio incompatible en `shared` rompe
  `npm run typecheck` del backend, no solo el test. Además, el error handler y el
  controller tipan sus respuestas con `ErrorApi` y `UsuarioVista` de `shared`.
- **Rationale**: aislamiento por suite sin servidor corriendo; sembrar en `beforeEach`
  evita que un test dependa de lo que hizo otro.
- **Alternatives considered**: una sola base global con `globalSetup` (comparte estado entre
  suites, viola el principio IV).

## R14. Lint y verificación de tipos

- **Decision**: `eslint.config.js` (flat config) en la raíz con `@eslint/js` recommended,
  `typescript-eslint` recommended y estas reglas:
  `@typescript-eslint/no-explicit-any: error`,
  `@typescript-eslint/ban-ts-comment` con `ts-ignore` y `ts-expect-error` permitidos solo con
  descripción, y `@eslint-community/eslint-comments/require-description` (todo
  `eslint-disable` lleva justificación). Además `no-restricted-imports` en
  `backend/src/domain/**` que prohíbe `express`, `mongoose`, `mongodb` y módulos de Node con IO.
  Scripts raíz: `test`, `lint` (`eslint .`) y `typecheck`
  (`npm run typecheck --workspaces --if-present`); cada paquete tiene `typecheck: tsc --noEmit`.
- **Rationale**: automatiza el principio IX y la pureza de `domain/` (principio III) en vez de
  confiar en la revisión.
- **Alternatives considered**: reglas con información de tipos (`recommendedTypeChecked`):
  más lentas y no aportan a estos requisitos.

## R15. Cupo atómico y precios enteros

- **Decision**:
  - `TipoEntrada.cupo` es un **contador decreciente de entradas disponibles** (entero,
    `min: 0`). Se carga con la cantidad inicial (ej.: 300) y no hay un campo aparte de
    vendidas (constitución v1.1.0).
  - Comprar (005) descuenta con **una sola actualización condicional sobre el documento del
    evento**: `updateOne({ _id: eventoId, tiposEntrada: { $elemMatch: { _id: tipoId, cupo:
    { $gte: cantidad } } } }, { $inc: { "tiposEntrada.$.cupo": -cantidad } })`. Si no
    modifica nada → `409 CUPO_INSUFICIENTE`. Como la condición `cupo ≥ cantidad` y el
    descuento ocurren en la misma operación atómica, el cupo nunca queda por debajo de 0, ni
    con compras concurrentes. Después inserta la compra; si el insert falla, compensa con
    `$inc: +cantidad`.
  - Cancelar (008) devuelve las entradas con `$inc: +cantidad` junto con el cambio de estado
    (compensando si falla).
  - En esta feature el seed carga el cupo inicial de cada tipo y no hay endpoints que lo
    modifiquen.
  - `precio` es un **entero de pesos** (`min: 0`, validado como entero). `total = precio ×
    cantidad` es exacto, sin errores de punto flotante.
- **Rationale**: el principio IV exige que descontar cupo sea atómico. Contar las compras de
  otra colección no lo es sin transacciones (dos compras simultáneas leen el mismo
  disponible). Un único contador en el mismo documento lo hace atómico sobre una instancia
  standalone, y con `cupo` decreciente alcanza un solo campo: "quedan disponibles" (UC-02) se
  lee directo. La capacidad original, si alguna feature la necesitara, se deriva como
  `cupo + Σ cantidades de compras activas`.
- **Alternatives considered**: contador `vendidas` con `cupo` fijo (redundante: es la misma
  información con dos campos; descartado en la revisión del plan); transacciones con replica
  set (ver R5); calcular disponibles sumando compras en cada lectura (no atómico); precios en centavos (las entradas en pesos no
  usan centavos; si alguna vez hicieran falta, se migra a centavos enteros con el mismo
  criterio).

## R16. Inyección de dependencias y composition root

- **Decision**: controllers, services y repositories son **clases** que reciben sus
  colaboradores por constructor: `new UsuarioService({ usuarios, eventos })`,
  `new UsuarioController(usuarioService)`, `crearRequerirUsuario(usuarioService)`. Los services
  dependen de interfaces (`domain/repositorios.ts`), que implementan las clases de
  `repositories/` y, en los tests, objetos falsos. `app.ts` es el **composition root**:
  `crearApp({ almacenamiento, repositorios? })` instancia todo y las rutas son fábricas que
  reciben sus controllers. Los métodos de controller son propiedades flecha para pasarlos a
  las rutas sin perder `this`.
- **Rationale**: tomado de `ddso-utn/ejercicio-megasuper-2026` (clase6: `buildTestApp` con
  repositorio simulado; rama ODM: `app.js` que conecta repository → service → controller).
  Antes, los módulos exportaban objetos globales y los tests los reemplazaban con
  `vi.spyOn`: las dependencias quedaban ocultas y no se podía probar un service sin Mongo.
  Ahora `tests/services/` prueba casos de uso con repositorios falsos, y los tests de API
  inyectan un repositorio que falla para el 500 o el 409.
- **Alternatives considered**: la clase `Server` con `setController/getController` de la rama
  ODM (más indirección de la que el TP necesita); un contenedor de DI (dependencia extra).

## R17. Dominio con comportamiento

- **Decision**: `Usuario`, `Categoria`, `Evento` y `TipoEntrada` son clases con propiedades
  `readonly` que validan sus invariantes en el constructor (`domain/invariantes.ts` junta las
  violaciones y lanza `EntradaInvalidaError` con un detalle por campo) y exponen las
  operaciones del diagrama de la consigna: `TipoEntrada.hayCupoPara(cantidad)` (entero
  positivo ≤ cupo) y `Evento.tuPrecioEstaEntre(min, max)` (algún tipo con precio en el rango,
  inclusive). Los repositories mapean cada documento a una instancia (`new Usuario(...)`) y el
  seed construye instancias, así las invariantes validan también los datos de ejemplo.
- **Rationale**: megasuper modela `Producto` con validaciones y `precioFinal()`, y la consigna
  es un diagrama de clases con métodos: el comportamiento vive con los datos. `domain/` puede
  usar `errors/` (sin IO), como el `Producto` de megasuper usa `UnprocessableEntityError`.
- **Alternatives considered**: `schema.loadClass(Clase)` de la rama ODM (los repositories
  devolverían documentos de Mongoose y la persistencia se filtraría a los services: viola el
  principio III); interfaces + funciones sueltas (la versión anterior: dominio anémico).

## R18. Registro y respuesta de errores separados; `validations/`

- **Decision**: la cadena final es `rutaNoEncontrada → registrarError → manejarErrores`.
  Ambos middlewares de error clasifican con `aErrorAplicacion(error)`
  (`middlewares/traducir-error.ts`: errores propios, del parser JSON —ahora
  `JsonInvalidoError` y `CuerpoDemasiadoGrandeError`— y de Mongo). `registrarError` registra
  completos solo los inesperados; `manejarErrores` solo responde. Los esquemas zod y
  `crearValidacion` viven en `validations/` (como `errors/`); las rutas montan
  `usuarioPorId.middleware` y los controllers leen con `usuarioPorId.leer`.
- **Rationale**: megasuper encadena `errorLogger` y `errorHandler` (una responsabilidad cada
  uno) y separa `validations/` del resto. Se mantiene nuestro formato `ErrorApi` (código y
  detalles, fijado por la constitución) en lugar de `{ status, message, timestamp }`.
- **Alternatives considered**: registrar también los 4xx en el logger de errores (ya aparecen
  en el registro de pedidos con su status); `validate(schema)` que reemplaza `req.body` (en
  Express 5 `req.query` es de solo lectura: no alcanza para params y query).

## R19. Documentación OpenAPI y colección de Postman

- **Decision**: `src/docs/openapi.json` (OpenAPI 3.0) servida con `swagger-ui-express` en
  `/api/docs` y cruda en `/api/docs/openapi.json` (se importa en Postman). Además,
  `src/docs/ai-ticket-it.postman_collection.json` con pedidos de ejemplo y de error, y las
  variables `baseUrl` y `usuarioId`. `tests/api/docs.test.ts` verifica que cada ruta de la
  especificación y de la colección exista en el servidor.
- **Rationale**: megasuper sirve Swagger en `/api-docs` y versiona su colección de Postman;
  sirve para la demo del video y para desarrollar la app (002) contra la API. Se monta bajo
  `/api` para respetar el principio V. El test evita que la documentación quede vieja.
- **Alternatives considered**: generar la especificación desde los esquemas zod
  (dependencia extra, poco valor con 4 endpoints); YAML (requiere un parser más).

## R20. Errores de dominio sin HTTP

- **Decision**: `domain/errores.ts` define `ErrorDeDominio` y dos subclases sin status:
  `DatosInvalidosError(detalles)` (invariantes de una entidad) y
  `ReglaDeNegocioError(codigo, mensaje)` (una regla impide la operación). `Invariantes` lanza
  `DatosInvalidosError`. `aErrorAplicacion` los traduce: `DatosInvalidosError` →
  `400 ENTRADA_INVALIDA` con los detalles; `ReglaDeNegocioError` → `409` con su código. Un
  patrón de `no-restricted-imports` impide que `domain/` importe `errors/`. Reemplaza la
  excepción de la v1.2.0 ("domain/ puede usar errors/").
- **Rationale**: tomado de `ddso-utn/2026-2c-lu-sa-grupo-1` (`domain/errors/DomainErrors.js`
  con `DomainValidationError`/`DomainRuleError`, separados de `errors/ApplicationErrors.js`, y
  el error handler que decide el status). Las features que vienen (cupo, transiciones de
  estado, cancelación) son reglas de dominio: el dominio dice *qué* pasó y la capa HTTP decide
  *cómo* se responde.
- **Alternatives considered**: el 422 de ese repo para `DomainValidationError` (la
  constitución fija 400/409 y la app ya maneja `ENTRADA_INVALIDA`); seguir usando
  `ErrorAplicacion` en el dominio (lo ata a HTTP).

## R21. Repositorios en memoria reutilizables, test de contrato y nombres uniformes

- **Decision**: `tests/fakes/` tiene `RepositorioUsuariosEnMemoria` y
  `RepositorioEventosEnMemoria`, que implementan las interfaces de `domain/repositorios.ts` con
  estado **por instancia** (se construyen con las entidades del caso). Los tests de services
  los usan en lugar de objetos `vi.fn` armados en cada test.
  `tests/api/repositorios.contrato.test.ts` corre los mismos casos contra los repositorios de
  Mongo (con el seed) y contra los falsos (con `crearDatosEjemplo`). Convención de nombres en
  AGENTS.md: repositories `listar`/`buscarPorId`/`guardar`/`eliminarPorId`/`contarPor…`;
  services `listar`/`obtener`/`crear`/`actualizar`/`eliminar` y un único `#obtenerOFallar`
  (`obtenerVista` pasó a `obtener`).
- **Rationale**: ese repo tiene `tests/fakes/` para todos sus repositorios y unificó nombres
  ("mismos nombres de métodos en todos los repositorios", "buscar por id o tirar 404 en un
  solo lugar por servicio"). Sus fakes usan estado `static` compartido entre tests (obliga a
  `deleteAll()`); acá es por instancia. El test de contrato (que ese repo no tiene) evita que
  un falso se desvíe del comportamiento real sin que nadie lo note.
- **Alternatives considered**: mocks `vi.fn` por test (se repiten al crecer las entidades);
  solo tests contra Mongo (más lentos y sin aislar el caso de uso).

## R22. Prettier y CI

- **Decision**: Prettier 3 con `printWidth: 110` (el ancho del código existente: era el que
  menos cambios producía), comillas dobles y comas finales; `.prettierignore` excluye `*.md`
  (specs y constitución tienen saltos de línea a mano), `.specify/` y `.claude/`. Scripts
  `format` y `format:check`. `.github/workflows/ci.yml` corre `format:check`, `lint`,
  `typecheck` y `test` en Node 22 (el mínimo de `engines`) en cada PR y push a `development`
  y `main`, con caché de `node_modules/.cache/mongodb-memory-server`.
- **Rationale**: ese repo usa Prettier con `format:check` y GitHub Actions. En nuestro flujo
  (`feature/* → development` por PR) el CI es la verificación automática de que los cuatro
  comandos del principio IX están en verde antes de integrar.
- **Alternatives considered**: reglas de estilo de ESLint (deprecadas en favor de un
  formateador); deploy automático como el de ese repo (la consigna pide ejecución local).
