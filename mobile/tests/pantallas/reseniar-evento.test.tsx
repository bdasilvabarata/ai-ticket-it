import { EstadoCompra, type CompraVista } from "@ai-ticket-it/shared";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import { router } from "expo-router";

import { compraConfirmada, compraUtilizada, reseniaDeEjemplo } from "../helpers/compras";
import {
  CATALOGO_INICIAL,
  catalogo,
  errorApi,
  festivalCompleto,
  luciaOrganizadora,
  maratonCompleta,
  maratonEnCatalogo,
  reseniaDelOrganizadorDeEjemplo,
  reseniasDelOrganizadorDeEjemplo,
} from "../helpers/eventos";
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

describe("después de reseñar, el puntaje se pone al día (feature 012, US3, SC-006, FR-011)", () => {
  // Recorre Explorar, dos detalles, "Tu compra" y el formulario: supera los 5 s de Jest.
  jest.setTimeout(20_000);

  const FESTIVAL = `/eventos/${festivalCompleto.id}`;
  const RESENIAS_FESTIVAL = `${FESTIVAL}/resenias-del-organizador/resumen`;
  const SIN_RESENIAS_EN_TARJETA = "Organiza Lucía Álvarez · Sin reseñas";
  const CON_RESENIA_EN_TARJETA = "Organiza Lucía Álvarez · 4,0 · 1 reseña";

  /** El servidor antes y después de que Martín reseña la Maratón de Lucía con un 4. */
  function servidor() {
    let reseniado = false;
    const lucia = () =>
      reseniado ? { ...luciaOrganizadora, puntaje: 4, cantidadResenias: 1 } : luciaOrganizadora;
    const reseniaNueva = reseniaDelOrganizadorDeEjemplo({
      id: "resenia-martin-maraton",
      puntuacion: 4,
      comentario: "Muy buena organización",
      autor: { nombre: "Martín", apellido: "Benítez" },
      evento: { id: maratonCompleta.id, nombre: maratonCompleta.nombre },
    });
    const anterior = reseniaDelOrganizadorDeEjemplo({ comentario: "Una reseña vieja." });
    return porRuta({
      "/usuarios/actual": [{ status: 200, json: martin }],
      "/usuarios": [{ status: 200, json: todos }],
      [CATALOGO_INICIAL]: [
        () => ({ status: 200, json: catalogo([{ ...maratonEnCatalogo, organizador: lucia() }]) }),
      ],
      [FESTIVAL]: [() => ({ status: 200, json: { ...festivalCompleto, organizador: lucia() } })],
      [RESENIAS_FESTIVAL]: [
        () => ({
          status: 200,
          json: reseniasDelOrganizadorDeEjemplo({
            organizador: lucia(),
            resenias: reseniado ? [reseniaNueva, anterior] : [anterior],
          }),
        }),
      ],
      [COMPRA]: [() => ({ status: 200, json: reseniado ? reseniada : reseniable })],
      [RESENIAS]: [
        porMetodo({
          POST: [
            () => {
              reseniado = true;
              return { status: 201, json: reseniaDeEjemplo() };
            },
          ],
        }),
      ],
    });
  }

  const abrirFestival = () =>
    act(() => router.push({ pathname: "/explorar/[eventoId]", params: { eventoId: festivalCompleto.id } }));

  it("Explorar, el detalle de otro evento de Lucía y su sección se vuelven a pedir y muestran la reseña", async () => {
    const resultado = await renderConDependencias({ usuarioRecordado: martin.id, respuestas: servidor() });
    await esperarPestanas();
    expect(await screen.findByText(SIN_RESENIAS_EN_TARJETA)).toBeOnTheScreen();

    // El detalle del Festival queda en la caché antes de reseñar.
    await abrirFestival();
    expect(await screen.findByText("Una reseña vieja.")).toBeOnTheScreen();
    expect(screen.queryByText("Muy buena organización")).toBeNull();
    await act(() => router.back());

    await act(() => router.push({ pathname: "/compras/[compraId]", params: { compraId: COMPRA_ID } }));
    await act(() =>
      router.push({ pathname: "/compras/[compraId]/resenia", params: { compraId: COMPRA_ID } }),
    );
    await fireEvent.press(await screen.findByRole("radio", { name: "4 de 5" }));
    await escribir(COMENTARIO, "Muy buena organización");
    await enviar();
    await waitFor(() => expect(resultado.getPathname()).toBe(COMPRA));

    // De vuelta en Explorar: el catálogo se volvió a pedir y la tarjeta muestra el puntaje nuevo.
    await act(() => router.dismissAll());
    await waitFor(() => expect(resultado.falso.pedidosA(CATALOGO_INICIAL)).toHaveLength(2));
    expect(await screen.findByText(CON_RESENIA_EN_TARJETA)).toBeOnTheScreen();

    // El detalle de otro evento del mismo organizador: evento y sección otra vez, la reseña primera.
    await abrirFestival();
    await waitFor(() => expect(resultado.falso.pedidosA(FESTIVAL)).toHaveLength(2));
    await waitFor(() => expect(resultado.falso.pedidosA(RESENIAS_FESTIVAL)).toHaveLength(2));
    expect(await screen.findByText("Muy buena organización")).toBeOnTheScreen();
    const comentarios = screen.getAllByText(/Muy buena organización|Una reseña vieja\./);
    expect(comentarios.map((c) => c.props.children)).toEqual(["Muy buena organización", "Una reseña vieja."]);
    expect(screen.getAllByText("4,0 · 1 reseña").length).toBeGreaterThan(0);
  });

  it("cambiar de usuario no reusa la sección del anterior: la vuelve a pedir", async () => {
    const resultado = await renderConDependencias({ usuarioRecordado: martin.id, respuestas: servidor() });
    await esperarPestanas();
    await abrirFestival();
    expect(await screen.findByText("Una reseña vieja.")).toBeOnTheScreen();
    expect(resultado.falso.pedidosA(RESENIAS_FESTIVAL)).toHaveLength(1);

    await act(() => router.push("/seleccionar-usuario"));
    await fireEvent.press(await screen.findByRole("button", { name: "Elegir a Lucía Álvarez" }));
    await abrirFestival();

    await waitFor(() => expect(resultado.falso.pedidosA(RESENIAS_FESTIVAL)).toHaveLength(2));
    expect(await screen.findByText("Una reseña vieja.")).toBeOnTheScreen();
  });
});
