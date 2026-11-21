import { EstadoCompra } from "@ai-ticket-it/shared";
import { describe, expect, it, vi } from "vitest";
import { AHORA, DIA, compra, evento, relojMovible, tipo } from "../helpers/eventos";
import { crearServicesDeEventos } from "../helpers/services-de-eventos";
import type { Cerrojo } from "../../src/services/cerrojo-por-clave";

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

const rechazo = (r: PromiseSettledResult<unknown>) => (r as PromiseRejectedResult).reason as Error;

/** Toma el cerrojo de `evento-a` y no lo suelta hasta `liberar()`; resuelve cuando ya lo tiene. */
async function bloquear(cerrojo: Cerrojo) {
  let liberar = () => {};
  let bloqueo: Promise<void> = Promise.resolve();
  await new Promise<void>((tomado) => {
    bloqueo = cerrojo.ejecutar("evento-a", () => {
      tomado();
      return new Promise<void>((resolver) => (liberar = resolver));
    });
  });
  return { liberar: () => liberar(), bloqueo };
}

/** Deja correr las lecturas previas al cerrojo (los repositorios en memoria resuelven en microtareas). */
const dejarCorrer = () => new Promise<void>((resolver) => setTimeout(resolver, 0));

/**
 * Las dos operaciones esperando a la vez el cerrojo del evento, encoladas en el orden dado, y
 * devueltas siempre como [a, b]. Lanzarlas con un `Promise.allSettled` desnudo deja ganar siempre
 * a la misma (`cancelar` lee la compra antes de tomar el cerrojo), así que se las encola con el
 * cerrojo tomado para recorrer los dos desenlaces.
 */
async function enCarrera<A, B>(
  cerrojo: Cerrojo,
  a: () => Promise<A>,
  b: () => Promise<B>,
  primeroA: boolean,
): Promise<[PromiseSettledResult<A>, PromiseSettledResult<B>]> {
  const { liberar, bloqueo } = await bloquear(cerrojo);
  let pa: Promise<A> | undefined;
  let pb: Promise<B> | undefined;
  if (primeroA) pa = a();
  else pb = b();
  await dejarCorrer();
  if (primeroA) pb = b();
  else pa = a();
  await dejarCorrer();
  liberar();
  await bloqueo;
  return Promise.allSettled([pa!, pb!]);
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
    expect(guardada.entradas[0]!.uso).toMatchObject({ usuarioId: "usuario-lucia" });
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

describe("Concurrencia: cancelación y reembolso (feature 009, US4, SC-005)", () => {
  const INICIO = 2 * 60 * MINUTO;

  /**
   * Un evento de Lucía que empieza en 2 h (ventana de uso abierta y sin empezar) con General en
   * `cupo` y una compra CONFIRMADA de Martín de `cantidad` entradas.
   */
  function armarCancelacion({ cupo = 7, cantidad = 3 }: { cupo?: number; cantidad?: number } = {}) {
    const reloj = relojMovible();
    const servicios = crearServicesDeEventos({
      eventos: [evento({ id: "evento-a", en: INICIO, tiposEntrada: [tipo({ id: "tipo-a-general", cupo })] })],
      compras: [
        compra("evento-a", "tipo-a-general", EstadoCompra.CONFIRMADA, { id: "compra-martin", cantidad }),
      ],
      reloj,
    });
    const cupoGuardado = async () =>
      (await servicios.repositorioEventos.buscarPorId("evento-a"))?.buscarTipoEntrada("tipo-a-general")?.cupo;
    return { ...servicios, reloj, cupoGuardado };
  }

  it("uso ‖ cancelación de la misma CONFIRMADA, 20 veces alternando el orden → siempre gana exactamente uno, con historial y cupo coherentes", async () => {
    const ganadores = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      const { entradaService, compraService, repositorioCompras, cerrojo, cupoGuardado } = armarCancelacion();
      const codigo = (await repositorioCompras.buscarPorId("compra-martin"))!.entradas[0]!.codigo;

      const [uso, cancelacion] = await enCarrera(
        cerrojo,
        () => entradaService.registrarUso("evento-a", codigo, "usuario-lucia"),
        () => compraService.cancelar("compra-martin", "usuario-martin"),
        i % 2 === 0,
      );

      expect([uso.status, cancelacion.status].toSorted()).toEqual(["fulfilled", "rejected"]);
      const guardada = (await repositorioCompras.buscarPorId("compra-martin"))!;
      const usadas = guardada.entradas.filter((e) => e.usada);
      const canceladas = guardada.entradas.filter((e) => e.cancelada);
      expect(usadas.length === 0 || canceladas.length === 0).toBe(true);

      if (uso.status === "fulfilled") {
        ganadores.add("uso");
        expect(rechazo(cancelacion)).toMatchObject({
          codigo: "TRANSICION_INVALIDA",
          message: "Ya se usó una entrada de esta compra: no se puede cancelar.",
        });
        expect(guardada.estado).toBe(EstadoCompra.UTILIZADA);
        expect(guardada.historial.some((c) => c.estado === EstadoCompra.CANCELADA)).toBe(false);
        expect(await cupoGuardado()).toBe(7);
      } else {
        ganadores.add("cancelacion");
        expect(rechazo(uso)).toMatchObject({
          codigo: "TRANSICION_INVALIDA",
          message: "La compra de esta entrada está cancelada.",
        });
        expect(guardada.estado).toBe(EstadoCompra.CANCELADA);
        expect(guardada.historial).toHaveLength(3);
        expect(guardada.historial.filter((c) => c.estado === EstadoCompra.CANCELADA)).toHaveLength(1);
        expect(usadas).toHaveLength(0);
        expect(await cupoGuardado()).toBe(10);
      }
    }
    // Con el orden alternado gana cada una según quién llega primero al cerrojo.
    expect(ganadores).toEqual(new Set(["uso", "cancelacion"]));
  });

  it("10 cancelaciones simultáneas de la misma CONFIRMADA → una cumplida, nueve «La compra ya está cancelada.» y el cupo devuelto una vez", async () => {
    const { compraService, repositorioCompras, cupoGuardado } = armarCancelacion();

    const resultados = await Promise.allSettled(
      Array.from({ length: 10 }, () => compraService.cancelar("compra-martin", "usuario-martin")),
    );

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of resultados.filter((r) => r.status === "rejected")) {
      expect(rechazo(r)).toMatchObject({
        codigo: "TRANSICION_INVALIDA",
        message: "La compra ya está cancelada.",
      });
    }
    const guardada = (await repositorioCompras.buscarPorId("compra-martin"))!;
    expect(guardada.historial.filter((c) => c.estado === EstadoCompra.CANCELADA)).toHaveLength(1);
    expect(await cupoGuardado()).toBe(10);
  });

  it("10 confirmarReembolso simultáneos → uno cumplido, nueve «El reembolso de esta compra ya se confirmó.» y un solo REEMBOLSADA", async () => {
    const { compraService, repositorioCompras, cupoGuardado } = armarCancelacion();
    await compraService.cancelar("compra-martin", "usuario-martin");

    const resultados = await Promise.allSettled(
      Array.from({ length: 10 }, () => compraService.confirmarReembolso("compra-martin", "usuario-lucia")),
    );

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of resultados.filter((r) => r.status === "rejected")) {
      expect(rechazo(r)).toMatchObject({
        codigo: "TRANSICION_INVALIDA",
        message: "El reembolso de esta compra ya se confirmó.",
      });
    }
    const guardada = (await repositorioCompras.buscarPorId("compra-martin"))!;
    expect(guardada.estado).toBe(EstadoCompra.REEMBOLSADA);
    expect(guardada.historial.filter((c) => c.estado === EstadoCompra.REEMBOLSADA)).toHaveLength(1);
    expect(await cupoGuardado()).toBe(10);
  });

  it("cancelación ‖ compra nueva del mismo tipo con el cupo agotado → cupo final = inicial − comprado + devuelto, nunca negativo ni de más", async () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 10; i += 1) {
      const { compraService, repositorioEventos, cerrojo, cupoGuardado } = armarCancelacion({
        cupo: 0,
        cantidad: 2,
      });
      const guardar = repositorioEventos.guardar.bind(repositorioEventos);
      const cupos: number[] = [];
      vi.spyOn(repositorioEventos, "guardar").mockImplementation(async (guardado) => {
        cupos.push(guardado.buscarTipoEntrada("tipo-a-general")?.cupo ?? -1);
        await guardar(guardado);
      });

      const [cancelacion, compraNueva] = await enCarrera(
        cerrojo,
        () => compraService.cancelar("compra-martin", "usuario-martin"),
        () =>
          compraService.crear("evento-a", "usuario-sofia", { tipoEntradaId: "tipo-a-general", cantidad: 2 }),
        i % 2 === 0,
      );

      expect(cancelacion.status).toBe("fulfilled");
      if (compraNueva.status === "rejected") {
        expect(rechazo(compraNueva)).toMatchObject({ codigo: "CUPO_INSUFICIENTE" });
      }
      vistos.add(compraNueva.status);
      const comprado = compraNueva.status === "fulfilled" ? 2 : 0;
      expect(await cupoGuardado()).toBe(0 - comprado + 2);
      expect(cupos.every((cupo) => cupo >= 0 && cupo <= 2)).toBe(true);
    }
    // Si la cancelación llega primero, la compra nueva entra; si no, se rechaza por cupo.
    expect(vistos).toEqual(new Set(["fulfilled", "rejected"]));
  });

  it("el evento empieza entre la lectura y la cancelación → EVENTO_REALIZADO (el reloj se lee dentro del cerrojo, US4-4)", async () => {
    const { compraService, repositorioCompras, cerrojo, reloj, cupoGuardado } = armarCancelacion();
    expect((await compraService.obtener("compra-martin", "usuario-martin")).cancelable).toBe(true);

    // La cancelación espera el cerrojo; mientras, el evento empieza.
    const { liberar, bloqueo } = await bloquear(cerrojo);
    const cancelacion = compraService.cancelar("compra-martin", "usuario-martin");
    await dejarCorrer();
    reloj.avanzar(INICIO);
    liberar();
    await bloqueo;

    await expect(cancelacion).rejects.toMatchObject({
      codigo: "EVENTO_REALIZADO",
      message: "El evento ya empezó: ya no se puede cancelar la compra.",
    });
    expect((await repositorioCompras.buscarPorId("compra-martin"))!.estado).toBe(EstadoCompra.CONFIRMADA);
    expect(await cupoGuardado()).toBe(7);
  });
});

describe("Concurrencia: chat de la compra (feature 011, US4, SC-005)", () => {
  const INICIO = 2 * 60 * MINUTO;

  /**
   * Un evento de Lucía que empieza en 2 h (ventana de uso abierta) con General en 7 y una compra de
   * Martín de 3 entradas en `estado`.
   */
  function armarChat(estado: EstadoCompra) {
    const reloj = relojMovible();
    const servicios = crearServicesDeEventos({
      eventos: [
        evento({ id: "evento-a", en: INICIO, tiposEntrada: [tipo({ id: "tipo-a-general", cupo: 7 })] }),
      ],
      compras: [compra("evento-a", "tipo-a-general", estado, { id: "compra-martin", cantidad: 3 })],
      reloj,
    });
    const guardada = async () => (await servicios.repositorioCompras.buscarPorId("compra-martin"))!;
    const cupoGuardado = async () =>
      (await servicios.repositorioEventos.buscarPorId("evento-a"))?.buscarTipoEntrada("tipo-a-general")?.cupo;
    return { ...servicios, reloj, guardada, cupoGuardado };
  }

  it("N mensajes simultáneos de las dos partes → se guardan los N, en el orden en que entraron al cerrojo", async () => {
    const { compraService, reloj, guardada } = armarChat(EstadoCompra.CONFIRMADA);
    const N = 20;
    const autores = Array.from({ length: N }, (_, i) => (i % 2 === 0 ? "usuario-martin" : "usuario-lucia"));

    const pedidos = autores.map((autor, i) => {
      const pedido = compraService.enviarMensaje("compra-martin", autor, { texto: `Mensaje ${i}` });
      reloj.avanzar(1000);
      return pedido;
    });
    const vistas = await Promise.all(pedidos);

    const mensajes = (await guardada()).mensajes;
    expect(mensajes.map((m) => m.texto)).toEqual(autores.map((_, i) => `Mensaje ${i}`));
    expect(mensajes.map((m) => m.autorId)).toEqual(autores);
    expect(vistas.map((v) => v.numero).toSorted((a, b) => a - b)).toEqual(
      Array.from({ length: N }, (_, i) => i + 1),
    );
    // La regla `mensajes-en-orden`: el constructor de Compra la habría rechazado al guardar.
    const fechas = mensajes.map((m) => m.enviadoEn.getTime());
    expect(fechas).toEqual(fechas.toSorted((a, b) => a - b));
  });

  type Caso = {
    nombre: string;
    estado: EstadoCompra;
    operacion: (s: ReturnType<typeof armarChat>) => Promise<unknown>;
    antes?: (s: ReturnType<typeof armarChat>) => Promise<unknown>;
    estadoFinal: EstadoCompra;
    cupoFinal: number;
  };

  const casos: Caso[] = [
    {
      nombre: "pagar una PENDIENTE",
      estado: EstadoCompra.PENDIENTE,
      operacion: (s) => s.compraService.pagar("compra-martin", "usuario-martin"),
      estadoFinal: EstadoCompra.CONFIRMADA,
      cupoFinal: 7,
    },
    {
      nombre: "cancelar una CONFIRMADA",
      estado: EstadoCompra.CONFIRMADA,
      operacion: (s) => s.compraService.cancelar("compra-martin", "usuario-martin"),
      estadoFinal: EstadoCompra.CANCELADA,
      cupoFinal: 10,
    },
    {
      nombre: "registrar el uso de una entrada",
      estado: EstadoCompra.CONFIRMADA,
      operacion: async (s) =>
        s.entradaService.registrarUso("evento-a", (await s.guardada()).entradas[0]!.codigo, "usuario-lucia"),
      estadoFinal: EstadoCompra.UTILIZADA,
      cupoFinal: 7,
    },
    {
      nombre: "confirmar el reembolso",
      estado: EstadoCompra.CONFIRMADA,
      antes: (s) => s.compraService.cancelar("compra-martin", "usuario-martin"),
      operacion: (s) => s.compraService.confirmarReembolso("compra-martin", "usuario-lucia"),
      estadoFinal: EstadoCompra.REEMBOLSADA,
      cupoFinal: 10,
    },
  ];

  for (const caso of casos) {
    for (const mensajePrimero of [true, false]) {
      it(`mensaje ‖ ${caso.nombre} (${mensajePrimero ? "el mensaje" : "la otra"} llega primero) → se conservan los dos efectos`, async () => {
        const servicios = armarChat(caso.estado);
        await caso.antes?.(servicios);
        const historialAntes = (await servicios.guardada()).historial.length;

        const [mensaje, operacion] = await enCarrera(
          servicios.cerrojo,
          () => servicios.compraService.enviarMensaje("compra-martin", "usuario-martin", { texto: "Hola" }),
          () => caso.operacion(servicios),
          mensajePrimero,
        );

        expect(mensaje.status).toBe("fulfilled");
        expect(operacion.status).toBe("fulfilled");
        const final = await servicios.guardada();
        expect(final.estado).toBe(caso.estadoFinal);
        expect(final.historial).toHaveLength(historialAntes + 1);
        expect(final.mensajes.map((m) => m.texto)).toEqual(["Hola"]);
        expect(await servicios.cupoGuardado()).toBe(caso.cupoFinal);
      });
    }
  }
});
