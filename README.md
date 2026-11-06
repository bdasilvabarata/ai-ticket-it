<p align="center"><img src="docs/consigna/logo-ai-ticket-it.png" alt="AI Ticket It" width="220"></p>

# AI Ticket It

Plataforma móvil para publicar eventos y vender entradas. Trabajo Práctico Individual de
Desarrollo con IA — Diseño de Sistemas, UTN FRBA, 2C 2026.

## Cómo se trabaja

El proyecto se desarrolla con **Spec-Driven Development** usando
[Spec Kit](https://github.com/github/spec-kit) y Claude Code:

1. **Constitución** — principios y reglas del dominio: [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
2. **Backlog** — features priorizadas y sus dependencias: [`docs/backlog.md`](docs/backlog.md)
3. **Por feature**: `specify → clarify → plan → tasks → implement`, en su rama
   `feature/NNN-slug`, integrada a `development` por Pull Request. Los artefactos de cada
   feature quedan en `specs/NNN-slug/`.

Consigna y casos de uso: [`docs/consigna/consigna.md`](docs/consigna/consigna.md).

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Node + Express 5 + TypeScript, en capas (routes → controllers → services → repositories → domain) |
| Persistencia | MongoDB con Mongoose — en memoria (mongodb-memory-server) por defecto |
| Mobile | React Native con Expo + Expo Router |
| Tests | Vitest + supertest · Jest + React Native Testing Library |

## Para arrancar (backend)

### Requisitos previos

- **Node ≥ 22.12** y **npm ≥ 10** (`node -v`, `npm -v`).
- **Internet la primera vez**: mongodb-memory-server descarga el binario de MongoDB a
  `node_modules/.cache/` (en Windows son ~590 MB). Después funciona sin red. Si borrás
  `node_modules/`, se vuelve a descargar.

### Instalar y arrancar

```bash
npm install
npm start        # o npm run dev para recargar ante cambios
```

Sin configuración, el servidor usa **MongoDB en memoria** y carga los datos de ejemplo
(5 usuarios, 6 categorías y 8 eventos, siempre con los mismos ids). La salida muestra las
direcciones:

```text
AI Ticket It API escuchando
  Local: http://localhost:3000/api
  Red:   http://192.168.0.23:3000/api (Wi-Fi)
Almacenamiento: MongoDB en memoria con datos de ejemplo
```

Probalo con `curl http://localhost:3000/api/salud`. La documentación navegable de la API
(Swagger) está en **http://localhost:3000/api/docs**; para Postman, importá
`backend/src/docs/ai-ticket-it.postman_collection.json` o la especificación
`http://localhost:3000/api/docs/openapi.json`. El contrato y el formato de errores están en
[`specs/001-base-backend/contracts/api.md`](specs/001-base-backend/contracts/api.md).

> La primera vez, corré `npm start` antes que `npm test`: así la descarga del binario no
> compite con el tiempo límite de los tests.

### Usar una base MongoDB real

Copiá `backend/.env.example` a `backend/.env` y definí `MONGO_URI` (por ejemplo, una base
local o un cluster gratuito de Atlas). Con `MONGO_URI`, `npm start` **no** carga datos solo
y, si la base no responde, termina en ~5 s con un mensaje claro (nunca cae a memoria).

Para cargar los datos de ejemplo en esa base:

```bash
npm run seed -- --forzar
```

> ⚠️ **Es destructivo**: vacía las colecciones `categorias`, `usuarios` y `eventos` de la
> base de `MONGO_URI` antes de cargar. Sin `--forzar` no modifica nada: muestra la base de
> destino, explica qué borraría y termina con código 1.

En una base real las fechas de los eventos quedan fijas al día de la carga y envejecen
(los "próximos" pasan a ser pasados). Antes de una demo, volvé a correr
`npm run seed -- --forzar`.

### Consultar desde otro dispositivo (el celular con la app)

1. PC y celular en la **misma red Wi-Fi**.
2. Usá la dirección `Red` que imprime `npm start` (por ejemplo,
   `http://192.168.0.23:3000/api/salud`).
3. Abrí la dirección en **Firefox**, escribiéndola completa con `http://`. Chrome y Samsung
   Internet la cambian solos a `https://` (modo "usar siempre conexiones seguras") y fallan
   sin avisar, porque el servidor local no tiene HTTPS.
4. Si cambiás de red (por ejemplo, al hotspot del celular), reiniciá el servidor: las
   direcciones `Red` se calculan al arrancar.
5. Si desde la PC responde y desde el celular no, en Windows:
   - Abrí **Seguridad de Windows → Firewall y protección de red → Permitir una aplicación a
     través del firewall**.
   - Tocá **Cambiar la configuración**, buscá **Node.js JavaScript Runtime** (o
     **Permitir otra aplicación…** y elegí `node.exe`) y marcá **Privada**.
   - En **Configuración → Red e Internet → Wi-Fi → (tu red)**, verificá que el perfil sea
     **Red privada**.
   - Si la PC tiene adaptadores virtuales (VirtualBox, WSL, VPN), imprime varias direcciones
     `Red`, cada una con el nombre de su interfaz entre paréntesis: usá la de `(Wi-Fi)`.
   - En redes institucionales (facultad, trabajo) suele estar bloqueada la comunicación entre
     dispositivos. Si el celular no llega aunque el firewall esté bien, compartí internet
     desde el celular, conectá la PC a ese hotspot y usá la nueva dirección `Red`.

### Calidad

```bash
npm test          # Vitest en todos los paquetes (cada suite levanta su propio MongoDB en memoria)
npm run lint      # ESLint: sin any, sin ts-ignore ni eslint-disable sin descripción, domain/ puro
npm run typecheck # tsc --noEmit en backend y shared
npm run format    # Prettier (format:check solo verifica)
```

El CI de GitHub Actions (`.github/workflows/ci.yml`) corre `format:check`, `lint`,
`typecheck` y `test` en cada PR a `development` y `main`.

Los tests **no** leen `backend/.env`: siempre usan su propia base en memoria y el registro
en silencio.

La app móvil se suma con la feature 002 (base mobile).
