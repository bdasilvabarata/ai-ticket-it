---
name: nueva-pantalla
description: Checklist para crear o modificar una pantalla de la app móvil de AI Ticket It (Expo Router + TanStack Query) respetando el cliente en src/api, las claves de query por usuario, los cuatro estados, la accesibilidad y TDD con renderConDependencias. Usar siempre que se agregue o cambie una ruta en mobile/app o un hook de mobile/src/consultas.
---

## Antes de escribir, respondé
- ¿Qué caso de uso (UC-xx) y qué tarea de `specs/NNN-slug/tasks.md` cubre?
- ¿Qué endpoints consume? ¿Están en `specs/NNN-slug/contracts/` y los tipos en `shared/`?
- ¿Depende del usuario actual (mis compras, mis eventos) o es pública (el selector)?
- ¿Qué muestra en cada estado: cargando, error, vacío y éxito? Textos en `contracts/` de la feature.

## Dónde va cada cosa
- **La ruta** en `mobile/app/` — solo el componente por defecto (`export default function ...`), nada
  más exportado. Lógica que haya que testear aparte va en `src/`.
  - Pestaña nueva o reemplazo de una `SeccionPendiente`: `app/(tabs)/<nombre>.tsx`, y si es nueva,
    su `Tabs.Screen` en `app/(tabs)/_layout.tsx` con `title`, `tabBarLabel` e ícono Ionicons.
  - Pantalla apilada sobre las pestañas (detalle, formulario): `app/<nombre>.tsx` (o
    `app/<recurso>/[id].tsx`) y su `Stack.Screen` en `src/navegacion/LayoutRaiz.tsx`, **dentro del
    `Stack.Protected` de `con-usuario`** (no es una carpeta: es el guard por fase de la sesión). Cada
    nombre de pantalla se declara una sola vez (Expo Router lo exige). Ninguna pantalla navega "a
    mano" al cambiar la sesión: el guard decide qué rutas existen.
- **La función del endpoint** en `mobile/src/api/<recurso>.ts`, exportada por `src/api/index.ts`.
  Recibe el `ClienteApi` y `{ signal }` y devuelve el tipo de `shared/`:
  ```ts
  export function listarMisCompras(cliente: ClienteApi, opciones: { signal?: AbortSignal } = {}) {
    return cliente.get<CompraVista[]>("/compras/mias", { signal: opciones.signal });
  }
  ```
  Sin `usuarioId` en las opciones sale con `X-Usuario-Id` del usuario actual; `usuarioId: null` lo
  omite (endpoint público). Hoy `ClienteApi` solo tiene `get`: si necesitás `post`/`patch`/`delete`,
  agregalo en `src/api/cliente.ts` con su test en `tests/api/cliente.test.ts`, con el mismo
  manejo de errores.
- **Nunca `fetch` fuera de `src/api/`** (y `src/composicion.tsx`): el lint lo prohíbe con "Todo pedido al
  servidor vive en src/api (principio VII)". Las pantallas tampoco llaman al cliente directo: usan
  un hook de `src/consultas/`.
- **La clave** en `src/consultas/claves.ts`. Si depende del usuario, `usuarioId` va en la
  **posición 1**, para que la respuesta de un usuario nunca se lea con la clave de otro:
  ```ts
  misCompras: (usuarioId: string) => ["mis-compras", usuarioId] as const,
  ```
- **El hook** en `src/consultas/use<Recurso>.ts`, con `useClienteApi()` y el `usuarioId` de
  `useSesion()` (como `useUsuarios.ts`):
  ```ts
  export function useMisCompras(usuarioId: string) {
    const cliente = useClienteApi();
    return useQuery({
      queryKey: claves.misCompras(usuarioId),
      queryFn: ({ signal }) => listarMisCompras(cliente, { signal }),
    });
  }
  ```
  No configures `retry` ni reintentos propios: el `QueryClient` va con `retry: false` y los
  reintentos son los de la secuencia única de `src/conexion/` (1, 2, 4, 8, 16, 32 s).

## Errores: lo global ya está resuelto
- Todo error de una query o mutation llega a la sesión por `QueryCache`/`MutationCache`
  (`src/consultas/query-client.ts`). La pantalla **no** tiene que hacer nada para:
  - `ServidorNoDisponibleError` → la franja "Servidor no disponible · <dirección>" con "Reintentar",
    encima de toda ruta con usuario, y los reintentos automáticos;
  - 401 `USUARIO_NO_IDENTIFICADO` → la sesión olvida al usuario y el guard vuelve al selector con el
    aviso.
- La pantalla solo muestra su propio estado de error. Para `ErrorDeApi` usá `error.mensaje` (lo que
  mandó el servidor); para cualquier otra cosa, "Ocurrió un error inesperado.". No repitas la franja
  ni navegues por un 401.
- En pantallas con usuario la franja ya avisa de la conexión: no hace falta otro "Servidor no
  disponible" adentro (el selector sí lo tiene porque ahí no hay franja).

## Los cuatro estados (principio VII), con los componentes de `src/componentes/`
```tsx
export default function MisCompras() {
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null; // el guard ya no muestra esta ruta
  return <ListaDeMisCompras usuarioId={estado.usuarioId} />;
}

// Componente hijo (en el mismo archivo, sin exportar): el hook va antes de cualquier return.
function ListaDeMisCompras({ usuarioId }: { usuarioId: string }) {
  const consulta = useMisCompras(usuarioId);

  if (consulta.isPending) return <Cargando />;
  if (consulta.isError)
    return (
      <MensajeError
        mensaje={consulta.error instanceof ErrorDeApi ? consulta.error.mensaje : "Ocurrió un error inesperado."}
        alReintentar={() => void consulta.refetch()}
        reintentando={consulta.isFetching}
      />
    );
  if (consulta.data.length === 0) return <ListaVacia mensaje="Todavía no tenés compras." />;
  return <FlatList data={consulta.data} keyExtractor={(c) => c.id} renderItem={...} />;
}
```
- `Cargando`: indicador + "Cargando…". `MensajeError`: `titulo?`, `mensaje`, `alReintentar?`,
  `reintentando?`. `ListaVacia`: `mensaje`. `SeccionPendiente`: lo que todavía no se implementó.
- Colores de `src/componentes/estilos.ts` (`colores`); nada de hex sueltos.

## Accesibilidad y 360 px
- Títulos con `accessibilityRole="header"`; todo `Pressable` con `accessibilityRole="button"`, texto
  visible o `accessibilityLabel`, y `accessibilityState={{ disabled }}` si se deshabilita.
- Avisos que aparecen solos: `accessibilityLiveRegion="polite"` y, si hace falta,
  `AccessibilityInfo.announceForAccessibility`.
- Estado (confirmada, cancelada, "Actual") con texto, no solo con color.
- `StyleSheet` + flex, sin anchos fijos: tiene que entrar en 360 px de ancho. Listas con `FlatList`.
  Pantallas sin header propio: `SafeAreaView` de `react-native-safe-area-context`.

## TDD (principio II)
1. Primero los tests, en el **mismo turno** que los stubs con la firma real (la función de `src/api`,
   la clave, el hook y la ruta con su export por defecto, que lanzan `new Error("no implementado")`
   o devuelven `null`): así el hook `Stop` deja el typecheck y el lint en verde y el test falla por
   comportamiento.
2. `mobile/tests/api/<recurso>.test.ts`: la función pide el método y la ruta correctos, con o sin
   `X-Usuario-Id`, y pasa el `signal` (como `tests/api/usuarios.test.ts`, con `crearFetchFalso`).
3. `mobile/tests/pantallas/<pantalla>.test.tsx` con `renderConDependencias` (la app real de `app/`
   con `LayoutRaiz`, `fetch` falso, mock de AsyncStorage y `QueryClient` nuevo):
   ```ts
   await renderConDependencias({
     usuarioRecordado: lucia.id,
     respuestas: porRuta({
       "/usuarios/actual": [{ status: 200, json: lucia }],
       "/compras/mias": [{ status: 200, json: [] }],
     }),
   });
   await esperarPestanas();
   await irAPestana("Mis compras");
   expect(await screen.findByText("Todavía no tenés compras.")).toBeOnTheScreen();
   ```
   (`porRuta` sale de `tests/helpers/fetch-falso.ts`, `esperarPestanas`/`irAPestana` de
   `tests/helpers/pestanas.ts` y `lucia`/`todos` de `tests/helpers/usuarios.ts`.)
   Cubrí los cuatro estados: `"colgar"` (cargando), `{ status: 500, json: { error: {...} } }`
   (error con el mensaje del servidor y "Reintentar"), `[]` (vacío) y datos (éxito). Si depende del
   usuario, que con otro usuario no se vea lo del anterior. Buscá por rol y texto
   (`getByRole("button", { name: ... })`), no por `testID`.
4. Notas de RNTL 14 / jest-expo: `render`, `fireEvent` y `act` son async (`await`); `renderRouter`
   usa temporizadores falsos (avanzalos con `await act(() => jest.advanceTimersByTimeAsync(ms))`); el
   mock de AsyncStorage se ajusta con `mockImplementationOnce`/`mockClear`, nunca `mockRestore`.
   `rutasExtra` sirve para montar una pantalla de prueba en una ruta (ver
   `tests/pantallas/errores-en-uso.test.tsx`).
5. Verlo fallar, implementar, verlo pasar.
6. Desde la raíz: `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`. Si
   agregaste una dependencia, con `npx expo install <paquete>` desde `mobile/` y `npx expo install
   --check` sin advertencias. Probarla en el celular con `npm start` + `npm run mobile` (README).
