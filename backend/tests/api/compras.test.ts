import { EstadoCompra } from "@ai-ticket-it/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { crearApp } from "../../src/app";
import { diasRestantes } from "../../src/domain/dias-restantes";
import { CompraRepository } from "../../src/repositories/compra.repository";
import { EventoRepository } from "../../src/repositories/evento.repository";
import { crearRepositoriosDeEjemplo } from "../../src/seed/repositorios-de-ejemplo";
import { DIA, SIN_PAGINAS, compra, evento, relojFijo, relojMovible, tipo } from "../helpers/eventos";

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

  it("Diego → 403; inexistente → 404; sin usuario → 401; pagada y cancelada → 409 TRANSICION_INVALIDA", async () => {
    const app = nuevaApp();
    const { body: compra } = await comprar(app, { tipoEntradaId: VIP, cantidad: 1 });
    expect((await cancelar(app, compra.id, "usuario-diego")).status).toBe(403);
    expect((await cancelar(app, "compra-inexistente")).body.error.codigo).toBe("COMPRA_NO_ENCONTRADA");
    expect((await request(app).post(`/api/compras/${compra.id}/cancelacion`)).status).toBe(401);
    await pagar(app, compra.id);
    // Desde la 009, una pagada se cancela antes del inicio; la segunda vez ya está cancelada.
    expect((await cancelar(app, compra.id)).status).toBe(200);
    const otra = await cancelar(app, compra.id);
    expect(otra.status).toBe(409);
    expect(otra.body.error).toMatchObject({
      codigo: "TRANSICION_INVALIDA",
      mensaje: "La compra ya está cancelada.",
    });
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

/** Sin las diez compras del Festival que suma el seed de la 013 (R11), que no cambian estas demos. */
// Las compras que suma el seed de la 013: las diez del Festival (R11, US3) y las de los dos
// realizados de Martín (US4).
const sinLasDeLa013 = <T extends { id: string }>(vistas: T[]) =>
  vistas.filter((c) => !/-festival-\d+$|-(taller-de-escritura|tango-en-la-terraza)-general$/.test(c.id));

describe("GET /api/compras (feature 007)", () => {
  const listar = (app: App, usuarioId?: string, ruta = "/api/compras") => {
    const pedido = request(app).get(ruta);
    return usuarioId === undefined ? pedido : pedido.set("X-Usuario-Id", usuarioId);
  };

  it("sin X-Usuario-Id o con un usuario inexistente → 401 USUARIO_NO_IDENTIFICADO", async () => {
    const app = nuevaApp();
    for (const usuarioId of [undefined, "usuario-inexistente"]) {
      const respuesta = await listar(app, usuarioId);
      expect(respuesta.status, String(usuarioId)).toBe(401);
      expect(respuesta.body.error.codigo).toBe("USUARIO_NO_IDENTIFICADO");
    }
  });

  it("Martín → 200 con la UTILIZADA de la Peña y la CONFIRMADA del Festival, sin historial ni compradorId", async () => {
    const respuesta = await listar(nuevaApp(), "usuario-martin");
    expect(respuesta.status).toBe(200);
    // La Peña empieza antes que el Festival: va primero (fecha ascendente).
    expect(sinLasDeLa013<{ id: string }>(respuesta.body).map((c) => c.id)).toEqual([
      "compra-martin-pena-general",
      "compra-martin-festival-vip",
    ]);
    expect(respuesta.body[0]).toMatchObject({
      estado: EstadoCompra.UTILIZADA,
      entradasUsadas: 1,
      diasRestantes: null,
    });
    const vista = sinLasDeLa013<{ id: string }>(respuesta.body)[1];
    expect(vista).toMatchObject({
      id: "compra-martin-festival-vip",
      evento: { id: "evento-festival-sonidos-del-sur", nombre: "Festival Sonidos del Sur", realizado: false },
      tipoEntrada: { id: VIP, nombre: "VIP" },
      cantidad: 2,
      total: 240000,
      estado: EstadoCompra.CONFIRMADA,
      venceEn: null,
      venceEnLocal: null,
      canceladaPor: null,
    });
    expect(vista).not.toHaveProperty("historial");
    expect(vista).not.toHaveProperty("compradorId");
  });

  it("Martín: diasRestantes de su CONFIRMADA es el calculado para el reloj de la app (US2)", async () => {
    const vista = (await listar(nuevaApp(), "usuario-martin")).body.find(
      (c: { id: string }) => c.id === "compra-martin-festival-vip",
    );
    const esperado = diasRestantes(new Date(vista.evento.fechaHora), reloj.ahora());
    expect(esperado).toBeGreaterThan(0);
    expect(vista.diasRestantes).toBe(esperado);
  });

  it("con el reloj fijado, una compra confirmada de un evento de mañana → diasRestantes 1", async () => {
    const app = crearApp({
      reloj,
      repositorios: {
        eventos: new EventoRepository([
          evento({ id: "evento-manana", en: DIA, tiposEntrada: [tipo({ id: "tipo-manana" })] }),
        ]),
        compras: new CompraRepository([
          compra("evento-manana", "tipo-manana", EstadoCompra.CONFIRMADA, {
            id: "compra-manana",
            compradorId: "usuario-sofia",
          }),
        ]),
      },
    });
    const respuesta = await listar(app, "usuario-sofia");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual([
      expect.objectContaining({ id: "compra-manana", estado: EstadoCompra.CONFIRMADA, diasRestantes: 1 }),
    ]);
  });

  it("Diego → 200 con su compra CANCELADA por el sistema, la del Maratón cancelada por él (009) y las reseñadas (012)", async () => {
    const respuesta = await listar(nuevaApp(), "usuario-diego");
    expect(respuesta.status).toBe(200);
    // El Festival (+30 días) antes que el Maratón (+45 días): no realizados, por fecha ascendente;
    // después, los realizados por fecha descendente: la Noche de risas (−3 días) y Jazz (−10 días).
    expect(sinLasDeLa013(respuesta.body)).toEqual([
      expect.objectContaining({
        id: "compra-diego-festival-general",
        estado: EstadoCompra.CANCELADA,
        canceladaPor: "sistema",
        venceEn: null,
      }),
      expect.objectContaining({
        id: "compra-diego-maraton-inscripcion",
        estado: EstadoCompra.CANCELADA,
        canceladaPor: "usuario",
        canceladaDesde: "CONFIRMADA",
        reembolso: { estado: "pendiente", monto: 30000 },
      }),
      expect.objectContaining({
        id: "compra-diego-noche-de-risas-general",
        estado: EstadoCompra.UTILIZADA,
        resenia: expect.objectContaining({ puntuacion: 3 }),
        puedeReseniar: false,
      }),
      expect.objectContaining({
        id: "compra-diego-jazz-en-el-patio-general",
        estado: EstadoCompra.UTILIZADA,
        resenia: expect.objectContaining({ puntuacion: 4 }),
        puedeReseniar: false,
      }),
    ]);
  });

  it("Lucía (organiza el Festival) → 200 con solo su compra de Jazz, ya reseñada (012)", async () => {
    const respuesta = await listar(nuevaApp(), "usuario-lucia");
    expect(respuesta.status).toBe(200);
    expect(sinLasDeLa013(respuesta.body as { id: string }[])).toEqual([
      expect.objectContaining({
        id: "compra-lucia-jazz-en-el-patio-general",
        resenia: expect.objectContaining({ puntuacion: 5 }),
        puedeReseniar: false,
      }),
    ]);
  });

  it("una query se ignora", async () => {
    const app = nuevaApp();
    const conQuery = await listar(app, "usuario-martin", "/api/compras?estado=PENDIENTE");
    expect(conQuery.status).toBe(200);
    expect(conQuery.body).toEqual((await listar(app, "usuario-martin")).body);
  });

  it("US3: una PENDIENTE al día; a los 15 minutos, CANCELADA por el sistema sin guardar nada; cancelada por Sofía → usuario", async () => {
    const movible = relojMovible(new Date("2026-11-10T15:00:00.000Z"));
    const repositorios = crearRepositoriosDeEjemplo(movible.ahora());
    const app = crearApp({ reloj: movible, repositorios });
    const { body: pendiente } = await comprar(app, { tipoEntradaId: VIP, cantidad: 1 });

    const sinLaPena = (vistas: { id: string }[]) =>
      sinLasDeLa013(vistas).filter((c) => c.id !== "compra-sofia-pena-con-cena");
    const antes = sinLaPena((await listar(app, "usuario-sofia")).body);
    expect(antes).toEqual([
      expect.objectContaining({
        id: pendiente.id,
        estado: EstadoCompra.PENDIENTE,
        venceEnLocal: "2026-11-10T12:15",
        canceladaPor: null,
      }),
    ]);

    movible.avanzar(15 * 60 * 1000);
    const despues = sinLaPena((await listar(app, "usuario-sofia")).body);
    expect(despues).toEqual([
      expect.objectContaining({
        id: pendiente.id,
        estado: EstadoCompra.CANCELADA,
        venceEn: null,
        canceladaPor: "sistema",
      }),
    ]);
    // La lista es una lectura: la compra guardada sigue PENDIENTE y el detalle muestra el cupo al día.
    expect((await repositorios.compras.buscarPorId(pendiente.id))?.estado).toBe(EstadoCompra.PENDIENTE);
    expect(await cupoDe(app, VIP)).toBe(50);

    const { body: otra } = await comprar(app, { tipoEntradaId: VIP, cantidad: 1 });
    await request(app).post(`/api/compras/${otra.id}/cancelacion`).set("X-Usuario-Id", "usuario-sofia");
    const conCancelada = (await listar(app, "usuario-sofia")).body as { id: string; canceladaPor: string }[];
    expect(conCancelada.find((c) => c.id === otra.id)).toMatchObject({
      estado: EstadoCompra.CANCELADA,
      canceladaPor: "usuario",
    });
  });

  it("GET /api/compras/:compraId sigue funcionando", async () => {
    const respuesta = await request(nuevaApp())
      .get("/api/compras/compra-martin-festival-vip")
      .set("X-Usuario-Id", "usuario-martin");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ id: "compra-martin-festival-vip", compradorId: "usuario-martin" });
    expect(respuesta.body.historial).toBeInstanceOf(Array);
  });
});

const comprasDelEvento = (app: App, usuarioId?: string, evento = FESTIVAL) => {
  const pedido = request(app).get(`${evento}/compras`);
  return usuarioId === undefined ? pedido : pedido.set("X-Usuario-Id", usuarioId);
};

describe("GET /api/eventos/:eventoId/compras (feature 008)", () => {
  it("sin header → 401 USUARIO_NO_IDENTIFICADO", async () => {
    const respuesta = await comprasDelEvento(nuevaApp());
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe("USUARIO_NO_IDENTIFICADO");
  });

  it("evento inexistente → 404 EVENTO_NO_ENCONTRADO (antes que el permiso)", async () => {
    const respuesta = await comprasDelEvento(nuevaApp(), "usuario-martin", "/api/eventos/evento-inexistente");
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.codigo).toBe("EVENTO_NO_ENCONTRADO");
  });

  it("Martín (comprador, no organizador) sobre el Festival de Lucía → 403 SIN_PERMISO", async () => {
    const respuesta = await comprasDelEvento(nuevaApp(), "usuario-martin");
    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error).toEqual({
      codigo: "SIN_PERMISO",
      mensaje: "Solo el organizador del evento puede ver sus compras.",
    });
  });

  it("Lucía → 200 con la forma de ComprasDelEventoVista, de la más nueva a la más vieja", async () => {
    const respuesta = await comprasDelEvento(nuevaApp(), "usuario-lucia");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      evento: {
        id: "evento-festival-sonidos-del-sur",
        nombre: expect.any(String),
        fechaHoraLocal: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
        realizado: false,
      },
      ventanaDeUso: {
        desde: expect.any(String),
        hasta: expect.any(String),
        desdeLocal: expect.any(String),
        hastaLocal: expect.any(String),
        estado: "antes",
      },
      resumenPorTipo: expect.any(Array),
      // El seed de la 013 (R11): 12 compras; la de Valentina de la página 2 también espera respuesta.
      comprasConMensajesSinResponder: 2,
      cantidadCompras: 12,
      pagina: { numero: 1, tamano: 10, totalElementos: 12, totalPaginas: 2 },
      compras: expect.arrayContaining([
        expect.objectContaining({
          id: "compra-diego-festival-general",
          comprador: { id: "usuario-diego", nombre: "Diego", apellido: "Fernández" },
          tipoEntrada: { id: GENERAL, nombre: "General" },
          estado: EstadoCompra.CANCELADA,
          canceladaPor: "sistema",
          venceEn: null,
        }),
        expect.objectContaining({
          id: "compra-martin-festival-vip",
          comprador: { id: "usuario-martin", nombre: "Martín", apellido: "Benítez" },
          tipoEntrada: { id: VIP, nombre: "VIP" },
          cantidad: 2,
          estado: EstadoCompra.CONFIRMADA,
          canceladaPor: null,
          entradasUsadas: 0,
        }),
      ]),
    });
    expect(respuesta.body.compras.map((c: { id: string }) => c.id)).toEqual([
      "compra-valentina-festival-1",
      "compra-diego-festival-2",
      "compra-sofia-festival-3",
      "compra-valentina-festival-4",
      "compra-diego-festival-general",
      "compra-martin-festival-5",
      "compra-diego-festival-6",
      "compra-valentina-festival-7",
      "compra-sofia-festival-8",
      "compra-martin-festival-vip",
    ]);
    for (const fila of respuesta.body.compras) {
      expect(fila).not.toHaveProperty("entradas");
      expect(fila).not.toHaveProperty("historial");
    }
  });

  it("una pendiente vencida sale CANCELADA por el sistema, y un segundo GET sigue igual (no se guardó nada)", async () => {
    const movible = relojMovible(new Date("2026-11-10T15:00:00.000Z"));
    const app = crearApp({ reloj: movible });
    const { body: nueva } = await comprar(app, { tipoEntradaId: VIP, cantidad: 1 });

    const antes = await comprasDelEvento(app, "usuario-lucia");
    expect(antes.body.compras[0]).toMatchObject({ id: nueva.id, estado: EstadoCompra.PENDIENTE });

    movible.avanzar(15 * 60 * 1000);
    for (let i = 0; i < 2; i += 1) {
      const { body } = await comprasDelEvento(app, "usuario-lucia");
      expect(body.compras[0]).toMatchObject({
        id: nueva.id,
        estado: EstadoCompra.CANCELADA,
        canceladaPor: "sistema",
        venceEn: null,
      });
    }
  });

  it("resumenPorTipo (US2): cada tipo del Festival en su orden, con las cantidades del seed y el cupo del detalle", async () => {
    const app = nuevaApp();
    const { body } = await comprasDelEvento(app, "usuario-lucia");
    expect(body.resumenPorTipo).toEqual([
      {
        tipoEntrada: { id: GENERAL, nombre: "General" },
        disponibles: await cupoDe(app, GENERAL),
        pendientes: 0,
        vendidas: 4, // las confirmadas de Valentina y Diego del seed de la 013
        usadas: 0,
      },
      {
        tipoEntrada: { id: VIP, nombre: "VIP" },
        disponibles: await cupoDe(app, VIP),
        pendientes: 0,
        vendidas: 2,
        usadas: 0,
      },
      {
        tipoEntrada: { id: BACKSTAGE, nombre: "Backstage" },
        disponibles: await cupoDe(app, BACKSTAGE),
        pendientes: 0,
        vendidas: 0,
        usadas: 0,
      },
    ]);
  });

  it("resumenPorTipo: una compra sin pagar suma a pendientes y descuenta disponibles", async () => {
    const app = nuevaApp();
    const antes = (await comprasDelEvento(app, "usuario-lucia")).body.resumenPorTipo[1];
    await comprar(app, { tipoEntradaId: VIP, cantidad: 2 });
    const despues = (await comprasDelEvento(app, "usuario-lucia")).body.resumenPorTipo[1];
    expect(despues).toMatchObject({ disponibles: antes.disponibles - 2, pendientes: 2, vendidas: 2 });
  });

  it("mensajes sin responder (docs/mejoras-organizador.md, grupo 4): el seed de Martín termina en él; se apaga cuando Lucía contesta", async () => {
    const app = nuevaApp();
    const fila = (body: { compras: { id: string; mensajeSinResponder: boolean }[] }, id: string) =>
      body.compras.find((compra) => compra.id === id)?.mensajeSinResponder;

    const antes = (await comprasDelEvento(app, "usuario-lucia")).body;
    expect(fila(antes, "compra-martin-festival-vip")).toBe(true);
    expect(fila(antes, "compra-diego-festival-general")).toBe(false);
    // También cuenta la de Valentina, en la página 2 (seed de la 013).
    expect(antes.comprasConMensajesSinResponder).toBe(2);

    const respuesta = await request(app)
      .post("/api/compras/compra-martin-festival-vip/mensajes")
      .set("X-Usuario-Id", "usuario-lucia")
      .send({ texto: "¡De nada!" });
    expect(respuesta.status).toBe(201);

    const despues = (await comprasDelEvento(app, "usuario-lucia")).body;
    expect(fila(despues, "compra-martin-festival-vip")).toBe(false);
    expect(despues.comprasConMensajesSinResponder).toBe(1);
  });

  it("una query desconocida y el cuerpo se ignoran", async () => {
    const respuesta = await request(nuevaApp())
      .get(`${FESTIVAL}/compras?orden=x&limite=1`)
      .set("X-Usuario-Id", "usuario-lucia")
      .send({ cualquiera: 1 });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.compras).toHaveLength(10);
  });

  it("el seed de la 013 (R11): como Lucía, 10 de las 12 compras del Festival y el contador cuenta la de la página 2", async () => {
    const app = nuevaApp();
    const primera = await comprasDelEvento(app, "usuario-lucia");
    expect(primera.body.compras).toHaveLength(10);
    expect(primera.body.cantidadCompras).toBe(12);
    expect(primera.body.pagina).toEqual({ numero: 1, tamano: 10, totalElementos: 12, totalPaginas: 2 });

    const segunda = (
      await request(app).get(`${FESTIVAL}/compras?pagina=2`).set("X-Usuario-Id", "usuario-lucia")
    ).body;
    expect(
      segunda.compras.map((c: { id: string; mensajeSinResponder: boolean }) => [c.id, c.mensajeSinResponder]),
    ).toEqual([
      ["compra-martin-festival-9", false],
      ["compra-valentina-festival-10", true],
    ]);
    expect(primera.body.comprasConMensajesSinResponder).toBe(2);
    expect(
      primera.body.compras.filter((c: { mensajeSinResponder: boolean }) => c.mensajeSinResponder),
    ).toHaveLength(1);

    const canceladas = (
      await request(app).get(`${FESTIVAL}/compras?estado=CANCELADA`).set("X-Usuario-Id", "usuario-lucia")
    ).body;
    expect(canceladas.pagina.totalElementos).toBe(7);
    expect(canceladas.cantidadCompras).toBe(12);
  });
});

describe("GET /api/eventos/:eventoId/compras: paginado y filtros (feature 013, US3)", () => {
  // 13 compras de "evento-a" (de Lucía), de la más nueva (compra-00, hace 1 minuto, PENDIENTE) a la
  // más vieja (compra-12, hace 12 horas). compra-03 (página 1) y compra-11 (página 2) terminan en un
  // mensaje del comprador sin responder.
  const ESTADOS = [
    EstadoCompra.PENDIENTE,
    EstadoCompra.CONFIRMADA,
    EstadoCompra.CANCELADA,
    EstadoCompra.CONFIRMADA,
    EstadoCompra.CONFIRMADA,
    EstadoCompra.CANCELADA,
    EstadoCompra.CONFIRMADA,
    EstadoCompra.REEMBOLSADA,
    EstadoCompra.CONFIRMADA,
    EstadoCompra.CANCELADA,
    EstadoCompra.CONFIRMADA,
    EstadoCompra.CONFIRMADA,
    EstadoCompra.CANCELADA,
  ];
  const COMPRADORES = ["usuario-martin", "usuario-sofia", "usuario-diego", "usuario-valentina"];
  const AHORA_DEL_TEST = reloj.ahora();
  const hace = (minutos: number) => new Date(AHORA_DEL_TEST.getTime() - minutos * 60 * 1000);
  const ids = ESTADOS.map((_, i) => `compra-${String(i).padStart(2, "0")}`);
  const compras = ESTADOS.map((estado, i) => {
    const compradorId = COMPRADORES[i % COMPRADORES.length]!;
    const creadaEn = hace(i === 0 ? 1 : i * 60);
    const base = compra("evento-a", "tipo-a-general", estado, { id: ids[i]!, compradorId, creadaEn });
    return i === 3 || i === 11 ? base.enviarMensaje(compradorId, "¿A qué hora abren?", creadaEn) : base;
  });
  const appConMuchas = (relojDelTest = reloj) =>
    crearApp({
      reloj: relojDelTest,
      repositorios: {
        eventos: new EventoRepository([
          evento({ id: "evento-a", tiposEntrada: [tipo({ id: "tipo-a-general", cupo: 100 })] }),
        ]),
        compras: new CompraRepository(compras),
      },
    });
  const pedir = (query = "", usuarioId: string | null = "usuario-lucia", app = appConMuchas()) => {
    const pedido = request(app).get(`/api/eventos/evento-a/compras${query}`);
    return usuarioId === null ? pedido : pedido.set("X-Usuario-Id", usuarioId);
  };
  const idsDe = (respuesta: request.Response) =>
    (respuesta.body.compras as { id: string }[]).map((c) => c.id);
  const detalles = (respuesta: request.Response): Record<string, string> => {
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe("ENTRADA_INVALIDA");
    return Object.fromEntries(
      (respuesta.body.error.detalles as { campo: string; mensaje: string }[]).map((d) => [
        d.campo,
        d.mensaje,
      ]),
    );
  };
  const totales = (respuesta: request.Response) => {
    const { ventanaDeUso, resumenPorTipo, comprasConMensajesSinResponder, cantidadCompras } = respuesta.body;
    return { ventanaDeUso, resumenPorTipo, comprasConMensajesSinResponder, cantidadCompras };
  };

  it("sin pagina → las 10 primeras en el orden de la 008 y los totales de la lista", async () => {
    const respuesta = await pedir();
    expect(respuesta.status).toBe(200);
    expect(idsDe(respuesta)).toEqual(ids.slice(0, 10));
    expect(respuesta.body.pagina).toEqual({ numero: 1, tamano: 10, totalElementos: 13, totalPaginas: 2 });
    expect(respuesta.body.cantidadCompras).toBe(13);
  });

  it("?pagina=2 → las restantes; concatenar las páginas es la lista completa (SC-002)", async () => {
    const app = appConMuchas();
    const primera = await pedir("", "usuario-lucia", app);
    const segunda = await pedir("?pagina=2", "usuario-lucia", app);
    expect(idsDe(segunda)).toEqual(ids.slice(10));
    expect(segunda.body.pagina).toEqual({ numero: 2, tamano: 10, totalElementos: 13, totalPaginas: 2 });
    expect([...idsDe(primera), ...idsDe(segunda)]).toEqual(ids);
  });

  it("una página posterior a la última → la última, con su número real (FR-005)", async () => {
    const respuesta = await pedir("?pagina=9");
    expect(respuesta.status).toBe(200);
    expect(idsDe(respuesta)).toEqual(ids.slice(10));
    expect(respuesta.body.pagina.numero).toBe(2);
  });

  it("ventana, resumen, contador y cantidadCompras son de todas: iguales en cada página y con cada filtro (SC-006, FR-016)", async () => {
    const app = appConMuchas();
    const primera = await pedir("", "usuario-lucia", app);
    expect(primera.body.comprasConMensajesSinResponder).toBe(2); // cuenta la de la página 2 (US3-3)
    expect(primera.body.resumenPorTipo[0]).toMatchObject({ pendientes: 1, vendidas: 7 });
    const consultas = [
      "?pagina=2",
      "?estado=CANCELADA",
      "?sinResponder=true",
      "?estado=PENDIENTE&sinResponder=true",
    ];
    for (const query of consultas) {
      expect(totales(await pedir(query, "usuario-lucia", app))).toEqual(totales(primera));
    }
  });

  it("?estado=CANCELADA → solo esas; pagina.totalElementos filtrado y cantidadCompras sin filtrar", async () => {
    const respuesta = await pedir("?estado=CANCELADA");
    expect(idsDe(respuesta)).toEqual(["compra-02", "compra-05", "compra-09", "compra-12"]);
    expect(respuesta.body.pagina).toEqual({ numero: 1, tamano: 10, totalElementos: 4, totalPaginas: 1 });
    expect(respuesta.body.cantidadCompras).toBe(13);
  });

  it("?estado se compara con el estado al día: una pendiente vencida es CANCELADA", async () => {
    const movible = relojMovible(AHORA_DEL_TEST);
    const app = appConMuchas(movible);
    movible.avanzar(15 * 60 * 1000);
    expect(idsDe(await pedir("?estado=PENDIENTE", "usuario-lucia", app))).toEqual([]);
    expect(idsDe(await pedir("?estado=CANCELADA", "usuario-lucia", app))).toEqual([
      "compra-00",
      "compra-02",
      "compra-05",
      "compra-09",
      "compra-12",
    ]);
  });

  it("?sinResponder=true → solo las del último mensaje del comprador; false → todas", async () => {
    expect(idsDe(await pedir("?sinResponder=true"))).toEqual(["compra-03", "compra-11"]);
    expect((await pedir("?sinResponder=false")).body.pagina.totalElementos).toBe(13);
  });

  it("estado y sinResponder juntos se aplican con 'y'", async () => {
    expect(idsDe(await pedir("?estado=CONFIRMADA&sinResponder=true"))).toEqual(["compra-03", "compra-11"]);
    const vacia = await pedir("?estado=CANCELADA&sinResponder=true");
    expect(vacia.status).toBe(200);
    expect(vacia.body.compras).toEqual([]);
    expect(vacia.body.pagina).toEqual(SIN_PAGINAS);
    expect(vacia.body.cantidadCompras).toBe(13);
  });

  it("?tamano=50 se ignora: la página sigue siendo de 10 (FR-006)", async () => {
    const respuesta = await pedir("?tamano=50");
    expect(respuesta.body.compras).toHaveLength(10);
    expect(respuesta.body.pagina.tamano).toBe(10);
  });

  it("sin códigos de entradas ni historial en las filas (FR-019)", async () => {
    for (const fila of (await pedir("?pagina=2")).body.compras) {
      expect(fila).not.toHaveProperty("entradas");
      expect(fila).not.toHaveProperty("historial");
    }
  });

  it.each([
    ["?pagina=0", { "query.pagina": "Debe ser un entero mayor o igual a 1." }],
    ["?pagina=abc", { "query.pagina": "Debe ser un entero mayor o igual a 1." }],
    ["?estado=VENCIDA", { "query.estado": "Debe ser uno de los estados de una compra." }],
    ["?sinResponder=si", { "query.sinResponder": "Debe ser true o false." }],
    [
      "?pagina=-1&estado=pendiente&sinResponder=1",
      {
        "query.pagina": "Debe ser un entero mayor o igual a 1.",
        "query.estado": "Debe ser uno de los estados de una compra.",
        "query.sinResponder": "Debe ser true o false.",
      },
    ],
  ])("%s → 400 ENTRADA_INVALIDA", async (query, esperado) => {
    expect(detalles(await pedir(query))).toEqual(esperado);
  });

  it("orden de rechazos: 401 → 400 → 404 → 403", async () => {
    const sinUsuario = await pedir("?estado=VENCIDA", null);
    expect(sinUsuario.status).toBe(401);
    expect(sinUsuario.body.error.codigo).toBe("USUARIO_NO_IDENTIFICADO");

    const invalidos = await request(appConMuchas())
      .get("/api/eventos/Evento_Mal/compras?estado=VENCIDA")
      .set("X-Usuario-Id", "usuario-martin");
    expect(detalles(invalidos)).toEqual({
      "params.eventoId": "Debe ser un identificador válido.",
      "query.estado": "Debe ser uno de los estados de una compra.",
    });

    const inexistente = await request(appConMuchas())
      .get("/api/eventos/evento-inexistente/compras?estado=CANCELADA")
      .set("X-Usuario-Id", "usuario-martin");
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error.codigo).toBe("EVENTO_NO_ENCONTRADO");

    const ajeno = await pedir("?estado=CANCELADA", "usuario-martin");
    expect(ajeno.status).toBe(403);
    expect(ajeno.body.error.codigo).toBe("SIN_PERMISO");
  });

  it("GET /eventos/:eventoId/mis-compras no acepta ni exige los parámetros nuevos (sigue igual)", async () => {
    const respuesta = await request(appConMuchas())
      .get("/api/eventos/evento-a/mis-compras?pagina=0&estado=VENCIDA&sinResponder=si")
      .set("X-Usuario-Id", "usuario-martin");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).not.toHaveProperty("pagina");
  });
});

describe("POST /api/compras/:compraId/cancelacion de una CONFIRMADA (feature 009, US1)", () => {
  const COMPRA_DE_MARTIN = "compra-martin-festival-vip";
  const cancelarComo = (app: App, compraId: string, usuarioId: string) =>
    request(app).post(`/api/compras/${compraId}/cancelacion`).set("X-Usuario-Id", usuarioId);

  it("Martín cancela la del Festival → 200 con la forma del contrato", async () => {
    const app = nuevaApp();
    const respuesta = await cancelarComo(app, COMPRA_DE_MARTIN, "usuario-martin").send({ ignorado: true });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      id: COMPRA_DE_MARTIN,
      compradorId: "usuario-martin",
      evento: { id: "evento-festival-sonidos-del-sur", nombre: "Festival Sonidos del Sur", realizado: false },
      tipoEntrada: { id: VIP, nombre: "VIP" },
      cantidad: 2,
      total: 240000,
      estado: EstadoCompra.CANCELADA,
      venceEn: null,
      venceEnLocal: null,
      entradas: [],
      entradasUsadas: 0,
      canceladaDesde: "CONFIRMADA",
      reembolso: { estado: "pendiente", monto: 240000 },
      cancelable: false,
      motivoNoCancelable: "cancelada",
    });
    expect(respuesta.body.historial.map((cambio: { estado: string }) => cambio.estado)).toEqual([
      EstadoCompra.PENDIENTE,
      EstadoCompra.CONFIRMADA,
      EstadoCompra.CANCELADA,
    ]);
    expect(respuesta.body.historial.at(-1)).toMatchObject({
      autor: { tipo: "usuario", usuarioId: "usuario-martin" },
      fechaHora: "2026-11-10T15:00:00.000Z",
    });
  });

  // El seed tiene VIP en 50 con las 2 de Martín ya vendidas: al cancelar sube 2 (a 52).
  it("después, el cupo de VIP sube 2 para cualquiera, el Festival sigue en el catálogo y el tope de Martín se libera", async () => {
    const app = nuevaApp();
    const antes = await cupoDe(app, VIP);
    await cancelarComo(app, COMPRA_DE_MARTIN, "usuario-martin");

    expect(await cupoDe(app, VIP)).toBe(antes + 2);
    const comoDiego = await request(app).get(FESTIVAL).set("X-Usuario-Id", "usuario-diego");
    expect(
      (comoDiego.body.tiposEntrada as { id: string; cupo: number }[]).find((t) => t.id === VIP)?.cupo,
    ).toBe(antes + 2);
    // Es el 11.º por fecha en el seed de la 013: en la página 2 del catálogo.
    const catalogo = await request(app).get("/api/eventos?pagina=2");
    expect(catalogo.body.eventos).toContainEqual(
      expect.objectContaining({ id: "evento-festival-sonidos-del-sur", agotado: false }),
    );

    const { body } = await misCompras(app, "usuario-martin");
    for (const tipoEntradaId of [GENERAL, VIP, BACKSTAGE]) {
      expect(body.restantesPorTipo).toContainEqual({ tipoEntradaId, restantes: 4 });
    }
    expect(body.confirmadas.map((c: { id: string }) => c.id)).not.toContain(COMPRA_DE_MARTIN);
  });
});

describe("POST /api/compras/:compraId/cancelacion: rechazos (feature 009, US3)", () => {
  const COMPRA_DE_MARTIN = "compra-martin-festival-vip";
  const cancelarComo = (app: App, compraId: string, usuarioId?: string) => {
    const pedido = request(app).post(`/api/compras/${compraId}/cancelacion`);
    return usuarioId === undefined ? pedido : pedido.set("X-Usuario-Id", usuarioId);
  };
  const obtenerComo = (app: App, compraId: string, usuarioId: string) =>
    request(app).get(`/api/compras/${compraId}`).set("X-Usuario-Id", usuarioId);
  function esperarError(respuesta: request.Response, status: number, codigo: string, mensaje?: string): void {
    expect(respuesta.status).toBe(status);
    expect(respuesta.body.error.codigo).toBe(codigo);
    if (mensaje !== undefined) expect(respuesta.body.error.mensaje).toBe(mensaje);
  }

  it("sin header → 401; id inválido → 400 en params.compraId; inexistente → 404", async () => {
    const app = nuevaApp();
    esperarError(await cancelarComo(app, COMPRA_DE_MARTIN), 401, "USUARIO_NO_IDENTIFICADO");
    const invalido = await cancelarComo(app, "no válido!", "usuario-martin");
    esperarError(invalido, 400, "ENTRADA_INVALIDA");
    expect(invalido.body.error.detalles).toEqual([
      { campo: "params.compraId", mensaje: "Debe ser un identificador válido." },
    ]);
    esperarError(
      await cancelarComo(app, "no-existe", "usuario-martin"),
      404,
      "COMPRA_NO_ENCONTRADA",
      "No existe la compra.",
    );
  });

  it("la de Sofía en la Peña como Lucía (organizadora) → 403 SIN_PERMISO", async () => {
    esperarError(
      await cancelarComo(nuevaApp(), "compra-sofia-pena-con-cena", "usuario-lucia"),
      403,
      "SIN_PERMISO",
      "Solo quien hizo la compra puede verla o pagarla.",
    );
  });

  it("con el reloj a la hora de inicio del Festival → 409 EVENTO_REALIZADO y el cupo no cambia", async () => {
    const relojDeLaApp = relojMovible(new Date("2026-11-10T15:00:00.000Z"));
    const app = crearApp({ reloj: relojDeLaApp });
    const { body: festival } = await request(app).get(FESTIVAL);
    const antes = await cupoDe(app, VIP);
    relojDeLaApp.avanzar(new Date(festival.fechaHora).getTime() - relojDeLaApp.ahora().getTime());

    esperarError(
      await cancelarComo(app, COMPRA_DE_MARTIN, "usuario-martin"),
      409,
      "EVENTO_REALIZADO",
      "El evento ya empezó: ya no se puede cancelar la compra.",
    );
    expect(await cupoDe(app, VIP)).toBe(antes);
    expect((await obtenerComo(app, COMPRA_DE_MARTIN, "usuario-martin")).body).toMatchObject({
      estado: EstadoCompra.CONFIRMADA,
      cancelable: false,
      motivoNoCancelable: "evento-empezado",
    });
  });

  it("la UTILIZADA de Martín en la Peña → 409 «Ya se usó una entrada…»", async () => {
    esperarError(
      await cancelarComo(nuevaApp(), "compra-martin-pena-general", "usuario-martin"),
      409,
      "TRANSICION_INVALIDA",
      "Ya se usó una entrada de esta compra: no se puede cancelar.",
    );
  });

  it("cancelar dos veces la del Festival → el segundo 409 «ya está cancelada» y VIP sube una sola vez", async () => {
    const app = nuevaApp();
    const antes = await cupoDe(app, VIP);
    expect((await cancelarComo(app, COMPRA_DE_MARTIN, "usuario-martin")).status).toBe(200);
    esperarError(
      await cancelarComo(app, COMPRA_DE_MARTIN, "usuario-martin"),
      409,
      "TRANSICION_INVALIDA",
      "La compra ya está cancelada.",
    );
    expect(await cupoDe(app, VIP)).toBe(antes + 2);
  });

  it("la REEMBOLSADA de Valentina en el Maratón → 409 «ya fue reembolsada»", async () => {
    esperarError(
      await cancelarComo(nuevaApp(), "compra-valentina-maraton-inscripcion", "usuario-valentina"),
      409,
      "TRANSICION_INVALIDA",
      "La compra ya fue reembolsada.",
    );
  });

  it("GET /compras/:id informa si se puede cancelar: la UTILIZADA no, la del Festival sí", async () => {
    const app = nuevaApp();
    expect((await obtenerComo(app, "compra-martin-pena-general", "usuario-martin")).body).toMatchObject({
      cancelable: false,
      motivoNoCancelable: "entrada-usada",
    });
    expect((await obtenerComo(app, COMPRA_DE_MARTIN, "usuario-martin")).body).toMatchObject({
      cancelable: true,
      motivoNoCancelable: null,
    });
  });
});

describe("POST /api/compras/:compraId/reembolso (feature 009, US2)", () => {
  const MARATON = "/api/eventos/evento-maraton-10k";
  const INSCRIPCION = "tipo-maraton-10k-inscripcion";
  const DIEGO = "compra-diego-maraton-inscripcion";
  const VALENTINA = "compra-valentina-maraton-inscripcion";
  const reembolsar = (app: App, compraId: string, usuarioId = "usuario-lucia") =>
    request(app).post(`/api/compras/${compraId}/reembolso`).set("X-Usuario-Id", usuarioId);
  const comprasDelMaraton = (app: App) =>
    request(app).get(`${MARATON}/compras`).set("X-Usuario-Id", "usuario-lucia");
  const inscripcion = async (app: App) => {
    const { body } = await request(app).get(MARATON);
    return (body.tiposEntrada as { id: string; cupo: number }[]).find((t) => t.id === INSCRIPCION)!.cupo;
  };
  const ya = { codigo: "TRANSICION_INVALIDA", mensaje: "El reembolso de esta compra ya se confirmó." };

  it("sin X-Usuario-Id → 401 USUARIO_NO_IDENTIFICADO", async () => {
    const respuesta = await request(nuevaApp()).post(`/api/compras/${DIEGO}/reembolso`);
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe("USUARIO_NO_IDENTIFICADO");
  });

  it("compraId inválido → 400 ENTRADA_INVALIDA en params.compraId", async () => {
    const respuesta = await reembolsar(nuevaApp(), "Compra%201");
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toMatchObject({ codigo: "ENTRADA_INVALIDA" });
    expect(respuesta.body.error.detalles).toEqual([
      { campo: "params.compraId", mensaje: "Debe ser un identificador válido." },
    ]);
  });

  it("una compra inexistente → 404 COMPRA_NO_ENCONTRADA", async () => {
    const respuesta = await reembolsar(nuevaApp(), "no-existe");
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error).toMatchObject({
      codigo: "COMPRA_NO_ENCONTRADA",
      mensaje: "No existe la compra.",
    });
  });

  it("Diego sobre la suya → 403 SIN_PERMISO", async () => {
    const respuesta = await reembolsar(nuevaApp(), DIEGO, "usuario-diego");
    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error).toMatchObject({
      codigo: "SIN_PERMISO",
      mensaje: "Solo el organizador puede modificar este evento.",
    });
  });

  it("antes del reembolso, Compras del evento trae a Diego pendiente y a Valentina confirmada, con 1000 disponibles", async () => {
    const { status, body } = await comprasDelMaraton(nuevaApp());
    expect(status).toBe(200);
    const porId = new Map((body.compras as { id: string }[]).map((c) => [c.id, c]));
    expect(porId.get(DIEGO)).toMatchObject({
      estado: EstadoCompra.CANCELADA,
      canceladaPor: "usuario",
      canceladaDesde: "CONFIRMADA",
      reembolso: { estado: "pendiente", monto: 30000 },
    });
    expect(porId.get(VALENTINA)).toMatchObject({
      estado: EstadoCompra.REEMBOLSADA,
      canceladaPor: "usuario",
      reembolso: { estado: "confirmado", monto: 60000 },
    });
    expect(
      body.resumenPorTipo.find((r: { tipoEntrada: { id: string } }) => r.tipoEntrada.id === INSCRIPCION),
    ).toMatchObject({
      disponibles: 1000,
      vendidas: 0,
    });
  });

  it("Lucía confirma el de Diego → 200 REEMBOLSADA; Compras del evento lo muestra y el cupo sigue en 1000", async () => {
    const app = nuevaApp();
    const respuesta = await reembolsar(app, DIEGO).send({ ignorado: true });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      id: DIEGO,
      comprador: { id: "usuario-diego", nombre: "Diego", apellido: "Fernández" },
      tipoEntrada: { id: INSCRIPCION, nombre: "Inscripción" },
      cantidad: 1,
      total: 30000,
      estado: EstadoCompra.REEMBOLSADA,
      venceEn: null,
      canceladaPor: "usuario",
      canceladaDesde: "CONFIRMADA",
      reembolso: { estado: "confirmado", monto: 30000 },
    });
    expect(JSON.stringify(respuesta.body)).not.toContain("MZDF1C01");
    const { body } = await comprasDelMaraton(app);
    expect((body.compras as { id: string; estado: string }[]).find((c) => c.id === DIEGO)?.estado).toBe(
      EstadoCompra.REEMBOLSADA,
    );
    expect(await inscripcion(app)).toBe(1000);

    const repetido = await reembolsar(app, DIEGO);
    expect(repetido.status).toBe(409);
    expect(repetido.body.error).toMatchObject(ya);
  });

  it("Valentina (ya reembolsada) → 409 «ya se confirmó»", async () => {
    const respuesta = await reembolsar(nuevaApp(), VALENTINA);
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toMatchObject(ya);
  });

  it("la vencida de Diego en el Festival → 409 «no tiene un reembolso pendiente»", async () => {
    const respuesta = await reembolsar(nuevaApp(), "compra-diego-festival-general");
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toMatchObject({
      codigo: "TRANSICION_INVALIDA",
      mensaje: "Esta compra no tiene un reembolso pendiente.",
    });
  });
});

describe("La reseña en las compras del comprador (feature 012, R6)", () => {
  const COMPRA_PENA = "compra-martin-pena-general";

  it("GET /compras/:id, GET /compras y GET /eventos/:id/mis-compras traen resenia y puedeReseniar", async () => {
    const app = nuevaApp();
    const deMartin = (ruta: string) => request(app).get(ruta).set("X-Usuario-Id", "usuario-martin");

    expect((await deMartin(`/api/compras/${COMPRA_PENA}`)).body).toMatchObject({
      resenia: null,
      puedeReseniar: true,
    });
    const filas = (await deMartin("/api/compras")).body as { id: string }[];
    expect(filas.find((fila) => fila.id === COMPRA_PENA)).toMatchObject({
      resenia: null,
      puedeReseniar: true,
    });
    for (const fila of filas) {
      expect(fila).toHaveProperty("resenia");
      expect(fila).toHaveProperty("puedeReseniar");
    }
    const delEvento = (await deMartin("/api/eventos/evento-pena-en-la-rueda/mis-compras")).body;
    expect(delEvento.confirmadas).toEqual([
      expect.objectContaining({ id: COMPRA_PENA, resenia: null, puedeReseniar: true }),
    ]);

    const alta = await request(app)
      .post("/api/eventos/evento-pena-en-la-rueda/resenias")
      .set("X-Usuario-Id", "usuario-martin")
      .send({ puntuacion: 4 });

    const despues = (await deMartin("/api/compras")).body as { id: string }[];
    expect(despues.find((fila) => fila.id === COMPRA_PENA)).toMatchObject({
      resenia: alta.body,
      puedeReseniar: false,
    });
    expect(
      (await deMartin("/api/eventos/evento-pena-en-la-rueda/mis-compras")).body.confirmadas[0],
    ).toMatchObject({
      resenia: alta.body,
      puedeReseniar: false,
    });
  });
});
