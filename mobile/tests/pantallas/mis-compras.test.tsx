import { EstadoCompra, type MiCompraVista } from "@ai-ticket-it/shared";
import { act, fireEvent, screen, waitFor, within } from "expo-router/testing-library";
import { router } from "expo-router";

import {
  compraCanceladaDesdeConfirmada,
  compraCancelada,
  compraCanceladaPorElComprador,
  compraConfirmada,
  compraGratis,
  compraGratisCanceladaDesdeConfirmada,
  compraPendiente,
  compraReembolsada,
  compraUtilizada,
  conRestantes,
  miCompra,
} from "../helpers/compras";
import {
  CATALOGO_INICIAL,
  catalogo,
  errorApi,
  festival,
  maratonCompleta,
  maratonEnCatalogo,
} from "../helpers/eventos";
import {
  porMetodo,
  porRuta,
  type FetchFalso,
  type FuncionRespuesta,
  type RespuestaFalsa,
} from "../helpers/fetch-falso";
import { espiarAlertas, tocarEnAlerta } from "../helpers/formulario";
import { esperarPestanas, irAPestana } from "../helpers/pestanas";
import { renderConDependencias } from "../helpers/render-con-dependencias";
import { diego, martin, todos } from "../helpers/usuarios";

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
    // `porRuta` elige la primera ruta en que termina la URL: las de `extra` (como
    // `/eventos/:id/compras`) van antes que `/compras`.
    respuestas: porRuta({
      "/usuarios/actual": [{ status: 200, json: martin }],
      "/usuarios": [{ status: 200, json: todos }],
      ...extra,
      [MIS_COMPRAS]: misCompras,
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

describe("Mis compras: la lista al día (US4)", () => {
  const MINUTO = 60_000;
  const EVENTO = "/eventos/evento-maraton-10k";
  const COMPRA = "/compras/compra-nueva";
  const FILA_MARATON = "Ver la compra de 2 Inscripción para Maratón Ciudad 10K";

  /** Los `GET /compras` de la lista (no los de una compra ni el alta en un evento). */
  const pedidosDeLaLista = (falso: FetchFalso) =>
    falso.pedidos.filter((pedido) => pedido.metodo === "GET" && pedido.url.endsWith("/api/compras"));
  const avanzar = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
  const cancelada = (canceladaPor: "sistema" | "usuario") =>
    miCompra(compraPendiente, {
      estado: EstadoCompra.CANCELADA,
      venceEn: null,
      venceEnLocal: null,
      canceladaPor,
    });

  /** Lo que pide el detalle de la Maratón desde Explorar (rutas que van antes de `/compras`). */
  const detalleDeLaMaraton = (misComprasDelEvento: Lista, otras: Record<string, Lista> = {}) => ({
    "/categorias": [{ status: 200, json: [] }] as Lista,
    [CATALOGO_INICIAL]: [{ status: 200, json: catalogo([maratonEnCatalogo]) }] as Lista,
    [`${EVENTO}/mis-compras`]: misComprasDelEvento,
    [EVENTO]: [{ status: 200, json: maratonCompleta }] as Lista,
    ...otras,
  });

  it("volver a la pestaña vuelve a pedir la lista; el primer foco no duplica el pedido del montaje (R8)", async () => {
    const { falso } = await abrirMisCompras([{ status: 200, json: [festivalVip] }]);
    await filas();
    expect(pedidosDeLaLista(falso)).toHaveLength(1);

    await irAPestana("Explorar");
    await irAPestana("Mis compras");

    await waitFor(() => expect(pedidosDeLaLista(falso)).toHaveLength(2));
  });

  it("con la lista abierta, al llegar la hora límite de una pendiente la vuelve a pedir y la muestra como dice el servidor (R9)", async () => {
    // La pendiente vence 2 minutos después del primer pedido; después el servidor la da por vencida.
    const { falso } = await abrirMisCompras([
      () => ({
        status: 200,
        json: [miCompra(compraPendiente, { venceEn: new Date(Date.now() + 2 * MINUTO).toISOString() })],
      }),
      { status: 200, json: [cancelada("sistema")] },
    ]);
    const fila = await screen.findByRole("button", { name: FILA_MARATON });
    expect(within(fila).getByLabelText("Estado: Pendiente")).toBeOnTheScreen();

    await avanzar(2 * MINUTO - 5000);
    expect(pedidosDeLaLista(falso)).toHaveLength(1);
    expect(screen.getByLabelText("Estado: Pendiente")).toBeOnTheScreen(); // la app no decide que venció

    await avanzar(10_000);

    expect(await screen.findByText("Venció sin pagarse")).toBeOnTheScreen();
    expect(pedidosDeLaLista(falso)).toHaveLength(2);
    expect(screen.getByLabelText("Estado: Cancelada")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /^Pagar la compra de / })).toBeNull();

    await avanzar(30 * MINUTO); // ya sin pendientes: nada más programado
    expect(pedidosDeLaLista(falso)).toHaveLength(2);
  });

  it("sin pendientes no programa ningún pedido", async () => {
    const { falso } = await abrirMisCompras([{ status: 200, json: [festivalVip] }]);
    await filas();

    await avanzar(30 * MINUTO);

    expect(pedidosDeLaLista(falso)).toHaveLength(1);
  });

  it("tras pagar desde Tu compra la lista se invalida y al volver refleja CONFIRMADA (FR-017)", async () => {
    const { falso } = await abrirMisCompras(
      [
        { status: 200, json: [miCompra(compraPendiente)] },
        { status: 200, json: [miCompra(compraConfirmada, { diasRestantes: 10 })] },
      ],
      {
        [`${COMPRA}/pago`]: [porMetodo({ POST: [{ status: 200, json: compraConfirmada }] })],
        [COMPRA]: [
          { status: 200, json: compraPendiente },
          { status: 200, json: compraConfirmada },
        ],
      },
    );
    await fireEvent.press(await screen.findByRole("button", { name: "Pagar la compra de 2 Inscripción" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Pagar" }));
    expect(await screen.findByText("¡Listo! Tu compra está confirmada.")).toBeOnTheScreen();

    await waitFor(() => expect(pedidosDeLaLista(falso)).toHaveLength(2)); // la invalidación, sin volver

    await act(() => router.back());
    const fila = await screen.findByRole("button", { name: FILA_MARATON });
    expect(within(fila).getByLabelText("Estado: Confirmada")).toBeOnTheScreen();
    expect(within(fila).getByText("Faltan 10 días")).toBeOnTheScreen();
  });

  it("tras comprar desde el detalle la lista se invalida y al volver a la pestaña aparece la compra (SC-005)", async () => {
    const { falso } = await abrirMisCompras(
      [
        { status: 200, json: [] },
        { status: 200, json: [miCompra(compraPendiente)] },
      ],
      detalleDeLaMaraton([{ status: 200, json: conRestantes({ "tipo-maraton-inscripcion": 4 }) }], {
        [`${EVENTO}/compras`]: [porMetodo({ POST: [{ status: 201, json: compraPendiente }] })],
        [COMPRA]: [{ status: 200, json: compraPendiente }],
      }),
    );
    expect(await screen.findByText("Todavía no compraste entradas")).toBeOnTheScreen();

    await irAPestana("Explorar");
    await fireEvent.press(await screen.findByRole("button", { name: /^Maratón Ciudad 10K, / }));
    await fireEvent.press(await screen.findByRole("button", { name: "Comprar Inscripción" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Una entrada más" }));
    await fireEvent.press(screen.getByRole("button", { name: "Confirmar compra" }));
    expect(await screen.findByRole("button", { name: "Pagar" })).toBeOnTheScreen();

    await waitFor(() => expect(pedidosDeLaLista(falso)).toHaveLength(2)); // la invalidación

    await act(() => router.navigate("/mis-compras"));
    const fila = await screen.findByRole("button", { name: FILA_MARATON });
    expect(within(fila).getByLabelText("Estado: Pendiente")).toBeOnTheScreen();
  });

  it("tras cancelar una pendiente desde el detalle la lista se invalida y al volver dice La cancelaste", async () => {
    const alertas = espiarAlertas();
    const { falso } = await abrirMisCompras(
      [
        { status: 200, json: [miCompra(compraPendiente)] },
        { status: 200, json: [cancelada("usuario")] },
      ],
      detalleDeLaMaraton(
        [
          { status: 200, json: { pendientes: [compraPendiente], confirmadas: [], restantesPorTipo: [] } },
          { status: 200, json: { pendientes: [], confirmadas: [], restantesPorTipo: [] } },
        ],
        {
          [`${COMPRA}/cancelacion`]: [
            porMetodo({
              POST: [{ status: 200, json: { ...compraPendiente, estado: EstadoCompra.CANCELADA } }],
            }),
          ],
        },
      ),
    );
    await filas();

    await irAPestana("Explorar");
    await fireEvent.press(await screen.findByRole("button", { name: /^Maratón Ciudad 10K, / }));
    await fireEvent.press(
      await screen.findByRole("button", { name: "Cancelar la compra de 2 entradas Inscripción" }),
    );
    await tocarEnAlerta(alertas, "¿Cancelar la compra de 2 entradas Inscripción?", "Cancelar compra");

    await waitFor(() => expect(pedidosDeLaLista(falso)).toHaveLength(2)); // la invalidación

    await act(() => router.navigate("/mis-compras"));
    expect(await screen.findByText("La cancelaste")).toBeOnTheScreen();
  });

  it("al cambiar de usuario no se ve, ni mientras carga, ninguna compra del anterior (FR-019, SC-006)", async () => {
    const delUsuario = (init: RequestInit | undefined) =>
      (init?.headers as Record<string, string> | undefined)?.["X-Usuario-Id"];
    const { falso } = await abrirMisCompras(
      [(_url, init) => (delUsuario(init) === diego.id ? "colgar" : { status: 200, json: [festivalVip] })],
      {
        "/usuarios/actual": [
          (_url, init) => ({ status: 200, json: delUsuario(init) === diego.id ? diego : martin }),
        ],
      },
    );
    await filas();

    await irAPestana("Perfil");
    await fireEvent.press(await screen.findByRole("button", { name: "Cambiar usuario" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Elegir a Diego Fernández" }));
    expect(await screen.findByText("Diego Fernández")).toBeOnTheScreen();
    await irAPestana("Mis compras");

    expect(await screen.findByText("Cargando…")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /^Ver la compra de / })).toBeNull();
    expect(screen.queryByText("Festival Sonidos del Sur")).toBeNull();
    expect(pedidosDeLaLista(falso).at(-1)?.encabezados["X-Usuario-Id"]).toBe(diego.id);
  });
});

describe("Mis compras: una UTILIZADA (feature 008, FR-012e)", () => {
  it("la fila dice cuántas entradas se usaron junto a la etiqueta", async () => {
    await abrirMisCompras([{ status: 200, json: [miCompra(compraUtilizada)] }]);
    expect(await screen.findByText("1 de 2 entradas usadas")).toBeOnTheScreen();
    expect(screen.getByLabelText("Estado: Utilizada")).toBeOnTheScreen();
  });
});

describe("Mis compras: canceladas y reembolsadas (feature 009, US2, FR-019)", () => {
  it("cada fila dice su reembolso junto a la etiqueta, distinto de «Venció sin pagarse» y «La cancelaste»", async () => {
    const porUsuario = { canceladaPor: "usuario" as const };
    await abrirMisCompras([
      {
        status: 200,
        json: [
          miCompra(compraCanceladaDesdeConfirmada, { ...porUsuario, id: "con-reembolso" }),
          miCompra(compraGratisCanceladaDesdeConfirmada, { ...porUsuario, id: "gratis" }),
          miCompra(compraReembolsada, { ...porUsuario, id: "reembolsada" }),
          miCompra(compraCanceladaPorElComprador, { ...porUsuario, id: "pendiente-cancelada" }),
          miCompra(compraCancelada, { canceladaPor: "sistema", id: "vencida" }),
        ],
      },
    ]);

    const [conReembolso, gratis, reembolsada, pendienteCancelada, vencida] = await filas();
    const esperado: [typeof conReembolso, string, string][] = [
      [conReembolso, "Cancelada", "El organizador tiene que confirmar el reembolso de $ 60.000"],
      [gratis, "Cancelada", "Cancelaste esta compra"],
      [reembolsada, "Reembolsada", "Te devolvimos $ 60.000"],
      [pendienteCancelada, "Cancelada", "La cancelaste"],
      [vencida, "Cancelada", "Venció sin pagarse"],
    ];
    for (const [fila, estado, aviso] of esperado) {
      expect(within(fila!).getByLabelText(`Estado: ${estado}`)).toBeOnTheScreen();
      expect(within(fila!).getByText(aviso)).toBeOnTheScreen();
    }
  });
});

describe("Mis compras: al volver de cancelar una confirmada (feature 009, US5-2)", () => {
  const COMPRA = "/compras/compra-nueva";
  const FILA_MARATON = "Ver la compra de 2 Inscripción para Maratón Ciudad 10K";

  it("al volver de Tu compra la lista se vuelve a pedir y la fila dice Cancelada con el reembolso pendiente", async () => {
    const alertas = espiarAlertas();
    const cancelada = miCompra(compraCanceladaDesdeConfirmada, { canceladaPor: "usuario" });
    let cancelo = false;
    const { falso } = await abrirMisCompras(
      [
        () => ({
          status: 200,
          json: [cancelo ? cancelada : miCompra(compraConfirmada, { diasRestantes: 10 })],
        }),
      ],
      {
        [`${COMPRA}/cancelacion`]: [
          porMetodo({
            POST: [
              () => {
                cancelo = true;
                return { status: 200, json: compraCanceladaDesdeConfirmada };
              },
            ],
          }),
        ],
        [COMPRA]: [
          () => ({ status: 200, json: cancelo ? compraCanceladaDesdeConfirmada : compraConfirmada }),
        ],
      },
    );
    await fireEvent.press(await screen.findByRole("button", { name: FILA_MARATON }));
    await fireEvent.press(await screen.findByRole("button", { name: "Cancelar compra" }));
    await tocarEnAlerta(alertas, "¿Cancelar la compra de 2 entradas Inscripción?", "Cancelar compra");
    expect(
      await screen.findByText(
        "Cancelaste esta compra. El organizador tiene que confirmar el reembolso de $ 60.000",
      ),
    ).toBeOnTheScreen();
    const pedidosAntes = falso.pedidos.filter(
      (p) => p.metodo === "GET" && p.url.endsWith("/api/compras"),
    ).length;

    await act(() => router.back());

    const fila = await screen.findByRole("button", { name: FILA_MARATON });
    await waitFor(() => expect(within(fila).getByLabelText("Estado: Cancelada")).toBeOnTheScreen());
    expect(
      within(fila).getByText("El organizador tiene que confirmar el reembolso de $ 60.000"),
    ).toBeOnTheScreen();
    expect(within(fila).queryByText("Faltan 10 días")).toBeNull();
    await waitFor(() =>
      expect(
        falso.pedidos.filter((p) => p.metodo === "GET" && p.url.endsWith("/api/compras")).length,
      ).toBeGreaterThan(pedidosAntes),
    );
  });
});

describe("Mis compras: no se cancela desde la lista (feature 009, US3, FR-017)", () => {
  it("ninguna fila tiene Cancelar: ni la pendiente, ni la confirmada, ni la utilizada", async () => {
    await abrirMisCompras([
      {
        status: 200,
        json: [maratonPendiente, festivalVip, miCompra(compraUtilizada, { id: "utilizada" })],
      },
    ]);

    expect(await filas()).toHaveLength(3);
    expect(screen.getByRole("button", { name: /^Pagar/ })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /Cancelar/ })).toBeNull();
  });
});
