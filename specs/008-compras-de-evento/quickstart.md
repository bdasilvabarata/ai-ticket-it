# Quickstart: Compras de un evento (008)

Cómo comprobar que la feature funciona. Contratos en [contracts/api.md](./contracts/api.md) y
[contracts/app.md](./contracts/app.md); datos del seed en [data-model.md](./data-model.md).

## Calidad

Desde la raíz del repo, al cerrar cada fase y antes del PR:

```bash
npm test && npm run lint && npm run typecheck && npm run format:check
```

Durante TDD, solo el test de la tarea (por ejemplo):

```bash
npm run test:foco -w backend -- tests/domain/ventana-de-uso.test.ts
npm run test:foco -w mobile -- tests/pantallas/registrar-ingreso.test.tsx
```

## Pedidos directos (servidor con el seed)

`npm start` y, en otra terminal (o la carpeta "Compras del evento" de Postman):

| Pedido | Esperado |
|---|---|
| `GET /api/eventos/evento-pena-en-la-rueda/compras` con `X-Usuario-Id: usuario-lucia` | `200`; `ventanaDeUso.estado: "abierta"`; General 117 · 0 · 3 · 1 y Con cena 38 · 0 · 2 · 0; Sofía y Martín, la de Martín `UTILIZADA` con `entradasUsadas: 1` |
| lo mismo con `usuario-martin` | `403 SIN_PERMISO` |
| lo mismo sin header | `401 USUARIO_NO_IDENTIFICADO` |
| `GET /api/eventos/evento-inexistente/compras` (Lucía) | `404 EVENTO_NO_ENCONTRADO` |
| `GET /api/compras/compra-sofia-pena-con-cena` con `usuario-sofia` | `200` con `entradas` (2 códigos, `CONFIRMADA`) |
| `GET /api/eventos/evento-pena-en-la-rueda/entradas/<código de Sofía en minúsculas y con guion>` (Lucía) | `200`, la entrada `CONFIRMADA` con Sofía y "Con cena" |
| `POST …/entradas/<ese código>/uso` (Lucía) | `200`, `UTILIZADA`; la compra de Sofía pasa a `UTILIZADA` |
| el mismo `POST` otra vez | `409 TRANSICION_INVALIDA` "Esta entrada ya se utilizó." |
| `POST …/entradas/<el otro código de Sofía>/uso` | `200`; la compra sigue `UTILIZADA` y su historial no suma otro cambio |
| `GET /api/eventos/evento-festival-sonidos-del-sur/entradas/<código de Sofía>` (Lucía) | `404 ENTRADA_NO_ENCONTRADA` (es de otro evento) |
| `POST /api/eventos/evento-festival-sonidos-del-sur/entradas/<código VIP de Martín>/uso` (Lucía) | `409 FUERA_DE_HORARIO_DE_USO` (el Festival es en 30 días) |
| `GET /api/eventos/evento-pena-en-la-rueda/compras` (Lucía) después de los usos | Con cena: 38 disponibles, 2 vendidas, 2 usadas (el cupo no cambió) |

Los códigos fijos del seed están en `backend/src/seed/datos-ejemplo.ts`.

## Recorrido en la app (Expo Go)

1. **Organizador**: elegir a Lucía → Mis eventos → "Peña en La Rueda" → "Ver compras" (2 toques,
   SC-001). Se ven "Ingresos habilitados hasta…", el resumen por tipo y las compras de Sofía
   ("Confirmada") y Martín ("Utilizada", "1 de 3 entradas usadas").
2. **Comprador**: Perfil → cambiar a Sofía → Mis compras → la compra de la Peña → "Tus entradas"
   con dos códigos `XXXX-XXXX`, "Confirmada".
3. **Registrar ingreso**: volver a Lucía → "Ver compras" → "Registrar ingreso" → tipear uno de los
   códigos de Sofía en minúsculas → "Buscar" → tarjeta con Sofía, "Con cena", "Confirmada" →
   "Registrar ingreso" → confirmar → "Ingreso registrado: Sofía Castro · Con cena" (menos de 15 s,
   SC-004). Volver: la compra de Sofía figura "Utilizada", "1 de 2 entradas usadas", y Con cena
   dice 1 usada.
4. Buscar el mismo código otra vez → "Esta entrada ya se utilizó el …" y sin botón.
5. Cambiar a Sofía → "Tu compra" de la Peña: una entrada "Utilizada" y otra "Confirmada".
6. **Otra pendiente**: con Diego, comprar 1 "General" de la Peña sin pagar; con Lucía, la lista la
   muestra "Pendiente" con "Puede pagarla hasta las HH:mm" y el resumen suma 1 pendiente. Buscar
   uno de sus códigos no es posible (el comprador no los ve hasta confirmar; desde el servidor,
   `GET` del código devuelve `PENDIENTE` y la app muestra "La compra de esta entrada todavía no se
   pagó.").
7. **Festival** (fuera de la ventana): Lucía → Festival → "Ver compras": "Podés registrar
   ingresos desde el …"; Martín "Confirmada" y Diego "Cancelada" ("Venció sin pagarse").
8. **Fallas**: un evento propio sin compras (crear uno) → resumen con todo el cupo y "Todavía
   nadie compró entradas"; cortar el servidor → error con reintento.
