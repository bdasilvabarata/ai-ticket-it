# Quickstart: Paginación (013)

Guía para validar la feature de punta a punta con los datos de ejemplo (research R11). Los
contratos están en [contracts/api.md](./contracts/api.md) y [contracts/app.md](./contracts/app.md).

## Preparación

```bash
npm install
npm start          # servidor con el seed en memoria (http://localhost:3000/api)
npm run mobile     # Metro; abrir con Expo Go
```

## 1. API (curl o Postman)

| Pedido | Esperado |
|---|---|
| `GET /api/eventos` | 10 eventos y `pagina` = `{ numero: 1, tamano: 10, totalElementos: 12, totalPaginas: 2 }` |
| `GET /api/eventos?pagina=2` | 2 eventos, los que siguen en el mismo orden |
| `GET /api/eventos?pagina=9` | la página 2, con `"numero": 2` |
| `GET /api/eventos?pagina=0` · `?pagina=abc` | `400 ENTRADA_INVALIDA`, detalle `query.pagina` |
| `GET /api/eventos?orden=puntaje` | el primer evento es uno de Martín (≈ 4,73) |
| `GET /api/eventos?texto=zzz` | `eventos: []`, `totalPaginas: 0`, `numero: 1`, `hayEventosProximos: true` |
| `GET /api/eventos/evento-festival-sonidos-del-sur/compras` con `X-Usuario-Id: usuario-lucia` | 10 compras, `cantidadCompras: 12`, `totalPaginas: 2` |
| lo mismo con `?pagina=2` | 2 compras; `resumenPorTipo`, `ventanaDeUso` y `comprasConMensajesSinResponder` iguales que en la página 1 |
| lo mismo con `?estado=CANCELADA` · `?sinResponder=true` | solo esas, `totalElementos` filtrado; `cantidadCompras` sigue en 12 |
| lo mismo con `?estado=VENCIDA` | `400`, detalle `query.estado` |
| lo mismo con `X-Usuario-Id: usuario-diego` | `403 SIN_PERMISO` |
| `GET /api/eventos/evento-jazz-en-el-patio/resenias-del-organizador/resumen` | 3 reseñas, `cantidadResenias: 11` |
| `GET /api/eventos/evento-jazz-en-el-patio/resenias-del-organizador?pagina=2` | 1 reseña, `totalPaginas: 2` y el mismo `organizador` |
| `GET /api/eventos/evento-inexistente/resenias-del-organizador` | `404 EVENTO_NO_ENCONTRADO` |
| `GET /api/compras` con cualquier usuario | sin `pagina`: todas, como en la 007 |

## 2. App

1. **Explorar**:
   - Se ven 10 tarjetas y, al final, el paginador `1 2` con el 1 marcado.
   - Tocar 2 muestra el skeleton y después las 2 restantes.
   - Escribir "rock" vuelve a la página 1 y, si hay una sola página, el paginador desaparece.
   - Cambiar el orden o invertir el sentido estando en la 2 vuelve a la 1.
2. **Paginador con TalkBack**: recorrerlo y oír "Página 1, seleccionado, botón" y "Página 2, botón".
   Tocar la actual no hace nada.
3. **Compras del evento** (como Lucía: Mis eventos → Festival Sonidos del Sur → Ver compras):
   - Se ven 10 filas y el paginador.
   - El contador de mensajes sin responder incluye la compra de la página 2.
   - Tocar "Cancelada" muestra "Cargando compras…" sin tapar el resumen y después solo las
     canceladas, sin paginador si son 10 o menos.
   - "Confirmar reembolso" en una fila de la página 2 deja la lista en la página 2.
4. **Detalle de un evento de Martín** (Hamlet o la Charla):
   - "Reseñas del organizador" muestra "4,7" con 11 reseñas, 3 filas y "Ver todas las reseñas".
   - En el Clásico de básquet (Sofía, 2 reseñas) no aparece el botón.
   - En un evento de Lucía, "Todavía no tiene reseñas".
5. **Ver todas las reseñas**: muestra 10 reseñas con el paginador `1 2`. En la 2 queda 1 y el puntaje
   no cambia.

## 3. Verificación automática

```bash
npm test && npm run lint && npm run typecheck && npm run format:check
```

Durante el TDD, solo el test de la tarea: `npm run test:foco -w backend -- <archivo>` o
`npm run test:foco -w mobile -- <archivo>`.
