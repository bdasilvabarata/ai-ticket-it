# Contrato de API: Explorar eventos (005)

Amplía los contratos de la 001 y la 004 (`specs/004-crear-evento/contracts/api.md`): mismas
convenciones, mismo formato de error y las mismas fechas (`fechaHora` ISO UTC +
`fechaHoraLocal` de Buenos Aires; `realizado` según el reloj del servidor). Los tipos salen de
`@ai-ticket-it/shared` ([data-model.md](../data-model.md), "Tipos compartidos"). Se documenta
también en `backend/src/docs/openapi.json` (tag **Eventos**) y en la colección de Postman.

## Endpoints

| Método y ruta | Usuario | Respuesta | Errores |
|---|---|---|---|
| `GET /api/eventos` **(nuevo)** | no (público; un `X-Usuario-Id` inválido se ignora) | `200 CatalogoVista` | `400` |
| `GET /api/eventos/:eventoId` **(ampliado)** | no (público) | `200 EventoVista` + `organizador` | `400` id · `404 EVENTO_NO_ENCONTRADO` |
| `POST /api/eventos` · `PUT /api/eventos/:eventoId` | sí (sin cambios) | su `EventoVista` también trae `organizador` | los de la 004 |

### `GET /api/eventos`

Query (todos opcionales; las claves desconocidas se ignoran):

| Parámetro | Regla | Por defecto | Error (detalle en `query.<campo>`) |
|---|---|---|---|
| `texto` | string, `trim`, ≤ 100 caracteres después del `trim` | `""` (sin filtro) | "Debe tener como máximo 100 caracteres." · repetido → "Debe ser un texto." |
| `categoriaId` | string, `trim`; vacío = sin filtro | sin filtro | repetido → "Debe ser un texto." |
| `orden` | `fecha` \| `precio` \| `puntaje` | `fecha` | "Debe ser fecha, precio o puntaje." |

Reglas:
- Solo eventos **no realizados** (`ahora < fechaHora`, con un único `ahora` por pedido), de
  cualquier organizador, agotados incluidos.
- `texto`: se separa en palabras (uno o más espacios); un evento coincide si **cada** palabra
  está, como subcadena literal, en su nombre **o** en su descripción, sin distinguir
  mayúsculas, acentos ni diéresis; la ñ es distinta de la n.
- `categoriaId`: igualdad exacta. Una categoría que no existe (o un valor cualquiera) → la lista
  vacía, **no** un error.
- Texto y categoría se combinan (deben cumplirse los dos); el orden se aplica después.
- Orden y desempates: `fecha` ↑ · `precio` ("desde") ↑ · `puntaje` ↓ con `null` al final; los
  empates, por fecha ↑, después nombre (sin mayúsculas ni tildes) y por último `id`.
- Sin paginación.

Respuesta:

```json
{
  "eventos": [
    {
      "id": "evento-clasico-de-basquet",
      "nombre": "Clásico de básquet",
      "categoria": { "id": "categoria-deportes", "nombre": "Deportes" },
      "fechaHora": "2026-11-15T22:00:00.000Z",
      "fechaHoraLocal": "2026-11-15T19:00",
      "organizadorId": "usuario-sofia",
      "realizado": false,
      "cantidadTiposEntrada": 2,
      "precioDesde": 8000,
      "agotado": false,
      "organizador": {
        "id": "usuario-sofia",
        "nombre": "Sofía",
        "apellido": "Castro",
        "puntaje": null,
        "cantidadResenias": 0
      }
    }
  ],
  "hayEventosProximos": true
}
```

- `hayEventosProximos`: hay al menos un evento no realizado **antes** de aplicar `texto` y
  `categoriaId`. Con `eventos: []` decide el vacío de la app (research R2).
- `organizador.puntaje`: promedio **sin redondear** de las puntuaciones de las reseñas de
  **todos** los eventos del organizador (próximos y realizados); `null` sin reseñas (nunca 0).
  `cantidadResenias` es la cantidad en la que se basa (0 hasta la 011).

Ejemplos (datos de ejemplo, research R9):

| Pedido | Resultado |
|---|---|
| `GET /api/eventos` | los 6 próximos por fecha: Noche de Rock, Clásico, Hamlet, Charla IA, Festival, Maratón |
| `?texto=BASQUET` · `?texto=básquet` · `?texto=%20basquet%20` | solo Clásico de básquet |
| `?texto=club+rock` · `?texto=rock%20%20%20club` | Noche de Rock en el Club |
| `?texto=clasico` | Clásico de básquet (nombre) y Hamlet ("El clásico de Shakespeare…", descripción) |
| `?categoriaId=categoria-musica` | Noche de Rock (Jazz en el Patio ya se realizó) |
| `?categoriaId=categoria-inexistente` | `{ "eventos": [], "hayEventosProximos": true }` |
| `?orden=precio` | Maratón (0), Charla (2000), Clásico (8000), Noche de Rock (15000), Hamlet (18000), Festival (45000) |
| `?orden=puntaje` | sin reseñas: igual que por fecha (desempate) |
| `?orden=nombre` | `400` con detalle en `query.orden` |
| `?texto=` + 101 letras | `400` con detalle en `query.texto` |

> Nota sobre "hamlet butacas": la búsqueda mira el nombre y la descripción **del evento**, no
> las de sus tipos. En el seed, "butacas" está en la descripción de los tipos de Hamlet, así que
> ese ejemplo de la spec se prueba con datos armados en los tests (nombre con "Hamlet" y
> descripción del evento con "butacas"), no con el seed.

### `GET /api/eventos/:eventoId` (ampliado)

`EventoVista` de la 004 sin cambios en sus campos, más:

```json
"organizador": { "id": "usuario-martin", "nombre": "Martín", "apellido": "Benítez", "puntaje": null, "cantidadResenias": 0 }
```

Sigue público, sigue sirviendo eventos **realizados** (la 007 y la 011 llevan a ellos) y sigue
respondiendo `404 EVENTO_NO_ENCONTRADO` ("No existe el evento.") si no existe.

## Errores de esta feature

| Status | `codigo` | Cuándo |
|---|---|---|
| 400 | `ENTRADA_INVALIDA` | `texto` > 100, `orden` desconocido o parámetro repetido (`detalles` en `query.*`); id de evento mal formado (`params.eventoId`, como en la 004) |
| 404 | `EVENTO_NO_ENCONTRADO` | detalle de un evento inexistente |

El listado no tiene 401, 403, 404 ni 409.
