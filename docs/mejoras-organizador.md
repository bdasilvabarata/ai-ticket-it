# Mejoras del organizador (fuera de SDD)

Cambios pedidos directamente sobre `development`, sin Spec Kit. Ninguno está pautado en una
feature pendiente (012 reseñas, 013 favoritos, 014 pulido estético). Se implementan por grupos,
con contexto limpio entre grupos; cada grupo cierra con sus tests focalizados, lint, typecheck y
un commit.

## Decisiones

- **Aviso de mensajes**: "sin responder", derivado del chat (sin estado nuevo de lectura): una
  compra tiene un mensaje sin responder si el último mensaje de su chat es del comprador. Se
  apaga cuando el organizador contesta.
- **Filtro por estado** en "Compras del evento": Todas · Pendiente · Confirmada · Utilizada ·
  Cancelada · Reembolsada (Utilizada con chip propio). Filtro en la app, sobre la vista que ya
  llega (no cambia el endpoint).

## Grupos

| # | Grupo | Tareas | Estado |
|---|---|---|---|
| 1 | **Descartar solo con cambios** | `useConfirmarDescarte({ hayCambios })` y `mismosValores` en `formulario.ts`; Crear evento, Editar evento y el formulario de tipo comparan con lo cargado al abrir; tests de las tres pantallas | hecho |
| 2 | **Hub del evento propio** | `/eventos/[eventoId]` pasa a ser el hub (nombre, fecha, categoría y los botones "Ver compras", "Registrar ingreso" y "Editar evento", o "Ver detalle" si está realizado); la edición / solo lectura actual se muda a `/eventos/[eventoId]/editar`; guardar o eliminar siguen volviendo a Mis eventos; los formularios de tipo vuelven a la edición; tests (`mis-eventos`, `editar-evento`, `evento-realizado`, `tipo-entrada`, `compras-del-evento`, `navegacion`) | pendiente |
| 3 | **Filtro por estado en Compras del evento** | componente de chips (radio, accesible) en `features/compras`; filtra `vista.compras` sin tocar el resumen por tipo; vacío propio por filtro ("No hay compras canceladas"); tests | pendiente |
| 4 | **Mensajes sin responder** | `shared`: `CompraDelEventoVista.mensajeSinResponder: boolean` (y en `ComprasDelEventoVista`, `comprasConMensajesSinResponder`); backend: derivarlo en `compra.vistas.ts` (`compra.ultimoMensajeEsDe(compradorId)` o equivalente), OpenAPI y tests; app: marca "Mensaje sin responder" en `FilaCompraDelEvento`, contador en el hub (si el grupo 2 lo permite sin otra lectura, si no, solo en la lista), filtro "Sin responder" junto a los de estado; tests | pendiente |
