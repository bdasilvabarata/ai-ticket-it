# Backlog — AI Ticket It

Fuente de verdad del **orden** y las **dependencias** entre features (constitución, principio I).
Cada feature se desarrolla en su rama `feature/NNN-slug` con el flujo de Spec Kit.

## Estados

`pendiente` · `spec` · `plan` · `tasks` · `en curso` · `en PR` · `integrada`

## Features

| # | Feature | Casos de uso | Prioridad | Depende de | Estado |
|---|---|---|---|---|---|
| 001 | **Base técnica**: monorepo, backend en capas con middlewares y error handler, Mongo en memoria + seed, app Expo con navegación, cliente HTTP y selector de usuario | — | P0 | — | pendiente |
| 002 | **Crear evento** con tipos de entrada (precio y cupo) y catálogo de categorías | UC-04 | P1 | 001 | pendiente |
| 003 | **Explorar eventos**: búsqueda textual, filtro por categoría, detalle del evento y ordenamiento por precio, fecha y puntaje del organizador | UC-03, UC-11 | P1 | 001 (usa eventos del seed) | pendiente |
| 004 | **Comprar entradas**: elegir tipo y cantidad sin superar el cupo, compra `PENDIENTE` y pago simulado → `CONFIRMADA` | UC-12 | P1 | 001, 003 (detalle del evento) | pendiente |
| 005 | **Mis compras**: listado con estado bien diferenciado y días restantes si está confirmada | UC-01 | P1 | 004 | pendiente |
| 006 | **Compras de un evento** (organizador): compras por estado, disponibles por tipo y registrar uso de entrada → `UTILIZADA` | UC-02 | P2 | 002, 004 | pendiente |
| 007 | **Cancelar compra** con reembolso, respetando las reglas de cancelación | UC-07, UC-08 | P2 | 005 | pendiente |
| 008 | **Chat de la compra** entre comprador y organizador | UC-05, UC-06 | P2 | 005, 006 | pendiente |
| 009 | **Reseñas**: puntuar y comentar un evento con entrada utilizada; ver reseñas del organizador; alimenta el puntaje usado en 003 | UC-09, UC-10 | P3 | 006 | pendiente |
| 010 | *(Opcional)* **Favoritos**: guardar eventos favoritos | — (contexto de la consigna) | P4 | 003 | pendiente |

## Grafo de dependencias

```mermaid
graph LR
  F001[001 Base técnica] --> F002[002 Crear evento]
  F001 --> F003[003 Explorar eventos]
  F003 --> F004[004 Comprar entradas]
  F004 --> F005[005 Mis compras]
  F002 --> F006[006 Compras de un evento]
  F004 --> F006
  F005 --> F007[007 Cancelar compra]
  F005 --> F008[008 Chat]
  F006 --> F008
  F006 --> F009[009 Reseñas]
  F009 -. puntaje .-> F003
  F003 --> F010[010 Favoritos]
```

## Oportunidades de paralelismo

- Con **001** integrada, **002** y **003** avanzan en paralelo: 003 trabaja con eventos del seed.
- **003** ordena por puntaje del organizador antes de que exista **009**: el puntaje sale `null`
  (sin reseñas) y esos eventos van al final. Cuando 009 se integre, el orden se completa solo.
- Con **004** integrada, **005**, **006** y **007** pueden avanzar a la vez; **008** necesita
  las pantallas de 005 y 006, pero su backend puede hacerse contra el contrato antes.

## Decisiones abiertas (a resolver en el `clarify` de cada feature)

- 004: ¿cuánto dura una compra `PENDIENTE` sin pagar? ¿expira y libera cupo?
- 006: ¿desde cuándo puede el organizador registrar el uso de una entrada (solo el día del
  evento)? ¿con qué dato la identifica?
- 007: ¿el reembolso es inmediato (`CANCELADA → REEMBOLSADA` automático) o lo confirma el
  organizador? ¿hay plazo mínimo antes del evento?
- 009: ¿se puede editar o borrar una reseña?
