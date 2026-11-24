import { EstadoCompra } from "@ai-ticket-it/shared";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { comprasDelFestival, entradaDelEvento, ventanaDelFestival } from "../helpers/compras";
import { errorApi, festival, festivalCompleto, nocheDeRock } from "../helpers/eventos";
import { porMetodo, porRuta, type FuncionRespuesta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { espiarAlertas, alertasCon, escribir, tituloDelHeader, tocarEnAlerta } from "../helpers/formulario";
import { esperarPestanas, irAPestana } from "../helpers/pestanas";
import { renderConDependencias } from "../helpers/render-con-dependencias";
import { lucia, todos } from "../helpers/usuarios";

// "Registrar ingreso" (feature 008, US3; contracts/app.md, "`RegistrarIngreso`").

type Lista = (RespuestaFalsa | FuncionRespuesta)[];

const COMPRAS = "/eventos/evento-festival/compras";
const ENTRADA = "/eventos/evento-festival/entradas/7K3MQ9TB";
const USO = `${ENTRADA}/uso`;
const CAMPO = "Código de la entrada";
const FILA_FESTIVAL = "Abrir Festival Sonidos del Sur, jue 10 dic 2026 · 14:00";
const CONFIRMAR = "¿Registrar el ingreso?";

/** Lucía: Mis eventos → Festival (hub) → "Ver compras" → "Registrar ingreso". */
async function abrirRegistrarIngreso({ entrada = [] as Lista, uso = [] as Lista } = {}) {
  const resultado = await renderConDependencias({
    usuarioRecordado: lucia.id,
    respuestas: porRuta({
      "/usuarios/actual": [{ status: 200, json: lucia }],
      "/usuarios": [{ status: 200, json: todos }],
      "/eventos/mios": [{ status: 200, json: [nocheDeRock, festival] }],
      "/categorias": [{ status: 200, json: [{ id: "categoria-musica", nombre: "Música", descripcion: "" }] }],
      [COMPRAS]: [
        { status: 200, json: comprasDelFestival([], { ventanaDeUso: ventanaDelFestival("abierta") }) },
      ],
      [USO]: uso,
      [ENTRADA]: entrada,
      "/eventos/evento-festival": [{ status: 200, json: festivalCompleto }],
    }),
  });
  await esperarPestanas();
  await irAPestana("Mis eventos");
  await fireEvent.press(await screen.findByRole("button", { name: FILA_FESTIVAL }));
  await fireEvent.press(await screen.findByRole("button", { name: "Ver compras" }));
  await fireEvent.press(await screen.findByRole("button", { name: "Registrar ingreso" }));
  await waitFor(() => expect(resultado.getPathname()).toBe("/eventos/evento-festival/ingreso"));
  return resultado;
}

type Resultado = Awaited<ReturnType<typeof abrirRegistrarIngreso>>;
const pedidos = (resultado: Resultado, metodo: string, ruta: string) =>
  resultado.falso.pedidos.filter((p) => p.metodo === metodo && p.url.endsWith(ruta));

async function buscar(texto: string) {
  await escribir(CAMPO, texto);
  await fireEvent.press(screen.getByRole("button", { name: "Buscar" }));
}

describe("Registrar ingreso (feature 008, US3)", () => {
  it('"Registrar ingreso" de Compras del evento abre la pantalla con su título', async () => {
    await abrirRegistrarIngreso();
    await waitFor(() => expect(tituloDelHeader()).toBe("Registrar ingreso"));
    expect(screen.getByLabelText(CAMPO)).toBeOnTheScreen();
  });

  it('el campo va en mayúsculas sin autocorrección y "Buscar" está deshabilitado vacío', async () => {
    await abrirRegistrarIngreso();
    const campo = await screen.findByLabelText(CAMPO);
    expect(campo.props.autoCapitalize).toBe("characters");
    expect(campo.props.autoCorrect).toBe(false);
    expect(screen.getByRole("button", { name: "Buscar" })).toBeDisabled();
    await escribir(CAMPO, "7k3m");
    expect(screen.getByRole("button", { name: "Buscar" })).toBeEnabled();
  });

  it("buscar normaliza el código; buscar otra vez el mismo vuelve a pedirlo", async () => {
    const resultado = await abrirRegistrarIngreso({ entrada: [{ status: 200, json: entradaDelEvento() }] });
    await buscar(" 7k3m-q9tb ");
    expect(await screen.findByText("7K3M-Q9TB")).toBeOnTheScreen();
    expect(pedidos(resultado, "GET", ENTRADA)).toHaveLength(1);
    expect(pedidos(resultado, "GET", ENTRADA)[0]?.encabezados["X-Usuario-Id"]).toBe(lucia.id);

    await fireEvent.press(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(pedidos(resultado, "GET", ENTRADA)).toHaveLength(2));
  });

  it("mientras busca muestra Cargando…", async () => {
    await abrirRegistrarIngreso({ entrada: ["colgar"] });
    await buscar("7K3MQ9TB");
    expect(await screen.findByText("Cargando…")).toBeOnTheScreen();
  });

  it("un 404 ENTRADA_NO_ENCONTRADA dice que no hay una entrada con ese código", async () => {
    await abrirRegistrarIngreso({
      entrada: [
        {
          status: 404,
          json: errorApi("ENTRADA_NO_ENCONTRADA", "No hay ninguna entrada con ese código en este evento."),
        },
      ],
    });
    await buscar("7K3MQ9TB");
    expect(
      await screen.findByText("No hay ninguna entrada con ese código en este evento."),
    ).toBeOnTheScreen();
  });

  it("otro error muestra su mensaje y Reintentar, que vuelve a pedir", async () => {
    const resultado = await abrirRegistrarIngreso({
      entrada: [
        { status: 500, json: errorApi("ERROR_INTERNO", "Falló el servidor.") },
        { status: 200, json: entradaDelEvento() },
      ],
    });
    await buscar("7K3MQ9TB");
    expect(await screen.findByText("Falló el servidor.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("7K3M-Q9TB")).toBeOnTheScreen();
    expect(pedidos(resultado, "GET", ENTRADA)).toHaveLength(2);
  });

  it("encontrada: la tarjeta con el código, comprador, tipo, estado y las usadas de la compra", async () => {
    await abrirRegistrarIngreso({
      entrada: [
        {
          status: 200,
          json: entradaDelEvento({ compra: { estado: EstadoCompra.UTILIZADA, entradasUsadas: 1 } }),
        },
      ],
    });
    await buscar("7K3MQ9TB");
    expect(await screen.findByText("7K3M-Q9TB")).toBeOnTheScreen();
    expect(screen.getByText("Martín Benítez")).toBeOnTheScreen();
    expect(screen.getByText("General")).toBeOnTheScreen();
    expect(screen.getByText("Confirmada")).toBeOnTheScreen();
    expect(screen.getByText("1 de 3 entradas usadas")).toBeOnTheScreen();
    expect(screen.getByLabelText(/código 7 K 3 M Q 9 T B/)).toBeOnTheScreen();
  });

  it.each([
    [
      "la ventana cerrada",
      entradaDelEvento({ ventanaDeUso: ventanaDelFestival("antes") }),
      "El ingreso se registra desde el 10/12 10:00 hasta el 11/12 02:00.",
    ],
    [
      "UTILIZADA",
      entradaDelEvento({
        estado: EstadoCompra.UTILIZADA,
        usadaEn: "2026-12-10T23:15:00.000Z",
        usadaEnLocal: "2026-12-10T20:15",
      }),
      "Esta entrada ya se utilizó el 10/12 20:15.",
    ],
    [
      "PENDIENTE",
      entradaDelEvento({ estado: EstadoCompra.PENDIENTE }),
      "La compra de esta entrada todavía no se pagó.",
    ],
    [
      "CANCELADA",
      entradaDelEvento({ estado: EstadoCompra.CANCELADA }),
      "La compra de esta entrada está cancelada.",
    ],
    [
      "REEMBOLSADA",
      entradaDelEvento({ estado: EstadoCompra.REEMBOLSADA }),
      "La compra de esta entrada fue reembolsada.",
    ],
  ])("no usable (%s): el motivo en lugar del botón", async (_caso, entrada, motivo) => {
    await abrirRegistrarIngreso({ entrada: [{ status: 200, json: entrada }] });
    await buscar("7K3MQ9TB");
    expect(await screen.findByText(motivo)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Registrar ingreso" })).toBeNull();
  });

  it('usable: "Registrar ingreso" pide confirmación; "Cancelar" no manda nada', async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirRegistrarIngreso({ entrada: [{ status: 200, json: entradaDelEvento() }] });
    await buscar("7K3MQ9TB");
    await fireEvent.press(await screen.findByRole("button", { name: "Registrar ingreso" }));
    expect(alertasCon(alertas, CONFIRMAR)[0]?.[1]).toBe("Martín Benítez · General. No se puede deshacer.");
    await tocarEnAlerta(alertas, CONFIRMAR, "Cancelar");
    expect(pedidos(resultado, "POST", USO)).toHaveLength(0);
  });

  it("registrar con éxito: un POST sin cuerpo, el aviso, el campo vacío y las consultas vuelven a pedirse", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirRegistrarIngreso({
      entrada: [{ status: 200, json: entradaDelEvento() }],
      uso: [{ status: 200, json: entradaDelEvento({ estado: EstadoCompra.UTILIZADA }) }],
    });
    const invalidar = jest.spyOn(resultado.deps.queryClient, "invalidateQueries");
    await buscar("7K3MQ9TB");
    await fireEvent.press(await screen.findByRole("button", { name: "Registrar ingreso" }));
    await tocarEnAlerta(alertas, CONFIRMAR, "Registrar");

    expect(await screen.findByText("Ingreso registrado: Martín Benítez · General")).toBeOnTheScreen();
    expect(pedidos(resultado, "POST", USO)).toHaveLength(1);
    expect(pedidos(resultado, "POST", USO)[0]?.cuerpo).toBeUndefined();
    expect(pedidos(resultado, "POST", USO)[0]?.encabezados["X-Usuario-Id"]).toBe(lucia.id);
    expect(screen.getByLabelText(CAMPO).props.value).toBe("");

    const claves = invalidar.mock.calls.map(([filtro]) => filtro?.queryKey).filter(Boolean);
    expect(claves).toEqual(
      expect.arrayContaining([
        ["compras-del-evento", lucia.id, "evento-festival"],
        ["entrada-del-evento", lucia.id, "evento-festival", "7K3MQ9TB"],
        ["compra"],
        ["mis-compras"],
        ["mis-compras-del-evento"],
      ]),
    );
    expect(invalidar.mock.calls.some(([filtro]) => typeof filtro?.predicate === "function")).toBe(false);
    expect(claves).not.toContainEqual(["catalogo"]);
    // "Compras del evento" (debajo en el Stack) se vuelve a pedir.
    await waitFor(() => expect(pedidos(resultado, "GET", COMPRAS).length).toBeGreaterThanOrEqual(2));
  });

  it("un 409 muestra su mensaje, vuelve a pedir la entrada y no se reintenta solo", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirRegistrarIngreso({
      entrada: [
        { status: 200, json: entradaDelEvento() },
        {
          status: 200,
          json: entradaDelEvento({ estado: EstadoCompra.UTILIZADA, usadaEnLocal: "2026-12-10T20:15" }),
        },
      ],
      uso: [
        porMetodo({
          POST: [{ status: 409, json: errorApi("TRANSICION_INVALIDA", "Esta entrada ya se utilizó.") }],
        }),
      ],
    });
    await buscar("7K3MQ9TB");
    await fireEvent.press(await screen.findByRole("button", { name: "Registrar ingreso" }));
    await tocarEnAlerta(alertas, CONFIRMAR, "Registrar");

    expect(await screen.findByText("Esta entrada ya se utilizó.")).toBeOnTheScreen();
    await waitFor(() => expect(pedidos(resultado, "GET", ENTRADA)).toHaveLength(2));
    expect(pedidos(resultado, "POST", USO)).toHaveLength(1);
  });
});
