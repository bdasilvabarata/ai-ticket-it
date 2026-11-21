# Quickstart: Chat de la compra (011)

Guía para validar la feature de punta a punta. El detalle de los endpoints está en
[contracts/api.md](./contracts/api.md) y el de la pantalla, en [contracts/app.md](./contracts/app.md).

## Preparación

```bash
npm install
npm start          # servidor con los datos de ejemplo (reiniciarlo vuelve a ellos)
npm run mobile     # Metro; abrir con Expo Go (ver README)
```

## 1. Servidor (curl o la colección de Postman)

```bash
# La conversación de ejemplo, vista por el comprador y por la organizadora
curl -H "X-Usuario-Id: usuario-martin" localhost:3000/api/compras/compra-martin-festival-vip/mensajes
curl -H "X-Usuario-Id: usuario-lucia"  localhost:3000/api/compras/compra-martin-festival-vip/mensajes
# → 3 mensajes en orden; otraParte cambia según quién pide; sin códigos de entradas

# Enviar (el texto se recorta)
curl -X POST -H "X-Usuario-Id: usuario-martin" -H "Content-Type: application/json" \
  -d '{"texto":"  ¿A qué hora abren las puertas?  "}' \
  localhost:3000/api/compras/compra-martin-festival-vip/mensajes
# → 201, numero 4, autor Martín (comprador), texto recortado

# Rechazos
curl -X POST -H "X-Usuario-Id: usuario-martin" -H "Content-Type: application/json" \
  -d '{"texto":"   "}' localhost:3000/api/compras/compra-martin-festival-vip/mensajes   # → 400 body.texto
curl -H "X-Usuario-Id: usuario-sofia" localhost:3000/api/compras/compra-martin-festival-vip/mensajes  # → 403
curl -H "X-Usuario-Id: usuario-martin" localhost:3000/api/compras/compra-inexistente/mensajes        # → 404
curl localhost:3000/api/compras/compra-martin-festival-vip/mensajes                                   # → 401

# Chat en cualquier estado: la compra cancelada de Diego en el Maratón (también de Lucía)
curl -X POST -H "X-Usuario-Id: usuario-diego" -H "Content-Type: application/json" \
  -d '{"texto":"¿Cuándo me devuelven la plata?"}' \
  localhost:3000/api/compras/compra-diego-maraton-inscripcion/mensajes   # → 201; la compra sigue CANCELADA
```

Lo que tiene que pasar:

- `GET /api/eventos/evento-festival-sonidos-del-sur` muestra el mismo cupo antes y después de
  enviar mensajes.
- Swagger, en `localhost:3000/api/docs`, muestra `GET` y `POST /compras/{compraId}/mensajes`.

## 2. App (en el celular)

1. Elegí a **Martín**, entrá a "Mis compras", abrí "Festival Sonidos del Sur" y tocá **"Chat con el
   organizador"**. Tenés que ver:
   - el encabezado: el festival, "Con Lucía Álvarez · Organizador", "VIP · 2 entradas" y
     "Confirmada";
   - los tres mensajes del seed, con fecha y hora; los tuyos a la derecha, como "Vos".
2. Escribí "¿A qué hora abren?" y tocá **Enviar**. El campo se vacía y el mensaje aparece al final.
3. Tocá **Enviar** con el campo vacío: debajo del campo aparece "Es obligatorio.".
4. Pegá un texto de más de 500 caracteres: aparece "Debe tener como máximo 500 caracteres." y el
   texto queda en el campo.
5. Pasá a **Lucía** desde Perfil, entrá a "Mis eventos", abrí el festival y tocá **"Ver compras"**.
   En la fila de Martín tocá **"Abrir chat"**. Tenés que ver:
   - "Con Martín Benítez · Comprador" en el encabezado;
   - el mensaje del paso 2, como del comprador.
6. Respondé como Lucía, volvé a Martín y abrí el chat: aparece la respuesta, como de la
   organizadora.
7. Abrí el chat de una compra sin mensajes (por ejemplo, la de Sofía en "Peña en La Rueda", como
   Sofía o como Lucía): tenés que ver "Todavía no hay mensajes" con el encabezado y el campo.
8. Cortá el servidor y abrí un chat: aparecen la franja y el error con "Reintentar". Volvé a
   levantarlo y reintentá.
9. Con **TalkBack**, recorré la conversación. De cada mensaje se lee el autor, la hora y el texto;
   el campo y "Enviar" se leen con su nombre.

## 3. Calidad

Desde la raíz:

```bash
npm test && npm run lint && npm run typecheck && npm run format:check
```

Durante el TDD se corre solo el test de la tarea, por ejemplo:

```bash
npm run test:foco -w backend -- tests/domain/mensaje.test.ts
npm run test:foco -w mobile -- tests/pantallas/chat-de-la-compra.test.tsx
```
