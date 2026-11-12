# AI Ticket It — Constitution

## Dominio del Sistema

### Objetivo

AI Ticket It es una plataforma móvil de **publicación de eventos y venta de entradas**:
los organizadores publican eventos con distintos tipos de entrada y administran sus ventas;
los compradores exploran el catálogo, compran entradas, siguen el estado de sus compras,
conversan con el organizador y, después del evento, lo califican. La referencia de producto
es `docs/consigna/consigna.md` (casos de uso UC-01 a UC-12).

### Roles

- **Comprador**: explora y busca eventos, compra entradas, ve sus compras, chatea sobre una
  compra, la cancela y reseña eventos a los que asistió.
- **Organizador**: crea eventos y sus tipos de entrada, ve las compras de sus eventos,
  responde mensajes y registra el uso de entradas.

Ambos roles son un mismo **Usuario** (como en el diagrama de la consigna): una persona puede
comprar entradas y también organizar eventos. El rol se determina por la relación con el
recurso (comprador de la compra u organizador del evento), no por un atributo del usuario.

### Entidades

- **Usuario**: nombre, apellido, eventos favoritos.
- **Categoria**: catálogo precargado (nombre, descripción).
- **Evento**: nombre, descripción, categoría, fecha y hora, multimedia (URLs), organizador y
  uno o más **TipoEntrada** embebidos.
- **TipoEntrada**: nombre, descripción, precio y cupo. Pertenece a un único evento.
- **Compra**: comprador, evento, tipo de entrada, cantidad, total, estado, historial de
  **CambioEstadoCompra** (estado, quién, fecha y hora) y **Mensajes** (usuario, texto, enviado).
- **Resenia**: comprador, evento, puntuación y detalle.

### Reglas de Dominio (invariantes)

- **Cupo**: el cupo de un tipo de entrada es la cantidad de entradas **disponibles**. Se
  establece al crear el tipo (por ejemplo, 300) y disminuye en la cantidad de cada compra que
  se registra. Una compra NO PUEDE dejar el cupo por debajo de 0, ni siquiera ante compras
  concurrentes.
- **Operaciones atómicas por evento**: verificar una regla y modificar un evento, sus tipos de
  entrada o sus compras (por ejemplo, que hay cupo y descontarlo) DEBEN ocurrir en un mismo
  tramo síncrono de código o **bajo el cerrojo de ese evento**, de modo que ninguna otra
  operación sobre el mismo evento se intercale entre la verificación y la modificación.
  Dentro del cerrojo, la operación DEBE volver a leer lo que verifica; el cerrojo se libera
  siempre, también ante un error, y no se anidan cerrojos. Lo mismo vale para devolver cupo
  al cancelar y para todo cambio de estado de una compra. Las operaciones sobre eventos
  distintos no se esperan entre sí.
- **Total**: lo calcula el servidor como `precio × cantidad` al momento de comprar. El cliente
  nunca envía precios ni totales.
- **Estados de una compra** — solo estas transiciones son válidas:
  - `PENDIENTE → CONFIRMADA` (pago simulado)
  - `PENDIENTE → CANCELADA`
  - `CONFIRMADA → UTILIZADA` (el organizador registra el ingreso)
  - `CONFIRMADA → CANCELADA → REEMBOLSADA`
  Todo cambio de estado DEBE registrar un `CambioEstadoCompra` con quién y cuándo.
- **Cancelación**: una compra `CONFIRMADA` NO PUEDE cancelarse una vez que el evento empezó
  (desde su fecha y hora de inicio, inclusive, según el reloj del servidor), y una `UTILIZADA`
  no se cancela nunca. Una compra `PENDIENTE` SÍ PUEDE pasar a `CANCELADA` con el evento ya
  empezado (por ejemplo, al vencer sin pagarse). Las entradas de una compra cancelada vuelven
  al cupo disponible.
- **Reseñas**: solo puede reseñar un evento quien tenga una compra `UTILIZADA` de ese evento,
  una única vez por evento. La puntuación es un entero de 1 a 5.
- **Puntaje del organizador**: promedio de las puntuaciones de las reseñas de sus eventos.
  Sin reseñas, el organizador no tiene puntaje (no es 0).
- **Chat**: en una compra solo escriben y leen su comprador y el organizador del evento, en
  cualquier estado de la compra.
- **Días restantes**: se calculan al consultar (no se persisten), en la zona horaria
  `America/Argentina/Buenos_Aires`.

Una spec PUEDE refinar estas reglas (por ejemplo, condiciones del reembolso) siempre que no
las contradiga; contradecirlas requiere enmendar esta constitución.

## Core Principles

### I. Spec-Driven Development

Toda funcionalidad nace de una spec y se implementa siguiendo Spec Kit:
`specify → clarify → plan → tasks → implement`, con revisión humana entre etapas.

- La spec (`specs/NNN-slug/spec.md`) describe el **qué** y el **por qué** en términos de
  producto, trazando los casos de uso de la consigna (UC-xx). El plan describe el **cómo**.
- Ningún código de producto se escribe sin una tarea en `specs/NNN-slug/tasks.md`.
- Si durante la implementación aparece algo no especificado, se actualiza la spec (o se
  registra en su sección de clarificaciones) antes de seguir.
- `docs/backlog.md` es la fuente de verdad del orden y las dependencias entre features.

**Rationale**: el TP evalúa el criterio y la trazabilidad de las decisiones; la spec es el
registro de ese criterio y el contexto que guía a la IA.

### II. Test-First (NON-NEGOTIABLE)

- Backend: TDD estricto — el test se escribe primero, se lo ve fallar, se implementa y se
  refactoriza.
  - `backend/tests/domain/` — entidades y reglas puras.
  - `backend/tests/services/` — casos de uso con los repositorios en memoria de producción,
    construidos con los datos del caso; sin servidor.
  - `backend/tests/repositories/` — los repositorios en memoria.
  - `backend/tests/api/` — endpoints con supertest contra la app de Express (sin levantar
    puerto), con repositorios nuevos por test: ningún test comparte estado con otro.
- Mobile: tests de la lógica de presentación (formateos, mapeo de estados, días restantes) y
  de los componentes con comportamiento.
- Toda regla de dominio de la constitución DEBE tener al menos un test que la verifique,
  incluyendo su caso borde.
- Ningún cambio de comportamiento se integra sin su test.

**Rationale**: las reglas de cupo, estados y cancelación son el corazón del negocio; un error
ahí vende entradas que no existen o reembolsa lo que no corresponde.

### III. Arquitectura en Capas

El backend respeta estas capas; las dependencias van siempre hacia abajo:

```
backend/src/
  routes/        ← declara endpoints y encadena middlewares + controller
  controllers/   ← HTTP: toma la request ya validada, llama al service, arma la response
  services/      ← casos de uso: orquesta repositories, domain y otros services, verifica permisos
  repositories/  ← único acceso a los datos (en memoria); guarda y devuelve entidades, da ids nuevos
  domain/        ← entidades con comportamiento y reglas de negocio puras
  middlewares/   ← identificación de usuario, logging, 404, registro y respuesta de errores
  validations/   ← esquemas de entrada (zod) y su middleware de validación
  errors/        ← errores de aplicación tipados, sin status (lo asigna el error handler)
  config/        ← entorno, arranque y logging
  docs/          ← especificación OpenAPI de la API
  app.ts         ← composition root: instancia y conecta repositories → services → controllers
```

- `domain/` NO DEBE importar Express, `errors/` ni nada con IO. Lanza **errores de
  dominio** semánticos, sin conocimiento de HTTP (`domain/errores.ts`): `DatosInvalidosError`
  (una entidad no cumple sus invariantes; un detalle por campo) y `ReglaDeNegocioError` (una
  regla del dominio impide la operación, con su código; por ejemplo `CUPO_INSUFICIENTE`). La
  traducción a HTTP es responsabilidad del error handler: `400 ENTRADA_INVALIDA` y `409` con
  el código de la regla, respectivamente.
- Las entidades de `domain/` son **clases con comportamiento** que protegen sus invariantes al
  construirse y exponen las operaciones del modelo de la consigna (por ejemplo,
  `TipoEntrada.hayCupoPara(cantidad)`, `Evento.tuPrecioEstaEntre(min, max)`).
- **Inyección de dependencias**: controllers, services y repositories son clases que reciben
  sus colaboradores por constructor. Los services dependen de interfaces de repositorio
  (`domain/repositorios.ts`), no de una implementación. Solo el composition root instancia y
  conecta las piezas; ningún módulo usa instancias globales de otra capa.
- **Services que se apoyan en el dueño de cada entidad** (referencia: `2026-2c-lu-sa-grupo-1`,
  rama `develop`):
  - Cada entidad tiene **un** service dueño, el único que la busca por id y lanza su 404
    (`obtenerOFallar`). Los demás services se la piden a ese service: NO DEBEN repetir la
    búsqueda ni el 404.
  - Una referencia que llega en la entrada (por ejemplo, `categoriaId`) se valida con
    `buscarReferenciada` del service dueño: si no existe, es un dato inválido (400 sobre el
    campo), no un 404 del recurso pedido.
  - Las dependencias entre services NO DEBEN formar ciclos y van del que usa al dueño de la
    entidad; las conecta `app.ts`, en orden.
  - Un service usa directamente los repositorios de **su agregado** (por ejemplo,
    `TipoEntradaService` guarda con `RepositorioEventos`, porque `TipoEntrada` vive dentro de
    `Evento`). Sobre otro agregado solo hace consultas de existencia o conteo (`existePor…`,
    `contarPor…`).
  - **Búsquedas en lote, sin N+1**: cuando un caso de uso necesita varias entidades de otro
    agregado, se las pide en **una** llamada al service dueño (`obtenerPorIds(ids)`, que
    devuelve un `Map` por id y se apoya en `listarPorIds` del repositorio). El cruce lo hace el
    dueño, no el service que lo usa.
- Los **ids nuevos los da el repositorio** (`siguienteId()`); los services NO DEBEN generar ids.
- Los controllers NO DEBEN contener reglas de negocio ni acceder a repositories.
- Cómo se almacenan los datos (estructuras internas de los repositorios) NO DEBE filtrarse
  por encima de `repositories/`: los repositories reciben y devuelven entidades de dominio y no
  exponen sus colecciones internas.
- Los controllers NO usan `try/catch` para responder errores: los services lanzan errores de
  `errors/`; un middleware **registra** los errores y el **error handler** centralizado los
  traduce a HTTP (dos responsabilidades, dos middlewares).
- `errors/` NO DEBE conocer HTTP: cada error de aplicación lleva código y mensaje, y el status
  lo asigna el error handler con una tabla clase → status. Ningún error de aplicación queda
  sin status (lo verifica un test).
- La validación de forma de la entrada vive en `validations/` (esquemas y su middleware);
  las reglas de negocio viven en `domain/` y `services/`.

**Rationale**: la lógica se testea sin servidor ni base, y cada capa tiene una sola razón
para cambiar. Que cada entidad tenga un único service dueño evita repetir búsquedas y errores
en varios services, y prohibir los ciclos mantiene el grafo de dependencias legible. Esto
revoca el anti-patrón "un service que llama a otro service" de la investigación de la 004
(`specs/004-crear-evento/research.md`, R1), que se conserva como registro histórico.

### IV. Persistencia en Memoria

- La persistencia son **repositorios en memoria** que guardan entidades de dominio en
  estructuras de JavaScript (`Map`). No hay base de datos ni bibliotecas que imiten una
  (consigna: "mecanismo de persistencia en memoria").
- Los datos viven mientras el proceso está corriendo. Al arrancar, un **seed** carga siempre
  los mismos datos de ejemplo (categorías, usuarios y eventos) para que la app sea demostrable
  desde el primer arranque; reiniciar el servidor vuelve a ese estado.
- **Identificadores**: las entidades que crean los usuarios usan **UUID v4** generado en el
  servidor (`crypto.randomUUID()`). Los datos de ejemplo usan **ids legibles y fijos** en
  kebab-case con el tipo como prefijo (`usuario-lucia`, `evento-noche-de-rock`), estables entre
  arranques para que la app, la demo, Postman y los tests puedan referirlos.
- Las operaciones que protegen invariantes cumplen la regla de **operaciones atómicas por
  evento** del dominio: verificar y modificar en un mismo tramo síncrono o bajo el cerrojo del
  evento. El cerrojo es una única instancia por app, inyectada por constructor desde el
  composition root (nunca estado global ni `static`).
- Cada instancia de la app (y cada test) tiene sus propios repositorios: no hay estado global.

**Rationale**: es lo que pide la consigna, se lee sin conocer ninguna base de datos y los
tests corren sin infraestructura. Las interfaces de repositorio permitirían agregar una base
real en el futuro sin tocar services ni dominio (decisión registrada en
`specs/001-base-backend/research.md`, R23).

### V. Contrato de API

- Toda la API vive bajo `/api`, habla JSON y usa recursos en **plural y kebab-case**
  (`/api/eventos`, `/api/compras/:id/mensajes`, `/api/tipos-entrada`).
- Los recursos exponen `id` como string (UUID, o id legible en los datos de ejemplo).
- Errores con un único formato:
  `{ "error": { "codigo": "CUPO_INSUFICIENTE", "mensaje": "<en español>", "detalles"?: [...] } }`
  - `400` entrada inválida · `401` usuario no identificado · `403` sin permiso sobre un
    recurso existente · `404` recurso inexistente · `409` conflicto de estado o de cupo ·
    `500` error inesperado (sin stack ni detalles internos en la respuesta).
- Toda entrada DEBE validarse en el servidor, aunque la app ya la haya validado.
- Cada feature documenta sus endpoints en `specs/NNN-slug/contracts/` y en la especificación
  OpenAPI de `backend/src/docs/`, servida en `/api/docs` (Swagger UI); un test verifica que
  la especificación cubre las rutas implementadas.

**Rationale**: un contrato predecible permite desarrollar backend y mobile en paralelo
contra el contrato, y que la app muestre mensajes de error útiles.

### VI. Identidad y Autorización Simuladas

- No hay registro ni contraseñas (fuera del alcance del TP). La app elige un usuario de los
  precargados y el backend lo identifica por el header `X-Usuario-Id` mediante un middleware.
- Los services DEBEN verificar la relación con el recurso: un comprador solo ve y opera sus
  compras; un organizador solo ve las compras de sus eventos; el chat de una compra es solo de
  sus dos partes.
- Las respuestas DEBEN devolver vistas explícitas (campos elegidos), no documentos completos.

**Rationale**: permite demostrar ambos roles en un mismo dispositivo sin implementar
autenticación, sin resignar las reglas de acceso del dominio.

### VII. App Mobile (Expo)

- React Native con **Expo** y **Expo Router**, en TypeScript; debe correr en un dispositivo
  físico con Expo Go contra el backend local (URL configurable por `EXPO_PUBLIC_API_URL`).
- Toda llamada HTTP vive en `mobile/src/api/`; las pantallas y componentes no hacen `fetch`.
- Cada pantalla con datos remotos DEBE manejar **cargando**, **error**, **vacío** y éxito.
- El estado de una compra se muestra con **texto y color** (nunca solo color), con un único
  componente reutilizable.
- Sin librerías de UI pesadas ni de manejo de estado global, salvo que el plan lo justifique.
- Componentes chicos, accesibles (`accessibilityLabel` en controles sin texto) y usables en
  pantallas de 360 px de ancho.

**Rationale**: la consigna pide una app que corra en el celular; mantenerla liviana hace
que cada cambio se vea en segundos con recarga en caliente.

### VIII. Tipos Compartidos y Lenguaje del Dominio

- Los tipos de los contratos (DTOs, enums como `EstadoCompra`) viven en `shared/` y los usan
  backend y mobile.
- El lenguaje del dominio es el de la consigna, en español: `Evento`, `TipoEntrada`, `Compra`,
  `cupo`, `estado`. Los nombres técnicos de capas siguen la arquitectura
  (`compra.controller.ts`, `compra.service.ts`, `compra.repository.ts`).

**Rationale**: un solo vocabulario entre consigna, specs, código y demo evita traducciones
y desalineaciones.

### IX. Calidad de Código (NON-NEGOTIABLE)

- TypeScript en modo `strict` en todos los paquetes.
- `npm test`, `npm run lint`, `npm run typecheck` y `npm run format:check` (Prettier) DEBEN
  pasar antes de cerrar una fase de `tasks.md` y antes de abrir un PR. El CI de GitHub Actions
  los corre completos, sin caché, en cada PR y cada push a `development` y `main`. Durante una
  fase, la verificación sigue "Verificación durante el desarrollo" (Flujo de Trabajo).
- Prohibido `any` explícito, `@ts-ignore` o `eslint-disable` sin un comentario que lo
  justifique.
- Simplicidad primero: no se agrega una abstracción, dependencia o capa que la spec no
  necesite (YAGNI). Toda complejidad extra se justifica en el plan.

## Stack y Restricciones Técnicas

| Ámbito | Elección |
|---|---|
| Repo | Monorepo con npm workspaces: `backend/`, `mobile/`, `shared/` |
| Backend | Node 22+ · Express 5 · TypeScript · zod (validación) |
| Persistencia | En memoria: repositorios con `Map`, sin base de datos |
| Mobile | Expo (SDK estable vigente) · Expo Router · TypeScript |
| Tests | Vitest + supertest (backend) · Jest + React Native Testing Library (mobile) |
| Calidad | ESLint · `tsc --noEmit` · Prettier · GitHub Actions (CI) |

- Solo herramientas y servicios gratuitos (requisito de la consigna).
- Secretos y URLs locales en `.env` (no versionado); se versiona `.env.example`.

## Flujo de Trabajo

### Ramas

- `main`: versión estable y demostrable. Solo recibe merges desde `development`.
- `development`: integración. Recibe las features por Pull Request.
- `feature/NNN-slug`: una rama por feature de Spec Kit (la crea `/speckit-specify`), siempre
  desde `development` actualizada. Contiene la spec, el plan, las tareas y el código de esa
  feature, y se integra a `development` por PR con tests, lint y typecheck en verde.
- Cambios de gobierno (constitución, backlog, `AGENTS.md`) pueden commitearse directo en
  `development`.
- No se commitea directo a `main`.

### Trabajo en paralelo

Si una feature queda bloqueada por otra que no está integrada:

1. Se trabaja contra el **contrato** de la otra feature (`specs/NNN/contracts/`) con datos
   del seed o stubs, y se integra cuando la dependencia llega a `development`; o
2. se crea la rama desde la feature de la que depende y se rebasa sobre `development` cuando
   esa dependencia se integre.

### Verificación durante el desarrollo

- **Ciclo de TDD**: en cada rojo y cada verde se corre **solo el test de la tarea**, por archivo
  (`npm run test:foco -w backend|mobile -- <archivos>`, o `npm run test:afectados -w backend`),
  con salida resumida (Vitest `--reporter=dot`, Jest `--silent`). La suite completa no se corre
  en cada ciclo.
- **Cierre de fase y PR**: al cerrar cada fase de `tasks.md` y antes de abrir el PR se corren
  completos `npm test`, `npm run lint`, `npm run typecheck` y `npm run format:check`, y DEBEN
  quedar en verde. Una fase no se da por cerrada con solo los tests focalizados.
- **Hook `Stop`** (`.claude/hooks/verificar-al-terminar.mjs`): al terminar cada turno verifica
  typecheck y lint de los paquetes con archivos cambiados desde la última verificación exitosa
  (`shared/` → los tres paquetes; configuración de la raíz → todo el repo; solo Markdown → nada),
  con `tsc --incremental` y `eslint --cache`. Si falla, DEBE bloquear el cierre del turno. No corre
  tests.
- **CI**: no cambia con esta sección. Corre formato, lint, tipos y tests completos y sin caché en
  cada PR y cada push a `development` y `main`, y es la verificación que decide la integración.
- **Implement por fases**: `/speckit-implement` se corre de a una fase de `tasks.md`, con contexto
  limpio entre fases. `/speckit-tasks` agrupa las tareas triviales (stubs con firma real,
  re-exports de `app/`) con la tarea que las necesita, en vez de listarlas una por una.

**Rationale**: la suite de mobile tarda alrededor de un minuto; correrla en cada ciclo de TDD
multiplicaba el tiempo de implementación sin aportar más información que el test de la tarea. La
suite completa al cierre de cada fase y el CI sin caché conservan la garantía de calidad del
principio IX.

### Commits

Conventional Commits en español, con el scope de la feature:
`docs(004-explorar-eventos): spec y clarificaciones`, `feat(005-comprar-entradas): ...`,
`test(...)`, `fix(...)`, `chore(...)`. Commits chicos, uno por tarea o grupo coherente de
tareas.

## Governance

- Esta constitución prevalece sobre cualquier otra convención del repo, incluidas las specs.
- Toda spec y todo plan DEBEN pasar el "Constitution Check" del plan; una violación se
  justifica explícitamente en la tabla de complejidad del plan o se corrige.
- Enmiendas: se modifican con `/speckit-constitution`, actualizando la versión con SemVer
  (MAJOR: se elimina o redefine un principio · MINOR: se agrega o amplía un principio o
  sección · PATCH: aclaraciones), y la fecha de última enmienda.
- La guía operativa para agentes está en `AGENTS.md`.

**Version**: 2.4.0 | **Ratified**: 2026-11-02 | **Last Amended**: 2026-11-12
