import { EstadoCompra } from "@ai-ticket-it/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { crearApp } from "../../src/app";
import { relojFijo, relojMovible } from "../helpers/eventos";

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
  it("Martín en el Festival: sin pendientes, su compra confirmada y 2 restantes en cada tipo", async () => {
    const respuesta = await misCompras(nuevaApp(), "usuario-martin");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      pendientes: [],
      confirmadas: [
        expect.objectContaining({ id: "compra-martin-festival-vip", estado: EstadoCompra.CONFIRMADA }),
      ],
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

const verCompra = (app: App, compraId: string, usuarioId = "usuario-sofia") =>
  request(app).get(`/api/compras/${compraId}`).set("X-Usuario-Id", usuarioId);
const pagar = (app: App, compraId: string, usuarioId = "usuario-sofia") =>
  request(app).post(`/api/compras/${compraId}/pago`).set("X-Usuario-Id", usuarioId);

describe("GET /api/compras/:compraId y POST /api/compras/:compraId/pago", () => {
  it("Sofía compra, la ve PENDIENTE y la paga → 200 CONFIRMADA con el historial", async () => {
    const app = nuevaApp();
    const { body: compra } = await comprar(app, { tipoEntradaId: VIP, cantidad: 2 });

    const vista = await verCompra(app, compra.id);
    expect(vista.status).toBe(200);
    expect(vista.body).toMatchObject({ id: compra.id, estado: EstadoCompra.PENDIENTE, total: 240000 });

    const pago = await pagar(app, compra.id);
    expect(pago.status).toBe(200);
    expect(pago.body).toMatchObject({ estado: EstadoCompra.CONFIRMADA, venceEn: null, venceEnLocal: null });
    expect(pago.body.historial).toEqual([
      expect.objectContaining({
        estado: EstadoCompra.PENDIENTE,
        autor: { tipo: "usuario", usuarioId: "usuario-sofia" },
      }),
      {
        estado: EstadoCompra.CONFIRMADA,
        autor: { tipo: "usuario", usuarioId: "usuario-sofia" },
        fechaHora: "2026-11-10T15:00:00.000Z",
        fechaHoraLocal: "2026-11-10T12:00",
      },
    ]);
    expect((await verCompra(app, compra.id)).body.estado).toBe(EstadoCompra.CONFIRMADA);
  });

  it("pagar de nuevo → 409 TRANSICION_INVALIDA", async () => {
    const app = nuevaApp();
    const { body: compra } = await comprar(app, { tipoEntradaId: VIP, cantidad: 1 });
    await pagar(app, compra.id);
    const otra = await pagar(app, compra.id);
    expect(otra.status).toBe(409);
    expect(otra.body.error).toMatchObject({
      codigo: "TRANSICION_INVALIDA",
      mensaje: "La compra no está pendiente de pago.",
    });
  });

  it("Diego sobre la compra de Sofía → 403 SIN_PERMISO en las dos rutas", async () => {
    const app = nuevaApp();
    const { body: compra } = await comprar(app, { tipoEntradaId: VIP, cantidad: 1 });
    const respuestas = [
      await verCompra(app, compra.id, "usuario-diego"),
      await pagar(app, compra.id, "usuario-diego"),
    ];
    for (const respuesta of respuestas) {
      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error).toMatchObject({
        codigo: "SIN_PERMISO",
        mensaje: "Solo quien hizo la compra puede verla o pagarla.",
      });
    }
    expect((await verCompra(app, compra.id)).body.estado).toBe(EstadoCompra.PENDIENTE);
  });

  it("la compra vencida del seed: Sofía → 403; Diego la paga → 409 COMPRA_VENCIDA", async () => {
    const app = nuevaApp();
    expect((await verCompra(app, "compra-diego-festival-general")).status).toBe(403);
    expect((await pagar(app, "compra-diego-festival-general")).status).toBe(403);
    const pago = await pagar(app, "compra-diego-festival-general", "usuario-diego");
    expect(pago.status).toBe(409);
    expect(pago.body.error).toMatchObject({
      codigo: "COMPRA_VENCIDA",
      mensaje: "La compra venció: pasaron 15 minutos sin pagarla.",
    });
  });

  it("compra inexistente → 404 COMPRA_NO_ENCONTRADA en las dos rutas", async () => {
    const app = nuevaApp();
    const respuestas = [await verCompra(app, "compra-inexistente"), await pagar(app, "compra-inexistente")];
    for (const respuesta of respuestas) {
      expect(respuesta.status).toBe(404);
      expect(respuesta.body.error).toMatchObject({
        codigo: "COMPRA_NO_ENCONTRADA",
        mensaje: "No existe la compra.",
      });
    }
  });

  it("sin X-Usuario-Id → 401 en las dos rutas", async () => {
    const app = nuevaApp();
    expect((await request(app).get("/api/compras/compra-martin-festival-vip")).status).toBe(401);
    expect((await request(app).post("/api/compras/compra-martin-festival-vip/pago")).status).toBe(401);
  });

  it("un cuerpo en el pago se ignora", async () => {
    const app = nuevaApp();
    const { body: compra } = await comprar(app, { tipoEntradaId: VIP, cantidad: 1 });
    const pago = await request(app)
      .post(`/api/compras/${compra.id}/pago`)
      .set("X-Usuario-Id", "usuario-sofia")
      .send({ estado: "UTILIZADA", total: 1 });
    expect(pago.status).toBe(200);
    expect(pago.body).toMatchObject({ estado: EstadoCompra.CONFIRMADA, total: 120000 });
  });

  it("con el reloj 15 minutos después del alta, el GET la muestra CANCELADA y mis-compras ya no la lista", async () => {
    const movible = relojMovible(new Date("2026-11-10T15:00:00.000Z"));
    const app = crearApp({ reloj: movible });
    const { body: compra } = await comprar(app, { tipoEntradaId: VIP, cantidad: 2 });

    const antes = await misCompras(app, "usuario-sofia");
    expect(antes.body.pendientes).toEqual([
      expect.objectContaining({ id: compra.id, venceEnLocal: "2026-11-10T12:15" }),
    ]);

    movible.avanzar(15 * 60 * 1000);
    const vista = await verCompra(app, compra.id);
    expect(vista.body).toMatchObject({ estado: EstadoCompra.CANCELADA, venceEn: null });
    expect(vista.body.historial.at(-1)).toMatchObject({ autor: { tipo: "sistema" } });
    expect((await misCompras(app, "usuario-sofia")).body.pendientes).toEqual([]);
    expect(await cupoDe(app, VIP)).toBe(50);
  });
});

// US3 (T045): la tabla de rechazos de contracts/api.md ("Ejemplos" y "Errores de esta feature").
// Cada rechazo deja el cupo igual (SC-003): se compara el detalle del evento antes y después.
describe("rechazos del alta: status, código y mensaje, sin tocar el cupo", () => {
  const MARATON = "/api/eventos/evento-maraton-10k";
  const RISAS = "/api/eventos/evento-noche-de-risas";
  const ENTRADA_INVALIDA = { codigo: "ENTRADA_INVALIDA", mensaje: "Los datos enviados no son válidos." };

  async function cuposDe(app: App, evento: string): Promise<number[]> {
    const { body } = await request(app).get(evento);
    return (body.tiposEntrada as { cupo: number }[]).map((t) => t.cupo);
  }

  /** Hace el pedido y verifica que el cupo del `evento` no cambió. */
  async function rechazo(app: App, pedido: () => request.Test, evento = FESTIVAL) {
    const antes = await cuposDe(app, evento);
    const respuesta = await pedido();
    expect(await cuposDe(app, evento)).toEqual(antes);
    return respuesta;
  }

  it('cantidad 0, -1, 1.5, "2", 5 o faltante → 400 ENTRADA_INVALIDA en body.cantidad', async () => {
    const app = nuevaApp();
    const casos: [object, string][] = [
      ...[0, -1, 1.5, "2", 5].map((cantidad): [object, string] => [
        { tipoEntradaId: VIP, cantidad },
        "Debe ser un entero entre 1 y 4.",
      ]),
      [{ tipoEntradaId: VIP }, "Es obligatorio."],
    ];
    for (const [cuerpo, mensaje] of casos) {
      const respuesta = await rechazo(app, () => comprar(app, cuerpo));
      expect(respuesta.status, JSON.stringify(cuerpo)).toBe(400);
      expect(respuesta.body.error).toMatchObject(ENTRADA_INVALIDA);
      expect(respuesta.body.error.detalles).toEqual([{ campo: "body.cantidad", mensaje }]);
    }
  });

  it("tipoEntradaId faltante, mal formado o de otro evento → 400 en body.tipoEntradaId", async () => {
    const app = nuevaApp();
    const casos: [object, string][] = [
      [{ cantidad: 1 }, "Es obligatorio."],
      [{ tipoEntradaId: "Tipo 1", cantidad: 1 }, "Debe ser un identificador válido."],
      [{ tipoEntradaId: 7, cantidad: 1 }, "Debe ser un identificador válido."],
      [{ tipoEntradaId: "tipo-hamlet-platea", cantidad: 1 }, "No existe el tipo de entrada en este evento."],
    ];
    for (const [cuerpo, mensaje] of casos) {
      const respuesta = await rechazo(app, () => comprar(app, cuerpo));
      expect(respuesta.status, JSON.stringify(cuerpo)).toBe(400);
      expect(respuesta.body.error).toMatchObject(ENTRADA_INVALIDA);
      expect(respuesta.body.error.detalles).toEqual([{ campo: "body.tipoEntradaId", mensaje }]);
    }
  });

  it("evento inexistente → 404 EVENTO_NO_ENCONTRADO; eventoId mal formado → 400 en params.eventoId", async () => {
    const app = nuevaApp();
    const cuerpo = { tipoEntradaId: VIP, cantidad: 1 };
    const inexistente = await rechazo(app, () =>
      comprar(app, cuerpo, "usuario-sofia", "/api/eventos/evento-inexistente"),
    );
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error).toMatchObject({
      codigo: "EVENTO_NO_ENCONTRADO",
      mensaje: "No existe el evento.",
    });

    const malFormado = await rechazo(app, () =>
      comprar(app, cuerpo, "usuario-sofia", "/api/eventos/Evento%201"),
    );
    expect(malFormado.status).toBe(400);
    expect(malFormado.body.error.detalles).toEqual([
      { campo: "params.eventoId", mensaje: "Debe ser un identificador válido." },
    ]);
  });

  it("Noche de risas (ya realizada) → 409 EVENTO_REALIZADO", async () => {
    const app = nuevaApp();
    const cuerpo = { tipoEntradaId: "tipo-noche-de-risas-general", cantidad: 1 };
    const respuesta = await rechazo(app, () => comprar(app, cuerpo, "usuario-martin", RISAS), RISAS);
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toMatchObject({
      codigo: "EVENTO_REALIZADO",
      mensaje: "El evento ya se realizó: no se pueden comprar entradas.",
    });
  });

  it("Lucía en su Festival → 409 COMPRA_PROPIO_EVENTO", async () => {
    const app = nuevaApp();
    const respuesta = await rechazo(app, () =>
      comprar(app, { tipoEntradaId: VIP, cantidad: 1 }, "usuario-lucia"),
    );
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toMatchObject({
      codigo: "COMPRA_PROPIO_EVENTO",
      mensaje: "No podés comprar entradas de un evento que organizás.",
    });
  });

  it("Martín con 3 General → 409 TOPE_POR_PERSONA con las que le quedan", async () => {
    const app = nuevaApp();
    const respuesta = await rechazo(app, () =>
      comprar(app, { tipoEntradaId: GENERAL, cantidad: 3 }, "usuario-martin"),
    );
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toMatchObject({
      codigo: "TOPE_POR_PERSONA",
      mensaje: "Podés comprar 2 entradas más de tipos pagos de este evento.",
    });
  });

  it("dos Carrera kids seguidas de Sofía → 201 y 409 TOPE_POR_PERSONA", async () => {
    const app = nuevaApp();
    const kids = { tipoEntradaId: "tipo-maraton-10k-carrera-kids", cantidad: 1 };
    const primera = await comprar(app, kids, "usuario-sofia", MARATON);
    expect(primera.status).toBe(201);
    expect(primera.body.total).toBe(0);
    const segunda = await rechazo(app, () => comprar(app, kids, "usuario-sofia", MARATON), MARATON);
    expect(segunda.status).toBe(409);
    expect(segunda.body.error.codigo).toBe("TOPE_POR_PERSONA");
  });

  it('las 3 Backstage y después 1 más → 409 CUPO_INSUFICIENTE "No quedan entradas de «Backstage»."', async () => {
    const app = nuevaApp();
    expect((await comprar(app, { tipoEntradaId: BACKSTAGE, cantidad: 3 }, "usuario-diego")).status).toBe(201);
    const respuesta = await rechazo(app, () =>
      comprar(app, { tipoEntradaId: BACKSTAGE, cantidad: 1 }, "usuario-valentina"),
    );
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toMatchObject({
      codigo: "CUPO_INSUFICIENTE",
      mensaje: "No quedan entradas de «Backstage».",
    });
  });

  it('4 VIP con cupo 3 → 409 CUPO_INSUFICIENTE "Quedan 3 entradas de «VIP»."', async () => {
    const app = nuevaApp();
    const { body: evento } = await request(app).get(FESTIVAL);
    type Tipo = { id: string; nombre: string; descripcion: string; precio: number };
    const vip = (evento.tiposEntrada as Tipo[]).find((t) => t.id === VIP)!;
    const edicion = await request(app)
      .put(`${FESTIVAL}/tipos-entrada/${VIP}`)
      .set("X-Usuario-Id", "usuario-lucia")
      .send({ nombre: vip.nombre, descripcion: vip.descripcion, precio: vip.precio, cupo: 3 });
    expect(edicion.status).toBe(200);

    const respuesta = await rechazo(app, () => comprar(app, { tipoEntradaId: VIP, cantidad: 4 }));
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toMatchObject({
      codigo: "CUPO_INSUFICIENTE",
      mensaje: "Quedan 3 entradas de «VIP».",
    });
  });

  it("mis-compras y las rutas de /compras/:id con ids mal formados → 400 en params.*", async () => {
    const app = nuevaApp();
    const misComprasMal = await misCompras(app, "usuario-sofia", "/api/eventos/Evento%201");
    expect(misComprasMal.status).toBe(400);
    expect(misComprasMal.body.error.detalles).toEqual([
      { campo: "params.eventoId", mensaje: "Debe ser un identificador válido." },
    ]);
    for (const respuesta of [await verCompra(app, "Compra%201"), await pagar(app, "Compra%201")]) {
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.detalles).toEqual([
        { campo: "params.compraId", mensaje: "Debe ser un identificador válido." },
      ]);
    }
  });
});

describe("POST /api/compras/:compraId/cancelacion (corrección de la 006)", () => {
  const cancelar = (app: App, compraId: string, usuarioId = "usuario-sofia") =>
    request(app).post(`/api/compras/${compraId}/cancelacion`).set("X-Usuario-Id", usuarioId);

  it("Sofía cancela su pendiente → 200 CANCELADA por ella, el cupo vuelve y ya no está en mis-compras", async () => {
    const app = nuevaApp();
    const { body: compra } = await comprar(app, { tipoEntradaId: VIP, cantidad: 2 });
    expect(await cupoDe(app, VIP)).toBe(48);

    const respuesta = await cancelar(app, compra.id);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ estado: EstadoCompra.CANCELADA, venceEn: null });
    expect(respuesta.body.historial.at(-1)).toMatchObject({
      estado: EstadoCompra.CANCELADA,
      autor: { tipo: "usuario", usuarioId: "usuario-sofia" },
    });
    expect(await cupoDe(app, VIP)).toBe(50);
    expect((await misCompras(app, "usuario-sofia")).body.pendientes).toEqual([]);
  });

  it("Diego → 403; inexistente → 404; sin usuario → 401; ya pagada → 409 TRANSICION_INVALIDA", async () => {
    const app = nuevaApp();
    const { body: compra } = await comprar(app, { tipoEntradaId: VIP, cantidad: 1 });
    expect((await cancelar(app, compra.id, "usuario-diego")).status).toBe(403);
    expect((await cancelar(app, "compra-inexistente")).body.error.codigo).toBe("COMPRA_NO_ENCONTRADA");
    expect((await request(app).post(`/api/compras/${compra.id}/cancelacion`)).status).toBe(401);
    await pagar(app, compra.id);
    const otra = await cancelar(app, compra.id);
    expect(otra.status).toBe(409);
    expect(otra.body.error.codigo).toBe("TRANSICION_INVALIDA");
  });

  it("la compra vencida del seed → 409 COMPRA_VENCIDA", async () => {
    const respuesta = await cancelar(nuevaApp(), "compra-diego-festival-general", "usuario-diego");
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe("COMPRA_VENCIDA");
  });
});

describe("GET /api/eventos/:eventoId/mis-compras: confirmadas (corrección de la 006)", () => {
  it("después de pagar, la compra pasa de pendientes a confirmadas", async () => {
    const app = nuevaApp();
    const { body: compra } = await comprar(app, { tipoEntradaId: VIP, cantidad: 1 }, "usuario-diego");
    await pagar(app, compra.id, "usuario-diego");
    const { body } = await misCompras(app, "usuario-diego");
    expect(body.pendientes).toEqual([]);
    expect(body.confirmadas.map((c: { id: string }) => c.id)).toContain(compra.id);
  });
});
