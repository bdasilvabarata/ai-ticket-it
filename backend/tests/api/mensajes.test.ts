import { EstadoCompra } from "@ai-ticket-it/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { crearApp } from "../../src/app";
import { relojFijo } from "../helpers/eventos";

// Chat de la compra (feature 011, contracts/api.md) contra los datos de ejemplo.

const AHORA = new Date("2026-11-10T15:00:00.000Z");
const nuevaApp = () => crearApp({ reloj: relojFijo(AHORA) });
type App = ReturnType<typeof nuevaApp>;

const COMPRA_VIP = "compra-martin-festival-vip";
const FESTIVAL = "/api/eventos/evento-festival-sonidos-del-sur";
const CODIGOS_VIP = ["FSVP7M01", "FSVP7M02"];

const chat = (app: App, usuarioId: string, compraId = COMPRA_VIP) =>
  request(app).get(`/api/compras/${compraId}/mensajes`).set("X-Usuario-Id", usuarioId);
const enviar = (app: App, usuarioId: string, cuerpo: object, compraId = COMPRA_VIP) =>
  request(app).post(`/api/compras/${compraId}/mensajes`).set("X-Usuario-Id", usuarioId).send(cuerpo);

const martin = { id: "usuario-martin", nombre: "Martín", apellido: "Benítez", rol: "comprador" };
const lucia = { id: "usuario-lucia", nombre: "Lucía", apellido: "Álvarez", rol: "organizador" };

describe("GET /api/compras/:compraId/mensajes (US1)", () => {
  it("Martín ve la conversación del seed, con Lucía como la otra parte", async () => {
    const respuesta = await chat(nuevaApp(), "usuario-martin");

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.compra).toEqual({
      id: COMPRA_VIP,
      evento: { id: "evento-festival-sonidos-del-sur", nombre: "Festival Sonidos del Sur" },
      tipoEntrada: { id: "tipo-festival-sonidos-del-sur-vip", nombre: "VIP" },
      cantidad: 2,
      estado: EstadoCompra.CONFIRMADA,
    });
    expect(respuesta.body.otraParte).toEqual(lucia);
    expect(
      (respuesta.body.mensajes as { numero: number; autor: { id: string }; texto: string }[]).map((m) => [
        m.numero,
        m.autor.id,
        m.texto,
      ]),
    ).toEqual([
      [1, "usuario-martin", "Hola, ¿la entrada VIP incluye estacionamiento?"],
      [
        2,
        "usuario-lucia",
        "¡Hola, Martín! Sí: con la entrada VIP tenés lugar en el estacionamiento del predio. Mostrá tu código en la barrera.",
      ],
      [3, "usuario-martin", "¡Genial, gracias!"],
    ]);
    expect(respuesta.body.mensajes[1].autor).toEqual(lucia);
    for (const codigo of CODIGOS_VIP) expect(JSON.stringify(respuesta.body)).not.toContain(codigo);
  });
});

describe("POST /api/compras/:compraId/mensajes (US1)", () => {
  it("Martín envía un mensaje: 201 recortado y fechado por el servidor; el GET lo trae último", async () => {
    const app = nuevaApp();

    const respuesta = await enviar(app, "usuario-martin", { texto: "  ¿A qué hora abren las puertas?  " });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({
      numero: 4,
      autor: martin,
      texto: "¿A qué hora abren las puertas?",
      enviadoEn: AHORA.toISOString(),
      enviadoEnLocal: "2026-11-10T12:00",
    });
    for (const codigo of CODIGOS_VIP) expect(JSON.stringify(respuesta.body)).not.toContain(codigo);
    const { body } = await chat(app, "usuario-martin");
    expect(body.mensajes).toHaveLength(4);
    expect(body.mensajes.at(-1)).toEqual(respuesta.body);
  });

  it("ignora las claves extra: el autor es el de X-Usuario-Id y la fecha, la del reloj", async () => {
    const respuesta = await enviar(nuevaApp(), "usuario-martin", {
      texto: "Hola",
      autorId: "usuario-lucia",
      enviadoEn: "2020-01-01T00:00:00.000Z",
      numero: 99,
    });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject({ numero: 4, autor: martin, enviadoEn: AHORA.toISOString() });
  });

  it("no cambia el cupo del evento ni la compra", async () => {
    const app = nuevaApp();
    const antesEvento = (await request(app).get(FESTIVAL)).body.tiposEntrada;
    const antesCompra = (
      await request(app).get(`/api/compras/${COMPRA_VIP}`).set("X-Usuario-Id", "usuario-martin")
    ).body;

    expect((await enviar(app, "usuario-martin", { texto: "Hola" })).status).toBe(201);

    expect((await request(app).get(FESTIVAL)).body.tiposEntrada).toEqual(antesEvento);
    const despues = (
      await request(app).get(`/api/compras/${COMPRA_VIP}`).set("X-Usuario-Id", "usuario-martin")
    ).body;
    expect(despues).toEqual(antesCompra);
  });

  it("en la compra cancelada de Diego del Maratón → 201 y sigue CANCELADA", async () => {
    const app = nuevaApp();
    const compraId = "compra-diego-maraton-inscripcion";

    const respuesta = await enviar(
      app,
      "usuario-diego",
      { texto: "¿Cuándo me devuelven la plata?" },
      compraId,
    );

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject({ numero: 1, autor: { id: "usuario-diego", rol: "comprador" } });
    const { body } = await request(app).get(`/api/compras/${compraId}`).set("X-Usuario-Id", "usuario-diego");
    expect(body.estado).toBe(EstadoCompra.CANCELADA);
  });
});

describe("Chat de la compra: el organizador (US2)", () => {
  it("Lucía ve la conversación con Martín como la otra parte", async () => {
    const respuesta = await chat(nuevaApp(), "usuario-lucia");

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.otraParte).toEqual(martin);
    expect((respuesta.body.mensajes as { autor: { rol: string } }[]).map((m) => m.autor.rol)).toEqual([
      "comprador",
      "organizador",
      "comprador",
    ]);
  });

  it("Lucía responde y Martín lo ve en su GET como de la organizadora", async () => {
    const app = nuevaApp();

    const respuesta = await enviar(app, "usuario-lucia", { texto: "Las puertas abren a las 18." });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject({ numero: 4, autor: lucia, texto: "Las puertas abren a las 18." });
    const { body } = await chat(app, "usuario-martin");
    expect(body.mensajes.at(-1)).toEqual(respuesta.body);
  });
});

describe("Chat de la compra: nadie más lee ni escribe (US3)", () => {
  const MENSAJE_403 =
    "Solo el comprador y el organizador del evento pueden ver y escribir en el chat de esta compra.";
  const sinUsuario = {
    GET: (app: App) => request(app).get(`/api/compras/${COMPRA_VIP}/mensajes`),
    POST: (app: App) => request(app).post(`/api/compras/${COMPRA_VIP}/mensajes`).send({ texto: "Hola" }),
  };
  const comoUsuario = {
    GET: (app: App, usuarioId: string, compraId?: string) => chat(app, usuarioId, compraId),
    POST: (app: App, usuarioId: string, compraId?: string) =>
      enviar(app, usuarioId, { texto: "Hola" }, compraId),
  };

  function esperarError(respuesta: request.Response, status: number, codigo: string, mensaje?: string): void {
    expect(respuesta.status).toBe(status);
    expect(respuesta.body.error.codigo).toBe(codigo);
    if (mensaje !== undefined) expect(respuesta.body.error.mensaje).toBe(mensaje);
  }

  /** La conversación del seed sigue con sus tres mensajes. */
  async function sinCambios(app: App): Promise<void> {
    const { body } = await chat(app, "usuario-martin");
    expect(body.mensajes).toHaveLength(3);
  }

  describe.each(["GET", "POST"] as const)("%s", (metodo) => {
    it("sin X-Usuario-Id o con un usuario inexistente → 401 USUARIO_NO_IDENTIFICADO", async () => {
      const app = nuevaApp();
      esperarError(await sinUsuario[metodo](app), 401, "USUARIO_NO_IDENTIFICADO");
      esperarError(await comoUsuario[metodo](app, "usuario-nadie"), 401, "USUARIO_NO_IDENTIFICADO");
      await sinCambios(app);
    });

    it("compraId con formato inválido → 400 ENTRADA_INVALIDA en params.compraId", async () => {
      const app = nuevaApp();
      const respuesta = await comoUsuario[metodo](app, "usuario-martin", "Compra%201");
      esperarError(respuesta, 400, "ENTRADA_INVALIDA");
      expect(respuesta.body.error.detalles).toEqual([
        { campo: "params.compraId", mensaje: "Debe ser un identificador válido." },
      ]);
      await sinCambios(app);
    });

    it("compra inexistente → 404 COMPRA_NO_ENCONTRADA", async () => {
      const app = nuevaApp();
      esperarError(
        await comoUsuario[metodo](app, "usuario-martin", "compra-no-existe"),
        404,
        "COMPRA_NO_ENCONTRADA",
        "No existe la compra.",
      );
      await sinCambios(app);
    });

    it("Sofía, que no es parte → 403 SIN_PERMISO", async () => {
      const app = nuevaApp();
      esperarError(await comoUsuario[metodo](app, "usuario-sofia"), 403, "SIN_PERMISO", MENSAJE_403);
      await sinCambios(app);
    });

    it("una compra inexistente pedida por Sofía → 404 (el 404 va antes del 403)", async () => {
      const app = nuevaApp();
      esperarError(
        await comoUsuario[metodo](app, "usuario-sofia", "compra-no-existe"),
        404,
        "COMPRA_NO_ENCONTRADA",
      );
    });
  });

  describe("el texto del POST", () => {
    it.each([
      ["faltante", {}],
      ["null", { texto: null }],
      ["un número", { texto: 42 }],
      ["vacío", { texto: "" }],
      ["solo espacios y saltos de línea", { texto: "   \n " }],
    ])("%s → 400 en body.texto con «Es obligatorio.»", async (_caso, cuerpo) => {
      const app = nuevaApp();
      const respuesta = await enviar(app, "usuario-martin", cuerpo);
      esperarError(respuesta, 400, "ENTRADA_INVALIDA");
      expect(respuesta.body.error.detalles).toEqual([{ campo: "body.texto", mensaje: "Es obligatorio." }]);
      await sinCambios(app);
    });

    it("500 caracteres, con espacios alrededor que se recortan → 201", async () => {
      const texto = "a".repeat(500);
      const respuesta = await enviar(nuevaApp(), "usuario-martin", { texto: `  ${texto}\n` });
      expect(respuesta.status).toBe(201);
      expect(respuesta.body.texto).toBe(texto);
    });

    it("501 caracteres → 400 «Debe tener como máximo 500 caracteres.»", async () => {
      const app = nuevaApp();
      const respuesta = await enviar(app, "usuario-martin", { texto: "a".repeat(501) });
      esperarError(respuesta, 400, "ENTRADA_INVALIDA");
      expect(respuesta.body.error.detalles).toEqual([
        { campo: "body.texto", mensaje: "Debe tener como máximo 500 caracteres." },
      ]);
      await sinCambios(app);
    });
  });

  it("combinaciones: sin usuario + texto vacío → 401; texto vacío + compra inexistente → 400; inexistente como Sofía → 404", async () => {
    const app = nuevaApp();
    esperarError(
      await request(app).post(`/api/compras/${COMPRA_VIP}/mensajes`).send({ texto: "" }),
      401,
      "USUARIO_NO_IDENTIFICADO",
    );
    esperarError(
      await enviar(app, "usuario-martin", { texto: "" }, "compra-no-existe"),
      400,
      "ENTRADA_INVALIDA",
    );
    esperarError(
      await enviar(app, "usuario-sofia", { texto: "Hola" }, "compra-no-existe"),
      404,
      "COMPRA_NO_ENCONTRADA",
    );
    await sinCambios(app);
  });

  it.each([
    ["put", `/api/compras/${COMPRA_VIP}/mensajes`],
    ["patch", `/api/compras/${COMPRA_VIP}/mensajes`],
    ["delete", `/api/compras/${COMPRA_VIP}/mensajes`],
    ["delete", `/api/compras/${COMPRA_VIP}/mensajes/1`],
  ] as const)(
    "los mensajes no se editan ni se borran (FR-004): %s %s → 404 RUTA_NO_ENCONTRADA",
    async (metodo, ruta) => {
      const app = nuevaApp();
      const agente = request(app);
      const respuesta = await agente[metodo](ruta)
        .set("X-Usuario-Id", "usuario-martin")
        .send({ texto: "Otro" });
      esperarError(respuesta, 404, "RUTA_NO_ENCONTRADA");
      await sinCambios(app);
    },
  );
});
