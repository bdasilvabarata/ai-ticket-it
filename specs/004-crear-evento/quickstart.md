# Quickstart: validar Crear evento (004)

Guía para comprobar la feature de punta a punta. Los detalles están en
[contracts/api.md](./contracts/api.md), [contracts/app.md](./contracts/app.md) y
[data-model.md](./data-model.md).

## Prerrequisitos

- La constitución en **2.1.0** ("Operaciones atómicas por evento", research R1), ya aplicada.
- `npm install` desde la raíz. En `mobile/`, `npx expo install
  @react-native-community/datetimepicker` y `npx expo install --check` sin advertencias.
- Un celular con Expo Go del SDK 58 en la misma red que la PC (README).

## 1. Calidad (desde la raíz)

```sh
npm test && npm run lint && npm run typecheck && npm run format:check
```

Qué tiene que pasar:
- **domain**:
  - las reglas de `Evento` y `TipoEntrada`;
  - "realizado" en el instante exacto (1 ms antes: no; en el instante: sí) y la fecha futura
    con el reloj fijo;
  - "VIP" = " vip " = "Víp", y "Año" ≠ "Ano";
  - las operaciones devuelven un `Evento` nuevo y no tocan el original;
  - `hora-buenos-aires` (`"2026-12-01T20:00"` ⇄ `2026-12-01T23:00:00.000Z`).
- **services**:
  - el cerrojo serializa la misma clave, no bloquea claves distintas y libera ante un error;
  - los tests de concurrencia con `Promise.all` (abajo).
- **api**:
  - cada endpoint con cada código de error;
  - la cobertura de OpenAPI y de Postman.
- **mobile**:
  - las funciones de `api/`;
  - `formato`;
  - `fecha-de-pared` con `TZ` = `Asia/Tokyo`, `America/New_York` y `UTC`;
  - `errores-de-formulario`;
  - las pantallas con `renderConDependencias`;
  - el typecheck de la guarda de rutas dinámicas.

**Tests de concurrencia** (SC-008), en `backend/tests/services/concurrencia.test.ts`:

| Caso | Resultado esperado |
|---|---|
| eliminar el evento mientras una operación simulada de la 006 guarda una compra bajo el mismo cerrojo | o se elimina y la compra ve el evento inexistente, o la compra entra primero y el eliminar da `EVENTO_CON_COMPRAS` |
| dos tipos "VIP" agregados a la vez | uno `201`, el otro `NOMBRE_TIPO_ENTRADA_REPETIDO` |
| dos tipos distintos agregados a la vez | quedan los dos (sin actualización perdida) |
| dos tipos renombrados a la vez al mismo nombre | uno `200`, el otro `NOMBRE_TIPO_ENTRADA_REPETIDO` |
| quitar a la vez los dos tipos de un evento con dos | uno se quita, el otro da `ULTIMO_TIPO_ENTRADA` |
| una operación sobre el evento A, bloqueada a propósito | una operación sobre el evento B termina antes |

## 2. API a mano (servidor con datos de ejemplo)

```sh
npm start        # http://localhost:3000/api · Swagger en /api/docs
```

Con `H='X-Usuario-Id: usuario-lucia'`:

| Pedido | Esperado |
|---|---|
| `GET /api/categorias` | 6 categorías por nombre |
| `GET /api/eventos/mios` (Lucía) | Noche de Rock, Festival y Maratón, en ese orden (próximos por fecha); sin eventos de otros |
| `GET /api/eventos/mios` (Sofía) | Clásico de básquet y, al final, Noche de risas con `realizado: true` |
| `POST /api/eventos` con el ejemplo del contrato (`fechaHora: "2026-12-01T20:00"`) | `201`, `organizadorId: "usuario-lucia"`, `fechaHora: "2026-12-01T23:00:00.000Z"`, `fechaHoraLocal: "2026-12-01T20:00"` |
| igual, con `fechaHora` de ayer | `409 FECHA_NO_FUTURA` |
| igual, con tipos "VIP" y " vip " | `409 NOMBRE_TIPO_ENTRADA_REPETIDO` |
| igual, con `precio: -1`, `cupo: 0` y una URL `ftp://…` | `400` con `body.tiposEntrada.0.precio`, `…cupo` y `body.multimedia.0` |
| igual, con `"organizadorId": "usuario-sofia"` | `201` con `organizadorId: "usuario-lucia"` (se ignora) |
| `DELETE /api/eventos/evento-festival-sonidos-del-sur` | `409 EVENTO_CON_COMPRAS` |
| `DELETE …/evento-festival-sonidos-del-sur/tipos-entrada/tipo-festival-sonidos-del-sur-general` | `409 TIPO_ENTRADA_CON_COMPRAS` (la compra es `CANCELADA`) |
| `DELETE …/evento-festival-sonidos-del-sur/tipos-entrada/tipo-festival-sonidos-del-sur-backstage` | `204` |
| `DELETE …/evento-noche-de-rock/tipos-entrada/tipo-noche-de-rock-general` | `409 ULTIMO_TIPO_ENTRADA` |
| `PUT /api/eventos/evento-hamlet` (Lucía; el evento es de Martín) | `403 SIN_PERMISO` |
| `PUT …/evento-noche-de-rock/tipos-entrada/tipo-hamlet-platea` | `404 TIPO_ENTRADA_NO_ENCONTRADO` |
| `PUT /api/eventos/evento-noche-de-risas` (como Sofía) | `409 EVENTO_REALIZADO` |
| `DELETE /api/eventos/evento-noche-de-rock` | `204`; después, `GET` del mismo → `404` |
| cualquier escritura sin `X-Usuario-Id` | `401 USUARIO_NO_IDENTIFICADO` |

Reiniciar el servidor vuelve a los datos de ejemplo.

## 3. App en el celular

```sh
npm start            # en una terminal
npm run mobile       # en otra; abrir con Expo Go
```

1. Elegir a **Lucía** → pestaña **Mis eventos**: sus 3 eventos con fecha y hora, categoría y
   "N tipos de entrada".
2. **Crear evento**:
   - completar nombre y categoría, y elegir fecha y hora con el selector (no se puede
     escribir);
   - agregar los tipos "General" ($ 15.000, 200) y "VIP" ($ 60.000, 30);
   - guardar → aparece en la lista sin recargar;
   - en Perfil → Cambiar usuario, la fila de Lucía dice "Organiza 4 eventos".
3. Repetir con dos tipos "VIP" / "vip" → el error aparece en la sección de tipos y lo cargado
   sigue ahí.
4. Abrir el **Festival**:
   - "Quitar General" → "tiene compras";
   - "Quitar Backstage" → confirma y desaparece;
   - "Eliminar evento" → "tiene compras".
5. Editar el nombre y la fecha de Noche de Rock → la lista lo muestra actualizado y en su
   nueva posición.
6. En un formulario, tocar atrás (header, atrás de Android o gesto) → "¿Descartar los
   cambios?":
   - "Seguir editando" conserva lo cargado;
   - "Descartar" sale.
7. Elegir a **Sofía** → Noche de risas aparece con **"Realizado"**. Al abrirla se ve en solo
   lectura y al salir no pregunta nada.
8. **Zona horaria** (SC-006):
   - cambiar la zona del teléfono a otra (por ejemplo, Madrid) → las fechas de la lista no
     cambian;
   - crear un evento a las 20:00 → el servidor guarda 23:00 UTC.
9. **Reloj del teléfono** adelantado un día:
   - nada cambia en "Realizado";
   - una fecha de hoy + 1 hora se acepta, porque decide el servidor.
10. Apagar el servidor y guardar un formulario → la franja "Servidor no disponible", lo
    cargado intacto y ningún reintento automático del guardado.
11. Pantalla de 360 px (o tamaño de fuente grande) → sin desplazamiento horizontal. Con
    TalkBack, cada control se anuncia con su etiqueta.

## 4. Cierre

- `docs/backlog.md`: 004 → `en PR`, y la 006 depende también de la 004.
- `AGENTS.md` actualizado: recursos `eventos`, `categorias` y `compras` (mínimo), cerrojo,
  reloj y las features mobile `eventos` y `categorias`.
- Corregidos los comentarios con la numeración vieja en `evento.repository.ts` y `evento.ts`.
- PR a `development` con las cuatro verificaciones en verde.
