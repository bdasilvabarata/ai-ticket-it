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

describe("Mis compras: días restantes (US2)", () => {
  /** Una confirmada del Festival con esos días restantes y, si se da, otra hora o `realizado`. */
  const confirmada = (
    id: string,
    diasRestantes: number | null,
    evento: Partial<MiCompraVista["evento"]> = {},
  ): MiCompraVista => ({ ...festivalVip, id, diasRestantes, evento: { ...festivalVip.evento, ...evento } });
  const filaDe = async (id: string, compras: MiCompraVista[]) => {
    await abrirMisCompras([{ status: 200, json: compras }]);
    const todas = await filas();
    return todas[compras.findIndex((c) => c.id === id)]!;
  };

  it("una CONFIRMADA dice Confirmada y cuánto falta: Faltan 10 días, Mañana, Hoy · 21:00", async () => {
    const compras = [
      confirmada("en-diez", 10),
      confirmada("manana", 1),
      confirmada("hoy", 0, { fechaHoraLocal: "2026-12-01T21:00" }),
    ];
    await abrirMisCompras([{ status: 200, json: compras }]);
    const [enDiez, manana, hoy] = await filas();

    expect(within(enDiez!).getByLabelText("Estado: Confirmada")).toBeOnTheScreen();
    expect(within(enDiez!).getByText("Faltan 10 días")).toBeOnTheScreen();
    expect(within(manana!).getByLabelText("Estado: Confirmada")).toBeOnTheScreen();
    expect(within(manana!).getByText("Mañana")).toBeOnTheScreen();
    expect(within(hoy!).getByLabelText("Estado: Confirmada")).toBeOnTheScreen();
    expect(within(hoy!).getByText("Hoy · 21:00")).toBeOnTheScreen();
  });

  it("una CONFIRMADA de un evento realizado dice Confirmada y Evento realizado", async () => {
    const fila = await filaDe("realizada", [confirmada("realizada", null, { realizado: true })]);
    expect(within(fila).getByLabelText("Estado: Confirmada")).toBeOnTheScreen();
    expect(within(fila).getByText("Evento realizado")).toBeOnTheScreen();
  });

  it("una PENDIENTE o una CANCELADA no muestra días (FR-012)", async () => {
    const compras = [
      miCompra(compraPendiente, { id: "pendiente" }),
      miCompra(compraPendiente, {
        id: "cancelada",
        estado: EstadoCompra.CANCELADA,
        venceEn: null,
        venceEnLocal: null,
        canceladaPor: "sistema",
      }),
    ];
    await abrirMisCompras([{ status: 200, json: compras }]);
    await filas();
    expect(screen.queryByText(/^Faltan \d+ días$|^Mañana$|^Hoy · |^Evento realizado$/)).toBeNull();
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

describe("Mis compras: retomar el pago de una pendiente (US3)", () => {
  /** Una pendiente de Martín en el Festival: 1 VIP por $ 120.000, pagable hasta las 15:35. */
  const pendienteVip = miCompra(compraPendiente, {
    id: "compra-pendiente-vip",
    evento: festivalVip.evento,
    tipoEntrada: festivalVip.tipoEntrada,
    cantidad: 1,
    total: 120000,
  });
  const cancelada = (id: string, canceladaPor: "sistema" | "usuario"): MiCompraVista => ({
    ...pendienteVip,
    id,
    estado: EstadoCompra.CANCELADA,
    venceEn: null,
    venceEnLocal: null,
    canceladaPor,
  });
  const FILA_PENDIENTE = "Ver la compra de 1 VIP para Festival Sonidos del Sur";

  it("una PENDIENTE dice Pendiente, hasta qué hora se puede pagar y tiene Pagar, que abre Tu compra", async () => {
    const { falso } = await abrirMisCompras([{ status: 200, json: [pendienteVip] }], {
      "/compras/compra-pendiente-vip": ["colgar"],
    });
    const fila = await screen.findByRole("button", { name: FILA_PENDIENTE });
    expect(within(fila).getByLabelText("Estado: Pendiente")).toBeOnTheScreen();
    expect(within(fila).getByText("Podés pagar hasta las 15:35")).toBeOnTheScreen();

    const pagar = screen.getByRole("button", { name: "Pagar la compra de 1 VIP" });
    expect(within(pagar).getByText("Pagar")).toBeOnTheScreen();
    await fireEvent.press(pagar);

    expect(await screen.findByText("Cargando…")).toBeOnTheScreen();
    expect(falso.pedidosA("/compras/compra-pendiente-vip")).toHaveLength(1);
  });

  it("el botón de pago es hermano de la fila, no está adentro (enfocables por separado, R10)", async () => {
    await abrirMisCompras([{ status: 200, json: [pendienteVip] }]);
    const fila = await screen.findByRole("button", { name: FILA_PENDIENTE });
    expect(screen.getByLabelText("Pagar la compra de 1 VIP")).toBeOnTheScreen();
    expect(within(fila).queryByLabelText("Pagar la compra de 1 VIP")).toBeNull();
  });

  it("una pendiente gratis tiene Confirmar", async () => {
    await abrirMisCompras([{ status: 200, json: [miCompra(compraGratis, { id: "compra-gratis" })] }]);
    const confirmar = await screen.findByRole("button", { name: "Pagar la compra de 1 Carrera kids" });
    expect(within(confirmar).getByText("Confirmar")).toBeOnTheScreen();
  });

  it("una CANCELADA dice Venció sin pagarse o La cancelaste, sin Pagar, y la fila igual abre Tu compra", async () => {
    const { falso } = await abrirMisCompras(
      [{ status: 200, json: [cancelada("vencida", "sistema"), cancelada("por-mi", "usuario")] }],
      { "/compras/vencida": ["colgar"] },
    );
    const [vencida, porMi] = await filas();
    expect(within(vencida!).getByLabelText("Estado: Cancelada")).toBeOnTheScreen();
    expect(within(vencida!).getByText("Venció sin pagarse")).toBeOnTheScreen();
    expect(within(porMi!).getByLabelText("Estado: Cancelada")).toBeOnTheScreen();
    expect(within(porMi!).getByText("La cancelaste")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /^Pagar la compra de / })).toBeNull();

    await fireEvent.press(vencida!);
    expect(await screen.findByText("Cargando…")).toBeOnTheScreen();
    expect(falso.pedidosA("/compras/vencida")).toHaveLength(1);
  });

  it("UTILIZADA y REEMBOLSADA: sin aviso, sin días y sin acciones (FR-015)", async () => {
    const compras = [EstadoCompra.UTILIZADA, EstadoCompra.REEMBOLSADA].map((estado) => ({
      ...pendienteVip,
      id: `compra-${estado}`,
      estado,
      venceEn: null,
      venceEnLocal: null,
    }));
    await abrirMisCompras([{ status: 200, json: compras }]);
    await filas();
    expect(
      screen.queryByText(
        /^Faltan \d+ días$|^Mañana$|^Hoy · |^Evento realizado$|^Podés pagar|^Venció sin pagarse$|^La cancelaste$/,
      ),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /^Pagar la compra de / })).toBeNull();
  });
});
