# Quickstart: Reseñas de eventos (012)

Guía para validar la feature de punta a punta. Contratos: [api.md](./contracts/api.md) y
[app.md](./contracts/app.md). Datos: [data-model.md](./data-model.md#seed-r10).

## Requisitos

- `npm install` en la raíz.
- `npm start` (servidor con el seed) y `npm run mobile` (Expo Go en el celular, ver README).

## Verificación automática

```sh
npm run test:foco -w backend -- tests/domain/resenia.test.ts tests/services/resenia.service.test.ts tests/api/resenias.test.ts
npm run test:foco -w mobile -- tests/pantallas/reseniar-evento.test.tsx tests/pantallas/detalle-evento.test.tsx
npm test && npm run lint && npm run typecheck && npm run format:check   # al cerrar cada fase
```

## Escenarios manuales

### 1. Puntaje real en el catálogo (US3)

1. En Explorar, elegir "Mejor puntaje primero".
2. Esperado:
   - primero los eventos de Martín ("4,7 · 3 reseñas");
   - después los de Sofía ("2,5 · 2 reseñas");
   - al final los de Lucía ("Sin reseñas").

   El orden es distinto del orden por fecha (SC-005).

### 2. Sección "Reseñas del organizador" (US2)

1. Abrir "Hamlet" (Martín). La sección muestra "4,7 · 3 reseñas", igual que la tarjeta. Debajo, las
   tres reseñas de "Jazz en el Patio", de la más reciente a la más vieja, con autor y fecha.
2. Abrir "Clásico de básquet" (Sofía). Hay una reseña sin comentario: solo la puntuación, sin texto
   de relleno.
3. Abrir "Noche de Rock" (Lucía): "Todavía no tiene reseñas", sin puntaje.
4. Como Martín, abrir "Hamlet" (su evento): la misma sección.

### 3. Reseñar desde "Mis compras" (US1)

1. Como **Martín**, ir a "Mis compras". La compra de la Peña (`UTILIZADA`, "1 de 3") muestra
   "Reseñar evento". Las demás no.
2. Tocarlo, elegir 4, escribir "Muy buena organización" y "Enviar".
3. Esperado:
   - la app vuelve a "Mis compras" y la fila muestra la reseña (4 y el comentario), sin el botón;
   - "Tu compra" de esa compra muestra lo mismo;
   - en Explorar, los eventos de Lucía pasan a "4,0 · 1 reseña";
   - la sección del detalle de la Peña la muestra primera.

### 4. Rechazos (API)

Con Postman (`backend/src/docs/ai-ticket-it.postman_collection.json`) o `curl`:

| Pedido | Esperado |
|---|---|
| Martín reseña de nuevo la Peña | 409 `RESENIA_REPETIDA` |
| Sofía reseña la Peña (su compra está `CONFIRMADA`) | 409 `SIN_COMPRA_UTILIZADA` |
| Lucía reseña la Peña (la organiza) | 409 `RESENIA_PROPIO_EVENTO` |
| `puntuacion: 6`, `4.5` o ausente; `comentario` de 501 caracteres | 400 con el detalle en `body.puntuacion` / `body.comentario` |
| `evento-no-existe` | 404 `EVENTO_NO_ENCONTRADO` |
| sin `X-Usuario-Id` | 401 |

Después de cada rechazo, `GET /eventos/evento-pena-en-la-rueda/resenias-del-organizador` sigue
igual.

### 5. Formulario en la app

- Enviar sin elegir puntuación: el error del servidor aparece junto a la puntuación y se conserva
  el comentario.
- Doble toque en "Enviar": un solo pedido.
- Elegir una puntuación y volver atrás: "¿Descartar los cambios?". Sin cambios, sale directo.
- Con el servidor apagado, enviar: la franja de servidor no disponible. La reseña no queda
  guardada y no se reintenta.
