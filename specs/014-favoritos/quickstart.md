# Quickstart: Favoritos (014)

Cómo comprobar que la feature anda de punta a punta. Contratos: [api](./contracts/api.md) y
[app](./contracts/app.md); datos: [data-model](./data-model.md).

## Prerrequisitos

```bash
git switch feature/014-favoritos
npm install
```

## Calidad (al cerrar cada fase y antes del PR)

```bash
npm test && npm run lint && npm run typecheck && npm run format:check
```

Durante el TDD, solo el test de la tarea:

```bash
npm run test:foco -w backend -- tests/domain/usuario.test.ts
npm run test:foco -w mobile -- tests/pantallas/mis-favoritos.test.tsx
```

## API (servidor con el seed: `npm start`)

```bash
# Lista de Diego: Clásico de básquet, Festival Sonidos del Sur, Noche de risas (realizado)
curl -s localhost:3000/api/usuarios/actual/favoritos -H "X-Usuario-Id: usuario-diego"

# Lucía: []
curl -s localhost:3000/api/usuarios/actual/favoritos -H "X-Usuario-Id: usuario-lucia"

# Marcar dos veces: 204 y 204; Hamlet aparece una sola vez
curl -si -X PUT localhost:3000/api/usuarios/actual/favoritos/evento-hamlet -H "X-Usuario-Id: usuario-lucia"
curl -si -X PUT localhost:3000/api/usuarios/actual/favoritos/evento-hamlet -H "X-Usuario-Id: usuario-lucia"

# Desmarcar dos veces: 204 y 204
curl -si -X DELETE localhost:3000/api/usuarios/actual/favoritos/evento-hamlet -H "X-Usuario-Id: usuario-lucia"

# Rechazos: 401 sin usuario, 404 con un evento inexistente
curl -si -X PUT localhost:3000/api/usuarios/actual/favoritos/evento-hamlet
curl -si -X PUT localhost:3000/api/usuarios/actual/favoritos/evento-no-existe -H "X-Usuario-Id: usuario-lucia"

# El catálogo no cambia según el usuario: misma respuesta con y sin X-Usuario-Id
curl -s localhost:3000/api/eventos | sha1sum
curl -s localhost:3000/api/eventos -H "X-Usuario-Id: usuario-diego" | sha1sum
```

Eliminar limpia los favoritos: crear un evento con Lucía (`POST /api/eventos`), marcarlo con Diego,
eliminarlo con Lucía (`DELETE /api/eventos/<id>`) y comprobar que ya no está en la lista de Diego.

La documentación servida en `/api/docs` muestra el tag "Favoritos" con las tres rutas.

## App (`npm run mobile`, Expo Go)

| Paso | Esperado |
|---|---|
| Elegir a Diego → Perfil → "Mis favoritos" | Clásico de básquet, Festival Sonidos del Sur, Noche de risas con "Realizado"; cada tarjeta con la estrella en la esquina |
| Explorar | estrella en Clásico de básquet y Festival; en ninguna otra |
| Mis compras | estrella en las filas de compras del Festival y de la Noche de risas |
| Abrir Hamlet → tocar la estrella | se llena, "Quitar de favoritos"; volver a Explorar: Hamlet con estrella; "Mis favoritos" lo incluye |
| Tocar la estrella otra vez | se vacía; desaparece de las listas |
| Cambiar a Sofía → Mis eventos | estrella en Clásico de básquet (propio) |
| Cambiar a Lucía → "Mis favoritos" | "Todavía no tenés favoritos"; "Ir a Explorar" vuelve a la pestaña |
| Con el servidor apagado, tocar la estrella | franja de servidor no disponible; la estrella queda en su estado real |
| TalkBack en una tarjeta favorita | la etiqueta termina en "en favoritos"; la estrella no se enfoca sola |
| TalkBack en la estrella del detalle | "Agregar a favoritos" / "Quitar de favoritos", con su estado de seleccionado |
