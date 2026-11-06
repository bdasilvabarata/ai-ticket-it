import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { crearApp } from "../../src/app";
import { logger } from "../../src/config/logger";
import { DatosInvalidosError, ReglaDeNegocioError } from "../../src/domain/errores";
import type { RepositorioUsuarios } from "../../src/domain/repositorios";
import { usarBaseDePrueba } from "./helpers/base-de-prueba";

usarBaseDePrueba();

const app = crearApp({ almacenamiento: "memoria" });

/** App con un repositorio de usuarios inyectado que falla con `error` (sin espiar globales). */
function appConUsuariosQueFallan(error: unknown) {
  const usuarios: RepositorioUsuarios = {
    listar: () => Promise.reject(error),
    buscarPorId: () => Promise.reject(error),
  };
  return crearApp({ almacenamiento: "memoria", repositorios: { usuarios } });
}

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
    const espiaError = vi.spyOn(logger, "error");
    const respuesta = await request(appConUsuariosQueFallan(falla)).get("/api/usuarios");
    expect(respuesta.status).toBe(500);
    expect(respuesta.body).toEqual({
      error: { codigo: "ERROR_INTERNO", mensaje: "Ocurrió un error inesperado." },
    });
    expect(respuesta.text).not.toContain("secreto interno");
    expect(respuesta.text).not.toContain("stack");
    expect(espiaError).toHaveBeenCalledWith(expect.any(String), falla);
  });

  it("un DatosInvalidosError del dominio responde 400 ENTRADA_INVALIDA con sus detalles", async () => {
    const error = new DatosInvalidosError([
      { campo: "cupo", mensaje: "Debe ser un entero mayor o igual a 0." },
    ]);
    const respuesta = await request(appConUsuariosQueFallan(error)).get("/api/usuarios");
    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toEqual({
      error: {
        codigo: "ENTRADA_INVALIDA",
        mensaje: "Los datos enviados no son válidos.",
        detalles: [{ campo: "cupo", mensaje: "Debe ser un entero mayor o igual a 0." }],
      },
    });
  });

  it("un ReglaDeNegocioError del dominio responde 409 con el código de la regla", async () => {
    const error = new ReglaDeNegocioError("CUPO_INSUFICIENTE", "No quedan entradas suficientes.");
    const respuesta = await request(appConUsuariosQueFallan(error)).get("/api/usuarios");
    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual({
      error: { codigo: "CUPO_INSUFICIENTE", mensaje: "No quedan entradas suficientes." },
    });
  });

  it("no registra como error inesperado los errores esperados (4xx)", async () => {
    const espiaError = vi.spyOn(logger, "error");
    await request(app).get("/api/no-existe");
    await request(app).get("/api/usuarios/123");
    await request(app).post("/api/salud").set("Content-Type", "application/json").send("{mal");
    await request(appConUsuariosQueFallan(new ReglaDeNegocioError("X", "y"))).get("/api/usuarios");
    expect(espiaError).not.toHaveBeenCalled();
  });

  it("registra cada pedido con método, ruta, status y duración", async () => {
    const espiaInfo = vi.spyOn(logger, "info");
    await request(app).get("/api/salud");
    expect(espiaInfo).toHaveBeenCalledWith(expect.stringMatching(/^GET \/api\/salud 200 \d+(\.\d)?ms$/));
  });
});
