<p align="center"><img src="docs/consigna/logo-ai-ticket-it.png" alt="AI Ticket It" width="220"></p>

# AI Ticket It

Plataforma móvil para publicar eventos y vender entradas. Trabajo Práctico Individual de
Desarrollo con IA — Diseño de Sistemas, UTN FRBA, 2C 2026.

## Cómo se trabaja

El proyecto se desarrolla con **Spec-Driven Development** usando
[Spec Kit](https://github.com/github/spec-kit) y Claude Code:

1. **Constitución** — principios y reglas del dominio: [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
2. **Backlog** — features priorizadas y sus dependencias: [`docs/backlog.md`](docs/backlog.md)
3. **Por feature**: `specify → clarify → plan → tasks → implement`, en su rama
   `feature/NNN-slug`, integrada a `development` por Pull Request. Los artefactos de cada
   feature quedan en `specs/NNN-slug/`.

Consigna y casos de uso: [`docs/consigna/consigna.md`](docs/consigna/consigna.md).

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Node + Express 5 + TypeScript, en capas (routes → controllers → services → repositories → domain) |
| Persistencia | MongoDB con Mongoose — en memoria (mongodb-memory-server) por defecto |
| Mobile | React Native con Expo + Expo Router |
| Tests | Vitest + supertest · Jest + React Native Testing Library |

## Para arrancar

Las instrucciones de instalación y ejecución se completan con la feature 001 (base técnica).
