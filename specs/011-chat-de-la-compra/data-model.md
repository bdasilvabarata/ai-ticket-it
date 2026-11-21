# Data Model: Chat de la compra (011)

Las decisiones están en [research.md](./research.md). Lo que no se menciona acá no cambia.

## Dominio (`backend/src/domain/`)

### `Mensaje` (nuevo, `domain/mensaje.ts`; re-exportado por `compra.ts`)

| Campo | Tipo | Regla |
|---|---|---|
| `autorId` | `string` | no vacío; es el comprador o el organizador del evento (lo verifica el service, R2) |
| `texto` | `string` | ya recortado (`texto === texto.trim()`), entre 1 y `LIMITES_MENSAJE.largoMaximo` (500) caracteres |
| `enviadoEn` | `Date` | válida; la fija el servidor con el reloj (`ahora`) |

- Inmutable y sin id propio. Si no cumple sus invariantes, el constructor lanza
  `DatosInvalidosError`, con un detalle por campo (`texto`, `autorId` o `enviadoEn`).
- No se edita ni se borra: no tiene métodos que lo modifiquen.

### `Compra` (cambia)

| Cambio | Detalle |
|---|---|
| `PropiedadesCompra.mensajes?` | `readonly Mensaje[]`, en orden de envío; si falta, `[]` |
| `compra.mensajes` | `readonly Mensaje[]` (congelado, como `entradas`) |
| `Compra.registrar` | arranca con `mensajes: []` |
| `enviarMensaje(autorId, texto, ahora): Compra` | **nuevo**: agrega `new Mensaje({ autorId, texto, enviadoEn: ahora })` al final. Funciona en cualquier estado y no mira la fecha del evento. No cambia `historial`, `entradas`, `total` ni el estado. El permiso lo verifica el service antes |
| `rolDe(usuarioId, organizadorId): RolEnLaCompra \| null` | **nuevo**, puro: `"comprador"` si es `compradorId`, `"organizador"` si es `organizadorId` y, si no, `null` |
| `#propiedades()` | incluye `mensajes`, así que `pagar`, `cancelar`, `vencer`, `registrarUso` y `confirmarReembolso` los conservan |

### `REGLAS_DE_COMPRA` (`domain/reglas-de-compra.ts`, suma una)

| Nombre | Campo | Mensaje | Cumple si |
|---|---|---|---|
| `mensajes-en-orden` | `mensajes` | "Los mensajes van en orden de envío y no son anteriores al alta de la compra." | cada `enviadoEn` es mayor o igual que el del mensaje anterior y que la fecha del primer cambio del historial (con un historial inválido no hay contra qué comparar: ya lo informa `historial-valido`) |

`ReglaDeCompra.campo` es `keyof PropiedadesCompra`, así que `"mensajes"` ya entra en el tipo.

## Tipos compartidos (`shared/src/mensaje.ts`, nuevo; exportados por `shared/src/index.ts`)

```ts
import type { EstadoCompra } from "./estado-compra";

/** Límite del texto de un mensaje del chat (clarify): lo usan la validación y el dominio. */
export const LIMITES_MENSAJE = { largoMaximo: 500 } as const;

/** Cuerpo de `POST /compras/:compraId/mensajes`: solo el texto (autor y fecha los pone el servidor). */
export interface DatosMensaje {
  texto: string;
}

/** El rol de un usuario en una compra: su comprador o el organizador de su evento. */
export type RolEnLaCompra = "comprador" | "organizador";

/** Una de las dos partes del chat de una compra. */
export interface ParteDeLaCompraVista {
  id: string;
  nombre: string;
  apellido: string;
  rol: RolEnLaCompra;
}

/** Un mensaje del chat, en orden de envío. */
export interface MensajeVista {
  /** Su posición en la conversación, desde 1 (los mensajes solo se agregan al final). */
  numero: number;
  autor: ParteDeLaCompraVista;
  texto: string;
  /** Instante ISO UTC (reloj del servidor). */
  enviadoEn: string;
  /** "YYYY-MM-DDTHH:mm", hora de Buenos Aires. */
  enviadoEnLocal: string;
}

/** Respuesta de `GET /compras/:compraId/mensajes` (solo las dos partes). */
export interface ChatDeLaCompraVista {
  /** El encabezado: sin códigos de entrada, historial ni total. */
  compra: {
    id: string;
    evento: { id: string; nombre: string };
    tipoEntrada: { id: string; nombre: string };
    cantidad: number;
    /** Al día con el reloj del servidor (una pendiente vencida se ve CANCELADA). */
    estado: EstadoCompra;
  };
  /** La otra parte respecto del usuario que pide. */
  otraParte: ParteDeLaCompraVista;
  /** Todos, del más viejo al más nuevo. */
  mensajes: MensajeVista[];
}
```

## Services (`backend/src/services/`)

| Método | Qué hace |
|---|---|
| `CompraService.chat(compraId, usuarioId): ChatDeLaCompraVista` | **Lectura**, sin cerrojo ni guardado. Hace siempre tres lecturas: la compra, el evento y los usuarios en lote. Orden: 404 → 403. Arma la vista con `compra.alDia(ahora)` (R5) |
| `CompraService.enviarMensaje(compraId, usuarioId, { texto }): MensajeVista` | **Escritura** bajo el cerrojo del evento: lee la compra afuera para saber qué cerrojo tomar (404), y adentro sigue los pasos de R4, que terminan en un solo `guardar` |
| `aChatDeLaCompraVista(compra, evento, usuarios, usuarioId)` · `aMensajeVista(mensaje, numero, compra, evento, autor)` | **Nuevas**, en `services/mensaje.vistas.ts` |
| `aTipoDeLaCompra` (`compra.vistas.ts`) | pasa a exportarse para reusarla |

## Datos de ejemplo (`backend/src/seed/datos-ejemplo.ts`)

`compra-martin-festival-vip` suma los tres mensajes de [research R8](./research.md#r8--datos-de-ejemplo),
de `usuario-martin` y `usuario-lucia`. La compra queda `CONFIRMADA` y las demás, sin mensajes.

## App (`mobile/`)

| Pieza | Detalle |
|---|---|
| `src/api/compras.ts` | `obtenerChatDeLaCompra(cliente, compraId, { signal })` → `ChatDeLaCompraVista`; `enviarMensaje(cliente, compraId, { texto }, { usuarioId })` → `MensajeVista` |
| `src/consultas/claves.ts` | `chatDeLaCompra(usuarioId, compraId)` → `["chat-de-la-compra", usuarioId, compraId]` |
| `features/compras/useChatDeLaCompra.ts` | la consulta |
| `features/compras/mutaciones.ts` | `useEnviarMensaje(usuarioId, compraId)`. Pago, cancelación, uso y reembolso también invalidan `["chat-de-la-compra"]` por prefijo (R10) |
| `features/compras/formato.ts` | los textos de R12 |
| `features/compras/pantallas/ChatDeLaCompra.tsx` | la pantalla (R11) |
| `features/compras/componentes/{EncabezadoDelChat, MensajeDelChat}.tsx` | el encabezado y un mensaje |
| `features/compras/{pantallas/Compra, componentes/FilaCompraDelEvento}.tsx` | los accesos al chat (R9) |
| `src/componentes/PantallaDesplazable.tsx` | prop opcional `empezarAlFinal` |
| `app/compras/[compraId]/index.tsx` (movido) · `app/compras/[compraId]/chat.tsx` (nuevo) | los re-exports de una línea |
| `src/navegacion/LayoutRaiz.tsx` | `compras/[compraId]/index` ("Tu compra") y `compras/[compraId]/chat` ("Chat de la compra") |
