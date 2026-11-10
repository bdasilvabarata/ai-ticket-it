# Data Model: Crear evento (004)

Entidades de `backend/src/domain/`, piezas de coordinación, vistas de `shared/` y datos de
ejemplo. Las decisiones están en [research.md](./research.md).

## Entidades de dominio

### TipoEntrada (existente; se amplía)

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | string | UUID (creado) o `tipo-<evento>-<slug>` (seed); único en todo el sistema |
| `nombre` | string | se recorta con `trim`; no vacío; ≤ 50 (`LIMITES_TIPO_ENTRADA.nombre`) |
| `descripcion` | string | opcional (`""`); ≤ 300 |
| `precio` | number | entero ≥ 0, en pesos (0 = gratis) |
| `cupo` | number | **disponible**: entero ≥ 0. Al crear el tipo, ≥ 1 (lo exige la operación, no el constructor, porque un tipo agotado es válido) |

- Comportamiento existente: `hayCupoPara(cantidad)`.
- Nuevo: `con(datos)` devuelve un `TipoEntrada` nuevo con los datos editados y el mismo `id`.

### Evento (existente; agregado raíz)

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | string | UUID o `evento-<slug>` |
| `nombre` | string | se recorta; no vacío; ≤ 100 |
| `descripcion` | string | opcional; ≤ 2000 |
| `categoriaId` | string | debe existir en el catálogo (lo verifica el service: 400) |
| `fechaHora` | Date | instante válido. "Futura" no es invariante del constructor (el seed tiene eventos realizados): la exigen `crear` y `actualizar` |
| `multimedia` | string[] | 0 a 5 URLs `http`/`https` |
| `organizadorId` | string | el usuario que lo creó; no cambia |
| `tiposEntrada` | TipoEntrada[] | **≥ 1**; nombres únicos con `mismoNombreDeTipo` (R14) |

Los límites de longitud (nombres y descripciones) y los de multimedia (hasta 5 URLs
`http`/`https`) de las dos tablas son **de forma**: los valida zod en `validations/` con
`LIMITES_EVENTO` y `LIMITES_TIPO_ENTRADA`, y el dominio no los vuelve a verificar. Quien crea
eventos es un usuario habilitado y sin malas intenciones; el dominio protege las reglas de
negocio (fecha futura, nombres únicos, al menos un tipo, cupo, realizado y compras).

Las interfaces del constructor se llaman `PropiedadesEvento` y `PropiedadesTipoEntrada`.
`DatosEvento` y `DatosTipoEntrada` son los cuerpos HTTP de `shared/`.

**Invariantes del constructor**, que se verifican en toda instancia nueva:
- nombre, fecha válida y ≥ 1 tipo → `DatosInvalidosError`;
- nombres de tipo repetidos → `ReglaDeNegocioError("NOMBRE_TIPO_ENTRADA_REPETIDO")`.

**Consultas**:
- `estaRealizado(ahora)`: `ahora ≥ fechaHora`;
- `esOrganizadoPor(usuarioId)`;
- `buscarTipoEntrada(tipoId)`: el tipo o `null`;
- `tuPrecioEstaEntre(min, max)`: existente; su comentario pasa a decir "feature 005".

**Operaciones**: cada una devuelve un `Evento` **nuevo** y deja intacto `this` (R7). `ahora`
lo pasa el service, que lo lee del `Reloj` dentro del cerrojo.

| Operación | Verifica (en orden) | Error |
|---|---|---|
| `Evento.crear(datos, ahora)` (estática) | `fechaHora > ahora`; después, invariantes | 409 `FECHA_NO_FUTURA` |
| `actualizar(datos, ahora)` | no realizado; `fechaHora > ahora`. Conserva `id`, `organizadorId` y `tiposEntrada` | 409 `EVENTO_REALIZADO`, `FECHA_NO_FUTURA` |
| `agregarTipoEntrada(tipo, ahora)` | no realizado; `cupo ≥ 1`; nombre no repetido (constructor) | 409 `EVENTO_REALIZADO`, `NOMBRE_TIPO_ENTRADA_REPETIDO`; 400 si el cupo es 0 |
| `editarTipoEntrada(tipoId, datos, ahora)` | no realizado; el tipo existe; nombre no repetido **contra los otros** | 409 `EVENTO_REALIZADO`, `NOMBRE_TIPO_ENTRADA_REPETIDO` |
| `quitarTipoEntrada(tipoId, { ahora, tieneCompras })` | no realizado; no es el último; sin compras | 409 `EVENTO_REALIZADO`, `ULTIMO_TIPO_ENTRADA`, `TIPO_ENTRADA_CON_COMPRAS` |
| `verificarQueSePuedeEliminar({ ahora, tieneCompras })` | no realizado; sin compras (no devuelve nada) | 409 `EVENTO_REALIZADO`, `EVENTO_CON_COMPRAS` |

- La existencia del tipo la verifica el service antes, con `buscarTipoEntrada` (404, R5).
  Las operaciones la vuelven a verificar como red de seguridad.
- Cambiar un precio no toca ninguna `Compra`, porque su total quedó fijo (FR-015).

### Compra (nueva, mínima)

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | string | UUID o `compra-<slug>` |
| `compradorId` | string | — |
| `eventoId` | string | — |
| `tipoEntradaId` | string | — |
| `cantidad` | number | entero ≥ 1 |
| `total` | number | entero ≥ 0, fijado al comprar (`precio × cantidad`) |
| `estado` | `EstadoCompra` (shared) | uno de los cinco |

- Sin comportamiento en la 004.
- La 006 suma el historial (`CambioEstadoCompra`), las transiciones y la creación con
  descuento de cupo.

### Categoria (existente, sin cambios)

`id`, `nombre`, `descripcion`. Es solo lectura.

## Funciones de dominio

- `domain/hora-buenos-aires.ts`: Buenos Aires es UTC−3 fijo, y la única constante del
  desfase vive acá (R10).
  - `instanteDesdeHoraDeBuenosAires("YYYY-MM-DDTHH:mm"): Date`;
  - `horaDeBuenosAires(instante): "YYYY-MM-DDTHH:mm"`.
- `domain/evento.ts`: `mismoNombreDeTipo(a, b): boolean` con `Intl.Collator("es",
  { sensitivity: "base" })` sobre los textos recortados.

## Piezas de coordinación

| Pieza | Dónde | Forma | Notas |
|---|---|---|---|
| `Reloj` | `domain/reloj.ts` (interfaz) · `config/reloj.ts` (`relojDelSistema`) | `ahora(): Date` | inyectado en services y en `crearApp({ reloj })`; los tests usan `{ ahora: () => instante }` |
| `Cerrojo` / `CerrojoPorClave` | `services/cerrojo-por-clave.ts` | `ejecutar<T>(clave, operacion: () => Promise<T>): Promise<T>` | una instancia por app, compartida por los services de eventos y tipos (y de compras en la 006); libera en `finally`; sin anidar (R2) |

## Repositorios (interfaces en `domain/repositorios.ts`)

```ts
interface RepositorioEventos {
  listar(): Promise<Evento[]>;
  buscarPorId(id: string): Promise<Evento | null>;
  listarPorOrganizador(organizadorId: string): Promise<Evento[]>;   // nuevo
  contarPorOrganizador(ids: string[]): Promise<Map<string, number>>;
  guardar(evento: Evento): Promise<void>;                            // nuevo: alta o reemplazo
  eliminarPorId(id: string): Promise<void>;                          // nuevo
}

interface RepositorioCompras {                                       // nuevo
  existePorEvento(eventoId: string): Promise<boolean>;
  existePorTipoEntrada(tipoEntradaId: string): Promise<boolean>;
  guardar(compra: Compra): Promise<void>;
}
```

`RepositorioCategorias` no cambia.

## Services (casos de uso)

| Service | Depende de | Métodos |
|---|---|---|
| `CategoriaService` | `RepositorioCategorias` | `listar()`: `CategoriaVista[]` por nombre (collator `es`) |
| `EventoService` | eventos, categorías, compras, `Cerrojo`, `Reloj` | `listarMios(usuarioId)` · `obtener(id)` · `crear(usuarioId, datos)` · `actualizar(id, usuarioId, datos)` · `eliminar(id, usuarioId)` · `#obtenerOFallar(id)` |
| `TipoEntradaService` | eventos, compras, `Cerrojo`, `Reloj` | `crear(eventoId, usuarioId, datos)` · `actualizar(eventoId, tipoId, usuarioId, datos)` · `eliminar(eventoId, tipoId, usuarioId)` · `#obtenerEventoOFallar(id)` · `#obtenerTipoOFallar(evento, tipoId)` |

Las vistas se arman en `services/evento.vistas.ts`, que usan los dos services.

**Flujo de una escritura sobre un evento existente** (ejemplo: quitar un tipo):

```text
cerrojo.ejecutar(eventoId, async () => {
  evento ← #obtenerEventoOFallar(eventoId)          // 404, se lee ADENTRO del cerrojo
  si !evento.esOrganizadoPor(usuarioId) → 403
  #obtenerTipoOFallar(evento, tipoId)               // 404 si no es de ESTE evento
  tieneCompras ← compras.existePorTipoEntrada(tipoId)
  nuevo ← evento.quitarTipoEntrada(tipoId, { ahora: reloj.ahora(), tieneCompras })  // 409
  eventos.guardar(nuevo)
})
```

**Orden de Mis eventos** (FR-004), en `listarMios`:
1. los próximos (`!realizado`) por `fechaHora` ascendente;
2. después los realizados por `fechaHora` descendente.

## Vistas (`shared/src/evento.ts`, `shared/src/categoria.ts`)

```ts
interface CategoriaVista { id: string; nombre: string; descripcion: string }

interface TipoEntradaVista { id: string; nombre: string; descripcion: string; precio: number; cupo: number }

interface EventoResumenVista {
  id: string;
  nombre: string;
  categoria: { id: string; nombre: string };
  fechaHora: string;          // instante ISO UTC
  fechaHoraLocal: string;     // "YYYY-MM-DDTHH:mm", hora de pared de Buenos Aires
  organizadorId: string;
  realizado: boolean;         // calculado por el servidor al consultar
  cantidadTiposEntrada: number;
}

interface EventoVista extends EventoResumenVista {
  descripcion: string;
  multimedia: string[];
  tiposEntrada: TipoEntradaVista[];   // en el orden en que se agregaron
}

// Entrada
interface DatosTipoEntrada { nombre: string; descripcion?: string; precio: number; cupo: number }
interface DatosEvento {
  nombre: string; descripcion?: string; categoriaId: string;
  fechaHora: string;          // "YYYY-MM-DDTHH:mm" en hora de Buenos Aires
  multimedia?: string[];
}
interface DatosNuevoEvento extends DatosEvento { tiposEntrada: DatosTipoEntrada[] }

const LIMITES_EVENTO = { nombre: 100, descripcion: 2000, multimedia: 5 } as const;
const LIMITES_TIPO_ENTRADA = { nombre: 50, descripcion: 300 } as const;
```

## Datos de ejemplo (se suman a los de la 001)

| Id | Comprador | Evento · tipo | Cantidad | Total | Estado |
|---|---|---|---|---|---|
| `compra-martin-festival-vip` | `usuario-martin` | `evento-festival-sonidos-del-sur` · `tipo-festival-sonidos-del-sur-vip` | 2 | 240000 | `CONFIRMADA` |
| `compra-diego-festival-general` | `usuario-diego` | `evento-festival-sonidos-del-sur` · `tipo-festival-sonidos-del-sur-general` | 1 | 45000 | `CANCELADA` |

`DatosEjemplo` suma `compras`. Lo que se demuestra con estas compras está en R17.

## Mobile: estado de los formularios

- **Crear evento**: `{ nombre, descripcion, categoriaId | null, fechaHoraLocal | null,
  multimedia: string[], tiposEntrada: { clave, nombre, descripcion, precio: string, cupo:
  string }[] }`, con al menos una fila de tipo de entrada desde el inicio. `clave` es local,
  para la lista.
- **Editar evento**: los mismos datos sin `tiposEntrada`, precargados desde `EventoVista`
  (`fechaHoraLocal`). Los tipos se muestran como lista con sus acciones.
- **Tipo de entrada**: `{ nombre, descripcion, precio: string, cupo: string }`.
- **Errores**: `Record<campo, mensaje>`, salidos de `errores-de-formulario.ts` (400 y los 409
  de un campo), y un `mensajeGeneral` para el resto de los errores.

## Claves de query (`mobile/src/consultas/claves.ts`)

```ts
categorias: () => ["categorias"] as const,
misEventos: (usuarioId: string) => ["mis-eventos", usuarioId] as const,
evento: (usuarioId: string, eventoId: string) => ["evento", usuarioId, eventoId] as const,
```
