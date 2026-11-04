import request from "supertest";
import { describe, expect, it } from "vitest";
import { crearApp } from "../../src/app";
import { usarBaseDePrueba } from "./helpers/base-de-prueba";

usarBaseDePrueba();

describe("GET /api/salud", () => {
  it("responde ok con almacenamiento en memoria", async () => {
    const respuesta = await request(crearApp({ almacenamiento: "memoria" })).get("/api/salud");
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers["content-type"]).toMatch(/application\/json/);
    expect(respuesta.body).toEqual({ estado: "ok", almacenamiento: "memoria" });
  });

  it("informa almacenamiento externo", async () => {
    const respuesta = await request(crearApp({ almacenamiento: "externo" })).get("/api/salud");
    expect(respuesta.body).toEqual({ estado: "ok", almacenamiento: "externo" });
  });

  it("es público: ignora un X-Usuario-Id inválido", async () => {
    const respuesta = await request(crearApp({ almacenamiento: "memoria" }))
      .get("/api/salud")
      .set("X-Usuario-Id", "abc");
    expect(respuesta.status).toBe(200);
  });

  it("no anuncia el framework", async () => {
    const respuesta = await request(crearApp({ almacenamiento: "memoria" })).get("/api/salud");
    expect(respuesta.headers).not.toHaveProperty("x-powered-by");
  });
});
