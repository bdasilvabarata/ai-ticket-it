# Contrato: rutas, pantallas y comandos de la app

Contrato de interfaz de usuario de la base mobile (lo que ven y usan quien demuestra y las
features 003+). Decisiones en [research.md](../research.md) (R3, R8, R14).

## Rutas (Expo Router, `mobile/app/`)

| Archivo | Ruta | Disponible en la fase | Presentación |
|---|---|---|---|
| `_layout.tsx` | — | siempre | dependencias reales → `LayoutRaiz` (`src/navegacion/`): providers + franja + `Stack` con `Stack.Protected` |
| `cargando.tsx` | `/cargando` | `iniciando` | pantalla completa, indicador "Cargando…" |
| `seleccionar-usuario.tsx` | `/seleccionar-usuario` | `sin-usuario` · `con-usuario` | pantalla completa sin "atrás" (`sin-usuario`) · modal (`con-usuario`) |
| `(tabs)/_layout.tsx` | — | `con-usuario` | `Tabs`, abre en Explorar |
| `(tabs)/index.tsx` | `/` | `con-usuario` | pestaña **Explorar** (ícono `compass-outline`) |
| `(tabs)/mis-compras.tsx` | `/mis-compras` | `con-usuario` | pestaña **Mis compras** (`ticket-outline`) |
| `(tabs)/mis-eventos.tsx` | `/mis-eventos` | `con-usuario` | pestaña **Mis eventos** (`calendar-outline`) |
| `(tabs)/perfil.tsx` | `/perfil` | `con-usuario` | pestaña **Perfil** (`person-circle-outline`) |

Las features 003+ agregan sus pantallas dentro de `(tabs)/` o como rutas apiladas protegidas
por `con-usuario`.

## Pantallas y textos

**Cargando**: `ActivityIndicator` + "Cargando…". No muestra el selector ni datos de usuario
(US2-6).

**Seleccionar usuario**

| Estado | Contenido |
|---|---|
| cargando | `Cargando` |
| error `ServidorNoDisponibleError` | "Servidor no disponible", "No se pudo conectar con {urlBase}.", botón "Reintentar" ("Reintentando…" deshabilitado durante un intento); reintentos automáticos con la secuencia única de la app (R7), compartida con la franja |
| error `ErrorDeApi` | su `mensaje` + "Reintentar" (sin reintentos automáticos) |
| vacío | "No hay usuarios disponibles." |
| éxito | título "¿Con quién querés operar?"; una fila por usuario: "{nombre} {apellido}" y "Organiza {n} evento(s)" ("No organiza eventos" si es 0); la del usuario actual con el texto "Actual" (FR-015); cada fila es un botón con `accessibilityLabel` "Elegir a {nombre} {apellido}", y la del actual "{nombre} {apellido}, usuario actual" con `accessibilityState={{ selected: true }}` (FR-022) |
| aviso `usuario-anterior-inexistente` | sobre la lista: "El usuario con el que estabas operando ya no existe. Elegí otro." Se anuncia al lector de pantalla al aparecer (FR-022). |

En modal: botón "Cerrar" en el header (`accessibilityLabel` "Cerrar sin cambiar de usuario"),
gesto atrás y botón "atrás" de Android → vuelve a Perfil sin cambios (US3-5, FR-015). A pantalla
completa (`sin-usuario`) no hay "Cerrar", y el botón "atrás" de Android hace lo normal del
sistema (sale de la app). Si llega un 401 `USUARIO_NO_IDENTIFICADO` con el modal abierto, el
modal se reemplaza por el selector a pantalla completa con el aviso `usuario-anterior-inexistente`
(FR-014). La elección se procesa una sola vez (doble toque).

**Explorar / Mis compras / Mis eventos** (`SeccionPendiente`): título con el nombre de la
sección y "Esta sección todavía no está disponible." (FR-018).

**Perfil**: "{nombre} {apellido}" del usuario actual. Si está conservado sin confirmar
(`usuario: null`): "Usuario {usuarioId}" y "No se pudieron cargar los datos del usuario.".
Botón "Cambiar usuario" → abre `/seleccionar-usuario` (2 toques hasta elegir: SC-004).

**Franja de servidor no disponible** (fase `con-usuario`, `servidor: no-disponible`, cualquier
ruta salvo `seleccionar-usuario`): arriba de todo, "Servidor no disponible · {urlBase}" y botón
"Reintentar" ("Reintentando…" deshabilitado durante un intento). No bloquea las pestañas ni las
pantallas apiladas de las features siguientes. Aparece cuando la validación del usuario o
cualquier pedido falla por servidor no disponible (no ante un 500, que lo muestra la pantalla).
Se anuncia al lector de pantalla al aparecer. Desaparece con un reintento exitoso de la
secuencia única.

## Comandos (desde la raíz)

| Comando | Efecto |
|---|---|
| `npm install` | instala también `mobile` |
| `npm run mobile` | `expo start` en `mobile/` (QR para Expo Go) |
| `npm start` | servidor (sin cambios, 001) |
| `npm test` · `npm run lint` · `npm run typecheck` · `npm run format:check` | incluyen `mobile` |

Variables de entorno de la app (`mobile/.env`, no versionado; ejemplo en `mobile/.env.example`):

| Variable | Efecto |
|---|---|
| `EXPO_PUBLIC_API_URL` | dirección base del servidor con `/api`; prioridad sobre la detección por host |
| `REACT_NATIVE_PACKAGER_HOSTNAME` (de la terminal, no del `.env`) | IP que anuncia Expo; corrige el QR y el host detectado cuando hay adaptadores virtuales (VirtualBox) |
