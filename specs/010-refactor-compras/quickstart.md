# Quickstart: Refactor de Mis compras, Compras del evento y Cancelación (010)

Cómo comprobar que el refactor **no cambió nada visible**. Formas internas en
[data-model.md](./data-model.md); contratos (externos sin cambios e internos nuevos) en
[contracts/interno.md](./contracts/interno.md).

## 1. Línea de base (antes de tocar código)

Sobre la rama recién creada, igual a `development`:

```bash
npm test && npm run lint && npm run typecheck && npm run format:check
```

**Snapshot de la semilla por la API**: un script temporal (en el scratchpad, **no se commitea**)
arma `crearApp({ reloj: relojFijo(INSTANTE) })` con un instante fijo y, con supertest, guarda en un
JSON las respuestas de estos pedidos:

| Pedido | Como |
|---|---|
| `GET /api/compras` | Martín, Diego, Valentina, Sofía |
| `GET /api/compras/:id` de cada compra del seed | su comprador |
| `GET /api/eventos/evento-pena-en-la-rueda/compras` y `GET /api/eventos/evento-maraton-10k/compras` | Lucía |
| `GET /api/eventos/evento-pena-en-la-rueda/entradas/PRGM3A01`, `…/PRGM3A02`, `GET /api/eventos/evento-maraton-10k/entradas/MZDF1C01`, `…/MZVG2R01` | Lucía |
| `GET /api/eventos/:eventoId/mis-compras` de los eventos con compras | cada comprador |
| `GET /api/eventos` y `GET /api/eventos/:eventoId` de los eventos con compras | sin usuario |

Se guarda como `antes.json`. Al terminar la feature se corre el mismo script → `despues.json`, y
`diff antes.json despues.json` DEBE estar vacío (FR-004, US1 escenario 8).

## 2. Ciclo de TDD (durante cada fase)

Solo el test de la tarea:

```bash
npm run test:foco -w backend -- tests/domain/entrada.test.ts
npm run test:foco -w backend -- tests/domain/reglas-de-compra.test.ts
npm run test:foco -w backend -- tests/domain/compra.test.ts tests/domain/compras-del-evento.test.ts
npm run test:foco -w backend -- tests/services/compra.service.test.ts tests/services/entrada.service.test.ts
npm run test:foco -w backend -- tests/services/concurrencia-compras.test.ts tests/api/entradas.test.ts
npm run test:foco -w mobile -- tests/pantallas/registrar-ingreso.test.tsx
npm run test:foco -w mobile -- tests/pantallas/compras-del-evento.test.tsx tests/pantallas/compra.test.tsx
```

## 3. Al cerrar cada fase y antes del PR

```bash
npm test && npm run lint && npm run typecheck && npm run format:check
```

## 4. Verificaciones de "sin cambios" (SC-001, SC-002)

```bash
git diff --stat development -- shared backend/src/docs          # vacío
git diff --stat development -- backend/tests/api                # vacío
git diff development -- mobile/tests/pantallas                  # solo las aserciones de invalidación
                                                                # de registrar-ingreso.test.tsx
```

## 5. Verificaciones de diseño

| Qué | Cómo | Esperado |
|---|---|---|
| `compra.ts` ≤ 300 líneas (SC-005) | `wc -l backend/src/domain/compra.ts` | ≤ 300 |
| Sin la coherencia combinada (SC-005) | `grep -n "entradasCoherentes\|sonEntradasValidas\|cantidadValida ||" backend/src/domain` | sin resultados |
| Sin la forma vieja de la entrada | `grep -rn "estadoEn(\|ultimoEstadoPropio\|tieneCambioA\|\.cambios\b\|tieneReembolsoPendiente" backend/src backend/tests` | sin resultados (salvo `cambios` de `Evento` y de los ayudantes de eventos) |
| Un solo service de casos de uso que guarda compras (SC-004) | `grep -rn "compras.guardar\|#compras.guardar" backend/src/services` | solo `compra.service.ts` y `vencimiento.service.ts` |
| `EntradaService` sin repositorio ni cerrojo | `grep -n "RepositorioCompras\|cerrojo" backend/src/services/entrada.service.ts` | sin resultados |
| Una sola definición de "entrada usada" (SC-004) | `grep -rn "UTILIZADA" backend/src/domain/compras-del-evento.ts` | sin resultados |
| Sin ternarios anidados en "Registrar ingreso" (FR-019) | leer `RegistrarIngreso.tsx`, `BuscadorDeCodigo.tsx`, `ResultadoDeIngreso.tsx` | ningún `? … : … ? …` |
| Registrar un ingreso no pide el evento ni el catálogo (SC-007) | `registrar-ingreso.test.tsx` ("registrar con éxito…") | sin invalidación de `["catalogo"]` ni `predicate` |

## 6. En el celular (SC-008)

Con `npm start` y `npm run mobile` (Expo Go), repetir los recorridos de
`specs/007-mis-compras/quickstart.md`, `specs/008-compras-de-evento/quickstart.md` y
`specs/009-cancelar-compra/quickstart.md`. Puntos de atención:

1. Como Lucía, "Mis eventos" → Peña en La Rueda → "Ver compras": resumen por tipo con 1 usada en
   General; "Registrar ingreso" con `PRGM-3A02` → "Registrar" → "Ingreso registrado: Martín Benítez ·
   General", el campo vacío y enfocado; volver: "Compras del evento" muestra 2 usadas.
2. En "Registrar ingreso": `PRGM-3A01` (ya usada) muestra su motivo en lugar del botón; `ZZZZ-ZZZZ`,
   "No hay ninguna entrada con ese código en este evento."; `MZDF-1C01` en el Maratón (cancelada),
   su motivo.
3. Como Lucía, Maratón → "Ver compras": "Confirmar reembolso" en la de Diego; tocar dos veces
   "Confirmar" en el diálogo manda un solo pedido.
4. Como Martín, "Mis compras" y "Tu compra" de la Peña: "1 de 3 entradas usadas" (o 2 tras el
   paso 1) y los códigos en "Tus entradas".
5. Como Valentina, "Tu compra" del Maratón: "Te devolvimos $ 60.000".
