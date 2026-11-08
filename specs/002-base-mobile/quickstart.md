# Quickstart: validar la base mobile (002)

Guía de validación de punta a punta. Rutas y textos en [contracts/app.md](./contracts/app.md);
comportamiento del cliente en [contracts/cliente-api.md](./contracts/cliente-api.md).

## Prerrequisitos

- Node ≥ 22.12 y el repo con `npm install` hecho desde la raíz.
- Celular Android (o iOS) con **Expo Go** de la tienda, cuyo SDK soportado coincide con el de
  `mobile/package.json` (Expo Go → Ajustes).
- Celular y PC en la **misma red Wi-Fi**, sin aislamiento de clientes; firewall de Windows
  con los puertos 3000 (servidor) y 8081 (Metro) permitidos en redes privadas.

## 1. Calidad automática (sin servidor ni celular)

```bash
npm test            # backend (Vitest) + mobile (Jest); mobile < 1 min
npm run lint
npm run typecheck   # incluye mobile sin haber corrido expo start
npm run format:check
```

Esperado: los cuatro en verde e incluyen `mobile` (US5-1). Romper a propósito un tipo, una
regla de lint, el formato o un test en `mobile/` hace fallar el comando correspondiente.
Usar `fetch` en `mobile/app/` hace fallar el lint.

## 2. Primer arranque y selector (US1)

```bash
npm start           # terminal 1: servidor; anotar la IP de la línea "Red:"
npm run mobile      # terminal 2: escanear el QR con Expo Go
```

1. Sin `.env` en `mobile/`: aparece "¿Con quién querés operar?" con los 5 usuarios del seed
   en el orden del servidor (Álvarez, Benítez, Castro, Fernández, Gómez), con su cantidad de
   eventos.
2. Elegir a Lucía → pestañas Explorar · Mis compras · Mis eventos · Perfil; abre Explorar.
3. Si el QR o la franja muestran una IP que no es la de la línea "Red:" (por ejemplo,
   `192.168.56.1` de VirtualBox): detener Expo y arrancar con
   `$env:REACT_NATIVE_PACKAGER_HOSTNAME="<IP Wi-Fi>"; npm run mobile` (PowerShell) o
   `REACT_NATIVE_PACKAGER_HOSTNAME=<IP Wi-Fi> npm run mobile` (bash).

## 3. Usuario recordado (US2)

1. Cerrar Expo Go del todo y reabrir el proyecto → "Cargando…" y entra directo como Lucía
   (< 3 s).
2. Detener el servidor y reabrir → entra como Lucía con la franja "Servidor no disponible ·
   http://<IP>:3000/api" en < 10 s. Perfil muestra "Usuario usuario-lucia" y el aviso de datos
   no cargados.
3. Con la franja visible, levantar el servidor → desaparece sola en el siguiente reintento
   automático (1, 2, 4, 8, 16, 32 s) o al tocar "Reintentar". Perfil muestra "Lucía Álvarez".
4. Usuario inexistente: con `EXPO_PUBLIC_API_URL` apuntando a un servidor sin ese usuario, o
   cambiando el id recordado desde un test de pantalla, la app vuelve al selector con "El
   usuario con el que estabas operando ya no existe. Elegí otro." Este caso lo cubren los
   tests automáticos de `tests/sesion/` y `tests/pantallas/`.

## 4. Cambiar de usuario (US3)

1. Perfil → "Cambiar usuario" → el selector se abre como modal con Lucía marcada "Actual".
2. Cerrar sin elegir → vuelve a Perfil como Lucía.
3. "Cambiar usuario" → elegir a Diego → Perfil muestra "Diego Fernández". Reabrir la app →
   entra como Diego.

## 5. Dirección por variable de entorno (US4-6)

```bash
cp mobile/.env.example mobile/.env   # EXPO_PUBLIC_API_URL=http://<IP>:3000/api
npm run mobile -- --clear            # recargar variables
```

Con un valor inválido a propósito (`http://10.255.255.1:3000/api`), la franja o el selector
muestran esa dirección. Borrar `mobile/.env` al terminar.

## 6. Primer arranque con el servidor apagado (US1-4)

Borrar los datos de Expo Go del proyecto (o elegir "Cambiar usuario" con el servidor
apagado): el selector muestra "Servidor no disponible", la dirección y "Reintentar"; al
levantar el servidor aparece la lista sola o al reintentar.
