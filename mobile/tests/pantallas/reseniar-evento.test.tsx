import { EstadoCompra, type CompraVista } from "@ai-ticket-it/shared";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import { router } from "expo-router";

import { compraConfirmada, compraUtilizada, reseniaDeEjemplo } from "../helpers/compras";
import { errorApi, maratonCompleta } from "../helpers/eventos";
import { porMetodo, porRuta, type FuncionRespuesta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { alertasCon, escribir, espiarAlertas, tituloDelHeader, tocarEnAlerta } from "../helpers/formulario";
import { esperarPestanas } from "../helpers/pestanas";
import { renderConDependencias, URL_DE_PRUEBA } from "../helpers/render-con-dependencias";
import { martin, todos } from "../helpers/usuarios";

type Lista = ReadonlyArray<RespuestaFalsa | FuncionRespuesta>;

const DESCARTAR = "¿Descartar los cambios?";
const COMPRA_ID = compraUtilizada.id;
const COMPRA = `/compras/${COMPRA_ID}`;
const RESENIAS = `/eventos/${maratonCompleta.id}/resenias`;
const COMENTARIO = "Comentario (opcional)";

/** La UTILIZADA de la Maratón ("1 de 2"), todavía sin reseñar. */
const reseniable: CompraVista = { ...compraUtilizada, puedeReseniar: true };
const reseniada: CompraVista = { ...compraUtilizada, resenia: reseniaDeEjemplo(), puedeReseniar: false };

function respuestas({
  compra = [
    { status: 200, json: reseniable },
    { status: 200, json: reseniada },
  ],
  envio = [{ status: 201, json: reseniaDeEjemplo() }],
}: {
  compra?: Lista;
  envio?: Lista;
}) {
  return porRuta({
    "/usuarios/actual": [{ status: 200, json: martin }],
    "/usuarios": [{ status: 200, json: todos }],
    [RESENIAS]: [porMetodo({ POST: envio })],
    [COMPRA]: compra,
  });
}

/** Abre "Tu compra" y, encima, "Reseñar evento" (así atrás vuelve a "Tu compra"). */
async function abrirReseniar(opciones: { compra?: Lista; envio?: Lista } = {}) {
  const resultado = await renderConDependencias({
    usuarioRecordado: martin.id,
    respuestas: respuestas(opciones),
  });
  await esperarPestanas();
  await act(() => router.push({ pathname: "/compras/[compraId]", params: { compraId: COMPRA_ID } }));
  await act(() => router.push({ pathname: "/compras/[compraId]/resenia", params: { compraId: COMPRA_ID } }));
  return resultado;
}

const envios = (resultado: Awaited<ReturnType<typeof abrirReseniar>>) =>
  resultado.falso.pedidosA(RESENIAS).filter((pedido) => pedido.metodo === "POST");
const cuerpoDe = (resultado: Awaited<ReturnType<typeof abrirReseniar>>, i = 0) =>
  JSON.parse(envios(resultado)[i]?.cuerpo ?? "null");
const radio = (n: number) => screen.getByRole("radio", { name: `${n} de 5` });
const enviar = async () => fireEvent.press(screen.getByRole("button", { name: "Enviar" }));

describe("Reseñar evento (feature 012, US1)", () => {
  it("muestra el evento, cinco puntuaciones sin elegir, el comentario con tope de 500 y Enviar", async () => {
    await abrirReseniar();

    expect(await screen.findByRole("header", { name: maratonCompleta.nombre })).toBeOnTheScreen();
    expect(tituloDelHeader()).toBe("Reseñar evento");
    for (const n of [1, 2, 3, 4, 5]) {
      expect(radio(n)).not.toBeChecked();
    }
    expect(screen.getByLabelText(COMENTARIO).props.maxLength).toBe(500);
    expect(screen.getByRole("button", { name: "Enviar" })).toBeOnTheScreen();
  });

  it("tocar «4 de 5» lo marca elegido y deja los demás sin elegir", async () => {
    await abrirReseniar();
    await fireEvent.press(await screen.findByRole("radio", { name: "4 de 5" }));

    expect(radio(4)).toBeChecked();
    for (const n of [1, 2, 3, 5]) expect(radio(n)).not.toBeChecked();
  });

  it("Enviar manda la puntuación y el comentario sin recortar en nombre de Martín, y vuelve a Tu compra", async () => {
    const resultado = await abrirReseniar();
    await fireEvent.press(await screen.findByRole("radio", { name: "4 de 5" }));
    await escribir(COMENTARIO, "  Muy buena organización  ");
    await enviar();

    await waitFor(() => expect(resultado.getPathname()).toBe(COMPRA));
    expect(envios(resultado)).toHaveLength(1);
    expect(cuerpoDe(resultado)).toEqual({ puntuacion: 4, comentario: "  Muy buena organización  " });
    expect(envios(resultado)[0]?.encabezados["X-Usuario-Id"]).toBe("usuario-martin");
  });

  it("un doble toque en Enviar manda un solo pedido", async () => {
    const resultado = await abrirReseniar({ envio: ["colgar"] });
    await fireEvent.press(await screen.findByRole("radio", { name: "5 de 5" }));
    await enviar();
    await enviar();

    expect(envios(resultado)).toHaveLength(1);
  });

  it("sin puntuación manda el pedido igual, y el 400 va junto al selector y conserva el comentario", async () => {
    const resultado = await abrirReseniar({
      envio: [
        {
          status: 400,
          json: errorApi("ENTRADA_INVALIDA", "Los datos enviados no son válidos.", [
            { campo: "body.puntuacion", mensaje: "Es obligatorio." },
          ]),
        },
      ],
    });
    await screen.findByRole("radio", { name: "1 de 5" });
    await escribir(COMENTARIO, "Muy linda");
    await enviar();

    expect(await screen.findByText("Es obligatorio.")).toBeOnTheScreen();
    expect(cuerpoDe(resultado)).toEqual({ puntuacion: null, comentario: "Muy linda" });
    expect(screen.getByLabelText(COMENTARIO)).toHaveDisplayValue("Muy linda");
    expect(resultado.getPathname()).toBe(`${COMPRA}/resenia`);
  });

  it("un 400 sobre body.comentario va junto al campo", async () => {
    await abrirReseniar({
      envio: [
        {
          status: 400,
          json: errorApi("ENTRADA_INVALIDA", "Los datos enviados no son válidos.", [
            { campo: "body.comentario", mensaje: "Debe tener como máximo 500 caracteres." },
          ]),
        },
      ],
    });
    await fireEvent.press(await screen.findByRole("radio", { name: "3 de 5" }));
    await enviar();

    expect(await screen.findByText("Debe tener como máximo 500 caracteres.")).toBeOnTheScreen();
    expect(radio(3)).toBeChecked();
  });

  it("un 409 muestra el mensaje del servidor y conserva lo elegido y lo escrito", async () => {
    const resultado = await abrirReseniar({
      envio: [{ status: 409, json: errorApi("RESENIA_REPETIDA", "Ya reseñaste este evento.") }],
    });
    await fireEvent.press(await screen.findByRole("radio", { name: "2 de 5" }));
    await escribir(COMENTARIO, "Regular");
    await enviar();

    expect(await screen.findByText("Ya reseñaste este evento.")).toBeOnTheScreen();
    expect(radio(2)).toBeChecked();
    expect(screen.getByLabelText(COMENTARIO)).toHaveDisplayValue("Regular");
    expect(resultado.getPathname()).toBe(`${COMPRA}/resenia`);
  });

  it("sin servidor: la franja, sin reenviar solo y sin salir de la pantalla", async () => {
    const resultado = await abrirReseniar({ envio: ["rechazar"] });
    await fireEvent.press(await screen.findByRole("radio", { name: "4 de 5" }));
    await enviar();

    expect(await screen.findByText(`Servidor no disponible · ${URL_DE_PRUEBA}`)).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(5000));
    expect(envios(resultado)).toHaveLength(1);
    expect(resultado.getPathname()).toBe(`${COMPRA}/resenia`);
    expect(radio(4)).toBeChecked();
  });

  it("atrás con una puntuación elegida pregunta ¿Descartar los cambios?", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirReseniar();
    await fireEvent.press(await screen.findByRole("radio", { name: "4 de 5" }));
    await act(() => router.back());
    await tocarEnAlerta(alertas, DESCARTAR, "Descartar");
    await waitFor(() => expect(resultado.getPathname()).toBe(COMPRA));
  });

  it("atrás con solo un comentario también pregunta", async () => {
    const alertas = espiarAlertas();
    await abrirReseniar();
    await screen.findByRole("radio", { name: "1 de 5" });
    await escribir(COMENTARIO, "Hola");
    await act(() => router.back());
    expect(alertasCon(alertas, DESCARTAR)).toHaveLength(1);
  });

  it("atrás sin cambios sale sin preguntar", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirReseniar();
    await screen.findByRole("radio", { name: "1 de 5" });
    await act(() => router.back());
    await waitFor(() => expect(resultado.getPathname()).toBe(COMPRA));
    expect(alertasCon(alertas, DESCARTAR)).toHaveLength(0);
  });

  it("con la reseña ya hecha (pantalla desactualizada): «Ya reseñaste este evento» y la reseña, sin formulario", async () => {
    await abrirReseniar({ compra: [{ status: 200, json: reseniada }] });

    expect(await screen.findByText("Ya reseñaste este evento")).toBeOnTheScreen();
    expect(screen.getAllByLabelText("Puntuación: 4 de 5").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Muy buena organización").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Enviar" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "1 de 5" })).toBeNull();
  });

  it.each([
    ["CONFIRMADA", compraConfirmada],
    ["CANCELADA", { ...compraConfirmada, estado: EstadoCompra.CANCELADA }],
  ])(
    "con una compra %s: «Solo podés reseñar un evento al que asististe.», sin formulario",
    async (_e, compra) => {
      await abrirReseniar({ compra: [{ status: 200, json: compra }] });

      expect(await screen.findByText("Solo podés reseñar un evento al que asististe.")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Enviar" })).toBeNull();
    },
  );

  it("un 403 al leer la compra lo muestra el aviso de la compra", async () => {
    await abrirReseniar({
      compra: [
        { status: 403, json: errorApi("SIN_PERMISO", "Solo quien hizo la compra puede verla o pagarla.") },
      ],
    });
    expect(await screen.findAllByText("No tenés permiso para ver esta compra.")).not.toHaveLength(0);
  });

  it("un 404 al leer la compra: «No encontramos esta compra.»", async () => {
    await abrirReseniar({
      compra: [{ status: 404, json: errorApi("COMPRA_NO_ENCONTRADA", "No existe la compra.") }],
    });
    expect(await screen.findAllByText("No encontramos esta compra.")).not.toHaveLength(0);
  });
});
