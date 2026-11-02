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
  (usuario actual, validación, logging, 404, error handler), `errors/` y `config/`.
  `domain/` es puro (sin Express ni Mongoose).
- `backend/tests/{domain,api}` — Vitest; los de API usan supertest y Mongo en memoria propio.
- `mobile/` — Expo + Expo Router. Todo `fetch` vive en `mobile/src/api/`.
- `specs/NNN-slug/` — spec, plan, research, data-model, contracts y tasks de cada feature.

> La estructura de `backend/`, `mobile/` y `shared/` la crea la feature 001 (base técnica).

## Comandos

Se completan en la feature 001. Antes de dar una tarea por terminada:
`npm test`, `npm run lint` y `npm run typecheck`.
