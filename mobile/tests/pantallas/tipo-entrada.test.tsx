import type { EventoVista } from "@ai-ticket-it/shared";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import { router } from "expo-router";

import { errorApi, festival, festivalCompleto, nocheDeRock } from "../helpers/eventos";
import { porMetodo, porRuta, type FuncionRespuesta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { alertasCon, escribir, espiarAlertas, tituloDelHeader, tocarEnAlerta } from "../helpers/formulario";
import { esperarPestanas, irAPestana } from "../helpers/pestanas";
import { renderConDependencias, URL_DE_PRUEBA } from "../helpers/render-con-dependencias";
import { lucia, todos } from "../helpers/usuarios";

const DESCARTAR = "¿Descartar los cambios?";
const RUTA = "/eventos/evento-festival";
const FILA = "Editar Festival Sonidos del Sur, jue 10 dic 2026 · 14:00";
const conPlatea: EventoVista = {
  ...festivalCompleto,
  tiposEntrada: [
    ...festivalCompleto.tiposEntrada,
    { id: "tipo-festival-platea", nombre: "Platea", descripcion: "", precio: 0, cupo: 100 },
  ],
};

interface Opciones {
  get?: (RespuestaFalsa | FuncionRespuesta)[];
  agregar?: (RespuestaFalsa | FuncionRespuesta)[];
  editar?: (RespuestaFalsa | FuncionRespuesta)[];
}

/** Abre Editar evento del Festival (Lucía). */
async function abrirEvento({
  get = [{ status: 200, json: festivalCompleto }],
  agregar = [{ status: 201, json: {} }],
  editar = [{ status: 200, json: {} }],
}: Opciones = {}) {
  const resultado = await renderConDependencias({
    usuarioRecordado: lucia.id,
    respuestas: porRuta({
      "/usuarios/actual": [{ status: 200, json: lucia }],
      "/usuarios": [{ status: 200, json: todos }],
      "/eventos/mios": [{ status: 200, json: [nocheDeRock, festival] }],
      "/categorias": [{ status: 200, json: [] }],
      [RUTA]: [porMetodo({ GET: get })],
      [`${RUTA}/tipos-entrada`]: [porMetodo({ POST: agregar })],
      "/tipos-entrada/tipo-festival-vip": [porMetodo({ PUT: editar })],
    }),
  });
  await esperarPestanas();
  await irAPestana("Mis eventos");
  await fireEvent.press(await screen.findByRole("button", { name: FILA }));
  await waitFor(() => expect(resultado.getPathname()).toBe(RUTA));
  await screen.findByRole("button", { name: "Editar VIP" });
  return resultado;
}

async function abrirAgregar(opciones: Opciones = {}) {
  const resultado = await abrirEvento(opciones);
  await fireEvent.press(screen.getByRole("button", { name: "Agregar tipo de entrada" }));
  await waitFor(() => expect(resultado.getPathname()).toBe(`${RUTA}/tipos-entrada/nuevo`));
  return resultado;
}

async function abrirEditarVip(opciones: Opciones = {}) {
  const resultado = await abrirEvento(opciones);
  await fireEvent.press(screen.getByRole("button", { name: "Editar VIP" }));
  await waitFor(() => expect(resultado.getPathname()).toBe(`${RUTA}/tipos-entrada/tipo-festival-vip`));
  return resultado;
}

const enviar = (texto: string) => fireEvent.press(screen.getByRole("button", { name: texto }));
const pedidos = (resultado: Awaited<ReturnType<typeof abrirEvento>>, metodo: string) =>
  resultado.falso.pedidos.filter((p) => p.metodo === metodo);

describe("Agregar tipo de entrada (US3)", () => {
  it("envía el POST y vuelve a Editar evento con el tipo nuevo", async () => {
    const resultado = await abrirAgregar({
      get: [
        { status: 200, json: festivalCompleto },
        { status: 200, json: conPlatea },
      ],
      agregar: [{ status: 201, json: conPlatea.tiposEntrada[3] }],
    });
    await escribir("Nombre", "Platea");
    await escribir("Precio", "0");
    await escribir("Cupo", "100");

    await enviar("Agregar tipo de entrada");

    await waitFor(() => expect(resultado.getPathname()).toBe(RUTA));
    expect(await screen.findByRole("button", { name: "Editar Platea" })).toBeOnTheScreen();
    const [post] = pedidos(resultado, "POST");
    expect(post.url).toBe(`${URL_DE_PRUEBA}${RUTA}/tipos-entrada`);
    expect(post.encabezados["X-Usuario-Id"]).toBe(lucia.id);
    expect(JSON.parse(post.cuerpo ?? "null")).toEqual({
      nombre: "Platea",
      descripcion: "",
      precio: 0,
      cupo: 100,
    });
  });

  it("NOMBRE_TIPO_ENTRADA_REPETIDO va debajo de Nombre y un 400, junto a cada campo", async () => {
    await abrirAgregar({
      agregar: [
        {
          status: 409,
          json: errorApi(
            "NOMBRE_TIPO_ENTRADA_REPETIDO",
            "Ya hay un tipo de entrada con ese nombre en el evento.",
          ),
        },
        {
          status: 400,
          json: errorApi("ENTRADA_INVALIDA", "Los datos enviados no son válidos.", [
            { campo: "body.precio", mensaje: "Es obligatorio." },
            { campo: "body.cupo", mensaje: "Debe ser un entero mayor o igual a 1." },
          ]),
        },
      ],
    });
    await escribir("Nombre", "vip");
    await enviar("Agregar tipo de entrada");
    expect(
      await screen.findByText("Ya hay un tipo de entrada con ese nombre en el evento."),
    ).toBeOnTheScreen();

    await enviar("Agregar tipo de entrada");
    expect(await screen.findByText("Es obligatorio.")).toBeOnTheScreen();
    expect(screen.getByText("Debe ser un entero mayor o igual a 1.")).toBeOnTheScreen();
    expect(screen.getByLabelText("Nombre")).toHaveDisplayValue("vip");
  });

  it("EVENTO_REALIZADO vuelve a la ruta del evento, ahora en solo lectura", async () => {
    const resultado = await abrirAgregar({
      get: [
        { status: 200, json: festivalCompleto },
        { status: 200, json: { ...festivalCompleto, realizado: true } },
      ],
      agregar: [
        {
          status: 409,
          json: errorApi("EVENTO_REALIZADO", "El evento ya se realizó: no se puede modificar."),
        },
      ],
    });
    await escribir("Nombre", "Platea");
    await enviar("Agregar tipo de entrada");

    await waitFor(() => expect(resultado.getPathname()).toBe(RUTA));
    expect(await screen.findByText("El evento ya se realizó: no se puede modificar.")).toBeOnTheScreen();
    await waitFor(() => expect(tituloDelHeader()).toBe("Evento realizado"));
  });

  it("un 404 del evento vuelve a Mis eventos sin preguntar", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirAgregar({
      agregar: [{ status: 404, json: errorApi("EVENTO_NO_ENCONTRADO", "No existe el evento.") }],
    });
    await escribir("Nombre", "Platea");
    await enviar("Agregar tipo de entrada");

    await waitFor(() => expect(resultado.getPathname()).toBe("/mis-eventos"));
    expect(alertasCon(alertas, "No existe el evento.")).toHaveLength(1);
    expect(alertasCon(alertas, DESCARTAR)).toHaveLength(0);
  });

  it("sin servidor al guardar: la franja, sin reenviar y con los campos cargados", async () => {
    const resultado = await abrirAgregar({ agregar: ["rechazar"] });
    await escribir("Nombre", "Platea");
    await enviar("Agregar tipo de entrada");

    expect(await screen.findByText(`Servidor no disponible · ${URL_DE_PRUEBA}`)).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(5000));
    expect(pedidos(resultado, "POST")).toHaveLength(1);
    expect(screen.getByLabelText("Nombre")).toHaveDisplayValue("Platea");
  });

  it("atrás sin cambios sale sin preguntar", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirAgregar();
    await act(() => router.back());
    await waitFor(() => expect(resultado.getPathname()).toBe(RUTA));
    expect(alertasCon(alertas, DESCARTAR)).toHaveLength(0);
  });

  it("atrás con cambios pregunta ¿Descartar los cambios?", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirAgregar();
    await escribir("Nombre", "Platea");
    await act(() => router.back());
    await tocarEnAlerta(alertas, DESCARTAR, "Descartar");
    await waitFor(() => expect(resultado.getPathname()).toBe(RUTA));
  });
});

describe("Editar tipo de entrada (US3)", () => {
  it("precarga el tipo, usa la etiqueta Cupo disponible y Guardar cambios envía el PUT y vuelve", async () => {
    const resultado = await abrirEditarVip({
      editar: [{ status: 200, json: { ...festivalCompleto.tiposEntrada[1], cupo: 10 } }],
    });
    expect(await screen.findByLabelText("Nombre")).toHaveDisplayValue("VIP");
    expect(screen.getByLabelText("Precio")).toHaveDisplayValue("120000");
    expect(screen.getByLabelText("Cupo disponible")).toHaveDisplayValue("0");

    await escribir("Cupo disponible", "10");
    await enviar("Guardar cambios");

    await waitFor(() => expect(resultado.getPathname()).toBe(RUTA));
    const [put] = pedidos(resultado, "PUT");
    expect(put.url).toBe(`${URL_DE_PRUEBA}${RUTA}/tipos-entrada/tipo-festival-vip`);
    expect(JSON.parse(put.cuerpo ?? "null")).toEqual({
      nombre: "VIP",
      descripcion: "Con barra.",
      precio: 120000,
      cupo: 10,
    });
  });

  it("un 404 del tipo vuelve a Mis eventos", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirEditarVip({
      editar: [
        {
          status: 404,
          json: errorApi("TIPO_ENTRADA_NO_ENCONTRADO", "No existe el tipo de entrada en este evento."),
        },
      ],
    });
    await enviar("Guardar cambios");

    await waitFor(() => expect(resultado.getPathname()).toBe("/mis-eventos"));
    expect(alertasCon(alertas, "No existe el tipo de entrada en este evento.")).toHaveLength(1);
  });

  it("atrás pregunta ¿Descartar los cambios? y Seguir editando conserva lo cargado", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirEditarVip();
    await escribir("Precio", "1");
    await act(() => router.back());
    await tocarEnAlerta(alertas, DESCARTAR, "Seguir editando");

    expect(resultado.getPathname()).toBe(`${RUTA}/tipos-entrada/tipo-festival-vip`);
    expect(screen.getByLabelText("Precio")).toHaveDisplayValue("1");
  });
});
