import type { EventoResumenVista } from "@ai-ticket-it/shared";
import { act, fireEvent, screen, waitFor, within } from "expo-router/testing-library";
import { router } from "expo-router";

import { categorias, errorApi, nocheDeRock } from "../helpers/eventos";
import { porRuta, type FuncionRespuesta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { alertasCon, elegirFechaYHora, escribir, espiarAlertas, tocarEnAlerta } from "../helpers/formulario";
import { esperarPestanas, irAPestana } from "../helpers/pestanas";
import { renderConDependencias, URL_DE_PRUEBA } from "../helpers/render-con-dependencias";
import { lucia, todos } from "../helpers/usuarios";

const DESCARTAR = "¿Descartar los cambios?";
const tango: EventoResumenVista = {
  ...nocheDeRock,
  id: "evento-tango",
  nombre: "Noche de Tango",
  fechaHoraLocal: "2026-12-05T21:30",
};

interface Opciones {
  misEventos?: EventoResumenVista[];
  /** Respuestas del POST; por defecto, 201 y el evento `tango` aparece en Mis eventos. */
  crear?: RespuestaFalsa[];
  categoriasRespuestas?: RespuestaFalsa[];
}

/** Abre Mis eventos con Lucía y toca el botón de crear. `crear` son las respuestas del POST. */
async function abrirCrearEvento({
  misEventos = [nocheDeRock],
  crear,
  categoriasRespuestas = [{ status: 200, json: categorias }],
}: Opciones = {}) {
  const lista = [...misEventos];
  const creado: FuncionRespuesta = () => {
    lista.unshift(tango);
    return { status: 201, json: tango };
  };
  const resultado = await renderConDependencias({
    usuarioRecordado: lucia.id,
    respuestas: porRuta({
      "/usuarios/actual": [{ status: 200, json: lucia }],
      "/usuarios": [{ status: 200, json: todos }],
      "/eventos/mios": [(() => ({ status: 200, json: [...lista] })) as FuncionRespuesta],
      "/categorias": categoriasRespuestas,
      "/eventos": crear ?? [creado],
    }),
  });
  await esperarPestanas();
  await irAPestana("Mis eventos");
  const boton = lista.length > 0 ? "Crear evento" : "Crear tu primer evento";
  await fireEvent.press(await screen.findByRole("button", { name: boton }));
  await waitFor(() => expect(resultado.getPathname()).toBe("/eventos/nuevo"));
  return resultado;
}

/** Completa el formulario con un evento válido de un tipo. */
async function completar() {
  await escribir("Nombre del evento", "Noche de Tango");
  await fireEvent.press(await screen.findByRole("radio", { name: "Música" }));
  await elegirFechaYHora(new Date(2026, 11, 5, 21, 30));
  await escribir("Nombre del tipo 1", "General");
  await escribir("Precio del tipo 1", "15000");
  await escribir("Cupo del tipo 1", "200");
}

const botonCrear = () => screen.getByRole("button", { name: /^(Crear evento|Creando…)$/ });

const cuerpoDe = (resultado: Awaited<ReturnType<typeof abrirCrearEvento>>, i = 0) =>
  JSON.parse(resultado.falso.pedidos.filter((p) => p.metodo === "POST")[i]?.cuerpo ?? "null");

describe("Crear evento (US1): formulario y envío", () => {
  it("Mis eventos muestra Crear evento con datos y Crear tu primer evento vacío; los dos abren el formulario", async () => {
    await abrirCrearEvento();
    expect(await screen.findByLabelText("Nombre del evento")).toBeOnTheScreen();
  });

  it("vacío: Crear tu primer evento abre el formulario", async () => {
    await abrirCrearEvento({ misEventos: [] });
    expect(await screen.findByLabelText("Nombre del evento")).toBeOnTheScreen();
  });

  it("completar y guardar envía la fecha de pared y el usuario del formulario, y vuelve a Mis eventos con el evento", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirCrearEvento();
    resultado.deps.queryClient.setQueryData(["usuarios"], todos);
    await completar();

    await fireEvent.press(botonCrear());

    await waitFor(() => expect(resultado.getPathname()).toBe("/mis-eventos"));
    expect(await screen.findByText("Noche de Tango")).toBeOnTheScreen();
    expect(cuerpoDe(resultado)).toEqual({
      nombre: "Noche de Tango",
      descripcion: "",
      categoriaId: "categoria-musica",
      fechaHora: "2026-12-05T21:30",
      multimedia: [],
      tiposEntrada: [{ nombre: "General", descripcion: "", precio: 15000, cupo: 200 }],
    });
    const post = resultado.falso.pedidos.find((p) => p.metodo === "POST");
    expect(post?.url).toBe(`${URL_DE_PRUEBA}/eventos`);
    expect(post?.encabezados["X-Usuario-Id"]).toBe(lucia.id);
    expect(alertasCon(alertas, DESCARTAR)).toHaveLength(0);
    // Se invalidó la lista de usuarios (cambia su cantidad de eventos).
    expect(resultado.deps.queryClient.getQueryState(["usuarios"])?.isInvalidated).toBe(true);
  });

  it("mientras se envía, el botón dice Creando… y está deshabilitado", async () => {
    await abrirCrearEvento({ crear: ["colgar"] });
    await completar();

    await fireEvent.press(botonCrear());

    expect(await screen.findByRole("button", { name: "Creando…" })).toBeDisabled();
  });

  it("los tipos: Quitar tipo 1 está deshabilitado con uno solo y Agregar otro tipo de entrada suma una tarjeta", async () => {
    await abrirCrearEvento();
    expect(await screen.findByRole("button", { name: "Quitar tipo 1" })).toBeDisabled();

    await fireEvent.press(screen.getByRole("button", { name: "Agregar otro tipo de entrada" }));

    expect(screen.getByLabelText("Precio del tipo 2")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Quitar tipo 1" })).toBeEnabled();
    await fireEvent.press(screen.getByRole("button", { name: "Quitar tipo 2" }));
    expect(screen.queryByLabelText("Precio del tipo 2")).toBeNull();
  });

  it("las imágenes: hasta 5 URLs, y Agregar imagen se deshabilita con la nota Máximo 5 imágenes", async () => {
    const resultado = await abrirCrearEvento();
    await completar();
    for (let i = 1; i <= 5; i += 1) {
      await fireEvent.press(screen.getByRole("button", { name: "Agregar imagen" }));
      await escribir(`URL de la imagen ${i}`, `https://example.com/${i}.jpg`);
    }
    expect(screen.getByRole("button", { name: "Agregar imagen" })).toBeDisabled();
    expect(screen.getByText("Máximo 5 imágenes")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Quitar imagen 2" }));
    expect(screen.getByRole("button", { name: "Agregar imagen" })).toBeEnabled();
    await fireEvent.press(botonCrear());

    await waitFor(() =>
      expect(cuerpoDe(resultado)?.multimedia).toEqual([
        "https://example.com/1.jpg",
        "https://example.com/3.jpg",
        "https://example.com/4.jpg",
        "https://example.com/5.jpg",
      ]),
    );
  });

  it("la categoría es un grupo de opciones radio con su estado", async () => {
    await abrirCrearEvento();
    const musica = await screen.findByRole("radio", { name: "Música" });
    expect(musica).not.toBeChecked();

    await fireEvent.press(musica);

    expect(screen.getByRole("radio", { name: "Música" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Teatro" })).not.toBeChecked();
  });

  it("las categorías muestran Cargando categorías… y, ante un error, Reintentar", async () => {
    // Explorar (la pestaña de inicio, feature 005) pide las categorías primero: el primer 500 es el
    // suyo, y el formulario las vuelve a pedir al abrirse.
    const fallo = { status: 500, json: errorApi("ERROR_INTERNO", "Falló el servidor.") } as const;
    await abrirCrearEvento({ categoriasRespuestas: [fallo, fallo, { status: 200, json: categorias }] });
    expect(await screen.findByText("Falló el servidor.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("radio", { name: "Música" })).toBeOnTheScreen();
  });

  it("mientras cargan las categorías muestra Cargando categorías…", async () => {
    await abrirCrearEvento({ categoriasRespuestas: ["colgar"] });
    expect(await screen.findByText("Cargando categorías…")).toBeOnTheScreen();
  });

  it("la fecha muestra Sin elegir y Hora de Buenos Aires, sin campo de texto; al elegirla, el texto formateado", async () => {
    await abrirCrearEvento();
    expect(await screen.findByText("Sin elegir")).toBeOnTheScreen();
    expect(screen.getByText("Hora de Buenos Aires")).toBeOnTheScreen();
    // Sin campo de texto: solo los dos botones del selector.
    const fecha = screen.getByLabelText("Fecha y hora");
    expect(
      within(fecha)
        .getAllByRole("button")
        .map((b) => b.props.accessibilityLabel ?? ""),
    ).toHaveLength(2);
    expect(within(fecha).getByRole("button", { name: "Elegir fecha" })).toBeOnTheScreen();
    expect(within(fecha).getByRole("button", { name: "Elegir hora" })).toBeOnTheScreen();

    await elegirFechaYHora(new Date(2026, 11, 1, 20, 0));

    expect(screen.getByText("mar 1 dic 2026 · 20:00")).toBeOnTheScreen();
  });
});

describe("Crear evento (US1): errores y descarte", () => {
  it("un 400 muestra cada detalle debajo de su campo, también en la tarjeta 2, y lo cargado sigue", async () => {
    await abrirCrearEvento({
      crear: [
        {
          status: 400,
          json: errorApi("ENTRADA_INVALIDA", "Los datos enviados no son válidos.", [
            { campo: "body.nombre", mensaje: "Debe tener como máximo 100 caracteres." },
            { campo: "body.tiposEntrada.1.cupo", mensaje: "Debe ser un entero mayor o igual a 1." },
          ]),
        },
      ],
    });
    await completar();
    await fireEvent.press(screen.getByRole("button", { name: "Agregar otro tipo de entrada" }));
    await escribir("Cupo del tipo 2", "0");

    await fireEvent.press(botonCrear());

    expect(await screen.findByText("Debe tener como máximo 100 caracteres.")).toBeOnTheScreen();
    const tarjeta2 = screen.getByLabelText("Tipo de entrada 2");
    expect(within(tarjeta2).getByText("Debe ser un entero mayor o igual a 1.")).toBeOnTheScreen();
    expect(screen.getByLabelText("Nombre del evento")).toHaveDisplayValue("Noche de Tango");
    expect(screen.getByLabelText("Cupo del tipo 2")).toHaveDisplayValue("0");
  });

  it("409 FECHA_NO_FUTURA va debajo de Fecha y hora", async () => {
    await abrirCrearEvento({
      crear: [
        { status: 409, json: errorApi("FECHA_NO_FUTURA", "La fecha y hora del evento deben ser futuras.") },
      ],
    });
    await completar();
    await fireEvent.press(botonCrear());

    await screen.findByText("La fecha y hora del evento deben ser futuras.");
    const fecha = screen.getByLabelText("Fecha y hora");
    expect(within(fecha).getByText("La fecha y hora del evento deben ser futuras.")).toBeOnTheScreen();
  });

  it("409 NOMBRE_TIPO_ENTRADA_REPETIDO va arriba de la sección de tipos", async () => {
    await abrirCrearEvento({
      crear: [
        {
          status: 409,
          json: errorApi(
            "NOMBRE_TIPO_ENTRADA_REPETIDO",
            "Ya hay un tipo de entrada con ese nombre en el evento.",
          ),
        },
      ],
    });
    await completar();
    await fireEvent.press(botonCrear());

    const seccion = screen.getByLabelText("Tipos de entrada");
    expect(
      await within(seccion).findByText("Ya hay un tipo de entrada con ese nombre en el evento."),
    ).toBeOnTheScreen();
  });

  it("otro error va en el aviso arriba del botón", async () => {
    await abrirCrearEvento({
      crear: [{ status: 500, json: errorApi("ERROR_INTERNO", "Falló el servidor.") }],
    });
    await completar();
    await fireEvent.press(botonCrear());

    expect(await screen.findByText("Falló el servidor.")).toBeOnTheScreen();
    expect(botonCrear()).toBeEnabled();
  });

  it("sin servidor al guardar: la franja, sin un segundo POST y con los campos cargados", async () => {
    const resultado = await abrirCrearEvento({ crear: ["rechazar"] });
    await completar();
    await fireEvent.press(botonCrear());

    expect(await screen.findByText(`Servidor no disponible · ${URL_DE_PRUEBA}`)).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(5000));
    expect(resultado.falso.pedidos.filter((p) => p.metodo === "POST")).toHaveLength(1);
    expect(screen.getByLabelText("Nombre del evento")).toHaveDisplayValue("Noche de Tango");
  });

  it("atrás pregunta siempre (aunque no haya cambios): Seguir editando conserva lo cargado y Descartar sale", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirCrearEvento();

    await act(() => router.back());
    expect(alertasCon(alertas, DESCARTAR)).toHaveLength(1);

    await escribir("Nombre del evento", "Noche de Tango");
    await act(() => router.back());
    await tocarEnAlerta(alertas, DESCARTAR, "Seguir editando");
    expect(resultado.getPathname()).toBe("/eventos/nuevo");
    expect(screen.getByLabelText("Nombre del evento")).toHaveDisplayValue("Noche de Tango");

    await act(() => router.back());
    await tocarEnAlerta(alertas, DESCARTAR, "Descartar");
    await waitFor(() => expect(resultado.getPathname()).toBe("/mis-eventos"));
  });

  it("un 401 olvida al usuario y sale sin preguntar, sin enviar en nombre de otro (R12)", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirCrearEvento({
      crear: [{ status: 401, json: errorApi("USUARIO_NO_IDENTIFICADO", "No se reconoce al usuario.") }],
    });
    await completar();

    await fireEvent.press(botonCrear());

    expect(await screen.findByText("¿Con quién querés operar?")).toBeOnTheScreen();
    expect(alertasCon(alertas, DESCARTAR)).toHaveLength(0);
    const posts = resultado.falso.pedidos.filter((p) => p.metodo === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].encabezados["X-Usuario-Id"]).toBe(lucia.id);
  });
});
