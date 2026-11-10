import request from "supertest";
import { describe, expect, it } from "vitest";
import { crearApp } from "../../src/app";
import { relojFijo } from "../helpers/eventos";

// Repositorios de ejemplo nuevos por app, armados con el instante del reloj fijo.
const reloj = relojFijo(new Date("2026-11-10T15:00:00.000Z"));
const nuevaApp = () => crearApp({ reloj });

const LUCIA = "usuario-lucia";
const SOFIA = "usuario-sofia";
const DIEGO = "usuario-diego";

function esperarError(respuesta: request.Response, status: number, codigo: string): void {
  expect(respuesta.status).toBe(status);
  expect(respuesta.body).toMatchObject({ error: { codigo, mensaje: expect.any(String) } });
}

describe("GET /api/eventos/mios", () => {
  it("responde 401 sin X-Usuario-Id", async () => {
    esperarError(await request(nuevaApp()).get("/api/eventos/mios"), 401, "USUARIO_NO_IDENTIFICADO");
  });

  it("Lucía ve Noche de Rock, Festival y Maratón, en ese orden", async () => {
    const respuesta = await request(nuevaApp()).get("/api/eventos/mios").set("X-Usuario-Id", LUCIA);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.map((e: { id: string }) => e.id)).toEqual([
      "evento-noche-de-rock",
      "evento-festival-sonidos-del-sur",
      "evento-maraton-10k",
    ]);
    expect(respuesta.body[1]).toEqual({
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

  it("Sofía ve el Clásico de básquet y, al final, Noche de risas realizada", async () => {
    const respuesta = await request(nuevaApp()).get("/api/eventos/mios").set("X-Usuario-Id", SOFIA);
    expect(respuesta.body.map((e: { id: string; realizado: boolean }) => [e.id, e.realizado])).toEqual([
      ["evento-clasico-de-basquet", false],
      ["evento-noche-de-risas", true],
    ]);
  });

  it("un usuario sin eventos recibe []", async () => {
    const respuesta = await request(nuevaApp()).get("/api/eventos/mios").set("X-Usuario-Id", DIEGO);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual([]);
  });
});
