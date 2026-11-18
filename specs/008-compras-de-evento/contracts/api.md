# Contrato de API: Compras de un evento (008)

Tres endpoints nuevos para el **organizador** del evento y cambios aditivos en las vistas de la
006 y la 007. Formato de error, header `X-Usuario-Id` y `CompraVista`: los de
`specs/006-comprar-entradas/contracts/api.md`. Los tipos están en
[data-model.md](../data-model.md) ("Vistas compartidas").

## Endpoints

| Método y ruta | Usuario | Respuesta | Errores |
|---|---|---|---|
| `GET /api/eventos/:eventoId/compras` | requerido (el organizador) | `200 ComprasDelEventoVista` | `401` · `400` · `404 EVENTO_NO_ENCONTRADO` · `403` |
| `GET /api/eventos/:eventoId/entradas/:codigo` | requerido (el organizador) | `200 EntradaDelEventoVista` | `401` · `400` · `404 EVENTO_NO_ENCONTRADO` · `403` · `404 ENTRADA_NO_ENCONTRADA` |
| `POST /api/eventos/:eventoId/entradas/:codigo/uso` | requerido (el organizador) | `200 EntradaDelEventoVista` | `401` · `400` · `404 EVENTO_NO_ENCONTRADO` · `403` · `404 ENTRADA_NO_ENCONTRADA` · `409 FUERA_DE_HORARIO_DE_USO` · `409 TRANSICION_INVALIDA` |

Los errores se listan en el orden en que se chequean (research R5).

## `GET /api/eventos/:eventoId/compras`

**Todas** las compras del evento, de todos los compradores y en todos los estados, más el resumen
por tipo de entrada y la ventana de uso.

- **Solo el organizador** (FR-010): otro usuario, también un comprador de ese evento, recibe
  `403 SIN_PERMISO` ("Solo el organizador del evento puede ver sus compras."). El 404 del evento va
  antes que el 403.
- **Al día** (FR-004): un `ahora` por pedido; una `PENDIENTE` vencida sale `CANCELADA` con
  `canceladaPor: "sistema"` y su cupo ya figura en `disponibles`. **No guarda nada** ni toma el
  cerrojo.
- **Lecturas fijas** (FR-002): evento, pendientes del evento (cupo al día), compras del evento y
  compradores en lote; cualquiera sea la cantidad de compras.
- **También con el evento realizado** (US1, acceptance 10).
- Sin query ni cuerpo (si llegan, se ignoran).

### `ComprasDelEventoVista`

| Campo | Valor |
|---|---|
| `evento` | `{ id, nombre, fechaHoraLocal, realizado }` |
| `ventanaDeUso` | `{ desde, hasta, desdeLocal, hastaLocal, estado }`: `desde` = inicio − 4 h, `hasta` = inicio + 12 h; `estado` (`"antes"` · `"abierta"` · `"despues"`) según el reloj del servidor, `abierta` con ambos extremos inclusive |
| `resumenPorTipo` | uno por tipo, en el orden del evento: `{ tipoEntrada: { id, nombre }, disponibles, pendientes, vendidas, usadas }` (FR-007) |
| `compras` | `CompraDelEventoVista[]`, `creadaEn` descendente, desempate `id` |

Resumen por tipo:

| Cantidad | Qué suma |
|---|---|
| `disponibles` | el cupo del tipo, al día (el mismo que ve un comprador en el detalle, SC-003) |
| `pendientes` | `cantidad` de las compras `PENDIENTE` no vencidas |
| `vendidas` | `cantidad` de las compras `CONFIRMADA` y `UTILIZADA` |
| `usadas` | entradas `UTILIZADA` (subconjunto de `vendidas`) |

Las `CANCELADA` y `REEMBOLSADA` no suman en ninguna. Usar una entrada no cambia `disponibles` ni
`vendidas` (FR-009).

### `CompraDelEventoVista` (sin códigos de entrada)

| Campo | Valor |
|---|---|
| `id` | |
| `comprador` | `{ id, nombre, apellido }` |
| `tipoEntrada` | `{ id, nombre }` (nombre actual) |
| `cantidad` · `total` | de la compra (`total` fijado al comprar; 0 = gratis) |
| `estado` | al día |
| `creadaEn` · `creadaEnLocal` | ISO UTC · `"YYYY-MM-DDTHH:mm"` de Buenos Aires |
| `venceEn` · `venceEnLocal` | solo en `PENDIENTE`; si no, `null` |
| `canceladaPor` | solo en `CANCELADA`: `"sistema"` (venció) o `"usuario"` (la canceló el comprador); si no, `null` |
| `entradasUsadas` | entero ≥ 0 |

### Ejemplo (seed, Lucía, "Peña en La Rueda")

```json
{
  "evento": { "id": "evento-pena-en-la-rueda", "nombre": "Peña en La Rueda",
              "fechaHoraLocal": "2026-11-18T21:00", "realizado": false },
  "ventanaDeUso": { "desde": "2026-11-18T20:00:00.000Z", "hasta": "2026-11-19T12:00:00.000Z",
                    "desdeLocal": "2026-11-18T17:00", "hastaLocal": "2026-11-19T09:00",
                    "estado": "abierta" },
  "resumenPorTipo": [
    { "tipoEntrada": { "id": "tipo-pena-en-la-rueda-general", "nombre": "General" },
      "disponibles": 117, "pendientes": 0, "vendidas": 3, "usadas": 1 },
    { "tipoEntrada": { "id": "tipo-pena-en-la-rueda-con-cena", "nombre": "Con cena" },
      "disponibles": 38, "pendientes": 0, "vendidas": 2, "usadas": 0 }
  ],
  "compras": [
    { "id": "compra-sofia-pena-con-cena",
      "comprador": { "id": "usuario-sofia", "nombre": "Sofía", "apellido": "Castro" },
      "tipoEntrada": { "id": "tipo-pena-en-la-rueda-con-cena", "nombre": "Con cena" },
      "cantidad": 2, "total": 30000, "estado": "CONFIRMADA",
      "creadaEn": "…", "creadaEnLocal": "…", "venceEn": null, "venceEnLocal": null,
      "canceladaPor": null, "entradasUsadas": 0 }
  ]
}
```

## `GET /api/eventos/:eventoId/entradas/:codigo`

Busca una entrada **de ese evento** por su código, para mostrarla antes de registrar el uso
(FR-012c). Lectura: sin cerrojo y sin guardar; la compra al día.

- `:codigo` se normaliza en el servidor: mayúsculas, sin espacios ni guiones (`7k3m-q9tb` y
  `7K3M Q9TB` encuentran `7K3MQ9TB`). Forma: texto no vacío de hasta 32 caracteres (si no, `400`).
- Un código inexistente, mal escrito o de **otro** evento → `404 ENTRADA_NO_ENCONTRADA` ("No hay
  ninguna entrada con ese código en este evento."), sin datos de otros eventos.
- Que la entrada no se pueda usar **no** es un error acá: la respuesta trae `estado` y
  `ventanaDeUso.estado`, y la app dice por qué (FR-019).

### `EntradaDelEventoVista`

| Campo | Valor |
|---|---|
| `codigo` | canónico (8 caracteres) |
| `estado` | estado de la entrada, al día (igual al de la compra hasta que se confirma) |
| `usadaEn` · `usadaEnLocal` | si está `UTILIZADA`; si no, `null` |
| `compra` | `{ id, comprador: { id, nombre, apellido }, tipoEntrada: { id, nombre }, cantidad, estado, entradasUsadas }` |
| `ventanaDeUso` | como en `ComprasDelEventoVista` |

## `POST /api/eventos/:eventoId/entradas/:codigo/uso`

Registra el uso de la entrada. Sin cuerpo (si llega uno, se ignora). Bajo el cerrojo del evento,
con un único `ahora` (FR-015, research R10): 404 evento → 403 → materializa los vencimientos del
evento → relee la compra por código (404) → ventana → estado → guarda.

- **Ventana** (FR-016): desde 4 h antes del inicio hasta 12 h después, ambos inclusive. Fuera →
  `409 FUERA_DE_HORARIO_DE_USO`: "El ingreso se registra desde el 18/11 17:00 hasta el 19/11
  09:00." (Buenos Aires).
- **Estado** (FR-014): si la entrada no está `CONFIRMADA` → `409 TRANSICION_INVALIDA`, con el
  mensaje según su estado:

  | Estado de la entrada | `mensaje` |
  |---|---|
  | `UTILIZADA` | "Esta entrada ya se utilizó." |
  | `PENDIENTE` | "La compra de esta entrada todavía no se pagó." |
  | `CANCELADA` (también una pendiente vencida al día) | "La compra de esta entrada está cancelada." |
  | `REEMBOLSADA` | "La compra de esta entrada fue reembolsada." |

- **Éxito** (`200`): la entrada `UTILIZADA` con `usadaEn` = `ahora`. Su historial suma
  `{ UTILIZADA, autor: organizador, ahora }`. Si era la primera entrada usada de la compra, la
  compra pasa a `UTILIZADA` con el mismo cambio (FR-012d); si no, la compra no cambia. El cupo no
  cambia (FR-009).
- **Concurrencia** (US3, acceptance 10): con N pedidos simultáneos sobre la misma entrada, uno
  responde `200` y los demás `409 TRANSICION_INVALIDA` ("Esta entrada ya se utilizó.").

## Cambios en las vistas existentes (aditivos)

| Vista | Cambio |
|---|---|
| `CompraVista` (`GET /compras/:id`, pago, cancelación, alta, `mis-compras` del evento) | + `entradas: EntradaVista[]` (solo en `CONFIRMADA` y `UTILIZADA`; si no, `[]`) y `entradasUsadas` |
| `MiCompraVista` (`GET /compras`) | + `entradasUsadas` (sin `entradas`) |
| `MisComprasDelEventoVista.confirmadas` | incluye también las `UTILIZADA` |
| `MiCompraVista.diasRestantes` | sin cambios: solo en `CONFIRMADA` |

`EntradaVista`: `{ codigo, estado, usadaEn, usadaEnLocal }`. Los códigos solo los recibe el
comprador (son vistas de sus compras).

## OpenAPI y Postman

`backend/src/docs/openapi.json` suma las tres rutas, `ComprasDelEventoVista`,
`CompraDelEventoVista`, `ResumenTipoEntradaVista`, `VentanaDeUsoVista`, `EntradaVista`,
`EntradaDelEventoVista` y los campos nuevos de `CompraVista` y `MiCompraVista` (el test de
cobertura de `api/docs.test.ts` lo exige). La colección de Postman suma la carpeta "Compras del
evento" (lista, buscar entrada, registrar uso y el rechazo por ya utilizada).
