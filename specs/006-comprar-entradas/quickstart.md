# Quickstart: Comprar entradas (006)

Guía para verificar la feature de punta a punta. Contratos en
[contracts/api.md](./contracts/api.md) y [contracts/app.md](./contracts/app.md); modelo en
[data-model.md](./data-model.md).

## Requisitos

- `development` actualizada con la 004 y la 005 integradas; rama `feature/006-comprar-entradas`.
- `npm install` en la raíz.

## Calidad

| Momento | Comando | Esperado |
|---|---|---|
| ciclo de TDD (backend) | `npm run test:foco -w backend -- tests/domain/compra.test.ts` (o el archivo de la tarea) · `npm run test:afectados -w backend` | solo ese test, rojo y después verde |
| ciclo de TDD (mobile) | `npm run test:foco -w mobile -- tests/pantallas/comprar-entradas.test.tsx` | ídem |
| cierre de cada fase y PR | `npm test` · `npm run lint` · `npm run typecheck` · `npm run format:check` | todo en verde |

Tests clave de la feature:

| Regla | Test |
|---|---|
| vencimiento a los 15 min exactos, transiciones, historial con autor | `backend/tests/domain/compra.test.ts` |
| tope 4 pagas / 1 por tipo gratis, precio cambiado | `backend/tests/domain/tope-por-persona.test.ts` |
| descontar y devolver cupo, cupo justo, realizado, propio evento | `backend/tests/domain/evento.test.ts` |
| alta, pago, lecturas al día, materialización en ediciones de la 004 | `backend/tests/services/compra.service.test.ts` · `vencimiento.service.test.ts` · `evento.service.test.ts` · `tipo-entrada.service.test.ts` |
| 50 compras simultáneas sobre cupo 10, tope simultáneo, pago en el límite, doble pago | `backend/tests/services/concurrencia-compras.test.ts` |
| códigos y status de cada rechazo, OpenAPI cubre las rutas | `backend/tests/api/compras.test.ts` · `docs.test.ts` |
| recorrido de la app, errores, reintento | `mobile/tests/pantallas/{detalle-evento,comprar-entradas,compra}.test.tsx` |

## Pedidos directos (servidor con los datos de ejemplo)

```bash
npm start   # http://localhost:3000/api, documentación en /api/docs
```

```bash
API=http://localhost:3000/api
FESTIVAL=evento-festival-sonidos-del-sur

# Comprar 2 VIP como Sofía → 201 PENDIENTE, total 240000, venceEn = alta + 15 min
curl -s -X POST $API/eventos/$FESTIVAL/compras -H 'X-Usuario-Id: usuario-sofia' \
  -H 'Content-Type: application/json' \
  -d '{"tipoEntradaId":"tipo-festival-sonidos-del-sur-vip","cantidad":2}'

# El detalle muestra VIP con cupo 48
curl -s $API/eventos/$FESTIVAL

# Sus compras pendientes y lo que le queda de su tope (2 en los tipos pagos)
curl -s $API/eventos/$FESTIVAL/mis-compras -H 'X-Usuario-Id: usuario-sofia'

# Pagar → 200 CONFIRMADA; repetir → 409 TRANSICION_INVALIDA; como Diego → 403
curl -s -X POST $API/compras/<compraId>/pago -H 'X-Usuario-Id: usuario-sofia'
```

Rechazos para probar (todos dejan el cupo igual): `"cantidad": 0`, `-1`, `1.5`, `5` → 400;
tipo de otro evento → 400 sobre `body.tipoEntradaId`; `evento-noche-de-risas` → 409
`EVENTO_REALIZADO`; Lucía en el Festival → 409 `COMPRA_PROPIO_EVENTO`; Martín con 3 General →
409 `TOPE_POR_PERSONA`; las 3 Backstage y después 1 más → 409 `CUPO_INSUFICIENTE`.

El vencimiento se verifica en los tests con el reloj fijo (`crearApp({ reloj })`): con el
servidor real, una compra sin pagar vence a los 15 minutos y su cupo vuelve a verse en el detalle.

## Recorrido en la app (Expo Go)

```bash
npm start          # una terminal
npm run mobile     # otra; abrir con Expo Go
```

1. Elegir **Sofía**. En Explorar, abrir "Festival Sonidos del Sur": cada tipo tiene "Comprar".
2. "Comprar" en VIP → subir a 2 → "Total: $ 240.000" → "Confirmar compra" → "Tu compra" en
   "Pendiente", con "Podés pagar hasta las HH:mm".
3. "Pagar" → "Confirmada" → "Volver al evento": VIP con 48 disponibles (SC-001: 5 toques).
4. "Comprar" en VIP de nuevo: el selector no pasa de 2 ("Podés comprar hasta 2 entradas de este
   evento").
5. Comprar 1 VIP y volver atrás sin pagar: el detalle muestra "Tus compras pendientes" con
   "Pagar".
6. Cambiar a **Diego** y comprar las 3 Backstage: queda "Agotado" y sin "Comprar".
7. Cambiar a **Lucía** (organizadora) y abrir el Festival: "Sos el organizador de este evento",
   sin "Comprar".
8. En la Maratón, "Carrera kids" → "Total: Gratis" → "Confirmar compra" → "Confirmar" →
   "Confirmada"; después, "Ya tenés el máximo de entradas para este evento" en ese tipo.
9. Con el servidor apagado, "Confirmar compra" y "Pagar" avisan y dejan reintentar; al volver el
   servidor, la compra muestra su estado real.
