# Contrato de API: Favoritos (014)

Base `/api`. Las tres rutas requieren usuario (`X-Usuario-Id`) y viven en `usuarios.routes.ts`,
declaradas **antes** que `/usuarios/:id` (research R2, R3). Se documentan en
`backend/src/docs/openapi.json` (tag `Favoritos`) y en la colección de Postman.

Orden de rechazos, igual en las tres (FR-005):

1. `401 USUARIO_NO_IDENTIFICADO` — sin `X-Usuario-Id` o con uno que no existe.
2. `400 ENTRADA_INVALIDA` — `params.eventoId` con formato inválido (`eventoPorId`, el de la 004)
   (solo `PUT` y `DELETE`).
3. `404 EVENTO_NO_ENCONTRADO` — el evento no existe (solo `PUT` y `DELETE`, FR-004).

No hay `403` (cualquier usuario marca cualquier evento) ni `409` (FR-001).

---

## `GET /api/usuarios/actual/favoritos`

Los favoritos del usuario actual (FR-008 a FR-012).

**200** — `EventoCatalogoVista[]` (de `shared/`, sin cambios; la misma vista que una tarjeta del
catálogo):

```json
[
  {
    "id": "evento-clasico-de-basquet",
    "nombre": "Clásico de básquet",
    "categoria": { "id": "categoria-deportes", "nombre": "Deportes" },
    "fechaHora": "2026-11-27T22:00:00.000Z",
    "fechaHoraLocal": "2026-11-27T19:00",
    "organizadorId": "usuario-sofia",
    "realizado": false,
    "cantidadTiposEntrada": 2,
    "precioDesde": 8000,
    "agotado": false,
    "organizador": {
      "id": "usuario-sofia", "nombre": "Sofía", "apellido": "Castro",
      "puntaje": 2.5, "cantidadResenias": 2
    }
  }
]
```

- **Orden**: los no realizados por `fechaHora` ascendente, después los realizados por `fechaHora`
  descendente; desempate nombre → id (FR-009; `ordenDeMisEventos`).
- **Sin páginas** (FR-012): llega entera; `[]` si no tiene favoritos.
- Un id guardado cuyo evento ya no existe **no aparece** y no es un error (FR-010).
- `organizador.puntaje` y `cantidadResenias`, `precioDesde`, `agotado` (con el cupo al día) se
  calculan igual que en `GET /eventos` (FR-008, SC-006).
- Lectura: no guarda nada ni toma cerrojos.

## `PUT /api/usuarios/actual/favoritos/:eventoId`

Marca el evento como favorito del usuario actual. Sin cuerpo (si llega uno, se ignora).

**204** — sin cuerpo. Si ya era favorito, también `204` y no cambia nada (FR-003).

Vale para cualquier evento existente: propio, ajeno, próximo o realizado (FR-001). No toca el
evento, sus tipos, su cupo ni sus compras, y no toma el cerrojo del evento (FR-007).

## `DELETE /api/usuarios/actual/favoritos/:eventoId`

Desmarca el evento. **204** — sin cuerpo. Si no era favorito, también `204` (FR-003). Si el evento
no existe, `404` (FR-004), aunque su id estuviera guardado (research R5).

---

## Cambia: `DELETE /api/eventos/:eventoId` (004)

Mismo contrato y mismos rechazos. Cuando la eliminación se concreta, el evento sale además de los
favoritos de **todos** los usuarios (FR-010, research R5); si se rechaza (403, 409 por compras o
por realizado), ningún favorito cambia.

## Sin cambios

`GET /eventos`, `GET /eventos/:eventoId`, `GET /eventos/mios` y `GET /compras` no suman ningún
dato de favoritos y siguen como estaban; el catálogo sigue público e igual para todos (FR-013).

## Ejemplos

| Pedido | Resultado |
|---|---|
| `PUT …/favoritos/evento-hamlet` sin `X-Usuario-Id` | `401 USUARIO_NO_IDENTIFICADO` |
| `PUT …/favoritos/Evento Hamlet!` (formato inválido) | `400 ENTRADA_INVALIDA`, detalle sobre `params.eventoId` |
| `PUT …/favoritos/evento-inexistente` | `404 EVENTO_NO_ENCONTRADO`; los favoritos no cambian |
| `PUT …/favoritos/evento-hamlet` dos veces | `204` y `204`; `evento-hamlet` aparece una vez en la lista |
| `DELETE …/favoritos/evento-hamlet` sin tenerlo | `204` |
| Diego marca `evento-hamlet`; Lucía pide su lista | la de Lucía no lo incluye (FR-006) |
| Lucía elimina un evento propio sin compras que Diego tenía | `204`; la lista de Diego ya no lo trae |
