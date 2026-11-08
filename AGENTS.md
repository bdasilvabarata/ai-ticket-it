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
  - `domain/` son clases con comportamiento (sin Express ni IO) y las interfaces de
    repositorio de las que dependen los services.
  - `repositories/` son repositorios **en memoria** (un `Map` privado por repositorio); no hay
    base de datos. `seed/` arma los datos de ejemplo y `crearRepositoriosDeEjemplo()`;
    `crearApp()` los usa por defecto. Las operaciones que toquen cupo o estados no pueden
    tener un `await` entre verificar y modificar (constitución, "Cupo atómico").
  - `domain/errores.ts`: `DatosInvalidosError` y `ReglaDeNegocioError` (sin HTTP); el
    error handler los traduce a 400 y 409. `domain/` no importa `errors/` (lo controla el lint).
- `backend/tests/{domain,repositories,services,api}` — Vitest; `services/` usa los
  repositorios en memoria construidos con los datos de cada caso; `api/` usa supertest con
  `crearApp()` (repositorios nuevos por test).
- `mobile/` — Expo + Expo Router. Todo `fetch` vive en `mobile/src/api/`.
- `specs/NNN-slug/` — spec, plan, research, data-model, contracts y tasks de cada feature.

> `backend/` y `shared/` los crea la feature 001 (base backend); `mobile/`, la 002 (base mobile).

## Comandos

Desde la raíz del repo:

| Comando | Efecto |
|---|---|
| `npm install` | instala todos los workspaces (`backend`, `shared`) |
| `npm start` | arranca el servidor con los datos de ejemplo en memoria |
| `npm run dev` | igual, recargando ante cambios (cada recarga vuelve a los datos de ejemplo) |
| `npm test` · `npm run lint` · `npm run typecheck` | calidad, en todos los paquetes |
| `npm run format` · `npm run format:check` | Prettier (escribe / verifica); no toca los `.md` |

Antes de dar una tarea por terminada: `npm test`, `npm run lint`, `npm run typecheck` y
`npm run format:check` en verde. El CI (`.github/workflows/ci.yml`) los corre en cada PR.
Además, un hook `Stop` de Claude Code (`.claude/settings.json` →
`.claude/hooks/verificar-al-terminar.mjs`) corre `typecheck` y `lint` al terminar cada turno en
que cambió algo que no sea Markdown, y si fallan no deja cerrar el turno hasta corregirlos.

## Convención de nombres (repositories y services)

| Capa | Método | Devuelve / hace |
|---|---|---|
| Repository | `listar()` | todas las entidades |
| Repository | `buscarPorId(id)` · `buscarPor<Criterio>(...)` | la entidad o `null` (nunca lanza 404) |
| Repository | `contarPor<Criterio>(...)` · `existe<Algo>(...)` | números / booleanos |
| Repository | `guardar(entidad)` · `eliminarPorId(id)` | persistencia |
| Service | `listar()` · `obtener(id)` · `crear(datos)` · `actualizar(id, datos)` · `eliminar(id)` | casos de uso; `obtener` lanza 404 |
| Service | `#obtenerOFallar(id)` (privado) | **único** lugar del service que busca por id y lanza 404 |

