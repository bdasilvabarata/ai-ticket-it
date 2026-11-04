import { Types } from "mongoose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { crearApp } from "../../src/app";
import { EventoModel } from "../../src/repositories/models/evento.model";
import { usarBaseDePrueba } from "./helpers/base-de-prueba";

usarBaseDePrueba();

const app = crearApp({ almacenamiento: "memoria" });
const LUCIA = "000000000000000000000101";
const DIEGO = "000000000000000000000104";
const INEXISTENTE = "0000000000000000000009ff";

function esperarErrorApi(cuerpo: unknown, codigo: string): void {
  expect(cuerpo).toMatchObject({ error: { codigo, mensaje: expect.any(String) } });
  const { error } = cuerpo as { error: { codigo: string; mensaje: string } };
  expect(error.codigo.length).toBeGreaterThan(0);
  expect(error.mensaje.length).toBeGreaterThan(0);
}

describe("GET /api/usuarios", () => {
  it("lista los 5 usuarios ordenados por apellido con su cantidad de eventos", async () => {
    const respuesta = await request(app).get("/api/usuarios");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.map((u: { apellido: string }) => u.apellido)).toEqual([
      "Álvarez",
      "Benítez",
      "Castro",
      "Fernández",
      "Gómez",
    ]);
    expect(
      respuesta.body.map((u: { cantidadEventosOrganizados: number }) => u.cantidadEventosOrganizados),
    ).toEqual([3, 3, 2, 0, 0]);
    for (const usuario of respuesta.body) {
      expect(Object.keys(usuario).sort()).toEqual(
        ["apellido", "cantidadEventosOrganizados", "id", "nombre"],
      );
      expect(typeof usuario.id).toBe("string");
    }
  });

  it("cuenta también los eventos pasados", async () => {
    await EventoModel.create({
      nombre: "Evento viejo",
      descripcion: "Ya pasó",
      categoria: new Types.ObjectId("000000000000000000000201"),
      fechaHora: new Date("2020-01-01T00:00:00Z"),
      organizador: new Types.ObjectId(DIEGO),
      tiposEntrada: [{ nombre: "General", precio: 100, cupo: 10 }],
    });
    const respuesta = await request(app).get("/api/usuarios");
    const diego = respuesta.body.find((u: { id: string }) => u.id === DIEGO);
    expect(diego.cantidadEventosOrganizados).toBe(1);
  });

  it("es público: ignora un X-Usuario-Id inválido", async () => {
    const respuesta = await request(app).get("/api/usuarios").set("X-Usuario-Id", "abc");
    expect(respuesta.status).toBe(200);
  });
});

describe("GET /api/usuarios/:id", () => {
  it("devuelve el usuario", async () => {
    const respuesta = await request(app).get(`/api/usuarios/${LUCIA}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      id: LUCIA,
      nombre: "Lucía",
      apellido: "Álvarez",
      cantidadEventosOrganizados: 3,
    });
  });

  it("responde 404 si no existe", async () => {
    const respuesta = await request(app).get(`/api/usuarios/${INEXISTENTE}`);
    expect(respuesta.status).toBe(404);
    esperarErrorApi(respuesta.body, "USUARIO_NO_ENCONTRADO");
  });

  it("responde 400 si el id está mal formado", async () => {
    const respuesta = await request(app).get("/api/usuarios/123");
    expect(respuesta.status).toBe(400);
    esperarErrorApi(respuesta.body, "ENTRADA_INVALIDA");
    expect(respuesta.body.error.detalles).toEqual([
      { campo: "params.id", mensaje: expect.any(String) },
    ]);
  });
});

describe("GET /api/usuarios/actual", () => {
  it("devuelve el usuario del encabezado", async () => {
    const respuesta = await request(app).get("/api/usuarios/actual").set("X-Usuario-Id", LUCIA);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ id: LUCIA, nombre: "Lucía", apellido: "Álvarez" });
  });

  it.each<[string, string | undefined]>([
    ["sin encabezado", undefined],
    ["con encabezado vacío", ""],
    ["con un id mal formado", "abc"],
    ["con un usuario inexistente", INEXISTENTE],
  ])("responde 401 %s", async (_caso, encabezado) => {
    const pedido = request(app).get("/api/usuarios/actual");
    if (encabezado !== undefined) pedido.set("X-Usuario-Id", encabezado);
    const respuesta = await pedido;
    expect(respuesta.status).toBe(401);
    esperarErrorApi(respuesta.body, "USUARIO_NO_IDENTIFICADO");
  });
});
