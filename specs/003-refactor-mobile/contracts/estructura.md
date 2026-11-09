# Contrato: estructura de `mobile/` y puntos de entrada públicos

Es lo que las features 004+ pueden usar y dónde va cada pieza nueva. Las reglas de dependencia
las hace cumplir el lint ([research.md R4](../research.md#r4-lint-de-dependencias-eslint-plugin-import-x)).

## Árbol

```text
mobile/
├── app/                                   # Expo Router: un re-export por archivo
│   ├── _layout.tsx                        # → navegacion/RaizDeLaApp
│   ├── cargando.tsx                       # → componentes (Cargando)
│   ├── seleccionar-usuario.tsx            # → features/sesion (SeleccionarUsuario)
│   └── (tabs)/
│       ├── _layout.tsx                    # → navegacion/LayoutPestanas
│       ├── index.tsx                      # <SeccionPendiente nombre="Explorar" />
│       ├── mis-compras.tsx                # <SeccionPendiente nombre="Mis compras" />
│       ├── mis-eventos.tsx                # <SeccionPendiente nombre="Mis eventos" />
│       └── perfil.tsx                     # → features/sesion (Perfil)
├── scripts/generar-tipos-rutas.js         # tipos de rutas para tsc (R5)
├── src/
│   ├── api/            cliente · direccion · errores · usuarios · index
│   ├── consultas/      query-client · claves · cliente-api (ClienteApiProvider, useClienteApi)
│   ├── conexion/       conexion (EstadoConexion, ConexionProvider, useConexion) · index
│   ├── componentes/    tema · Boton · Cargando · MensajeError · ListaVacia · SeccionPendiente
│   │                   · SegunConsulta · FranjaServidorNoDisponible · index
│   ├── features/
│   │   ├── usuarios/   formato · useUsuarios · componentes/FilaUsuario · index
│   │   └── sesion/     estado-sesion · validacion · usuario-recordado · secuencia-reintentos
│   │                   · controlador-sesion · SesionProvider · pantallas/{SeleccionarUsuario,
│   │                   Perfil} · index
│   ├── navegacion/     RaizDeLaApp · LayoutRaiz · LayoutPestanas
│   └── composicion.ts
└── tests/
    ├── api/ · componentes/ · consultas/ · pantallas/ · helpers/
    ├── features/sesion/ · features/usuarios/
    ├── arquitectura/reglas-de-dependencia.test.ts
    └── tipos/rutas-tipadas.ts             # lo compila tsc; Jest no lo corre
```

## Puntos de entrada públicos

| Módulo | Exporta |
|---|---|
| `src/api` | `crearClienteApi`, `ClienteApi`, `MetodoHttp`, `resolverUrlBase`, `ErrorDeApi`, `ServidorNoDisponibleError`, `listarUsuarios`, `obtenerUsuarioActual` |
| `src/consultas/cliente-api` | `ClienteApiProvider`, `useClienteApi` |
| `src/consultas/claves` · `query-client` | `claves` · `crearQueryClient`, `conectarFocoDeLaApp` |
| `src/conexion` | `EstadoConexion`, `ConexionProvider`, `useConexion` |
| `src/componentes` | `tema`, `Boton`, `Cargando`, `MensajeError`, `ListaVacia`, `SeccionPendiente`, `SegunConsulta`, `FranjaServidorNoDisponible` |
| `src/features/usuarios` | `useUsuarios`, `FilaUsuario`, `nombreCompleto`, `textoEventosOrganizados` |
| `src/features/sesion` | `SesionProvider`, `useSesion`, `DependenciasSesion`, `crearRepositorioUsuarioRecordado`, `Almacenamiento`, `RepositorioUsuarioRecordado`, `SeleccionarUsuario`, `Perfil` |

Firmas sin cambios (FR-002): `useSesion(): { estado, elegirUsuario, reintentar }`,
`useClienteApi(): ClienteApi`, `useConexion(): EstadoConexion`.

## Reglas (las verifica el lint)

| # | Regla | Regla de ESLint | Ejemplo que falla |
|---|---|---|---|
| 1 | Sin ciclos entre módulos | `import-x/no-cycle` | `src/api/errores.ts` importa `./cliente` |
| 2 | La base no importa features (salvo `composicion.ts` y `navegacion/`) | `import-x/no-restricted-paths` | `src/componentes/X.tsx` importa `../features/sesion` |
| 3 | Desde afuera de una feature, solo su `index.ts` | `import-x/no-restricted-paths` | `features/sesion/...` importa `../../usuarios/componentes/FilaUsuario` |
| 4 | `app/` sin lógica, estado ni estilos | `no-restricted-imports` en `mobile/app/**` | `app/x.tsx` importa `react-native` |

## Agregar una feature (ejemplo: 004 Crear evento)

1. `src/api/eventos.ts` con las funciones de endpoint ([cliente-api.md](./cliente-api.md)) y
   sus exports en `src/api/index.ts`; claves nuevas en `src/consultas/claves.ts`.
2. `src/features/eventos/`: `pantallas/`, `componentes/`, hooks de consulta y `formato.ts`, e
   `index.ts` con lo que usan `app/` u otras features.
3. `app/<ruta>.tsx`: `export { CrearEvento as default } from "../src/features/eventos";`.
4. Tests en `tests/features/eventos/` y de pantalla en `tests/pantallas/`.
