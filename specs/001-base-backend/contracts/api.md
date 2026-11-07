# Contrato de API: Base backend (001)

Contrato de los endpoints de esta feature y del comportamiento común a toda la API. La app
móvil (002) puede desarrollarse contra este documento antes de que 001 se integre.

## Convenciones generales

- Base: `http://<host>:<PORT>/api` (`PORT` por defecto `3000`). Todo es JSON (`Content-Type:
  application/json`).
- Recursos en plural y kebab-case. Los ids son strings: **UUID** para lo que crean los
  usuarios e **ids legibles** `<tipo>-<slug>` para los datos de ejemplo (`usuario-lucia`).
  Cualquier otro formato es un id mal formado (400).
- **Identificación**: encabezado `X-Usuario-Id: <id de usuario>`.
  - Endpoints **públicos** (marcados así abajo): ignoran el encabezado, aunque sea inválido.
  - Endpoints que **requieren usuario**: si el encabezado falta, está vacío, no es un id
    válido o no corresponde a un usuario existente → `401 USUARIO_NO_IDENTIFICADO`.
  - Todo endpoint nuevo requiere usuario salvo que su spec diga lo contrario.
- Cuerpo máximo de pedido: 100 kB.

## Errores

Formato único, para cualquier status ≥ 400:

```json
{
  "error": {
    "codigo": "ENTRADA_INVALIDA",
    "mensaje": "Los datos enviados no son válidos.",
    "detalles": [{ "campo": "params.id", "mensaje": "Debe ser un identificador válido." }]
  }
}
```

`detalles` es opcional; cuando la causa es la validación, trae un elemento por campo
inválido, con `campo` = `params.<x>`, `query.<x>` o `body.<ruta.del.campo>`.

| Status | `codigo` | Cuándo |
|---|---|---|
| 400 | `ENTRADA_INVALIDA` | parámetros de ruta, de consulta o cuerpo que no cumplen el esquema (incluye id mal formado), o una entidad de dominio que no cumple sus invariantes (`DatosInvalidosError`) |
| 400 | `JSON_INVALIDO` | el cuerpo no es JSON válido |
| 401 | `USUARIO_NO_IDENTIFICADO` | endpoint que requiere usuario sin uno válido |
| 403 | `SIN_PERMISO` | reservado: lo usan las features con permisos sobre recursos |
| 404 | `RUTA_NO_ENCONTRADA` | método + ruta inexistentes |
| 404 | `<RECURSO>_NO_ENCONTRADO` | id bien formado que no existe (en esta feature: `USUARIO_NO_ENCONTRADO`) |
| 409 | (código de la regla) | una `ReglaDeNegocioError` del dominio: conflictos de estado o de cupo (ej.: `CUPO_INSUFICIENTE`) |
| 413 | `CUERPO_DEMASIADO_GRANDE` | el cuerpo supera 100 kB |
| 500 | `ERROR_INTERNO` | error inesperado; mensaje genérico "Ocurrió un error inesperado.", sin trazas |

## Tipos (en `@ai-ticket-it/shared`)

```ts
interface SaludVista { estado: "ok" }

interface UsuarioVista {
  id: string;
  nombre: string;
  apellido: string;
  cantidadEventosOrganizados: number;   // todos sus eventos, pasados y futuros
}

interface ErrorApi { error: { codigo: string; mensaje: string; detalles?: DetalleError[] } }
interface DetalleError { campo: string; mensaje: string }

const EstadoCompra = { PENDIENTE, CONFIRMADA, UTILIZADA, CANCELADA, REEMBOLSADA } as const;
```

## Endpoints

### `GET /api/salud` — estado del servicio *(público)*

`200`

```json
{ "estado": "ok" }
```

### `GET /api/usuarios` — listado de usuarios *(público)*

Lo usa el selector de usuario de la app. Sin parámetros.

`200` — `UsuarioVista[]`, ordenado alfabéticamente por apellido y luego por nombre:

```json
[
  { "id": "usuario-lucia", "nombre": "Lucía", "apellido": "Álvarez", "cantidadEventosOrganizados": 3 },
  { "id": "usuario-martin", "nombre": "Martín", "apellido": "Benítez", "cantidadEventosOrganizados": 3 },
  { "id": "usuario-sofia", "nombre": "Sofía", "apellido": "Castro", "cantidadEventosOrganizados": 2 },
  { "id": "usuario-diego", "nombre": "Diego", "apellido": "Fernández", "cantidadEventosOrganizados": 0 },
  { "id": "usuario-valentina", "nombre": "Valentina", "apellido": "Gómez", "cantidadEventosOrganizados": 0 }
]
```

### `GET /api/usuarios/actual` — usuario actual *(requiere usuario)*

Lo usa la app para validar el usuario recordado al abrirse.

| Status | Cuándo |
|---|---|
| `200` | `UsuarioVista` del usuario de `X-Usuario-Id` |
| `401` | `USUARIO_NO_IDENTIFICADO` |

> Se declara antes que `/:id`; `actual` no es un id válido (no es UUID ni `<tipo>-<slug>`),
> así que nunca hay ambigüedad.

### `GET /api/usuarios/:id` — usuario por id *(público)*

| Status | Cuándo |
|---|---|
| `200` | `UsuarioVista` |
| `400` | `ENTRADA_INVALIDA`, `detalles: [{ "campo": "params.id", ... }]` si `id` no es UUID ni `<tipo>-<slug>` (ej.: `123`) |
| `404` | `USUARIO_NO_ENCONTRADO` si el id es válido y no existe (ej.: `usuario-inexistente`) |

### `GET /api/docs` — documentación *(pública)*

Swagger UI con la especificación OpenAPI. `GET /api/docs/openapi.json` devuelve la
especificación cruda (para importarla en Postman). Colección de ejemplo con casos de error:
`backend/src/docs/ai-ticket-it.postman_collection.json`.

## Comandos (contrato para el desarrollador)

Desde la raíz del repo:

| Comando | Efecto |
|---|---|
| `npm install` | instala todos los workspaces |
| `npm start` | arranca el servidor con los datos de ejemplo en memoria |
| `npm run dev` | igual, recargando ante cambios (cada recarga vuelve a los datos de ejemplo) |
| `npm test` · `npm run lint` · `npm run typecheck` · `npm run format:check` | calidad, en todos los paquetes |

Salida de arranque (ejemplo):

```text
AI Ticket It API escuchando
  Local: http://localhost:3000/api
  Red:   http://192.168.0.23:3000/api (Wi-Fi)
Datos de ejemplo cargados en memoria (se pierden al detener el servidor)
```
