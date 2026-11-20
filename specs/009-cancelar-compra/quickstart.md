# Quickstart: Cancelar compra con reembolso (009)

Guía de validación de punta a punta. Contratos en [contracts/api.md](./contracts/api.md) y
[contracts/app.md](./contracts/app.md); datos del seed en [data-model.md](./data-model.md#seed-backendsrcseeddatos-ejemplots-r11).

## Calidad

Desde la raíz, todo en verde:

```bash
npm test
npm run lint
npm run typecheck
npm run format:check
```

Durante el TDD, solo el test de la tarea (`npm run test:foco -w backend -- tests/domain/compra.test.ts`,
`npm run test:foco -w mobile -- tests/pantallas/compra.test.tsx`).

## Pedidos directos (servidor con el seed: `npm start`)

Cada bloque arranca con el servidor recién iniciado (los datos vuelven al seed al reiniciar).

| # | Pedido | Esperado |
|---|---|---|
| 1 | `GET /api/compras/compra-martin-festival-vip` como Martín | `CONFIRMADA`, `cancelable: true`, `motivoNoCancelable: null`, `reembolso: null` |
| 2 | `POST /api/compras/compra-martin-festival-vip/cancelacion` como Martín | 200, `CANCELADA`, `canceladaDesde: "CONFIRMADA"`, `reembolso: { "pendiente", 240000 }`, `entradas: []`; el historial termina en `CANCELADA` por Martín |
| 3 | `GET /api/eventos/evento-festival-sonidos-del-sur` | VIP con cupo 50 (subió 2) |
| 4 | repetir 2 | 409 `TRANSICION_INVALIDA` "La compra ya está cancelada."; el cupo sigue en 50 |
| 5 | `GET /api/compras/compra-martin-pena-general` como Martín | `UTILIZADA`, `cancelable: false`, `motivoNoCancelable: "entrada-usada"` |
| 6 | `POST /api/compras/compra-martin-pena-general/cancelacion` como Martín | 409 `TRANSICION_INVALIDA` "Ya se usó una entrada…" |
| 7 | `POST /api/compras/compra-sofia-pena-con-cena/cancelacion` como Lucía | 403 `SIN_PERMISO` |
| 8 | `POST /api/compras/compra-sofia-pena-con-cena/cancelacion` como Sofía | 200 `CANCELADA` con reembolso pendiente de 30000 |
| 9 | `GET /api/eventos/evento-pena-en-la-rueda/entradas/PRCS2B01` como Lucía, después de 8 | `estado: "CANCELADA"`; `POST …/PRCS2B01/uso` → 409 "La compra de esta entrada está cancelada." |
| 10 | `GET /api/eventos/evento-maraton-10k/compras` como Lucía | Diego `CANCELADA` con `reembolso: { "pendiente", 30000 }`; Valentina `REEMBOLSADA` con `reembolso: { "confirmado", 60000 }`; Inscripción con 1000 disponibles y 0 vendidas |
| 11 | `POST /api/compras/compra-diego-maraton-inscripcion/reembolso` como Diego | 403 `SIN_PERMISO` |
| 12 | lo mismo como Lucía | 200 `REEMBOLSADA`, `reembolso.estado: "confirmado"`; el cupo sigue en 1000 |
| 13 | repetir 12 | 409 `TRANSICION_INVALIDA` "El reembolso de esta compra ya se confirmó." |
| 14 | `POST /api/compras/compra-diego-festival-general/reembolso` como Lucía | 409 "Esta compra no tiene un reembolso pendiente." (venció sin pagarse) |
| 15 | `POST /api/compras/no-existe/reembolso` como Lucía · sin `X-Usuario-Id` | 404 `COMPRA_NO_ENCONTRADA` · 401 |

Los bordes de hora (cancelar a la hora exacta de inicio → 409 `EVENTO_REALIZADO`; un minuto antes →
200) y las carreras (uso ‖ cancelación, dos cancelaciones, dos reembolsos) se validan con el reloj
fijo de los tests de services y de concurrencia, no a mano.

Postman: la carpeta de la 009 de `backend/src/docs/ai-ticket-it.postman_collection.json` tiene estos
pedidos.

## Recorrido en la app (Expo Go)

`npm start` y `npm run mobile`, con el servidor recién iniciado.

1. **Cancelar (US1)**: elegir a Martín → "Mis compras" → "Festival Sonidos del Sur" → "Tu compra"
   muestra "Cancelar compra". Tocarlo: el `Alert` dice 2 entradas, $ 240.000, que el organizador
   confirma el reembolso y que no se puede deshacer. "Volver" no cambia nada; "Cancelar compra"
   deja la compra "Cancelada" con "Cancelaste esta compra. El organizador tiene que confirmar el
   reembolso de $ 240.000" y sin la lista de entradas. "Volver al evento": VIP muestra 50
   disponibles y "Comprar" deja elegir hasta 4.
2. **No cancelable (US3)**: Martín → "Mis compras" → "Peña en La Rueda": en lugar del botón dice "Ya
   usaste una entrada". En "Mis compras" ninguna fila tiene "Cancelar".
3. **Reembolso (US2)**: Perfil → cambiar a Lucía → "Mis eventos" → "Maratón Ciudad 10K" → "Ver
   compras": la fila de Diego dice "La canceló el comprador · Reembolso pendiente de $ 30.000" con
   "Confirmar reembolso"; la de Valentina, "Reembolso confirmado", sin botón. Confirmar el de Diego
   (el `Alert` nombra a Diego Fernández y $ 30.000): la fila pasa a "Reembolsada". En "Festival
   Sonidos del Sur" → "Ver compras" también aparece la de Martín del paso 1 con su botón.
4. **Lo ve el comprador (US5)**: cambiar a Diego → "Mis compras": la del Maratón dice "Te devolvimos
   $ 30.000" y la del Festival, "Venció sin pagarse". Cambiar a Valentina: "Te devolvimos $ 60.000".
5. **Entrada anulada**: como Sofía, cancelar su compra de la Peña desde "Tu compra" (antes del
   inicio); como Lucía, "Registrar ingreso" con `PRCS-2B01`: "La compra de esta entrada está
   cancelada." y sin botón de confirmar.
6. **Errores**: con "Tu compra" de una confirmada abierta, cortar el servidor y tocar "Cancelar
   compra" → el aviso de error y la franja de servidor no disponible; al volver, el estado real. Un
   doble toque rápido en "Confirmar reembolso" manda un solo pedido.
7. **Accesibilidad**: con TalkBack, "Confirmar reembolso" se enfoca aparte de la fila y el motivo
   "Ya usaste una entrada" se lee como texto; todo entra en 360 px.
