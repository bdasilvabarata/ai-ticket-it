import request from "supertest";
import { describe, expect, it } from "vitest";
import { crearApp } from "../../src/app";

describe("GET /api/categorias", () => {
  it("es público y devuelve las 6 categorías ordenadas por nombre", async () => {
    const respuesta = await request(crearApp()).get("/api/categorias");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.map((c: { nombre: string }) => c.nombre)).toEqual([
      "Conferencias",
      "Deportes",
      "Festivales",
      "Música",
      "Stand-up",
      "Teatro",
    ]);
    expect(respuesta.body[0]).toEqual({
      id: "categoria-conferencias",
      nombre: "Conferencias",
      descripcion: "Charlas, congresos y talleres.",
    });
  });
});
