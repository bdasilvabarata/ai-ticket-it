import { readFileSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { crearApp } from "../../src/app";

const app = crearApp();
const ID_DE_EJEMPLO = "usuario-lucia";
const METODOS = ["get", "post", "put", "patch", "delete"] as const;
type Metodo = (typeof METODOS)[number];

interface Especificacion {
  openapi: string;
  servers: { url: string }[];
  paths: Record<string, Partial<Record<Metodo, unknown>>>;
}

async function obtenerEspecificacion(): Promise<Especificacion> {
  const respuesta = await request(app).get("/api/docs/openapi.json");
  expect(respuesta.status).toBe(200);
  return respuesta.body as Especificacion;
}

/** Pide la ruta y verifica que el servidor la conoce (no cae en el 404 de ruta inexistente). */
async function esperarRutaImplementada(metodo: Metodo, ruta: string): Promise<void> {
  const respuesta = await request(app)[metodo](ruta).set("X-Usuario-Id", ID_DE_EJEMPLO);
  expect(respuesta.body?.error?.codigo, `${metodo.toUpperCase()} ${ruta}`).not.toBe("RUTA_NO_ENCONTRADA");
}

describe("documentación de la API", () => {
  it("sirve Swagger UI en /api/docs", async () => {
    const respuesta = await request(app).get("/api/docs/");
    expect(respuesta.status).toBe(200);
    expect(respuesta.text).toContain("swagger-ui");
  });

  it("sirve la especificación OpenAPI 3 con base /api", async () => {
    const especificacion = await obtenerEspecificacion();
    expect(especificacion.openapi).toMatch(/^3\./);
    expect(especificacion.servers.map((s) => s.url)).toContain("/api");
  });

  it("cada ruta documentada existe en el servidor", async () => {
    const { paths } = await obtenerEspecificacion();
    expect(Object.keys(paths).length).toBeGreaterThan(0);
    for (const [plantilla, operaciones] of Object.entries(paths)) {
      const ruta = `/api${plantilla.replace(/\{[^}]+\}/g, ID_DE_EJEMPLO)}`;
      for (const metodo of METODOS) {
        if (operaciones[metodo]) await esperarRutaImplementada(metodo, ruta);
      }
    }
  });

  it("documenta el chat de la compra (feature 011): GET y POST /compras/{compraId}/mensajes", async () => {
    const { paths } = await obtenerEspecificacion();
    const mensajes = paths["/compras/{compraId}/mensajes"];
    expect(mensajes?.get).toBeDefined();
    expect(mensajes?.post).toBeDefined();
  });

  it("documenta el alta de reseñas (feature 012): POST /eventos/{eventoId}/resenias, sin PUT, PATCH ni DELETE", async () => {
    const { paths } = await obtenerEspecificacion();
    const resenias = paths["/eventos/{eventoId}/resenias"];
    expect(resenias?.post).toBeDefined();
    expect(resenias?.put ?? resenias?.patch ?? resenias?.delete).toBeUndefined();
  });

  it("la colección de Postman solo usa rutas que existen", async () => {
    const archivo = path.resolve(import.meta.dirname, "../../src/docs/ai-ticket-it.postman_collection.json");
    const coleccion = JSON.parse(readFileSync(archivo, "utf8")) as {
      item: { item: { request: { method: string; url: { raw: string } } }[] }[];
    };
    const pedidos = coleccion.item.flatMap((carpeta) => carpeta.item);
    expect(pedidos.length).toBeGreaterThan(0);
    for (const { request: pedido } of pedidos) {
      const ruta =
        pedido.url.raw.replace("{{baseUrl}}", "/api").replace("{{usuarioId}}", ID_DE_EJEMPLO).split("?")[0] ??
        "";
      await esperarRutaImplementada(pedido.method.toLowerCase() as Metodo, ruta);
    }
  });
});
