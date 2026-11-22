# Implementation Plan: Paginación

**Branch**: `feature/013-paginacion` | **Date**: 2026-11-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/013-paginacion/spec.md`

## Summary

UC-03, UC-02 y UC-10. Tres listas dejan de llegar enteras y pasan a llegar en páginas de 10,
armadas por el servidor, con un paginador común en la app:

- el catálogo de Explorar;
- las compras de Compras del evento;
- las reseñas del organizador, en una pantalla nueva, "Ver todas las reseñas".

La sección "Reseñas del organizador" del detalle se recorta a las 3 más recientes, con el puntaje
y la cantidad reales.

**Backend**:

- **Común**:
  - `paginar(elementos, numero)` es una función pura en `domain/paginacion.ts`: corta la lista ya
    ordenada y filtrada y calcula `PaginaVista` (R1).
  - Una página posterior a la última devuelve la última, y la lista vacía, la página 1 sin
    elementos (FR-005).
  - `paginaSchema` valida `?pagina` (≥ 1, por defecto 1) (R2).
  - `LIMITES_PAGINACION` y `PaginaVista` van en `shared/src/paginacion.ts`.
- **Catálogo**:
  - `EventoService.listar` filtra y ordena todo como en la 005, corta la página y arma la vista
    (cupo al día, categorías y organizadores) solo para esos 10 eventos (R3).
  - `hayEventosProximos` no cambia.
- **Compras del evento**:
  - `?estado` y `?sinResponder` filtran en el servidor con `filtrarComprasDelEvento` (puro, sobre el
    estado al día) antes de paginar.
  - La ventana, el resumen por tipo, el contador y el nuevo `cantidadCompras` son de todas las
    compras.
  - Los compradores se leen en lote solo para la página (R4).
- **Reseñas**:
  - `GET …/resenias-del-organizador` pasa a ser la colección paginada (`?pagina`).
  - `GET …/resenias-del-organizador/resumen` (nueva) da la forma de la 012 con las 3 más recientes.
  - Las dos comparten las lecturas y el cálculo del puntaje (R5).
- **Seed** (R11):
  - 5 eventos próximos nuevos (12 en el catálogo);
  - 10 compras nuevas en el Festival (12);
  - 2 eventos realizados nuevos de Martín con 8 reseñas: Martín pasa a 11 reseñas, ≈ 4,73, y sigue
    viéndose "4,7".
- Se actualizan la OpenAPI y Postman.

**Mobile**:

- **Base**:
  - `Paginador` y `botonesDelPaginador` (regla de los 5 botones, accesible, la actual por sombra y
    peso) (R6);
  - `usePagina(criterio)` (vuelve a 1 al cambiar el criterio) (R7);
  - `PantallaDesplazable` suma `volverArribaCon` (R9).
- **`eventos`**:
  - Explorar con la página en la clave y el paginador al pie;
  - la sección del detalle con el resumen y "Ver todas las reseñas";
  - la pantalla nueva `TodasLasResenias` en `explorar/[eventoId]/resenias` (R10).
- **`compras`**:
  - Compras del evento con el filtro y la página en la query (`consultaDelFiltro` reemplaza a
    `filtrarCompras`);
  - `keepPreviousData` para que el resumen y los chips no parpadeen, con "Cargando compras…" en
    lugar de las filas (R8);
  - los chips según `cantidadCompras`.

**Constitución**: sin enmiendas.

Las decisiones están en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript strict (`~6.0`) en los tres paquetes; Node ≥ 22.12

**Primary Dependencies**:
- Backend: Express 5 y zod 4.
- Mobile: Expo SDK 58, Expo Router y TanStack Query v5 (`keepPreviousData` ya viene incluido).
- **Sin dependencias nuevas.**

**Storage**: repositorios en memoria (`Map` privado), **sin cambios**. Una página es una vista: no
se guarda.

**Testing**:
- Backend: Vitest y supertest.
  - domain: `paginar` y `filtrarComprasDelEvento`;
  - validations y api: `pagina`, `estado` y `sinResponder`;
  - services: las lecturas solo de la página;
  - seed y docs.
- Mobile: Jest, jest-expo y RNTL con `renderConDependencias` y `porRuta`.
  - lógica pura: `botonesDelPaginador` de 1 a 20 páginas y SC-004;
  - `Paginador` y `usePagina`;
  - las pantallas Explorar, Compras del evento, Detalle y Ver todas las reseñas.

**Target Platform**: servidor Node local; Android con Expo Go (compatible con iOS)

**Project Type**: mobile-app con API (monorepo `backend/`, `shared/`, `mobile/`)

**Performance Goals**:
- Como máximo 10 elementos por respuesta paginada y 3 en el resumen (SC-001).
- Las lecturas siguen siendo un número fijo por pedido, sin N+1. Los compradores, las categorías,
  los organizadores y los autores se piden solo para la página.
- Cualquier página de 10 se alcanza en 3 toques o menos (SC-004).

**Constraints**:
- Concatenar las páginas da la lista completa en su orden (SC-002).
- Los totales de Compras del evento son iguales en todas las páginas y con cualquier filtro
  (SC-006).
- El puntaje es el mismo en la tarjeta, el detalle, el resumen y la colección (SC-005).
- La app no elige el tamaño de página.
- 360 px y TalkBack: "Página N" y `selected` (SC-007).
- "Mis compras" no cambia (FR-023).

**Scale/Scope**:
- Backend:
  - 1 ruta nueva y 3 que cambian;
  - 2 funciones puras, 1 esquema común y 2 validaciones ampliadas;
  - 3 métodos de service que cambian y 1 nuevo;
  - ~4 tipos compartidos;
  - el seed, con 7 eventos, 18 compras y 8 reseñas más.
- Mobile:
  - 1 componente, 1 hook y 1 función pura de la base;
  - 1 pantalla y 1 ruta nuevas;
  - 4 funciones de API y 4 claves que cambian;
  - 3 pantallas o secciones que cambian.
- Unos 15 archivos de test nuevos o ampliados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple el plan | Estado |
|---|---|---|
| Dominio · Reglas | No agrega ni cambia reglas: cupo, estados, reseñas y puntaje quedan igual. El puntaje se sigue calculando sobre **todas** las reseñas (FR-021). El estado que filtra es el **al día**, el mismo que ya se muestra | ✅ |
| Dominio · Operaciones atómicas | Las tres listas son lecturas: sin cerrojo y sin guardar, como en 005, 008 y 012 | ✅ |
| I. Spec-Driven | La spec tiene 4 clarificaciones; sigue tasks → implement. El backlog se actualiza al cerrar la feature | ✅ |
| II. Test-First | Bordes: 0, 10, 11 elementos; página 0, −1, `1.5`, texto, última + 1; filtros vacíos; 1 a 20 páginas en el paginador (R12). TDD con stub de firma real | ✅ |
| III. Capas | `paginar` y `filtrarComprasDelEvento` son puras, en `domain/`. Los services ordenan, filtran y cortan; el repositorio no se entera. Los 404/403 siguen en sus dueños (`EventoService.obtenerOFallar`, `leerDelOrganizador`). Sin services ni controllers nuevos: la ruta `/resumen` va en `EventoController` | ✅ |
| IV. Persistencia en memoria | Sin cambios en los repositorios. Ids fijos nuevos en el seed (`evento-…`, `compra-…`, `resenia-…`) y los existentes intactos | ✅ |
| V. Contrato de API | Parámetros en la query, recursos en kebab-case (`…/resenias-del-organizador/resumen`), formato de error único con detalle por campo, orden de rechazos documentado y la OpenAPI con su test | ✅ |
| VI. Identidad simulada | Compras del evento sigue siendo solo del organizador (403) y sin códigos; las reseñas siguen siendo públicas y sin el id del autor | ✅ |
| VII. App Mobile | `fetch` solo en `src/api/`. Los cuatro estados con `SegunConsulta`, también en la pantalla nueva. El paginador es accesible y la actual se distingue sin color. Entra en 360 px. Sin bibliotecas de paginación | ✅ |
| VIII. Tipos compartidos | `PaginaVista`, `LIMITES_PAGINACION`, `ConsultaComprasDelEvento` y `PaginaDeReseniasVista` en `shared/` | ✅ |
| IX. Calidad | `strict`, las cuatro verificaciones y el CI. Una sola función de paginación y un solo paginador (YAGNI: sin cursor, sin "…" ni anterior/siguiente) | ✅ |

**Gate**: pasa sin violaciones ni enmiendas.

**Re-check post-diseño**: data-model, los contratos y quickstart no cambian la tabla. Hay cuatro
cambios de piezas compartidas, todos con test:

- **`GET …/resenias-del-organizador`** cambia de significado: pasa de todas las reseñas a una
  página. La sección de la 012 se muda a `/resumen`, en la misma feature. No hay otros
  consumidores, salvo Postman, que se actualiza.
- **`ComprasDelEventoVista.compras`** pasa de "todas" a "la página filtrada". La app deja de
  filtrar (`filtrarCompras` se elimina) y lee `cantidadCompras` para los chips.
- **`claves.comprasDelEvento`** suma un tercer elemento opcional. El prefijo de dos elementos que
  usan las mutations sigue alcanzando todas las páginas.
- **`PantallaDesplazable`** suma una prop opcional; las pantallas que no la pasan no cambian.

## Project Structure

### Documentation (this feature)

```text
specs/013-paginacion/
├── spec.md
├── plan.md              # este archivo
├── research.md          # R1–R12
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md           # pagina, filtros de Compras del evento, colección y resumen de reseñas
│   └── app.md           # paginador, Explorar, Compras del evento, sección y pantalla de reseñas
├── checklists/
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
shared/src/
├── paginacion.ts (nuevo)                     # LIMITES_PAGINACION, PaginaVista
├── evento.ts                                 # ConsultaCatalogo.pagina, CatalogoVista.pagina
├── compra.ts                                 # ConsultaComprasDelEvento; ComprasDelEventoVista.pagina y cantidadCompras
├── resenia.ts                                # PaginaDeReseniasVista
└── index.ts

backend/src/
├── domain/paginacion.ts (nuevo)              # paginar
├── domain/compras-del-evento.ts              # filtrarComprasDelEvento
├── validations/comunes.ts                    # paginaSchema
├── validations/evento.validation.ts          # consultaCatalogo.pagina; reseniasDelOrganizador (query pagina)
├── validations/compra.validation.ts          # comprasDelEvento: query pagina, estado, sinResponder
├── services/evento.service.ts                # listar paginado; reseniasDelOrganizador(eventoId, pagina); resumenDeResenias
├── services/compra.service.ts                # comprasDelEvento(eventoId, usuarioId, consulta)
├── services/resenia.vistas.ts                # la vista paginada
├── controllers/{evento, compra}.controller.ts
├── routes/eventos.routes.ts                  # GET /:eventoId/resenias-del-organizador/resumen
├── seed/datos-ejemplo.ts                     # 7 eventos, 18 compras, 8 reseñas más
└── docs/{openapi.json, ai-ticket-it.postman_collection.json}

backend/tests/
├── domain/{paginacion (nuevo), compras-del-evento, datos-ejemplo}.test.ts
├── services/{evento.service, compra.service}.test.ts
└── api/{eventos (catálogo), compras (Compras del evento), resenias, docs}.test.ts

mobile/
├── app/explorar/[eventoId]/resenias.tsx (nueva)
└── src/
    ├── componentes/
    │   ├── botones-del-paginador.ts (nuevo)  # botonesDelPaginador (no `paginador.ts`: choca con `Paginador.tsx` en Windows)
    │   ├── Paginador.tsx (nuevo)
    │   ├── usePagina.ts (nuevo)
    │   ├── PantallaDesplazable.tsx           # volverArribaCon
    │   └── index.ts
    ├── api/{eventos, compras, resenias}.ts (+ index.ts)
    ├── consultas/claves.ts                   # catalogo con pagina, comprasDelEvento con filtro y pagina, paginaDeResenias
    ├── navegacion/LayoutRaiz.tsx             # explorar/[eventoId]/resenias
    └── features/
        ├── eventos/
        │   ├── useCatalogo.ts · useReseniasDelOrganizador.ts (resumen) · usePaginaDeResenias.ts (nuevo)
        │   ├── pantallas/{Explorar, TodasLasResenias (nueva)}.tsx
        │   ├── componentes/ReseniasDelOrganizador.tsx   # 3 + "Ver todas las reseñas"
        │   └── index.ts
        └── compras/
            ├── useComprasDelEvento.ts        # filtro y pagina, keepPreviousData
            ├── filtro-de-compras.ts          # consultaDelFiltro (sin filtrarCompras)
            └── pantallas/ComprasDelEvento.tsx

mobile/tests/
├── componentes/{botones-del-paginador, paginador-componente, usePagina}.test.ts(x) (nuevos)
├── api/{eventos, compras, resenias}.test.ts
├── features/compras/filtro-de-compras.test.ts
├── helpers/{render-con-dependencias.tsx, compras.ts}
├── tipos/rutas-tipadas.ts                    # /explorar/[eventoId]/resenias
└── pantallas/{explorar, compras-del-evento, detalle-evento, todas-las-resenias (nuevo)}.test.tsx

AGENTS.md · docs/backlog.md                   # al cerrar la feature
```

**Structure Decision**: la del monorepo actual.

- La paginación común es una función de `domain/` y un componente de la base de la app, sin capas
  ni services nuevos.
- Cada lista se pagina en el service que ya la arma: `EventoService` (catálogo y reseñas) y
  `CompraService` (Compras del evento).
- En mobile, la pantalla nueva es de `eventos`, junto a la sección de la que sale, y `compras` solo
  cambia su pantalla del organizador.

## Complexity Tracking

Sin violaciones que justificar.
