# Contrato de API: Paginación (013)

Base `/api`, JSON. Todos los errores tienen el formato único
`{ "error": { "codigo", "mensaje", "detalles"? } }` (constitución, principio V). Los tipos están en
[data-model.md](../data-model.md).

## Reglas comunes de las listas paginadas

- **Parámetro `pagina`** (query):
  - es opcional y, si falta, se toma la 1;
  - tiene que ser un entero ≥ 1 escrito con dígitos;
  - si no (`0`, `-1`, `1.5`, `abc`, vacío o repetido), responde `400 ENTRADA_INVALIDA` con el
    detalle `{ "campo": "query.pagina", "mensaje": "Debe ser un entero mayor o igual a 1." }`.
- **Tamaño**: 10, lo fija el servidor. Un `tamano` o un `limite` en la query se ignoran.
- **Página posterior a la última**: no es un error. Responde la última que existe, con su número en
  `pagina.numero`.
- **Lista vacía**: `pagina = { numero: 1, tamano: 10, totalElementos: 0, totalPaginas: 0 }`, sin
  elementos.
- **Orden y filtros**: se aplican sobre **todos** los elementos antes de cortar la página, con el
  desempate estable de cada lista.

| Método y ruta | Quién | Respuesta | Cambio |
|---|---|---|---|
| `GET /eventos` | público | `200 CatalogoVista` | suma `pagina` en la query y en la respuesta |
| `GET /eventos/:eventoId/compras` | el organizador del evento | `200 ComprasDelEventoVista` | suma `pagina`, `estado` y `sinResponder` en la query, y `pagina` y `cantidadCompras` en la respuesta |
| `GET /eventos/:eventoId/resenias-del-organizador` | público | `200 PaginaDeReseniasVista` | **paginada** (antes devolvía todas) |
| `GET /eventos/:eventoId/resenias-del-organizador/resumen` | público | `200 ReseniasDelOrganizadorVista` | **nueva**: las 3 más recientes, con el puntaje de todas |

Ninguna otra ruta cambia. `GET /compras` ("Mis compras") sigue devolviendo todas (FR-023).

## `GET /api/eventos?texto=&categoriaId=&orden=&sentido=&pagina=`

Los demás parámetros y su validación no cambian (005). Rechazos, en orden:

| # | Caso | Status | Detalle |
|---|---|---|---|
| 1 | `texto`, `orden`, `sentido` o `pagina` inválidos | 400 `ENTRADA_INVALIDA` | un detalle por campo (`query.pagina` es el nuevo) |
| 2 | `categoriaId` inexistente | 400 `ENTRADA_INVALIDA` | `query.categoriaId` (sin cambios) |

```http
GET /api/eventos?orden=fecha&sentido=asc&pagina=2
```

```json
{
  "eventos": [ { "id": "evento-…", "nombre": "…", "…": "…" }, { "id": "evento-…", "…": "…" } ],
  "pagina": { "numero": 2, "tamano": 10, "totalElementos": 12, "totalPaginas": 2 },
  "hayEventosProximos": true
}
```

- `hayEventosProximos` sigue siendo el de **todos** los eventos próximos, antes del texto, la
  categoría y la página.
- Con `pagina=5` y 12 eventos, responde la página 2 con `"numero": 2`.

## `GET /api/eventos/:eventoId/compras?pagina=&estado=&sinResponder=`

Solo para el organizador del evento, sin códigos (008). Parámetros nuevos:

- `estado`: `PENDIENTE` · `CONFIRMADA` · `UTILIZADA` · `CANCELADA` · `REEMBOLSADA`. Se compara con
  el estado **al día** (una pendiente vencida es `CANCELADA`). Si falta, se toman todos.
- `sinResponder`: `true` · `false` (por defecto `false`). Con `true`, solo las compras cuyo último
  mensaje es del comprador.
- Si llegan los dos, se aplican juntos (y).

Rechazos, en orden:

| # | Caso | Status | Código / detalle |
|---|---|---|---|
| 1 | sin `X-Usuario-Id` o usuario inexistente | 401 | `USUARIO_NO_IDENTIFICADO` |
| 2 | `eventoId`, `pagina`, `estado` o `sinResponder` inválidos | 400 | `ENTRADA_INVALIDA`: `params.eventoId`, `query.pagina`, `query.estado` ("Debe ser uno de los estados de una compra."), `query.sinResponder` ("Debe ser true o false.") |
| 3 | el evento no existe | 404 | `EVENTO_NO_ENCONTRADO` |
| 4 | el usuario no lo organiza | 403 | `SIN_PERMISO` |

```http
GET /api/eventos/evento-festival-sonidos-del-sur/compras?estado=CANCELADA&pagina=1
X-Usuario-Id: usuario-lucia
```

```json
{
  "evento": { "id": "evento-festival-sonidos-del-sur", "nombre": "Festival Sonidos del Sur", "fechaHoraLocal": "…", "realizado": false },
  "ventanaDeUso": { "…": "…" },
  "resumenPorTipo": [ { "tipoEntrada": { "id": "…", "nombre": "General" }, "disponibles": 0, "pendientes": 0, "vendidas": 0, "usadas": 0 } ],
  "comprasConMensajesSinResponder": 1,
  "cantidadCompras": 12,
  "compras": [ { "id": "compra-…", "estado": "CANCELADA", "…": "…" } ],
  "pagina": { "numero": 1, "tamano": 10, "totalElementos": 4, "totalPaginas": 1 }
}
```

Los valores son ilustrativos. Lo que cuenta es esto:

- `ventanaDeUso`, `resumenPorTipo`, `comprasConMensajesSinResponder` y `cantidadCompras` son de
  **todas** las compras del evento y no cambian con `pagina`, `estado` ni `sinResponder`.
- `pagina.totalElementos` es el de la lista **filtrada**.
- La operación es una lectura: sin cerrojo y sin guardar nada (008).

## `GET /api/eventos/:eventoId/resenias-del-organizador?pagina=`

Es público: no exige `X-Usuario-Id` y, si llega, se ignora. Es una lectura sin cerrojo. Devuelve
las reseñas de **todos** los eventos del organizador, con `creadaEn` descendente y desempate por
`id` (012), de a 10.

| # | Caso | Status | Detalle |
|---|---|---|---|
| 1 | `eventoId` o `pagina` inválidos | 400 `ENTRADA_INVALIDA` | `params.eventoId`, `query.pagina` |
| 2 | el evento no existe | 404 `EVENTO_NO_ENCONTRADO` | |

```json
{
  "organizador": { "id": "usuario-martin", "nombre": "Martín", "apellido": "Benítez", "puntaje": 4.7272727272727275, "cantidadResenias": 11 },
  "resenias": [ { "id": "resenia-…", "puntuacion": 5, "comentario": "…", "autor": { "nombre": "…", "apellido": "…" }, "evento": { "id": "…", "nombre": "…" }, "creadaEn": "…", "creadaEnLocal": "…" } ],
  "pagina": { "numero": 1, "tamano": 10, "totalElementos": 11, "totalPaginas": 2 }
}
```

- `organizador` es igual en todas las páginas, en `/resumen`, en `EventoVista.organizador` y en la
  tarjeta del catálogo (FR-021, SC-005).
- `cantidadResenias` es igual a `pagina.totalElementos`.
- Sin compras, códigos ni el id del autor (012, FR-016).

## `GET /api/eventos/:eventoId/resenias-del-organizador/resumen` (nueva)

Es pública y tiene los mismos rechazos que la anterior, sin `pagina`. Devuelve la forma de la 012
(`ReseniasDelOrganizadorVista`): `organizador`, con el puntaje y la cantidad de **todas** las
reseñas, y `resenias` con las **3** más recientes (o todas, si tiene 3 o menos).

## OpenAPI y Postman

- `backend/src/docs/openapi.json`:
  - el parámetro `pagina` y el esquema `PaginaVista`, compartidos;
  - `estado` y `sinResponder` en Compras del evento;
  - `cantidadCompras`;
  - la ruta `/resumen` y `PaginaDeReseniasVista`.
- El test de docs ya exige que la especificación cubra cada ruta.
- Postman:
  - "Explorar — página 2";
  - "Compras del Festival — canceladas";
  - "Reseñas de Martín — página 2" y "Reseñas de Martín — resumen".
