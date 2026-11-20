---
name: nueva-pantalla
description: Checklist para crear o modificar una pantalla de la app móvil de AI Ticket It (Expo Router + TanStack Query) respetando la organización por feature, el cliente en src/api, las claves de query por usuario, los cuatro estados con SegunConsulta, el tema, la accesibilidad y TDD con renderConDependencias. Usar siempre que se agregue o cambie una ruta en mobile/app, una pantalla o un hook de consulta en mobile/src/features.
---

## Antes de escribir, respondé
- ¿Qué caso de uso (UC-xx) y qué tarea de `specs/NNN-slug/tasks.md` cubre?
- ¿A qué **feature** (dominio) pertenece: `usuarios`, `sesion` o una nueva (`eventos`, `compras`…)?
- ¿Qué endpoints consume? ¿Están en `specs/NNN-slug/contracts/` y los tipos en `shared/`?
- ¿Depende del usuario actual (mis compras, mis eventos) o es pública (el selector)?
- ¿Qué muestra en cada estado: cargando, error, vacío y éxito? Textos en `contracts/` de la feature.

## Boceto (opcional, antes de los tests)
- Para ver la distribución de tarjetas, botones y campos, un prompt rápido en v0 alcanza. Sirve solo
  para decidir el **orden y la jerarquía** de los elementos: su código y sus estilos no se copian.
- La pantalla se escribe después con lo de `src/componentes` (`tema`, `Boton`, `SegunConsulta`…). Si
  el boceto pide un valor que el tema no tiene, se agrega al tema, no a la pantalla.

## Dónde va cada cosa
```text
mobile/
├── app/<ruta>.tsx                    # una sola línea: export { X as default } from ".../src/features/<dominio>";
└── src/
    ├── api/<recurso>.ts              # funciones de endpoint (+ export en api/index.ts)
    ├── consultas/claves.ts           # claves de query
    ├── componentes/                  # base: tema, Boton, SegunConsulta, Cargando, MensajeError, ListaVacia, Logo…
    ├── navegacion/                   # LayoutPestanas (pestañas) y LayoutRaiz (Stack con guards)
    └── features/<dominio>/
        ├── pantallas/<Pantalla>.tsx  # export con nombre
        ├── componentes/              # piezas propias de la feature
        ├── use<Recurso>.ts           # hooks de consulta
        ├── formato.ts                # textos derivados, puros y con tests
        └── index.ts                  # lo único que ven app/, navegacion/ y las otras features
```
- **La pantalla** en `src/features/<dominio>/pantallas/<Pantalla>.tsx`, con export con nombre, y su
  export en el `index.ts` de la feature. **La ruta** en `mobile/app/` es un re-export de una línea:
  ```ts
  export { MisCompras as default } from "../../src/features/compras";
  ```
  `app/` no puede importar `react`, `react-native`, `@tanstack/react-query`, `@expo/vector-icons` ni
  `expo-router` (el lint lo prohíbe: "app/ solo expone una pantalla o layout de src/").
  - Pestaña nueva o reemplazo de una `SeccionPendiente`: `app/(tabs)/<nombre>.tsx` y, si es nueva,
    su `Tabs.Screen` en `src/navegacion/LayoutPestanas.tsx` con `title`, `tabBarLabel` e ícono
    Ionicons.
  - Pantalla apilada sobre las pestañas (detalle, formulario): `app/<nombre>.tsx` (o
    `app/<recurso>/[id].tsx`) y su `Stack.Screen` en `src/navegacion/LayoutRaiz.tsx`, **dentro del
    `Stack.Protected` de `con-usuario`** (no es una carpeta: es el guard por fase de la sesión). Cada
    nombre de pantalla se declara una sola vez (Expo Router lo exige). Ninguna pantalla navega "a
    mano" al cambiar la sesión: el guard decide qué rutas existen.
- **Imports** (los verifica el lint con `import-x`):
  - Sin ciclos (`import-x/no-cycle`).
  - La base (`api/`, `consultas/`, `conexion/`, `componentes/`) no importa features.
  - Desde otra feature, `app/` o `navegacion/`, solo el `index.ts` de una feature
    (`../../usuarios`, nunca `../../usuarios/useUsuarios`). Adentro de la feature, por archivo
    (`../SesionProvider`), nunca por su propio `index.ts`.
  - La base, por su `index.ts` (`../../../componentes`, `../../../api`, `../../../conexion`).
  - Imports relativos, sin alias `@/`.
- **Rutas tipadas**: `router.push`, `router.replace` y `<Link href>` se verifican en el typecheck
  (`Href`). Una ruta mal escrita no compila. Al agregar la **primera ruta dinámica**
  (`[id].tsx`), sumá a `mobile/tests/tipos/rutas-tipadas.ts` un caso con `// @ts-expect-error
  <motivo>` que navega sin el parámetro obligatorio (FR-009).
- **La función del endpoint** en `mobile/src/api/<recurso>.ts`, exportada por `src/api/index.ts`.
  Recibe el `ClienteApi` y `{ signal }` y devuelve el tipo de `shared/`:
  ```ts
  export function listarMisCompras(cliente: ClienteApi, opciones: { signal?: AbortSignal } = {}) {
    return cliente.get<CompraVista[]>("/compras/mias", { signal: opciones.signal });
  }
  /** Escritura: `post`, `put` o `patch` con el cuerpo; `delete` sin cuerpo. */
  export function crearCompra(cliente: ClienteApi, datos: DatosNuevaCompra) {
    return cliente.post<CompraVista>("/compras", datos);
  }
  ```
  Sin `usuarioId` en las opciones sale con `X-Usuario-Id` del usuario actual; `usuarioId: null` lo
  omite (endpoint público). Con cuerpo va como JSON con `Content-Type: application/json`; un `204`
  resuelve `undefined`. **Las escrituras nunca se reintentan solas**: si una falla sin servidor, la
  pantalla decide qué hacer (mostrar el error y dejar que la persona vuelva a intentarlo).
- **Nunca `fetch` fuera de `src/api/`** (y `src/composicion.ts`): el lint lo prohíbe con "Todo pedido
  al servidor vive en src/api (principio VII)". Las pantallas tampoco llaman al cliente directo:
  usan un hook de la feature.
- **La clave** en `src/consultas/claves.ts`. Si depende del usuario, `usuarioId` va en la
  **posición 1**, para que la respuesta de un usuario nunca se lea con la clave de otro:
  ```ts
  misCompras: (usuarioId: string) => ["mis-compras", usuarioId] as const,
  ```
- **El hook** en la feature (`src/features/<dominio>/use<Recurso>.ts`, no en `src/consultas/`), con
  `useClienteApi()` de `src/consultas/cliente-api` y el `usuarioId` de `useSesion()` (como
  `features/usuarios/useUsuarios.ts`):
  ```ts
  export function useMisCompras(usuarioId: string) {
    const cliente = useClienteApi();
    return useQuery({
      queryKey: claves.misCompras(usuarioId),
      queryFn: ({ signal }) => listarMisCompras(cliente, { signal }),
    });
  }
  ```
  No configures `retry` ni reintentos propios: el `QueryClient` va con `retry: false` (queries y
  mutations) y los reintentos son los de la secuencia única de la sesión (1, 2, 4, 8, 16, 32 s).
- **Textos derivados** (nombre completo, "Organiza 3 eventos", días restantes, montos) en
  `features/<dominio>/formato.ts`, funciones puras con su test en `tests/features/<dominio>/`.

## Errores: lo global ya está resuelto
- Todo error de una query o mutation llega a la sesión por `QueryCache`/`MutationCache`
  (`src/consultas/query-client.ts`). La pantalla **no** tiene que hacer nada para:
  - `ServidorNoDisponibleError` → la franja "Servidor no disponible · <dirección>" con "Reintentar",
    encima de toda ruta con usuario, y los reintentos automáticos;
  - 401 `USUARIO_NO_IDENTIFICADO` → la sesión olvida al usuario y el guard vuelve al selector con el
    aviso (igual en lecturas y escrituras).
- La pantalla solo muestra su propio estado de error, y `SegunConsulta` ya lo hace bien. No repitas
  la franja ni navegues por un 401.

## Los cuatro estados (principio VII) con `SegunConsulta`
```tsx
export function MisCompras() {
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null; // el guard ya no muestra esta ruta
  return <ListaDeMisCompras usuarioId={estado.usuarioId} />;
}

// Componente hijo (en el mismo archivo, sin exportar): el hook va antes de cualquier return.
function ListaDeMisCompras({ usuarioId }: { usuarioId: string }) {
  const consulta = useMisCompras(usuarioId);
  return (
    <SegunConsulta consulta={consulta} mensajeVacio="Todavía no tenés compras.">
      {(compras) => <FlatList data={compras} keyExtractor={(c) => c.id} renderItem={...} />}
    </SegunConsulta>
  );
}
```
- `SegunConsulta` muestra `Cargando`; el error (servidor no disponible → "Reintentar" de la
  secuencia; `ErrorDeApi` → su `mensaje`; otro → "Ocurrió un error inesperado."; los dos últimos
  con "Reintentar" que hace `refetch`); `ListaVacia` con `mensajeVacio` si los datos son
  `undefined`, `null` o `[]` (o según `esVacio`), y si no, `children(datos)`.
- Botones con `Boton` (`variante` `"primario"`, `"aviso"` o `"texto"`; `enCurso` + `textoEnCurso`
  para "Guardando…"; `deshabilitado`). Una fila tocable de una lista puede ser su propio `Pressable`
  (como `FilaUsuario`).
- Estilos con `tema` de `src/componentes` (`tema.colores`, `tema.espacio`, `tema.tipografia`,
  `tema.radio`, `tema.grosor`, `tema.tamano`, `tema.sombra`, `tema.opacidadApagado`): ni hex ni
  números sueltos. Si falta un valor, agregalo al tema.
  - Todo texto parte de un estilo de `tema.tipografia` (`{ ...tema.tipografia.cuerpo, color: … }`),
    así usa la fuente Archivo. Nunca `fontWeight`: el peso es la familia (`tema.fuente.*`).
  - Fondo de pantalla `fondo` (crema); tarjetas y campos sobre `superficie`, con borde `borde` de
    `tema.grosor.normal` y `boxShadow: tema.sombra.nivel1`. Un elemento con sombra, al presionarlo,
    se hunde: sin sombra y con `hundido` (ver `FilaEvento`).
  - `primario` / `sobrePrimario` para acciones; `marca` (verde exacto del logo) solo para acentos sin
    texto encima. `resaltado` (amarillo) siempre con `texto` encima: el primario no llega al contraste.
  - Estados de compra: `exito` / `sobreExito` → `CONFIRMADA` y `UTILIZADA`; `peligro` /
    `sobrePeligro` → `CANCELADA` y `REEMBOLSADA`; `advertencia` / `sobreAdvertencia` → `PENDIENTE`.
    Siempre con la etiqueta del estado escrita (ver Accesibilidad), como badge (ver `MarcaRealizado`).
  - El logo es el componente `Logo` (ya tiene su `accessibilityLabel`); no importes el `.png` suelto.
- Animaciones, transiciones y demás pulido visual **no** se agregan pantalla por pantalla: van en
  la feature 014 (pulido estético), de forma global en `tema.ts` y en los componentes base.

## Accesibilidad y 360 px
- Títulos con `accessibilityRole="header"`. `Boton` ya es `button` con su texto y anuncia
  deshabilitado/ocupado; un `Pressable` propio lleva `accessibilityRole="button"`, texto visible o
  `accessibilityLabel` y `accessibilityState={{ disabled }}`.
- Avisos que aparecen solos: `accessibilityLiveRegion="polite"` y, si hace falta,
  `AccessibilityInfo.announceForAccessibility`.
- Estado (confirmada, cancelada, "Actual") con texto, no solo con color.
- `StyleSheet` + flex, sin anchos fijos: tiene que entrar en 360 px de ancho. Listas con `FlatList`.
  Pantallas sin header propio: `SafeAreaView` de `react-native-safe-area-context`.

## TDD (principio II)
1. Primero los tests, en el **mismo turno** que los stubs con la firma real (la función de `src/api`,
   la clave, el hook, la pantalla con su export con nombre y la ruta de `app/` con su re-export, que
   lanzan `new Error("no implementado")` o devuelven `null`): así el hook `Stop` deja el typecheck y
   el lint en verde y el test falla por comportamiento.
2. `mobile/tests/api/<recurso>.test.ts`: la función pide el método y la ruta correctos, con o sin
   `X-Usuario-Id`, con el cuerpo esperado (`falso.pedidos[0].cuerpo`) y pasa el `signal` (como
   `tests/api/usuarios.test.ts`, con `crearFetchFalso`).
3. `mobile/tests/features/<dominio>/formato.test.ts` para los textos derivados.
4. `mobile/tests/pantallas/<pantalla>.test.tsx` con `renderConDependencias` (la app real de `app/`
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
5. Notas de RNTL 14 / jest-expo: `render`, `fireEvent` y `act` son async (`await`); `renderRouter`
   usa temporizadores falsos (avanzalos con `await act(() => jest.advanceTimersByTimeAsync(ms))`); el
   mock de AsyncStorage se ajusta con `mockImplementationOnce`/`mockClear`, nunca `mockRestore`.
   `rutasExtra` sirve para montar una pantalla de prueba en una ruta (ver
   `tests/pantallas/errores-en-uso.test.tsx`; con el guard, lo que se ve al confirmar al usuario es
   `(tabs)/index`).
6. Verlo fallar, implementar, verlo pasar.
7. Desde la raíz: `npm test`, `npm run lint`, `npm run typecheck` (genera los tipos de rutas antes
   de `tsc`), `npm run format:check`. Si agregaste una dependencia, con `npx expo install <paquete>`
   desde `mobile/` y `npx expo install --check` sin advertencias. Probarla en el celular con
   `npm start` + `npm run mobile` (README).
