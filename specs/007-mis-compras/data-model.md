# Data Model: Mis compras (007)

La feature no agrega entidades ni cambia la máquina de estados de `Compra` (006). Suma una vista,
dos funciones puras del dominio, dos lecturas de repositorio y un caso de uso. Las decisiones
están en [research.md](./research.md).

## Tipos compartidos (`shared/src/compra.ts`, exportados por `index.ts`)

```ts
/** Una fila de "Mis compras" (feature 007): la compra al día con su evento y su tipo actuales, sin historial. */
export type MiCompraVista = Omit<CompraVista, "compradorId" | "historial"> & {
  /** Días de calendario (Buenos Aires) hasta el evento; solo en CONFIRMADA de un evento no realizado; si no, null. */
  diasRestantes: number | null;
  /** Solo en CANCELADA: "sistema" si venció sin pagarse, "usuario" si la canceló su comprador; si no, null. */
  canceladaPor: "sistema" | "usuario" | null;
};
```

Los campos heredados (`id`, `evento { id, nombre, fechaHora, fechaHoraLocal, realizado }`,
`tipoEntrada { id, nombre }`, `cantidad`, `total`, `estado`, `creadaEn`, `venceEn`,
`venceEnLocal`) tienen el mismo significado que en la 006.

Invariantes de la vista (las cubren los tests del service):
- `diasRestantes !== null` ⇒ `estado === CONFIRMADA` y `!evento.realizado`, y vale ≥ 0;
- `canceladaPor !== null` ⇔ `estado === CANCELADA`;
- `venceEn !== null` ⇔ `estado === PENDIENTE` (como en la 006).

## Dominio (`backend/src/domain/`)

### `dias-restantes.ts` (nuevo, puro)

| Función | Resultado |
|---|---|
| `diasRestantes(fechaHoraEvento: Date, ahora: Date): number \| null` | `null` si `ahora ≥ fechaHoraEvento`; si no, la fecha de pared del evento menos la de `ahora` (las dos con `horaDeBuenosAires`), en días enteros ≥ 0 |

### `orden-mis-compras.ts` (nuevo, puro)

```ts
export interface OrdenableMiCompra {
  id: string;
  creadaEn: Date;
  fechaHoraEvento: Date;
  eventoRealizado: boolean;
}
export function compararMisCompras(a: OrdenableMiCompra, b: OrdenableMiCompra): number;
```

El orden: primero los no realizados (`fechaHoraEvento` ascendente), después los realizados
(`fechaHoraEvento` descendente); desempatan `creadaEn` descendente y después `id` ascendente.

### `compra.ts`

Sin cambios. Se usan `alDia(ahora)`, `estado`, `creadaEn`, `venceEn` y `fueVencida()`.

## Repositorios

| Interfaz (`domain/repositorios.ts`) | Método nuevo | Implementación |
|---|---|---|
| `RepositorioCompras` | `listarPorComprador(compradorId): Promise<Compra[]>`: las compras de esa persona, de todos los eventos y en cualquier estado (posiblemente ninguna) | `CompraRepository`: filtro sobre el `Map` |
| `RepositorioEventos` | `listarPorIds(ids: readonly string[]): Promise<Evento[]>`: los que existen de esos ids, sin repetir | `EventoRepository`: como `UsuarioRepository.listarPorIds` |

## Services

### `EventoService.obtenerPorIds(ids)` (nuevo)

Devuelve un `Map<string, Evento>` en una sola lectura (`listarPorIds`). Si falta alguno, lanza
`NoEncontradoError("EVENTO_NO_ENCONTRADO", …)`. Sin cerrojo y sin cupo al día: los que lo usan no
muestran cupo.

### `CompraService.misCompras(usuarioId)` (nuevo)

Es una lectura: sin cerrojo y sin guardar nada.

1. `ahora = reloj.ahora()` (una vez).
2. `compras = (await compras.listarPorComprador(usuarioId)).map(c => c.alDia(ahora))`.
3. Sin compras → `[]`, sin leer eventos.
4. `eventos = await eventoService.obtenerPorIds([...new Set(compras.map(c => c.eventoId))])`.
5. A cada compra le arma `{ id, creadaEn, fechaHoraEvento, eventoRealizado:
   evento.estaRealizado(ahora), vista: aMiCompraVista(compra, evento, ahora) }`, la ordena con
   `compararMisCompras` y devuelve las vistas.

Son dos lecturas por pedido (compras y eventos), sin importar cuántas compras haya.

### Vistas (`services/compra.vistas.ts`)

- `datosComunes(compra, evento, ahora)` (privada): los campos que hoy arma `aCompraVista`, salvo
  `compradorId` e `historial`.
- `aCompraVista` = `datosComunes` + `compradorId` + `historial`. La salida es la misma que hoy.
- `aMiCompraVista(compra, evento, ahora)` (nueva) = `datosComunes` +
  - `diasRestantes`: `diasRestantes(evento.fechaHora, ahora)` si es `CONFIRMADA`; si no, `null`;
  - `canceladaPor`: si es `CANCELADA`, `"sistema"` cuando `compra.fueVencida()` y `"usuario"`
    cuando no; si no está cancelada, `null`.

## Controller, ruta y validación

- `CompraController.misCompras`: `res.json(await compraService.misCompras(usuarioActual(req).id))`.
- `compras.routes.ts`: `router.get("/", requerirUsuario, controller.misCompras)`, antes de
  `/:compraId`. No lleva validación: la ruta no tiene parámetros ni cuerpo.
- `app.ts` no cambia: `CompraService` ya recibe `EventoService`.

## Estado de la app (mobile)

| Pieza | Dónde | Qué guarda o hace |
|---|---|---|
| `claves.misCompras(usuarioId)` | `src/consultas/claves.ts` | `["mis-compras", usuarioId]` |
| `obtenerMisCompras(cliente, { signal })` | `src/api/compras.ts` | `GET /compras` → `MiCompraVista[]` |
| `useMisCompras(usuarioId)` | `features/compras/useMisCompras.ts` | la query |
| `useRefrescarAlVencer(compras, refetch)` | `features/compras/useRefrescarAlVencer.ts` | un `setTimeout` con la espera de `esperaHastaElProximoVencimiento` |
| `esperaHastaElProximoVencimiento(compras, ahoraMs)` | `features/compras/vencimientos.ts` | `null` sin pendientes; si hay, `max(min(venceEn) − ahora + 1000, 5000)` ms |
| mutations | `features/compras/mutaciones.ts` | las tres suman `claves.misCompras(usuarioId)` a lo que invalidan |

La lista no guarda estado local: lo que se ve es siempre la última respuesta del servidor.
