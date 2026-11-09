# Quickstart: validar el refactor de la arquitectura mobile (003)

Cómo comprobar que el refactor cumple la spec. El comportamiento de referencia es el de
[`specs/002-base-mobile/quickstart.md`](../002-base-mobile/quickstart.md).

## Requisitos

- `npm install` en la raíz (instala `eslint-plugin-import-x` y
  `eslint-import-resolver-typescript`).
- Para la parte en el celular: lo mismo que la 002 (Expo Go SDK 58, misma red que la PC).

## 1. Calidad en verde (SC-001)

```bash
npm test && npm run lint && npm run typecheck && npm run format:check
```

Esperado: todo en verde. En `mobile/`, `npm run typecheck` primero genera
`mobile/.expo/types/router.d.ts` (R5) y después corre `tsc`. En el CI pasa lo mismo, sin pasos
nuevos en el workflow.

## 2. Reglas de estructura (US1, SC-003, SC-004)

Automático: `tests/arquitectura/reglas-de-dependencia.test.ts` (dentro de `npm test`).
A mano, para verlo fallar (y deshacer después cada cambio):

| Cambio a propósito | Comando | Esperado |
|---|---|---|
| en `mobile/src/api/errores.ts`, agregar `import "./cliente";` | `npm run lint` | `import-x/no-cycle` en `errores.ts` |
| en `mobile/src/componentes/Cargando.tsx`, importar `../features/sesion` | `npm run lint` | `import-x/no-restricted-paths` (la base no importa features) |
| en `mobile/src/features/sesion/pantallas/Perfil.tsx`, importar `../../usuarios/formato` | `npm run lint` | `import-x/no-restricted-paths` (solo el `index.ts` de otra feature) |
| en `mobile/app/cargando.tsx`, importar algo de `react-native` | `npm run lint` | `no-restricted-imports` |
| en `Perfil.tsx`, cambiar la ruta a `"/seleccionar-usuarios"` | `npm run typecheck` | error de tipos en la ruta |

Revisión visual: cada archivo de `mobile/app/` tiene una sola sentencia y ninguno define
estilos.

## 3. Piezas base (US2)

- `npm test -w mobile -- componentes features/usuarios`: los tests de `Boton`, `SegunConsulta`
  (los cuatro estados, los dos tipos de reintento y la consulta cancelada) y `formato` pasan.
- `grep -rn "#[0-9a-fA-F]\{6\}" mobile/src --include=*.tsx`: sin resultados (los colores
  salen del tema).
- El selector no tiene su propio bloque `isPending/isError` (SC-005).

## 4. Cliente HTTP (US3)

`npm test -w mobile -- api`: cubre `pedir` y los atajos con y sin cuerpo (JSON y
`Content-Type`), el 204, los errores del servidor, el tiempo límite, la cancelación y el 401
`USUARIO_NO_IDENTIFICADO` en una escritura. `tests/pantallas/errores-en-uso.test.tsx` verifica
que un `POST` que cae con servidor no disponible no se repite al recuperarse (FR-020).

## 5. En el celular, sin cambios visibles (SC-002, FR-001)

Con `npm start` (servidor) y `npm run mobile`, repetir los recorridos del quickstart de la
002 (primer arranque, usuario recordado, cambio de usuario, servidor no disponible con la
franja y el reintento, usuario inexistente con el aviso). Esperado: mismos textos, colores,
botones y comportamiento que antes del refactor. Además, `expo start` no deja cambios en
`mobile/tsconfig.json` (`git status` limpio).
