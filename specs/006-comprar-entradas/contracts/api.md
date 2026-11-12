# Contrato de API: Comprar entradas (006)

Amplía los contratos de la 001, la 004 y la 005: mismas convenciones, mismo formato de error y
las mismas fechas (instante ISO UTC + hora de pared de Buenos Aires `…Local`; "realizado" y
"vencida" según el reloj del servidor). Los tipos salen de `@ai-ticket-it/shared`
([data-model.md](../data-model.md), "Tipos compartidos"). Se documenta también en
`backend/src/docs/openapi.json` (tag nuevo **Compras**) y en la colección de Postman.

## Endpoints

| Método y ruta | Usuario | Respuesta | Errores |
|---|---|---|---|
| `POST /api/eventos/:eventoId/compras` **(nuevo)** | sí | `201 CompraVista` (`PENDIENTE`) | `401` · `400` · `404 EVENTO_NO_ENCONTRADO` · `409` |
| `GET /api/eventos/:eventoId/mis-compras` **(nuevo)** | sí | `200 MisComprasDelEventoVista` | `401` · `400` · `404 EVENTO_NO_ENCONTRADO` |
| `GET /api/compras/:compraId` **(nuevo)** | sí (solo su comprador) | `200 CompraVista` | `401` · `400` · `404 COMPRA_NO_ENCONTRADA` · `403` |
| `POST /api/compras/:compraId/pago` **(nuevo)** | sí (solo su comprador) | `200 CompraVista` (`CONFIRMADA`) | `401` · `400` · `404 COMPRA_NO_ENCONTRADA` · `403` · `409` |
| `GET /api/eventos` · `GET /api/eventos/:eventoId` **(cambia el valor)** | no | el `cupo` de cada tipo y `agotado` están **al día** | los de la 005 |

### `POST /api/eventos/:eventoId/compras`

Cuerpo (`DatosCompra`):

| Campo | Regla | Error (detalle en `body.<campo>`) |
|---|---|---|
| `tipoEntradaId` | id con forma válida, de un tipo **de ese evento** | "Es obligatorio." · "Debe ser un identificador válido." · inexistente o de otro evento → "No existe el tipo de entrada en este evento." |
| `cantidad` | entero de 1 a 4 | "Es obligatorio." · 0, negativa, decimal, texto o > 4 → "Debe ser un entero entre 1 y 4." |

Las claves desconocidas (por ejemplo `precio` o `total`) se ignoran: el total lo calcula el
servidor.

Reglas, en este orden (todas bajo el cerrojo del evento, con el evento y las compras releídos y
un único `ahora`):

1. vence las compras pendientes vencidas del evento y devuelve su cupo;
2. el tipo existe en el evento (400);
3. el evento no se realizó (`ahora < fechaHora`) → si no, `409 EVENTO_REALIZADO`;
4. el usuario no es el organizador → si no, `409 COMPRA_PROPIO_EVENTO`;
5. no supera su tope por persona → si no, `409 TOPE_POR_PERSONA`;
6. `cantidad ≤ cupo` del tipo → si no, `409 CUPO_INSUFICIENTE`;
7. descuenta el cupo y registra la compra `PENDIENTE` con total `precio × cantidad`.

**Tope por persona**: contando sus compras **vigentes** de ese evento (`PENDIENTE` no vencidas y
`CONFIRMADA`):
- tipo pago (precio vigente > 0): sus entradas de compras con total > 0 más la `cantidad` no
  pueden pasar de 4;
- tipo gratis (precio vigente 0): sus entradas de compras de **ese tipo** con total 0 más la
  `cantidad` no pueden pasar de 1 (aparte de las 4).

Respuesta `201`:

```json
{
  "id": "5d0f…",
  "compradorId": "usuario-sofia",
  "evento": {
    "id": "evento-festival-sonidos-del-sur",
    "nombre": "Festival Sonidos del Sur",
    "fechaHora": "2026-12-12T17:00:00.000Z",
    "fechaHoraLocal": "2026-12-12T14:00",
    "realizado": false
  },
  "tipoEntrada": { "id": "tipo-festival-sonidos-del-sur-vip", "nombre": "VIP" },
  "cantidad": 2,
  "total": 240000,
  "estado": "PENDIENTE",
  "creadaEn": "2026-11-12T18:20:00.000Z",
  "venceEn": "2026-11-12T18:35:00.000Z",
  "venceEnLocal": "2026-11-12T15:35",
  "historial": [
    {
      "estado": "PENDIENTE",
      "autor": { "tipo": "usuario", "usuarioId": "usuario-sofia" },
      "fechaHora": "2026-11-12T18:20:00.000Z",
      "fechaHoraLocal": "2026-11-12T15:20"
    }
  ]
}
```

### `GET /api/eventos/:eventoId/mis-compras`

Ejemplo: Martín en el Festival (tiene 2 VIP confirmadas y ninguna pendiente).

Del usuario actual, con un `ahora` por pedido y sin cerrojo:

```json
{
  "pendientes": [],
  "restantesPorTipo": [
    { "tipoEntradaId": "tipo-festival-sonidos-del-sur-general", "restantes": 2 },
    { "tipoEntradaId": "tipo-festival-sonidos-del-sur-vip", "restantes": 2 },
    { "tipoEntradaId": "tipo-festival-sonidos-del-sur-backstage", "restantes": 2 }
  ]
}
```

- `pendientes`: no incluye las vencidas, las confirmadas, las canceladas ni las de otros
  usuarios.
- `restantesPorTipo`: un elemento por cada tipo del evento, en su orden. Es solo el tope (el cupo
  está en la `EventoVista`): la app usa `min(cupo, restantes)`. Para el organizador del evento,
  `0` en todos. Con el evento realizado se calcula igual (la app no ofrece comprar).

### `GET /api/compras/:compraId`

La compra con su estado **al día**: una `PENDIENTE` vencida se ve `CANCELADA`, con un último
cambio del sistema fechado en el vencimiento, aunque todavía no se haya guardado así. Solo la ve
su comprador (`403 SIN_PERMISO` "Solo quien hizo la compra puede verla o pagarla.").

### `POST /api/compras/:compraId/pago`

Sin cuerpo (si viene uno, se ignora). Pago simulado: siempre se acepta si la compra se puede
pagar. Bajo el cerrojo del evento de la compra, en este orden:

1. vence las compras pendientes vencidas del evento (también esta, si venció);
2. `403` si el usuario no es el comprador;
3. `409 COMPRA_VENCIDA` si venció (a los 15 minutos exactos del alta, ya venció);
4. `409 TRANSICION_INVALIDA` si no está `PENDIENTE` (por ejemplo, ya `CONFIRMADA`);
5. `PENDIENTE → CONFIRMADA`, con un cambio por el comprador en `ahora`.

Que el evento ya haya empezado **no** impide pagar: una compra pendiente creada antes del inicio
se paga hasta que vence (research R9). Lo que el inicio impide es registrar compras nuevas.

Respuesta `200`: la `CompraVista` `CONFIRMADA`, con `venceEn: null`, `venceEnLocal: null` y el
historial `[PENDIENTE, CONFIRMADA]`. Pagar dos veces la misma compra da `409
TRANSICION_INVALIDA` la segunda vez (no es idempotente: la app consulta el estado real).

### Lecturas de eventos al día

`GET /api/eventos` y `GET /api/eventos/:eventoId` muestran el `cupo` de cada tipo (y `agotado`)
sumando las entradas de las compras pendientes **vencidas**, aunque nadie las haya consultado.
La forma de las vistas no cambia.

## Errores de esta feature

| Status | `codigo` | Mensaje | Cuándo |
|---|---|---|---|
| 400 | `ENTRADA_INVALIDA` | "Los datos enviados no son válidos." | `cantidad` o `tipoEntradaId` inválidos o tipo que no es del evento (`detalles` en `body.*`); ids de la ruta mal formados (`params.*`) |
| 401 | `USUARIO_NO_IDENTIFICADO` | "Tenés que indicar un usuario válido." | sin `X-Usuario-Id` válido |
| 403 | `SIN_PERMISO` | "Solo quien hizo la compra puede verla o pagarla." | ver o pagar una compra ajena |
| 404 | `EVENTO_NO_ENCONTRADO` | "No existe el evento." | alta o mis-compras de un evento inexistente |
| 404 | `COMPRA_NO_ENCONTRADA` | "No existe la compra." | ver o pagar una compra inexistente |
| 409 | `EVENTO_REALIZADO` | "El evento ya se realizó: no se pueden comprar entradas." | alta con el evento empezado, según el reloj del servidor (el pago no lo usa) |
| 409 | `COMPRA_PROPIO_EVENTO` | "No podés comprar entradas de un evento que organizás." | el organizador compra en su evento |
| 409 | `TOPE_POR_PERSONA` | ver [data-model.md](../data-model.md) (dice cuántas puede comprar todavía) | supera 4 pagas por evento o 1 por tipo gratis |
| 409 | `CUPO_INSUFICIENTE` | "Quedan N entradas de «Tipo»." · "Queda 1 entrada de «Tipo»." · "No quedan entradas de «Tipo»." | `cantidad` > cupo disponible |
| 409 | `COMPRA_VENCIDA` | "La compra venció: pasaron 15 minutos sin pagarla." | pagar una compra vencida |
| 409 | `TRANSICION_INVALIDA` | "La compra no está pendiente de pago." | pagar una compra que no está `PENDIENTE` |

Todo rechazo deja el cupo y las compras sin cambios (salvo la materialización de los
vencimientos, que refleja lo que ya había pasado).

## Ejemplos (datos de ejemplo, reloj real)

| Pedido (`X-Usuario-Id`) | Resultado |
|---|---|
| Sofía: `POST /eventos/evento-festival-sonidos-del-sur/compras { "tipoEntradaId": "tipo-festival-sonidos-del-sur-vip", "cantidad": 2 }` | `201`, total 240000; el detalle muestra VIP con cupo 48 |
| Diego: `… { "tipoEntradaId": "tipo-festival-sonidos-del-sur-backstage", "cantidad": 3 }` | `201`; Backstage queda en 0 ("Agotado") |
| Valentina: `… backstage, "cantidad": 1` (después del anterior) | `409 CUPO_INSUFICIENTE` "No quedan entradas de «Backstage»." |
| Lucía (organizadora): `… vip, 1` | `409 COMPRA_PROPIO_EVENTO` |
| Martín (ya tiene 2 VIP confirmadas): `… general, 3` | `409 TOPE_POR_PERSONA` "Podés comprar 2 entradas más de tipos pagos de este evento." |
| Sofía: `POST /eventos/evento-maraton-10k/compras { "tipoEntradaId": "tipo-maraton-10k-carrera-kids", "cantidad": 1 }` y otra igual | `201` con total 0; la segunda, `409 TOPE_POR_PERSONA` |
| Sofía: `POST /eventos/evento-noche-de-risas/compras …` | `409 EVENTO_REALIZADO` |
| Sofía: `… "cantidad": 0` · `-1` · `1.5` · `"2"` · `5` | `400` con detalle en `body.cantidad` |
| Sofía: `… "tipoEntradaId": "tipo-hamlet-platea"` sobre el Festival | `400` con detalle en `body.tipoEntradaId` |
| Sofía: `POST /eventos/evento-inexistente/compras …` | `404 EVENTO_NO_ENCONTRADO` |
| Sofía: `POST /compras/<id>/pago` | `200` `CONFIRMADA`; repetido → `409 TRANSICION_INVALIDA` |
| Diego: `POST /compras/<id de Sofía>/pago` | `403 SIN_PERMISO` |
| Sofía: `POST /compras/compra-diego-festival-general/pago` | `403` (no es suya); Diego → `409 COMPRA_VENCIDA` |
