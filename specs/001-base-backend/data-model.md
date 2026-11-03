# Data Model: Base backend (001)

Modelo de persistencia que deja definido esta feature (FR-012). Las features siguientes
agregan casos de uso, índices o campos opcionales sin redefinirlo; Compra y Resenia los
introducen 005 y 010.

Convenciones (principios III, V y VIII):

- En `domain/` las entidades son tipos TypeScript planos con `id: string` y referencias como
  `string`. Mongoose (`_id`, `ObjectId`, documentos) existe solo en `repositories/`.
- Los repositories convierten con `aDominio()` y siempre consultan con `.lean()`.
- Colecciones en plural, en español: `usuarios`, `categorias`, `eventos`.
- Los modelos usan `versionKey: false`, así no se persiste `__v`.

## Usuario

Colección `usuarios`.

| Campo | Tipo (dominio) | Persistencia | Reglas |
|---|---|---|---|
| `id` | `string` | `_id: ObjectId` | |
| `nombre` | `string` | `String`, requerido, trim | no vacío |
| `apellido` | `string` | `String`, requerido, trim | no vacío |
| `favoritos` | `string[]` (ids de Evento) | `[ObjectId]`, ref `Evento`, default `[]` | vacío en el seed; lo usa 011 |

**Vista `UsuarioVista`** (en `shared/`, la arma el service):
`{ id, nombre, apellido, cantidadEventosOrganizados }`. `cantidadEventosOrganizados` es la
cantidad de eventos cuyo `organizador` es el usuario, pasados y futuros. No se persiste.

**Orden del listado**: alfabético por `apellido` y luego `nombre`, comparando en español sin
distinguir mayúsculas ni tildes (`domain/usuario.ts → compararPorApellidoYNombre`).

## Categoria

Colección `categorias`. Catálogo precargado; esta feature no la expone (llega en 003/004).

| Campo | Tipo (dominio) | Persistencia | Reglas |
|---|---|---|---|
| `id` | `string` | `_id: ObjectId` | |
| `nombre` | `string` | `String`, requerido, trim, **único** | |
| `descripcion` | `string` | `String`, requerido | |

## Evento

Colección `eventos`. Esta feature solo lo persiste para el seed y para contar eventos por
organizador; sus endpoints los agregan 003 (crear) y 004 (explorar).

| Campo | Tipo (dominio) | Persistencia | Reglas |
|---|---|---|---|
| `id` | `string` | `_id: ObjectId` | |
| `nombre` | `string` | `String`, requerido, trim | |
| `descripcion` | `string` | `String`, requerido | |
| `categoriaId` | `string` | `categoria: ObjectId`, ref `Categoria`, requerido | |
| `fechaHora` | `Date` | `Date`, requerido | instante UTC; "días restantes" se calcula en `America/Argentina/Buenos_Aires` |
| `multimedia` | `string[]` | `[String]`, default `[]` | URLs de imágenes |
| `organizadorId` | `string` | `organizador: ObjectId`, ref `Usuario`, requerido | el rol organizador sale de esta relación |
| `tiposEntrada` | `TipoEntrada[]` | subdocumentos embebidos, al menos 1 | |

Índices: `{ organizador: 1 }` (contar por organizador, y en 007 sus eventos) y
`{ categoria: 1 }` (filtro de 004). La búsqueda textual la indexa 004.

Los nombres de campo en dominio (`categoriaId`, `organizadorId`) explicitan que son
referencias; el repository los mapea a `categoria` / `organizador` en Mongo.

## TipoEntrada

Subdocumento embebido en `Evento.tiposEntrada` (pertenece a un único evento). Tiene `_id`
propio para que las compras (005) lo referencien.

| Campo | Tipo (dominio) | Persistencia | Reglas |
|---|---|---|---|
| `id` | `string` | `_id: ObjectId` | |
| `nombre` | `string` | `String`, requerido, trim | único dentro del evento (lo valida 003) |
| `descripcion` | `string` | `String`, default `""` | |
| `precio` | `number` | `Number`, requerido, **entero**, `min: 0` | pesos argentinos enteros (R15) |
| `cupo` | `number` | `Number`, requerido, entero, `min: 0` | **entradas disponibles**: se carga con la cantidad inicial (al crear el tipo, ≥ 1, lo valida 003) y decrece con cada compra; nunca menor que 0 |

**Cupo como contador decreciente**: comprar (005) descuenta `cantidad` con una única
actualización condicional (`cupo ≥ cantidad` + `$inc` negativo) sobre el documento del evento,
atómica sin transacciones; cancelar (008) la devuelve. Ver
[research.md R15](./research.md#r15-cupo-atómico-y-precios-enteros).

## EstadoCompra (solo tipo compartido)

En `shared/`, como objeto constante + tipo unión:
`PENDIENTE | CONFIRMADA | UTILIZADA | CANCELADA | REEMBOLSADA` (FR-003). Esta feature no
persiste compras; deja el tipo listo para 005. Las transiciones válidas son las de la
constitución y se implementan en `domain/` cuando llegue Compra.

## Error de API (solo tipo compartido)

```ts
interface ErrorApi {
  error: {
    codigo: string;                         // legible por máquina, MAYÚSCULAS_CON_GUION_BAJO
    mensaje: string;                        // en español, para mostrar
    detalles?: { campo: string; mensaje: string }[];
  };
}
```

Códigos de esta feature: ver [contracts/api.md](./contracts/api.md#errores).

## Datos de ejemplo

`seed/datos-ejemplo.ts → crearDatosEjemplo(ahora)`. Ids fijos de 24 caracteres hex: 18
ceros + 4 dígitos de tipo + 2 de número (por ejemplo, usuario 1 = `000000000000000000000101`).
Las fechas son "día de `ahora` en Buenos Aires + N días, a la hora indicada" salvo el evento
próximo, que va a `ahora + 24 h` redondeado a la hora. En una base real, las fechas quedan
fijas al día en que se corrió `npm run seed -- --forzar` y envejecen. El cupo de cada tipo de
entrada es su cantidad inicial (no hay compras en el seed).

**Usuarios** (`…0001xx`)

| Id | Nombre | Organiza |
|---|---|---|
| `…000101` | Lucía Álvarez | 3 eventos |
| `…000102` | Martín Benítez | 3 eventos |
| `…000103` | Sofía Castro | 2 eventos |
| `…000104` | Diego Fernández | — (solo comprador) |
| `…000105` | Valentina Gómez | — (solo comprador) |

**Categorías** (`…0002xx`): `01` Música · `02` Teatro · `03` Deportes · `04` Conferencias ·
`05` Festivales · `06` Stand-up.

**Eventos** (`…0003xx`) y tipos de entrada (`…0004xx`, numerados en orden)

| Id | Evento | Categoría | Organizador | Fecha | Tipos (precio / cupo) |
|---|---|---|---|---|---|
| `01` | Noche de Rock en el Club | Música | Lucía | ahora + 24 h | General $15.000 / 200 |
| `02` | Hamlet, versión contemporánea | Teatro | Martín | +10 d 20:00 | Platea $25.000 / 120 · Pullman $18.000 / 80 |
| `03` | Festival Sonidos del Sur | Festivales | Lucía | +30 d 14:00 | General $45.000 / 500 · VIP $120.000 / 50 · Backstage $250.000 / **3** |
| `04` | Clásico de básquet | Deportes | Sofía | +5 d 19:00 | Popular $8.000 / 300 · Platea $20.000 / 100 |
| `05` | Charla abierta: IA aplicada | Conferencias | Martín | +15 d 09:00 | Entrada general $2.000 / 150 |
| `06` | Stand-up: Noche de risas | Stand-up | Sofía | **−3 d** 22:00 | General $12.000 / 80 |
| `07` | Jazz en el Patio | Música | Martín | **−10 d** 21:00 | General $10.000 / 60 |
| `08` | Maratón Ciudad 10K | Deportes | Lucía | +45 d 08:00 | Inscripción $30.000 / 1000 |

Cobertura de FR-009: 6 categorías · 5 usuarios (3 organizan, 2 no) · 8 eventos de 3
organizadores y 6 categorías · 2 realizados (06, 07) · 1 en las próximas 48 h (01) · 3 con
varios tipos (02, 03, 04) · cupo ≤ 3 (Backstage) · precios de $2.000 a $250.000 (×125).
Cada evento lleva 1 o 2 URLs de imagen de `https://picsum.photos/seed/<slug>/800/450`.
