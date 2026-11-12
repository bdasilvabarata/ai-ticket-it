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
