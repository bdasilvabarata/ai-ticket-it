import { EstadoCompra } from "@ai-ticket-it/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { crearApp } from "../../src/app";
import { relojFijo } from "../helpers/eventos";

// El seed arma la Peña a la hora en punto más cercana a ahora + 2 h: con cualquier reloj fijo, su
// ventana de uso está abierta (R12). El Festival es dentro de 30 días: su ventana está cerrada.
const reloj = relojFijo(new Date("2026-11-18T18:10:00.000Z"));
const nuevaApp = () => crearApp({ reloj });
type App = ReturnType<typeof nuevaApp>;

const PENA = "/api/eventos/evento-pena-en-la-rueda";
const FESTIVAL = "/api/eventos/evento-festival-sonidos-del-sur";
const DE_SOFIA = ["PRCS2B01", "PRCS2B02"] as const;
const DE_MARTIN_EN_EL_FESTIVAL = "FSVP7M01";

function buscar(app: App, codigo: string, usuarioId: string | null = "usuario-lucia", evento = PENA) {
  const pedido = request(app).get(`${evento}/entradas/${encodeURIComponent(codigo)}`);
  return usuarioId === null ? pedido : pedido.set("X-Usuario-Id", usuarioId);
}

function usar(app: App, codigo: string, usuarioId: string | null = "usuario-lucia", evento = PENA) {
  const pedido = request(app).post(`${evento}/entradas/${encodeURIComponent(codigo)}/uso`);
  return usuarioId === null ? pedido : pedido.set("X-Usuario-Id", usuarioId);
}

const compraDeSofia = (app: App) =>
  request(app).get("/api/compras/compra-sofia-pena-con-cena").set("X-Usuario-Id", "usuario-sofia");

describe("GET /api/eventos/:eventoId/entradas/:codigo (feature 008)", () => {
  it("401 sin usuario", async () => {
    const respuesta = await buscar(nuevaApp(), DE_SOFIA[0], null);
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe("USUARIO_NO_IDENTIFICADO");
  });

  it("400 con un código de 33 caracteres", async () => {
    const respuesta = await buscar(nuevaApp(), "A".repeat(33));
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles).toEqual([
      { campo: "params.codigo", mensaje: "Debe ser un texto de 1 a 32 caracteres." },
    ]);
  });

  it("404 EVENTO_NO_ENCONTRADO → 403 SIN_PERMISO → 404 ENTRADA_NO_ENCONTRADA", async () => {
    const app = nuevaApp();
    const sinEvento = await buscar(app, DE_SOFIA[0], "usuario-lucia", "/api/eventos/evento-inexistente");
    expect([sinEvento.status, sinEvento.body.error.codigo]).toEqual([404, "EVENTO_NO_ENCONTRADO"]);
    const deMartin = await buscar(app, DE_SOFIA[0], "usuario-martin");
    expect([deMartin.status, deMartin.body.error.codigo]).toEqual([403, "SIN_PERMISO"]);
    for (const codigo of ["ZZZZZZZZ", DE_MARTIN_EN_EL_FESTIVAL]) {
      const respuesta = await buscar(app, codigo);
      expect(respuesta.status).toBe(404);
      expect(respuesta.body).toEqual({
        error: {
          codigo: "ENTRADA_NO_ENCONTRADA",
          mensaje: "No hay ninguna entrada con ese código en este evento.",
        },
      });
    }
  });

  it("200 con un código de Sofía en minúsculas y con guion", async () => {
    const respuesta = await buscar(nuevaApp(), "prcs-2b01");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      codigo: "PRCS2B01",
      estado: EstadoCompra.CONFIRMADA,
      usadaEn: null,
      compra: {
        id: "compra-sofia-pena-con-cena",
        comprador: { id: "usuario-sofia", nombre: "Sofía", apellido: "Castro" },
        tipoEntrada: { id: "tipo-pena-en-la-rueda-con-cena", nombre: "Con cena" },
        cantidad: 2,
        estado: EstadoCompra.CONFIRMADA,
        entradasUsadas: 0,
      },
      ventanaDeUso: { estado: "abierta" },
    });
  });
});

describe("POST /api/eventos/:eventoId/entradas/:codigo/uso (feature 008)", () => {
  it("registra el uso; otra vez → 409; la otra entrada → 200 sin otro cambio en la compra", async () => {
    const app = nuevaApp();

    // Un cuerpo, si llega, se ignora.
    const primera = await usar(app, DE_SOFIA[0]).send({ estado: "CONFIRMADA" });
    expect(primera.status).toBe(200);
    expect(primera.body).toMatchObject({
      codigo: DE_SOFIA[0],
      estado: EstadoCompra.UTILIZADA,
      usadaEn: "2026-11-18T18:10:00.000Z",
      usadaEnLocal: "2026-11-18T15:10",
      compra: { estado: EstadoCompra.UTILIZADA, entradasUsadas: 1 },
    });

    const deSofia = await compraDeSofia(app);
    expect(deSofia.body).toMatchObject({ estado: EstadoCompra.UTILIZADA, entradasUsadas: 1 });
    expect(deSofia.body.entradas.map((e: { estado: string }) => e.estado)).toEqual([
      EstadoCompra.UTILIZADA,
      EstadoCompra.CONFIRMADA,
    ]);

    const otraVez = await usar(app, DE_SOFIA[0]);
    expect(otraVez.status).toBe(409);
    expect(otraVez.body.error).toEqual({
      codigo: "TRANSICION_INVALIDA",
      mensaje: "Esta entrada ya se utilizó.",
    });

    const segunda = await usar(app, DE_SOFIA[1]);
    expect(segunda.status).toBe(200);
    expect(segunda.body.compra.entradasUsadas).toBe(2);
    const historial = (await compraDeSofia(app)).body.historial as { estado: string }[];
    expect(historial.filter((c) => c.estado === EstadoCompra.UTILIZADA)).toHaveLength(1);
  });

  it("después de un uso, Compras del evento muestra el cupo sin cambios y las usadas sumadas", async () => {
    const app = nuevaApp();
    const comprasDeLaPena = async () =>
      (await request(app).get(`${PENA}/compras`).set("X-Usuario-Id", "usuario-lucia")).body as {
        resumenPorTipo: { tipoEntrada: { id: string } }[];
      };
    const conCena = (vista: Awaited<ReturnType<typeof comprasDeLaPena>>) =>
      vista.resumenPorTipo.find((r) => r.tipoEntrada.id === "tipo-pena-en-la-rueda-con-cena");

    expect(conCena(await comprasDeLaPena())).toMatchObject({ disponibles: 38, vendidas: 2, usadas: 0 });
    await usar(app, DE_SOFIA[0]);
    expect(conCena(await comprasDeLaPena())).toMatchObject({ disponibles: 38, vendidas: 2, usadas: 1 });
  });

  it("un código VIP de Martín sobre el Festival → 409 FUERA_DE_HORARIO_DE_USO", async () => {
    const respuesta = await usar(nuevaApp(), DE_MARTIN_EN_EL_FESTIVAL, "usuario-lucia", FESTIVAL);
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe("FUERA_DE_HORARIO_DE_USO");
    expect(respuesta.body.error.mensaje).toMatch(
      /^El ingreso se registra desde el \d{2}\/\d{2} \d{2}:\d{2} hasta el \d{2}\/\d{2} \d{2}:\d{2}\.$/,
    );
  });

  it("401, 404 evento, 403 (Martín) y 404 entrada, sin cambiar nada", async () => {
    const app = nuevaApp();
    expect((await usar(app, DE_SOFIA[0], null)).status).toBe(401);
    const sinEvento = await usar(app, DE_SOFIA[0], "usuario-lucia", "/api/eventos/evento-inexistente");
    expect(sinEvento.body.error.codigo).toBe("EVENTO_NO_ENCONTRADO");
    expect((await usar(app, DE_SOFIA[0], "usuario-martin")).body.error.codigo).toBe("SIN_PERMISO");
    expect((await usar(app, "ZZZZZZZZ")).body.error.codigo).toBe("ENTRADA_NO_ENCONTRADA");
    expect((await buscar(app, DE_SOFIA[0])).body.estado).toBe(EstadoCompra.CONFIRMADA);
  });
});

describe("Una entrada de una compra cancelada no sirve (feature 009, US1, SC-006)", () => {
  it("Sofía cancela la de la Peña: su código queda CANCELADA y registrar el uso → 409", async () => {
    const app = nuevaApp();
    const cancelacion = await request(app)
      .post("/api/compras/compra-sofia-pena-con-cena/cancelacion")
      .set("X-Usuario-Id", "usuario-sofia");
    expect(cancelacion.status).toBe(200);
    expect(cancelacion.body.reembolso).toEqual({ estado: "pendiente", monto: 30000 });

    const entrada = await buscar(app, DE_SOFIA[0]);
    expect(entrada.status).toBe(200);
    expect(entrada.body.estado).toBe(EstadoCompra.CANCELADA);

    const uso = await usar(app, DE_SOFIA[0]);
    expect(uso.status).toBe(409);
    expect(uso.body.error).toEqual({
      codigo: "TRANSICION_INVALIDA",
      mensaje: "La compra de esta entrada está cancelada.",
    });
  });
});
