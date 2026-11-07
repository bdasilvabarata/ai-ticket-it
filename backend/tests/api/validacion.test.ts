import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { manejarErrores } from "../../src/middlewares/manejar-errores";
import { esIdValido } from "../../src/validations/comunes";
import { crearValidacion } from "../../src/validations/validacion";

// App mínima, sin base: prueba el middleware de validación y su lectura tipada.
const porFecha = crearValidacion({
  params: z.object({ id: z.string().regex(/^\d+$/, "Debe ser numérico.") }),
  query: z.object({ desde: z.iso.date().transform((texto) => new Date(`${texto}T00:00:00Z`)) }),
});
const sinQuery = crearValidacion({ query: z.object({ texto: z.string() }) });

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
