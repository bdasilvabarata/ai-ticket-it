import { EstadoCompra } from "@ai-ticket-it/shared";
import { fireEvent, screen, waitFor, within } from "expo-router/testing-library";

import { compraDelEvento, comprasDelFestival, ventanaDelFestival } from "../helpers/compras";
import {
  errorApi,
  festival,
  festivalCompleto,
  nocheDeRisas,
  nocheDeRisasCompleta,
  nocheDeRock,
} from "../helpers/eventos";
import { porRuta, type FuncionRespuesta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { tituloDelHeader } from "../helpers/formulario";
import { esperarPestanas, irAPestana } from "../helpers/pestanas";
import { renderConDependencias } from "../helpers/render-con-dependencias";
import { lucia, todos } from "../helpers/usuarios";

// "Compras del evento" (feature 008, US1; contracts/app.md, "`ComprasDelEvento`").

type Lista = (RespuestaFalsa | FuncionRespuesta)[];

const RUTA = "/eventos/evento-festival/compras";
const FILA_FESTIVAL = "Editar Festival Sonidos del Sur, jue 10 dic 2026 · 14:00";

/** Abre Mis eventos con Lucía, toca el Festival (editable) y después "Ver compras". */
async function abrirComprasDelFestival(compras: Lista) {
  const resultado = await renderConDependencias({
    usuarioRecordado: lucia.id,
    respuestas: porRuta({
      "/usuarios/actual": [{ status: 200, json: lucia }],
      "/usuarios": [{ status: 200, json: todos }],
      "/eventos/mios": [{ status: 200, json: [nocheDeRock, festival] }],
      "/categorias": [{ status: 200, json: [{ id: "categoria-musica", nombre: "Música", descripcion: "" }] }],
      [RUTA]: compras,
      "/eventos/evento-festival": [{ status: 200, json: festivalCompleto }],
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
  it('"Ver compras" en la edición de un evento propio abre la pantalla con su título', async () => {
    await abrirComprasDelFestival([{ status: 200, json: comprasDelFestival([martinConfirmada]) }]);
    await waitFor(() => expect(tituloDelHeader()).toBe("Compras del evento"));
    expect(await screen.findByText("Martín Benítez")).toBeOnTheScreen();
  });

  it('"Ver compras" también está en la solo lectura de un evento realizado', async () => {
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
        name: "Ver Stand-up: Noche de risas, realizado, sáb 7 nov 2026 · 22:00",
      }),
    );
    await screen.findByText("Realizado");
    await fireEvent.press(screen.getByRole("button", { name: "Ver compras" }));

    await waitFor(() => expect(resultado.getPathname()).toBe("/eventos/evento-noche-de-risas/compras"));
    // El nombre también es el header de la solo lectura, que sigue montada debajo en la pila.
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

    const pendiente = await screen.findByLabelText("Sofía Castro, VIP, 1 entrada, $ 120.000, Pendiente");
    expect(within(pendiente).getByText("Sofía Castro")).toBeOnTheScreen();
    expect(within(pendiente).getByText("VIP · 1 entrada · $ 120.000")).toBeOnTheScreen();
    expect(within(pendiente).getByText("Comprada el 18/11 15:20")).toBeOnTheScreen();
    expect(within(pendiente).getByLabelText("Estado: Pendiente")).toBeOnTheScreen();
    expect(within(pendiente).getByText("Puede pagarla hasta las 15:35")).toBeOnTheScreen();

    const confirmada = screen.getByLabelText("Martín Benítez, General, 3 entradas, $ 18.000, Confirmada");
    expect(within(confirmada).getByText("General · 3 entradas · $ 18.000")).toBeOnTheScreen();
    expect(within(confirmada).getByLabelText("Estado: Confirmada")).toBeOnTheScreen();

    const vencida = screen.getByLabelText("Diego Fernández, General, 1 entrada, $ 45.000, Cancelada");
    expect(within(vencida).getByText("Venció sin pagarse")).toBeOnTheScreen();

    const cancelada = screen.getByLabelText("Diego Fernández, Backstage, 2 entradas, Gratis, Cancelada");
    expect(within(cancelada).getByText("Backstage · 2 entradas · Gratis")).toBeOnTheScreen();
    expect(within(cancelada).getByText("La canceló el comprador")).toBeOnTheScreen();

    const utilizada = screen.getByLabelText("Martín Benítez, General, 3 entradas, $ 18.000, Utilizada");
    expect(within(utilizada).getByText("Comprada el 17/11 10:05")).toBeOnTheScreen();
    expect(within(utilizada).getByText("1 de 3 entradas usadas")).toBeOnTheScreen();
  });

  it("las filas no son tocables ni tienen acciones de uso (FR-017)", async () => {
    await abrirComprasDelFestival([
      { status: 200, json: comprasDelFestival([sofiaPendiente, martinConfirmada]) },
    ]);
    await screen.findByText("Martín Benítez");

    expect(screen.queryByRole("button", { name: /Martín Benítez|Sofía Castro/ })).toBeNull();
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
