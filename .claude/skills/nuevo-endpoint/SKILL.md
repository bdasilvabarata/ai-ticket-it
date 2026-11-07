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
- `backend/src/routes/<recurso>.routes.ts` — fábrica `crear<Recurso>Router(controller, ...)`: método + path,
  middlewares (`requerirUsuario`, `<validacion>.middleware`) y método del controller.
- `backend/src/validations/<recurso>.validation.ts` — `crearValidacion({ params?, query?, body? })` con zod;
  esquemas comunes (`idSchema`) en `validations/comunes.ts`.
- `backend/src/controllers/` — clase que recibe su service por constructor; métodos flecha. Lee la entrada
  con `<validacion>.leer(req, "body")` (ya transformada y tipada), llama al service, arma la response.
  Sin reglas, sin try/catch.
- `backend/src/services/` — clase con el caso de uso: permisos, orquestación, errores de `errors/`. Recibe
  **interfaces** de repositorio (`domain/repositorios.ts`) por constructor.
- `backend/src/repositories/` — repositorio **en memoria** (`Map` privado) que implementa la interfaz; recibe y
  devuelve entidades de dominio y nunca expone el `Map`. Si la operación verifica y modifica (cupo, estado),
  hacelo sin `await` en el medio (constitución, "Cupo atómico").
- `backend/src/domain/` — clases con comportamiento e invariantes (`hayCupoPara`, transiciones de estado,
  días restantes...). Sin IO y sin `errors/`: lanzá `DatosInvalidosError` (→ 400) o
  `ReglaDeNegocioError("CODIGO", "mensaje")` (→ 409) de `domain/errores.ts`.
- `backend/src/app.ts` — composition root: instanciá ahí el repository, el service y el controller nuevos.
- `backend/src/docs/openapi.json` (y la colección de Postman) — documentá el endpoint; `docs.test.ts`
  verifica que exista.
- `shared/` — DTOs de request/response y enums.

## Nombres (convención de AGENTS.md)
- Repository: `listar`, `buscarPorId` (null si no existe), `buscarPor<Criterio>`, `contarPor<Criterio>`,
  `guardar`, `eliminarPorId`.
- Service: `listar`, `obtener` (404), `crear`, `actualizar`, `eliminar`; un único `#obtenerOFallar(id)`.
- Si agregás un método al repository, agregá su test en `tests/repositories/`.
- Ids: `crypto.randomUUID()` para lo que se crea; ids legibles `<tipo>-<slug>` solo en los datos de ejemplo.
  Validá ids con `idSchema` (`validations/comunes.ts`).

## Contrato (principio V)
- Bajo `/api`, JSON, recursos en plural y kebab-case.
- Vista explícita en la respuesta (campos elegidos), nunca la entidad completa con `{ ...entidad }`.
- Errores: `{ "error": { "codigo", "mensaje", "detalles"? } }` vía error handler. Una regla del dominio
  (`ReglaDeNegocioError`) responde 409 con su código; si el caso merece un código propio, lanzalo desde el
  dominio o el service.

## Invariantes que no se negocian
- Cupo nunca negativo, con actualización atómica (verificar y descontar sin `await` en el medio).
- Total calculado en el servidor.
- Transiciones de estado solo las de la constitución, con `CambioEstadoCompra`.

## TDD (principio II)
1. Test de dominio en `backend/tests/domain/` si hay regla nueva, y de service en `backend/tests/services/`
   con repositorios falsos inyectados.
2. Test de API en `backend/tests/api/` con supertest: caso feliz + al menos un borde
   (id inexistente → 404, campo faltante → 400, usuario ajeno → 403, conflicto → 409).
3. Verlo fallar, implementar, verlo pasar.
4. `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`.
