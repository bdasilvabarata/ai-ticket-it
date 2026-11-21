# Contrato de API: Chat de la compra (011)

Base `/api`, JSON, usuario por `X-Usuario-Id`. Todos los errores tienen el formato único
`{ "error": { "codigo", "mensaje", "detalles"? } }` (constitución, principio V). Los tipos están en
`shared/src/mensaje.ts` ([data-model.md](../data-model.md#tipos-compartidos-sharedsrcmensajets)).

## Endpoints

| Método y ruta | Quién | Respuesta |
|---|---|---|
| `GET /compras/:compraId/mensajes` | su comprador o el organizador de su evento | `200 ChatDeLaCompraVista` |
| `POST /compras/:compraId/mensajes` | su comprador o el organizador de su evento | `201 MensajeVista` |

Valen los dos en cualquier estado de la compra (también una pendiente vencida) y con el evento
realizado. No hay ningún 409.

## `GET /api/compras/:compraId/mensajes`

Devuelve la conversación entera, del mensaje más viejo al más nuevo, y el encabezado de la compra
con su estado al día. Es una lectura: no toma el cerrojo y no guarda nada, ni siquiera el
vencimiento de una pendiente.

| # | Caso | Status | Código | Mensaje |
|---|---|---|---|---|
| 1 | sin `X-Usuario-Id` o usuario inexistente | 401 | `USUARIO_NO_IDENTIFICADO` | (el de la 001) |
| 2 | `compraId` con formato inválido | 400 | `ENTRADA_INVALIDA` | detalle en `params.compraId` |
| 3 | la compra no existe | 404 | `COMPRA_NO_ENCONTRADA` | No existe la compra. |
| 4 | no es su comprador ni el organizador de su evento | 403 | `SIN_PERMISO` | Solo el comprador y el organizador del evento pueden ver y escribir en el chat de esta compra. |

### Ejemplo (seed, Lucía)

```http
GET /api/compras/compra-martin-festival-vip/mensajes
X-Usuario-Id: usuario-lucia
```

```json
{
  "compra": {
    "id": "compra-martin-festival-vip",
    "evento": { "id": "evento-festival-sonidos-del-sur", "nombre": "Festival Sonidos del Sur" },
    "tipoEntrada": { "id": "tipo-festival-sonidos-del-sur-vip", "nombre": "VIP" },
    "cantidad": 2,
    "estado": "CONFIRMADA"
  },
  "otraParte": { "id": "usuario-martin", "nombre": "Martín", "apellido": "Benítez", "rol": "comprador" },
  "mensajes": [
    {
      "numero": 1,
      "autor": { "id": "usuario-martin", "nombre": "Martín", "apellido": "Benítez", "rol": "comprador" },
      "texto": "Hola, ¿la entrada VIP incluye estacionamiento?",
      "enviadoEn": "<alta + 10 min, ISO UTC>",
      "enviadoEnLocal": "<YYYY-MM-DDTHH:mm>"
    },
    {
      "numero": 2,
      "autor": { "id": "usuario-lucia", "nombre": "Lucía", "apellido": "Álvarez", "rol": "organizador" },
      "texto": "¡Hola, Martín! Sí: con la entrada VIP tenés lugar en el estacionamiento del predio. Mostrá tu código en la barrera.",
      "enviadoEn": "…",
      "enviadoEnLocal": "…"
    },
    { "numero": 3, "autor": { "id": "usuario-martin", "…": "…" }, "texto": "¡Genial, gracias!", "…": "…" }
  ]
}
```

Si la pide Martín, la respuesta es la misma salvo `otraParte`, que pasa a ser
`{ "id": "usuario-lucia", "nombre": "Lucía", "apellido": "Álvarez", "rol": "organizador" }`. La
respuesta nunca trae códigos de entradas, historial, total ni `compradorId`.

## `POST /api/compras/:compraId/mensajes`

Cuerpo `DatosMensaje`:

```json
{ "texto": "¿A qué hora abren las puertas?" }
```

- `texto`: string obligatorio. Se recorta (espacios y saltos de línea al principio y al final) y,
  ya recortado, tiene que tener entre 1 y 500 caracteres. Los saltos de línea internos se
  conservan.
- Las claves desconocidas (`autorId`, `enviadoEn`, `numero`…) se descartan: el autor es el usuario
  de `X-Usuario-Id` y la fecha es la del reloj del servidor.

Corre bajo el cerrojo del evento de la compra y lee el reloj adentro. Antes registra los
vencimientos de las pendientes vencidas del evento (esta compra u otras) y el cupo que vuelve, como
cualquier escritura de la 006. Después guarda el mensaje al final de la conversación. El mensaje en
sí no cambia el estado, el historial, las entradas, el total ni el cupo.

| # | Caso | Status | Código | Detalle / mensaje |
|---|---|---|---|---|
| 1 | sin usuario | 401 | `USUARIO_NO_IDENTIFICADO` | |
| 2 | `compraId` inválido | 400 | `ENTRADA_INVALIDA` | `params.compraId` |
| 2 | `texto` faltante, `null`, de otro tipo, vacío o de solo espacios | 400 | `ENTRADA_INVALIDA` | `body.texto`: "Es obligatorio." |
| 2 | `texto` de más de 500 caracteres (recortado) | 400 | `ENTRADA_INVALIDA` | `body.texto`: "Debe tener como máximo 500 caracteres." |
| 3 | la compra no existe | 404 | `COMPRA_NO_ENCONTRADA` | No existe la compra. |
| 4 | no es una de las dos partes | 403 | `SIN_PERMISO` | (el mismo del `GET`) |

Ningún rechazo guarda nada. Un 403 tampoco registra vencimientos.

Si llegan dos mensajes a la vez, o un mensaje junto con un pago, una cancelación, un uso o un
reembolso de la misma compra, el servidor los procesa uno detrás del otro y se conservan todos.

### Ejemplo

```http
POST /api/compras/compra-martin-festival-vip/mensajes
X-Usuario-Id: usuario-martin
Content-Type: application/json

{ "texto": "  ¿A qué hora abren las puertas?  " }
```

```json
{
  "numero": 4,
  "autor": { "id": "usuario-martin", "nombre": "Martín", "apellido": "Benítez", "rol": "comprador" },
  "texto": "¿A qué hora abren las puertas?",
  "enviadoEn": "<ahora>",
  "enviadoEnLocal": "<ahora local>"
}
```

## Endpoints existentes

Ninguno cambia: `CompraVista`, `MiCompraVista` y `CompraDelEventoVista` no suman los mensajes. La
conversación solo se lee por `GET …/mensajes`.

## OpenAPI y Postman

- `backend/src/docs/openapi.json`:
  - el path `/compras/{compraId}/mensajes`, con `get` y `post` y sus respuestas;
  - los esquemas `DatosMensaje`, `RolEnLaCompra`, `ParteDeLaCompraVista`, `MensajeVista` y
    `ChatDeLaCompraVista`.
  - `tests/api/docs.test.ts` verifica las rutas nuevas.
- Postman suma estos pedidos:
  - "Chat de la compra (Martín, Festival)";
  - "Chat de la compra (Lucía, organizadora)";
  - "Enviar mensaje (Martín)";
  - "Enviar mensaje vacío → 400";
  - "Chat de la compra como Sofía → 403".
