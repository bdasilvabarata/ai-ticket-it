# Contrato de API: Cancelar compra con reembolso (009)

Base `/api`, JSON, usuario por `X-Usuario-Id`, errores con el formato único
`{ "error": { "codigo", "mensaje", "detalles"? } }` (constitución, principio V). Los tipos están en
`shared/src/compra.ts` ([data-model.md](../data-model.md#vistas-compartidas-sharedsrccompra-ts)).

## Endpoints

| Método y ruta | Quién | Cambio | Respuesta |
|---|---|---|---|
| `POST /compras/:compraId/cancelacion` | su comprador | **amplía** (006): también una `CONFIRMADA` | `200 CompraVista` |
| `POST /compras/:compraId/reembolso` | el organizador del evento | **nuevo** | `200 CompraDelEventoVista` |
| `GET /compras/:compraId` · `GET /compras` · `GET /eventos/:eventoId/mis-compras` · `GET /eventos/:eventoId/compras` | (sin cambios) | las vistas suman campos | — |

Los dos `POST` van sin cuerpo (si viene uno, se ignora) y corren bajo el cerrojo del evento de la
compra, con el reloj leído adentro.

## `POST /api/compras/:compraId/cancelacion`

Cancela la compra entera. Una `PENDIENTE` sigue como en la 006. Una `CONFIRMADA` sin entradas
usadas, antes del inicio del evento: pasa a `CANCELADA` (autor el comprador, hora del servidor),
cada entrada queda `CANCELADA`, el cupo de su tipo sube `cantidad` y, si `total > 0`, queda con el
reembolso pendiente.

Orden de los chequeos:

| # | Caso | Status | Código | Mensaje |
|---|---|---|---|---|
| 1 | sin `X-Usuario-Id` o usuario inexistente | 401 | `USUARIO_NO_IDENTIFICADO` | (el de la 001) |
| 2 | `compraId` con formato inválido | 400 | `ENTRADA_INVALIDA` | detalle en `params.compraId` |
| 3 | la compra no existe | 404 | `COMPRA_NO_ENCONTRADA` | No existe la compra. |
| 4 | no es su comprador (también el organizador) | 403 | `SIN_PERMISO` | Solo quien hizo la compra puede verla o pagarla. |
| 5 | `PENDIENTE` vencida (al día) | 409 | `COMPRA_VENCIDA` | La compra venció: pasaron 15 minutos sin pagarla. |
| 6 | `CONFIRMADA` y el evento empezó (`ahora >= fechaHora`, inclusive) | 409 | `EVENTO_REALIZADO` | El evento ya empezó: ya no se puede cancelar la compra. |
| 7 | `UTILIZADA` (empiece o no el evento) | 409 | `TRANSICION_INVALIDA` | Ya se usó una entrada de esta compra: no se puede cancelar. |
| 7 | `CANCELADA` | 409 | `TRANSICION_INVALIDA` | La compra ya está cancelada. |
| 7 | `REEMBOLSADA` | 409 | `TRANSICION_INVALIDA` | La compra ya fue reembolsada. |

Ningún rechazo cambia la compra, sus entradas, el cupo ni el historial.

### Ejemplo (seed, Martín, "Festival Sonidos del Sur")

```http
POST /api/compras/compra-martin-festival-vip/cancelacion
X-Usuario-Id: usuario-martin
```

```json
{
  "id": "compra-martin-festival-vip",
  "compradorId": "usuario-martin",
  "evento": { "id": "evento-festival-sonidos-del-sur", "nombre": "Festival Sonidos del Sur", "realizado": false, "…": "…" },
  "tipoEntrada": { "id": "tipo-festival-sonidos-del-sur-vip", "nombre": "VIP" },
  "cantidad": 2,
  "total": 240000,
  "estado": "CANCELADA",
  "venceEn": null,
  "venceEnLocal": null,
  "historial": [
    { "estado": "PENDIENTE", "autor": { "tipo": "usuario", "usuarioId": "usuario-martin" }, "…": "…" },
    { "estado": "CONFIRMADA", "autor": { "tipo": "usuario", "usuarioId": "usuario-martin" }, "…": "…" },
    { "estado": "CANCELADA", "autor": { "tipo": "usuario", "usuarioId": "usuario-martin" }, "fechaHora": "<ahora>", "fechaHoraLocal": "<ahora local>" }
  ],
  "entradas": [],
  "entradasUsadas": 0,
  "canceladaDesde": "CONFIRMADA",
  "reembolso": { "estado": "pendiente", "monto": 240000 },
  "cancelable": false,
  "motivoNoCancelable": "cancelada"
}
```

Después, `GET /api/eventos/evento-festival-sonidos-del-sur` muestra el cupo de VIP en 50 (48 + 2),
también en el catálogo y para cualquier usuario, y `GET /api/eventos/:id/mis-compras` de Martín
vuelve a dar `restantes` 4 para los tipos pagos.

## `POST /api/compras/:compraId/reembolso`

El organizador confirma que devolvió la plata de una compra `CANCELADA` con reembolso pendiente: pasa
a `REEMBOLSADA` (autor el organizador, hora del servidor). No cambia el cupo ni las entradas. Sin
plazo: también con el evento realizado.

| # | Caso | Status | Código | Mensaje |
|---|---|---|---|---|
| 1 | sin usuario | 401 | `USUARIO_NO_IDENTIFICADO` | |
| 2 | `compraId` con formato inválido | 400 | `ENTRADA_INVALIDA` | detalle en `params.compraId` |
| 3 | la compra no existe | 404 | `COMPRA_NO_ENCONTRADA` | No existe la compra. |
| 4 | no organiza el evento (también el comprador) | 403 | `SIN_PERMISO` | Solo el organizador puede modificar este evento. |
| 5 | ya `REEMBOLSADA` | 409 | `TRANSICION_INVALIDA` | El reembolso de esta compra ya se confirmó. |
| 5 | sin reembolso pendiente (pendiente, confirmada, utilizada, cancelada sin pagar o vencida, gratis) | 409 | `TRANSICION_INVALIDA` | Esta compra no tiene un reembolso pendiente. |

Dos confirmaciones simultáneas: una responde 200 y la otra 409 "ya se confirmó"; el historial suma
un único `REEMBOLSADA`.

### Ejemplo (seed, Lucía, "Maratón Ciudad 10K")

```http
POST /api/compras/compra-diego-maraton-inscripcion/reembolso
X-Usuario-Id: usuario-lucia
```

```json
{
  "id": "compra-diego-maraton-inscripcion",
  "comprador": { "id": "usuario-diego", "nombre": "Diego", "apellido": "Fernández" },
  "tipoEntrada": { "id": "tipo-maraton-10k-inscripcion", "nombre": "Inscripción" },
  "cantidad": 1,
  "total": 30000,
  "estado": "REEMBOLSADA",
  "creadaEn": "…",
  "creadaEnLocal": "…",
  "venceEn": null,
  "venceEnLocal": null,
  "canceladaPor": "usuario",
  "canceladaDesde": "CONFIRMADA",
  "reembolso": { "estado": "confirmado", "monto": 30000 },
  "entradasUsadas": 0
}
```

## Cambios en las vistas existentes (aditivos)

| Vista | Campos | Notas |
|---|---|---|
| `CompraVista` (`GET /compras/:id`, respuestas de pago/cancelación, `mis-compras`) | `canceladaDesde`, `reembolso`, `cancelable`, `motivoNoCancelable` | al día con el reloj del servidor, sin guardar |
| `MiCompraVista` (`GET /compras`) | `canceladaDesde`, `reembolso`; `canceladaPor` también en `REEMBOLSADA` | sin `cancelable` (no hay botón) |
| `CompraDelEventoVista` (`GET /eventos/:id/compras`) | `canceladaDesde`, `reembolso`; `canceladaPor` también en `REEMBOLSADA` | sin códigos, como en la 008. "Confirmar reembolso" ⇔ `reembolso.estado === "pendiente"` |
| `EntradaDelEventoVista` (`GET/POST …/entradas/:codigo`) | (sin campos nuevos) | una entrada de una compra cancelada o reembolsada viene con `estado: "CANCELADA"`; el uso → 409 `TRANSICION_INVALIDA` "La compra de esta entrada está cancelada." |

`motivoNoCancelable` por estado (al día): `PENDIENTE` → `null`; `CONFIRMADA` → `null` antes del
inicio y `"evento-empezado"` desde el inicio; `UTILIZADA` → `"entrada-usada"`; `CANCELADA` →
`"cancelada"`; `REEMBOLSADA` → `"reembolsada"`.

`resumenPorTipo` no cambia de forma: las entradas de una cancelada no cuentan en `vendidas` ni en
`usadas`, y vuelven en `disponibles`.

## OpenAPI y Postman

- `backend/src/docs/openapi.json`: el `POST …/cancelacion` amplía su descripción y sus 409
  (`EVENTO_REALIZADO` y los tres `TRANSICION_INVALIDA`); `POST /compras/{compraId}/reembolso` nuevo
  con sus respuestas; los esquemas `MotivoNoCancelable`, `ReembolsoVista` y los campos nuevos de
  `CompraVista`, `MiCompraVista` y `CompraDelEventoVista`. `tests/api/docs.test.ts` verifica la ruta
  nueva.
- Postman: "Cancelar compra confirmada (Martín, Festival)", "Cancelar compra utilizada (Martín,
  Peña) → 409", "Confirmar reembolso (Lucía, Maratón, Diego)", "Confirmar reembolso ya confirmado
  (Valentina) → 409" y "Confirmar reembolso como comprador (Diego) → 403".
