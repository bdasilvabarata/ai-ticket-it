import request from "supertest";
import { describe, expect, it } from "vitest";
import { crearApp } from "../../src/app";

const app = crearApp();

describe("GET /api/salud", () => {
  it("responde que está operativo", async () => {
    const respuesta = await request(app).get("/api/salud");
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers["content-type"]).toMatch(/application\/json/);
    expect(respuesta.body).toEqual({ estado: "ok" });
  });

  it("es público: ignora un X-Usuario-Id inválido", async () => {
    const respuesta = await request(app).get("/api/salud").set("X-Usuario-Id", "abc");
    expect(respuesta.status).toBe(200);
  });

  it("no anuncia el framework", async () => {
    const respuesta = await request(app).get("/api/salud");
    expect(respuesta.headers).not.toHaveProperty("x-powered-by");
  });
});
