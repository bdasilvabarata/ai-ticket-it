import type { EventoResumenVista, EventoVista } from "@ai-ticket-it/shared";
import { act, fireEvent, screen, waitFor, within } from "expo-router/testing-library";
import { router } from "expo-router";

import { errorApi, festival, festivalCompleto, maratonEnCatalogo, nocheDeRock } from "../helpers/eventos";
import { porMetodo, porRuta, type FuncionRespuesta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { alertasCon, escribir, espiarAlertas, tituloDelHeader, tocarEnAlerta } from "../helpers/formulario";
import { esperarPestanas, irAPestana } from "../helpers/pestanas";
import { renderConDependencias, URL_DE_PRUEBA } from "../helpers/render-con-dependencias";
import { diego, lucia, todos } from "../helpers/usuarios";

const DESCARTAR = "¿Descartar los cambios?";
const RUTA = "/eventos/evento-festival";
/** La pantalla de edición (la ruta del evento es su hub). */
const EDITAR = `${RUTA}/editar`;
const FILA = "Abrir Festival Sonidos del Sur, jue 10 dic 2026 · 14:00";
const realizado = errorApi("EVENTO_REALIZADO", "El evento ya se realizó: no se puede modificar.");
const noExiste = errorApi("EVENTO_NO_ENCONTRADO", "No existe el evento.");

interface Opciones {
  /** Respuestas del GET del evento; por defecto, el Festival. */
  get?: (RespuestaFalsa | FuncionRespuesta)[];
  put?: (RespuestaFalsa | FuncionRespuesta)[];
  del?: (RespuestaFalsa | FuncionRespuesta)[];
  quitar?: RespuestaFalsa[];
  misEventos?: () => EventoResumenVista[];
}

/** Abre Mis eventos con Lucía, toca la fila del Festival y, en su hub, "Editar evento". */
async function abrirEditar({
  get = [{ status: 200, json: festivalCompleto }],
  put = [{ status: 200, json: festivalCompleto }],
  del = [{ status: 204, texto: "" }],
  quitar = [{ status: 204, texto: "" }],
  misEventos = () => [nocheDeRock, festival],
}: Opciones = {}) {
  const resultado = await renderConDependencias({
    usuarioRecordado: lucia.id,
    respuestas: porRuta({
      "/usuarios/actual": [{ status: 200, json: lucia }],
      "/usuarios": [{ status: 200, json: todos }],
      "/eventos/mios": [() => ({ status: 200, json: misEventos() })],
      "/categorias": [{ status: 200, json: [{ id: "categoria-musica", nombre: "Música", descripcion: "" }] }],
      [RUTA]: [porMetodo({ GET: get, PUT: put, DELETE: del })],
      "/tipos-entrada/tipo-festival-vip": [porMetodo({ DELETE: quitar })],
    }),
  });
  await esperarPestanas();
  await irAPestana("Mis eventos");
  await fireEvent.press(await screen.findByRole("button", { name: FILA }));
  await fireEvent.press(await screen.findByRole("button", { name: "Editar evento" }));
  await waitFor(() => expect(resultado.getPathname()).toBe(EDITAR));
  await screen.findByLabelText("Nombre del evento");
  return resultado;
}

const pedidos = (resultado: Awaited<ReturnType<typeof abrirEditar>>, metodo: string) =>
  resultado.falso.pedidos.filter((p) => p.metodo === metodo);

describe("Editar evento (US3)", () => {
  it('"Editar evento" en el hub lleva a /eventos/[eventoId]/editar con el header Editar evento y los datos precargados', async () => {
    await abrirEditar();

    await waitFor(() => expect(tituloDelHeader()).toBe("Editar evento"));
    expect(screen.getByLabelText("Nombre del evento")).toHaveDisplayValue("Festival Sonidos del Sur");
    expect(screen.getByLabelText("Descripción del evento")).toHaveDisplayValue("Un día entero de música.");
    expect(screen.getByText("jue 10 dic 2026 · 14:00")).toBeOnTheScreen();
    expect(screen.getByLabelText("URL de la imagen 1")).toHaveDisplayValue(
      "https://example.com/festival.jpg",
    );
    expect(await screen.findByRole("radio", { name: "Música" })).toBeChecked();
    expect(screen.getByRole("header", { name: "Datos del evento" })).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Tipos de entrada" })).toBeOnTheScreen();
  });

  it("la lista de tipos muestra precio y cupo, con Editar y Quitar por tipo y Agregar tipo de entrada", async () => {
    await abrirEditar();

    expect(await screen.findByText("$ 45.000 · 500 disponibles")).toBeOnTheScreen();
    expect(screen.getByText("$ 120.000 · Agotado")).toBeOnTheScreen();
    expect(screen.getByText("Gratis · 3 disponibles")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Editar VIP" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Quitar Backstage" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Agregar tipo de entrada" })).toBeOnTheScreen();
  });

  it("Guardar cambios envía el PUT, muestra Guardando… y vuelve a Mis eventos sin preguntar, con el cambio", async () => {
    const alertas = espiarAlertas();
    let lista = [nocheDeRock, festival];
    const resultado = await abrirEditar({
      put: [
        (() => {
          lista = [nocheDeRock, { ...festival, nombre: "Festival del Sur" }];
          return { status: 200, json: { ...festivalCompleto, nombre: "Festival del Sur" } };
        }) satisfies FuncionRespuesta,
      ],
      misEventos: () => lista,
    });
    await escribir("Nombre del evento", "Festival del Sur");

    await fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(resultado.getPathname()).toBe("/mis-eventos"));
    expect(await screen.findByText("Festival del Sur")).toBeOnTheScreen();
    const [put] = pedidos(resultado, "PUT");
    expect(put.url).toBe(`${URL_DE_PRUEBA}${RUTA}`);
    expect(put.encabezados["X-Usuario-Id"]).toBe(lucia.id);
    expect(JSON.parse(put.cuerpo ?? "null")).toEqual({
      nombre: "Festival del Sur",
      descripcion: "Un día entero de música.",
      categoriaId: "categoria-musica",
      fechaHora: "2026-12-10T14:00",
      multimedia: ["https://example.com/festival.jpg"],
    });
    expect(alertasCon(alertas, DESCARTAR)).toHaveLength(0);
  });

  it("mientras guarda, el botón dice Guardando… y está deshabilitado", async () => {
    await abrirEditar({ put: ["colgar"] });
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("button", { name: "Guardando…" })).toBeDisabled();
  });

  it("un 400 y FECHA_NO_FUTURA van junto a su campo", async () => {
    await abrirEditar({
      put: [
        {
          status: 400,
          json: errorApi("ENTRADA_INVALIDA", "Los datos enviados no son válidos.", [
            { campo: "body.nombre", mensaje: "Es obligatorio." },
          ]),
        },
        { status: 409, json: errorApi("FECHA_NO_FUTURA", "La fecha y hora del evento deben ser futuras.") },
      ],
    });
    await escribir("Nombre del evento", "");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Es obligatorio.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }));
    const fecha = screen.getByLabelText("Fecha y hora");
    expect(await within(fecha).findByText("La fecha y hora del evento deben ser futuras.")).toBeOnTheScreen();
  });

  it("Quitar pide confirmación; Cancelar no envía nada y Quitar envía el DELETE", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirEditar();
    await fireEvent.press(await screen.findByRole("button", { name: "Quitar VIP" }));

    await tocarEnAlerta(alertas, "¿Quitar VIP?", "Cancelar");
    expect(pedidos(resultado, "DELETE")).toHaveLength(0);

    await fireEvent.press(screen.getByRole("button", { name: "Quitar VIP" }));
    await tocarEnAlerta(alertas, "¿Quitar VIP?", "Quitar");
    await waitFor(() => expect(pedidos(resultado, "DELETE")).toHaveLength(1));
    expect(pedidos(resultado, "DELETE")[0].url).toBe(
      `${URL_DE_PRUEBA}${RUTA}/tipos-entrada/tipo-festival-vip`,
    );
  });

  it.each([
    ["ULTIMO_TIPO_ENTRADA", 409, "El evento debe conservar al menos un tipo de entrada."],
    ["TIPO_ENTRADA_CON_COMPRAS", 409, "El tipo de entrada tiene compras: no se puede quitar."],
    ["SIN_PERMISO", 403, "Solo el organizador puede modificar este evento."],
  ])("al quitar, %s muestra el aviso del servidor y nada cambia", async (codigo, status, mensaje) => {
    const alertas = espiarAlertas();
    await abrirEditar({ quitar: [{ status, json: errorApi(codigo, mensaje) }] });
    await fireEvent.press(await screen.findByRole("button", { name: "Quitar VIP" }));
    await tocarEnAlerta(alertas, "¿Quitar VIP?", "Quitar");

    expect(await screen.findByText(mensaje)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Quitar VIP" })).toBeOnTheScreen();
  });

  it("EVENTO_REALIZADO al guardar: la misma ruta pasa a solo lectura con el aviso", async () => {
    const resultado = await abrirEditar({
      get: [
        { status: 200, json: festivalCompleto },
        { status: 200, json: { ...festivalCompleto, realizado: true } satisfies EventoVista },
      ],
      put: [{ status: 409, json: realizado }],
    });
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("El evento ya se realizó: no se puede modificar.")).toBeOnTheScreen();
    await waitFor(() => expect(tituloDelHeader()).toBe("Evento realizado"));
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).toBeNull();
    expect(resultado.getPathname()).toBe(EDITAR);
  });

  it("un 404 avisa El evento ya no existe. y vuelve a Mis eventos sin preguntar", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirEditar({ put: [{ status: 404, json: noExiste }] });
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(resultado.getPathname()).toBe("/mis-eventos"));
    expect(alertasCon(alertas, "El evento ya no existe.")).toHaveLength(1);
    expect(alertasCon(alertas, DESCARTAR)).toHaveLength(0);
  });

  it("sin servidor al guardar: la franja, sin un segundo PUT y con los campos cargados", async () => {
    const resultado = await abrirEditar({ put: ["rechazar"] });
    await escribir("Nombre del evento", "Festival del Sur");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText(`Servidor no disponible · ${URL_DE_PRUEBA}`)).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(5000));
    expect(pedidos(resultado, "PUT")).toHaveLength(1);
    expect(screen.getByLabelText("Nombre del evento")).toHaveDisplayValue("Festival del Sur");
  });

  it("atrás sin cambios sale sin preguntar", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirEditar();
    await screen.findByLabelText("Nombre del evento");

    await act(() => router.back());
    await waitFor(() => expect(resultado.getPathname()).toBe(RUTA));
    expect(alertasCon(alertas, DESCARTAR)).toHaveLength(0);
  });

  it("atrás con cambios pregunta ¿Descartar los cambios?; volver a lo original no cuenta como cambio", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirEditar();
    await escribir("Nombre del evento", "Festival del Sur");

    await act(() => router.back());
    await tocarEnAlerta(alertas, DESCARTAR, "Seguir editando");
    await escribir("Nombre del evento", "Festival Sonidos del Sur");
    await act(() => router.back());
    await waitFor(() => expect(resultado.getPathname()).toBe(RUTA));
    expect(alertasCon(alertas, DESCARTAR)).toHaveLength(1);
  });

  it("atrás con cambios y Descartar sale", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirEditar();
    await escribir("Nombre del evento", "Festival del Sur");

    await act(() => router.back());
    expect(alertasCon(alertas, DESCARTAR)).toHaveLength(1);
    await tocarEnAlerta(alertas, DESCARTAR, "Descartar");
    await waitFor(() => expect(resultado.getPathname()).toBe(RUTA));
  });
});

describe("Eliminar evento (US4)", () => {
  it("Eliminar evento pide confirmación; Cancelar no envía nada", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirEditar();
    await fireEvent.press(await screen.findByRole("button", { name: "Eliminar evento" }));

    const [titulo, mensaje] = alertasCon(alertas, '¿Eliminar "Festival Sonidos del Sur"?')[0];
    expect([titulo, mensaje]).toEqual([
      '¿Eliminar "Festival Sonidos del Sur"?',
      "Esta acción no se puede deshacer.",
    ]);
    await tocarEnAlerta(alertas, '¿Eliminar "Festival Sonidos del Sur"?', "Cancelar");
    expect(pedidos(resultado, "DELETE")).toHaveLength(0);
  });

  it("Eliminar envía el DELETE y vuelve a Mis eventos sin preguntar, sin el evento", async () => {
    const alertas = espiarAlertas();
    let lista = [nocheDeRock, festival];
    const resultado = await abrirEditar({
      del: [
        (() => {
          lista = [nocheDeRock];
          return { status: 204, texto: "" };
        }) satisfies FuncionRespuesta,
      ],
      misEventos: () => lista,
    });
    await fireEvent.press(await screen.findByRole("button", { name: "Eliminar evento" }));
    await tocarEnAlerta(alertas, '¿Eliminar "Festival Sonidos del Sur"?', "Eliminar");

    await waitFor(() => expect(resultado.getPathname()).toBe("/mis-eventos"));
    expect(await screen.findByText("Noche de Rock en el Club")).toBeOnTheScreen();
    expect(screen.queryByText("Festival Sonidos del Sur")).toBeNull();
    expect(pedidos(resultado, "DELETE")[0].encabezados["X-Usuario-Id"]).toBe(lucia.id);
    expect(alertasCon(alertas, DESCARTAR)).toHaveLength(0);
  });

  it("eliminar invalida los favoritos de todos los usuarios de la caché (feature 014, FR-010)", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirEditar();
    const { queryClient } = resultado.deps;
    // Los favoritos de dos usuarios ya leídos: el evento eliminado sale de los de todos. Los de
    // Lucía los observan sus listas (las estrellas): se vuelven a pedir; los de Diego quedan
    // invalidados para cuando se lean.
    queryClient.setQueryData(["favoritos", diego.id], [maratonEnCatalogo]);
    const favoritosDeLucia = () =>
      resultado.falso
        .pedidosA("/usuarios/actual/favoritos")
        .filter((pedido) => pedido.metodo === "GET" && pedido.encabezados["X-Usuario-Id"] === lucia.id)
        .length;
    await fireEvent.press(await screen.findByRole("button", { name: "Eliminar evento" }));
    const antes = favoritosDeLucia();
    await tocarEnAlerta(alertas, '¿Eliminar "Festival Sonidos del Sur"?', "Eliminar");

    await waitFor(() => expect(resultado.getPathname()).toBe("/mis-eventos"));
    await waitFor(() => expect(favoritosDeLucia()).toBeGreaterThan(antes));
    expect(queryClient.getQueryState(["favoritos", diego.id])?.isInvalidated).toBe(true);
  });

  it("EVENTO_CON_COMPRAS muestra el aviso del servidor", async () => {
    const alertas = espiarAlertas();
    await abrirEditar({
      del: [
        {
          status: 409,
          json: errorApi("EVENTO_CON_COMPRAS", "El evento tiene compras: no se puede eliminar."),
        },
      ],
    });
    await fireEvent.press(await screen.findByRole("button", { name: "Eliminar evento" }));
    await tocarEnAlerta(alertas, '¿Eliminar "Festival Sonidos del Sur"?', "Eliminar");

    expect(await screen.findByText("El evento tiene compras: no se puede eliminar.")).toBeOnTheScreen();
  });

  it("mientras elimina, el botón queda deshabilitado", async () => {
    const alertas = espiarAlertas();
    await abrirEditar({ del: ["colgar"] });
    await fireEvent.press(await screen.findByRole("button", { name: "Eliminar evento" }));
    await tocarEnAlerta(alertas, '¿Eliminar "Festival Sonidos del Sur"?', "Eliminar");

    expect(await screen.findByRole("button", { name: "Eliminando…" })).toBeDisabled();
  });
});
