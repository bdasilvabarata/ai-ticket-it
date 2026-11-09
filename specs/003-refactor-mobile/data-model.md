# Data model: Refactor de la arquitectura mobile (003)

No hay entidades de dominio nuevas ni cambios en el servidor. Este documento fija las
**piezas de código** y sus contratos internos: módulos y sus dependencias, tema, botón, pieza
de cuatro estados, contratos de conexión y cliente, y pedido HTTP. `EstadoSesion`,
`EventoSesion`, `DecisionValidacion` y el usuario recordado no cambian
(`specs/002-base-mobile/data-model.md`).

## Módulos

| Módulo | Tipo | Contiene | Puede importar |
|---|---|---|---|
| `app/` | navegación (Expo Router) | un re-export por archivo | `navegacion/`, `componentes/`, `index.ts` de cada feature |
| `src/navegacion/` | conector | `RaizDeLaApp`, `LayoutRaiz` (providers, franja, `Stack` con guards), `LayoutPestanas` | base, `composicion`, `index.ts` de cada feature |
| `src/composicion.ts` | conector | `crearDependencias`, `crearDependenciasDeProduccion`, tipo `Dependencias` | base, `index.ts` de cada feature |
| `src/api/` | base | `cliente.ts`, `direccion.ts`, `errores.ts`, un archivo por recurso (`usuarios.ts`), `index.ts` | `shared` |
| `src/consultas/` | base | `query-client.ts`, `claves.ts`, `cliente-api.tsx` (`ClienteApiProvider`, `useClienteApi`) | `api/` |
| `src/conexion/` | base | `conexion.tsx` (`EstadoConexion`, `ConexionProvider`, `useConexion`), `index.ts` | — |
| `src/componentes/` | base | `tema`, `Boton`, `Cargando`, `MensajeError`, `ListaVacia`, `SeccionPendiente`, `SegunConsulta`, `FranjaServidorNoDisponible`, `index.ts` | `api/`, `conexion/` |
| `src/features/usuarios/` | feature | `formato.ts`, `useUsuarios.ts`, `componentes/FilaUsuario.tsx`, `index.ts` | base |
| `src/features/sesion/` | feature | `estado-sesion.ts`, `validacion.ts`, `usuario-recordado.ts`, `secuencia-reintentos.ts`, `controlador-sesion.ts`, `SesionProvider.tsx`, `pantallas/SeleccionarUsuario.tsx`, `pantallas/Perfil.tsx`, `index.ts` | base, `features/usuarios` (por su `index.ts`) |

Sentido único de las dependencias: `app/ → navegacion/ → features/sesion → features/usuarios →
base`, y `composicion` → base + features. Las reglas y cómo las verifica el lint:
[research.md R1 y R4](./research.md#r4-lint-de-dependencias-eslint-plugin-import-x) y
[contracts/estructura.md](./contracts/estructura.md).

## Tema

`tema` (en `src/componentes/tema.ts`, `as const`). Son los valores que hoy aparecen repetidos
en los componentes, sin agregar ninguno:

| Grupo | Nombre | Valor | Se usa hoy en |
|---|---|---|---|
| `colores` | `texto` | `#1f2933` | títulos y textos |
| | `textoSecundario` | `#52606d` | detalle de fila, avisos, vacío |
| | `primario` | `#1d4ed8` | botón, indicador de carga, "Actual", "Cerrar" |
| | `sobrePrimario` | `#ffffff` | texto del botón primario |
| | `fondo` | `#ffffff` | pantalla y filas |
| | `borde` | `#d9e2ec` | separadores, borde de la franja |
| | `avisoFondo` | `#fff4ce` | franja, aviso del selector |
| | `avisoTexto` | `#5c3c00` | texto y borde de avisos |
| `espacio` | `minimo` | 2 | separación nombre/detalle de la fila |
| | `chico` | 8 | `gap` y padding de la franja, margen del botón en Perfil |
| | `medio` | 12 | `gap` de contenedores, padding del aviso, vertical de botón |
| | `fila` | 14 | padding vertical de la fila |
| | `normal` | 16 | márgenes horizontales |
| | `grande` | 20 | padding horizontal del botón primario |
| | `amplio` | 24 | padding de los contenedores centrados |
| `texto` | `chico` | 14 | franja, detalle de fila, "Actual" |
| | `aviso` | 15 | aviso del selector y de Perfil |
| | `normal` | 16 | cuerpo, botones |
| | `destacado` | 17 | nombre en la fila |
| | `subtitulo` | 18 | título del mensaje de error |
| | `titulo` | 22 | títulos de pantalla |
| `peso` | `medio` / `fuerte` | `"500"` / `"600"` | nombre de la fila / títulos y botones |
| `radio` | `normal` | 8 | botones y aviso |
| `opacidadApagado` | — | 0.6 | presionado, deshabilitado o en curso |

Los nombres exactos pueden ajustarse en la implementación. La condición es que cada valor de
la tabla salga del tema y que no cambie ningún valor.

## Boton

| Prop | Tipo | Notas |
|---|---|---|
| `texto` | `string` | lo que dice y lo que lee el lector de pantalla, salvo `accessibilityLabel` |
| `alPresionar` | `() => void` | |
| `variante` | `"primario" \| "aviso" \| "texto"` | por defecto `"primario"` |
| `deshabilitado` | `boolean?` | |
| `enCurso` | `boolean?` | deshabilita y muestra `textoEnCurso` |
| `textoEnCurso` | `string?` | por defecto el mismo `texto` |
| `accessibilityLabel` | `string?` | para "Cerrar sin cambiar de usuario" |
| `hitSlop` | `number?` | para "Cerrar" |
| `style` | `StyleProp<ViewStyle>?` | solo para ubicarlo (márgenes) |

Accesibilidad: `accessibilityRole="button"`,
`accessibilityState={{ disabled: deshabilitado || enCurso, busy: enCurso }}`. Con
`deshabilitado` o `enCurso`, `onPress` no se dispara.

## SegunConsulta

```ts
interface ConsultaMostrable<T> {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data: T | undefined;
  isFetching: boolean;
  refetch: () => unknown;
}
interface PropsSegunConsulta<T> {
  consulta: ConsultaMostrable<T>;
  mensajeVacio: string;
  esVacio?: (datos: T | undefined) => boolean; // por defecto: undefined, null o []
  children: (datos: T) => React.ReactNode;
}
```

Las reglas de prioridad están en [research.md R8](./research.md#r8-segunconsulta-los-cuatro-estados-en-una-pieza).
Depende solo de `useConexion()` (base) y de las clases de error de `src/api`.

## EstadoConexion (contrato de la base)

Mismo tipo que en la 002, ahora definido en `src/conexion/conexion.tsx`:

```ts
interface EstadoConexion {
  servidor: "disponible" | "no-disponible";
  enCurso: boolean;
  automaticosRestantes: number;
  reintentarAhora: () => Promise<void>;
  urlBase: string;
}
```

`ConexionProvider({ valor, children })` lo provee y `useConexion()` lo lee (si falta el
provider, lanza un error que lo dice). `SesionProvider` arma el valor igual que el
`useConexion` de hoy: `servidor` es `"no-disponible"` solo en fase `con-usuario` con el
servidor no disponible.

## Cliente en React (contrato de la base)

`ClienteApiProvider({ cliente, children })` y `useClienteApi(): ClienteApi`, en
`src/consultas/cliente-api.tsx`. `SesionProvider` provee el cliente que crea su controlador.

## DependenciasSesion / Dependencias

```ts
// features/sesion: lo que la sesión necesita (inyectado por props a SesionProvider)
interface DependenciasSesion {
  urlBase: string;
  usuarioRecordado: RepositorioUsuarioRecordado;
  queryClient: QueryClient;
  crearCliente(opciones: OpcionesCliente): ClienteApi;
  registrarOyenteDeErrores(oyente: (error: unknown) => void): () => void;
}
// composicion.ts: las dependencias de la app; hoy coinciden con DependenciasSesion
type Dependencias = DependenciasSesion;
```

`DependenciasProvider` y `useDependencias` se eliminan (nadie más los usa, R2).

## Pedido HTTP

| Campo | Tipo | Regla |
|---|---|---|
| `metodo` | `"GET" \| "POST" \| "PUT" \| "PATCH" \| "DELETE"` | |
| `ruta` | `string` | relativa a `urlBase` (`"/usuarios"`) |
| `cuerpo` | `unknown?` | si está: JSON + `Content-Type: application/json` |
| `signal` | `AbortSignal?` | cancelación externa, encadenada al tiempo límite |
| `usuarioId` | `string \| null`? | si está (incluido `null`), reemplaza al usuario actual |

Resultado: `T` (cuerpo JSON), `undefined` (204) o un error tipado (`ErrorDeApi`,
`ServidorNoDisponibleError`, o el error de cancelación tal cual). Detalle en
[contracts/cliente-api.md](./contracts/cliente-api.md).
