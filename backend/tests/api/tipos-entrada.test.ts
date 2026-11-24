import request from "supertest";
import { describe, expect, it } from "vitest";
import { crearApp } from "../../src/app";
import { relojFijo } from "../helpers/eventos";

const reloj = relojFijo(new Date("2026-11-10T15:00:00.000Z"));
const nuevaApp = () => crearApp({ reloj });
type App = ReturnType<typeof nuevaApp>;

const LUCIA = "usuario-lucia";
const SOFIA = "usuario-sofia";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const ROCK = "/api/eventos/evento-noche-de-rock";
const FESTIVAL = "/api/eventos/evento-festival-sonidos-del-sur";
const tiposDe = (evento: string) => `${evento}/tipos-entrada`;
const platea = { nombre: "Platea", descripcion: "Butacas numeradas.", precio: 0, cupo: 100 };

function esperarError(respuesta: request.Response, status: number, codigo: string): void {
  expect(respuesta.status).toBe(status);
  expect(respuesta.body).toMatchObject({ error: { codigo, mensaje: expect.any(String) } });
}

function detalles(respuesta: request.Response): Record<string, string> {
  expect(respuesta.status).toBe(400);
  return Object.fromEntries(
    (respuesta.body.error.detalles as { campo: string; mensaje: string }[]).map((d) => [d.campo, d.mensaje]),
  );
}

const agregar = (app: App, evento: string, cuerpo: object, usuarioId = LUCIA) =>
  request(app).post(tiposDe(evento)).set("X-Usuario-Id", usuarioId).send(cuerpo);
const editar = (app: App, evento: string, tipoId: string, cuerpo: object, usuarioId = LUCIA) =>
  request(app)
    .put(`${tiposDe(evento)}/${tipoId}`)
    .set("X-Usuario-Id", usuarioId)
    .send(cuerpo);
const quitar = (app: App, evento: string, tipoId: string, usuarioId = LUCIA) =>
  request(app)
    .delete(`${tiposDe(evento)}/${tipoId}`)
    .set("X-Usuario-Id", usuarioId);

async function nombresDeTipos(app: App, evento: string): Promise<string[]> {
  return (await request(app).get(evento)).body.tiposEntrada.map((t: { nombre: string }) => t.nombre);
}

describe("POST /api/eventos/:eventoId/tipos-entrada", () => {
  it("responde 201 con el tipo nuevo, que queda al final", async () => {
    const app = nuevaApp();
    const respuesta = await agregar(app, ROCK, platea);
    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({ id: expect.stringMatching(UUID), ...platea });
    expect(await nombresDeTipos(app, ROCK)).toEqual(["General", "Platea"]);
  });

  it("responde 401, 400 (cupo 0 y id mal formado), 403, 404, 409 realizado y nombre repetido", async () => {
    const app = nuevaApp();
    esperarError(await request(app).post(tiposDe(ROCK)).send(platea), 401, "USUARIO_NO_IDENTIFICADO");
    expect(detalles(await agregar(app, ROCK, { ...platea, cupo: 0 }))).toEqual({
      "body.cupo": "Debe ser un entero mayor o igual a 1.",
    });
    expect(detalles(await agregar(app, "/api/eventos/123", platea))).toEqual({
      "params.eventoId": "Debe ser un identificador válido.",
    });
    esperarError(await agregar(app, "/api/eventos/evento-hamlet", platea), 403, "SIN_PERMISO");
    esperarError(await agregar(app, "/api/eventos/evento-x", platea), 404, "EVENTO_NO_ENCONTRADO");
    esperarError(
      await agregar(app, "/api/eventos/evento-noche-de-risas", platea, SOFIA),
      409,
      "EVENTO_REALIZADO",
    );
    esperarError(
      await agregar(app, ROCK, { ...platea, nombre: " GENERAL " }),
      409,
      "NOMBRE_TIPO_ENTRADA_REPETIDO",
    );
    expect(await nombresDeTipos(app, ROCK)).toEqual(["General"]);
  });
});

describe("PUT /api/eventos/:eventoId/tipos-entrada/:tipoEntradaId", () => {
  it("responde 200 con el tipo editado; acepta cupo disponible 0 y conservar el propio nombre", async () => {
    const app = nuevaApp();
    const respuesta = await editar(app, FESTIVAL, "tipo-festival-sonidos-del-sur-vip", {
      nombre: "vip",
      precio: 130000,
      cupo: 0,
    });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      id: "tipo-festival-sonidos-del-sur-vip",
      nombre: "vip",
      descripcion: "",
      precio: 130000,
      cupo: 0,
    });
  });

  it("responde 401, 400 (cupo −1 e ids mal formados), 403, 404 de evento y de tipo, 409 realizado y nombre repetido", async () => {
    const app = nuevaApp();
    const tipo = "tipo-noche-de-rock-general";
    esperarError(
      await request(app)
        .put(`${tiposDe(ROCK)}/${tipo}`)
        .send(platea),
      401,
      "USUARIO_NO_IDENTIFICADO",
    );
    expect(detalles(await editar(app, ROCK, tipo, { ...platea, cupo: -1 }))).toEqual({
      "body.cupo": "Debe ser un entero mayor o igual a 0.",
    });
    expect(detalles(await editar(app, ROCK, "Tipo 1", platea))).toEqual({
      "params.tipoEntradaId": "Debe ser un identificador válido.",
    });
    esperarError(
      await editar(app, "/api/eventos/evento-hamlet", "tipo-hamlet-platea", platea),
      403,
      "SIN_PERMISO",
    );
    esperarError(await editar(app, "/api/eventos/evento-x", tipo, platea), 404, "EVENTO_NO_ENCONTRADO");
    // Un tipo que existe, pero en otro evento (FR-023).
    esperarError(await editar(app, ROCK, "tipo-hamlet-platea", platea), 404, "TIPO_ENTRADA_NO_ENCONTRADO");
    esperarError(
      await editar(app, "/api/eventos/evento-noche-de-risas", "tipo-noche-de-risas-general", platea, SOFIA),
      409,
      "EVENTO_REALIZADO",
    );
    esperarError(
      await editar(app, FESTIVAL, "tipo-festival-sonidos-del-sur-vip", { ...platea, nombre: "Backstage" }),
      409,
      "NOMBRE_TIPO_ENTRADA_REPETIDO",
    );
    expect(await nombresDeTipos(app, FESTIVAL)).toEqual(["General", "VIP", "Backstage"]);
  });
});

describe("DELETE /api/eventos/:eventoId/tipos-entrada/:tipoEntradaId", () => {
  it("responde 204 al quitar Backstage del Festival (sin compras)", async () => {
    const app = nuevaApp();
    const respuesta = await quitar(app, FESTIVAL, "tipo-festival-sonidos-del-sur-backstage");
    expect(respuesta.status).toBe(204);
    expect(await nombresDeTipos(app, FESTIVAL)).toEqual(["General", "VIP"]);
  });

  it("responde 401, 403, 404, 409 realizado, último tipo y con compras (también cancelada)", async () => {
    const app = nuevaApp();
    esperarError(
      await request(app).delete(`${tiposDe(ROCK)}/tipo-noche-de-rock-general`),
      401,
      "USUARIO_NO_IDENTIFICADO",
    );
    esperarError(await quitar(app, "/api/eventos/evento-hamlet", "tipo-hamlet-platea"), 403, "SIN_PERMISO");
    esperarError(await quitar(app, ROCK, "tipo-hamlet-platea"), 404, "TIPO_ENTRADA_NO_ENCONTRADO");
    esperarError(
      await quitar(app, "/api/eventos/evento-noche-de-risas", "tipo-noche-de-risas-general", SOFIA),
      409,
      "EVENTO_REALIZADO",
    );
    esperarError(await quitar(app, ROCK, "tipo-noche-de-rock-general"), 409, "ULTIMO_TIPO_ENTRADA");
    // General del Festival solo tiene una compra CANCELADA: igual cuenta.
    esperarError(
      await quitar(app, FESTIVAL, "tipo-festival-sonidos-del-sur-general"),
      409,
      "TIPO_ENTRADA_CON_COMPRAS",
    );
    expect(await nombresDeTipos(app, FESTIVAL)).toEqual(["General", "VIP", "Backstage"]);
  });
});
