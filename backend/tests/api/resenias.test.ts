import { EstadoCompra } from "@ai-ticket-it/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { crearApp } from "../../src/app";
import { relojFijo } from "../helpers/eventos";

// Reseñas de eventos (feature 012, contracts/api.md) contra los datos de ejemplo.

const AHORA = new Date("2026-11-10T15:00:00.000Z");
const nuevaApp = () => crearApp({ reloj: relojFijo(AHORA) });
type App = ReturnType<typeof nuevaApp>;

const PENA = "evento-pena-en-la-rueda";
const RUTA_PENA = `/api/eventos/${PENA}/resenias`;

const reseniar = (app: App, usuarioId: string | null, cuerpo: unknown, ruta = RUTA_PENA) => {
  const pedido = request(app).post(ruta);
  if (usuarioId !== null) pedido.set("X-Usuario-Id", usuarioId);
  return pedido.send(cuerpo as object);
};

const DATOS = { puntuacion: 4, comentario: "  Muy buena organización  " };

/** El detalle (o los detalles) del 400 sobre `campo`. */
function detallesDe(cuerpo: { error: { detalles?: { campo: string; mensaje: string }[] } }, campo: string) {
  return (cuerpo.error.detalles ?? []).filter((detalle) => detalle.campo === campo);
}

describe("POST /api/eventos/:eventoId/resenias (US1)", () => {
  it("Martín reseña la Peña: 201 con el comentario recortado y la fecha del servidor", async () => {
    const respuesta = await reseniar(nuevaApp(), "usuario-martin", DATOS);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({
      id: expect.any(String),
      eventoId: PENA,
      puntuacion: 4,
      comentario: "Muy buena organización",
      creadaEn: AHORA.toISOString(),
      creadaEnLocal: "2026-11-10T12:00",
    });
  });

  it("las claves extra (compradorId, creadaEn, id) se ignoran", async () => {
    const respuesta = await reseniar(nuevaApp(), "usuario-martin", {
      ...DATOS,
      compradorId: "usuario-sofia",
      creadaEn: "2020-01-01T00:00:00.000Z",
      id: "resenia-trucha",
    });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.id).not.toBe("resenia-trucha");
    expect(respuesta.body.creadaEn).toBe(AHORA.toISOString());
    expect(respuesta.body).not.toHaveProperty("compradorId");
  });

  it("después, la compra trae la reseña y ya no se puede reseñar; el cupo no cambia", async () => {
    const app = nuevaApp();
    const cupos = async () =>
      (
        (await request(app).get(`/api/eventos/${PENA}`)).body.tiposEntrada as { id: string; cupo: number }[]
      ).map((t) => [t.id, t.cupo]);
    const compraDeMartin = () =>
      request(app).get("/api/compras/compra-martin-pena-general").set("X-Usuario-Id", "usuario-martin");
    const cuposAntes = await cupos();
    expect((await compraDeMartin()).body).toMatchObject({ resenia: null, puedeReseniar: true });

    const alta = await reseniar(app, "usuario-martin", DATOS);

    const despues = (await compraDeMartin()).body;
    expect(despues.resenia).toEqual(alta.body);
    expect(despues.puedeReseniar).toBe(false);
    expect(despues.estado).toBe(EstadoCompra.UTILIZADA);
    expect(despues.entradasUsadas).toBe(1);
    expect(await cupos()).toEqual(cuposAntes);
  });

  it("solo espacios → 201 sin comentario; sin comentario → 201 con null", async () => {
    const conEspacios = await reseniar(nuevaApp(), "usuario-martin", { puntuacion: 5, comentario: "    " });
    expect(conEspacios.status).toBe(201);
    expect(conEspacios.body.comentario).toBeNull();
    const sinComentario = await reseniar(nuevaApp(), "usuario-martin", { puntuacion: 5 });
    expect(sinComentario.status).toBe(201);
    expect(sinComentario.body.comentario).toBeNull();
  });

  it("un comentario de 500 caracteres con espacios alrededor → 201 recortado", async () => {
    const quinientos = "a".repeat(500);
    const respuesta = await reseniar(nuevaApp(), "usuario-martin", {
      puntuacion: 5,
      comentario: `  ${quinientos}  `,
    });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.comentario).toBe(quinientos);
  });

  describe("rechazos (en el orden de contracts/api.md)", () => {
    it.each([
      ["sin X-Usuario-Id", null],
      ["con un usuario inexistente", "usuario-nadie"],
    ])("401 USUARIO_NO_IDENTIFICADO %s", async (_caso, usuarioId) => {
      const respuesta = await reseniar(nuevaApp(), usuarioId, DATOS);
      expect(respuesta.status).toBe(401);
      expect(respuesta.body.error.codigo).toBe("USUARIO_NO_IDENTIFICADO");
    });

    it("400 sobre params.eventoId con un id inválido", async () => {
      const respuesta = await reseniar(
        nuevaApp(),
        "usuario-martin",
        DATOS,
        "/api/eventos/NO_VALIDO/resenias",
      );
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.codigo).toBe("ENTRADA_INVALIDA");
      expect(detallesDe(respuesta.body, "params.eventoId")).toHaveLength(1);
    });

    it.each([
      ["ausente", undefined, "Es obligatorio."],
      ["como texto", "4", "Debe ser un entero de 1 a 5."],
      ["no entera", 4.5, "Debe ser un entero de 1 a 5."],
      ["0", 0, "Debe ser un entero de 1 a 5."],
      ["6", 6, "Debe ser un entero de 1 a 5."],
    ])("400 sobre body.puntuacion %s", async (_caso, puntuacion, mensaje) => {
      const respuesta = await reseniar(nuevaApp(), "usuario-martin", { puntuacion, comentario: "Hola" });
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.codigo).toBe("ENTRADA_INVALIDA");
      expect(detallesDe(respuesta.body, "body.puntuacion")).toEqual([{ campo: "body.puntuacion", mensaje }]);
    });

    it.each([
      ["de 501 caracteres", "a".repeat(501)],
      ["numérico", 123],
    ])("400 sobre body.comentario %s", async (_caso, comentario) => {
      const respuesta = await reseniar(nuevaApp(), "usuario-martin", { puntuacion: 4, comentario });
      expect(respuesta.status).toBe(400);
      expect(detallesDe(respuesta.body, "body.comentario")).toEqual([
        { campo: "body.comentario", mensaje: "Debe tener como máximo 500 caracteres." },
      ]);
    });

    it("404 EVENTO_NO_ENCONTRADO con un evento inexistente", async () => {
      const respuesta = await reseniar(
        nuevaApp(),
        "usuario-martin",
        DATOS,
        "/api/eventos/evento-no-existe/resenias",
      );
      expect(respuesta.status).toBe(404);
      expect(respuesta.body.error.codigo).toBe("EVENTO_NO_ENCONTRADO");
    });

    it("409 RESENIA_PROPIO_EVENTO: Lucía organiza la Peña", async () => {
      const respuesta = await reseniar(nuevaApp(), "usuario-lucia", DATOS);
      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error).toEqual({
        codigo: "RESENIA_PROPIO_EVENTO",
        mensaje: "No podés reseñar un evento que organizás.",
      });
    });

    it("409 SIN_COMPRA_UTILIZADA: Sofía tiene una CONFIRMADA de la Peña", async () => {
      const respuesta = await reseniar(nuevaApp(), "usuario-sofia", DATOS);
      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error).toEqual({
        codigo: "SIN_COMPRA_UTILIZADA",
        mensaje: "Solo podés reseñar un evento al que asististe (con una compra utilizada).",
      });
    });

    it("409 RESENIA_REPETIDA: Martín reseña dos veces y queda la primera", async () => {
      const app = nuevaApp();
      const primera = await reseniar(app, "usuario-martin", DATOS);
      const segunda = await reseniar(app, "usuario-martin", { puntuacion: 1, comentario: "Otra" });
      expect(segunda.status).toBe(409);
      expect(segunda.body.error).toEqual({
        codigo: "RESENIA_REPETIDA",
        mensaje: "Ya reseñaste este evento.",
      });
      const compra = await request(app)
        .get("/api/compras/compra-martin-pena-general")
        .set("X-Usuario-Id", "usuario-martin");
      expect(compra.body.resenia).toEqual(primera.body);
    });

    it("combinaciones: sin usuario y puntuación inválida → 401; puntuación inválida y evento inexistente → 400", async () => {
      expect((await reseniar(nuevaApp(), null, { puntuacion: 9 })).status).toBe(401);
      const respuesta = await reseniar(
        nuevaApp(),
        "usuario-martin",
        { puntuacion: 9 },
        "/api/eventos/evento-no-existe/resenias",
      );
      expect(respuesta.status).toBe(400);
    });

    it.each(["put", "patch", "delete"] as const)(
      "%s sobre las reseñas → 404 RUTA_NO_ENCONTRADA (no se editan ni se borran)",
      async (metodo) => {
        const respuesta = await request(nuevaApp())[metodo](RUTA_PENA).set("X-Usuario-Id", "usuario-martin");
        expect(respuesta.status).toBe(404);
        expect(respuesta.body.error.codigo).toBe("RUTA_NO_ENCONTRADA");
      },
    );
  });
});
