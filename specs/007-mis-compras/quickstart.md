# Quickstart: Mis compras (007)

Guía para verificar la feature de punta a punta. Los contratos están en
[contracts/api.md](./contracts/api.md) y [contracts/app.md](./contracts/app.md), y el modelo en
[data-model.md](./data-model.md).

## Requisitos

- `development` con la 006 integrada; rama `feature/007-mis-compras`.
- `npm install` en la raíz.

## Calidad

| Momento | Comando | Esperado |
|---|---|---|
| ciclo de TDD (backend) | `npm run test:foco -w backend -- tests/domain/dias-restantes.test.ts` (o el archivo de la tarea) · `npm run test:afectados -w backend` | solo ese test, primero rojo y después verde |
| ciclo de TDD (mobile) | `npm run test:foco -w mobile -- tests/pantallas/mis-compras.test.tsx` | lo mismo |
| cierre de cada fase y PR | `npm test` · `npm run lint` · `npm run typecheck` · `npm run format:check` | todo en verde |

Tests clave:

| Regla | Test |
|---|---|
| días de calendario en Buenos Aires: 23:59, medianoche, hoy, inicio exacto | `backend/tests/domain/dias-restantes.test.ts` |
| orden en dos bloques y desempates | `backend/tests/domain/orden-mis-compras.test.ts` |
| solo las propias, al día sin guardar, días solo en confirmadas, `canceladaPor`, dos lecturas | `backend/tests/services/compra.service.test.ts` |
| 401, forma de la vista, seed | `backend/tests/api/compras.test.ts` · `docs.test.ts` |
| textos y espera hasta el próximo vencimiento | `mobile/tests/features/compras/{formato,vencimientos}.test.ts` |
| cuatro estados, cinco estados de compra, foco, vencimiento con la lista abierta, cambio de usuario | `mobile/tests/pantallas/mis-compras.test.tsx` |

## Pedidos directos (servidor con los datos de ejemplo)

```bash
npm start   # http://localhost:3000/api, documentación en /api/docs
API=http://localhost:3000/api

curl -i "$API/compras"                                        # 401 USUARIO_NO_IDENTIFICADO
curl -s -H "X-Usuario-Id: usuario-martin" "$API/compras"      # CONFIRMADA, diasRestantes 30
curl -s -H "X-Usuario-Id: usuario-diego"  "$API/compras"      # CANCELADA, canceladaPor "sistema"
curl -s -H "X-Usuario-Id: usuario-lucia"  "$API/compras"      # [] (organiza el Festival, no compró)

# Comprar sin pagar como Sofía y ver la pendiente en la lista
curl -s -X POST -H "X-Usuario-Id: usuario-sofia" -H "Content-Type: application/json" \
  -d '{"tipoEntradaId":"tipo-festival-sonidos-del-sur-vip","cantidad":1}' \
  "$API/eventos/evento-festival-sonidos-del-sur/compras"
curl -s -H "X-Usuario-Id: usuario-sofia" "$API/compras"       # PENDIENTE con venceEnLocal
# A los 15 minutos, el mismo pedido la trae CANCELADA (canceladaPor "sistema") sin que nadie haya escrito
```

## Recorrido en la app (Expo Go)

1. `npm start` y `npm run mobile`; abrir la app en el teléfono.
2. Elegir a **Martín** y abrir "Mis compras": aparece "Festival Sonidos del Sur" con la fecha,
   "VIP · 2 entradas · $ 240.000", "Confirmada" y "Faltan 30 días". Al tocar la fila se abre
   "Tu compra".
3. Cambiar a **Diego** desde Perfil y volver a "Mis compras": no aparece ninguna compra de
   Martín, ni mientras carga. Se ve la del Festival como "Cancelada" con "Venció sin pagarse".
4. Cambiar a **Lucía**: "Todavía no compraste entradas" y "Ir a Explorar", que abre Explorar.
5. Como **Sofía**, comprar 1 VIP del Festival sin pagar e ir a "Mis compras": "Pendiente",
   "Podés pagar hasta las HH:MM" y "Pagar". Tocar "Pagar", pagar y volver: "Confirmada" y
   "Faltan 30 días".
6. Comprar otra sin pagar, cancelarla desde "Tu compra" y volver: "Cancelada" con "La
   cancelaste".
7. Comprar otra sin pagar y dejar "Mis compras" abierta 15 minutos: al llegar la hora límite, la
   fila pasa sola a "Cancelada" con "Venció sin pagarse" y sin "Pagar".
8. Apagar el servidor y volver a la pestaña: aparece la franja de servidor no disponible. Si la
   lista no estaba cargada, se ve el error con reintento.
