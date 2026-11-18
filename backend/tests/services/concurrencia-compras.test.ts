import { EstadoCompra } from "@ai-ticket-it/shared";
import { describe, expect, it, vi } from "vitest";
import { AHORA, DIA, compra, evento, relojMovible, tipo } from "../helpers/eventos";
import { crearServicesDeEventos } from "../helpers/services-de-eventos";

// Mismo enfoque que concurrencia.test.ts (004): `Promise.allSettled` sobre los services reales; los
// repositorios devuelven promesas y cada `await` cede el turno, así que sin cerrojo las operaciones
// se intercalarían (research R11).

const MINUTO = 60 * 1000;

/** Un evento de Lucía con VIP guardado en 48 y una compra PENDIENTE de 2 VIP ya vencida. */
function armar() {
  const reloj = relojMovible();
  const servicios = crearServicesDeEventos({
    eventos: [
      evento({ id: "evento-a", tiposEntrada: [tipo({ id: "tipo-a-vip", nombre: "VIP", cupo: 48 })] }),
    ],
    compras: [
      compra("evento-a", "tipo-a-vip", EstadoCompra.PENDIENTE, { id: "compra-vencida", cantidad: 2 }),
    ],
    reloj,
  });
  reloj.avanzar(15 * MINUTO);
  return servicios;
}

const datosEvento = {
  nombre: "Nombre nuevo",
  descripcion: "Descripción nueva.",
  categoriaId: "categoria-musica",
  fechaHora: new Date(AHORA.getTime() + 2 * DIA),
  multimedia: [],
};

describe("Concurrencia: vencimiento y escrituras del mismo evento (feature 006)", () => {
  it("una edición del evento y el alta de un tipo simultáneas devuelven el cupo una sola vez", async () => {
    const { eventoService, tipoEntradaService, repositorioEventos, repositorioCompras } = armar();

    const resultados = await Promise.allSettled([
      eventoService.actualizar("evento-a", "usuario-lucia", datosEvento),
      tipoEntradaService.crear("evento-a", "usuario-lucia", {
        nombre: "Platea",
        descripcion: "",
        precio: 0,
        cupo: 10,
      }),
    ]);

    expect(resultados.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
    const guardado = await repositorioEventos.buscarPorId("evento-a");
    expect(guardado?.nombre).toBe("Nombre nuevo");
    expect(guardado?.tiposEntrada.map((t) => t.nombre)).toEqual(["VIP", "Platea"]);
    expect(guardado?.buscarTipoEntrada("tipo-a-vip")?.cupo).toBe(50);
    expect((await repositorioCompras.buscarPorId("compra-vencida"))?.fueVencida()).toBe(true);
    expect((await eventoService.obtener("evento-a")).tiposEntrada[0]?.cupo).toBe(50);
  });

  it("dos ediciones del tipo simultáneas: el cupo guardado es el último pedido, sin sumar la vencida dos veces", async () => {
    const { eventoService, tipoEntradaService, repositorioEventos } = armar();
    const datosVip = (cupo: number) => ({ nombre: "VIP", descripcion: "", precio: 1000, cupo });

    const resultados = await Promise.allSettled([
      eventoService.actualizar("evento-a", "usuario-lucia", datosEvento),
      tipoEntradaService.actualizar("evento-a", "tipo-a-vip", "usuario-lucia", datosVip(50)),
      tipoEntradaService.actualizar("evento-a", "tipo-a-vip", "usuario-lucia", datosVip(30)),
    ]);

    expect(resultados.map((r) => r.status)).toEqual(["fulfilled", "fulfilled", "fulfilled"]);
    expect((await repositorioEventos.buscarPorId("evento-a"))?.buscarTipoEntrada("tipo-a-vip")?.cupo).toBe(
      30,
    );
    expect((await eventoService.obtener("evento-a")).tiposEntrada[0]?.cupo).toBe(30);
  });
});

describe("Concurrencia: compras simultáneas (feature 006, SC-002)", () => {
  /** Un evento de Lucía con un único tipo VIP pago con ese cupo (y precio). */
  function armarCompras({ cupo = 10, precio = 1000 } = {}) {
    return crearServicesDeEventos({
      eventos: [
        evento({ id: "evento-a", tiposEntrada: [tipo({ id: "tipo-a-vip", nombre: "VIP", precio, cupo })] }),
        evento({ id: "evento-b", tiposEntrada: [tipo({ id: "tipo-b-general" })] }),
      ],
    });
  }

  const codigos = (resultados: PromiseSettledResult<unknown>[]) =>
    resultados.map((r) => (r.status === "fulfilled" ? "ok" : (r.reason as { codigo: string }).codigo));

  it("50 compras de 1 entrada de 50 personas sobre cupo 10 → 10 cumplidas, 40 CUPO_INSUFICIENTE y cupo 0", async () => {
    const { compraService, repositorioEventos, repositorioCompras } = armarCompras({ cupo: 10 });
    const guardar = repositorioEventos.guardar.bind(repositorioEventos);
    const cupos: number[] = [];
    vi.spyOn(repositorioEventos, "guardar").mockImplementation(async (guardado) => {
      cupos.push(guardado.buscarTipoEntrada("tipo-a-vip")?.cupo ?? 0);
      await guardar(guardado);
    });

    const resultados = await Promise.allSettled(
      Array.from({ length: 50 }, (_, i) =>
        compraService.crear("evento-a", `usuario-comprador-${i}`, {
          tipoEntradaId: "tipo-a-vip",
          cantidad: 1,
        }),
      ),
    );

    const resumen = codigos(resultados);
    expect(resumen.filter((c) => c === "ok")).toHaveLength(10);
    expect(resumen.filter((c) => c === "CUPO_INSUFICIENTE")).toHaveLength(40);
    expect((await repositorioEventos.buscarPorId("evento-a"))?.buscarTipoEntrada("tipo-a-vip")?.cupo).toBe(0);
    expect(cupos.every((cupo) => cupo >= 0)).toBe(true);
    expect(await repositorioCompras.listarPendientesPorEventos(["evento-a"])).toHaveLength(10);
  });

  it("dos compras simultáneas de la misma persona que juntas superan su tope (3 + 2) → una cumplida y otra TOPE_POR_PERSONA", async () => {
    const { compraService } = armarCompras();
    const resultados = await Promise.allSettled([
      compraService.crear("evento-a", "usuario-sofia", { tipoEntradaId: "tipo-a-vip", cantidad: 3 }),
      compraService.crear("evento-a", "usuario-sofia", { tipoEntradaId: "tipo-a-vip", cantidad: 2 }),
    ]);
    expect(codigos(resultados).toSorted()).toEqual(["TOPE_POR_PERSONA", "ok"]);
  });

  it("una compra sobre el evento A bloqueado no frena una sobre el evento B", async () => {
    const { compraService, cerrojo } = armarCompras();
    let liberar = () => {};
    const bloqueoDeA = cerrojo.ejecutar(
      "evento-a",
      () => new Promise<void>((resolver) => (liberar = resolver)),
    );
    const sobreA = compraService.crear("evento-a", "usuario-sofia", {
      tipoEntradaId: "tipo-a-vip",
      cantidad: 1,
    });
    let terminoA = false;
    void sobreA.then(() => (terminoA = true));

    await compraService.crear("evento-b", "usuario-sofia", { tipoEntradaId: "tipo-b-general", cantidad: 1 });
    expect(terminoA).toBe(false);

    liberar();
    await Promise.all([bloqueoDeA, sobreA]);
    expect(terminoA).toBe(true);
  });

  it("una compra y una edición que baja el cupo: una se evalúa sobre el resultado de la otra y el cupo nunca es negativo", async () => {
    const { compraService, tipoEntradaService, repositorioEventos } = armarCompras({ cupo: 5 });
    const resultados = await Promise.allSettled([
      compraService.crear("evento-a", "usuario-sofia", { tipoEntradaId: "tipo-a-vip", cantidad: 4 }),
      tipoEntradaService.actualizar("evento-a", "tipo-a-vip", "usuario-lucia", {
        nombre: "VIP",
        descripcion: "",
        precio: 1000,
        cupo: 2,
      }),
    ]);
    const [compraHecha, edicion] = codigos(resultados);
    const cupoFinal = (await repositorioEventos.buscarPorId("evento-a"))?.buscarTipoEntrada(
      "tipo-a-vip",
    )?.cupo;
    expect(edicion).toBe("ok");
    // Compra primero (5 → 1) y la edición deja 2; o edición primero (2) y la compra de 4 se rechaza.
    expect([
      ["ok", 2],
      ["CUPO_INSUFICIENTE", 2],
    ]).toContainEqual([compraHecha, cupoFinal]);
  });

  it("una compra y un cambio de precio simultáneos: el total es precio × cantidad con uno de los dos precios, nunca una mezcla", async () => {
    const { compraService, tipoEntradaService } = armarCompras({ precio: 1000 });
    const [compraHecha] = await Promise.all([
      compraService.crear("evento-a", "usuario-sofia", { tipoEntradaId: "tipo-a-vip", cantidad: 2 }),
      tipoEntradaService.actualizar("evento-a", "tipo-a-vip", "usuario-lucia", {
        nombre: "VIP",
        descripcion: "",
        precio: 3000,
        cupo: 10,
      }),
    ]);
    expect([2000, 6000]).toContain(compraHecha.total);
  });
});

describe("Concurrencia: pago de una compra (feature 006)", () => {
  /** Un evento de Lucía con VIP en 48 y una compra PENDIENTE de 2 VIP de Sofía, recién hecha. */
  function armarPago({ en = 5 * DIA } = {}) {
    const reloj = relojMovible();
    const servicios = crearServicesDeEventos({
      eventos: [
        evento({ id: "evento-a", en, tiposEntrada: [tipo({ id: "tipo-a-vip", nombre: "VIP", cupo: 48 })] }),
      ],
      compras: [
        compra("evento-a", "tipo-a-vip", EstadoCompra.PENDIENTE, {
          id: "compra-sofia",
          compradorId: "usuario-sofia",
          cantidad: 2,
        }),
      ],
      reloj,
    });
    return { ...servicios, reloj };
  }

  it("pago con el reloj exactamente en venceEn → COMPRA_VENCIDA y el cupo vuelve una sola vez", async () => {
    const { compraService, eventoService, repositorioEventos, repositorioCompras, reloj } = armarPago();
    reloj.avanzar(15 * MINUTO);

    const resultados = await Promise.allSettled([
      compraService.pagar("compra-sofia", "usuario-sofia"),
      compraService.pagar("compra-sofia", "usuario-sofia"),
    ]);

    expect(resultados.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    for (const r of resultados) {
      expect(r.status === "rejected" && r.reason).toMatchObject({ codigo: "COMPRA_VENCIDA" });
    }
    expect((await repositorioCompras.buscarPorId("compra-sofia"))?.fueVencida()).toBe(true);
    expect((await repositorioEventos.buscarPorId("evento-a"))?.buscarTipoEntrada("tipo-a-vip")?.cupo).toBe(
      50,
    );
    expect((await eventoService.obtener("evento-a")).tiposEntrada[0]?.cupo).toBe(50);
  });

  it("dos pagos simultáneos de la misma compra → uno cumplido, otro TRANSICION_INVALIDA y un solo CONFIRMADA (FR-013)", async () => {
    const { compraService, repositorioCompras } = armarPago();

    const resultados = await Promise.allSettled([
      compraService.pagar("compra-sofia", "usuario-sofia"),
      compraService.pagar("compra-sofia", "usuario-sofia"),
    ]);

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rechazado = resultados.find((r) => r.status === "rejected");
    expect(rechazado?.status === "rejected" && rechazado.reason).toMatchObject({
      codigo: "TRANSICION_INVALIDA",
    });
    const guardada = await repositorioCompras.buscarPorId("compra-sofia");
    expect(guardada?.historial.filter((c) => c.estado === EstadoCompra.CONFIRMADA)).toHaveLength(1);
  });

  it("pago con el evento ya empezado y la compra sin vencer → CONFIRMADA (R9)", async () => {
    const { compraService, reloj } = armarPago({ en: 5 * MINUTO });
    reloj.avanzar(10 * MINUTO);
    const vista = await compraService.pagar("compra-sofia", "usuario-sofia");
    expect(vista.estado).toBe(EstadoCompra.CONFIRMADA);
  });
});

describe("Concurrencia: uso de entradas (feature 008, SC-006)", () => {
  /** Un evento de Lucía que empieza en 2 h (ventana abierta) con una compra de Martín en `estado`. */
  function armarUso(estado: EstadoCompra) {
    return crearServicesDeEventos({
      eventos: [
        evento({ id: "evento-a", en: 2 * 60 * MINUTO, tiposEntrada: [tipo({ id: "tipo-a-general" })] }),
      ],
      compras: [compra("evento-a", "tipo-a-general", estado, { id: "compra-martin", cantidad: 2 })],
      reloj: relojMovible(),
    });
  }

  it("10 usos simultáneos de la misma entrada → uno cumplido, nueve «Esta entrada ya se utilizó.» y un solo cambio", async () => {
    const { entradaService, repositorioCompras } = armarUso(EstadoCompra.CONFIRMADA);
    const codigo = (await repositorioCompras.buscarPorId("compra-martin"))!.entradas[0]!.codigo;

    const resultados = await Promise.allSettled(
      Array.from({ length: 10 }, () => entradaService.registrarUso("evento-a", codigo, "usuario-lucia")),
    );

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of resultados.filter((r) => r.status === "rejected")) {
      expect((r as PromiseRejectedResult).reason).toMatchObject({
        codigo: "TRANSICION_INVALIDA",
        message: "Esta entrada ya se utilizó.",
      });
    }
    const guardada = (await repositorioCompras.buscarPorId("compra-martin"))!;
    expect(guardada.entradas[0]!.cambios).toHaveLength(1);
    expect(guardada.historial.filter((c) => c.estado === EstadoCompra.UTILIZADA)).toHaveLength(1);
  });

  it("usos simultáneos de dos entradas de la misma compra → las dos usadas y un único UTILIZADA en la compra", async () => {
    const { entradaService, repositorioCompras } = armarUso(EstadoCompra.CONFIRMADA);
    const [a, b] = (await repositorioCompras.buscarPorId("compra-martin"))!.entradas.map((e) => e.codigo);

    const resultados = await Promise.allSettled([
      entradaService.registrarUso("evento-a", a!, "usuario-lucia"),
      entradaService.registrarUso("evento-a", b!, "usuario-lucia"),
    ]);

    expect(resultados.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
    const guardada = (await repositorioCompras.buscarPorId("compra-martin"))!;
    expect(guardada.entradasUsadas).toBe(2);
    expect(guardada.historial.filter((c) => c.estado === EstadoCompra.UTILIZADA)).toHaveLength(1);
  });

  // Humo: hasta la 009 no existe cancelar una CONFIRMADA (la carrera real del caso borde); acá, sobre
  // una PENDIENTE, el uso y la cancelación toman el mismo cerrojo.
  it("un uso y una cancelación simultáneos sobre una PENDIENTE → la cancelación vale y el uso se rechaza", async () => {
    const { entradaService, compraService, repositorioCompras } = armarUso(EstadoCompra.PENDIENTE);
    const codigo = (await repositorioCompras.buscarPorId("compra-martin"))!.entradas[0]!.codigo;

    const [uso, cancelacion] = await Promise.allSettled([
      entradaService.registrarUso("evento-a", codigo, "usuario-lucia"),
      compraService.cancelar("compra-martin", "usuario-martin"),
    ]);

    expect(uso.status).toBe("rejected");
    expect((uso as PromiseRejectedResult).reason).toMatchObject({ codigo: "TRANSICION_INVALIDA" });
    expect(cancelacion.status).toBe("fulfilled");
    const guardada = (await repositorioCompras.buscarPorId("compra-martin"))!;
    expect(guardada.estado).toBe(EstadoCompra.CANCELADA);
    expect(guardada.historial).toHaveLength(2);
  });
});
