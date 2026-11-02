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

- **Cupo**: las entradas vendidas de un tipo son la suma de las cantidades de sus compras en
  estado `PENDIENTE`, `CONFIRMADA` o `UTILIZADA`. Disponibles = cupo − vendidas. Una compra
  NO PUEDE dejar disponibles por debajo de 0, ni siquiera ante compras concurrentes.
- **Total**: lo calcula el servidor como `precio × cantidad` al momento de comprar. El cliente
  nunca envía precios ni totales.
- **Estados de una compra** — solo estas transiciones son válidas:
  - `PENDIENTE → CONFIRMADA` (pago simulado)
  - `PENDIENTE → CANCELADA`
  - `CONFIRMADA → UTILIZADA` (el organizador registra el ingreso)
  - `CONFIRMADA → CANCELADA → REEMBOLSADA`
  Todo cambio de estado DEBE registrar un `CambioEstadoCompra` con quién y cuándo.
- **Cancelación**: una compra NO PUEDE cancelarse si está `UTILIZADA` o si el evento ya se
  realizó. Las entradas de una compra cancelada vuelven al cupo disponible.
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
  - `backend/tests/domain/` — reglas puras, sin base de datos.
  - `backend/tests/api/` — endpoints con supertest contra la app de Express (sin levantar
    puerto) y una base MongoDB en memoria aislada por suite.
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
  services/      ← casos de uso: orquesta repositories y domain, verifica permisos
  repositories/  ← único acceso a datos (Mongoose); devuelve objetos de dominio planos
  domain/        ← entidades y reglas de negocio puras
  middlewares/   ← identificación de usuario, validación, logging, 404, error handler
  errors/        ← errores de aplicación tipados
  config/        ← entorno y conexión a la base
```

- `domain/` NO DEBE importar Express, Mongoose ni nada con IO.
- Los controllers NO DEBEN contener reglas de negocio ni acceder a repositories.
- Mongoose (modelos, `_id`, `ObjectId`, documentos) NO DEBE filtrarse por encima de
  `repositories/`.
- Los controllers NO usan `try/catch` para responder errores: los services lanzan errores de
  `errors/` y el **error handler** centralizado los traduce a HTTP.
- La validación de forma de la entrada vive en un middleware de validación con esquemas;
  las reglas de negocio viven en `domain/` y `services/`.

**Rationale**: la lógica se testea sin servidor ni base, y cada capa tiene una sola razón
para cambiar.

### IV. Persistencia MongoDB en Memoria

- La persistencia es MongoDB vía Mongoose.
- Por defecto el backend levanta **mongodb-memory-server** (cumple "persistencia en memoria"
  de la consigna sin instalar nada). Si se define `MONGO_URI`, se conecta a ese Mongo real.
  El código de producto es el mismo en ambos casos.
- Al iniciar con base en memoria, un **seed** carga categorías, usuarios y eventos de ejemplo
  para que la app sea demostrable desde el primer arranque.
- Los tests usan siempre su propia instancia en memoria; nunca una base compartida.
- Las operaciones que protegen invariantes (descontar cupo, cambiar estado) DEBEN ser
  atómicas (actualización condicional o transacción).

**Rationale**: concilia el requerimiento del TP con el uso de MongoDB y deja el camino libre a
una base real sin reescribir código.

### V. Contrato de API

- Toda la API vive bajo `/api`, habla JSON y usa recursos en **plural y kebab-case**
  (`/api/eventos`, `/api/compras/:id/mensajes`, `/api/tipos-entrada`).
- Los recursos exponen `id` como string; nunca `_id` ni `__v`.
- Errores con un único formato:
  `{ "error": { "codigo": "CUPO_INSUFICIENTE", "mensaje": "<en español>", "detalles"?: [...] } }`
  - `400` entrada inválida · `401` usuario no identificado · `403` sin permiso sobre un
    recurso existente · `404` recurso inexistente · `409` conflicto de estado o de cupo ·
    `500` error inesperado (sin stack ni detalles internos en la respuesta).
- Toda entrada DEBE validarse en el servidor, aunque la app ya la haya validado.
- Cada feature documenta sus endpoints en `specs/NNN-slug/contracts/`.

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
- `npm test`, `npm run lint` y `npm run typecheck` DEBEN pasar antes de cerrar una tarea y
  antes de abrir un PR.
- Prohibido `any` explícito, `@ts-ignore` o `eslint-disable` sin un comentario que lo
  justifique.
- Simplicidad primero: no se agrega una abstracción, dependencia o capa que la spec no
  necesite (YAGNI). Toda complejidad extra se justifica en el plan.

## Stack y Restricciones Técnicas

| Ámbito | Elección |
|---|---|
| Repo | Monorepo con npm workspaces: `backend/`, `mobile/`, `shared/` |
| Backend | Node 22+ · Express 5 · TypeScript · Mongoose · zod (validación) |
| Persistencia | MongoDB — mongodb-memory-server por defecto, `MONGO_URI` opcional |
| Mobile | Expo (SDK estable vigente) · Expo Router · TypeScript |
| Tests | Vitest + supertest (backend) · Jest + React Native Testing Library (mobile) |
| Calidad | ESLint · `tsc --noEmit` |

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

### Commits

Conventional Commits en español, con el scope de la feature:
`docs(003-explorar-eventos): spec y clarificaciones`, `feat(004-comprar-entradas): ...`,
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

**Version**: 1.0.0 | **Ratified**: 2026-11-02 | **Last Amended**: 2026-11-02
