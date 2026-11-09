# Quickstart: validar la base backend (001)

Guía para comprobar de punta a punta que la feature cumple la spec. Los endpoints y errores
están en [contracts/api.md](./contracts/api.md); los datos de ejemplo, en
[data-model.md](./data-model.md#datos-de-ejemplo).

## Requisitos previos

- Node ≥ 22.12 y npm ≥ 10 (`node -v`, `npm -v`). No hace falta ninguna base de datos.
- Para el acceso desde otro dispositivo: PC y dispositivo en la misma red Wi-Fi.

## 1. Instalar y arrancar (US1, SC-001)

```bash
npm install
npm start
```

Esperado: la salida informa una dirección `Local`, una o más `Red` (con el nombre de su
interfaz) y "Datos de ejemplo cargados en memoria".

```bash
curl http://localhost:3000/api/salud
# {"estado":"ok"}
curl http://localhost:3000/api/usuarios
# 5 usuarios, de Álvarez a Gómez, con cantidadEventosOrganizados 3, 3, 2, 0, 0
```

## 2. Desde otro dispositivo de la red (US1-3, SC-002)

Abrir en **Firefox** del celular la dirección `Red` + `/salud`, escrita completa con `http://`
(por ejemplo, `http://192.168.0.23:3000/api/salud`). Esperado: el mismo JSON. Chrome y Samsung
Internet la pasan solos a `https://` y fallan sin avisar.

Si no responde y en la PC sí: en Windows, permitir Node.js en "Redes privadas" del Firewall
de Windows Defender (el README tiene el paso a paso) y verificar que la red Wi-Fi esté
marcada como privada.

## 3. Reinicio determinista (US1-4, SC-005)

Detener (`Ctrl+C`), volver a correr `npm start` tres veces y repetir
`curl http://localhost:3000/api/usuarios`: mismos 5 usuarios con los mismos ids
(`usuario-lucia`, `usuario-martin`, …).

## 4. Errores con formato único (US2, SC-003)

```bash
curl -i http://localhost:3000/api/no-existe                      # 404 RUTA_NO_ENCONTRADA
curl -i http://localhost:3000/api/usuarios/123                   # 400 ENTRADA_INVALIDA, campo params.id
curl -i http://localhost:3000/api/usuarios/usuario-inexistente   # 404 USUARIO_NO_ENCONTRADO
curl -i http://localhost:3000/api/usuarios/actual                # 401 USUARIO_NO_IDENTIFICADO
curl -i -H "X-Usuario-Id: usuario-lucia" \
     http://localhost:3000/api/usuarios/actual                   # 200 Lucía Álvarez
curl -i -X POST -H "Content-Type: application/json" -d "{mal" \
     http://localhost:3000/api/salud                             # 400 JSON_INVALIDO
```

En la consola del servidor aparece una línea por pedido: método, ruta, status y duración.
El 500 y el 413 se verifican con las pruebas automatizadas.

## 5. Documentación de la API

Abrir `http://localhost:3000/api/docs` (Swagger UI) o importar en Postman
`backend/src/docs/ai-ticket-it.postman_collection.json`.

## 6. Fallas de arranque (edge cases, FR-011)

- Con otro proceso en el puerto 3000 (`npm start` en otra terminal): el segundo termina con
  "El puerto 3000 ya está en uso".

## 7. Calidad (US3, SC-004)

```bash
npm test             # todas las suites en verde, en menos de 1 minuto
npm run lint
npm run typecheck
npm run format:check
```

Comprobación negativa: agregar `const x: any = 1` en `backend/src/` → `npm run lint` falla;
cambiar un valor de `EstadoCompra` en `shared/` que use el backend → `npm run typecheck`
falla. Revertir ambos cambios.
