# Data Model: Base backend (001)

Entidades y repositorios en memoria que deja definidos esta feature (FR-012). Las features
siguientes agregan casos de uso y métodos de repositorio sin redefinirlos; Compra y Resenia los
introducen 005 y 010. Persistencia en memoria según la constitución v2.0.0 (principio IV) y
[research.md R23](./research.md#r23-persistencia-en-memoria-pura).

Convenciones (principios III, IV, V y VIII):

- En `domain/` las entidades son **clases con comportamiento** (R17): propiedades `readonly`,
  `id: string` y referencias a otras entidades como `string` (`categoriaId`, `organizadorId`);
  validan sus invariantes al construirse (`DatosInvalidosError` de `domain/errores.ts`, con un
  detalle por campo).
- Operaciones del diagrama de la consigna: `TipoEntrada.hayCupoPara(cantidad)` y
  `Evento.tuPrecioEstaEntre(min, max)`.
- **Repositorios en memoria** (`repositories/`): cada uno guarda sus entidades en un
  `Map<id, entidad>` privado, se construye con sus entidades iniciales y devuelve entidades de
  dominio; nunca expone el `Map`. Implementan las interfaces de `domain/repositorios.ts`.
- **Ids**: UUID v4 (`crypto.randomUUID()`) para lo que crean los usuarios (desde 003); ids
  legibles y fijos para los datos de ejemplo (ver abajo). Un id válido es un UUID o un id
  legible `<tipo>-<slug>` en minúsculas (`validations/comunes.ts → idSchema`).
- **Cupo atómico** (constitución): verificar y descontar cupo, o cambiar el estado de una
  compra, ocurre en un mismo tramo síncrono del repositorio o de la entidad, sin `await` entre
  la verificación y la escritura.

## Usuario

`UsuarioRepository`: `listar()`, `buscarPorId(id)`.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | `string` | |
| `nombre` | `string` | no vacío; se recorta |
| `apellido` | `string` | no vacío; se recorta |
| `favoritos` | `readonly string[]` (ids de Evento) | vacío en el seed; lo usa 011 |

**Vista `UsuarioVista`** (en `shared/`, la arma el service):
`{ id, nombre, apellido, cantidadEventosOrganizados }`. `cantidadEventosOrganizados` es la
cantidad de eventos cuyo `organizadorId` es el usuario, pasados y futuros. No se guarda.

**Orden del listado**: alfabético por `apellido` y luego `nombre`, comparando en español sin
distinguir mayúsculas ni tildes (`domain/usuario.ts → compararPorApellidoYNombre`).

## Categoria

`CategoriaRepository`: `listar()`, `buscarPorId(id)`. Catálogo precargado; esta feature no lo
expone por HTTP (llega en 003/004).

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | `string` | |
| `nombre` | `string` | no vacío; se recorta |
| `descripcion` | `string` | |

## Evento

`EventoRepository`: `listar()`, `buscarPorId(id)`, `contarPorOrganizador(ids)` (pasados y
futuros; los organizadores sin eventos no aparecen en el `Map`). Sus endpoints los agregan 003
(crear) y 004 (explorar).

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | `string` | |
| `nombre` | `string` | no vacío; se recorta |
| `descripcion` | `string` | |
| `categoriaId` | `string` | id de una Categoria |
| `fechaHora` | `Date` | fecha válida; instante UTC; "días restantes" se calcula en `America/Argentina/Buenos_Aires` |
| `multimedia` | `readonly string[]` | URLs de imágenes |
| `organizadorId` | `string` | id de un Usuario; de esta relación sale el rol organizador |
| `tiposEntrada` | `readonly TipoEntrada[]` | al menos 1 |

## TipoEntrada

Parte de un Evento (no tiene repositorio propio): se guarda y se recupera con su evento. Tiene
`id` propio para que las compras (005) lo referencien.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | `string` | |
| `nombre` | `string` | no vacío; único dentro del evento (lo valida 003) |
| `descripcion` | `string` | |
| `precio` | `number` | **entero** ≥ 0, pesos argentinos (R15) |
| `cupo` | `number` | entero ≥ 0: **entradas disponibles**; se carga con la cantidad inicial (≥ 1 al crear, lo valida 003) y decrece con cada compra |

**Cupo atómico** (005/008): el repositorio de eventos expondrá una operación que, en un mismo
tramo síncrono, verifica `hayCupoPara(cantidad)` y guarda el evento con el cupo descontado (o
devuelto al cancelar). Si no hay cupo, lanza `ReglaDeNegocioError("CUPO_INSUFICIENTE", …)`.

## EstadoCompra (solo tipo compartido)

En `shared/`, como objeto constante + tipo unión:
`PENDIENTE | CONFIRMADA | UTILIZADA | CANCELADA | REEMBOLSADA` (FR-003). Esta feature no tiene
compras; deja el tipo listo para 005. Las transiciones válidas son las de la constitución y se
implementan en `domain/` cuando llegue Compra.

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

`seed/datos-ejemplo.ts → crearDatosEjemplo(ahora)` (puro) arma las entidades;
`seed/repositorios-de-ejemplo.ts → crearRepositoriosDeEjemplo(ahora)` construye repositorios
nuevos con ellas. Las fechas son "día de `ahora` en Buenos Aires + N días, a la hora indicada"
salvo el evento próximo, que va a `ahora + 24 h` redondeado a la hora. El cupo de cada tipo de
entrada es su cantidad inicial (no hay compras en el seed).

**Usuarios**

| Id | Nombre | Organiza |
|---|---|---|
| `usuario-lucia` | Lucía Álvarez | 3 eventos |
| `usuario-martin` | Martín Benítez | 3 eventos |
| `usuario-sofia` | Sofía Castro | 2 eventos |
| `usuario-diego` | Diego Fernández | — (solo comprador) |
| `usuario-valentina` | Valentina Gómez | — (solo comprador) |

**Categorías**: `categoria-musica` Música · `categoria-teatro` Teatro · `categoria-deportes`
Deportes · `categoria-conferencias` Conferencias · `categoria-festivales` Festivales ·
`categoria-stand-up` Stand-up.

**Eventos** y tipos de entrada (id del tipo: `tipo-<slug del evento>-<slug del tipo>`, por
ejemplo `tipo-festival-sonidos-del-sur-backstage`)

| Id | Evento | Categoría | Organizador | Fecha | Tipos (precio / cupo) |
|---|---|---|---|---|---|
| `evento-noche-de-rock` | Noche de Rock en el Club | Música | Lucía | ahora + 24 h | General $15.000 / 200 |
| `evento-hamlet` | Hamlet, versión contemporánea | Teatro | Martín | +10 d 20:00 | Platea $25.000 / 120 · Pullman $18.000 / 80 |
| `evento-festival-sonidos-del-sur` | Festival Sonidos del Sur | Festivales | Lucía | +30 d 14:00 | General $45.000 / 500 · VIP $120.000 / 50 · Backstage $250.000 / **3** |
| `evento-clasico-de-basquet` | Clásico de básquet | Deportes | Sofía | +5 d 19:00 | Popular $8.000 / 300 · Platea $20.000 / 100 |
| `evento-charla-ia-aplicada` | Charla abierta: IA aplicada | Conferencias | Martín | +15 d 09:00 | Entrada general $2.000 / 150 |
| `evento-noche-de-risas` | Stand-up: Noche de risas | Stand-up | Sofía | **−3 d** 22:00 | General $12.000 / 80 |
| `evento-jazz-en-el-patio` | Jazz en el Patio | Música | Martín | **−10 d** 21:00 | General $10.000 / 60 |
| `evento-maraton-10k` | Maratón Ciudad 10K | Deportes | Lucía | +45 d 08:00 | Inscripción $30.000 / 1000 |

Cobertura de FR-009: 6 categorías · 5 usuarios (3 organizan, 2 no) · 8 eventos de 3
organizadores y 6 categorías · 2 realizados · 1 en las próximas 48 h · 3 con varios tipos ·
cupo ≤ 3 (Backstage) · precios de $2.000 a $250.000 (×125). Cada evento lleva 1 o 2 URLs de
imagen de `https://picsum.photos/seed/<slug>/800/450`.
