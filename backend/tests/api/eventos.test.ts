import { EstadoCompra } from "@ai-ticket-it/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { crearApp } from "../../src/app";
import { CompraRepository } from "../../src/repositories/compra.repository";
import { EventoRepository } from "../../src/repositories/evento.repository";
import { ReseniaRepository } from "../../src/repositories/resenia.repository";
import { crearRepositoriosDeEjemplo } from "../../src/seed/repositorios-de-ejemplo";
import { compra, DIA, evento, musica, relojFijo, resenia, SIN_PAGINAS, teatro } from "../helpers/eventos";

// Repositorios de ejemplo nuevos por app, armados con el instante del reloj fijo.
const reloj = relojFijo(new Date("2026-11-10T15:00:00.000Z"));
const nuevaApp = () => crearApp({ reloj });
/** El seed sin las reseñas de la 012: todos los organizadores sin puntaje (las reglas de la 005). */
const appSinResenias = () =>
  crearApp({
    reloj,
    repositorios: {
      ...crearRepositoriosDeEjemplo(reloj.ahora()),
      resenias: new ReseniaRepository([]),
    },
  });

const LUCIA = "usuario-lucia";
const SOFIA = "usuario-sofia";
const DIEGO = "usuario-diego";

function esperarError(respuesta: request.Response, status: number, codigo: string): void {
  expect(respuesta.status).toBe(status);
  expect(respuesta.body).toMatchObject({ error: { codigo, mensaje: expect.any(String) } });
}

type RespuestaDelCatalogo = Pick<request.Response, "status" | "body">;

/** Los ids del catálogo, en el orden de la respuesta. */
const idsDelCatalogo = (respuesta: RespuestaDelCatalogo) =>
  (respuesta.body.eventos as { id: string }[]).map((e) => e.id);

/**
 * El catálogo entero de una consulta (feature 013): pide todas sus páginas y concatena los eventos,
 * que salen en el orden de la lista completa (SC-002). Un rechazo vuelve tal cual.
 */
async function catalogoEntero(app: ReturnType<typeof nuevaApp>, query = ""): Promise<RespuestaDelCatalogo> {
  const primera = await request(app).get(`/api/eventos?${query}`);
  if (primera.status !== 200) return primera;
  const eventos = [...primera.body.eventos];
  for (let numero = 2; numero <= primera.body.pagina.totalPaginas; numero += 1) {
    const siguiente = await request(app).get(`/api/eventos?${query}&pagina=${numero}`);
    eventos.push(...siguiente.body.eventos);
  }
  return { status: primera.status, body: { ...primera.body, eventos } };
}

/** Los 12 próximos del seed (feature 013, R11), por fecha: 2 páginas (10 + 2). */
const PROXIMOS_POR_FECHA = [
  "evento-pena-en-la-rueda",
  "evento-noche-de-rock",
  "evento-feria-del-libro-independiente",
  "evento-clasico-de-basquet",
  "evento-match-de-impro",
  "evento-hamlet",
  "evento-torneo-de-futbol-5",
  "evento-charla-ia-aplicada",
  "evento-microfono-abierto",
  "evento-feria-de-cerveza-artesanal",
  "evento-festival-sonidos-del-sur",
  "evento-maraton-10k",
];

describe("GET /api/eventos (catálogo)", () => {
  it("es público: los 10 primeros de los 12 próximos del seed por fecha, con hayEventosProximos (013)", async () => {
    const respuesta = await request(nuevaApp()).get("/api/eventos");
    expect(respuesta.status).toBe(200);
    expect(idsDelCatalogo(respuesta)).toEqual(PROXIMOS_POR_FECHA.slice(0, 10));
    expect(respuesta.body.pagina).toEqual({ numero: 1, tamano: 10, totalElementos: 12, totalPaginas: 2 });
    expect(respuesta.body.hayEventosProximos).toBe(true);
  });

  it("?pagina=2 → los 2 restantes del seed (013)", async () => {
    const respuesta = await request(nuevaApp()).get("/api/eventos?pagina=2");
    expect(idsDelCatalogo(respuesta)).toEqual(PROXIMOS_POR_FECHA.slice(10));
    expect(respuesta.body.pagina).toEqual({ numero: 2, tamano: 10, totalElementos: 12, totalPaginas: 2 });
  });

  it("un X-Usuario-Id inválido se ignora", async () => {
    const respuesta = await request(nuevaApp()).get("/api/eventos").set("X-Usuario-Id", "nadie");
    expect(respuesta.status).toBe(200);
    expect(idsDelCatalogo(respuesta)).toEqual(PROXIMOS_POR_FECHA.slice(0, 10));
  });

  it("Hamlet sale agotado, la Maratón gratis y cada organizador con su puntaje (012, R10)", async () => {
    const { body } = await catalogoEntero(nuevaApp());
    const porId = new Map((body.eventos as { id: string }[]).map((e) => [e.id, e]));
    expect(porId.get("evento-hamlet")).toMatchObject({ agotado: true, precioDesde: 18000 });
    expect(porId.get("evento-maraton-10k")).toMatchObject({ agotado: false, precioDesde: 0 });
    expect(porId.get("evento-clasico-de-basquet")).toEqual({
      id: "evento-clasico-de-basquet",
      nombre: "Clásico de básquet",
      categoria: { id: "categoria-deportes", nombre: "Deportes" },
      fechaHora: expect.any(String),
      fechaHoraLocal: expect.any(String),
      organizadorId: SOFIA,
      realizado: false,
      cantidadTiposEntrada: 2,
      precioDesde: 8000,
      agotado: false,
      organizador: { id: SOFIA, nombre: "Sofía", apellido: "Castro", puntaje: 2.5, cantidadResenias: 2 },
    });
    for (const evento of body.eventos.filter((e: { organizadorId: string }) => e.organizadorId === LUCIA)) {
      expect(evento.organizador).toMatchObject({ puntaje: null, cantidadResenias: 0 });
    }
  });

  it("con todo el seed realizado responde vacío con hayEventosProximos: false", async () => {
    const app = crearApp({
      repositorios: crearRepositoriosDeEjemplo(new Date("2026-11-10T15:00:00.000Z")),
      reloj: relojFijo(new Date("2027-06-01T00:00:00.000Z")),
    });
    const respuesta = await request(app).get("/api/eventos");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ eventos: [], pagina: SIN_PAGINAS, hayEventosProximos: false });
  });
});

describe("GET /api/eventos: paginado (feature 013, US1)", () => {
  // 13 próximos: p01…p12 de Lucía (uno por día) y uno de Martín al final por fecha, pero con el mejor
  // puntaje (la reseña de su evento realizado). p04, p08 y p12 son de Teatro; p11 es "Noche de tango".
  const proximos = Array.from({ length: 12 }, (_, i) => {
    const numero = String(i + 1).padStart(2, "0");
    return evento({
      id: `evento-p${numero}`,
      nombre: i === 10 ? "Noche de tango" : `Función ${numero}`,
      categoriaId: i % 4 === 3 ? teatro.id : musica.id,
      en: (i + 1) * DIA,
    });
  });
  const deMartin = evento({ id: "evento-martin", organizadorId: "usuario-martin", en: 20 * DIA });
  const pasadoDeMartin = evento({ id: "evento-martin-pasado", organizadorId: "usuario-martin", en: -DIA });
  const POR_FECHA = [...proximos.map((e) => e.id), deMartin.id];

  const appConMuchos = () =>
    crearApp({
      reloj,
      repositorios: {
        eventos: new EventoRepository([...proximos, deMartin, pasadoDeMartin]),
        compras: new CompraRepository([]),
        resenias: new ReseniaRepository([resenia(pasadoDeMartin.id, 5)]),
      },
    });
  const catalogo = (query = "") => request(appConMuchos()).get(`/api/eventos${query}`);

  it("sin pagina → los 10 primeros y los totales del catálogo", async () => {
    const respuesta = await catalogo();
    expect(respuesta.status).toBe(200);
    expect(idsDelCatalogo(respuesta)).toEqual(POR_FECHA.slice(0, 10));
    expect(respuesta.body.pagina).toEqual({ numero: 1, tamano: 10, totalElementos: 13, totalPaginas: 2 });
    expect(respuesta.body.hayEventosProximos).toBe(true);
  });

  it("?pagina=2 → los que siguen, en el orden de la lista completa (concatenar = la lista, SC-002)", async () => {
    const primera = await catalogo("?pagina=1");
    const segunda = await catalogo("?pagina=2");
    expect(idsDelCatalogo(segunda)).toEqual(POR_FECHA.slice(10));
    expect(segunda.body.pagina).toEqual({ numero: 2, tamano: 10, totalElementos: 13, totalPaginas: 2 });
    expect([...idsDelCatalogo(primera), ...idsDelCatalogo(segunda)]).toEqual(POR_FECHA);
  });

  it("una página posterior a la última → la última, con su número real (FR-005)", async () => {
    const respuesta = await catalogo("?pagina=9");
    expect(respuesta.status).toBe(200);
    expect(idsDelCatalogo(respuesta)).toEqual(POR_FECHA.slice(10));
    expect(respuesta.body.pagina.numero).toBe(2);
  });

  it.each(["?pagina=0", "?pagina=abc"])("%s → 400 sobre query.pagina", async (query) => {
    expect(detalles(await catalogo(query))).toEqual({
      "query.pagina": "Debe ser un entero mayor o igual a 1.",
    });
  });

  it("?tamano=50 se ignora: la página sigue siendo de 10 (FR-006)", async () => {
    const respuesta = await catalogo("?tamano=50");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.eventos).toHaveLength(10);
    expect(respuesta.body.pagina.tamano).toBe(10);
  });

  it("orden=puntaje&sentido=desc: el evento del mejor organizador sale en la página 1 aunque su fecha lo ponga al final (US1-4)", async () => {
    const respuesta = await catalogo("?orden=puntaje&sentido=desc");
    expect(idsDelCatalogo(respuesta)[0]).toBe(deMartin.id);
    expect(idsDelCatalogo(respuesta)).toHaveLength(10);
  });

  it("un texto sin coincidencias → la página 1 vacía y hayEventosProximos: true (FR-014)", async () => {
    const respuesta = await catalogo("?texto=zzz&pagina=3");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ eventos: [], pagina: SIN_PAGINAS, hayEventosProximos: true });
  });

  it("la categoría y el texto se aplican antes de cortar: lo de la página 2 sin filtro aparece en la 1", async () => {
    const teatros = await catalogo("?categoriaId=categoria-teatro");
    expect(idsDelCatalogo(teatros)).toEqual(["evento-p04", "evento-p08", "evento-p12"]);
    expect(teatros.body.pagina).toEqual({ numero: 1, tamano: 10, totalElementos: 3, totalPaginas: 1 });
    const tango = await catalogo("?texto=tango");
    expect(idsDelCatalogo(tango)).toEqual(["evento-p11"]);
    expect(tango.body.pagina.totalElementos).toBe(1);
  });
});

describe("GET /api/eventos: texto y categoría (US3)", () => {
  // El catálogo entero (todas sus páginas, feature 013): las reglas de la 005 sobre la lista completa.
  const catalogo = (query: string) => catalogoEntero(nuevaApp(), query);

  it.each(["texto=BASQUET", "texto=b%C3%A1squet", "texto=%20basquet%20"])(
    "%s → solo el Clásico",
    async (query) => {
      const respuesta = await catalogo(query);
      expect(respuesta.status).toBe(200);
      expect(idsDelCatalogo(respuesta)).toEqual(["evento-clasico-de-basquet"]);
    },
  );

  it.each(["texto=club+rock", "texto=rock%20%20%20club"])("%s → Noche de Rock", async (query) => {
    expect(idsDelCatalogo(await catalogo(query))).toEqual(["evento-noche-de-rock"]);
  });

  it("texto=clasico → el Clásico (nombre) y Hamlet (descripción)", async () => {
    expect(idsDelCatalogo(await catalogo("texto=clasico"))).toEqual([
      "evento-clasico-de-basquet",
      "evento-hamlet",
    ]);
  });

  it("categoriaId=categoria-musica → la Peña y Noche de Rock (Jazz en el Patio ya se realizó)", async () => {
    expect(idsDelCatalogo(await catalogo("categoriaId=categoria-musica"))).toEqual([
      "evento-pena-en-la-rueda",
      "evento-noche-de-rock",
    ]);
  });

  it("categoriaId=categoria-stand-up → el Micrófono abierto (Noche de risas ya se realizó)", async () => {
    expect(idsDelCatalogo(await catalogo("categoriaId=categoria-stand-up"))).toEqual([
      "evento-microfono-abierto",
    ]);
  });

  it.each(["texto=rock&categoriaId=categoria-stand-up", "texto=rock&categoriaId=categoria-deportes"])(
    "%s → vacío con hayEventosProximos: true",
    async (query) => {
      const respuesta = await catalogo(query);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({ eventos: [], pagina: SIN_PAGINAS, hayEventosProximos: true });
    },
  );

  it("una categoría que no existe → 400 sobre query.categoriaId (no la lista vacía)", async () => {
    expect(detalles(await catalogo("categoriaId=categoria-inexistente"))).toEqual({
      "query.categoriaId": "No existe la categoría.",
    });
  });

  it("categoriaId de solo espacios → sin filtro", async () => {
    const respuesta = await catalogo("categoriaId=%20%20");
    expect(respuesta.status).toBe(200);
    expect(idsDelCatalogo(respuesta)).toEqual(PROXIMOS_POR_FECHA);
  });

  it("un texto de 101 caracteres → 400; 100 con espacios alrededor → 200", async () => {
    expect(detalles(await catalogo(`texto=${"a".repeat(101)}`))).toEqual({
      "query.texto": "Debe tener como máximo 100 caracteres.",
    });
    const respuesta = await catalogo(`texto=%20%20${"a".repeat(100)}%20%20`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ eventos: [], pagina: SIN_PAGINAS, hayEventosProximos: true });
  });

  it.each([
    ["texto=a&texto=b", "query.texto"],
    ["categoriaId=a&categoriaId=b", "query.categoriaId"],
  ])("%s repetido → 400 Debe ser un texto.", async (query, campo) => {
    expect(detalles(await catalogo(query))).toEqual({ [campo]: "Debe ser un texto." });
  });
});

describe("GET /api/eventos: orden (US4)", () => {
  // El catálogo entero (todas sus páginas, feature 013): las reglas de la 005 sobre la lista completa.
  const catalogo = (query: string) => catalogoEntero(nuevaApp(), query);

  const POR_PRECIO = [
    "evento-maraton-10k",
    "evento-charla-ia-aplicada",
    "evento-feria-del-libro-independiente",
    "evento-microfono-abierto",
    "evento-pena-en-la-rueda",
    "evento-clasico-de-basquet",
    "evento-match-de-impro",
    "evento-feria-de-cerveza-artesanal",
    "evento-noche-de-rock",
    "evento-hamlet",
    "evento-torneo-de-futbol-5",
    "evento-festival-sonidos-del-sur",
  ];

  it("orden=precio → del gratis (la Maratón) al más caro (el Festival)", async () => {
    expect(idsDelCatalogo(await catalogo("orden=precio"))).toEqual(POR_PRECIO);
  });

  it("orden=puntaje sin reseñas y sin orden → igual que por fecha", async () => {
    const sinResenias = await catalogoEntero(appSinResenias(), "orden=puntaje");
    expect(idsDelCatalogo(sinResenias)).toEqual(PROXIMOS_POR_FECHA);
    expect(idsDelCatalogo(await catalogo("orden=fecha"))).toEqual(PROXIMOS_POR_FECHA);
  });

  it("sentido=desc invierte el criterio: orden=precio&sentido=desc → el más caro primero", async () => {
    expect(idsDelCatalogo(await catalogo("orden=precio&sentido=desc"))).toEqual(POR_PRECIO.toReversed());
    expect(idsDelCatalogo(await catalogo("orden=fecha&sentido=desc"))).toEqual(
      PROXIMOS_POR_FECHA.toReversed(),
    );
    expect(idsDelCatalogo(await catalogo("orden=fecha&sentido=asc"))).toEqual(PROXIMOS_POR_FECHA);
  });

  // Los próximos de cada organizador, por fecha (los desempates).
  const DE_MARTIN = PROXIMOS_POR_FECHA.filter((id) =>
    [
      "evento-feria-del-libro-independiente",
      "evento-hamlet",
      "evento-charla-ia-aplicada",
      "evento-microfono-abierto",
    ].includes(id),
  );
  const DE_SOFIA = ["evento-clasico-de-basquet", "evento-match-de-impro", "evento-torneo-de-futbol-5"];
  const DE_LUCIA = PROXIMOS_POR_FECHA.filter((id) => !DE_MARTIN.includes(id) && !DE_SOFIA.includes(id));

  it("orden=puntaje&sentido=desc con el seed: Martín (4,7) → Sofía (2,5) → Lucía sin reseñas (012, SC-005)", async () => {
    const respuesta = await catalogo("orden=puntaje&sentido=desc");
    expect(idsDelCatalogo(respuesta)).toEqual([...DE_MARTIN, ...DE_SOFIA, ...DE_LUCIA]);
    expect(idsDelCatalogo(respuesta)).not.toEqual(PROXIMOS_POR_FECHA);
    expect(idsDelCatalogo(await catalogo("orden=puntaje"))).toEqual(idsDelCatalogo(respuesta));
    const organizadores = new Map(
      (
        respuesta.body.eventos as {
          organizador: { id: string; puntaje: number | null; cantidadResenias: number };
        }[]
      ).map((e) => [e.organizador.id, e.organizador]),
    );
    expect(organizadores.get("usuario-martin")).toMatchObject({ puntaje: 52 / 11, cantidadResenias: 11 });
    expect(organizadores.get(SOFIA)).toMatchObject({ puntaje: 2.5, cantidadResenias: 2 });
    expect(organizadores.get(LUCIA)).toMatchObject({ puntaje: null, cantidadResenias: 0 });
  });

  it("orden=puntaje&sentido=asc con el seed: Sofía → Martín → los sin reseñas al final", async () => {
    expect(idsDelCatalogo(await catalogo("orden=puntaje&sentido=asc"))).toEqual([
      ...DE_SOFIA,
      ...DE_MARTIN,
      ...DE_LUCIA,
    ]);
  });

  it("orden=puntaje&sentido=asc sin reseñas → igual que por fecha (sin puntaje siempre al final)", async () => {
    const sinResenias = await catalogoEntero(appSinResenias(), "orden=puntaje&sentido=asc");
    expect(idsDelCatalogo(sinResenias)).toEqual(PROXIMOS_POR_FECHA);
  });

  it.each(["sentido=arriba", "sentido=asc&sentido=desc"])("%s → 400 sobre query.sentido", async (query) => {
    expect(detalles(await catalogo(query))).toEqual({ "query.sentido": "Debe ser asc o desc." });
  });

  it("orden=nombre → 400 sobre query.orden", async () => {
    expect(detalles(await catalogo("orden=nombre"))).toEqual({
      "query.orden": "Debe ser fecha, precio o puntaje.",
    });
  });

  it("un orden repetido → 400", async () => {
    expect(detalles(await catalogo("orden=fecha&orden=precio"))).toEqual({
      "query.orden": "Debe ser fecha, precio o puntaje.",
    });
  });
});

describe("GET /api/eventos/mios", () => {
  it("responde 401 sin X-Usuario-Id", async () => {
    esperarError(await request(nuevaApp()).get("/api/eventos/mios"), 401, "USUARIO_NO_IDENTIFICADO");
  });

  it("Lucía ve la Peña, Noche de Rock, la Feria de cerveza (013), Festival y Maratón, en ese orden", async () => {
    const respuesta = await request(nuevaApp()).get("/api/eventos/mios").set("X-Usuario-Id", LUCIA);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.map((e: { id: string }) => e.id)).toEqual([
      "evento-pena-en-la-rueda",
      "evento-noche-de-rock",
      "evento-feria-de-cerveza-artesanal",
      "evento-festival-sonidos-del-sur",
      "evento-maraton-10k",
    ]);
    expect(respuesta.body[3]).toEqual({
      id: "evento-festival-sonidos-del-sur",
      nombre: "Festival Sonidos del Sur",
      categoria: { id: "categoria-festivales", nombre: "Festivales" },
      fechaHora: "2026-12-10T17:00:00.000Z",
      fechaHoraLocal: "2026-12-10T14:00",
      organizadorId: LUCIA,
      realizado: false,
      cantidadTiposEntrada: 3,
    });
  });

  it("Sofía ve el Clásico de básquet, el Match de impro y el Torneo (013) y, al final, Noche de risas realizada", async () => {
    const respuesta = await request(nuevaApp()).get("/api/eventos/mios").set("X-Usuario-Id", SOFIA);
    expect(respuesta.body.map((e: { id: string; realizado: boolean }) => [e.id, e.realizado])).toEqual([
      ["evento-clasico-de-basquet", false],
      ["evento-match-de-impro", false],
      ["evento-torneo-de-futbol-5", false],
      ["evento-noche-de-risas", true],
    ]);
  });

  it("un usuario sin eventos recibe []", async () => {
    const respuesta = await request(nuevaApp()).get("/api/eventos/mios").set("X-Usuario-Id", DIEGO);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual([]);
  });
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** El ejemplo del contrato (contracts/api.md, POST /api/eventos), con cambios. */
function cuerpoNuevo(cambios: Record<string, unknown> = {}) {
  return {
    nombre: "Noche de Tango",
    descripcion: "Milonga con orquesta en vivo.",
    categoriaId: "categoria-musica",
    fechaHora: "2026-12-01T20:00",
    multimedia: ["https://example.com/tango.jpg"],
    tiposEntrada: [
      { nombre: "General", precio: 15000, cupo: 200 },
      { nombre: "VIP", descripcion: "Mesa preferencial.", precio: 60000, cupo: 30 },
    ],
    ...cambios,
  };
}

const tiposCon = (segundo: Record<string, unknown>) => [
  { nombre: "General", precio: 15000, cupo: 200 },
  segundo,
];

function crearEvento(app: ReturnType<typeof nuevaApp>, cuerpo: object, usuarioId: string | null = LUCIA) {
  const pedido = request(app).post("/api/eventos");
  if (usuarioId) pedido.set("X-Usuario-Id", usuarioId);
  return pedido.send(cuerpo);
}

/** Los detalles del 400 como `campo → mensaje`. */
function detalles(respuesta: RespuestaDelCatalogo): Record<string, string> {
  expect(respuesta.status).toBe(400);
  expect(respuesta.body.error.codigo).toBe("ENTRADA_INVALIDA");
  return Object.fromEntries(
    (respuesta.body.error.detalles as { campo: string; mensaje: string }[]).map((d) => [d.campo, d.mensaje]),
  );
}

describe("POST /api/eventos", () => {
  it("responde 201 con el evento del usuario actual, sus fechas y UUIDs nuevos", async () => {
    const respuesta = await crearEvento(nuevaApp(), cuerpoNuevo());
    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject({
      id: expect.stringMatching(UUID),
      nombre: "Noche de Tango",
      descripcion: "Milonga con orquesta en vivo.",
      categoria: { id: "categoria-musica", nombre: "Música" },
      fechaHora: "2026-12-01T23:00:00.000Z",
      fechaHoraLocal: "2026-12-01T20:00",
      multimedia: ["https://example.com/tango.jpg"],
      organizadorId: LUCIA,
      realizado: false,
      cantidadTiposEntrada: 2,
      tiposEntrada: [
        { id: expect.stringMatching(UUID), nombre: "General", descripcion: "", precio: 15000, cupo: 200 },
        {
          id: expect.stringMatching(UUID),
          nombre: "VIP",
          descripcion: "Mesa preferencial.",
          precio: 60000,
          cupo: 30,
        },
      ],
      organizador: { id: LUCIA, nombre: "Lucía", apellido: "Álvarez", puntaje: null, cantidadResenias: 0 },
    });
  });

  it("recorta los textos y usa los valores por defecto de descripción y multimedia", async () => {
    const respuesta = await crearEvento(
      nuevaApp(),
      cuerpoNuevo({ nombre: "  Noche de Tango  ", descripcion: undefined, multimedia: undefined }),
    );
    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject({ nombre: "Noche de Tango", descripcion: "", multimedia: [] });
  });

  it("responde 401 sin usuario y no crea nada", async () => {
    const app = nuevaApp();
    esperarError(await crearEvento(app, cuerpoNuevo(), null), 401, "USUARIO_NO_IDENTIFICADO");
    const mios = await request(app).get("/api/eventos/mios").set("X-Usuario-Id", LUCIA);
    expect(mios.body).toHaveLength(5);
  });

  it("responde 400 con un detalle por campo", async () => {
    const respuesta = await crearEvento(
      nuevaApp(),
      cuerpoNuevo({
        nombre: "x".repeat(101),
        categoriaId: "Música",
        fechaHora: "2026-02-30T20:00",
        multimedia: ["ftp://example.com/a.jpg"],
        tiposEntrada: tiposCon({ nombre: "VIP", precio: -1, cupo: 0 }),
      }),
    );
    expect(detalles(respuesta)).toEqual({
      "body.nombre": "Debe tener como máximo 100 caracteres.",
      "body.categoriaId": "Debe ser un identificador válido.",
      "body.fechaHora": "Debe ser una fecha y hora válidas (AAAA-MM-DDTHH:mm).",
      "body.multimedia.0": "Debe ser una URL http o https.",
      "body.tiposEntrada.1.precio": "Debe ser un entero mayor o igual a 0.",
      "body.tiposEntrada.1.cupo": "Debe ser un entero mayor o igual a 1.",
    });
  });

  it.each(["2026-12-01T25:00", "2026-12-01T24:00", "mañana a las 8", "2026-12-01T20:00:00", "2026-12-01"])(
    "rechaza la fecha %s",
    async (fechaHora) => {
      const respuesta = await crearEvento(nuevaApp(), cuerpoNuevo({ fechaHora }));
      expect(detalles(respuesta)).toEqual({
        "body.fechaHora": "Debe ser una fecha y hora válidas (AAAA-MM-DDTHH:mm).",
      });
    },
  );

  it.each([
    ["negativo", -1, "Debe ser un entero mayor o igual a 0."],
    ["con decimales", 1.5, "Debe ser un entero mayor o igual a 0."],
    ["como texto", "15000", "Debe ser un entero mayor o igual a 0."],
    ["null", null, "Es obligatorio."],
  ])("rechaza el precio %s", async (_caso, precio, mensaje) => {
    const respuesta = await crearEvento(
      nuevaApp(),
      cuerpoNuevo({ tiposEntrada: tiposCon({ nombre: "VIP", precio, cupo: 1 }) }),
    );
    expect(detalles(respuesta)).toEqual({ "body.tiposEntrada.1.precio": mensaje });
  });

  it.each([0, -1, 2.5])("rechaza el cupo inicial %s", async (cupo) => {
    const respuesta = await crearEvento(
      nuevaApp(),
      cuerpoNuevo({ tiposEntrada: tiposCon({ nombre: "VIP", precio: 0, cupo }) }),
    );
    expect(detalles(respuesta)).toEqual({
      "body.tiposEntrada.1.cupo": "Debe ser un entero mayor o igual a 1.",
    });
  });

  it("rechaza más de 5 URLs, sin tipos de entrada y los obligatorios que faltan", async () => {
    const seis = Array.from({ length: 6 }, (_, i) => `https://example.com/${i}.jpg`);
    expect(detalles(await crearEvento(nuevaApp(), cuerpoNuevo({ multimedia: seis })))).toEqual({
      "body.multimedia": "Puede tener como máximo 5 URLs.",
    });
    expect(detalles(await crearEvento(nuevaApp(), cuerpoNuevo({ tiposEntrada: [] })))).toEqual({
      "body.tiposEntrada": "El evento necesita al menos un tipo de entrada.",
    });
    expect(detalles(await crearEvento(nuevaApp(), {}))).toEqual({
      "body.nombre": "Es obligatorio.",
      "body.categoriaId": "Es obligatorio.",
      "body.fechaHora": "Es obligatorio.",
      "body.tiposEntrada": "Es obligatorio.",
    });
  });

  it("rechaza un nombre solo con espacios", async () => {
    expect(detalles(await crearEvento(nuevaApp(), cuerpoNuevo({ nombre: "   " })))).toEqual({
      "body.nombre": "Es obligatorio.",
    });
  });

  it("responde 400 con body.categoriaId si la categoría no existe", async () => {
    expect(detalles(await crearEvento(nuevaApp(), cuerpoNuevo({ categoriaId: "categoria-opera" })))).toEqual({
      "body.categoriaId": "No existe la categoría.",
    });
  });

  it("responde 409 FECHA_NO_FUTURA con la fecha de ayer", async () => {
    const respuesta = await crearEvento(nuevaApp(), cuerpoNuevo({ fechaHora: "2026-11-09T12:00" }));
    esperarError(respuesta, 409, "FECHA_NO_FUTURA");
  });

  it.each([
    ["VIP", " vip "],
    ["Platea", "Plátea"],
  ])("responde 409 NOMBRE_TIPO_ENTRADA_REPETIDO con %s y %s", async (primero, segundo) => {
    const tiposEntrada = [
      { nombre: primero, precio: 1, cupo: 1 },
      { nombre: segundo, precio: 1, cupo: 1 },
    ];
    const respuesta = await crearEvento(nuevaApp(), cuerpoNuevo({ tiposEntrada }));
    esperarError(respuesta, 409, "NOMBRE_TIPO_ENTRADA_REPETIDO");
  });

  it("ignora un organizadorId en el cuerpo (FR-009) y el evento aparece en Mis eventos", async () => {
    const app = nuevaApp();
    const respuesta = await crearEvento(app, cuerpoNuevo({ organizadorId: SOFIA }));
    expect(respuesta.body.organizadorId).toBe(LUCIA);
    const mios = await request(app).get("/api/eventos/mios").set("X-Usuario-Id", LUCIA);
    expect(mios.body.map((e: { id: string }) => e.id)).toContain(respuesta.body.id);
    const deSofia = await request(app).get("/api/eventos/mios").set("X-Usuario-Id", SOFIA);
    expect(deSofia.body.map((e: { id: string }) => e.id)).not.toContain(respuesta.body.id);
  });
});

const ROCK = "/api/eventos/evento-noche-de-rock";

describe("GET /api/eventos/:eventoId", () => {
  it("es público y devuelve la vista completa", async () => {
    const respuesta = await request(nuevaApp()).get("/api/eventos/evento-festival-sonidos-del-sur");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      id: "evento-festival-sonidos-del-sur",
      descripcion: "Un día entero de música con artistas de todo el país.",
      fechaHoraLocal: "2026-12-10T14:00",
      organizadorId: LUCIA,
      realizado: false,
      cantidadTiposEntrada: 3,
    });
    expect(respuesta.body.tiposEntrada.map((t: { nombre: string }) => t.nombre)).toEqual([
      "General",
      "VIP",
      "Backstage",
    ]);
    expect(respuesta.body.tiposEntrada[0]).toEqual({
      id: "tipo-festival-sonidos-del-sur-general",
      nombre: "General",
      descripcion: "Acceso al predio.",
      precio: 45000,
      cupo: 496, // 500 − las 4 General confirmadas del seed de la 013
    });
  });

  it("suma el organizador con su puntaje sin redondear (sus 11 reseñas, 013), sin X-Usuario-Id", async () => {
    const respuesta = await request(nuevaApp()).get("/api/eventos/evento-hamlet");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      id: "evento-hamlet",
      organizadorId: "usuario-martin",
      cantidadTiposEntrada: 2,
      organizador: {
        id: "usuario-martin",
        nombre: "Martín",
        apellido: "Benítez",
        puntaje: 52 / 11,
        cantidadResenias: 11,
      },
    });
  });

  it("sigue sirviendo un evento realizado", async () => {
    const respuesta = await request(nuevaApp()).get("/api/eventos/evento-noche-de-risas");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ realizado: true, organizador: { id: SOFIA } });
  });

  it("responde 400 con un id mal formado y 404 si no existe", async () => {
    const app = nuevaApp();
    expect(detalles(await request(app).get("/api/eventos/123"))).toEqual({
      "params.eventoId": "Debe ser un identificador válido.",
    });
    const respuesta = await request(app).get("/api/eventos/evento-inexistente");
    esperarError(respuesta, 404, "EVENTO_NO_ENCONTRADO");
    expect(respuesta.body.error.mensaje).toBe("No existe el evento.");
  });
});

/** Datos de edición válidos para Noche de Rock. */
function cuerpoEditado(cambios: Record<string, unknown> = {}) {
  return {
    nombre: "Noche de Rock (reprogramada)",
    descripcion: "Nueva fecha.",
    categoriaId: "categoria-musica",
    fechaHora: "2026-12-20T21:30",
    multimedia: [],
    ...cambios,
  };
}

describe("PUT /api/eventos/:eventoId", () => {
  it("responde 200, reemplaza los datos y conserva los tipos", async () => {
    const app = nuevaApp();
    const respuesta = await request(app).put(ROCK).set("X-Usuario-Id", LUCIA).send(cuerpoEditado());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      nombre: "Noche de Rock (reprogramada)",
      descripcion: "Nueva fecha.",
      fechaHora: "2026-12-21T00:30:00.000Z",
      fechaHoraLocal: "2026-12-20T21:30",
      multimedia: [],
      tiposEntrada: [{ id: "tipo-noche-de-rock-general" }],
      organizador: { id: LUCIA, puntaje: null, cantidadResenias: 0 },
    });
    // En Mis eventos pasa a su nueva posición (después del Festival).
    const mios = await request(app).get("/api/eventos/mios").set("X-Usuario-Id", LUCIA);
    expect(mios.body.map((e: { id: string }) => e.id)).toEqual([
      "evento-pena-en-la-rueda",
      "evento-feria-de-cerveza-artesanal",
      "evento-festival-sonidos-del-sur",
      "evento-noche-de-rock",
      "evento-maraton-10k",
    ]);
  });

  it("responde 401, 400, 403, 404, 409 EVENTO_REALIZADO y 409 FECHA_NO_FUTURA, sin modificar nada", async () => {
    const app = nuevaApp();
    const antes = (await request(app).get(ROCK)).body;
    esperarError(await request(app).put(ROCK).send(cuerpoEditado()), 401, "USUARIO_NO_IDENTIFICADO");
    expect(
      detalles(
        await request(app)
          .put(ROCK)
          .set("X-Usuario-Id", LUCIA)
          .send(cuerpoEditado({ nombre: "" })),
      ),
    ).toEqual({ "body.nombre": "Es obligatorio." });
    esperarError(
      await request(app).put("/api/eventos/evento-hamlet").set("X-Usuario-Id", LUCIA).send(cuerpoEditado()),
      403,
      "SIN_PERMISO",
    );
    esperarError(
      await request(app).put("/api/eventos/evento-x").set("X-Usuario-Id", LUCIA).send(cuerpoEditado()),
      404,
      "EVENTO_NO_ENCONTRADO",
    );
    esperarError(
      await request(app)
        .put("/api/eventos/evento-noche-de-risas")
        .set("X-Usuario-Id", SOFIA)
        .send(cuerpoEditado()),
      409,
      "EVENTO_REALIZADO",
    );
    esperarError(
      await request(app)
        .put(ROCK)
        .set("X-Usuario-Id", LUCIA)
        .send(cuerpoEditado({ fechaHora: "2026-11-10T11:00" })),
      409,
      "FECHA_NO_FUTURA",
    );
    expect((await request(app).get(ROCK)).body).toEqual(antes);
  });
});

describe("DELETE /api/eventos/:eventoId", () => {
  it("responde 204 y el evento deja de existir", async () => {
    const app = nuevaApp();
    const respuesta = await request(app).delete(ROCK).set("X-Usuario-Id", LUCIA);
    expect(respuesta.status).toBe(204);
    expect(respuesta.text).toBe("");
    esperarError(await request(app).get(ROCK), 404, "EVENTO_NO_ENCONTRADO");
  });

  it("responde 401, 400, 403, 404, 409 EVENTO_REALIZADO y 409 EVENTO_CON_COMPRAS, sin eliminar nada", async () => {
    const app = nuevaApp();
    esperarError(await request(app).delete(ROCK), 401, "USUARIO_NO_IDENTIFICADO");
    expect(detalles(await request(app).delete("/api/eventos/123").set("X-Usuario-Id", LUCIA))).toEqual({
      "params.eventoId": "Debe ser un identificador válido.",
    });
    esperarError(
      await request(app).delete("/api/eventos/evento-hamlet").set("X-Usuario-Id", LUCIA),
      403,
      "SIN_PERMISO",
    );
    esperarError(
      await request(app).delete("/api/eventos/evento-x").set("X-Usuario-Id", LUCIA),
      404,
      "EVENTO_NO_ENCONTRADO",
    );
    esperarError(
      await request(app).delete("/api/eventos/evento-noche-de-risas").set("X-Usuario-Id", SOFIA),
      409,
      "EVENTO_REALIZADO",
    );
    esperarError(
      await request(app).delete("/api/eventos/evento-festival-sonidos-del-sur").set("X-Usuario-Id", LUCIA),
      409,
      "EVENTO_CON_COMPRAS",
    );
    const mios = await request(app).get("/api/eventos/mios").set("X-Usuario-Id", LUCIA);
    expect(mios.body).toHaveLength(5);
  });
});

describe("GET /api/eventos y /api/eventos/:eventoId: cupo al día (feature 006, R3)", () => {
  const INSTANTE = new Date("2026-11-10T15:00:00.000Z");
  const MINUTO = 60 * 1000;

  /** El seed más una compra PENDIENTE de 1 Platea de Hamlet (agotado) hecha `minutos` antes. */
  async function appConPendienteDeHamlet(minutos: number) {
    const repositorios = crearRepositoriosDeEjemplo(INSTANTE);
    await repositorios.compras.guardar(
      compra("evento-hamlet", "tipo-hamlet-platea", EstadoCompra.PENDIENTE, {
        id: "compra-pendiente-hamlet",
        compradorId: DIEGO,
        creadaEn: new Date(INSTANTE.getTime() - minutos * MINUTO),
      }),
    );
    return crearApp({ repositorios, reloj: relojFijo(INSTANTE) });
  }

  it("una compra pendiente vencida devuelve su cupo: el detalle lo muestra y Hamlet deja de estar agotado", async () => {
    const app = await appConPendienteDeHamlet(15);
    const detalle = await request(app).get("/api/eventos/evento-hamlet");
    expect(detalle.status).toBe(200);
    expect(detalle.body.tiposEntrada).toMatchObject([
      { id: "tipo-hamlet-platea", cupo: 1 },
      { id: "tipo-hamlet-pullman", cupo: 0 },
    ]);
    const catalogo = await request(app).get("/api/eventos");
    const hamlet = (catalogo.body.eventos as { id: string; agotado: boolean }[]).find(
      (e) => e.id === "evento-hamlet",
    );
    expect(hamlet?.agotado).toBe(false);
  });

  it("si todavía no venció, el cupo sigue tomado", async () => {
    const app = await appConPendienteDeHamlet(14);
    const detalle = await request(app).get("/api/eventos/evento-hamlet");
    expect(detalle.body.tiposEntrada[0]).toMatchObject({ id: "tipo-hamlet-platea", cupo: 0 });
    const catalogo = await request(app).get("/api/eventos");
    const hamlet = (catalogo.body.eventos as { id: string; agotado: boolean }[]).find(
      (e) => e.id === "evento-hamlet",
    );
    expect(hamlet?.agotado).toBe(true);
  });
});
