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
