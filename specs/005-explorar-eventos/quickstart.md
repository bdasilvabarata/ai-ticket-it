# Quickstart: validar Explorar eventos (005)

Guía para comprobar la feature de punta a punta. Los detalles están en
[contracts/api.md](./contracts/api.md), [contracts/app.md](./contracts/app.md) y
[data-model.md](./data-model.md).

## Prerrequisitos

- La 004 integrada en `development` (catálogo de categorías, `GET /api/eventos/:eventoId`).
- `npm install` desde la raíz. Sin dependencias nuevas.
- Un celular con Expo Go del SDK 58 en la misma red que la PC (README).

## 1. Calidad (desde la raíz)

```sh
npm test && npm run lint && npm run typecheck && npm run format:check
```

Qué tiene que pasar:
- **domain**:
  - `precioDesde` (con un tipo agotado más barato, sigue siendo el menor) y `estaAgotado`
    (todos en 0 → sí; uno en 0 y otro con cupo → no);
  - `normalizarParaBuscar` / `coincideCon`: "basquet" = "Básquet" = "BÁSQUET", "cafe" ⇄
    "Café", "pingüino" ⇄ "pinguino", "año" ≠ "ano"; palabras en cualquier orden y repartidas
    entre nombre y descripción; una sola de dos palabras no alcanza; `"*"`, `"."`, `"(rock"`
    literales; la tabla de coherencia con `mismoNombreDeTipo`;
  - `Resenia` (1 y 5 sí; 0, 6 y 4,5 no), `calcularPuntaje` (`[]` → `null`, 0) y
    `puntajesPorOrganizador`;
  - `ordenarCatalogo`: cada criterio, gratis primero, `null` al final, desempates por fecha →
    nombre ("álvarez" = "Alvarez") → id, y el arreglo original intacto;
  - los datos de ejemplo: Hamlet agotado, Maratón con un tipo gratis, siguen 8 eventos (3, 3, 2).
- **repositories**: `ReseniaRepository.listarPorEventos` (varios eventos, ninguno, ids sin
  reseñas).
- **services** (reloj fijo y repositorios armados por caso): solo no realizados (un evento en
  su instante exacto ya no aparece), texto, categoría, combinación, `hayEventosProximos`,
  puntaje con reseñas de un evento **realizado** del organizador, orden por puntaje, y
  `obtener` con `organizador`.
- **api**: listado público (sin usuario y con un `X-Usuario-Id` inválido), los 400 de `texto` y
  `orden` con su detalle, categoría inexistente → `[]`, detalle con `organizador`, 404; la
  cobertura de OpenAPI y de Postman.
- **mobile**: `listarEventos` (URL exacta), `formato`, `SegunConsulta`/`ListaVacia` con sus
  props nuevas, y las pantallas Explorar y detalle con `renderConDependencias`. Los tests de la
  004 siguen en verde.

## 2. Servidor (pedidos directos)

`npm start` y, con Postman ("Explorar eventos") o curl:

| Pedido | Esperado |
|---|---|
| `GET /api/eventos` (sin `X-Usuario-Id`) | `200`, 6 eventos por fecha, todos con `organizador.puntaje: null` y `cantidadResenias: 0`; `hayEventosProximos: true` |
| `GET /api/eventos?texto=BASQUET` | solo "Clásico de básquet" |
| `GET /api/eventos?categoriaId=categoria-musica` | solo "Noche de Rock en el Club" |
| `GET /api/eventos?orden=precio` | Maratón (`precioDesde: 0`) primero, Festival último; Hamlet con `agotado: true` |
| `GET /api/eventos?categoriaId=categoria-nada` | `200 { "eventos": [], "hayEventosProximos": true }` |
| `GET /api/eventos?orden=nombre` | `400`, detalle en `query.orden` |
| `GET /api/eventos/evento-hamlet` | los campos de la 004 + `organizador` de Martín |
| `GET /api/eventos/evento-noche-de-risas` | `200` con `realizado: true` (el detalle de un realizado sigue disponible) |

## 3. Recorrido de la demo (app)

`npm start` + `npm run mobile`, con cualquier usuario (por ejemplo Diego, que no organiza nada):

1. **Explorar** abre con skeleton y después muestra los 6 próximos por fecha. "Noche de risas"
   y "Jazz en el Patio" (realizados) no están. Las tarjetas dicen "Sin reseñas"; Hamlet tiene
   la marca "Agotado"; Maratón dice "Gratis".
2. **Buscar "basquet"**: mientras se escribe aparece el skeleton y, al dejar de escribir, solo
   "Clásico de básquet". El campo conserva el foco y el texto.
3. **Filtrar Música** (con el texto todavía escrito): "Ningún evento coincide con tu búsqueda."
   con "Limpiar búsqueda". Tocarlo: vuelve "Todas" y el texto vacío. Elegir **Música**: solo
   "Noche de Rock en el Club".
4. **Ordenar por precio** (con "Todas"): Maratón ("Gratis") primero, después Charla IA ("desde
   $ 2.000") y Clásico ("desde $ 8.000"). **Por puntaje**: queda en orden de fecha (nadie tiene
   reseñas).
5. **Abrir "Gratis"** (Maratón): fila de dos imágenes que se desliza; "Organiza Lucía Álvarez ·
   Sin reseñas"; tipos "Inscripción · $ 30.000 · 1000 disponibles" y "Carrera kids · Gratis ·
   200 disponibles"; sin botón de compra. Volver: Explorar conserva "Precio".
6. **Abrir "Agotado"** (Hamlet): cada tipo dice "Agotado".
7. **No encontrado**: con Explorar abierto, eliminar la Noche de Rock desde Postman
   (`DELETE /api/eventos/evento-noche-de-rock` con `X-Usuario-Id: usuario-lucia`) y tocar su
   tarjeta: "No encontramos este evento." + "Volver a Explorar"; al volver, la lista ya no lo
   muestra.
8. **Servidor no disponible**: frenar el servidor y volver a buscar: franja global y estado de
   error; al levantarlo, Explorar se recupera solo.
9. **360 px**: sin desplazamiento horizontal de la página (los chips se acomodan en renglones);
   con TalkBack, las tarjetas, los selectores y las imágenes se anuncian.
