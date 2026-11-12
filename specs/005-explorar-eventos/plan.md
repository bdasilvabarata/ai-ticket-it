# Implementation Plan: Explorar eventos

**Branch**: `feature/005-explorar-eventos` | **Date**: 2026-11-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-explorar-eventos/spec.md`

## Summary

UC-03 y UC-11: cualquier usuario explora desde la pestaña **Explorar** el catálogo de eventos
que no se realizaron, lo busca por texto, lo filtra por categoría, lo ordena por fecha, precio
"desde" o puntaje del organizador, y abre el detalle público de un evento.

**Backend**:
- Endpoint nuevo **`GET /api/eventos`**, público, con `texto`, `categoriaId` y `orden` en la
  query (zod con `crearValidacion`). Responde `CatalogoVista { eventos, hayEventosProximos }`:
  el segundo dato le dice a la app qué vacío mostrar sin pedir de más (R2). Un `categoriaId`
  que no existe es una referencia inválida: `CategoriaService.buscarReferenciada` →
  `400 ENTRADA_INVALIDA` sobre `query.categoriaId` (constitución 2.2.0, principio III; R1).
- `EventoService.listar(consulta)`: un `ahora` por pedido, filtra no realizados, categoría y
  texto y ordena. Las categorías, los organizadores y los puntajes los pide **en lote** a sus
  services dueños (`CategoriaService`, `UsuarioService`, `ReseniaService`; constitución 2.2.0,
  principio III). Sin cerrojo (lectura).
- Dominio puro: `Evento.precioDesde()`, `estaAgotado()` y `coincideCon(palabras)`;
  `domain/busqueda.ts` (normalización NFD que quita solo acento y diéresis de las vocales y
  conserva la ñ, coherente con `mismoNombreDeTipo`; R3); `domain/orden-catalogo.ts` (criterio
  y desempates fecha → nombre → id; R6).
- **Reseña mínima**, como la `Compra` de la 004: entidad `Resenia` (puntuación 1..5),
  `RepositorioResenias.listarPorEventos` y `ReseniaRepository` vacío en el seed; el puntaje es
  un cálculo puro (`calcularPuntaje`, `puntajesPorOrganizador`) y `ReseniaService`, su dueño, lo
  sirve en lote. Hoy todos salen "sin puntaje"; con la 011, el puntaje y el orden funcionan sin
  tocar la 005 (R7).
- `UsuarioService` suma `obtenerOFallar` (público) y la búsqueda en lote `obtenerPorIds`, sobre
  `RepositorioUsuarios.listarPorIds` (R8).
- Toda `EventoVista` suma `organizador` (nombre, apellido, puntaje, cantidad de reseñas) sin
  quitar campos (R8).
- Seed: Hamlet agotado y la Maratón con un tipo gratis, sin agregar eventos (R9).

**Mobile**:
- Dentro de la feature `eventos` (R11): pantallas `Explorar` (pestaña) y `DetalleEvento` (ruta
  apilada `explorar/[eventoId]`).
- `listarEventos` con `URLSearchParams`, clave `claves.catalogo(consulta)` sin usuario, debounce
  de 500 ms del texto y skeleton en cada cambio, sin `keepPreviousData` (R13, R14).
- Controles fuera de `SegunConsulta` para no perder el foco; `SegunConsulta` y `ListaVacia`
  suman props opcionales (`cargando`, `vacio`, `accion`) sin cambiar lo de siempre (R16).
- Las mutations de la 004 y el 404 del detalle invalidan `["catalogo"]` (R15).

Decisiones en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript strict (`~6.0`) en los tres paquetes; Node ≥ 22.12

**Primary Dependencies**:
- Backend: Express 5 y zod 4, sin dependencias nuevas.
- Mobile: Expo SDK 58, Expo Router, TanStack Query v5, sin dependencias nuevas (`Image` y
  `ScrollView` de React Native para las imágenes).

**Storage**: repositorios en memoria (`Map` privado); se suma `ReseniaRepository` (vacío en el
seed)

**Testing**:
- Backend: Vitest y supertest, en domain (búsqueda, orden, puntaje, `Evento`, `Resenia`, seed),
  repositories (reseñas), services (reloj fijo, repositorios armados por caso) y api.
- Mobile: Jest, jest-expo y RNTL con `renderConDependencias` y `porRuta`; debounce con los
  temporizadores falsos de `renderRouter`.

**Target Platform**: servidor Node local; Android con Expo Go (iOS compatible)

**Project Type**: mobile-app con API (monorepo `backend/`, `shared/`, `mobile/`)

**Performance Goals**: SC-004 (la lista refleja un cambio en < 1 s después de dejar de
escribir): 500 ms de debounce + un pedido en la red local. El listado hace un número fijo de
lecturas de repositorio por pedido (sin N+1): cada service dueño responde su lote en una
lectura.

**Constraints**:
- El servidor decide "realizado", la búsqueda, el filtro y el orden (FR-023); la app no usa el
  reloj ni la zona del teléfono.
- Las pantallas y la `EventoVista` de la 004 siguen funcionando igual (SC-008).
- 360 px sin desplazamiento horizontal de la página (SC-007).

**Scale/Scope**:
- 1 endpoint nuevo y 1 ampliado.
- 1 entidad nueva (`Resenia`), 1 repositorio nuevo, 2 módulos puros de dominio, 3 operaciones
  nuevas de `Evento`.
- `ReferenciaInvalidaError` y `CategoriaService.buscarReferenciada` ampliados con `origen`
  (`"datos"` por defecto) y su traducción en `middlewares/traducir-error.ts`, para el 400 de un
  `categoriaId` inexistente en la query (constitución 2.2.0, principio III).
- 2 pantallas, 2 rutas en `app/` (una reemplaza la sección pendiente), 4 componentes nuevos y
  3 piezas ampliadas.
- Unos 12 archivos de test nuevos o ampliados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple el plan | Estado |
|---|---|---|
| Dominio · Puntaje del organizador | Promedio de las reseñas de **todos** sus eventos; sin reseñas, `null` (nunca 0) y al final del orden por puntaje (R6, R7) | ✅ |
| Dominio · Reseñas | `Resenia` exige puntuación entera de 1 a 5. La regla "solo con compra `UTILIZADA`, una vez" es de la 011, que crea las reseñas; acá no se crea ninguna | ✅ |
| Dominio · Cupo / Total / Estados / atomicidad | Solo lecturas: no se descuenta cupo ni se modifica nada; sin cerrojo, como las demás lecturas (R2.4 de la 004) | ✅ |
| Dominio · zona horaria | "Realizado" con el reloj del servidor, un `ahora` por pedido; la app muestra `fechaHoraLocal` | ✅ |
| I. Spec-Driven | Spec con 4 clarificaciones. Plan → tasks → implement. Backlog: 005 → `plan` | ✅ |
| II. Test-First | Cada regla (no realizado, búsqueda, texto vacío, 100 caracteres, categoría inexistente, orden desconocido, precio "desde", gratis, agotado, puntaje ausente, desempates, 404) con su test y caso borde (SC-006), en domain, repositories, services y api; en mobile, api, formato, piezas base y pantallas. Cada test con su stub de firma real | ✅ |
| III. Capas (2.2.0) | `domain/` (búsqueda, orden, puntaje, `Resenia`, operaciones de `Evento`) sin Express ni `errors/`. `EventoService` orquesta y arma vistas, y pide lo de otros agregados a su dueño: categorías a `CategoriaService`, organizadores a `UsuarioService` y puntajes a `ReseniaService`, en lote (`obtenerPorIds`, `puntajesPorOrganizador`). El `categoriaId` de la consulta es una referencia de la entrada: se valida con `categoriaService.buscarReferenciada` (si no existe, 400 sobre `query.categoriaId`, no lista vacía). Sin ciclos: `ReseniaService` recibe los eventos y no depende de `EventoService`. El controller solo lee la query validada; la forma va en `validations/`. `app.ts` conecta los services en orden | ✅ |
| IV. Persistencia en memoria | `ReseniaRepository` con `Map` privado, vacío en el seed; estado por instancia de app y de test; seed con ids legibles (`tipo-maraton-10k-carrera-kids`) | ✅ |
| V. Contrato de API | `GET /api/eventos` en plural, JSON, formato único de error (400 con detalle en `query.*`); `contracts/api.md`, OpenAPI con su test de cobertura y Postman | ✅ |
| VI. Identidad simulada | El listado y el detalle son públicos (no exponen nada privado; R8 de la 004). Vistas explícitas: `OrganizadorVista` solo con id, nombre, apellido y puntaje | ✅ |
| VII. App Mobile | `fetch` solo en `src/api/`. Cuatro estados con `SegunConsulta` (skeleton como cargando). Accesibilidad (roles, `accessibilityLabel` de tarjetas e imágenes, "Agotado" como texto). 360 px. Sin dependencias nuevas | ✅ |
| VIII. Tipos compartidos | `CatalogoVista`, `EventoCatalogoVista`, `OrganizadorVista`, `ConsultaCatalogo`, `ORDENES_CATALOGO` y `LIMITES_BUSQUEDA` en `shared/` | ✅ |
| IX. Calidad | `strict`, las cuatro verificaciones y el CI. Sin capas ni dependencias nuevas; las piezas base se amplían con props opcionales | ✅ |

**Gate**: pasa sin violaciones.

**Post-design re-check (Phase 1)**: el diseño no agrega violaciones. Puntos que se registran en
AGENTS.md al terminar la implementación (como hizo la 004):
- `GET /eventos` público y `EventoVista` con `organizador`;
- `Resenia` mínima, `RepositorioResenias.listarPorEventos` y `ReseniaService` (lo amplía la 011);
- `UsuarioService.obtenerOFallar` (público) y `obtenerPorIds`, sobre `RepositorioUsuarios.listarPorIds`;
- Explorar y el detalle público en la feature `eventos`, la ruta `explorar/[eventoId]` y la
  clave `catalogo` **sin usuario** (la excepción documentada en `claves.ts`);
- las props nuevas de `SegunConsulta` (`cargando`, `vacio`) y `ListaVacia` (`accion`).

El plan fija detalles que la spec dejó abiertos:
- la respuesta es un objeto con `hayEventosProximos`, no un arreglo (R2);
- `categoriaId` no usa `idSchema` (la forma solo exige un texto): que exista lo decide
  `CategoriaService.buscarReferenciada`, y uno desconocido o mal formado da 400 "No existe la
  categoría." sobre `query.categoriaId` (R1). Para nombrar el campo de la query,
  `ReferenciaInvalidaError` y `buscarReferenciada` suman un `origen` neutral
  (`"datos"` por defecto, como hasta ahora; `"consulta"` en el listado) y el traductor de
  `middlewares/` lo convierte en `body.` / `query.`: `errors/` no usa vocabulario HTTP (R1);
- el último desempate es el `id` (R6);
- el puntaje viaja sin redondear y la app lo redondea al décimo (R7, R18);
- el seed modifica Hamlet y la Maratón en lugar de sumar eventos (R9);
- el cupo del detalle usa `textoCupo` de la 004 ("30 disponibles" / "Agotado"; R17).

## Project Structure

### Documentation (this feature)

```text
specs/005-explorar-eventos/
├── plan.md              # este archivo
├── research.md          # Phase 0 (R1–R20)
├── data-model.md        # Phase 1: operaciones de Evento, búsqueda, orden, Resenia, vistas, seed, estado de la app
├── quickstart.md        # Phase 1: calidad, pedidos directos y recorrido de la demo
├── contracts/
│   ├── api.md           # GET /eventos, GET /eventos/:id ampliado, errores
│   └── app.md           # rutas, estados, textos, componentes y piezas base ampliadas
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
shared/src/
├── evento.ts                    # + ORDENES_CATALOGO, OrdenCatalogo, LIMITES_BUSQUEDA, ConsultaCatalogo,
│                                #   OrganizadorVista, EventoCatalogoVista, CatalogoVista; EventoVista + organizador
└── index.ts                     # + exports

backend/src/
├── domain/
│   ├── evento.ts                # + precioDesde, estaAgotado, coincideCon; comentario de tuPrecioEstaEntre
│   ├── busqueda.ts              # normalizarParaBuscar, palabrasDeBusqueda (nuevo)
│   ├── orden-catalogo.ts        # ordenarCatalogo (nuevo)
│   ├── resenia.ts               # Resenia, Puntaje, calcularPuntaje, puntajesPorOrganizador (nuevo)
│   └── repositorios.ts          # + RepositorioResenias; RepositorioUsuarios + listarPorIds
├── repositories/
│   ├── resenia.repository.ts    # ReseniaRepository (nuevo)
│   └── usuario.repository.ts    # + listarPorIds
├── services/
│   ├── resenia.service.ts       # ReseniaService: puntajesPorOrganizador, puntajeDe (nuevo)
│   ├── usuario.service.ts       # obtenerOFallar público + obtenerPorIds
│   ├── categoria.service.ts     # buscarReferenciada(id, origen = "datos")
│   ├── evento.service.ts        # + listar; obtener/crear/actualizar con organizador; + usuarioService, reseniaService
│   └── evento.vistas.ts         # + aOrganizadorVista, aEventoCatalogoVista; aEventoVista + organizador
├── errors/index.ts                      # OrigenDeReferencia ("datos" | "consulta"); ReferenciaInvalidaError + origen
├── middlewares/traducir-error.ts        # origen → body. / query. en el campo del detalle
├── controllers/evento.controller.ts     # + listar
├── routes/eventos.routes.ts             # + GET / (público)
├── validations/evento.validation.ts     # + consultaCatalogo (query)
├── seed/datos-ejemplo.ts                # Hamlet agotado; Maratón + "Carrera kids" gratis
├── seed/repositorios-de-ejemplo.ts      # Repositorios + resenias
├── docs/openapi.json                    # + GET /eventos y esquemas
├── docs/ai-ticket-it.postman_collection.json
└── app.ts                               # ReseniaRepository, ReseniaService y EventoService con usuarioService y reseniaService

backend/tests/
├── domain/{busqueda,orden-catalogo,resenia}.test.ts (nuevos) + evento, datos-ejemplo
├── repositories/resenia.repository.test.ts (nuevo) + repositorios, repositorios-de-ejemplo
├── services/resenia.service.test.ts (nuevo) + usuario.service.test.ts (obtenerPorIds)
│                                        #   + categoria.service.test.ts (buscarReferenciada con origen)
├── services/evento.service.test.ts      # + listar y organizador
├── helpers/services-de-eventos.ts       # + usuarios y resenias
├── api/eventos.test.ts                  # + GET /eventos y detalle ampliado (+ docs)
└── api/errores.test.ts                  # + ReferenciaInvalidaError con origen → body. / query.

mobile/
├── app/
│   ├── (tabs)/index.tsx         # re-export de Explorar
│   └── explorar/[eventoId].tsx  # re-export de DetalleEvento (nueva)
├── src/
│   ├── api/eventos.ts           # + listarEventos
│   ├── consultas/claves.ts      # + catalogo(consulta), sin usuario (documentado)
│   ├── componentes/
│   │   ├── SegunConsulta.tsx    # + cargando?, vacio?
│   │   ├── ListaVacia.tsx       # + accion?
│   │   └── tema.ts              # + lo que falte (tamaño de imagen, skeleton)
│   ├── navegacion/LayoutRaiz.tsx # + Stack.Screen "explorar/[eventoId]" (con-usuario)
│   └── features/eventos/
│       ├── pantallas/{Explorar,DetalleEvento}.tsx            # nuevas
│       ├── componentes/{TarjetaEvento,TarjetaSkeleton,SelectorOrden,FilaImagenes}.tsx  # nuevos
│       ├── componentes/SelectorCategoria.tsx                 # + modo conTodas
│       ├── useCatalogo.ts       # useCatalogo, useInvalidarCatalogo (nuevo)
│       ├── useValorDemorado.ts  # debounce (nuevo)
│       ├── mutaciones.ts        # + invalidar ["catalogo"]
│       ├── formato.ts           # + textoPrecioDesde, textoPuntaje
│       └── index.ts             # + Explorar, DetalleEvento
└── tests/
    ├── api/eventos.test.ts                      # + listarEventos
    ├── componentes/{segun-consulta,lista-vacia}.test.tsx
    ├── features/eventos/formato.test.ts
    ├── features/eventos/selector-categoria.test.tsx   # modo conTodas (nuevo)
    ├── pantallas/{explorar,detalle-evento}.test.tsx   # nuevos
    ├── pantallas/catalogo-actualizado.test.tsx        # las escrituras de la 004 invalidan el catálogo (nuevo)
    ├── helpers/eventos.ts                       # fixtures con organizador y del catálogo
    └── tipos/rutas-tipadas.ts                   # + /explorar/[eventoId]

docs/backlog.md                  # 005 → plan (ahora) → … → en PR
AGENTS.md                        # al cerrar: GET /eventos, Resenia mínima, Explorar, clave catalogo
```

**Structure Decision**: la estructura de la 001/004 (backend en capas) y de la 003/004 (mobile
en base, features y conectores), sin carpetas nuevas de primer nivel:
- la búsqueda, el orden y el cálculo del puntaje son módulos puros de `domain/` (como
  `hora-buenos-aires.ts`); `ReseniaService` solo lee las reseñas y delega el cálculo;
- `Resenia` sigue el camino de `Compra`: entidad, interfaz y repositorio mínimos, sin endpoints;
- Explorar va en la feature `eventos` por las reglas de dependencia (R11).

## Complexity Tracking

Sin violaciones de la constitución: no hay filas que justificar.
