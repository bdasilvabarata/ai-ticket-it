# Contrato de API: Mis compras (007)

Un endpoint nuevo. Los demás endpoints de la 006 no cambian. Formato de error, header
`X-Usuario-Id` y vistas: los de `specs/006-comprar-entradas/contracts/api.md`.

## Endpoints

| Método y ruta | Usuario | Respuesta | Errores |
|---|---|---|---|
| `GET /api/compras` | requerido (el comprador) | `200 MiCompraVista[]` | `401` |

## `GET /api/compras`

Las compras del **usuario actual como comprador**, de todos los eventos y en todos los estados.
Sin parámetros: no hay filtro, búsqueda ni paginación, y si llega una query se ignora.

- **Al día** (FR-003): se lee el reloj una vez por pedido. Una `PENDIENTE` cuyos 15 minutos ya
  pasaron sale `CANCELADA`, con `canceladaPor: "sistema"`, `venceEn: null` y sin "Pagar", aunque
  nadie la haya guardado así. La consulta **no guarda nada**: no materializa vencimientos ni
  devuelve cupo, y no toma el cerrojo.
- **Solo las propias** (FR-001): no incluye compras de otros compradores, tampoco las que otros
  hicieron en eventos que el usuario organiza.
- **Datos actuales** (FR-004): el nombre, la fecha y `realizado` del evento, y el nombre del tipo,
  son los vigentes. `cantidad` y `total` son los de la compra.
- **Lecturas** (FR-002, SC-007): una de compras y una de eventos (en lote), cualquiera sea la
  cantidad de compras.
- **Orden** (FR-006):
  1. primero las compras de eventos no realizados, por `evento.fechaHora` ascendente;
  2. después las de eventos realizados, por `evento.fechaHora` descendente;
  3. con la misma fecha de evento desempata `creadaEn` descendente y después `id`.

### `MiCompraVista`

Es la `CompraVista` de la 006 **sin** `compradorId` ni `historial`, más dos campos:

| Campo | Tipo | Valor |
|---|---|---|
| `id` | string | |
| `evento` | `{ id, nombre, fechaHora, fechaHoraLocal, realizado }` | actuales; `realizado` = `ahora ≥ fechaHora` (inclusive) |
| `tipoEntrada` | `{ id, nombre }` | nombre actual |
| `cantidad` | entero ≥ 1 | |
| `total` | entero ≥ 0 | fijado al comprar; 0 = gratis |
| `estado` | `EstadoCompra` | al día |
| `creadaEn` | ISO UTC | alta (el primer cambio del historial) |
| `venceEn` · `venceEnLocal` | ISO UTC · `"YYYY-MM-DDTHH:mm"` (Buenos Aires) · `null` | solo en `PENDIENTE` |
| `diasRestantes` | entero ≥ 0 · `null` | solo en `CONFIRMADA` de un evento no realizado: fecha de pared del evento − fecha de pared de hoy, en Buenos Aires (días de calendario, FR-009); si no, `null` |
| `canceladaPor` | `"sistema"` · `"usuario"` · `null` | solo en `CANCELADA`: `"sistema"` si venció sin pagarse y `"usuario"` si la canceló su comprador |

### Días restantes: ejemplos (reloj del servidor en hora de Buenos Aires)

| Ahora | Evento | `diasRestantes` |
|---|---|---|
| lun 10 · 12:00 | jue 20 · 20:00 | `10` |
| lun 10 · 00:01 | mar 11 · 21:00 | `1` |
| lun 10 · 23:59 | mar 11 · 21:00 | `1` |
| mar 11 · 00:00 | mar 11 · 21:00 | `0` |
| mar 11 · 20:59 | mar 11 · 21:00 | `0` |
| mar 11 · 21:00 | mar 11 · 21:00 | `null` (`realizado: true`) |

### Ejemplo (datos de ejemplo, Martín)

El seed pone el Festival a 30 días de calendario del arranque del servidor
(`fechaLocal(ahora, 30, 14)`), así que `diasRestantes: 30` es **ilustrativo**: un pedido hecho
después de una medianoche de Buenos Aires da uno menos. Los tests lo comparan con
`diasRestantes(evento.fechaHora, ahora)`, no con el literal.

```json
[
  {
    "id": "compra-martin-festival-vip",
    "evento": {
      "id": "evento-festival-sonidos-del-sur",
      "nombre": "Festival Sonidos del Sur",
      "fechaHora": "…",
      "fechaHoraLocal": "…T14:00",
      "realizado": false
    },
    "tipoEntrada": { "id": "tipo-festival-sonidos-del-sur-vip", "nombre": "VIP" },
    "cantidad": 2,
    "total": 240000,
    "estado": "CONFIRMADA",
    "creadaEn": "…",
    "venceEn": null,
    "venceEnLocal": null,
    "diasRestantes": 30,
    "canceladaPor": null
  }
]
```

| Pedido (`X-Usuario-Id`) | Resultado |
|---|---|
| sin header, o `usuario-inexistente` | `401 USUARIO_NO_IDENTIFICADO` |
| `usuario-martin` | `200`, una compra `CONFIRMADA` con `diasRestantes: 30` (ilustrativo, ver arriba) |
| `usuario-diego` | `200`, una compra `CANCELADA` con `canceladaPor: "sistema"` |
| `usuario-lucia` (organiza el Festival) | `200 []` |
| `usuario-sofia`, después de comprar sin pagar | `200`, la compra `PENDIENTE` con `venceEnLocal`; pasados 15 minutos, `CANCELADA` con `canceladaPor: "sistema"` |

## OpenAPI (`backend/src/docs/openapi.json`)

- Path `/compras` con `get` (tag `Compras`) y el parámetro de header `X-Usuario-Id`.
- Respuestas `200` (arreglo de `MiCompraVista`) y `401` (`Error`).
- Esquema `MiCompraVista` en `components.schemas`.
- `tests/api/docs.test.ts` ya exige que la especificación cubra cada ruta implementada.
- La colección de Postman suma "Mis compras".
