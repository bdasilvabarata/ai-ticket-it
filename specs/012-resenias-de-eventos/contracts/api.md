# Contrato de API: Reseñas de eventos (012)

Base `/api`, JSON, usuario por `X-Usuario-Id`. Todos los errores tienen el formato único
`{ "error": { "codigo", "mensaje", "detalles"? } }` (constitución, principio V). Los tipos están en
`shared/src/resenia.ts` ([data-model.md](../data-model.md#vistas-sharedsrcreseniats-nuevo-y-sharedsrccomprats)).

## Endpoints

| Método y ruta | Quién | Respuesta |
|---|---|---|
| `POST /eventos/:eventoId/resenias` | un comprador con una compra `UTILIZADA` del evento | `201 ReseniaVista` |
| `GET /eventos/:eventoId/resenias-del-organizador` | público (sin usuario) | `200 ReseniasDelOrganizadorVista` |
| `GET /compras/:compraId` · `GET /compras` · `GET /eventos/:eventoId/mis-compras` | (sin cambios de acceso) | suman `resenia` y `puedeReseniar` en cada compra |

No hay `PUT`, `PATCH` ni `DELETE` de reseñas (FR-006b).

## `POST /api/eventos/:eventoId/resenias`

Cuerpo (`DatosResenia`):

```json
{ "puntuacion": 4, "comentario": "Muy buena organización" }
```

- `puntuacion`: obligatoria; número entero de 1 a 5.
- `comentario`: opcional. Se recorta; vacío o solo espacios = sin comentario (`null`); hasta 500
  caracteres después de recortar.
- El autor sale de `X-Usuario-Id` y la fecha, del reloj del servidor. Lo demás del cuerpo se
  ignora.

Corre bajo el cerrojo del evento (research R3). No cambia la compra ni el cupo.

| # | Caso | Status | Código | Mensaje |
|---|---|---|---|---|
| 1 | sin `X-Usuario-Id` o usuario inexistente | 401 | `USUARIO_NO_IDENTIFICADO` | (el de la 001) |
| 2 | `eventoId` con formato inválido; `puntuacion` ausente, no numérica, no entera o fuera de 1 a 5; `comentario` no string o de más de 500 caracteres | 400 | `ENTRADA_INVALIDA` | un detalle por campo: `params.eventoId`, `body.puntuacion` ("Es obligatorio." / "Debe ser un entero de 1 a 5."), `body.comentario` ("Debe tener como máximo 500 caracteres.") |
| 3 | el evento no existe | 404 | `EVENTO_NO_ENCONTRADO` | No existe el evento. |
| 4 | el usuario organiza el evento | 409 | `RESENIA_PROPIO_EVENTO` | No podés reseñar un evento que organizás. |
| 5 | no tiene ninguna compra `UTILIZADA` del evento | 409 | `SIN_COMPRA_UTILIZADA` | Solo podés reseñar un evento al que asististe (con una compra utilizada). |
| 6 | ya reseñó el evento (también un segundo pedido simultáneo) | 409 | `RESENIA_REPETIDA` | Ya reseñaste este evento. |

### Ejemplo (seed, Martín reseña la Peña)

```http
POST /api/eventos/evento-pena-en-la-rueda/resenias
X-Usuario-Id: usuario-martin
Content-Type: application/json

{ "puntuacion": 4, "comentario": "  Muy buena organización  " }
```

```json
{
  "id": "<uuid>",
  "eventoId": "evento-pena-en-la-rueda",
  "puntuacion": 4,
  "comentario": "Muy buena organización",
  "creadaEn": "<ahora, ISO UTC>",
  "creadaEnLocal": "<YYYY-MM-DDTHH:mm>"
}
```

## `GET /api/eventos/:eventoId/resenias-del-organizador`

Es público: no exige `X-Usuario-Id`. Si llega, se ignora. Lectura sin cerrojo.

Devuelve el organizador del evento con su puntaje y **todas** las reseñas de **todos** sus eventos
(próximos y realizados, también el que se mira). El orden es `creadaEn` descendente → `id`.

| # | Caso | Status | Código |
|---|---|---|---|
| 1 | `eventoId` con formato inválido | 400 | `ENTRADA_INVALIDA` (`params.eventoId`) |
| 2 | el evento no existe | 404 | `EVENTO_NO_ENCONTRADO` |

- `organizador.puntaje` va **sin redondear**, o `null` sin reseñas (nunca 0).
- `cantidadResenias` es igual a `resenias.length`. Coincide con `EventoVista.organizador` y con la
  tarjeta del catálogo (FR-018).
- Sin compras, códigos, totales, estados ni el id del autor (FR-016).

### Ejemplo (seed, cualquier evento de Martín)

```json
{
  "organizador": {
    "id": "usuario-martin", "nombre": "Martín", "apellido": "Benítez",
    "puntaje": 4.666666666666667, "cantidadResenias": 3
  },
  "resenias": [
    {
      "id": "resenia-valentina-jazz-en-el-patio",
      "puntuacion": 5,
      "comentario": "…",
      "autor": { "nombre": "Valentina", "apellido": "Gómez" },
      "evento": { "id": "evento-jazz-en-el-patio", "nombre": "Jazz en el Patio" },
      "creadaEn": "…", "creadaEnLocal": "…"
    }
  ]
}
```

Sin reseñas (Lucía, en el seed): `"puntaje": null, "cantidadResenias": 0, "resenias": []`.

## Cambios en las vistas de la compra

`CompraVista` (de `GET /compras/:compraId`, `mis-compras.pendientes`/`confirmadas` y las respuestas
de alta, pago y cancelación) y `MiCompraVista` (`GET /compras`) suman:

| Campo | Valor |
|---|---|
| `resenia` | `ReseniaVista \| null`: la del comprador en ese evento, solo si la compra está `UTILIZADA` |
| `puedeReseniar` | `boolean`: `UTILIZADA` y sin reseña de ese comprador y evento |

Nada se quita. Dos compras `UTILIZADA` del mismo evento muestran la misma `resenia`.
`CompraDelEventoVista` (organizador) no cambia.

## Documentación

- `backend/src/docs/openapi.json` suma las dos rutas, `DatosResenia`, `ReseniaVista`,
  `ReseniaDelOrganizadorVista`, `ReseniasDelOrganizadorVista` y los campos nuevos de `CompraVista` y
  `MiCompraVista`. `api/docs.test.ts` verifica la cobertura.
- La colección Postman suma "Reseñar evento" (Martín, Peña) y "Reseñas del organizador".
