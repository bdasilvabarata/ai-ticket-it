import { EstadoCompra, type MiCompraVista } from "@ai-ticket-it/shared";
import { act, fireEvent, screen, within } from "expo-router/testing-library";

import { compraConfirmada, compraGratis, compraPendiente, miCompra } from "../helpers/compras";
import { errorApi, festival } from "../helpers/eventos";
import { porRuta, type FuncionRespuesta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { esperarPestanas, irAPestana } from "../helpers/pestanas";
import { renderConDependencias } from "../helpers/render-con-dependencias";
import { martin, todos } from "../helpers/usuarios";

type Lista = ReadonlyArray<RespuestaFalsa | FuncionRespuesta>;

const MIS_COMPRAS = "/compras";

/** La confirmada de Martín en el Festival: 2 VIP por $ 240.000. */
const festivalVip: MiCompraVista = miCompra(compraConfirmada, {
  id: "compra-festival-vip",
  evento: {
    id: festival.id,
    nombre: festival.nombre,
    fechaHora: festival.fechaHora,
    fechaHoraLocal: festival.fechaHoraLocal,
    realizado: false,
  },
  tipoEntrada: { id: "tipo-festival-vip", nombre: "VIP" },
  cantidad: 2,
  total: 240000,
});
/** La pendiente de la Maratón: 2 inscripciones por $ 60.000. */
const maratonPendiente = miCompra(compraPendiente);
/** Una Carrera kids gratis de la Maratón, confirmada. */
const maratonGratis = miCompra(compraGratis, {
  id: "compra-gratis",
  estado: EstadoCompra.CONFIRMADA,
  venceEn: null,
  venceEnLocal: null,
});

/** Martín abre la pestaña "Mis compras" con esas respuestas de `GET /compras`. */
async function abrirMisCompras(misCompras: Lista, extra: Record<string, Lista> = {}) {
  const resultado = await renderConDependencias({
    usuarioRecordado: martin.id,
    respuestas: porRuta({
      "/usuarios/actual": [{ status: 200, json: martin }],
      "/usuarios": [{ status: 200, json: todos }],
      [MIS_COMPRAS]: misCompras,
      ...extra,
    }),
  });
  await esperarPestanas();
  await irAPestana("Mis compras");
  return resultado;
}

const filas = () => screen.findAllByRole("button", { name: /^Ver la compra de / });

describe("Mis compras (US1)", () => {
  it("al abrir la pestaña pide GET /compras en nombre del usuario actual", async () => {
    const { falso } = await abrirMisCompras([{ status: 200, json: [festivalVip] }]);
    await filas();
    const pedidos = falso.pedidosA(MIS_COMPRAS);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]).toMatchObject({ metodo: "GET" });
    expect(pedidos[0].encabezados["X-Usuario-Id"]).toBe(martin.id);
  });

  it("una fila por compra, en el orden de la respuesta, con evento, fecha, resumen y estado", async () => {
    await abrirMisCompras([{ status: 200, json: [maratonPendiente, festivalVip, maratonGratis] }]);

    const [pendiente, vip, gratis] = await filas();
    expect((await filas()).map((fila) => fila.props.accessibilityLabel)).toEqual([
      "Ver la compra de 2 Inscripción para Maratón Ciudad 10K",
      "Ver la compra de 2 VIP para Festival Sonidos del Sur",
      "Ver la compra de 1 Carrera kids para Maratón Ciudad 10K",
    ]);
    expect(within(vip).getByText("Festival Sonidos del Sur")).toBeOnTheScreen();
    expect(within(vip).getByText("jue 10 dic 2026 · 14:00")).toBeOnTheScreen();
    expect(within(vip).getByText("VIP · 2 entradas · $ 240.000")).toBeOnTheScreen();
    expect(within(vip).getByLabelText("Estado: Confirmada")).toBeOnTheScreen();
    expect(within(pendiente).getByText("Maratón Ciudad 10K")).toBeOnTheScreen();
    expect(within(pendiente).getByText("vie 25 dic 2026 · 08:00")).toBeOnTheScreen();
    expect(within(pendiente).getByText("Inscripción · 2 entradas · $ 60.000")).toBeOnTheScreen();
    expect(within(pendiente).getByLabelText("Estado: Pendiente")).toBeOnTheScreen();
    expect(within(gratis).getByText("Carrera kids · 1 entrada · Gratis")).toBeOnTheScreen();
  });

  it("los cinco estados se ven con el texto de su etiqueta", async () => {
    const estados = [
      EstadoCompra.PENDIENTE,
      EstadoCompra.CONFIRMADA,
      EstadoCompra.CANCELADA,
      EstadoCompra.UTILIZADA,
      EstadoCompra.REEMBOLSADA,
    ];
    const compras = estados.map((estado, i) =>
      miCompra(compraPendiente, {
        id: `compra-${i}`,
        estado,
        venceEn: estado === EstadoCompra.PENDIENTE ? compraPendiente.venceEn : null,
        venceEnLocal: estado === EstadoCompra.PENDIENTE ? compraPendiente.venceEnLocal : null,
        canceladaPor: estado === EstadoCompra.CANCELADA ? "sistema" : null,
      }),
    );
    await abrirMisCompras([{ status: 200, json: compras }]);

    await filas();
    for (const texto of ["Pendiente", "Confirmada", "Cancelada", "Utilizada", "Reembolsada"]) {
      expect(screen.getByText(texto)).toBeOnTheScreen();
    }
  });

  it("tocar una fila abre Tu compra de esa compra", async () => {
    const { falso } = await abrirMisCompras([{ status: 200, json: [festivalVip] }], {
      "/compras/compra-festival-vip": ["colgar"],
    });

    await fireEvent.press(
      await screen.findByRole("button", { name: "Ver la compra de 2 VIP para Festival Sonidos del Sur" }),
    );

    expect(await screen.findByText("Cargando…")).toBeOnTheScreen();
    expect(falso.pedidosA("/compras/compra-festival-vip")).toHaveLength(1);
  });

  it("una compra de un evento realizado sigue en la lista", async () => {
    const realizada = miCompra(compraConfirmada, {
      evento: { ...compraConfirmada.evento, realizado: true },
    });
    await abrirMisCompras([{ status: 200, json: [realizada] }]);
    expect(await screen.findByText("Maratón Ciudad 10K")).toBeOnTheScreen();
  });
});

describe("Mis compras: los cuatro estados (FR-016)", () => {
  it("muestra cargando mientras espera al servidor", async () => {
    await abrirMisCompras(["colgar"]);
    expect(await screen.findByText("Cargando…")).toBeOnTheScreen();
  });

  it("ante un error muestra el mensaje del servidor y Reintentar, que vuelve a pedir la lista", async () => {
    const { falso } = await abrirMisCompras([
      { status: 500, json: errorApi("ERROR_INTERNO", "Falló el servidor.") },
      { status: 200, json: [festivalVip] },
    ]);
    expect(await screen.findByText("Falló el servidor.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Festival Sonidos del Sur")).toBeOnTheScreen();
    expect(falso.pedidosA(MIS_COMPRAS)).toHaveLength(2);
  });

  it("sin servidor muestra el aviso y la secuencia vuelve a pedir la lista", async () => {
    const { falso } = await abrirMisCompras(["rechazar", { status: 200, json: [festivalVip] }]);
    expect(await screen.findByText("Servidor no disponible")).toBeOnTheScreen();

    await act(() => jest.advanceTimersByTimeAsync(1000));

    expect(await screen.findByText("Festival Sonidos del Sur")).toBeOnTheScreen();
    expect(falso.pedidosA(MIS_COMPRAS)).toHaveLength(2);
  });

  it("sin compras: Todavía no compraste entradas e Ir a Explorar, que abre Explorar", async () => {
    await abrirMisCompras([{ status: 200, json: [] }]);
    expect(await screen.findByText("Todavía no compraste entradas")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Ir a Explorar" }));

    expect(await screen.findByText("Todavía no hay eventos próximos.")).toBeOnTheScreen();
  });
});
