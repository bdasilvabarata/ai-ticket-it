import { EstadoCompra, type UsuarioVista } from "@ai-ticket-it/shared";
import { act, fireEvent, screen, waitFor, within } from "expo-router/testing-library";
import { router } from "expo-router";
import { ScrollView } from "react-native";

import {
  chatDeEjemplo,
  chatVistoPorLucia,
  compraConfirmada,
  compraPendiente,
  MENSAJES_DEL_SEED,
  mensajeDeEjemplo,
} from "../helpers/compras";
import { porMetodo, porRuta, type FuncionRespuesta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { errorApi } from "../helpers/eventos";
import { escribir, tituloDelHeader } from "../helpers/formulario";
import { esperarPestanas } from "../helpers/pestanas";
import { renderConDependencias } from "../helpers/render-con-dependencias";
import { lucia, martin, todos } from "../helpers/usuarios";

type Lista = ReadonlyArray<RespuestaFalsa | FuncionRespuesta>;

const COMPRA_ID = "compra-martin-festival-vip";
const COMPRA = `/compras/${COMPRA_ID}`;
const MENSAJES = `${COMPRA}/mensajes`;
const TEXTO_NUEVO = "  ¿A qué hora abren las puertas?  ";

const mensajeNuevo = mensajeDeEjemplo({
  numero: 4,
  texto: "¿A qué hora abren las puertas?",
  enviadoEn: "2026-11-20T17:35:00.000Z",
  enviadoEnLocal: "2026-11-20T14:35",
});
const conElMensajeNuevo = chatDeEjemplo({ mensajes: [...MENSAJES_DEL_SEED, mensajeNuevo] });

interface Opciones {
  usuario?: UsuarioVista;
  chat?: Lista;
  envio?: Lista;
  compra?: Lista;
  pago?: Lista;
}

function respuestas({
  usuario = martin,
  chat = [{ status: 200, json: chatDeEjemplo() }],
  envio,
  compra = [{ status: 200, json: { ...compraConfirmada, id: COMPRA_ID } }],
  pago = [{ status: 200, json: { ...compraConfirmada, id: COMPRA_ID } }],
}: Opciones) {
  return porRuta({
    "/usuarios/actual": [{ status: 200, json: usuario }],
    "/usuarios": [{ status: 200, json: todos }],
    [MENSAJES]: [porMetodo({ GET: chat, POST: envio ?? [{ status: 201, json: mensajeNuevo }] })],
    [`${COMPRA}/pago`]: pago,
    [COMPRA]: compra,
  });
}

/** Abre el chat de la compra VIP del Festival directamente (por la ruta tipada). */
async function abrirChat(opciones: Opciones = {}) {
  const resultado = await renderConDependencias({
    usuarioRecordado: (opciones.usuario ?? martin).id,
    respuestas: respuestas(opciones),
  });
  await esperarPestanas();
  await act(() => router.push({ pathname: "/compras/[compraId]/chat", params: { compraId: COMPRA_ID } }));
  return resultado;
}

const pedidosGet = (resultado: Awaited<ReturnType<typeof abrirChat>>) =>
  resultado.falso.pedidosA(MENSAJES).filter((pedido) => pedido.metodo === "GET");
const pedidosPost = (resultado: Awaited<ReturnType<typeof abrirChat>>) =>
  resultado.falso.pedidosA(MENSAJES).filter((pedido) => pedido.metodo === "POST");

describe("Chat de la compra: el comprador (feature 011, US1)", () => {
  it("desde Tu compra, «Chat con el organizador» abre el chat, que se pide en nombre de Martín", async () => {
    const resultado = await renderConDependencias({
      usuarioRecordado: martin.id,
      respuestas: respuestas({}),
    });
    await esperarPestanas();
    await act(() => router.push({ pathname: "/compras/[compraId]", params: { compraId: COMPRA_ID } }));

    await fireEvent.press(await screen.findByRole("button", { name: "Chat con el organizador" }));

    expect(await screen.findByRole("header", { name: "Festival Sonidos del Sur" })).toBeOnTheScreen();
    expect(tituloDelHeader()).toBe("Chat de la compra");
    const pedidos = pedidosGet(resultado);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]?.encabezados["X-Usuario-Id"]).toBe("usuario-martin");
  });

  it("el encabezado: el evento, la otra parte, el tipo con la cantidad y el estado", async () => {
    await abrirChat();

    expect(await screen.findByRole("header", { name: "Festival Sonidos del Sur" })).toBeOnTheScreen();
    expect(screen.getByText("Con Lucía Álvarez · Organizador")).toBeOnTheScreen();
    expect(screen.getByText("VIP · 2 entradas")).toBeOnTheScreen();
    expect(screen.getByLabelText("Estado: Confirmada")).toBeOnTheScreen();
  });

  it("los tres mensajes con su texto, su hora y su autor: los de Martín como «Vos»", async () => {
    await abrirChat();

    expect(await screen.findByText("Hola, ¿la entrada VIP incluye estacionamiento?")).toBeOnTheScreen();
    expect(screen.getByText(MENSAJES_DEL_SEED[1]!.texto)).toBeOnTheScreen();
    expect(screen.getByText("¡Genial, gracias!")).toBeOnTheScreen();
    expect(screen.getByText("mié 18 nov 2026 · 15:30")).toBeOnTheScreen();
    expect(screen.getByText("mié 18 nov 2026 · 17:20")).toBeOnTheScreen();
    expect(screen.getAllByText("Vos")).toHaveLength(2);
    expect(screen.getByText("Lucía Álvarez · Organizador")).toBeOnTheScreen();
  });

  it("Enviar manda el texto sin recortar, vacía el campo y vuelve a pedir el chat con el mensaje nuevo último", async () => {
    const resultado = await abrirChat({
      chat: [
        { status: 200, json: chatDeEjemplo() },
        { status: 200, json: conElMensajeNuevo },
      ],
    });
    await screen.findByText("¡Genial, gracias!");

    await escribir("Mensaje", TEXTO_NUEVO);
    await fireEvent.press(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("¿A qué hora abren las puertas?")).toBeOnTheScreen();
    const envios = pedidosPost(resultado);
    expect(envios).toHaveLength(1);
    expect(JSON.parse(envios[0]?.cuerpo ?? "null")).toEqual({ texto: TEXTO_NUEVO });
    expect(envios[0]?.encabezados["X-Usuario-Id"]).toBe("usuario-martin");
    await waitFor(() => expect(screen.getByLabelText("Mensaje")).toHaveDisplayValue(""));
    expect(pedidosGet(resultado)).toHaveLength(2);
    // El nuevo es el último de la conversación.
    const mensajes = screen.getAllByLabelText(/^Vos, comprador, |^Lucía Álvarez, organizador, /);
    expect(within(mensajes.at(-1)!).getByText("¿A qué hora abren las puertas?")).toBeOnTheScreen();
  });
});

describe("Chat de la compra: la organizadora (feature 011, US2)", () => {
  const respuesta = mensajeDeEjemplo({
    numero: 4,
    autor: chatDeEjemplo().otraParte,
    texto: "Las puertas abren a las 18.",
    enviadoEn: "2026-11-20T17:35:00.000Z",
    enviadoEnLocal: "2026-11-20T14:35",
  });

  it("ve a Martín como la otra parte, sus mensajes como del comprador y el suyo como «Vos»", async () => {
    await abrirChat({ usuario: lucia, chat: [{ status: 200, json: chatVistoPorLucia() }] });

    expect(await screen.findByText("Con Martín Benítez · Comprador")).toBeOnTheScreen();
    expect(screen.getAllByText("Martín Benítez · Comprador")).toHaveLength(2);
    expect(screen.getAllByText("Vos")).toHaveLength(1);
    const deLucia = screen.getByLabelText(/^Vos, organizador, /);
    expect(within(deLucia).getByText(MENSAJES_DEL_SEED[1]!.texto)).toBeOnTheScreen();
  });

  it("enviar manda el mensaje en nombre de Lucía", async () => {
    const resultado = await abrirChat({
      usuario: lucia,
      chat: [
        { status: 200, json: chatVistoPorLucia() },
        { status: 200, json: chatVistoPorLucia({ mensajes: [...MENSAJES_DEL_SEED, respuesta] }) },
      ],
      envio: [{ status: 201, json: respuesta }],
    });
    await screen.findByText("¡Genial, gracias!");

    await escribir("Mensaje", "Las puertas abren a las 18.");
    await fireEvent.press(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Las puertas abren a las 18.")).toBeOnTheScreen();
    const [envio] = pedidosPost(resultado);
    expect(envio?.encabezados["X-Usuario-Id"]).toBe("usuario-lucia");
    expect(screen.getAllByText("Vos")).toHaveLength(2);
  });
});

describe("Chat de la compra: nadie más lo lee ni escribe (feature 011, US3)", () => {
  const MENSAJE_403 =
    "Solo el comprador y el organizador del evento pueden ver y escribir en el chat de esta compra.";

  it("403 al pedir el chat: «No tenés permiso para ver este chat.», sin conversación ni campo", async () => {
    await abrirChat({ chat: [{ status: 403, json: errorApi("SIN_PERMISO", MENSAJE_403) }] });

    expect(await screen.findByText("No tenés permiso para ver este chat.")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    expect(screen.queryByLabelText("Mensaje")).toBeNull();
    expect(screen.queryByRole("button", { name: "Enviar" })).toBeNull();
  });

  it("404 al pedir el chat: «No encontramos esta compra.» e «Ir a Explorar»", async () => {
    const resultado = await abrirChat({
      chat: [{ status: 404, json: errorApi("COMPRA_NO_ENCONTRADA", "No existe la compra.") }],
    });

    expect(await screen.findByText("No encontramos esta compra.")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Mensaje")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Ir a Explorar" }));
    await waitFor(() => expect(resultado.getPathname()).toBe("/"));
  });

  it.each([
    [403, errorApi("SIN_PERMISO", MENSAJE_403)],
    [404, errorApi("COMPRA_NO_ENCONTRADA", "No existe la compra.")],
  ])("un %i al enviar muestra el mensaje del servidor y conserva el texto", async (status, json) => {
    await abrirChat({ envio: [{ status, json }] });
    await screen.findByText("¡Genial, gracias!");

    await escribir("Mensaje", "¿Me leen?");
    await fireEvent.press(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText(json.error.mensaje)).toBeOnTheScreen();
    expect(screen.getByLabelText("Mensaje")).toHaveDisplayValue("¿Me leen?");
  });
});

describe("Chat de la compra: una conversación al día (feature 011, US4)", () => {
  it("dos toques seguidos en «Enviar» mandan un solo pedido", async () => {
    const resultado = await abrirChat({ envio: ["colgar"] });
    await screen.findByText("¡Genial, gracias!");

    await escribir("Mensaje", "Hola");
    const enviar = screen.getByRole("button", { name: "Enviar" });
    await fireEvent.press(enviar);
    await fireEvent.press(enviar);

    expect(await screen.findByRole("button", { name: "Enviando…" })).toBeDisabled();
    expect(pedidosPost(resultado)).toHaveLength(1);
  });

  it("sin servidor: «No se pudo enviar. Probá de nuevo.», conserva el texto, no reintenta y vuelve a pedir el chat", async () => {
    const resultado = await abrirChat({ envio: ["rechazar"] });
    await screen.findByText("¡Genial, gracias!");

    await escribir("Mensaje", "¿Me leen?");
    await fireEvent.press(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("No se pudo enviar. Probá de nuevo.")).toBeOnTheScreen();
    expect(screen.getByLabelText("Mensaje")).toHaveDisplayValue("¿Me leen?");
    await waitFor(() => expect(pedidosGet(resultado)).toHaveLength(2));
    expect(pedidosPost(resultado)).toHaveLength(1);
  });

  it("volver a la pantalla vuelve a pedir el chat; al abrirlo se pide una sola vez", async () => {
    const resultado = await abrirChat();
    await screen.findByText("¡Genial, gracias!");
    expect(pedidosGet(resultado)).toHaveLength(1);

    await act(() => router.push({ pathname: "/compras/[compraId]", params: { compraId: COMPRA_ID } }));
    await screen.findByRole("button", { name: "Chat con el organizador" });
    expect(pedidosGet(resultado)).toHaveLength(1);
    await act(() => router.back());

    await waitFor(() => expect(resultado.getPathname()).toBe(`${COMPRA}/chat`));
    await waitFor(() => expect(pedidosGet(resultado)).toHaveLength(2));
  });

  it("con la pantalla a la vista no hay sondeo: 60 s después sigue habiendo un solo pedido", async () => {
    const resultado = await abrirChat();
    await screen.findByText("¡Genial, gracias!");

    jest.useFakeTimers();
    await act(() => jest.advanceTimersByTimeAsync(60_000));

    expect(pedidosGet(resultado)).toHaveLength(1);
  });

  it("Martín envía y Lucía, en el mismo celular, abre el chat enseguida: se pide de nuevo y ve el mensaje", async () => {
    const respuestaDeLucia = chatVistoPorLucia({ mensajes: [...MENSAJES_DEL_SEED, mensajeNuevo] });
    const resultado = await abrirChat({
      chat: [
        (_url, init) =>
          (init?.headers as Record<string, string> | undefined)?.["X-Usuario-Id"] === lucia.id
            ? { status: 200, json: respuestaDeLucia }
            : { status: 200, json: chatDeEjemplo() },
      ],
    });
    await screen.findByText("¡Genial, gracias!");
    await escribir("Mensaje", TEXTO_NUEVO);
    await fireEvent.press(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(screen.getByLabelText("Mensaje")).toHaveDisplayValue(""));

    await act(() => router.push("/seleccionar-usuario"));
    await fireEvent.press(await screen.findByRole("button", { name: "Elegir a Lucía Álvarez" }));
    await act(() => router.push({ pathname: "/compras/[compraId]/chat", params: { compraId: COMPRA_ID } }));

    expect(await screen.findByText("¿A qué hora abren las puertas?")).toBeOnTheScreen();
    const deLucia = pedidosGet(resultado).filter((p) => p.encabezados["X-Usuario-Id"] === lucia.id);
    expect(deLucia.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Con Martín Benítez · Comprador")).toBeOnTheScreen();
  });
});

describe("Chat de la compra: lo que invalida cada escritura (feature 011, US4, R10)", () => {
  const pedidosDeLaCompra = (resultado: Awaited<ReturnType<typeof abrirChat>>) =>
    resultado.falso.pedidosA(COMPRA).filter((pedido) => pedido.metodo === "GET");

  it("después de pagar en Tu compra, el chat se vuelve a pedir y el encabezado dice «Confirmada»", async () => {
    const pendiente = chatDeEjemplo({
      compra: { ...chatDeEjemplo().compra, estado: EstadoCompra.PENDIENTE },
    });
    const resultado = await abrirChat({
      chat: [
        { status: 200, json: pendiente },
        { status: 200, json: chatDeEjemplo() },
      ],
      compra: [{ status: 200, json: { ...compraPendiente, id: COMPRA_ID } }],
    });
    expect(await screen.findByLabelText("Estado: Pendiente")).toBeOnTheScreen();

    await act(() => router.push({ pathname: "/compras/[compraId]", params: { compraId: COMPRA_ID } }));
    await fireEvent.press(await screen.findByRole("button", { name: "Pagar" }));
    await waitFor(() => expect(resultado.falso.pedidosA(`${COMPRA}/pago`)).toHaveLength(1));
    // Una pantalla de chat nueva arriba: con el chat fresco en caché no lo pediría si nadie lo invalidó.
    await act(() => router.push({ pathname: "/compras/[compraId]/chat", params: { compraId: COMPRA_ID } }));

    await waitFor(() => expect(pedidosGet(resultado)).toHaveLength(2));
    expect(await screen.findByLabelText("Estado: Confirmada")).toBeOnTheScreen();
  });

  it("enviar un mensaje no vuelve a pedir Tu compra", async () => {
    const resultado = await renderConDependencias({
      usuarioRecordado: martin.id,
      respuestas: respuestas({}),
    });
    await esperarPestanas();
    await act(() => router.push({ pathname: "/compras/[compraId]", params: { compraId: COMPRA_ID } }));
    await fireEvent.press(await screen.findByRole("button", { name: "Chat con el organizador" }));
    await screen.findByText("¡Genial, gracias!");
    const antes = pedidosDeLaCompra(resultado).length;

    await escribir("Mensaje", "Hola");
    await fireEvent.press(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(pedidosGet(resultado)).toHaveLength(2));

    expect(pedidosDeLaCompra(resultado)).toHaveLength(antes);
  });
});

describe("Chat de la compra: la pantalla en todos sus estados (feature 011, US5)", () => {
  const scrollToEnd = jest.spyOn(ScrollView.prototype, "scrollToEnd");
  beforeEach(() => scrollToEnd.mockClear());

  it("mientras se pide el chat, «Cargando…»", async () => {
    await abrirChat({ chat: ["colgar"] });

    expect(await screen.findByText("Cargando…")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Mensaje")).toBeNull();
  });

  it("un error del servidor muestra su mensaje y «Reintentar», que vuelve a pedir el chat", async () => {
    const resultado = await abrirChat({
      chat: [
        { status: 500, json: errorApi("ERROR_INTERNO", "Ocurrió un error en el servidor.") },
        { status: 200, json: chatDeEjemplo() },
      ],
    });

    expect(await screen.findByText("Ocurrió un error en el servidor.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("¡Genial, gracias!")).toBeOnTheScreen();
    expect(pedidosGet(resultado)).toHaveLength(2);
  });

  it("sin mensajes: «Todavía no hay mensajes», con el encabezado y el campo a la vista", async () => {
    await abrirChat({ chat: [{ status: 200, json: chatDeEjemplo({ mensajes: [] }) }] });

    expect(await screen.findByText("Todavía no hay mensajes")).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Festival Sonidos del Sur" })).toBeOnTheScreen();
    expect(screen.getByText("Con Lucía Álvarez · Organizador")).toBeOnTheScreen();
    expect(screen.getByLabelText("Mensaje")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeOnTheScreen();
  });

  it("un 400 al enviar muestra el detalle de body.texto debajo del campo y conserva el texto", async () => {
    await abrirChat({
      envio: [
        {
          status: 400,
          json: errorApi("ENTRADA_INVALIDA", "Los datos enviados no son válidos.", [
            { campo: "body.texto", mensaje: "Es obligatorio." },
          ]),
        },
      ],
    });
    await screen.findByText("¡Genial, gracias!");

    await escribir("Mensaje", "   ");
    await fireEvent.press(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Es obligatorio.")).toBeOnTheScreen();
    expect(screen.queryByText("Los datos enviados no son válidos.")).toBeNull();
    expect(screen.getByLabelText("Mensaje")).toHaveDisplayValue("   ");
  });

  it("«Enviar» con el campo vacío manda el pedido igual: la app no valida", async () => {
    const resultado = await abrirChat();
    await screen.findByText("¡Genial, gracias!");

    const enviar = screen.getByRole("button", { name: "Enviar" });
    expect(enviar).toBeEnabled();
    await fireEvent.press(enviar);

    await waitFor(() => expect(pedidosPost(resultado)).toHaveLength(1));
    expect(pedidosPost(resultado)[0]?.cuerpo).toBe(JSON.stringify({ texto: "" }));
  });

  it("cada mensaje es un elemento accesible con su autor, su rol, su hora y su texto", async () => {
    await abrirChat();
    await screen.findByText("¡Genial, gracias!");

    expect(
      screen.getByLabelText(
        "Vos, comprador, mié 18 nov 2026 · 15:30: Hola, ¿la entrada VIP incluye estacionamiento?",
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(/^Lucía Álvarez, organizador, mié 18 nov 2026 · 17:20: ¡Hola, Martín!/),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText("Mensaje")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeOnTheScreen();
  });

  it("un mensaje con saltos de línea internos los muestra", async () => {
    const conSaltos = mensajeDeEjemplo({ numero: 4, texto: "Primera línea\nSegunda línea" });
    await abrirChat({
      chat: [{ status: 200, json: chatDeEjemplo({ mensajes: [...MENSAJES_DEL_SEED, conSaltos] }) }],
    });

    expect(await screen.findByText("Primera línea\nSegunda línea")).toBeOnTheScreen();
  });

  it("abre mostrando lo más reciente: al cambiar el contenido desplaza hasta el final", async () => {
    await abrirChat();
    const ultimo = await screen.findByText("¡Genial, gracias!");

    let scroll = ultimo.parent;
    while (scroll && scroll.type !== "RCTScrollView") scroll = scroll.parent;
    expect(scroll).not.toBeNull();
    if (scroll) await fireEvent(scroll, "contentSizeChange", 360, 2000);

    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
  });

  it("al cambiar de Martín a Lucía no se ve la conversación del anterior: se pide en nombre de Lucía", async () => {
    const resultado = await abrirChat({
      chat: [
        (_url, init) =>
          (init?.headers as Record<string, string> | undefined)?.["X-Usuario-Id"] === lucia.id
            ? "colgar"
            : { status: 200, json: chatDeEjemplo() },
      ],
    });
    await screen.findByText("Con Lucía Álvarez · Organizador");

    await act(() => router.push("/seleccionar-usuario"));
    await fireEvent.press(await screen.findByRole("button", { name: "Elegir a Lucía Álvarez" }));
    await act(() => router.push({ pathname: "/compras/[compraId]/chat", params: { compraId: COMPRA_ID } }));

    expect(await screen.findByText("Cargando…")).toBeOnTheScreen();
    expect(screen.queryByText("Con Lucía Álvarez · Organizador")).toBeNull();
    expect(screen.queryByText("¡Genial, gracias!")).toBeNull();
    await waitFor(() =>
      expect(pedidosGet(resultado).some((p) => p.encabezados["X-Usuario-Id"] === lucia.id)).toBe(true),
    );
  });
});
