# Contrato de API: Crear evento (004)

Este contrato amplía el de la 001 (`specs/001-base-backend/contracts/api.md`): mismas
convenciones, mismo formato de error, `X-Usuario-Id` y 100 kB de cuerpo máximo. Los tipos
salen de `@ai-ticket-it/shared` (ver [data-model.md](../data-model.md), "Vistas"). Todo se
documenta también en `backend/src/docs/openapi.json` (tags **Categorías**, **Eventos** y
**Tipos de entrada**) y en la colección de Postman.

## Fechas

- **Entrada**: `fechaHora` = `"YYYY-MM-DDTHH:mm"`, la fecha y hora de pared **en Buenos
  Aires**, sin segundos ni zona. Ejemplo: `"2026-12-01T20:00"` = `2026-12-01T23:00:00.000Z`.
  - Formato inválido o fecha inexistente (`2026-02-30`, `25:00`) → `400`, con detalle en
    `body.fechaHora`.
  - Bien formada pero no futura según el reloj del servidor → `409 FECHA_NO_FUTURA`.
- **Salida**: `fechaHora` (ISO UTC) y `fechaHoraLocal` (`"YYYY-MM-DDTHH:mm"` en Buenos
  Aires). La app muestra `fechaHoraLocal`.
- `realizado: true` cuando el reloj del servidor llegó a `fechaHora` (inclusive).

## Errores de esta feature

| Status | `codigo` | Mensaje (es) | Cuándo |
|---|---|---|---|
| 400 | `ENTRADA_INVALIDA` | "Los datos enviados no son válidos." + `detalles` | forma inválida (ver cada cuerpo) o `body.categoriaId` inexistente ("No existe la categoría.") |
| 401 | `USUARIO_NO_IDENTIFICADO` | (como en la 001) | endpoint que requiere usuario |
| 403 | `SIN_PERMISO` | "Solo el organizador puede modificar este evento." | el usuario actual no es el organizador |
| 404 | `EVENTO_NO_ENCONTRADO` | "No existe el evento." | — |
| 404 | `TIPO_ENTRADA_NO_ENCONTRADO` | "No existe el tipo de entrada en este evento." | inexistente o de otro evento |
| 409 | `EVENTO_REALIZADO` | "El evento ya se realizó: no se puede modificar." | toda escritura sobre un evento realizado o sus tipos |
| 409 | `FECHA_NO_FUTURA` | "La fecha y hora del evento deben ser futuras." | crear o editar con una fecha que no es futura |
| 409 | `NOMBRE_TIPO_ENTRADA_REPETIDO` | "Ya hay un tipo de entrada con ese nombre en el evento." | sin distinguir mayúsculas, tildes ni espacios de los extremos |
| 409 | `ULTIMO_TIPO_ENTRADA` | "El evento debe conservar al menos un tipo de entrada." | quitar el único tipo |
| 409 | `TIPO_ENTRADA_CON_COMPRAS` | "El tipo de entrada tiene compras: no se puede quitar." | toda compra cuenta, en cualquier estado |
| 409 | `EVENTO_CON_COMPRAS` | "El evento tiene compras: no se puede eliminar." | toda compra cuenta, en cualquier estado |

**Orden de los chequeos** (research R5):

```text
401 → 400 de forma → 404 evento → 403 → 404 tipo → 400 categoría → 409 EVENTO_REALIZADO → otros 409
```

El primero que falla es el que responde, y nada queda modificado (SC-004).

**Concurrencia** (FR-029): dos escrituras simultáneas sobre el mismo evento se procesan una
después de la otra, y la segunda ve el resultado de la primera. Las escrituras sobre eventos
distintos no se esperan.

## Reglas de los cuerpos (zod, `validations/`)

| Campo | Regla | Mensaje |
|---|---|---|
| `nombre` (evento) | string, `trim`, 1–100 | "Es obligatorio." / "Debe tener como máximo 100 caracteres." |
| `descripcion` (evento) | string opcional, `trim`, ≤ 2000, `""` por defecto | "Debe tener como máximo 2000 caracteres." |
| `categoriaId` | `idSchema` | "Debe ser un identificador válido." (y "No existe la categoría." desde el service) |
| `fechaHora` | `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/` y fecha real | "Debe ser una fecha y hora válidas (AAAA-MM-DDTHH:mm)." |
| `multimedia` | arreglo opcional (≤ 5) de URLs `http`/`https` (`trim`), `[]` por defecto | "Debe ser una URL http o https." (en `body.multimedia.<i>`) / "Puede tener como máximo 5 URLs." |
| `tiposEntrada` (solo en el POST del evento) | arreglo, ≥ 1 | "El evento necesita al menos un tipo de entrada." |
| `nombre` (tipo) | string, `trim`, 1–50 | "Es obligatorio." / "Debe tener como máximo 50 caracteres." |
| `descripcion` (tipo) | string opcional, `trim`, ≤ 300 | "Debe tener como máximo 300 caracteres." |
| `precio` | entero ≥ 0 | "Debe ser un entero mayor o igual a 0." |
| `cupo` (al crear el tipo) | entero ≥ 1 | "Debe ser un entero mayor o igual a 1." |
| `cupo` (al editar el tipo) | entero ≥ 0 | "Debe ser un entero mayor o igual a 0." |
| params `eventoId`, `tipoEntradaId` | `idSchema` | "Debe ser un identificador válido." |

- Un valor faltante, `null` o de otro tipo responde "Es obligatorio." (los obligatorios) o el
  mensaje de la regla.
- Las claves desconocidas se descartan. `organizadorId` en el cuerpo **se ignora** (FR-009).
- En el POST del evento, los detalles de los tipos van con su índice:
  `body.tiposEntrada.1.precio`.

## Endpoints

### `GET /api/categorias` — catálogo *(público)*

`200` → `CategoriaVista[]`, ordenadas por nombre.

```json
[{ "id": "categoria-conferencias", "nombre": "Conferencias", "descripcion": "Charlas, congresos y talleres." }]
```

### `GET /api/eventos/mios` — eventos del usuario actual *(requiere usuario)*

`200` → `EventoResumenVista[]`: solo los que organiza el usuario actual (FR-002). Primero
los próximos por `fechaHora` ascendente y después los realizados, del más reciente al más
antiguo (FR-004). Si no organiza ninguno, `[]`.

```json
[{
  "id": "evento-noche-de-rock",
  "nombre": "Noche de Rock en el Club",
  "categoria": { "id": "categoria-musica", "nombre": "Música" },
  "fechaHora": "2026-11-11T23:00:00.000Z",
  "fechaHoraLocal": "2026-11-11T20:00",
  "organizadorId": "usuario-lucia",
  "realizado": false,
  "cantidadTiposEntrada": 1
}]
```

Errores: `401`.

### `GET /api/eventos/:eventoId` — un evento *(público)*

Lo usan editar y la vista de solo lectura. La 005 lo reutiliza como detalle público,
**agregando** campos sin cambiar los existentes (research R8).

`200` → `EventoVista` (el resumen más `descripcion`, `multimedia` y `tiposEntrada`).

```json
{
  "id": "evento-festival-sonidos-del-sur",
  "nombre": "Festival Sonidos del Sur",
  "descripcion": "Un día entero de música con artistas de todo el país.",
  "categoria": { "id": "categoria-festivales", "nombre": "Festivales" },
  "fechaHora": "2026-12-10T17:00:00.000Z",
  "fechaHoraLocal": "2026-12-10T14:00",
  "multimedia": ["https://picsum.photos/seed/sonidos-del-sur/800/450"],
  "organizadorId": "usuario-lucia",
  "realizado": false,
  "cantidadTiposEntrada": 3,
  "tiposEntrada": [
    { "id": "tipo-festival-sonidos-del-sur-general", "nombre": "General", "descripcion": "Acceso al predio.", "precio": 45000, "cupo": 500 }
  ]
}
```

Errores: `400` (id mal formado), `404 EVENTO_NO_ENCONTRADO`.

### `POST /api/eventos` — crear *(requiere usuario)*

Cuerpo: `DatosNuevoEvento`.

```json
{
  "nombre": "Noche de Tango",
  "descripcion": "Milonga con orquesta en vivo.",
  "categoriaId": "categoria-musica",
  "fechaHora": "2026-12-01T20:00",
  "multimedia": ["https://example.com/tango.jpg"],
  "tiposEntrada": [
    { "nombre": "General", "precio": 15000, "cupo": 200 },
    { "nombre": "VIP", "descripcion": "Mesa preferencial.", "precio": 60000, "cupo": 30 }
  ]
}
```

`201` → `EventoVista`, con el usuario actual como `organizadorId` y UUIDs nuevos para el evento
y sus tipos.

Errores: `401`, `400`, `409 FECHA_NO_FUTURA`, `409 NOMBRE_TIPO_ENTRADA_REPETIDO`.

### `PUT /api/eventos/:eventoId` — editar datos *(requiere usuario; organizador)*

Cuerpo: `DatosEvento`, que **reemplaza** nombre, descripción, categoría, fecha y multimedia.
Los tipos no se tocan.

`200` → `EventoVista`.

Errores: `401`, `400`, `404 EVENTO_NO_ENCONTRADO`, `403`, `409 EVENTO_REALIZADO`,
`409 FECHA_NO_FUTURA`.

### `DELETE /api/eventos/:eventoId` — eliminar *(requiere usuario; organizador)*

`204`, sin cuerpo.

Errores: `401`, `400`, `404 EVENTO_NO_ENCONTRADO`, `403`, `409 EVENTO_REALIZADO`,
`409 EVENTO_CON_COMPRAS`.

### `POST /api/eventos/:eventoId/tipos-entrada` — agregar tipo *(requiere usuario; organizador)*

Cuerpo: `DatosTipoEntrada`, con cupo ≥ 1.

```json
{ "nombre": "Platea", "descripcion": "Butacas numeradas.", "precio": 0, "cupo": 100 }
```

`201` → `TipoEntradaVista`.

Errores: `401`, `400`, `404 EVENTO_NO_ENCONTRADO`, `403`, `409 EVENTO_REALIZADO`,
`409 NOMBRE_TIPO_ENTRADA_REPETIDO`.

### `PUT /api/eventos/:eventoId/tipos-entrada/:tipoEntradaId` — editar tipo *(requiere usuario; organizador)*

Cuerpo: `DatosTipoEntrada`, con el cupo **disponible** ≥ 0. Conservar el nombre propio (o
cambiarle solo las mayúsculas o tildes) se acepta.

`200` → `TipoEntradaVista`. Cambiar el precio no modifica el total de ninguna compra.

Errores: `401`, `400`, `404 EVENTO_NO_ENCONTRADO`, `403`, `404 TIPO_ENTRADA_NO_ENCONTRADO`,
`409 EVENTO_REALIZADO`, `409 NOMBRE_TIPO_ENTRADA_REPETIDO`.

### `DELETE /api/eventos/:eventoId/tipos-entrada/:tipoEntradaId` — quitar tipo *(requiere usuario; organizador)*

`204`, sin cuerpo.

Errores: `401`, `400`, `404 EVENTO_NO_ENCONTRADO`, `403`, `404 TIPO_ENTRADA_NO_ENCONTRADO`,
`409 EVENTO_REALIZADO`, `409 ULTIMO_TIPO_ENTRADA`, `409 TIPO_ENTRADA_CON_COMPRAS`.

## Rutas en Express

```text
/api/categorias            GET  /                       → CategoriaController.listar
/api/eventos               GET  /mios                   (requerirUsuario) → EventoController.listarMios
                           GET  /:eventoId              → EventoController.obtener
                           POST /                       (requerirUsuario) → EventoController.crear
                           PUT  /:eventoId              (requerirUsuario) → EventoController.actualizar
                           DELETE /:eventoId            (requerirUsuario) → EventoController.eliminar
/api/eventos/:eventoId/tipos-entrada   (Router con mergeParams, todas con requerirUsuario)
                           POST /                       → TipoEntradaController.crear
                           PUT  /:tipoEntradaId         → TipoEntradaController.actualizar
                           DELETE /:tipoEntradaId       → TipoEntradaController.eliminar
```

`/mios` se declara antes que `/:eventoId`.
