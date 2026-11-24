import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { manejarErrores } from "../../src/middlewares/manejar-errores";
import { esIdValido, paginaSchema } from "../../src/validations/comunes";
import { crearValidacion } from "../../src/validations/validacion";

// App mínima, sin base: prueba el middleware de validación y su lectura tipada.
const porFecha = crearValidacion({
  params: z.object({ id: z.string().regex(/^\d+$/, "Debe ser numérico.") }),
  query: z.object({ desde: z.iso.date().transform((texto) => new Date(`${texto}T00:00:00Z`)) }),
});
const sinQuery = crearValidacion({ query: z.object({ texto: z.string() }) });
const paginada = crearValidacion({ query: z.object({ pagina: paginaSchema }) });

const app = express();
app.get("/items/:id", porFecha.middleware, (req, res) => {
  const { id } = porFecha.leer(req, "params");
  const { desde } = porFecha.leer(req, "query");
  res.json({ id, desde: desde.toISOString(), esFecha: desde instanceof Date });
});
// Ruta mal cableada a propósito: lee sin haber pasado por el middleware.
app.get("/sin-validar", (req, res) => {
  res.json(sinQuery.leer(req, "query"));
});
app.get("/paginada", paginada.middleware, (req, res) => {
  res.json(paginada.leer(req, "query"));
});
app.use(manejarErrores);

describe("crearValidacion", () => {
  it("entrega al controller el valor ya transformado por el esquema, sin volver a validarlo", async () => {
    const respuesta = await request(app).get("/items/7?desde=2026-12-01");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ id: "7", desde: "2026-12-01T00:00:00.000Z", esFecha: true });
  });

  it("responde 400 con un detalle por cada campo inválido, de todas las partes", async () => {
    const respuesta = await request(app).get("/items/abc?desde=mañana");
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe("ENTRADA_INVALIDA");
    expect(respuesta.body.error.detalles.map((d: { campo: string }) => d.campo)).toEqual([
      "params.id",
      "query.desde",
    ]);
  });

  it("leer sin el middleware es un error de programación: 500 genérico", async () => {
    const respuesta = await request(app).get("/sin-validar?texto=hola");
    expect(respuesta.status).toBe(500);
    expect(respuesta.body.error.codigo).toBe("ERROR_INTERNO");
  });
});

describe("paginaSchema", () => {
  const MENSAJE = "Debe ser un entero mayor o igual a 1.";

  it("ausente es la página 1 (FR-004)", async () => {
    expect(paginaSchema.safeParse(undefined)).toEqual({ success: true, data: 1 });
    const respuesta = await request(app).get("/paginada");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ pagina: 1 });
  });

  it("un texto de dígitos es ese número", async () => {
    expect(paginaSchema.safeParse("2")).toEqual({ success: true, data: 2 });
    const respuesta = await request(app).get("/paginada?pagina=12");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ pagina: 12 });
  });

  it("rechaza lo que no es un entero seguro mayor o igual a 1", () => {
    for (const valor of ["0", "-1", "1.5", "abc", "", "1e1", "+2", " 2", "99999999999999999999"]) {
      expect(paginaSchema.safeParse(valor).success, JSON.stringify(valor)).toBe(false);
    }
  });

  it.each([
    ["0", "pagina=0"],
    ["-1", "pagina=-1"],
    ["1.5", "pagina=1.5"],
    ["abc", "pagina=abc"],
    ["vacía", "pagina="],
    ["1e1", "pagina=1e1"],
    ["un entero no seguro", "pagina=99999999999999999999"],
    ["repetida", "pagina=1&pagina=2"],
  ])("responde 400 query.pagina con %s", async (_caso, query) => {
    const respuesta = await request(app).get(`/paginada?${query}`);
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe("ENTRADA_INVALIDA");
    expect(respuesta.body.error.detalles).toEqual([{ campo: "query.pagina", mensaje: MENSAJE }]);
  });
});

describe("idSchema", () => {
  it("acepta UUID v4 (lo nuevo) e ids legibles <tipo>-<slug> (datos de ejemplo)", () => {
    for (const id of [
      "3f2b8c1e-9d4a-4c6b-8e2f-1a2b3c4d5e6f",
      "usuario-lucia",
      "evento-noche-de-rock",
      "tipo-festival-sonidos-del-sur-backstage",
      "evento-maraton-10k",
    ]) {
      expect(esIdValido(id), id).toBe(true);
    }
  });

  it("rechaza lo que no es UUID ni <tipo>-<slug>", () => {
    for (const id of [
      "",
      "123",
      "actual",
      "Usuario-Lucia",
      "usuario-",
      "-lucia",
      "usuario lucia",
      "0".repeat(24),
    ]) {
      expect(esIdValido(id), JSON.stringify(id)).toBe(false);
    }
  });
});
