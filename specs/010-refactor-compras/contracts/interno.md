# Contratos: Refactor de Mis compras, Compras del evento y Cancelación

## Contratos externos: sin cambios

| Contrato | Fuente vigente | Se verifica con |
|---|---|---|
| Tipos de `shared/` (`CompraVista`, `MiCompraVista`, `CompraDelEventoVista`, `EntradaDelEventoVista`, `EntradaVista`, `ReembolsoVista`, `MotivoNoCancelable`…) | `shared/src/` | `git diff development -- shared` vacío (SC-002) |
| API REST: rutas, cuerpos, respuestas, códigos de error, mensajes y orden de chequeos | `specs/007-mis-compras/contracts/`, `specs/008-compras-de-evento/contracts/`, `specs/009-cancelar-compra/contracts/api.md` | `backend/tests/api/` sin modificar (SC-001) |
| OpenAPI y colección de Postman | `backend/src/docs/` | `git diff development -- backend/src/docs` vacío; `tests/api/docs.test.ts` |
| Pantallas: textos, accesibilidad, foco, navegación | `specs/00{7,8,9}-*/contracts/app.md` | `mobile/tests/pantallas/` sin modificar, salvo las aserciones de invalidación de `registrar-ingreso.test.tsx` |

En particular, `POST /api/eventos/:eventoId/entradas/:codigo/uso` conserva su orden de rechazos:
401 → 400 → 404 `EVENTO_NO_ENCONTRADO` → 403 → 404 `ENTRADA_NO_ENCONTRADA` → 409
`FUERA_DE_HORARIO_DE_USO` → 409 `TRANSICION_INVALIDA`, con un solo guardado de la compra.

## Contratos internos que cambian

Son las interfaces entre módulos que usan las features siguientes (011, 012). Detalle de campos y
reglas en `data-model.md`.

### `domain/entrada.ts`

```ts
interface RegistroDeEntrada { usuarioId: string; fechaHora: Date }
class Entrada {
  constructor(p: { codigo: string; uso?: RegistroDeEntrada | null; cancelacion?: RegistroDeEntrada | null });
  readonly codigo: string;
  readonly uso: RegistroDeEntrada | null;
  readonly cancelacion: RegistroDeEntrada | null;
  readonly usada: boolean;
  readonly cancelada: boolean;
  readonly usadaEn: Date | null;
  readonly estadoPropio: EstadoCompra;
  usar(organizadorId: string, ahora: Date): Entrada;
  cancelar(compradorId: string, ahora: Date): Entrada;
}
function motivoNoUsable(estado: EstadoCompra | null): string;
```

Se quitan: `PropiedadesEntrada.cambios`, `Entrada.cambios`, `estadoEn(compra)`,
`ultimoEstadoPropio`, `tieneCambioA(estado)`.

### `domain/compra.ts`

```ts
type EstadoDeReembolso = "pendiente" | "confirmado";
class Compra {
  estadoDe(entrada: Entrada): EstadoCompra;            // nuevo
  estadoDeEntrada(codigo: string): EstadoCompra | null; // se conserva
  readonly entradasUsadas: number;                      // = entradas usadas (Entrada.usada)
  readonly reembolso: EstadoDeReembolso | null;         // nuevo; reemplaza a tieneReembolsoPendiente()
  // el resto, sin cambios
}
export { Entrada, type RegistroDeEntrada } from "./entrada";
```

### `domain/reglas-de-compra.ts`

```ts
interface ReglaDeCompra { nombre: string; campo: keyof PropiedadesCompra; mensaje: string;
  cumple(p: PropiedadesCompra): boolean }
const REGLAS_DE_COMPRA: readonly ReglaDeCompra[];   // las 11 de data-model.md, en ese orden
function pasoPorConfirmada(historial: readonly CambioEstadoCompra[]): boolean;
```

### `services/compra.service.ts`

```ts
class CompraService {
  obtenerPorCodigoOFallar(eventoId: string, codigoCanonico: string): Promise<Compra>; // 404 ENTRADA_NO_ENCONTRADA
  registrarUso(eventoId: string, codigo: string, usuarioId: string): Promise<EntradaDelEventoVista>;
}
```

### `services/entrada.service.ts`

```ts
interface DependenciasEntradaService {
  compraService: CompraService; eventoService: EventoService; usuarioService: UsuarioService; reloj: Reloj;
}
// obtener(...) y registrarUso(...) con las mismas firmas; registrarUso delega.
```

### `services/compra.vistas.ts`

```ts
aCompraDelEventoVista(compra: Compra, comprador: Usuario, evento: Evento): CompraDelEventoVista; // antes: tipo
```

Las demás funciones exportadas conservan su firma.

### App: `mobile/src/features/compras/`

- `useRegistrarUso(usuarioId, eventoId)`: misma firma; cambia lo que invalida (data-model).
- `componentes/BuscadorDeCodigo.tsx` y `componentes/ResultadoDeIngreso.tsx`: internos de la
  feature (no salen por `index.ts`).
- (opcional) `useEnvioUnico()`: interno de la feature.
