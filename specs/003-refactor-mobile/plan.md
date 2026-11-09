# Implementation Plan: Refactor de la arquitectura mobile

**Branch**: `feature/003-refactor-mobile` | **Date**: 2026-11-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-refactor-mobile/spec.md`

## Summary

La feature reorganiza `mobile/` sin cambiar nada de lo que se ve. Queda una **base**
(`api/`, `consultas/`, `conexion/`, `componentes/`), dos **features** (`features/usuarios/` y
`features/sesion/`, cada una con su `index.ts` público) y dos **conectores**
(`composicion.ts`, `navegacion/`). `app/` pasa a tener solo re-exports de una línea.

Para cortar los ciclos de hoy y los que aparecerían con las features:
- la base define los contratos `EstadoConexion`/`useConexion` y `useClienteApi`, y
  `SesionProvider` los implementa y los provee;
- las dependencias de la sesión llegan por props en lugar de por contexto;
- `SecuenciaDeReintentos` pasa a la feature `sesion`.

El lint hace cumplir las reglas con `eslint-plugin-import-x`: `no-cycle`, y
`no-restricted-paths` con zonas calculadas a partir de las carpetas. Un test de arquitectura
verifica que cada regla falla cuando corresponde.

Las rutas quedan tipadas con `experiments.typedRoutes`. Como en SDK 58 los tipos solo se
generan al levantar el servidor de desarrollo, un script de `typecheck` los genera antes de
`tsc`, también en el CI. Un archivo con `@ts-expect-error` hace de guarda.

Piezas base:
- `tema` con los valores exactos de hoy;
- `Boton` con las variantes `primario`, `aviso` y `texto`;
- `SegunConsulta`, que maneja los cuatro estados (el selector migra a ella);
- formato puro de usuario.

El cliente HTTP suma `pedir(metodo, ruta, { cuerpo, signal, usuarioId })` y los atajos
`get/post/put/patch/delete`, con JSON + `Content-Type`, resultado `undefined` para el 204 y el
mismo manejo de errores, tiempo límite y 401 de la 002. Al final se actualizan `AGENTS.md`, la
skill `nueva-pantalla` y el backlog (renumeración 003–011 → 004–012 y deuda técnica del store
de sesión). Decisiones en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript strict (en `mobile/`, la versión fijada por la 002, `~6.0`)

**Primary Dependencies**: las de la 002 (Expo SDK 58, Expo Router, TanStack Query v5,
AsyncStorage). **Nuevas, solo de desarrollo, en la raíz**: `eslint-plugin-import-x` (4.x, peer
`eslint ^10`) y `eslint-import-resolver-typescript` (R4)

**Storage**: N/A (sin cambios: AsyncStorage solo para el usuario recordado)

**Testing**: Jest + jest-expo + RNTL con `renderConDependencias` y `crearFetchFalso` (que suma
el registro del cuerpo); test de arquitectura que corre ESLint como proceso hijo; guarda de
tipos compilada por `tsc`

**Target Platform**: Android con Expo Go (iOS compatible), como en la 002

**Project Type**: mobile-app dentro del monorepo (`backend/`, `shared/`, `mobile/`)

**Performance Goals**: sin cambios para quien usa la app. La suite de mobile sigue por debajo
de 1 min (el test de arquitectura suma algunos segundos por las corridas de ESLint)

**Constraints**: cero cambios visibles (FR-001); firmas de `useSesion`, `useClienteApi` y
`useConexion` intactas (FR-002); los tests existentes solo cambian de lugar o de imports
(FR-003); sin tocar el backend; typecheck del CI sin levantar Expo

**Scale/Scope**: unos 40 archivos movidos o tocados en `mobile/`, 2 features, 4 carpetas de
base, 8 archivos en `app/`, ~5 tests nuevos, 3 documentos (`AGENTS.md`, skill, backlog)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple el plan | Estado |
|---|---|---|
| I. Spec-Driven | Spec clarificada (4 decisiones); plan → tasks → implement; el backlog se actualiza (FR-022) | ✅ |
| II. Test-First | Primero los tests de lo nuevo (formato, `Boton`, `SegunConsulta`, `pedir`/204/cuerpo/401 en escritura, mutation no repetida, reglas de lint, guarda de rutas), cada uno con un stub de firma real. Lo que se mueve queda cubierto por los tests de pantalla de la 002, que se corren antes y después de cada movimiento | ✅ |
| III. Capas | Aplica al backend (no se toca). En mobile, el espíritu se refuerza: dependencias en un solo sentido (`app → navegacion → features → base`), contratos en la base implementados por la feature `sesion` (inversión de dependencias) y composición por props desde un único composition root | N/A |
| IV. Persistencia en memoria | Sin cambios | N/A |
| V. Contrato de API | Sin endpoints nuevos. El cliente sigue traduciendo el formato único `ErrorApi` para todo método; 204 sin cuerpo | ✅ |
| VI. Identidad simulada | `X-Usuario-Id` y el 401 `USUARIO_NO_IDENTIFICADO` iguales para todo método | ✅ |
| VII. App Mobile | Todo `fetch` sigue en `src/api/` (la regla de lint se mantiene); los cuatro estados quedan en una pieza reutilizable; las funciones de endpoint siguen en `src/api/` con un archivo por recurso (clarificación 1); sin librerías de UI ni de estado (botón y tema propios) | ✅ |
| VIII. Tipos compartidos | Sin cambios; `UsuarioVista` sigue saliendo de `shared` | ✅ |
| IX. Calidad | `strict`; las cuatro verificaciones en verde y en el CI. Dos devDependencies y un script de generación justificados abajo. El único `@ts-expect-error` (la guarda de rutas) lleva su descripción | ✅ (con justificación) |

**Post-design re-check (Phase 1)**: sin violaciones. Hay tres puntos registrados en
Complexity Tracking: las dos dependencias de lint, el script que usa un módulo interno de Expo y
el contrato `useClienteApi` en la base. Este último no lo pedía la clarificación 3, pero aplica
la misma decisión a la otra pieza que causaría un ciclo `usuarios ↔ sesion` (R2). No hay
contradicciones con la spec. El plan fija algunos detalles que la spec dejó abiertos:
- las tres variantes de `Boton`, incluida `texto` para "Cerrar";
- que `SegunConsulta` trate `undefined`/`null`/`[]` como vacío;
- `post(ruta, cuerpo, opciones)` como forma de los atajos;
- la eliminación de `useDependencias`.

## Project Structure

### Documentation (this feature)

```text
specs/003-refactor-mobile/
├── plan.md              # este archivo
├── research.md          # Phase 0 (R1–R11)
├── data-model.md        # Phase 1: módulos, tema, Boton, SegunConsulta, contratos, pedido
├── quickstart.md        # Phase 1: cómo validar
├── contracts/
│   ├── estructura.md        # árbol, puntos de entrada públicos y reglas de dependencia
│   ├── cliente-api.md       # pedir + atajos, cuerpo JSON, 204 (delta del de la 002)
│   └── componentes-base.md  # Boton, SegunConsulta, tema, formato
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
eslint.config.js                 # + import-x: no-cycle, no-restricted-paths (zonas calculadas),
                                 #   no-restricted-imports en mobile/app; globals para mobile/scripts
package.json                     # + eslint-plugin-import-x, eslint-import-resolver-typescript
mobile/
├── app.json                     # + experiments.typedRoutes
├── package.json                 # typecheck = generar tipos de rutas + tsc
├── tsconfig.json                # include .expo/types/**/*.ts y expo-env.d.ts
├── scripts/generar-tipos-rutas.js
├── app/                         # re-exports de una línea (ver contracts/estructura.md)
├── src/
│   ├── api/                     # cliente con pedir/get/post/put/patch/delete
│   ├── consultas/               # + cliente-api.tsx (ClienteApiProvider, useClienteApi)
│   ├── conexion/                # conexion.tsx (contrato EstadoConexion), index.ts
│   ├── componentes/             # tema, Boton, SegunConsulta + los genéricos de la 002, index.ts
│   ├── features/
│   │   ├── usuarios/            # formato, useUsuarios, componentes/FilaUsuario, index
│   │   └── sesion/              # estado, validación, recordado, secuencia, controlador,
│   │                            #   SesionProvider, pantallas/{SeleccionarUsuario,Perfil}, index
│   ├── navegacion/              # RaizDeLaApp, LayoutRaiz, LayoutPestanas
│   └── composicion.ts           # sin contexto: crearDependencias / ...DeProduccion
└── tests/
    ├── api/ componentes/ consultas/ pantallas/ helpers/
    ├── features/{sesion,usuarios}/
    ├── arquitectura/reglas-de-dependencia.test.ts
    └── tipos/rutas-tipadas.ts
AGENTS.md                        # mapa de mobile/ nuevo, reglas de dependencia, endpoint de escritura
.claude/skills/nueva-pantalla/SKILL.md
docs/backlog.md                  # 003 = este refactor; 003–011 → 004–012; deuda técnica
```

**Structure Decision**: monorepo existente. Solo cambia `mobile/` (organización por feature), la
configuración de lint de la raíz y la documentación. `backend/` y `shared/` no se tocan.

### Orden de implementación sugerido

Cada paso deja `test`, `lint`, `typecheck` y `format:check` en verde:

1. **Red de seguridad**: correr la suite de la 002 y anotar el resultado de base.
2. **US3 — cliente** (independiente): extender `crearFetchFalso` con `cuerpo`; tests de
   `pedir`, atajos, 204 y 401 en escritura → implementación; test de mutation no repetida.
3. **US1 — lint y tipos primero**: dependencias de lint, zonas y test de arquitectura (con el
   código actual, la regla 2 todavía no tiene features que vigilar); `typedRoutes`, script y
   guarda de rutas.
4. **US1 — movimientos**: contratos de base (`conexion`, `cliente-api`) → feature `sesion`
   (incluida la secuencia, dependencias por props) → feature `usuarios` → `navegacion/` →
   `app/` a re-exports. Con `git mv` y corriendo los tests de pantalla después de cada paso.
5. **US2 — piezas base**: `tema` (reemplaza `estilos.ts`), `Boton` (migra `MensajeError`,
   Perfil, la franja y "Cerrar"), `formato` (migra `FilaUsuario` y Perfil), `SegunConsulta`
   (migra el selector).
6. **Documentación**: `AGENTS.md`, skill `nueva-pantalla`, backlog. Después, validación en el
   celular (quickstart §5).

## Complexity Tracking

| Agregado | Por qué hace falta | Alternativa más simple descartada porque |
|---|---|---|
| `eslint-plugin-import-x` + `eslint-import-resolver-typescript` (devDependencies) | FR-008 y FR-010 piden que el **lint** falle ante ciclos y ante imports que cruzan los límites de una feature. Hace falta resolver las rutas reales de los imports (relativos, `.tsx`, workspace `shared`) | `no-restricted-imports` del core solo ve el texto del import y no distingue la feature propia de otra. `madge`/`dependency-cruiser` agregan una herramienta y un comando fuera de ESLint |
| `mobile/scripts/generar-tipos-rutas.js`, que usa `@expo/router-server/build/typed-routes` (interno de Expo) | FR-009 exige que una ruta mal escrita falle **también en el CI**, y en SDK 58 los tipos solo los genera el servidor de desarrollo | Levantar `expo start` en el CI es lento y frágil; versionar el `.d.ts` se desactualiza. El script falla de forma explícita si el módulo cambia de lugar |
| `useClienteApi`/`ClienteApiProvider` en la base (`src/consultas/`) además del contrato de conexión | Sin esto, `usuarios` (que necesita el cliente) y `sesion` (que usa la lista de `usuarios`) quedan en un ciclo, prohibido por FR-008 | Fusionar las features contradice la clarificación 2; mover el selector a `usuarios` también |
