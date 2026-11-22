import { EstadoCompra, type CompraDelEventoVista } from "@ai-ticket-it/shared";
import { router } from "expo-router";
import { act, fireEvent, screen, waitFor, within } from "expo-router/testing-library";

import {
  compraDelEvento,
  comprasDelFestival,
  diegoConReembolsoPendiente,
  chatVistoPorLucia,
  diegoReembolsada,
  valentinaReembolsada,
  entradaDelEvento,
  ventanaDelFestival,
} from "../helpers/compras";
import {
  errorApi,
  festival,
  festivalCompleto,
  nocheDeRisas,
  nocheDeRisasCompleta,
  nocheDeRock,
  paginaDe,
} from "../helpers/eventos";
import { porRuta, type FuncionRespuesta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { alertasCon, escribir, espiarAlertas, tituloDelHeader, tocarEnAlerta } from "../helpers/formulario";
import { esperarPestanas, irAPestana } from "../helpers/pestanas";
import { renderConDependencias } from "../helpers/render-con-dependencias";
import { diego, lucia, todos } from "../helpers/usuarios";

// "Compras del evento" (feature 008, US1; contracts/app.md, "`ComprasDelEvento`").

type Lista = (RespuestaFalsa | FuncionRespuesta)[];

const RUTA = "/eventos/evento-festival/compras";
const FILA_FESTIVAL = "Abrir Festival Sonidos del Sur, jue 10 dic 2026 · 14:00";

/**
 * Abre Mis eventos con Lucía, toca el Festival y, en su hub, "Ver compras". `extra` suma o
 * reemplaza rutas del servidor falso.
 */
async function abrirComprasDelFestival(compras: Lista, extra: Record<string, Lista> = {}) {
  const resultado = await renderConDependencias({
    usuarioRecordado: lucia.id,
    respuestas: porRuta({
      "/usuarios/actual": [{ status: 200, json: lucia }],
      "/usuarios": [{ status: 200, json: todos }],
      "/eventos/mios": [{ status: 200, json: [nocheDeRock, festival] }],
      "/categorias": [{ status: 200, json: [{ id: "categoria-musica", nombre: "Música", descripcion: "" }] }],
      [RUTA]: compras,
      "/eventos/evento-festival": [{ status: 200, json: festivalCompleto }],
      ...extra,
    }),
  });
  await esperarPestanas();
  await irAPestana("Mis eventos");
  await fireEvent.press(await screen.findByRole("button", { name: FILA_FESTIVAL }));
  await fireEvent.press(await screen.findByRole("button", { name: "Ver compras" }));
  await waitFor(() => expect(resultado.getPathname()).toBe(RUTA));
  return resultado;
}

const pedidosDeLaLista = (resultado: Awaited<ReturnType<typeof abrirComprasDelFestival>>) =>
  resultado.falso.pedidos.filter((p) => p.metodo === "GET" && p.url.endsWith(RUTA));

const martinConfirmada = compraDelEvento();
const sofiaPendiente = compraDelEvento({
  id: "compra-sofia-vip",
  comprador: { id: "usuario-sofia", nombre: "Sofía", apellido: "Castro" },
  tipoEntrada: { id: "tipo-festival-vip", nombre: "VIP" },
  cantidad: 1,
  total: 120000,
  estado: EstadoCompra.PENDIENTE,
  venceEn: "2026-11-18T18:35:00.000Z",
  venceEnLocal: "2026-11-18T15:35",
});
const diegoVencida = compraDelEvento({
  id: "compra-diego-general",
  comprador: { id: "usuario-diego", nombre: "Diego", apellido: "Fernández" },
  cantidad: 1,
  total: 45000,
  estado: EstadoCompra.CANCELADA,
  canceladaPor: "sistema",
});
const diegoCancelada = compraDelEvento({
  id: "compra-diego-backstage",
  comprador: { id: "usuario-diego", nombre: "Diego", apellido: "Fernández" },
  tipoEntrada: { id: "tipo-festival-backstage", nombre: "Backstage" },
  cantidad: 2,
  total: 0,
  estado: EstadoCompra.CANCELADA,
  canceladaPor: "usuario",
});
const martinUtilizada = compraDelEvento({
  id: "compra-martin-utilizada",
  estado: EstadoCompra.UTILIZADA,
  entradasUsadas: 1,
  creadaEnLocal: "2026-11-17T10:05",
});

describe("Compras del evento (feature 008, US1)", () => {
  it('"Ver compras" en el hub de un evento propio abre la pantalla con su título', async () => {
    await abrirComprasDelFestival([{ status: 200, json: comprasDelFestival([martinConfirmada]) }]);
    await waitFor(() => expect(tituloDelHeader()).toBe("Compras del evento"));
    expect(await screen.findByText("Martín Benítez")).toBeOnTheScreen();
  });

  it('"Ver compras" también está en el hub de un evento realizado', async () => {
    const resultado = await renderConDependencias({
      usuarioRecordado: lucia.id,
      respuestas: porRuta({
        "/usuarios/actual": [{ status: 200, json: lucia }],
        "/usuarios": [{ status: 200, json: todos }],
        "/eventos/mios": [{ status: 200, json: [nocheDeRock, nocheDeRisas] }],
        "/eventos/evento-noche-de-risas/compras": [
          {
            status: 200,
            json: comprasDelFestival([], {
              evento: {
                id: nocheDeRisas.id,
                nombre: nocheDeRisas.nombre,
                fechaHoraLocal: nocheDeRisas.fechaHoraLocal,
                realizado: true,
              },
              ventanaDeUso: ventanaDelFestival("despues"),
            }),
          },
        ],
        "/eventos/evento-noche-de-risas": [{ status: 200, json: nocheDeRisasCompleta }],
      }),
    });
    await esperarPestanas();
    await irAPestana("Mis eventos");
    await fireEvent.press(
      await screen.findByRole("button", {
        name: "Abrir Stand-up: Noche de risas, realizado, sáb 7 nov 2026 · 22:00",
      }),
    );
    await screen.findByText("Realizado");
    await fireEvent.press(screen.getByRole("button", { name: "Ver compras" }));

    await waitFor(() => expect(resultado.getPathname()).toBe("/eventos/evento-noche-de-risas/compras"));
    // El nombre también es el header del hub, que sigue montado debajo en la pila.
    expect(await screen.findByText("Los ingresos se registraron hasta el 11/12 02:00")).toBeOnTheScreen();
  });

  it("mientras carga muestra Cargando…", async () => {
    await abrirComprasDelFestival(["colgar"]);
    expect(await screen.findByText("Cargando…")).toBeOnTheScreen();
  });

  it("ante un error muestra el mensaje del servidor y Reintentar, que vuelve a pedir", async () => {
    const resultado = await abrirComprasDelFestival([
      { status: 500, json: errorApi("ERROR_INTERNO", "Falló el servidor.") },
      { status: 200, json: comprasDelFestival([martinConfirmada]) },
    ]);
    expect(await screen.findByText("Falló el servidor.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Martín Benítez")).toBeOnTheScreen();
    expect(pedidosDeLaLista(resultado)).toHaveLength(2);
  });

  it("muestra el evento, su fecha y la ventana de uso según su estado", async () => {
    await abrirComprasDelFestival([
      { status: 200, json: comprasDelFestival([], { ventanaDeUso: ventanaDelFestival("abierta") }) },
    ]);
    expect(await screen.findByRole("header", { name: "Festival Sonidos del Sur" })).toBeOnTheScreen();
    expect(screen.getByText("jue 10 dic 2026 · 14:00")).toBeOnTheScreen();
    expect(screen.getByText("Ingresos habilitados hasta el 11/12 02:00")).toBeOnTheScreen();
  });

  it("la ventana antes de abrir dice desde cuándo", async () => {
    await abrirComprasDelFestival([{ status: 200, json: comprasDelFestival([]) }]);
    expect(await screen.findByText("Podés registrar ingresos desde el 10/12 10:00")).toBeOnTheScreen();
  });

  it("una fila por compra con comprador, tipo · cantidad · total, fecha, estado y su aviso", async () => {
    await abrirComprasDelFestival([
      {
        status: 200,
        json: comprasDelFestival([
          sofiaPendiente,
          martinConfirmada,
          diegoVencida,
          diegoCancelada,
          martinUtilizada,
        ]),
      },
    ]);

    const pendiente = await screen.findByLabelText(
      "Sofía Castro, VIP, 1 entrada, $ 120.000, Pendiente, Puede pagarla hasta las 15:35",
    );
    expect(within(pendiente).getByText("Sofía Castro")).toBeOnTheScreen();
    expect(within(pendiente).getByText("VIP · 1 entrada · $ 120.000")).toBeOnTheScreen();
    expect(within(pendiente).getByText("Comprada el 18/11 15:20")).toBeOnTheScreen();
    expect(within(pendiente).getByLabelText("Estado: Pendiente")).toBeOnTheScreen();
    expect(within(pendiente).getByText("Puede pagarla hasta las 15:35")).toBeOnTheScreen();

    const confirmada = screen.getByLabelText("Martín Benítez, General, 3 entradas, $ 18.000, Confirmada");
    expect(within(confirmada).getByText("General · 3 entradas · $ 18.000")).toBeOnTheScreen();
    expect(within(confirmada).getByLabelText("Estado: Confirmada")).toBeOnTheScreen();

    const vencida = screen.getByLabelText(
      "Diego Fernández, General, 1 entrada, $ 45.000, Cancelada, Venció sin pagarse",
    );
    expect(within(vencida).getByText("Venció sin pagarse")).toBeOnTheScreen();

    const cancelada = screen.getByLabelText(
      "Diego Fernández, Backstage, 2 entradas, Gratis, Cancelada, La canceló el comprador",
    );
    expect(within(cancelada).getByText("Backstage · 2 entradas · Gratis")).toBeOnTheScreen();
    expect(within(cancelada).getByText("La canceló el comprador")).toBeOnTheScreen();

    const utilizada = screen.getByLabelText(
      "Martín Benítez, General, 3 entradas, $ 18.000, Utilizada, 1 de 3 entradas usadas",
    );
    expect(within(utilizada).getByText("Comprada el 17/11 10:05")).toBeOnTheScreen();
    expect(within(utilizada).getByText("1 de 3 entradas usadas")).toBeOnTheScreen();
  });

  it("las filas no son tocables ni tienen acciones de uso (FR-017)", async () => {
    await abrirComprasDelFestival([
      { status: 200, json: comprasDelFestival([sofiaPendiente, martinConfirmada]) },
    ]);
    await screen.findByText("Martín Benítez");

    // "Abrir el chat con …" (feature 011) va aparte del bloque de la fila: la fila en sí no es tocable.
    expect(screen.queryByRole("button", { name: /^(Martín Benítez|Sofía Castro)/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Pagar|^Confirmar|^Usar|^Cancelar/ })).toBeNull();
  });

  it("el pedido lleva el X-Usuario-Id del usuario actual", async () => {
    const resultado = await abrirComprasDelFestival([{ status: 200, json: comprasDelFestival([]) }]);
    await screen.findByRole("header", { name: "Festival Sonidos del Sur" });
    const [pedido] = pedidosDeLaLista(resultado);
    expect(pedido?.encabezados["X-Usuario-Id"]).toBe("usuario-lucia");
  });
});

describe("Compras del evento: disponibilidad por tipo (feature 008, US2)", () => {
  const resumen = [
    {
      tipoEntrada: { id: "tipo-festival-general", nombre: "General" },
      disponibles: 117,
      pendientes: 0,
      vendidas: 3,
      usadas: 1,
    },
    {
      tipoEntrada: { id: "tipo-festival-vip", nombre: "VIP" },
      disponibles: 1,
      pendientes: 1,
      vendidas: 1,
      usadas: 0,
    },
    {
      tipoEntrada: { id: "tipo-festival-backstage", nombre: "Backstage" },
      disponibles: 0,
      pendientes: 2,
      vendidas: 1,
      usadas: 0,
    },
  ];

  it('sección "Disponibilidad por tipo" con cada tipo y sus números, en el orden de la respuesta', async () => {
    await abrirComprasDelFestival([
      { status: 200, json: comprasDelFestival([martinConfirmada], { resumenPorTipo: resumen }) },
    ]);
    expect(await screen.findByRole("header", { name: "Disponibilidad por tipo" })).toBeOnTheScreen();

    const general = screen.getByLabelText("General: 117 disponibles · 0 pendientes · 3 vendidas · 1 usada");
    expect(within(general).getByText("General")).toBeOnTheScreen();
    expect(
      within(general).getByText("117 disponibles · 0 pendientes · 3 vendidas · 1 usada"),
    ).toBeOnTheScreen();
    expect(screen.getByText("1 disponible · 1 pendiente · 1 vendida · 0 usadas")).toBeOnTheScreen();

    const nombres = screen
      .getAllByLabelText(/^(General|VIP|Backstage)(, Agotado)?: /)
      .map((fila) => String(fila.props.accessibilityLabel).split(/[:,]/)[0]);
    expect(nombres).toEqual(["General", "VIP", "Backstage"]);
  });

  it('con 0 disponibles, la marca "Agotado" en texto (FR-008)', async () => {
    await abrirComprasDelFestival([
      { status: 200, json: comprasDelFestival([], { resumenPorTipo: resumen }) },
    ]);
    const backstage = await screen.findByLabelText(
      "Backstage, Agotado: 0 disponibles · 2 pendientes · 1 vendida · 0 usadas",
    );
    expect(within(backstage).getByText("Agotado")).toBeOnTheScreen();
    expect(screen.getAllByText("Agotado")).toHaveLength(1);
  });

  it("la disponibilidad va entre la ventana de uso y las compras", async () => {
    await abrirComprasDelFestival([
      { status: 200, json: comprasDelFestival([martinConfirmada], { resumenPorTipo: resumen }) },
    ]);
    const encabezados = (await screen.findAllByRole("header")).map((h) => h.props.children);
    const disponibilidad = encabezados.indexOf("Disponibilidad por tipo");
    expect(disponibilidad).toBeGreaterThan(encabezados.indexOf("Festival Sonidos del Sur"));
    expect(disponibilidad).toBeLessThan(encabezados.indexOf("Compras"));
  });
});

describe("Compras del evento: al día y ante fallas (feature 008, US4)", () => {
  const ENTRADA = "/eventos/evento-festival/entradas/7K3MQ9TB";
  const USO = `${ENTRADA}/uso`;
  const CAMPO = "Código de la entrada";
  const CONFIRMAR = "¿Registrar el ingreso?";
  const NO_EXISTE = "No existe el evento.";
  const noExiste: RespuestaFalsa = { status: 404, json: errorApi("EVENTO_NO_ENCONTRADO", NO_EXISTE) };
  const resumenGeneral = (usadas: number) => [
    {
      tipoEntrada: { id: "tipo-festival-general", nombre: "General" },
      disponibles: 117,
      pendientes: 0,
      vendidas: 3,
      usadas,
    },
  ];

  type Resultado = Awaited<ReturnType<typeof abrirComprasDelFestival>>;

  async function irARegistrarIngreso(resultado: Resultado) {
    await fireEvent.press(await screen.findByRole("button", { name: "Registrar ingreso" }));
    await waitFor(() => expect(resultado.getPathname()).toBe("/eventos/evento-festival/ingreso"));
  }

  async function buscar(texto: string) {
    await escribir(CAMPO, texto);
    await fireEvent.press(screen.getByRole("button", { name: "Buscar" }));
  }

  it("sin compras se ven la ventana y el resumen, y la lista dice el vacío (FR-022)", async () => {
    await abrirComprasDelFestival([
      { status: 200, json: comprasDelFestival([], { resumenPorTipo: resumenGeneral(0) }) },
    ]);
    expect(await screen.findByText("Todavía nadie compró entradas")).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Festival Sonidos del Sur" })).toBeOnTheScreen();
    expect(screen.getByText("Podés registrar ingresos desde el 10/12 10:00")).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Disponibilidad por tipo" })).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Compras" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Registrar ingreso" })).toBeOnTheScreen();
  });

  it("volver a la pantalla vuelve a pedir la lista; el primer foco no duplica el pedido (FR-023)", async () => {
    const resultado = await abrirComprasDelFestival([
      { status: 200, json: comprasDelFestival([martinConfirmada]) },
    ]);
    await screen.findByText("Martín Benítez");
    expect(pedidosDeLaLista(resultado)).toHaveLength(1);

    await irARegistrarIngreso(resultado);
    expect(pedidosDeLaLista(resultado)).toHaveLength(1);
    await act(() => router.back());

    await waitFor(() => expect(resultado.getPathname()).toBe(RUTA));
    await waitFor(() => expect(pedidosDeLaLista(resultado)).toHaveLength(2));
  });

  it("después de registrar un ingreso, al volver la compra está UTILIZADA y el resumen la cuenta (US3-9)", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirComprasDelFestival(
      [
        { status: 200, json: comprasDelFestival([martinConfirmada], { resumenPorTipo: resumenGeneral(0) }) },
        {
          status: 200,
          json: comprasDelFestival([compraDelEvento({ estado: EstadoCompra.UTILIZADA, entradasUsadas: 1 })], {
            resumenPorTipo: resumenGeneral(1),
          }),
        },
      ],
      {
        [USO]: [{ status: 200, json: entradaDelEvento({ estado: EstadoCompra.UTILIZADA }) }],
        [ENTRADA]: [{ status: 200, json: entradaDelEvento() }],
      },
    );
    await screen.findByText("Martín Benítez");
    await irARegistrarIngreso(resultado);
    await buscar("7K3MQ9TB");
    await fireEvent.press(await screen.findByRole("button", { name: "Registrar ingreso" }));
    await tocarEnAlerta(alertas, CONFIRMAR, "Registrar");
    await screen.findByText("Ingreso registrado: Martín Benítez · General");

    await act(() => router.back());

    const utilizada = await screen.findByLabelText(
      "Martín Benítez, General, 3 entradas, $ 18.000, Utilizada, 1 de 3 entradas usadas",
    );
    expect(within(utilizada).getByText("1 de 3 entradas usadas")).toBeOnTheScreen();
    expect(
      screen.getByLabelText("General: 117 disponibles · 0 pendientes · 3 vendidas · 1 usada"),
    ).toBeOnTheScreen();
  });

  it('un 404 del evento avisa "No existe el evento." y vuelve a Mis eventos (FR-024)', async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirComprasDelFestival([noExiste]);

    await waitFor(() => expect(resultado.getPathname()).toBe("/mis-eventos"));
    expect(alertasCon(alertas, NO_EXISTE)).toHaveLength(1);
  });

  it("en Registrar ingreso, un 404 del evento al buscar también vuelve a Mis eventos", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirComprasDelFestival([{ status: 200, json: comprasDelFestival([]) }], {
      [ENTRADA]: [noExiste],
    });
    await irARegistrarIngreso(resultado);
    await buscar("7K3MQ9TB");

    await waitFor(() => expect(resultado.getPathname()).toBe("/mis-eventos"));
    expect(alertasCon(alertas, NO_EXISTE)).toHaveLength(1);
  });

  it("en Registrar ingreso, un 404 del evento al registrar también vuelve a Mis eventos", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirComprasDelFestival([{ status: 200, json: comprasDelFestival([]) }], {
      [USO]: [noExiste],
      [ENTRADA]: [{ status: 200, json: entradaDelEvento() }],
    });
    await irARegistrarIngreso(resultado);
    await buscar("7K3MQ9TB");
    await fireEvent.press(await screen.findByRole("button", { name: "Registrar ingreso" }));
    await tocarEnAlerta(alertas, CONFIRMAR, "Registrar");

    await waitFor(() => expect(resultado.getPathname()).toBe("/mis-eventos"));
    expect(alertasCon(alertas, NO_EXISTE)).toHaveLength(1);
  });

  it("al cambiar de usuario nunca se ven las compras de Lucía y el pedido lleva el usuario nuevo (US4-4)", async () => {
    const delUsuario = (init: RequestInit | undefined) =>
      (init?.headers as Record<string, string> | undefined)?.["X-Usuario-Id"];
    const resultado = await abrirComprasDelFestival(
      [
        (_url, init) =>
          delUsuario(init) === diego.id
            ? "colgar"
            : { status: 200, json: comprasDelFestival([martinConfirmada]) },
      ],
      {
        "/usuarios/actual": [
          (_url, init) => ({ status: 200, json: delUsuario(init) === diego.id ? diego : lucia }),
        ],
      },
    );
    await screen.findByText("Martín Benítez");

    await act(() => router.navigate("/perfil"));
    await fireEvent.press(await screen.findByRole("button", { name: "Cambiar usuario" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Elegir a Diego Fernández" }));
    expect(await screen.findByText("Diego Fernández")).toBeOnTheScreen();
    await act(() =>
      router.push({ pathname: "/eventos/[eventoId]/compras", params: { eventoId: "evento-festival" } }),
    );

    expect(await screen.findByText("Cargando…")).toBeOnTheScreen();
    expect(screen.queryByText("Martín Benítez")).toBeNull();
    expect(pedidosDeLaLista(resultado).at(-1)?.encabezados["X-Usuario-Id"]).toBe(diego.id);
  });
});

describe("Compras del evento: confirmar el reembolso (feature 009, US2)", () => {
  const REEMBOLSO = "/compras/compra-diego-vip/reembolso";
  const TITULO = "¿Confirmar el reembolso a Diego Fernández?";
  const FILA_DIEGO =
    "Diego Fernández, VIP, 2 entradas, $ 240.000, Cancelada, La canceló el comprador · Reembolso pendiente de $ 240.000";
  const gratisDesdeConfirmada = compraDelEvento({
    id: "compra-martin-kids",
    tipoEntrada: { id: "tipo-festival-kids", nombre: "Kids" },
    cantidad: 1,
    total: 0,
    estado: EstadoCompra.CANCELADA,
    canceladaPor: "usuario",
    canceladaDesde: "CONFIRMADA",
    reembolso: null,
  });
  const conPendiente = {
    status: 200,
    json: comprasDelFestival([diegoConReembolsoPendiente, valentinaReembolsada]),
  };
  const releida = { status: 200, json: comprasDelFestival([diegoReembolsada, valentinaReembolsada]) };
  const postsDeReembolso = (resultado: Awaited<ReturnType<typeof abrirComprasDelFestival>>) =>
    resultado.falso.pedidos.filter((p) => p.metodo === "POST" && p.url.endsWith(REEMBOLSO));

  it("«Confirmar reembolso» solo en las filas con reembolso pendiente, fuera del bloque de la fila", async () => {
    await abrirComprasDelFestival([
      {
        status: 200,
        json: comprasDelFestival([
          diegoConReembolsoPendiente,
          valentinaReembolsada,
          diegoVencida,
          diegoCancelada,
          gratisDesdeConfirmada,
        ]),
      },
    ]);

    const fila = await screen.findByLabelText(FILA_DIEGO);
    expect(
      within(fila).getByText("La canceló el comprador · Reembolso pendiente de $ 240.000"),
    ).toBeOnTheScreen();
    expect(within(fila).queryByRole("button")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Confirmar reembolso" })).toHaveLength(1);

    const valentina = screen.getByLabelText(
      "Valentina Gómez, VIP, 1 entrada, $ 120.000, Reembolsada, Reembolso confirmado",
    );
    expect(within(valentina).getByLabelText("Estado: Reembolsada")).toBeOnTheScreen();
    expect(
      screen.getByLabelText("Martín Benítez, Kids, 1 entrada, Gratis, Cancelada, La canceló el comprador"),
    ).toBeOnTheScreen();
  });

  it("el Alert nombra al comprador y el monto; «Volver» no manda nada", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirComprasDelFestival([conPendiente]);

    await fireEvent.press(await screen.findByRole("button", { name: "Confirmar reembolso" }));

    const [llamada] = alertasCon(alertas, TITULO);
    expect(llamada?.[1]).toBe("Confirmás que le devolviste $ 240.000. No se puede deshacer.");
    expect((llamada?.[2] as { text: string }[]).map((b) => b.text)).toEqual([
      "Volver",
      "Confirmar reembolso",
    ]);
    await tocarEnAlerta(alertas, TITULO, "Volver");
    expect(postsDeReembolso(resultado)).toHaveLength(0);
  });

  it("confirmar: un POST sin cuerpo, la fila releída dice «Reembolso confirmado» sin botón, e invalida las vistas", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirComprasDelFestival([conPendiente, releida], {
      [REEMBOLSO]: [{ status: 200, json: diegoReembolsada }],
    });
    await screen.findByLabelText(FILA_DIEGO);
    const invalidar = jest.spyOn(resultado.deps.queryClient, "invalidateQueries");

    await fireEvent.press(screen.getByRole("button", { name: "Confirmar reembolso" }));
    await tocarEnAlerta(alertas, TITULO, "Confirmar reembolso");

    expect(
      await screen.findByLabelText(
        "Diego Fernández, VIP, 2 entradas, $ 240.000, Reembolsada, Reembolso confirmado",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Confirmar reembolso" })).toBeNull();
    const [post] = postsDeReembolso(resultado);
    expect(postsDeReembolso(resultado)).toHaveLength(1);
    expect(post?.cuerpo).toBeUndefined();
    expect(post?.encabezados["X-Usuario-Id"]).toBe(lucia.id);
    expect(pedidosDeLaLista(resultado).length).toBeGreaterThanOrEqual(2);

    const claves = invalidar.mock.calls.map(([filtro]) => filtro?.queryKey).filter(Boolean);
    expect(claves).toEqual(
      expect.arrayContaining([
        ["compras-del-evento", lucia.id, "evento-festival"],
        ["entrada-del-evento"],
        ["compra"],
        ["mis-compras"],
        ["mis-compras-del-evento"],
      ]),
    );
    // El cupo no cambia: ni el evento ni el catálogo (R10).
    expect(claves).not.toContainEqual(["catalogo"]);
    expect(invalidar.mock.calls.some(([filtro]) => typeof filtro?.predicate === "function")).toBe(false);
  });

  it("mientras va el pedido la fila queda en curso y otra confirmación no manda otro pedido", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirComprasDelFestival([conPendiente], { [REEMBOLSO]: ["colgar"] });

    await fireEvent.press(await screen.findByRole("button", { name: "Confirmar reembolso" }));
    await tocarEnAlerta(alertas, TITULO, "Confirmar reembolso");
    await tocarEnAlerta(alertas, TITULO, "Confirmar reembolso");

    const enCurso = await screen.findByRole("button", { name: "Confirmando…" });
    expect(enCurso).toBeBusy();
    await fireEvent.press(enCurso);
    expect(postsDeReembolso(resultado)).toHaveLength(1);
  });

  it.each([
    [409, "TRANSICION_INVALIDA", "El reembolso de esta compra ya se confirmó."],
    [403, "SIN_PERMISO", "Solo el organizador puede modificar este evento."],
  ])("un %i muestra el mensaje del servidor en esa fila", async (status, codigo, mensaje) => {
    const alertas = espiarAlertas();
    await abrirComprasDelFestival([conPendiente], {
      [REEMBOLSO]: [{ status, json: errorApi(codigo, mensaje) }],
    });
    await fireEvent.press(await screen.findByRole("button", { name: "Confirmar reembolso" }));
    await tocarEnAlerta(alertas, TITULO, "Confirmar reembolso");
    expect(await screen.findByText(mensaje)).toBeOnTheScreen();
  });

  it("reembolso aplicado con la respuesta perdida: la relectura muestra la fila real, sin botón", async () => {
    const alertas = espiarAlertas();
    let reembolsado = false;
    const resultado = await abrirComprasDelFestival([() => (reembolsado ? releida : conPendiente)], {
      [REEMBOLSO]: [
        () => {
          reembolsado = true;
          return "rechazar";
        },
      ],
    });

    await fireEvent.press(await screen.findByRole("button", { name: "Confirmar reembolso" }));
    await tocarEnAlerta(alertas, TITULO, "Confirmar reembolso");

    expect(
      await screen.findByLabelText(
        "Diego Fernández, VIP, 2 entradas, $ 240.000, Reembolsada, Reembolso confirmado",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Confirmar reembolso" })).toBeNull();
    await act(() => jest.advanceTimersByTimeAsync(70_000));
    expect(postsDeReembolso(resultado)).toHaveLength(1);
  });

  it("sin servidor: «No se pudo confirmar el reembolso. Probá de nuevo.»", async () => {
    const alertas = espiarAlertas();
    await abrirComprasDelFestival([conPendiente], { [REEMBOLSO]: ["rechazar"] });
    await fireEvent.press(await screen.findByRole("button", { name: "Confirmar reembolso" }));
    await tocarEnAlerta(alertas, TITULO, "Confirmar reembolso");
    expect(await screen.findByText("No se pudo confirmar el reembolso. Probá de nuevo.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Confirmar reembolso" })).toBeOnTheScreen();
  });
});

describe("Compras del evento después de una cancelación (feature 009, US5)", () => {
  const FILA_DIEGO =
    "Diego Fernández, VIP, 2 entradas, $ 240.000, Cancelada, La canceló el comprador · Reembolso pendiente de $ 240.000";
  // Las 2 VIP de Diego ya no cuentan como vendidas: volvieron a estar disponibles (lo dice el servidor).
  const resumen = [
    {
      tipoEntrada: { id: "tipo-festival-vip", nombre: "VIP" },
      disponibles: 3,
      pendientes: 0,
      vendidas: 0,
      usadas: 0,
    },
  ];

  it("la cancelada desde confirmada con su estado, quién la canceló y el reembolso; el resumen tal como llega", async () => {
    await abrirComprasDelFestival([
      {
        status: 200,
        json: comprasDelFestival([diegoConReembolsoPendiente], { resumenPorTipo: resumen }),
      },
    ]);

    const fila = await screen.findByLabelText(FILA_DIEGO);
    expect(within(fila).getByLabelText("Estado: Cancelada")).toBeOnTheScreen();
    expect(
      within(fila).getByText("La canceló el comprador · Reembolso pendiente de $ 240.000"),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText("VIP: 3 disponibles · 0 pendientes · 0 vendidas · 0 usadas"),
    ).toBeOnTheScreen();
  });

  it("al cambiar de usuario con la lista de Lucía cargada nunca se ven sus compras ni «Confirmar reembolso» (US5-7)", async () => {
    const delUsuario = (init: RequestInit | undefined) =>
      (init?.headers as Record<string, string> | undefined)?.["X-Usuario-Id"];
    const resultado = await abrirComprasDelFestival(
      [
        (_url, init) =>
          delUsuario(init) === diego.id
            ? "colgar"
            : { status: 200, json: comprasDelFestival([diegoConReembolsoPendiente]) },
      ],
      {
        "/usuarios/actual": [
          (_url, init) => ({ status: 200, json: delUsuario(init) === diego.id ? diego : lucia }),
        ],
      },
    );
    expect(await screen.findByRole("button", { name: "Confirmar reembolso" })).toBeOnTheScreen();

    await act(() => router.navigate("/perfil"));
    await fireEvent.press(await screen.findByRole("button", { name: "Cambiar usuario" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Elegir a Diego Fernández" }));
    expect(await screen.findByText("Diego Fernández")).toBeOnTheScreen();
    await act(() =>
      router.push({ pathname: "/eventos/[eventoId]/compras", params: { eventoId: "evento-festival" } }),
    );

    expect(await screen.findByText("Cargando…")).toBeOnTheScreen();
    expect(screen.queryByLabelText(FILA_DIEGO)).toBeNull();
    expect(screen.queryByRole("button", { name: "Confirmar reembolso" })).toBeNull();
    expect(pedidosDeLaLista(resultado).at(-1)?.encabezados["X-Usuario-Id"]).toBe(diego.id);
  });
});

describe("Compras del evento: abrir el chat (feature 011, US2)", () => {
  const filas = [
    sofiaPendiente,
    martinConfirmada,
    diegoVencida,
    diegoCancelada,
    martinUtilizada,
    diegoReembolsada,
  ];
  const comprador = (compra: (typeof filas)[number]) =>
    `${compra.comprador.nombre} ${compra.comprador.apellido}`;

  it.each([
    ["con el evento por venir", {}],
    [
      "con el evento realizado",
      {
        evento: { ...comprasDelFestival().evento, realizado: true },
        ventanaDeUso: ventanaDelFestival("despues"),
      },
    ],
  ])(
    "cada fila, en cada estado, tiene «Abrir chat» fuera de su bloque accesible (%s)",
    async (_caso, cambios) => {
      await abrirComprasDelFestival([{ status: 200, json: comprasDelFestival(filas, cambios) }]);
      await screen.findByText("Sofía Castro");

      const botones = screen.getAllByRole("button", { name: /^Abrir el chat con / });
      expect(botones.map((boton) => boton.props.accessibilityLabel)).toEqual(
        filas.map((compra) => `Abrir el chat con ${comprador(compra)}`),
      );
      for (const boton of botones) expect(within(boton).getByText("Abrir chat")).toBeOnTheScreen();
      const confirmada = screen.getByLabelText("Martín Benítez, General, 3 entradas, $ 18.000, Confirmada");
      expect(within(confirmada).queryByRole("button")).toBeNull();
    },
  );

  it("tocarlo abre «Chat de la compra» de esa compra, en nombre de Lucía", async () => {
    const chat = `/compras/${martinConfirmada.id}/mensajes`;
    const resultado = await abrirComprasDelFestival(
      [{ status: 200, json: comprasDelFestival([martinConfirmada]) }],
      { [chat]: [{ status: 200, json: chatVistoPorLucia() }] },
    );

    await fireEvent.press(await screen.findByRole("button", { name: "Abrir el chat con Martín Benítez" }));

    await waitFor(() => expect(resultado.getPathname()).toBe(`/compras/${martinConfirmada.id}/chat`));
    expect(await screen.findByText("Con Martín Benítez · Comprador")).toBeOnTheScreen();
    expect(tituloDelHeader()).toBe("Chat de la compra");
    const [pedido] = resultado.falso.pedidosA(chat);
    expect(pedido?.encabezados["X-Usuario-Id"]).toBe("usuario-lucia");
  });
});

describe("Compras del evento: filtro por estado (mejoras del organizador, grupo 3)", () => {
  const FILA_SOFIA = "Sofía Castro, VIP, 1 entrada, $ 120.000, Pendiente, Puede pagarla hasta las 15:35";
  const FILA_MARTIN = "Martín Benítez, General, 3 entradas, $ 18.000, Confirmada";
  const FILA_MARTIN_UTILIZADA =
    "Martín Benítez, General, 3 entradas, $ 18.000, Utilizada, 1 de 3 entradas usadas";
  const FILA_DIEGO_VENCIDA = "Diego Fernández, General, 1 entrada, $ 45.000, Cancelada, Venció sin pagarse";
  const FILA_DIEGO_CANCELADA =
    "Diego Fernández, Backstage, 2 entradas, Gratis, Cancelada, La canceló el comprador";
  const resumen = [
    {
      tipoEntrada: { id: "tipo-festival-general", nombre: "General" },
      disponibles: 117,
      pendientes: 0,
      vendidas: 3,
      usadas: 1,
    },
  ];
  const todasLasCompras = comprasDelFestival(
    [sofiaPendiente, martinConfirmada, diegoVencida, diegoCancelada, martinUtilizada],
    { resumenPorTipo: resumen },
  );
  const chip = (nombre: string) => screen.getByRole("radio", { name: nombre });
  /** Lo que responde el servidor con un filtro (feature 013): las filtradas y los totales de todas. */
  const filtradas = (compras: CompraDelEventoVista[]) => [
    { status: 200, json: comprasDelFestival(compras, { resumenPorTipo: resumen, cantidadCompras: 5 }) },
  ];

  it("un grupo de chips con Todas elegido, Sin responder y los cinco estados, en orden", async () => {
    await abrirComprasDelFestival([{ status: 200, json: todasLasCompras }]);
    const grupo = await screen.findByLabelText("Filtrar compras");
    expect(grupo.props.accessibilityRole).toBe("radiogroup");
    const nombres = within(grupo)
      .getAllByRole("radio")
      .map((r) => r.props.accessibilityLabel);
    expect(nombres).toEqual([
      "Todas",
      "Sin responder",
      "Pendiente",
      "Confirmada",
      "Utilizada",
      "Cancelada",
      "Reembolsada",
    ]);
    expect(chip("Todas")).toBeChecked();
    expect(chip("Cancelada")).not.toBeChecked();
    expect(screen.getByLabelText(FILA_SOFIA)).toBeOnTheScreen();
    expect(screen.getByLabelText(FILA_MARTIN_UTILIZADA)).toBeOnTheScreen();
  });

  it("elegir un estado deja solo sus compras y no toca la disponibilidad por tipo", async () => {
    const resultado = await abrirComprasDelFestival([{ status: 200, json: todasLasCompras }], {
      [`${RUTA}?estado=CANCELADA`]: filtradas([diegoVencida, diegoCancelada]),
    });
    await screen.findByLabelText(FILA_SOFIA);

    await fireEvent.press(chip("Cancelada"));

    expect(chip("Cancelada")).toBeChecked();
    expect(chip("Todas")).not.toBeChecked();
    expect(await screen.findByLabelText(FILA_DIEGO_VENCIDA)).toBeOnTheScreen();
    expect(screen.getByLabelText(FILA_DIEGO_CANCELADA)).toBeOnTheScreen();
    expect(screen.queryByLabelText(FILA_SOFIA)).toBeNull();
    expect(screen.queryByLabelText(FILA_MARTIN)).toBeNull();
    expect(screen.queryByLabelText(FILA_MARTIN_UTILIZADA)).toBeNull();
    expect(
      screen.getByLabelText("General: 117 disponibles · 0 pendientes · 3 vendidas · 1 usada"),
    ).toBeOnTheScreen();
    // Filtra el servidor (feature 013): pide la página 1 con el estado.
    expect(resultado.falso.pedidos.filter((p) => p.url.endsWith(`${RUTA}?estado=CANCELADA`))).toHaveLength(1);
  });

  it("Utilizada tiene su chip: Confirmada no muestra las utilizadas", async () => {
    await abrirComprasDelFestival([{ status: 200, json: todasLasCompras }], {
      [`${RUTA}?estado=CONFIRMADA`]: filtradas([martinConfirmada]),
      [`${RUTA}?estado=UTILIZADA`]: filtradas([martinUtilizada]),
    });
    await screen.findByLabelText(FILA_SOFIA);

    await fireEvent.press(chip("Confirmada"));
    expect(await screen.findByLabelText(FILA_MARTIN)).toBeOnTheScreen();
    expect(screen.queryByLabelText(FILA_MARTIN_UTILIZADA)).toBeNull();

    await fireEvent.press(chip("Utilizada"));
    expect(await screen.findByLabelText(FILA_MARTIN_UTILIZADA)).toBeOnTheScreen();
    expect(screen.queryByLabelText(FILA_MARTIN)).toBeNull();
  });

  it("sin compras del estado elegido, su propio vacío; Todas vuelve a mostrarlas", async () => {
    await abrirComprasDelFestival([{ status: 200, json: todasLasCompras }], {
      [`${RUTA}?estado=REEMBOLSADA`]: filtradas([]),
    });
    await screen.findByLabelText(FILA_SOFIA);

    await fireEvent.press(chip("Reembolsada"));
    expect(await screen.findByText("No hay compras reembolsadas")).toBeOnTheScreen();
    expect(screen.queryByText("Todavía nadie compró entradas")).toBeNull();
    expect(screen.getByLabelText("Filtrar compras")).toBeOnTheScreen();

    await fireEvent.press(chip("Todas"));
    expect(await screen.findByLabelText(FILA_SOFIA)).toBeOnTheScreen();
    expect(screen.queryByText("No hay compras reembolsadas")).toBeNull();
    expect(screen.getByLabelText(FILA_DIEGO_CANCELADA)).toBeOnTheScreen();
  });

  it("sin ninguna compra no hay chips: solo «Todavía nadie compró entradas»", async () => {
    await abrirComprasDelFestival([{ status: 200, json: comprasDelFestival([]) }]);
    expect(await screen.findByText("Todavía nadie compró entradas")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Filtrar compras")).toBeNull();
  });

  it("el filtro elegido se mantiene al releer la lista al volver a la pantalla", async () => {
    const resultado = await abrirComprasDelFestival([{ status: 200, json: todasLasCompras }], {
      [`${RUTA}?estado=CANCELADA`]: filtradas([diegoVencida, diegoCancelada]),
    });
    const conElFiltro = () =>
      resultado.falso.pedidos.filter((p) => p.url.endsWith(`${RUTA}?estado=CANCELADA`));
    await screen.findByLabelText(FILA_SOFIA);
    await fireEvent.press(chip("Cancelada"));
    await screen.findByLabelText(FILA_DIEGO_CANCELADA);

    await fireEvent.press(screen.getByRole("button", { name: "Registrar ingreso" }));
    await waitFor(() => expect(resultado.getPathname()).toBe("/eventos/evento-festival/ingreso"));
    await act(() => router.back());
    await waitFor(() => expect(conElFiltro()).toHaveLength(2));

    expect(chip("Cancelada")).toBeChecked();
    expect(screen.queryByLabelText(FILA_SOFIA)).toBeNull();
    expect(screen.getByLabelText(FILA_DIEGO_CANCELADA)).toBeOnTheScreen();
  });
});

describe("Compras del evento: mensajes sin responder (mejoras del organizador, grupo 4)", () => {
  const FILA_MARTIN = "Martín Benítez, General, 3 entradas, $ 18.000, Confirmada";
  const FILA_MARTIN_SIN_RESPONDER = `${FILA_MARTIN}, Mensaje sin responder`;
  const FILA_SOFIA = "Sofía Castro, VIP, 1 entrada, $ 120.000, Pendiente, Puede pagarla hasta las 15:35";
  const martinSinResponder = compraDelEvento({ mensajeSinResponder: true });
  const chip = (nombre: string) => screen.getByRole("radio", { name: nombre });

  it("la fila con el último mensaje del comprador lleva la marca, también para el lector de pantalla", async () => {
    await abrirComprasDelFestival([
      { status: 200, json: comprasDelFestival([sofiaPendiente, martinSinResponder]) },
    ]);
    expect(await screen.findByLabelText(FILA_MARTIN_SIN_RESPONDER)).toBeOnTheScreen();
    expect(screen.getAllByText("Mensaje sin responder")).toHaveLength(1);
    expect(screen.getByLabelText(FILA_SOFIA)).toBeOnTheScreen();
  });

  it("el contador arriba de la lista, en plural con varias", async () => {
    const otra = compraDelEvento({ id: "compra-martin-2", mensajeSinResponder: true });
    await abrirComprasDelFestival([{ status: 200, json: comprasDelFestival([martinSinResponder, otra]) }]);
    expect(await screen.findByText("2 compras con mensajes sin responder")).toBeOnTheScreen();
  });

  it("sin mensajes sin responder no hay contador ni marca", async () => {
    await abrirComprasDelFestival([{ status: 200, json: comprasDelFestival([martinConfirmada]) }]);
    expect(await screen.findByLabelText(FILA_MARTIN)).toBeOnTheScreen();
    expect(screen.queryByText(/sin responder$/)).toBeNull();
  });

  it("el chip Sin responder deja solo esas compras; sin ninguna, su propio vacío", async () => {
    await abrirComprasDelFestival(
      [{ status: 200, json: comprasDelFestival([sofiaPendiente, martinSinResponder]) }],
      {
        [`${RUTA}?sinResponder=true`]: [
          { status: 200, json: comprasDelFestival([martinSinResponder], { cantidadCompras: 2 }) },
        ],
      },
    );
    expect(await screen.findByText("1 compra con un mensaje sin responder")).toBeOnTheScreen();

    await fireEvent.press(chip("Sin responder"));
    expect(chip("Sin responder")).toBeChecked();
    expect(await screen.findByLabelText(FILA_MARTIN_SIN_RESPONDER)).toBeOnTheScreen();
    expect(screen.queryByLabelText(FILA_SOFIA)).toBeNull();
  });

  it("con compras pero ninguna sin responder, el chip muestra «No hay mensajes sin responder»", async () => {
    await abrirComprasDelFestival([{ status: 200, json: comprasDelFestival([sofiaPendiente]) }], {
      [`${RUTA}?sinResponder=true`]: [{ status: 200, json: comprasDelFestival([], { cantidadCompras: 1 }) }],
    });
    await screen.findByLabelText(FILA_SOFIA);
    await fireEvent.press(chip("Sin responder"));
    expect(await screen.findByText("No hay mensajes sin responder")).toBeOnTheScreen();
    expect(screen.queryByLabelText(FILA_SOFIA)).toBeNull();
  });
});

describe("Compras del evento por páginas (feature 013, US3)", () => {
  /** `cantidad` compras confirmadas de Martín, `compra-<prefijo>-NN`. */
  const varias = (cantidad: number, prefijo = "p", desde = 1) =>
    Array.from({ length: cantidad }, (_, i) => {
      const numero = String(desde + i).padStart(2, "0");
      return compraDelEvento({ id: `compra-${prefijo}-${numero}`, creadaEnLocal: `2026-11-17T10:${numero}` });
    });
  const filasVisibles = () => screen.queryAllByLabelText(/^Martín Benítez, General/);
  const resumen = [
    {
      tipoEntrada: { id: "tipo-festival-general", nombre: "General" },
      disponibles: 100,
      pendientes: 0,
      vendidas: 12,
      usadas: 0,
    },
  ];
  const RESUMEN = "General: 100 disponibles · 0 pendientes · 12 vendidas · 0 usadas";
  const CONTADOR = "1 compra con un mensaje sin responder";
  const totales = { resumenPorTipo: resumen, cantidadCompras: 12, comprasConMensajesSinResponder: 1 };
  const pagina1 = comprasDelFestival(varias(10), { ...totales, pagina: paginaDe(12) });
  const pagina2 = comprasDelFestival(varias(2, "p", 11), { ...totales, pagina: paginaDe(12, { numero: 2 }) });
  const boton = (nombre: string) => screen.getByRole("button", { name: nombre });
  const chip = (nombre: string) => screen.getByRole("radio", { name: nombre });
  const pedidosALaLista = (resultado: Awaited<ReturnType<typeof abrirComprasDelFestival>>) =>
    resultado.falso.pedidos
      .filter((p) => p.metodo === "GET" && p.url.includes(RUTA))
      .map((p) => p.url.slice(p.url.indexOf(RUTA)));

  it("con 12 compras, 10 filas y el paginador con la página 1 marcada", async () => {
    await abrirComprasDelFestival([{ status: 200, json: pagina1 }]);
    await waitFor(() => expect(filasVisibles()).toHaveLength(10));
    expect(boton("Página 1")).toBeSelected();
    expect(boton("Página 2")).not.toBeSelected();
  });

  it("mientras llega otra página, «Cargando compras…» en lugar de las filas y del paginador, sin tapar el resto (R8)", async () => {
    await abrirComprasDelFestival([{ status: 200, json: pagina1 }], { [`${RUTA}?pagina=2`]: ["colgar"] });
    await waitFor(() => expect(filasVisibles()).toHaveLength(10));

    await fireEvent.press(boton("Página 2"));

    expect(await screen.findByText("Cargando compras…")).toBeOnTheScreen();
    expect(filasVisibles()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /^Página/ })).toBeNull();
    expect(screen.getByRole("header", { name: festivalCompleto.nombre })).toBeOnTheScreen();
    expect(screen.getByLabelText(RESUMEN)).toBeOnTheScreen();
    expect(screen.getByText(CONTADOR)).toBeOnTheScreen();
    expect(screen.getByLabelText("Filtrar compras")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Registrar ingreso" })).toBeOnTheScreen();
  });

  it("«Página 2» pide ?pagina=2 y muestra sus filas con la 2 marcada", async () => {
    const resultado = await abrirComprasDelFestival([{ status: 200, json: pagina1 }], {
      [`${RUTA}?pagina=2`]: [{ status: 200, json: pagina2 }],
    });
    await waitFor(() => expect(filasVisibles()).toHaveLength(10));

    await fireEvent.press(boton("Página 2"));

    await waitFor(() => expect(filasVisibles()).toHaveLength(2));
    expect(screen.queryByText("Cargando compras…")).toBeNull();
    expect(boton("Página 2")).toBeSelected();
    expect(pedidosALaLista(resultado)).toEqual([RUTA, `${RUTA}?pagina=2`]);
  });

  it("un chip estando en la 2 pide la página 1 con su filtro; «Todas» no manda parámetros", async () => {
    const canceladas = comprasDelFestival([diegoVencida], { ...totales, pagina: paginaDe(1) });
    const sinResponder = comprasDelFestival([compraDelEvento({ mensajeSinResponder: true })], {
      ...totales,
      pagina: paginaDe(1),
    });
    const resultado = await abrirComprasDelFestival([{ status: 200, json: pagina1 }], {
      [`${RUTA}?pagina=2`]: [{ status: 200, json: pagina2 }],
      [`${RUTA}?estado=CANCELADA`]: [{ status: 200, json: canceladas }],
      [`${RUTA}?sinResponder=true`]: [{ status: 200, json: sinResponder }],
    });
    await waitFor(() => expect(filasVisibles()).toHaveLength(10));
    await fireEvent.press(boton("Página 2"));
    await waitFor(() => expect(filasVisibles()).toHaveLength(2));

    await fireEvent.press(chip("Cancelada"));
    expect(
      await screen.findByLabelText(
        "Diego Fernández, General, 1 entrada, $ 45.000, Cancelada, Venció sin pagarse",
      ),
    ).toBeOnTheScreen();
    expect(filasVisibles()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Página 1" })).toBeNull();

    await fireEvent.press(chip("Sin responder"));
    await waitFor(() => expect(filasVisibles()).toHaveLength(1));

    await fireEvent.press(chip("Todas"));
    await waitFor(() => expect(filasVisibles()).toHaveLength(10));
    expect(boton("Página 1")).toBeSelected();

    expect(pedidosALaLista(resultado).slice(0, 4)).toEqual([
      RUTA,
      `${RUTA}?pagina=2`,
      `${RUTA}?estado=CANCELADA`,
      `${RUTA}?sinResponder=true`,
    ]);
  });

  it("un filtro sin resultados muestra su vacío con los chips y sin paginador", async () => {
    const vacia = comprasDelFestival([], { ...totales, pagina: paginaDe(0) });
    await abrirComprasDelFestival([{ status: 200, json: pagina1 }], {
      [`${RUTA}?estado=REEMBOLSADA`]: [{ status: 200, json: vacia }],
    });
    await waitFor(() => expect(filasVisibles()).toHaveLength(10));

    await fireEvent.press(chip("Reembolsada"));

    expect(await screen.findByText("No hay compras reembolsadas")).toBeOnTheScreen();
    expect(screen.getByLabelText("Filtrar compras")).toBeOnTheScreen();
    expect(screen.queryByText("Todavía nadie compró entradas")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Página/ })).toBeNull();
  });

  it("con cantidadCompras 0 no hay chips y se ve «Todavía nadie compró entradas», sin paginador", async () => {
    await abrirComprasDelFestival([{ status: 200, json: comprasDelFestival([]) }]);
    expect(await screen.findByText("Todavía nadie compró entradas")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Filtrar compras")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Página/ })).toBeNull();
  });

  it("los chips dependen de cantidadCompras, no de las filas de la página", async () => {
    await abrirComprasDelFestival([
      { status: 200, json: comprasDelFestival([], { cantidadCompras: 3, pagina: paginaDe(0) }) },
    ]);
    expect(await screen.findByLabelText("Filtrar compras")).toBeOnTheScreen();
  });

  it("con 10 compras o menos no hay paginador", async () => {
    await abrirComprasDelFestival([{ status: 200, json: comprasDelFestival(varias(10)) }]);
    await waitFor(() => expect(filasVisibles()).toHaveLength(10));
    expect(screen.queryByRole("button", { name: /^Página/ })).toBeNull();
  });

  it("después de «Confirmar reembolso» en la 3 de las canceladas se vuelve a pedir esa página y filtro; si ya no existe, se marca la última", async () => {
    const alertas = espiarAlertas();
    const canceladas = (compras: CompraDelEventoVista[], numero: number, total: number) =>
      comprasDelFestival(compras, { ...totales, pagina: paginaDe(total, { numero }) });
    const resultado = await abrirComprasDelFestival([{ status: 200, json: pagina1 }], {
      [`${RUTA}?estado=CANCELADA`]: [{ status: 200, json: canceladas(varias(10), 1, 21) }],
      [`${RUTA}?pagina=3&estado=CANCELADA`]: [
        { status: 200, json: canceladas([diegoConReembolsoPendiente], 3, 21) },
        { status: 200, json: canceladas(varias(10, "p", 11), 2, 20) },
      ],
      "/compras/compra-diego-vip/reembolso": [{ status: 200, json: diegoReembolsada }],
    });
    await waitFor(() => expect(filasVisibles()).toHaveLength(10));
    await fireEvent.press(chip("Cancelada"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Página 3" })).toBeOnTheScreen());
    await fireEvent.press(boton("Página 3"));
    await fireEvent.press(await screen.findByRole("button", { name: "Confirmar reembolso" }));
    await tocarEnAlerta(alertas, "¿Confirmar el reembolso a Diego Fernández?", "Confirmar reembolso");

    await waitFor(() => expect(boton("Página 2")).toBeSelected());
    expect(screen.queryByRole("button", { name: "Página 3" })).toBeNull();
    expect(chip("Cancelada")).toBeChecked();
    expect(pedidosALaLista(resultado).slice(-2)).toEqual([
      `${RUTA}?pagina=3&estado=CANCELADA`,
      `${RUTA}?pagina=3&estado=CANCELADA`,
    ]);
  });

  it("al volver de «Registrar ingreso» se pide la página y el filtro en los que estaba (US3-4)", async () => {
    const canceladas = comprasDelFestival(varias(10), { ...totales, pagina: paginaDe(12) });
    const segunda = comprasDelFestival(varias(2, "p", 11), {
      ...totales,
      pagina: paginaDe(12, { numero: 2 }),
    });
    const resultado = await abrirComprasDelFestival([{ status: 200, json: pagina1 }], {
      [`${RUTA}?estado=CANCELADA`]: [{ status: 200, json: canceladas }],
      [`${RUTA}?pagina=2&estado=CANCELADA`]: [{ status: 200, json: segunda }],
    });
    await waitFor(() => expect(filasVisibles()).toHaveLength(10));
    await fireEvent.press(chip("Cancelada"));
    await waitFor(() => expect(boton("Página 1")).toBeSelected());
    await fireEvent.press(boton("Página 2"));
    await waitFor(() => expect(filasVisibles()).toHaveLength(2));

    await fireEvent.press(screen.getByRole("button", { name: "Registrar ingreso" }));
    await waitFor(() => expect(resultado.getPathname()).toBe("/eventos/evento-festival/ingreso"));
    await act(() => router.back());

    await waitFor(() =>
      expect(
        pedidosALaLista(resultado).filter((u) => u === `${RUTA}?pagina=2&estado=CANCELADA`),
      ).toHaveLength(2),
    );
    expect(boton("Página 2")).toBeSelected();
    expect(chip("Cancelada")).toBeChecked();
  });
});
