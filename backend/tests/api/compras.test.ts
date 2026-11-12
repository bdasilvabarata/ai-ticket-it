import { EstadoCompra } from "@ai-ticket-it/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { crearApp } from "../../src/app";
import { relojFijo } from "../helpers/eventos";

const reloj = relojFijo(new Date("2026-11-10T15:00:00.000Z"));
const nuevaApp = () => crearApp({ reloj });
type App = ReturnType<typeof nuevaApp>;

const FESTIVAL = "/api/eventos/evento-festival-sonidos-del-sur";
const GENERAL = "tipo-festival-sonidos-del-sur-general";
const VIP = "tipo-festival-sonidos-del-sur-vip";
const BACKSTAGE = "tipo-festival-sonidos-del-sur-backstage";

const comprar = (app: App, cuerpo: object, usuarioId = "usuario-sofia", evento = FESTIVAL) =>
  request(app).post(`${evento}/compras`).set("X-Usuario-Id", usuarioId).send(cuerpo);
const misCompras = (app: App, usuarioId: string, evento = FESTIVAL) =>
  request(app).get(`${evento}/mis-compras`).set("X-Usuario-Id", usuarioId);

async function cupoDe(app: App, tipoId: string): Promise<number> {
  const { body } = await request(app).get(FESTIVAL);
  return (body.tiposEntrada as { id: string; cupo: number }[]).find((t) => t.id === tipoId)!.cupo;
}

describe("POST /api/eventos/:eventoId/compras", () => {
  it("Sofía compra 2 VIP del Festival → 201 PENDIENTE con total 240000, y el detalle muestra VIP 48", async () => {
    const app = nuevaApp();
    const respuesta = await comprar(app, { tipoEntradaId: VIP, cantidad: 2 });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject({
      compradorId: "usuario-sofia",
      evento: { id: "evento-festival-sonidos-del-sur", realizado: false },
      tipoEntrada: { id: VIP, nombre: "VIP" },
      cantidad: 2,
      total: 240000,
      estado: EstadoCompra.PENDIENTE,
      creadaEn: "2026-11-10T15:00:00.000Z",
      venceEn: "2026-11-10T15:15:00.000Z",
      venceEnLocal: "2026-11-10T12:15",
    });
    expect(await cupoDe(app, VIP)).toBe(48);
  });

  it("Diego compra las 3 Backstage → 201 y Backstage queda en 0", async () => {
    const app = nuevaApp();
    expect((await comprar(app, { tipoEntradaId: BACKSTAGE, cantidad: 3 }, "usuario-diego")).status).toBe(201);
    expect(await cupoDe(app, BACKSTAGE)).toBe(0);
    const otra = await comprar(app, { tipoEntradaId: BACKSTAGE, cantidad: 1 }, "usuario-valentina");
    expect(otra.status).toBe(409);
    expect(otra.body.error).toMatchObject({
      codigo: "CUPO_INSUFICIENTE",
      mensaje: "No quedan entradas de «Backstage».",
    });
  });

  it("un precio o total en el cuerpo se ignora: el total lo calcula el servidor", async () => {
    const respuesta = await comprar(nuevaApp(), { tipoEntradaId: VIP, cantidad: 2, precio: 1, total: 1 });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.total).toBe(240000);
  });

  it("sin X-Usuario-Id → 401 USUARIO_NO_IDENTIFICADO", async () => {
    const respuesta = await request(nuevaApp())
      .post(`${FESTIVAL}/compras`)
      .send({ tipoEntradaId: VIP, cantidad: 1 });
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe("USUARIO_NO_IDENTIFICADO");
  });

  it("cantidad inválida → 400 con detalle en body.cantidad", async () => {
    const app = nuevaApp();
    for (const cantidad of [0, -1, 1.5, "2", 5]) {
      const respuesta = await comprar(app, { tipoEntradaId: VIP, cantidad });
      expect(respuesta.status, String(cantidad)).toBe(400);
      expect(respuesta.body.error.detalles).toEqual([
        { campo: "body.cantidad", mensaje: "Debe ser un entero entre 1 y 4." },
      ]);
    }
    const sinCantidad = await comprar(app, { tipoEntradaId: VIP });
    expect(sinCantidad.body.error.detalles).toEqual([{ campo: "body.cantidad", mensaje: "Es obligatorio." }]);
  });

  it("un tipo de otro evento → 400 con detalle en body.tipoEntradaId", async () => {
    const respuesta = await comprar(nuevaApp(), { tipoEntradaId: "tipo-hamlet-platea", cantidad: 1 });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles).toEqual([
      { campo: "body.tipoEntradaId", mensaje: "No existe el tipo de entrada en este evento." },
    ]);
  });

  it("evento inexistente → 404 EVENTO_NO_ENCONTRADO", async () => {
    const respuesta = await comprar(
      nuevaApp(),
      { tipoEntradaId: VIP, cantidad: 1 },
      "usuario-sofia",
      "/api/eventos/evento-inexistente",
    );
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.codigo).toBe("EVENTO_NO_ENCONTRADO");
  });

  it("la organizadora → 409 COMPRA_PROPIO_EVENTO; Martín supera su tope → 409 TOPE_POR_PERSONA", async () => {
    const app = nuevaApp();
    const propia = await comprar(app, { tipoEntradaId: VIP, cantidad: 1 }, "usuario-lucia");
    expect(propia.status).toBe(409);
    expect(propia.body.error.codigo).toBe("COMPRA_PROPIO_EVENTO");
    const tope = await comprar(app, { tipoEntradaId: GENERAL, cantidad: 3 }, "usuario-martin");
    expect(tope.status).toBe(409);
    expect(tope.body.error).toMatchObject({
      codigo: "TOPE_POR_PERSONA",
      mensaje: "Podés comprar 2 entradas más de tipos pagos de este evento.",
    });
  });
});

describe("GET /api/eventos/:eventoId/mis-compras", () => {
  it("Martín en el Festival: sin pendientes y 2 restantes en cada tipo", async () => {
    const respuesta = await misCompras(nuevaApp(), "usuario-martin");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      pendientes: [],
      restantesPorTipo: [
        { tipoEntradaId: GENERAL, restantes: 2 },
        { tipoEntradaId: VIP, restantes: 2 },
        { tipoEntradaId: BACKSTAGE, restantes: 2 },
      ],
    });
  });

  it("Lucía (organizadora): 0 en todos los tipos", async () => {
    const { body } = await misCompras(nuevaApp(), "usuario-lucia");
    expect(body.restantesPorTipo.map((r: { restantes: number }) => r.restantes)).toEqual([0, 0, 0]);
  });

  it("después de comprar, la compra aparece en las pendientes", async () => {
    const app = nuevaApp();
    const { body: compra } = await comprar(app, { tipoEntradaId: VIP, cantidad: 1 });
    const { body } = await misCompras(app, "usuario-sofia");
    expect(body.pendientes.map((c: { id: string }) => c.id)).toEqual([compra.id]);
  });

  it("sin usuario → 401; evento inexistente → 404", async () => {
    const app = nuevaApp();
    expect((await request(app).get(`${FESTIVAL}/mis-compras`)).status).toBe(401);
    const inexistente = await misCompras(app, "usuario-sofia", "/api/eventos/evento-inexistente");
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error.codigo).toBe("EVENTO_NO_ENCONTRADO");
  });
});
