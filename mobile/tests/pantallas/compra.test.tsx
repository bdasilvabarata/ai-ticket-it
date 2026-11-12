import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import { router } from "expo-router";

import {
  compraCancelada,
  compraConfirmada,
  compraGratis,
  compraPendiente,
  conRestantes,
} from "../helpers/compras";
import { CATALOGO_INICIAL, catalogo, errorApi, maratonCompleta, maratonEnCatalogo } from "../helpers/eventos";
import { porMetodo, porRuta, type FuncionRespuesta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { tituloDelHeader } from "../helpers/formulario";
import { esperarPestanas } from "../helpers/pestanas";
import { renderConDependencias } from "../helpers/render-con-dependencias";
import { diego, martin, todos } from "../helpers/usuarios";

type Lista = ReadonlyArray<RespuestaFalsa | FuncionRespuesta>;

const EVENTO = "/eventos/evento-maraton-10k";
const COMPRA = "/compras/compra-nueva";
const PAGO = `${COMPRA}/pago`;

interface Opciones {
  compra?: Lista;
  pago?: Lista;
}

function respuestas({
  compra = [{ status: 200, json: compraPendiente }],
  pago = [{ status: 200, json: compraConfirmada }],
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
