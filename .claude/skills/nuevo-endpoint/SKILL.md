---
name: nuevo-endpoint
description: Checklist para crear o modificar un endpoint del backend de AI Ticket It respetando las capas, el contrato de API, la autorización simulada y TDD. Usar siempre que se agregue o cambie una ruta en backend/src/routes.
---

## Antes de escribir, respondé
- ¿Qué caso de uso (UC-xx) y qué tarea de `specs/NNN-slug/tasks.md` cubre?
- ¿Quién lo consume: comprador, organizador o ambos? ¿Qué relación con el recurso se exige?
- ¿Qué valida (forma con zod, reglas de negocio en domain/services)?
- ¿Qué puede fallar y con qué status (400/401/403/404/409)?
- ¿Está en `specs/NNN-slug/contracts/`? Si no, agregalo primero.

## Dónde va cada cosa (principio III)
- `backend/src/routes/` — método + path, middlewares (`requerirUsuario`, `<validacion>.middleware`) y controller.
- `backend/src/controllers/<recurso>.schemas.ts` — `crearValidacion({ params?, query?, body? })` con zod;
  esquemas comunes (`idSchema`) en `middlewares/esquemas-comunes.ts`.
- `backend/src/controllers/` — lee la entrada con `<validacion>.leer(req, "body")` (ya transformada y
  tipada), llama al service, arma la response. Sin reglas, sin try/catch.
- `backend/src/services/` — el caso de uso: permisos, orquestación, errores de `errors/`.
- `backend/src/repositories/` — Mongoose. Devuelve objetos de dominio planos con `id` string.
- `backend/src/domain/` — reglas puras (cupo, transiciones de estado, días restantes...).
- `shared/` — DTOs de request/response y enums.

## Contrato (principio V)
- Bajo `/api`, JSON, recursos en plural y kebab-case.
- Nunca `_id` ni `__v` en la respuesta; vista explícita, no `{ ...doc }`.
- Errores: `{ "error": { "codigo", "mensaje", "detalles"? } }` vía error handler. Los errores de
  Mongo (validación, cast, duplicado 11000 → 409 `RECURSO_DUPLICADO`) los traduce
  `repositories/errores-persistencia.ts`; si el caso merece un código propio, lanzalo desde el service.

## Invariantes que no se negocian
- Cupo nunca negativo, con actualización atómica.
- Total calculado en el servidor.
- Transiciones de estado solo las de la constitución, con `CambioEstadoCompra`.

## TDD (principio II)
1. Test de dominio en `backend/tests/domain/` si hay regla nueva.
2. Test de API en `backend/tests/api/` con supertest: caso feliz + al menos un borde
   (id inexistente → 404, campo faltante → 400, usuario ajeno → 403, conflicto → 409).
3. Verlo fallar, implementar, verlo pasar.
4. `npm test`, `npm run lint`, `npm run typecheck`.
