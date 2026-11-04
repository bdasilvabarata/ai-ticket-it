import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { crearApp } from "../../src/app";
import { logger } from "../../src/config/logger";
import { usuarioService } from "../../src/services/usuario.service";
import { usarBaseDePrueba } from "./helpers/base-de-prueba";

usarBaseDePrueba();

const app = crearApp({ almacenamiento: "memoria" });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("errores transversales", () => {
  it.each([
    ["get", "/api/no-existe"],
    ["delete", "/api/salud"],
  ] as const)("%s %s responde 404 RUTA_NO_ENCONTRADA", async (metodo, ruta) => {
    const respuesta = await request(app)[metodo](ruta);
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.codigo).toBe("RUTA_NO_ENCONTRADA");
    expect(respuesta.body.error.mensaje).toEqual(expect.any(String));
  });

  it("responde 400 JSON_INVALIDO ante un cuerpo que no es JSON", async () => {
    const respuesta = await request(app)
      .post("/api/salud")
      .set("Content-Type", "application/json")
      .send("{mal");
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe("JSON_INVALIDO");
  });

  it("responde 413 CUERPO_DEMASIADO_GRANDE con más de 100 kB", async () => {
    const respuesta = await request(app)
      .post("/api/salud")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ relleno: "x".repeat(110 * 1024) }));
    expect(respuesta.status).toBe(413);
    expect(respuesta.body.error.codigo).toBe("CUERPO_DEMASIADO_GRANDE");
  });

  it("responde 500 genérico sin filtrar el error y lo registra", async () => {
    const falla = new Error("secreto interno");
    vi.spyOn(usuarioService, "listar").mockRejectedValue(falla);
    const espiaError = vi.spyOn(logger, "error");
    const respuesta = await request(app).get("/api/usuarios");
    expect(respuesta.status).toBe(500);
    expect(respuesta.body).toEqual({
      error: { codigo: "ERROR_INTERNO", mensaje: "Ocurrió un error inesperado." },
    });
    expect(respuesta.text).not.toContain("secreto interno");
    expect(respuesta.text).not.toContain("stack");
    expect(espiaError).toHaveBeenCalledWith(expect.any(String), falla);
  });

  it("registra cada pedido con método, ruta, status y duración", async () => {
    const espiaInfo = vi.spyOn(logger, "info");
    await request(app).get("/api/salud");
    expect(espiaInfo).toHaveBeenCalledWith(
      expect.stringMatching(/^GET \/api\/salud 200 \d+(\.\d)?ms$/),
    );
  });
});
