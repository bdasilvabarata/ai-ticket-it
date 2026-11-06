# AI Ticket It — instrucciones para agentes

Plataforma móvil de venta de entradas para eventos: organizadores publican eventos con tipos de
entrada; compradores buscan, compran, siguen sus compras, chatean y reseñan. TP individual de
Desarrollo con IA (DDS UTN FRBA, 2C 2026).

## Antes de tocar código

- Leé `.specify/memory/constitution.md`: dominio, reglas de negocio y principios no negociables.
- La consigna y los casos de uso (UC-01 a UC-12) están en `docs/consigna/consigna.md`.
- El orden y las dependencias de las features están en `docs/backlog.md`.
- Toda feature sigue Spec Kit: `/speckit-specify → /speckit-clarify → /speckit-plan →
  /speckit-tasks → /speckit-implement`, con revisión humana entre etapas.

## Ramas (ver constitución, "Flujo de Trabajo")

- `main` ← solo merges desde `development`.
- `development` ← PRs de features.
- `feature/NNN-slug` ← la crea `/speckit-specify`. **Antes de correrlo, posicionate en
  `development` actualizada** (`git switch development && git pull`), porque la rama nueva
  nace del HEAD actual.
- Al terminar una feature: tests, lint y typecheck en verde → PR a `development` → actualizar
  el estado en `docs/backlog.md`.

## Mapa

- `shared/` — tipos de contratos y enums compartidos (ej.: `EstadoCompra`).
- `backend/src/` — Express en capas:
  `routes/ → controllers/ → services/ → repositories/ → domain/`, más `middlewares/`
  (usuario actual, logging, 404, registro y respuesta de errores), `validations/` (zod),
  `errors/`, `config/` y `docs/` (OpenAPI, servida en `/api/docs`).
  - `app.ts` es el **composition root**: el único lugar que instancia y conecta las clases;
    cada clase recibe sus dependencias por constructor (nada de instancias globales).
  - `domain/` son clases con comportamiento (sin Express ni Mongoose) y las interfaces de
    repositorio de las que dependen los services.
  - `domain/errores.ts`: `DatosInvalidosError` y `ReglaDeNegocioError` (sin HTTP); el
    error handler los traduce a 400 y 409. `domain/` no importa `errors/` (lo controla el lint).
- `backend/tests/{domain,services,api}` — Vitest; `services/` usa los repositorios en memoria
  de `backend/tests/fakes/` (verificados contra Mongo por `api/repositorios.contrato.test.ts`);
  `api/` usa supertest y Mongo en memoria propio.
- `mobile/` — Expo + Expo Router. Todo `fetch` vive en `mobile/src/api/`.
- `specs/NNN-slug/` — spec, plan, research, data-model, contracts y tasks de cada feature.

> `backend/` y `shared/` los crea la feature 001 (base backend); `mobile/`, la 002 (base mobile).

## Comandos

Desde la raíz del repo:

| Comando | Efecto |
|---|---|
| `npm install` | instala todos los workspaces (`backend`, `shared`) |
| `npm start` | arranca el servidor (MongoDB en memoria + seed, o `MONGO_URI` de `backend/.env`) |
| `npm run dev` | igual, recargando ante cambios |
| `npm run seed -- --forzar` | **vacía** `categorias`, `usuarios` y `eventos` de la base de `MONGO_URI` y carga los datos de ejemplo |
| `npm run seed` (sin `--forzar`) | no modifica nada: muestra la base de destino y termina con código 1 |
| `npm test` · `npm run lint` · `npm run typecheck` | calidad, en todos los paquetes |
| `npm run format` · `npm run format:check` | Prettier (escribe / verifica); no toca los `.md` |

`npm run seed` exige `MONGO_URI` **y** el flag `--forzar`; sin alguno de los dos no toca la base.

Antes de dar una tarea por terminada: `npm test`, `npm run lint`, `npm run typecheck` y
`npm run format:check` en verde. El CI (`.github/workflows/ci.yml`) los corre en cada PR.

## Convención de nombres (repositories y services)

| Capa | Método | Devuelve / hace |
|---|---|---|
| Repository | `listar()` | todas las entidades |
| Repository | `buscarPorId(id)` · `buscarPor<Criterio>(...)` | la entidad o `null` (nunca lanza 404) |
| Repository | `contarPor<Criterio>(...)` · `existe<Algo>(...)` | números / booleanos |
| Repository | `guardar(entidad)` · `eliminarPorId(id)` | persistencia |
| Service | `listar()` · `obtener(id)` · `crear(datos)` · `actualizar(id, datos)` · `eliminar(id)` | casos de uso; `obtener` lanza 404 |
| Service | `#obtenerOFallar(id)` (privado) | **único** lugar del service que busca por id y lanza 404 |

