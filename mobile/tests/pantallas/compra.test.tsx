import type { QueryClient } from "@tanstack/react-query";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import { router } from "expo-router";

import { claves } from "../../src/consultas/claves";
import {
  CODIGOS_DE_LA_MARATON,
  compraCancelada,
  compraCanceladaDesdeConfirmada,
  compraCanceladaPorElComprador,
  compraConfirmada,
  compraConfirmadaGratis,
  compraGratisCanceladaDesdeConfirmada,
  compraGratis,
  compraPendiente,
  compraReembolsada,
  compraUtilizada,
  conRestantes,
} from "../helpers/compras";
import { CATALOGO_INICIAL, catalogo, errorApi, maratonCompleta, maratonEnCatalogo } from "../helpers/eventos";
import { porMetodo, porRuta, type FuncionRespuesta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { espiarAlertas, tituloDelHeader, tocarEnAlerta } from "../helpers/formulario";
import { esperarPestanas, irAPestana } from "../helpers/pestanas";
import { renderConDependencias } from "../helpers/render-con-dependencias";
import { diego, lucia, martin, todos } from "../helpers/usuarios";

type Lista = ReadonlyArray<RespuestaFalsa | FuncionRespuesta>;

const EVENTO = "/eventos/evento-maraton-10k";
const COMPRA = "/compras/compra-nueva";
const PAGO = `${COMPRA}/pago`;
const CANCELACION = `${COMPRA}/cancelacion`;

interface Opciones {
  compra?: Lista;
  pago?: Lista;
  cancelacion?: Lista;
}

function respuestas({
  compra = [{ status: 200, json: compraPendiente }],
  pago = [{ status: 200, json: compraConfirmada }],
  cancelacion = [{ status: 200, json: compraCanceladaPorElComprador }],
}: Opciones) {
  return porRuta({
    "/usuarios/actual": [{ status: 200, json: martin }],
    "/usuarios": [{ status: 200, json: todos }],
    "/categorias": [{ status: 200, json: [] }],
    [CATALOGO_INICIAL]: [{ status: 200, json: catalogo([maratonEnCatalogo]) }],
    [EVENTO]: [{ status: 200, json: maratonCompleta }],
    [`${EVENTO}/mis-compras`]: [{ status: 200, json: conRestantes({ "tipo-maraton-inscripcion": 4 }) }],
    [`${EVENTO}/compras`]: [{ status: 201, json: compraPendiente }],
    [PAGO]: [porMetodo({ POST: pago })],
    [CANCELACION]: [porMetodo({ POST: cancelacion })],
    [COMPRA]: compra,
  });
}

/** Martín abre "Tu compra" de `compra-nueva` desde Explorar. */
async function abrirCompra(opciones: Opciones = {}) {
  const resultado = await renderConDependencias({
    usuarioRecordado: martin.id,
    respuestas: respuestas(opciones),
  });
  await esperarPestanas();
  await act(() => router.push({ pathname: "/compras/[compraId]", params: { compraId: "compra-nueva" } }));
  return resultado;
}

describe("Tu compra (US2)", () => {
  it("PENDIENTE: estado, resumen, hasta cuándo se puede pagar y Pagar", async () => {
    await abrirCompra();

    expect(await screen.findByLabelText("Estado: Pendiente")).toBeOnTheScreen();
    expect(tituloDelHeader()).toBe("Tu compra");
    expect(screen.getByRole("header", { name: "Maratón Ciudad 10K" })).toBeOnTheScreen();
    expect(screen.getByText("vie 25 dic 2026 · 08:00")).toBeOnTheScreen();
    expect(screen.getByText("Inscripción")).toBeOnTheScreen();
    expect(screen.getByText("2 entradas")).toBeOnTheScreen();
    expect(screen.getByText("Total: $ 60.000")).toBeOnTheScreen();
    expect(screen.getByText("Podés pagar hasta las 15:35")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Pagar" })).toBeOnTheScreen();
  });

  it("gratis: Total: Gratis y Confirmar, que en curso dice Confirmando…", async () => {
    await abrirCompra({ compra: [{ status: 200, json: compraGratis }], pago: ["colgar"] });

    expect(await screen.findByText("Total: Gratis")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Pagar" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByRole("button", { name: "Confirmando…" })).toBeDisabled();
  });

  it("mientras paga dice Pagando… deshabilitado y un doble toque manda un solo pedido", async () => {
    const resultado = await abrirCompra({ pago: ["colgar"] });

    const pagar = await screen.findByRole("button", { name: "Pagar" });
    await fireEvent.press(pagar);
    await fireEvent.press(pagar);

    const pagando = await screen.findByRole("button", { name: "Pagando…" });
    expect(pagando).toBeDisabled();
    await fireEvent.press(pagando);
    const pagos = resultado.falso.pedidosA(PAGO);
    expect(pagos).toHaveLength(1);
    expect(pagos[0]?.metodo).toBe("POST");
    expect(pagos[0]?.cuerpo).toBeUndefined();
    expect(pagos[0]?.encabezados["X-Usuario-Id"]).toBe(martin.id);
  });

  it("con el pago aceptado: Confirmada, el aviso, Volver al evento e Ir a Explorar", async () => {
    const resultado = await abrirCompra({
      compra: [
        { status: 200, json: compraPendiente },
        { status: 200, json: compraConfirmada },
      ],
    });

    await fireEvent.press(await screen.findByRole("button", { name: "Pagar" }));

    expect(await screen.findByLabelText("Estado: Confirmada")).toBeOnTheScreen();
    expect(screen.getByText("¡Listo! Tu compra está confirmada.")).toBeOnTheScreen();
    expect(screen.getByText("Total: $ 60.000")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Pagar" })).toBeNull();
    expect(screen.queryByText("Podés pagar hasta las 15:35")).toBeNull();
    expect(screen.getByRole("button", { name: "Volver al evento" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Ir a Explorar" }));
    await waitFor(() => expect(resultado.getPathname()).toBe("/"));
  });

  it("CANCELADA (vencida): el aviso y Volver al evento, sin Pagar", async () => {
    await abrirCompra({ compra: [{ status: 200, json: compraCancelada }] });

    expect(await screen.findByLabelText("Estado: Cancelada")).toBeOnTheScreen();
    expect(
      screen.getByText("Esta compra venció: sus entradas volvieron a estar disponibles."),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Volver al evento" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Pagar" })).toBeNull();
  });

  it("CANCELADA por el comprador: Cancelaste esta compra y Volver al evento, sin Pagar", async () => {
    await abrirCompra({ compra: [{ status: 200, json: compraCanceladaPorElComprador }] });

    expect(await screen.findByLabelText("Estado: Cancelada")).toBeOnTheScreen();
    expect(
      screen.getByText("Cancelaste esta compra: sus entradas volvieron a estar disponibles."),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Volver al evento" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Pagar" })).toBeNull();
  });

  it("409 COMPRA_VENCIDA al pagar: la compra se vuelve a pedir y se ve cancelada", async () => {
    const resultado = await abrirCompra({
      compra: [
        { status: 200, json: compraPendiente },
        { status: 200, json: compraCancelada },
      ],
      pago: [
        {
          status: 409,
          json: errorApi("COMPRA_VENCIDA", "La compra venció: pasaron 15 minutos sin pagarla."),
        },
      ],
    });

    await fireEvent.press(await screen.findByRole("button", { name: "Pagar" }));

    expect(
      await screen.findByText("Esta compra venció: sus entradas volvieron a estar disponibles."),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText("Estado: Cancelada")).toBeOnTheScreen();
    expect(resultado.falso.pedidosA(COMPRA).length).toBeGreaterThanOrEqual(2);
  });

  it("403 al leer: No tenés permiso para ver esta compra., sin acciones", async () => {
    await abrirCompra({
      compra: [
        {
          status: 403,
          json: errorApi("SIN_PERMISO", "Solo quien hizo la compra puede verla o pagarla."),
        },
      ],
    });

    expect(await screen.findByText("No tenés permiso para ver esta compra.")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Pagar" })).toBeNull();
  });

  it("404 al leer: No encontramos esta compra. e Ir a Explorar", async () => {
    const resultado = await abrirCompra({
      compra: [{ status: 404, json: errorApi("COMPRA_NO_ENCONTRADA", "No existe la compra.") }],
    });

    expect(await screen.findByText("No encontramos esta compra.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Ir a Explorar" }));
    await waitFor(() => expect(resultado.getPathname()).toBe("/"));
  });

  it("mientras carga muestra Cargando…", async () => {
    await abrirCompra({ compra: ["colgar"] });
    expect(await screen.findByText("Cargando…")).toBeOnTheScreen();
  });

  it("ante un error, el mensaje del servidor y Reintentar", async () => {
    await abrirCompra({
      compra: [
        { status: 500, json: errorApi("ERROR_INTERNO", "Falló el servidor.") },
        { status: 200, json: compraPendiente },
      ],
    });

    expect(await screen.findByText("Falló el servidor.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("button", { name: "Pagar" })).toBeOnTheScreen();
  });

  it("recorrido completo desde el detalle en 5 toques: Comprar → + → Confirmar compra → Pagar → Volver al evento (SC-001)", async () => {
    const resultado = await renderConDependencias({
      usuarioRecordado: martin.id,
      respuestas: respuestas({
        compra: [
          { status: 200, json: compraPendiente },
          { status: 200, json: compraConfirmada },
        ],
      }),
    });
    await esperarPestanas();
    await fireEvent.press(await screen.findByRole("button", { name: /^Maratón Ciudad 10K, / }));

    await fireEvent.press(await screen.findByRole("button", { name: "Comprar Inscripción" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Una entrada más" }));
    await fireEvent.press(screen.getByRole("button", { name: "Confirmar compra" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Pagar" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Volver al evento" }));

    await waitFor(() => expect(resultado.getPathname()).toBe("/explorar/evento-maraton-10k"));
  });

  it("abierta desde Mis compras, Volver al evento lleva al detalle del evento y no a la lista", async () => {
    const resultado = await renderConDependencias({
      usuarioRecordado: martin.id,
      respuestas: respuestas({ compra: [{ status: 200, json: compraConfirmada }] }),
    });
    await esperarPestanas();
    await irAPestana("Mis compras");
    await act(() => router.push({ pathname: "/compras/[compraId]", params: { compraId: "compra-nueva" } }));

    await fireEvent.press(await screen.findByRole("button", { name: "Volver al evento" }));

    await waitFor(() => expect(resultado.getPathname()).toBe("/explorar/evento-maraton-10k"));
  });
});

describe("Cancelar desde Tu compra", () => {
  const TITULO = "¿Cancelar la compra de 2 entradas Inscripción?";

  it("PENDIENTE: Cancelar pide confirmación; al confirmar manda un POST en nombre de Martín y se ve cancelada", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirCompra({
      compra: [
        { status: 200, json: compraPendiente },
        { status: 200, json: compraCanceladaPorElComprador },
      ],
    });

    await fireEvent.press(await screen.findByRole("button", { name: "Cancelar compra" }));
    expect(resultado.falso.pedidosA(CANCELACION)).toHaveLength(0);
    await tocarEnAlerta(alertas, TITULO, "Cancelar compra");

    expect(
      await screen.findByText("Cancelaste esta compra: sus entradas volvieron a estar disponibles."),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Pagar" })).toBeNull();
    const pedidos = resultado.falso.pedidosA(CANCELACION);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]?.metodo).toBe("POST");
    expect(pedidos[0]?.encabezados["X-Usuario-Id"]).toBe(martin.id);
  });

  it("Volver en la confirmación no cancela nada", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirCompra();

    await fireEvent.press(await screen.findByRole("button", { name: "Cancelar compra" }));
    await tocarEnAlerta(alertas, TITULO, "Volver");

    expect(resultado.falso.pedidosA(CANCELACION)).toHaveLength(0);
    expect(screen.getByLabelText("Estado: Pendiente")).toBeOnTheScreen();
  });

  it("sin servidor al cancelar: el aviso y la compra sigue pendiente", async () => {
    const alertas = espiarAlertas();
    await abrirCompra({ cancelacion: ["rechazar"] });

    await fireEvent.press(await screen.findByRole("button", { name: "Cancelar compra" }));
    await tocarEnAlerta(alertas, TITULO, "Cancelar compra");

    expect(await screen.findByText("No se pudo cancelar. Probá de nuevo.")).toBeOnTheScreen();
    expect(screen.getByLabelText("Estado: Pendiente")).toBeOnTheScreen();
  });
});

const SIN_SERVIDOR = "No se pudo pagar. Probá de nuevo.";

/**
 * Un servidor cuya compra está pendiente hasta que la confirma el pago número `pagoQueConfirma`, y
 * confirmada desde entonces; cada pago responde lo que diga `pagos` (en orden).
 */
function confirmadaConElPago(pagoQueConfirma: number, pagos: RespuestaFalsa[]): Opciones {
  let recibidos = 0;
  return {
    compra: [
      () => ({ status: 200, json: recibidos >= pagoQueConfirma ? compraConfirmada : compraPendiente }),
    ],
    pago: [
      () => {
        recibidos += 1;
        return pagos[Math.min(recibidos, pagos.length) - 1] ?? "rechazar";
      },
    ],
  };
}

describe("Tu compra con conexión inestable (US4)", () => {
  it("sin servidor al pagar: el aviso arriba de Pagar, que sigue disponible, Pendiente y un solo POST", async () => {
    const resultado = await abrirCompra({ pago: ["rechazar"] });

    await fireEvent.press(await screen.findByRole("button", { name: "Pagar" }));

    expect(await screen.findByText(SIN_SERVIDOR)).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(70_000));
    expect(resultado.falso.pedidosA(PAGO)).toHaveLength(1);
    expect(screen.getByText(SIN_SERVIDOR)).toBeOnTheScreen();
    expect(screen.getByLabelText("Estado: Pendiente")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Pagar" })).toBeEnabled();
  });

  it("pago aceptado con la respuesta perdida: la compra se vuelve a pedir y se ve la confirmación sin error", async () => {
    await abrirCompra(confirmadaConElPago(1, ["rechazar"]));

    await fireEvent.press(await screen.findByRole("button", { name: "Pagar" }));

    expect(await screen.findByLabelText("Estado: Confirmada")).toBeOnTheScreen();
    expect(screen.getByText("¡Listo! Tu compra está confirmada.")).toBeOnTheScreen();
    expect(screen.queryByText(SIN_SERVIDOR)).toBeNull();
  });

  it("reintento que recibe 409 TRANSICION_INVALIDA con la compra ya confirmada: la confirmación sin error (FR-021)", async () => {
    // El primer pago se cae; cuando llega el reintento a mano la compra ya está confirmada (el
    // primero terminó llegando) y el servidor responde 409.
    const resultado = await abrirCompra(
      confirmadaConElPago(2, [
        "rechazar",
        { status: 409, json: errorApi("TRANSICION_INVALIDA", "La compra no está pendiente de pago.") },
      ]),
    );

    await fireEvent.press(await screen.findByRole("button", { name: "Pagar" }));
    expect(await screen.findByText(SIN_SERVIDOR)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Pagar" }));

    expect(await screen.findByLabelText("Estado: Confirmada")).toBeOnTheScreen();
    expect(screen.getByText("¡Listo! Tu compra está confirmada.")).toBeOnTheScreen();
    expect(screen.queryByText(SIN_SERVIDOR)).toBeNull();
    expect(screen.queryByText("La compra no está pendiente de pago.")).toBeNull();
    expect(resultado.falso.pedidosA(PAGO)).toHaveLength(2);
  });

  it("cambiar de usuario desde Perfil con la pantalla abierta: No tenés permiso para ver esta compra.", async () => {
    const resultado = await abrirCompra({
      compra: [
        (_url, init) =>
          (init?.headers as Record<string, string> | undefined)?.["X-Usuario-Id"] === diego.id
            ? {
                status: 403,
                json: errorApi("SIN_PERMISO", "Solo quien hizo la compra puede verla o pagarla."),
              }
            : { status: 200, json: compraPendiente },
      ],
    });
    expect(await screen.findByRole("button", { name: "Pagar" })).toBeOnTheScreen();

    await act(() => router.push("/seleccionar-usuario"));
    await fireEvent.press(await screen.findByRole("button", { name: "Elegir a Diego Fernández" }));

    await waitFor(() => expect(resultado.getPathname()).toBe("/compras/compra-nueva"));
    expect(await screen.findByText("No tenés permiso para ver esta compra.")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Pagar" })).toBeNull();
  });
});

describe("Tu compra: tus entradas (feature 008, FR-012b, R14)", () => {
  it("CONFIRMADA: Tus entradas con una fila por entrada, su código en grupos y su estado", async () => {
    await abrirCompra({ compra: [{ status: 200, json: compraConfirmada }] });

    expect(await screen.findByRole("header", { name: "Tus entradas" })).toBeOnTheScreen();
    expect(screen.getByText("7K3M-Q9TB")).toBeOnTheScreen();
    expect(screen.getByText("4HXP-2RVA")).toBeOnTheScreen();
    expect(screen.getByLabelText("Entrada 1, código 7 K 3 M Q 9 T B, Confirmada")).toBeOnTheScreen();
    expect(screen.getByLabelText("Entrada 2, código 4 H X P 2 R V A, Confirmada")).toBeOnTheScreen();
  });

  it.each([
    ["PENDIENTE", compraPendiente],
    ["CANCELADA", compraCancelada],
  ])("%s: ningún código", async (_estado, compra) => {
    await abrirCompra({ compra: [{ status: 200, json: compra }] });
    await screen.findByText("Total: $ 60.000");
    expect(screen.queryByText("Tus entradas")).toBeNull();
    expect(screen.queryByText("7K3M-Q9TB")).toBeNull();
  });

  it("UTILIZADA: sus entradas con su estado, cuántas se usaron y lo de una pagada, sin acciones nuevas", async () => {
    await abrirCompra({ compra: [{ status: 200, json: compraUtilizada }] });

    expect(await screen.findByText("1 de 2 entradas usadas")).toBeOnTheScreen();
    expect(screen.getByLabelText("Entrada 1, código 7 K 3 M Q 9 T B, Utilizada")).toBeOnTheScreen();
    expect(screen.getByLabelText("Entrada 2, código 4 H X P 2 R V A, Confirmada")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Volver al evento" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Ir a Explorar" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /Pagar|Cancelar/ })).toBeNull();
  });
});

describe("Cancelar una compra confirmada desde Tu compra (feature 009, US1)", () => {
  const TITULO = "¿Cancelar la compra de 2 entradas Inscripción?";
  const MENSAJE =
    "Se cancelan tus 2 entradas. El organizador tiene que confirmar el reembolso de $ 60.000. No se puede deshacer.";
  const AVISO = "Cancelaste esta compra. El organizador tiene que confirmar el reembolso de $ 60.000";
  const confirmadaYDespues = (despues = compraCanceladaDesdeConfirmada): Opciones => ({
    compra: [
      { status: 200, json: compraConfirmada },
      { status: 200, json: despues },
    ],
    cancelacion: [{ status: 200, json: despues }],
  });

  it("CONFIRMADA cancelable: la confirmación, Tus entradas y Cancelar compra, junto a Volver al evento e Ir a Explorar", async () => {
    await abrirCompra({ compra: [{ status: 200, json: compraConfirmada }] });

    expect(await screen.findByText("¡Listo! Tu compra está confirmada.")).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Tus entradas" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Cancelar compra" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Volver al evento" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Ir a Explorar" })).toBeOnTheScreen();
  });

  it("Cancelar compra pide confirmación con el monto; Volver no manda nada", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirCompra(confirmadaYDespues());

    await fireEvent.press(await screen.findByRole("button", { name: "Cancelar compra" }));

    const [llamada] = alertas.mock.calls.filter(([titulo]) => titulo === TITULO);
    expect(llamada?.[1]).toBe(MENSAJE);
    expect(llamada?.[2]).toEqual([
      expect.objectContaining({ text: "Volver", style: "cancel" }),
      expect.objectContaining({ text: "Cancelar compra", style: "destructive" }),
    ]);
    await tocarEnAlerta(alertas, TITULO, "Volver");
    expect(resultado.falso.pedidosA(CANCELACION)).toHaveLength(0);
    expect(screen.getByLabelText("Estado: Confirmada")).toBeOnTheScreen();
  });

  it("al confirmar, un POST sin cuerpo en nombre de Martín y se ve Cancelada con el reembolso pendiente, sin entradas", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirCompra(confirmadaYDespues());

    await fireEvent.press(await screen.findByRole("button", { name: "Cancelar compra" }));
    await tocarEnAlerta(alertas, TITULO, "Cancelar compra");

    expect(await screen.findByText(AVISO)).toBeOnTheScreen();
    expect(screen.getByText(AVISO).props.accessibilityLiveRegion).toBe("polite");
    expect(screen.getByLabelText("Estado: Cancelada")).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "Tus entradas" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancelar compra" })).toBeNull();
    const pedidos = resultado.falso.pedidosA(CANCELACION);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]?.metodo).toBe("POST");
    expect(pedidos[0]?.cuerpo).toBeUndefined();
    expect(pedidos[0]?.encabezados["X-Usuario-Id"]).toBe(martin.id);
  });

  it("una gratis: la confirmación sin monto", async () => {
    const alertas = espiarAlertas();
    await abrirCompra({
      compra: [{ status: 200, json: compraConfirmadaGratis }],
      cancelacion: [{ status: 200, json: compraGratisCanceladaDesdeConfirmada }],
    });

    await fireEvent.press(await screen.findByRole("button", { name: "Cancelar compra" }));

    const [llamada] = alertas.mock.calls.filter(
      ([titulo]) => titulo === "¿Cancelar la compra de 1 entrada Carrera kids?",
    );
    expect(llamada?.[1]).toBe("Se cancela tu entrada y vuelve a estar disponible. No se puede deshacer.");
  });

  it("mientras va el pedido dice Cancelando… y otra confirmación no manda otro pedido", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirCompra({
      compra: [{ status: 200, json: compraConfirmada }],
      cancelacion: ["colgar"],
    });

    await fireEvent.press(await screen.findByRole("button", { name: "Cancelar compra" }));
    await tocarEnAlerta(alertas, TITULO, "Cancelar compra");
    await tocarEnAlerta(alertas, TITULO, "Cancelar compra");

    const cancelando = await screen.findByRole("button", { name: "Cancelando…" });
    expect(cancelando).toBeBusy();
    await fireEvent.press(cancelando);
    expect(resultado.falso.pedidosA(CANCELACION)).toHaveLength(1);
  });

  it("un 409 muestra el mensaje del servidor y vuelve a pedir la compra", async () => {
    const alertas = espiarAlertas();
    const mensaje = "El evento ya empezó: ya no se puede cancelar la compra.";
    const resultado = await abrirCompra({
      compra: [
        { status: 200, json: compraConfirmada },
        {
          status: 200,
          json: { ...compraConfirmada, cancelable: false, motivoNoCancelable: "evento-empezado" },
        },
      ],
      cancelacion: [{ status: 409, json: errorApi("EVENTO_REALIZADO", mensaje) }],
    });

    await fireEvent.press(await screen.findByRole("button", { name: "Cancelar compra" }));
    await tocarEnAlerta(alertas, TITULO, "Cancelar compra");

    expect(await screen.findByText(mensaje)).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Cancelar compra" })).toBeNull());
    expect(resultado.falso.pedidosA(COMPRA).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText("Estado: Confirmada")).toBeOnTheScreen();
  });

  it("sin servidor: No se pudo cancelar. Probá de nuevo. y sigue Confirmada", async () => {
    const alertas = espiarAlertas();
    await abrirCompra({ compra: [{ status: 200, json: compraConfirmada }], cancelacion: ["rechazar"] });

    await fireEvent.press(await screen.findByRole("button", { name: "Cancelar compra" }));
    await tocarEnAlerta(alertas, TITULO, "Cancelar compra");

    expect(await screen.findByText("No se pudo cancelar. Probá de nuevo.")).toBeOnTheScreen();
    expect(screen.getByLabelText("Estado: Confirmada")).toBeOnTheScreen();
  });
});

describe("Cancelar una confirmada: lo que se refresca después (feature 009, US5, FR-021, FR-022, R10)", () => {
  const TITULO = "¿Cancelar la compra de 2 entradas Inscripción?";
  const AVISO = "Cancelaste esta compra. El organizador tiene que confirmar el reembolso de $ 60.000";
  const EVENTO_ID = "evento-maraton-10k";
  const CODIGO = CODIGOS_DE_LA_MARATON[0];

  /**
   * Siembra consultas que la pantalla no tiene montadas (así quedan invalidadas sin volver a pedirse):
   * las de Lucía como organizadora y las del comprador que no están a la vista.
   */
  function sembrar(queryClient: QueryClient) {
    const sembradas = [
      claves.comprasDelEvento(lucia.id, EVENTO_ID),
      claves.entradaDelEvento(lucia.id, EVENTO_ID, CODIGO),
      claves.evento(lucia.id, EVENTO_ID),
      claves.misComprasDelEvento(martin.id, EVENTO_ID),
      claves.misCompras(martin.id),
      claves.catalogo({ texto: "maraton", categoriaId: null, orden: "fecha", sentido: "asc" }),
    ];
    for (const clave of sembradas) queryClient.setQueryData(clave, { sembrada: true });
    return sembradas;
  }

  async function cancelarDesdeTuCompra(opciones: Opciones) {
    const alertas = espiarAlertas();
    const resultado = await abrirCompra(opciones);
    const sembradas = sembrar(resultado.deps.queryClient);
    await fireEvent.press(await screen.findByRole("button", { name: "Cancelar compra" }));
    await tocarEnAlerta(alertas, TITULO, "Cancelar compra");
    return { resultado, sembradas };
  }

  const invalidada = (queryClient: QueryClient, clave: readonly unknown[]) =>
    queryClient.getQueryState(clave)?.isInvalidated;

  it("con éxito invalida lo de la 006 y, por prefijo, Compras del evento y la entrada buscada por Lucía", async () => {
    const { resultado, sembradas } = await cancelarDesdeTuCompra({
      compra: [
        { status: 200, json: compraConfirmada },
        { status: 200, json: compraCanceladaDesdeConfirmada },
      ],
      cancelacion: [{ status: 200, json: compraCanceladaDesdeConfirmada }],
    });

    expect(await screen.findByText(AVISO)).toBeOnTheScreen();
    for (const clave of sembradas) {
      await waitFor(() => expect(invalidada(resultado.deps.queryClient, clave)).toBe(true));
    }
  });

  it("con éxito escribe la respuesta en la compra: se ve cancelada aunque la relectura no llegue", async () => {
    const { resultado } = await cancelarDesdeTuCompra({
      compra: [{ status: 200, json: compraConfirmada }, "colgar"],
      cancelacion: [{ status: 200, json: compraCanceladaDesdeConfirmada }],
    });

    expect(await screen.findByText(AVISO)).toBeOnTheScreen();
    expect(screen.getByLabelText("Estado: Cancelada")).toBeOnTheScreen();
    expect(resultado.deps.queryClient.getQueryData(claves.compra(martin.id, "compra-nueva"))).toEqual(
      compraCanceladaDesdeConfirmada,
    );
  });

  it("con error también invalida Compras del evento y la entrada de Lucía", async () => {
    const { resultado } = await cancelarDesdeTuCompra({
      compra: [{ status: 200, json: compraConfirmada }],
      cancelacion: ["rechazar"],
    });

    expect(await screen.findByText("No se pudo cancelar. Probá de nuevo.")).toBeOnTheScreen();
    const queryClient = resultado.deps.queryClient;
    expect(invalidada(queryClient, claves.comprasDelEvento(lucia.id, EVENTO_ID))).toBe(true);
    expect(invalidada(queryClient, claves.entradaDelEvento(lucia.id, EVENTO_ID, CODIGO))).toBe(true);
  });

  it("respuesta perdida: la relectura muestra la compra cancelada de verdad y la cancelación no se reintenta sola", async () => {
    // El servidor aplica la cancelación, pero la respuesta no llega.
    let cancelada = false;
    const { resultado } = await cancelarDesdeTuCompra({
      compra: [() => ({ status: 200, json: cancelada ? compraCanceladaDesdeConfirmada : compraConfirmada })],
      cancelacion: [
        () => {
          cancelada = true;
          return "rechazar";
        },
      ],
    });

    expect(await screen.findByText(AVISO)).toBeOnTheScreen();
    expect(screen.getByLabelText("Estado: Cancelada")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Cancelar compra" })).toBeNull();
    await act(() => jest.advanceTimersByTimeAsync(70_000));
    expect(resultado.falso.pedidosA(CANCELACION)).toHaveLength(1);
  });
});

describe("Tu compra de una REEMBOLSADA (feature 009, US2)", () => {
  it("la etiqueta Reembolsada con «Te devolvimos $ 60.000», sin entradas ni botones de pago o cancelación", async () => {
    await abrirCompra({ compra: [{ status: 200, json: compraReembolsada }] });

    expect(await screen.findByLabelText("Estado: Reembolsada")).toBeOnTheScreen();
    expect(screen.getByText("Te devolvimos $ 60.000")).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "Tus entradas" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Pagar|^Confirmar|^Cancelar/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Volver al evento" })).toBeOnTheScreen();
  });
});

describe("Tu compra: por qué ya no se puede cancelar (feature 009, US3, FR-017, SC-007)", () => {
  const TITULO = "¿Cancelar la compra de 2 entradas Inscripción?";
  const empezada: typeof compraConfirmada = {
    ...compraConfirmada,
    cancelable: false,
    motivoNoCancelable: "evento-empezado",
  };

  it("CONFIRMADA de un evento empezado: «El evento ya empezó» en lugar de Cancelar compra", async () => {
    await abrirCompra({ compra: [{ status: 200, json: empezada }] });

    expect(await screen.findByText("El evento ya empezó")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Cancelar compra" })).toBeNull();
    expect(screen.getByRole("header", { name: "Tus entradas" })).toBeOnTheScreen();
  });

  it("UTILIZADA: «Ya usaste una entrada», con Tus entradas y cuántas se usaron", async () => {
    await abrirCompra({ compra: [{ status: 200, json: compraUtilizada }] });

    expect(await screen.findByText("Ya usaste una entrada")).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Tus entradas" })).toBeOnTheScreen();
    expect(screen.getByText("1 de 2 entradas usadas")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Cancelar compra" })).toBeNull();
  });

  it("la app no mira la fecha: una CONFIRMADA cancelable de un evento pasado sigue con el botón", async () => {
    const pasada: typeof compraConfirmada = {
      ...compraConfirmada,
      evento: {
        ...compraConfirmada.evento,
        fechaHora: "2020-01-01T12:00:00.000Z",
        fechaHoraLocal: "2020-01-01T09:00",
        realizado: true,
      },
    };
    await abrirCompra({ compra: [{ status: 200, json: pasada }] });

    expect(await screen.findByRole("button", { name: "Cancelar compra" })).toBeOnTheScreen();
    expect(screen.queryByText("El evento ya empezó")).toBeNull();
  });

  it("tras un 409 EVENTO_REALIZADO, la compra releída muestra el motivo en lugar del botón", async () => {
    const alertas = espiarAlertas();
    const mensaje = "El evento ya empezó: ya no se puede cancelar la compra.";
    await abrirCompra({
      compra: [
        { status: 200, json: compraConfirmada },
        { status: 200, json: empezada },
      ],
      cancelacion: [{ status: 409, json: errorApi("EVENTO_REALIZADO", mensaje) }],
    });

    await fireEvent.press(await screen.findByRole("button", { name: "Cancelar compra" }));
    await tocarEnAlerta(alertas, TITULO, "Cancelar compra");

    expect(await screen.findByText("El evento ya empezó")).toBeOnTheScreen();
    expect(screen.getByText(mensaje)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Cancelar compra" })).toBeNull();
  });

  it.each([
    ["CANCELADA", compraCanceladaDesdeConfirmada],
    ["REEMBOLSADA", compraReembolsada],
  ])("%s: sin motivo aparte (lo dice su aviso)", async (_estado, compra) => {
    await abrirCompra({ compra: [{ status: 200, json: compra }] });
    await screen.findByText("Total: $ 60.000");
    expect(screen.queryByText("El evento ya empezó")).toBeNull();
    expect(screen.queryByText("Ya usaste una entrada")).toBeNull();
  });
});
