import { EstadoCompra } from "@ai-ticket-it/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { crearApp } from "../../src/app";
import { relojFijo } from "../helpers/eventos";

// Reseñas de eventos (feature 012, contracts/api.md) contra los datos de ejemplo.

const AHORA = new Date("2026-11-10T15:00:00.000Z");
const nuevaApp = () => crearApp({ reloj: relojFijo(AHORA) });
type App = ReturnType<typeof nuevaApp>;

const PENA = "evento-pena-en-la-rueda";
const RUTA_PENA = `/api/eventos/${PENA}/resenias`;

const reseniar = (app: App, usuarioId: string | null, cuerpo: unknown, ruta = RUTA_PENA) => {
  const pedido = request(app).post(ruta);
  if (usuarioId !== null) pedido.set("X-Usuario-Id", usuarioId);
  return pedido.send(cuerpo as object);
};

const DATOS = { puntuacion: 4, comentario: "  Muy buena organización  " };

/** El detalle (o los detalles) del 400 sobre `campo`. */
function detallesDe(cuerpo: { error: { detalles?: { campo: string; mensaje: string }[] } }, campo: string) {
  return (cuerpo.error.detalles ?? []).filter((detalle) => detalle.campo === campo);
}

describe("POST /api/eventos/:eventoId/resenias (US1)", () => {
  it("Martín reseña la Peña: 201 con el comentario recortado y la fecha del servidor", async () => {
    const respuesta = await reseniar(nuevaApp(), "usuario-martin", DATOS);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({
      id: expect.any(String),
      eventoId: PENA,
      puntuacion: 4,
      comentario: "Muy buena organización",
      creadaEn: AHORA.toISOString(),
      creadaEnLocal: "2026-11-10T12:00",
    });
  });

  it("las claves extra (compradorId, creadaEn, id) se ignoran", async () => {
    const respuesta = await reseniar(nuevaApp(), "usuario-martin", {
      ...DATOS,
      compradorId: "usuario-sofia",
      creadaEn: "2020-01-01T00:00:00.000Z",
      id: "resenia-trucha",
    });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.id).not.toBe("resenia-trucha");
    expect(respuesta.body.creadaEn).toBe(AHORA.toISOString());
    expect(respuesta.body).not.toHaveProperty("compradorId");
  });

  it("después, la compra trae la reseña y ya no se puede reseñar; el cupo no cambia", async () => {
    const app = nuevaApp();
    const cupos = async () =>
      (
        (await request(app).get(`/api/eventos/${PENA}`)).body.tiposEntrada as { id: string; cupo: number }[]
      ).map((t) => [t.id, t.cupo]);
    const compraDeMartin = () =>
      request(app).get("/api/compras/compra-martin-pena-general").set("X-Usuario-Id", "usuario-martin");
    const cuposAntes = await cupos();
    expect((await compraDeMartin()).body).toMatchObject({ resenia: null, puedeReseniar: true });

    const alta = await reseniar(app, "usuario-martin", DATOS);

    const despues = (await compraDeMartin()).body;
    expect(despues.resenia).toEqual(alta.body);
    expect(despues.puedeReseniar).toBe(false);
    expect(despues.estado).toBe(EstadoCompra.UTILIZADA);
    expect(despues.entradasUsadas).toBe(1);
    expect(await cupos()).toEqual(cuposAntes);
  });

  it("solo espacios → 201 sin comentario; sin comentario → 201 con null", async () => {
    const conEspacios = await reseniar(nuevaApp(), "usuario-martin", { puntuacion: 5, comentario: "    " });
    expect(conEspacios.status).toBe(201);
    expect(conEspacios.body.comentario).toBeNull();
    const sinComentario = await reseniar(nuevaApp(), "usuario-martin", { puntuacion: 5 });
    expect(sinComentario.status).toBe(201);
    expect(sinComentario.body.comentario).toBeNull();
  });

  it("un comentario de 500 caracteres con espacios alrededor → 201 recortado", async () => {
    const quinientos = "a".repeat(500);
    const respuesta = await reseniar(nuevaApp(), "usuario-martin", {
      puntuacion: 5,
      comentario: `  ${quinientos}  `,
    });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.comentario).toBe(quinientos);
  });

  describe("rechazos (en el orden de contracts/api.md)", () => {
    it.each([
      ["sin X-Usuario-Id", null],
      ["con un usuario inexistente", "usuario-nadie"],
    ])("401 USUARIO_NO_IDENTIFICADO %s", async (_caso, usuarioId) => {
      const respuesta = await reseniar(nuevaApp(), usuarioId, DATOS);
      expect(respuesta.status).toBe(401);
      expect(respuesta.body.error.codigo).toBe("USUARIO_NO_IDENTIFICADO");
    });

    it("400 sobre params.eventoId con un id inválido", async () => {
      const respuesta = await reseniar(
        nuevaApp(),
        "usuario-martin",
        DATOS,
        "/api/eventos/NO_VALIDO/resenias",
      );
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.codigo).toBe("ENTRADA_INVALIDA");
      expect(detallesDe(respuesta.body, "params.eventoId")).toHaveLength(1);
    });

    it.each([
      ["ausente", undefined, "Es obligatorio."],
      ["como texto", "4", "Debe ser un entero de 1 a 5."],
      ["no entera", 4.5, "Debe ser un entero de 1 a 5."],
      ["0", 0, "Debe ser un entero de 1 a 5."],
      ["6", 6, "Debe ser un entero de 1 a 5."],
    ])("400 sobre body.puntuacion %s", async (_caso, puntuacion, mensaje) => {
      const respuesta = await reseniar(nuevaApp(), "usuario-martin", { puntuacion, comentario: "Hola" });
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.codigo).toBe("ENTRADA_INVALIDA");
      expect(detallesDe(respuesta.body, "body.puntuacion")).toEqual([{ campo: "body.puntuacion", mensaje }]);
    });

    it.each([
      ["de 501 caracteres", "a".repeat(501)],
      ["numérico", 123],
    ])("400 sobre body.comentario %s", async (_caso, comentario) => {
      const respuesta = await reseniar(nuevaApp(), "usuario-martin", { puntuacion: 4, comentario });
      expect(respuesta.status).toBe(400);
      expect(detallesDe(respuesta.body, "body.comentario")).toEqual([
        { campo: "body.comentario", mensaje: "Debe tener como máximo 500 caracteres." },
      ]);
    });

    it("404 EVENTO_NO_ENCONTRADO con un evento inexistente", async () => {
      const respuesta = await reseniar(
        nuevaApp(),
        "usuario-martin",
        DATOS,
        "/api/eventos/evento-no-existe/resenias",
      );
      expect(respuesta.status).toBe(404);
      expect(respuesta.body.error.codigo).toBe("EVENTO_NO_ENCONTRADO");
    });

    it("409 RESENIA_PROPIO_EVENTO: Lucía organiza la Peña", async () => {
      const respuesta = await reseniar(nuevaApp(), "usuario-lucia", DATOS);
      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error).toEqual({
        codigo: "RESENIA_PROPIO_EVENTO",
        mensaje: "No podés reseñar un evento que organizás.",
      });
    });

    it("409 SIN_COMPRA_UTILIZADA: Sofía tiene una CONFIRMADA de la Peña", async () => {
      const respuesta = await reseniar(nuevaApp(), "usuario-sofia", DATOS);
      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error).toEqual({
        codigo: "SIN_COMPRA_UTILIZADA",
        mensaje: "Solo podés reseñar un evento al que asististe (con una compra utilizada).",
      });
    });

    it("409 RESENIA_REPETIDA: Martín reseña dos veces y queda la primera", async () => {
      const app = nuevaApp();
      const primera = await reseniar(app, "usuario-martin", DATOS);
      const segunda = await reseniar(app, "usuario-martin", { puntuacion: 1, comentario: "Otra" });
      expect(segunda.status).toBe(409);
      expect(segunda.body.error).toEqual({
        codigo: "RESENIA_REPETIDA",
        mensaje: "Ya reseñaste este evento.",
      });
      const compra = await request(app)
        .get("/api/compras/compra-martin-pena-general")
        .set("X-Usuario-Id", "usuario-martin");
      expect(compra.body.resenia).toEqual(primera.body);
    });

    it("combinaciones: sin usuario y puntuación inválida → 401; puntuación inválida y evento inexistente → 400", async () => {
      expect((await reseniar(nuevaApp(), null, { puntuacion: 9 })).status).toBe(401);
      const respuesta = await reseniar(
        nuevaApp(),
        "usuario-martin",
        { puntuacion: 9 },
        "/api/eventos/evento-no-existe/resenias",
      );
      expect(respuesta.status).toBe(400);
    });

    it.each(["put", "patch", "delete"] as const)(
      "%s sobre las reseñas → 404 RUTA_NO_ENCONTRADA (no se editan ni se borran)",
      async (metodo) => {
        const respuesta = await request(nuevaApp())[metodo](RUTA_PENA).set("X-Usuario-Id", "usuario-martin");
        expect(respuesta.status).toBe(404);
        expect(respuesta.body.error.codigo).toBe("RUTA_NO_ENCONTRADA");
      },
    );
  });
});

describe("GET /api/eventos/:eventoId/resenias-del-organizador (US2)", () => {
  const delOrganizador = (app: App, eventoId: string, usuarioId?: string) => {
    const pedido = request(app).get(`/api/eventos/${eventoId}/resenias-del-organizador`);
    if (usuarioId !== undefined) pedido.set("X-Usuario-Id", usuarioId);
    return pedido;
  };

  it("es público: 200 sin X-Usuario-Id y la misma respuesta con cualquier usuario", async () => {
    const app = nuevaApp();
    const sinUsuario = await delOrganizador(app, "evento-hamlet");
    expect(sinUsuario.status).toBe(200);
    for (const usuarioId of ["usuario-martin", "usuario-diego", "usuario-nadie"]) {
      expect((await delOrganizador(app, "evento-hamlet", usuarioId)).body).toEqual(sinUsuario.body);
    }
  });

  it("Hamlet (Martín): ≈ 4,7 con sus 11 reseñas (013), de la más reciente a la más vieja, sin id del autor", async () => {
    const { body } = await delOrganizador(nuevaApp(), "evento-hamlet");
    expect(body.organizador).toEqual({
      id: "usuario-martin",
      nombre: "Martín",
      apellido: "Benítez",
      puntaje: 52 / 11,
      cantidadResenias: 11,
    });
    // Las de Jazz (012) son las más viejas: después de las 8 de los realizados de la 013. La página
    // 1 trae 10 y la más vieja queda en la 2.
    expect(body.resenias).toHaveLength(10);
    expect(
      body.resenias.slice(-2).map((r: { id: string; puntuacion: number }) => [r.id, r.puntuacion]),
    ).toEqual([
      ["resenia-valentina-jazz-en-el-patio", 5],
      ["resenia-diego-jazz-en-el-patio", 4],
    ]);
    const deJazz = body.resenias.find((r: { id: string }) => r.id === "resenia-valentina-jazz-en-el-patio");
    expect(deJazz).toEqual({
      id: "resenia-valentina-jazz-en-el-patio",
      puntuacion: 5,
      comentario: expect.any(String),
      autor: { nombre: "Valentina", apellido: "Gómez" },
      evento: { id: "evento-jazz-en-el-patio", nombre: "Jazz en el Patio" },
      creadaEn: expect.any(String),
      creadaEnLocal: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    });
    const json = JSON.stringify(body);
    expect(json).not.toContain("compradorId");
    expect(json).not.toContain("usuario-valentina");
    expect(json).not.toMatch(/JZPT/);
  });

  it("Noche de Rock (Lucía): puntaje null, 0 reseñas y la lista vacía", async () => {
    const { status, body } = await delOrganizador(nuevaApp(), "evento-noche-de-rock");
    expect(status).toBe(200);
    expect(body).toEqual({
      organizador: {
        id: "usuario-lucia",
        nombre: "Lucía",
        apellido: "Álvarez",
        puntaje: null,
        cantidadResenias: 0,
      },
      resenias: [],
      pagina: { numero: 1, tamano: 10, totalElementos: 0, totalPaginas: 0 },
    });
  });

  it("el puntaje coincide con el del detalle y con el de la tarjeta del catálogo (FR-018)", async () => {
    const app = nuevaApp();
    const { body } = await delOrganizador(app, "evento-hamlet");
    const detalle = await request(app).get("/api/eventos/evento-hamlet");
    expect(detalle.body.organizador).toEqual(body.organizador);
    const catalogo = await request(app).get("/api/eventos");
    const tarjeta = catalogo.body.eventos.find((e: { id: string }) => e.id === "evento-hamlet");
    expect(tarjeta.organizador).toEqual(body.organizador);
  });

  it("400 sobre params.eventoId con un id inválido y 404 con uno inexistente", async () => {
    const invalido = await delOrganizador(nuevaApp(), "NO_VALIDO");
    expect(invalido.status).toBe(400);
    expect(detallesDe(invalido.body, "params.eventoId")).toHaveLength(1);
    const inexistente = await delOrganizador(nuevaApp(), "evento-no-existe");
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error.codigo).toBe("EVENTO_NO_ENCONTRADO");
  });

  it("después de que Martín reseña la Peña, los eventos de Lucía pasan a 4 con 1 reseña, primera", async () => {
    const app = nuevaApp();
    const alta = await reseniar(app, "usuario-martin", DATOS);
    const { body } = await delOrganizador(app, "evento-noche-de-rock");
    expect(body.organizador).toMatchObject({ puntaje: 4, cantidadResenias: 1 });
    expect(body.resenias).toEqual([
      {
        id: alta.body.id,
        puntuacion: 4,
        comentario: "Muy buena organización",
        autor: { nombre: "Martín", apellido: "Benítez" },
        evento: { id: PENA, nombre: "Peña en La Rueda" },
        creadaEn: AHORA.toISOString(),
        creadaEnLocal: "2026-11-10T12:00",
      },
    ]);
  });

  it("después de cada rechazo del alta, la respuesta no cambia", async () => {
    const app = nuevaApp();
    const antes = (await delOrganizador(app, "evento-noche-de-rock")).body;
    await reseniar(app, null, DATOS);
    await reseniar(app, "usuario-martin", { puntuacion: 6 });
    await reseniar(app, "usuario-martin", DATOS, "/api/eventos/evento-no-existe/resenias");
    await reseniar(app, "usuario-lucia", DATOS);
    await reseniar(app, "usuario-sofia", DATOS);
    expect((await delOrganizador(app, "evento-noche-de-rock")).body).toEqual(antes);
  });
});

describe("GET /api/eventos/:eventoId/resenias-del-organizador?pagina= (feature 013, US5)", () => {
  const RUTA = "/api/eventos/evento-jazz-en-el-patio/resenias-del-organizador";
  const pagina = (app: App, consulta = "", usuarioId?: string) => {
    const pedido = request(app).get(`${RUTA}${consulta}`);
    if (usuarioId !== undefined) pedido.set("X-Usuario-Id", usuarioId);
    return pedido;
  };
  const ids = (body: { resenias: { id: string }[] }) => body.resenias.map((r) => r.id);

  it("Martín (11): la página 1 trae 10 y la página con los totales de todas", async () => {
    const { status, body } = await pagina(nuevaApp());
    expect(status).toBe(200);
    expect(body.resenias).toHaveLength(10);
    expect(body.pagina).toEqual({ numero: 1, tamano: 10, totalElementos: 11, totalPaginas: 2 });
    expect(body.organizador.cantidadResenias).toBe(body.pagina.totalElementos);
    expect(Object.keys(body).sort()).toEqual(["organizador", "pagina", "resenias"]);
  });

  it("?pagina=2 trae la más vieja; concatenadas, el orden de la 012 sin repetir (SC-002)", async () => {
    const app = nuevaApp();
    const primera = (await pagina(app)).body;
    const segunda = (await pagina(app, "?pagina=2")).body;
    expect(ids(segunda)).toEqual(["resenia-lucia-jazz-en-el-patio"]);
    expect(segunda.pagina).toEqual({ numero: 2, tamano: 10, totalElementos: 11, totalPaginas: 2 });
    const todas = [...primera.resenias, ...segunda.resenias];
    expect(new Set(ids({ resenias: todas })).size).toBe(11);
    const fechas = todas.map((r: { creadaEn: string }) => r.creadaEn);
    expect(fechas).toEqual([...fechas].sort().reverse());
  });

  it("?pagina=9 devuelve la última con su número real", async () => {
    const { status, body } = await pagina(nuevaApp(), "?pagina=9");
    expect(status).toBe(200);
    expect(body.pagina.numero).toBe(2);
    expect(ids(body)).toEqual(["resenia-lucia-jazz-en-el-patio"]);
  });

  it("el organizador es igual en las dos páginas, en el resumen y en el detalle (SC-005)", async () => {
    const app = nuevaApp();
    const primera = (await pagina(app)).body;
    const segunda = (await pagina(app, "?pagina=2")).body;
    const resumen = (await request(app).get(`${RUTA}/resumen`)).body;
    const detalle = (await request(app).get("/api/eventos/evento-jazz-en-el-patio")).body;
    expect(segunda.organizador).toEqual(primera.organizador);
    expect(resumen.organizador).toEqual(primera.organizador);
    expect(detalle.organizador).toEqual(primera.organizador);
  });

  it.each(["0", "-1", "1.5", "abc", ""])("?pagina=%s → 400 sobre query.pagina", async (valor) => {
    const { status, body } = await pagina(nuevaApp(), `?pagina=${valor}`);
    expect(status).toBe(400);
    expect(body.error.codigo).toBe("ENTRADA_INVALIDA");
    expect(detallesDe(body, "query.pagina")).toEqual([
      { campo: "query.pagina", mensaje: "Debe ser un entero mayor o igual a 1." },
    ]);
  });

  it("un tamaño en la consulta se ignora: siguen siendo 10", async () => {
    const { body } = await pagina(nuevaApp(), "?tamano=50&limite=50");
    expect(body.resenias).toHaveLength(10);
    expect(body.pagina.tamano).toBe(10);
  });

  it("sin reseñas (Lucía): la lista vacía, numero 1 y 0 páginas", async () => {
    const { body } = await request(nuevaApp()).get(
      "/api/eventos/evento-noche-de-rock/resenias-del-organizador?pagina=4",
    );
    expect(body.resenias).toEqual([]);
    expect(body.pagina).toEqual({ numero: 1, tamano: 10, totalElementos: 0, totalPaginas: 0 });
  });

  it("es público: la misma página sin X-Usuario-Id y con cualquier usuario", async () => {
    const app = nuevaApp();
    const sinUsuario = (await pagina(app, "?pagina=2")).body;
    for (const usuarioId of ["usuario-martin", "usuario-diego", "usuario-nadie"]) {
      expect((await pagina(app, "?pagina=2", usuarioId)).body).toEqual(sinUsuario);
    }
  });

  it("404 EVENTO_NO_ENCONTRADO con un evento inexistente, también con página", async () => {
    const { status, body } = await request(nuevaApp()).get(
      "/api/eventos/evento-no-existe/resenias-del-organizador?pagina=2",
    );
    expect(status).toBe(404);
    expect(body.error.codigo).toBe("EVENTO_NO_ENCONTRADO");
  });

  it("sin el id del autor en ninguna página", async () => {
    const app = nuevaApp();
    for (const consulta of ["", "?pagina=2"]) {
      const json = JSON.stringify((await pagina(app, consulta)).body);
      expect(json).not.toContain("compradorId");
      expect(json).not.toMatch(/usuario-(lucia|diego|sofia|valentina)/);
    }
  });
});

describe("GET /api/eventos/:eventoId/resenias-del-organizador/resumen (feature 013, US4)", () => {
  const RUTA = (eventoId: string) => `/api/eventos/${eventoId}/resenias-del-organizador/resumen`;
  const resumen = (app: App, eventoId: string, usuarioId?: string) => {
    const pedido = request(app).get(RUTA(eventoId));
    if (usuarioId !== undefined) pedido.set("X-Usuario-Id", usuarioId);
    return pedido;
  };

  it("con más de 3 (Martín, 11): las 3 más recientes y el organizador con el puntaje y la cantidad de todas", async () => {
    const { status, body } = await resumen(nuevaApp(), "evento-jazz-en-el-patio");
    expect(status).toBe(200);
    expect(body.organizador).toEqual({
      id: "usuario-martin",
      nombre: "Martín",
      apellido: "Benítez",
      puntaje: 52 / 11,
      cantidadResenias: 11,
    });
    // Las del Tango (los realizados de la 013 son los más recientes).
    expect(body.resenias.map((r: { id: string }) => r.id)).toEqual([
      "resenia-valentina-tango-en-la-terraza",
      "resenia-diego-tango-en-la-terraza",
      "resenia-sofia-tango-en-la-terraza",
    ]);
    expect(Object.keys(body).sort()).toEqual(["organizador", "resenias"]);
  });

  it("son las 3 primeras de la colección, con el mismo organizador", async () => {
    const app = nuevaApp();
    const { body } = await resumen(app, "evento-hamlet");
    const coleccion = await request(app).get("/api/eventos/evento-hamlet/resenias-del-organizador");
    expect(body.resenias).toEqual(coleccion.body.resenias.slice(0, 3));
    expect(body.organizador).toEqual(coleccion.body.organizador);
  });

  it("el organizador es igual al del detalle y al de la tarjeta del catálogo (SC-005)", async () => {
    const app = nuevaApp();
    const { body } = await resumen(app, "evento-hamlet");
    expect((await request(app).get("/api/eventos/evento-hamlet")).body.organizador).toEqual(body.organizador);
    const catalogo = await request(app).get("/api/eventos?texto=hamlet");
    const tarjeta = catalogo.body.eventos.find((e: { id: string }) => e.id === "evento-hamlet");
    expect(tarjeta.organizador).toEqual(body.organizador);
  });

  it("con 3 o menos (Sofía, 2): todas, igual que la colección", async () => {
    const app = nuevaApp();
    const { body } = await resumen(app, "evento-noche-de-risas");
    expect(body.resenias).toHaveLength(2);
    expect(body.organizador).toMatchObject({ puntaje: 2.5, cantidadResenias: 2 });
    const coleccion = await request(app).get("/api/eventos/evento-noche-de-risas/resenias-del-organizador");
    expect(body.resenias).toEqual(coleccion.body.resenias);
    expect(body.organizador).toEqual(coleccion.body.organizador);
  });

  it("sin reseñas: la lista vacía, puntaje null y cantidad 0", async () => {
    const { status, body } = await resumen(nuevaApp(), "evento-noche-de-rock");
    expect(status).toBe(200);
    expect(body).toEqual({
      organizador: {
        id: "usuario-lucia",
        nombre: "Lucía",
        apellido: "Álvarez",
        puntaje: null,
        cantidadResenias: 0,
      },
      resenias: [],
    });
  });

  it("es público: 200 sin X-Usuario-Id y la misma respuesta con cualquier usuario", async () => {
    const app = nuevaApp();
    const sinUsuario = await resumen(app, "evento-hamlet");
    expect(sinUsuario.status).toBe(200);
    for (const usuarioId of ["usuario-martin", "usuario-diego", "usuario-nadie"]) {
      expect((await resumen(app, "evento-hamlet", usuarioId)).body).toEqual(sinUsuario.body);
    }
  });

  it("400 sobre params.eventoId con un id inválido y 404 con uno inexistente", async () => {
    const invalido = await resumen(nuevaApp(), "NO_VALIDO");
    expect(invalido.status).toBe(400);
    expect(detallesDe(invalido.body, "params.eventoId")).toHaveLength(1);
    const inexistente = await resumen(nuevaApp(), "evento-no-existe");
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error.codigo).toBe("EVENTO_NO_ENCONTRADO");
  });

  it("sin el id del autor, compras ni códigos", async () => {
    const json = JSON.stringify((await resumen(nuevaApp(), "evento-hamlet")).body);
    expect(json).not.toContain("compradorId");
    expect(json).not.toContain("usuario-valentina");
    expect(json).not.toContain("usuario-sofia");
    expect(json).not.toMatch(/compra-|JZPT/);
  });

  it("después de reseñar, la nueva aparece primera y la cantidad suma una (US4-4)", async () => {
    const app = nuevaApp();
    const alta = await reseniar(app, "usuario-martin", DATOS);
    const { body } = await resumen(app, "evento-noche-de-rock");
    expect(body.organizador).toMatchObject({ puntaje: 4, cantidadResenias: 1 });
    expect(body.resenias.map((r: { id: string }) => r.id)).toEqual([alta.body.id]);
  });
});
