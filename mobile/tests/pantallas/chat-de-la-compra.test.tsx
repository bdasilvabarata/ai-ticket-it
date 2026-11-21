import type { UsuarioVista } from "@ai-ticket-it/shared";
import { act, fireEvent, screen, waitFor, within } from "expo-router/testing-library";
import { router } from "expo-router";

import {
  chatDeEjemplo,
  chatVistoPorLucia,
  compraConfirmada,
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
}

function respuestas({ usuario = martin, chat = [{ status: 200, json: chatDeEjemplo() }], envio }: Opciones) {
  return porRuta({
    "/usuarios/actual": [{ status: 200, json: usuario }],
    "/usuarios": [{ status: 200, json: todos }],
    [MENSAJES]: [porMetodo({ GET: chat, POST: envio ?? [{ status: 201, json: mensajeNuevo }] })],
    [COMPRA]: [{ status: 200, json: { ...compraConfirmada, id: COMPRA_ID } }],
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
