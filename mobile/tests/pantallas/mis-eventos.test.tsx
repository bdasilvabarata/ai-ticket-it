import type { EventoCatalogoVista } from "@ai-ticket-it/shared";
import { fireEvent, screen, waitFor, within } from "expo-router/testing-library";

import {
  errorApi,
  festival,
  festivalCompleto,
  hamletDeMartin,
  luciaOrganizadora,
  nocheDeRisas,
  nocheDeRock,
  rockEnCatalogo,
} from "../helpers/eventos";
import { porRuta, type FuncionRespuesta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { esperarPestanas, irAPestana } from "../helpers/pestanas";
import { renderConDependencias } from "../helpers/render-con-dependencias";
import { lucia, martin, todos } from "../helpers/usuarios";

type Lista = ReadonlyArray<RespuestaFalsa | FuncionRespuesta>;

const FAVORITOS = "/usuarios/actual/favoritos";
const MARCA = "marca-favorito";

async function abrirMisEventos(
  misEventos: RespuestaFalsa[] | FuncionRespuesta,
  extra: Record<string, Lista> = {},
) {
  const resultado = await renderConDependencias({
    usuarioRecordado: lucia.id,
    respuestas: porRuta({
      "/usuarios/actual": [{ status: 200, json: lucia }],
      "/usuarios": [{ status: 200, json: todos }],
      "/eventos/mios": typeof misEventos === "function" ? [misEventos] : misEventos,
      ...extra,
    }),
  });
  await esperarPestanas();
  await irAPestana("Mis eventos");
  return resultado;
}

describe("Mis eventos (US2)", () => {
  it("muestra cargando mientras espera al servidor", async () => {
    await abrirMisEventos(["colgar"]);
    expect(await screen.findByText("Cargando…")).toBeOnTheScreen();
  });

  it("ante un error muestra el mensaje del servidor y Reintentar", async () => {
    const resultado = await abrirMisEventos([
      { status: 500, json: errorApi("ERROR_INTERNO", "Falló el servidor.") },
      { status: 200, json: [nocheDeRock] },
    ]);
    expect(await screen.findByText("Falló el servidor.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Noche de Rock en el Club")).toBeOnTheScreen();
    expect(resultado.falso.pedidosA("/eventos/mios")).toHaveLength(2);
  });

  it("sin eventos muestra el mensaje vacío", async () => {
    await abrirMisEventos([{ status: 200, json: [] }]);
    expect(await screen.findByText("Todavía no organizás eventos.")).toBeOnTheScreen();
  });

  it("con datos muestra cada evento en el orden del servidor, y Realizado solo en los realizados", async () => {
    const resultado = await abrirMisEventos([{ status: 200, json: [nocheDeRock, festival, nocheDeRisas] }]);

    const filas = await screen.findAllByRole("button", { name: /^Abrir / });
    expect(filas.map((fila) => fila.props.accessibilityLabel)).toEqual([
      "Abrir Noche de Rock en el Club, mar 1 dic 2026 · 20:00",
      "Abrir Festival Sonidos del Sur, jue 10 dic 2026 · 14:00",
      "Abrir Stand-up: Noche de risas, realizado, sáb 7 nov 2026 · 22:00",
    ]);
    const [rock, fest, risas] = filas;
    expect(within(rock).getByText("Noche de Rock en el Club")).toBeOnTheScreen();
    expect(within(rock).getByText("mar 1 dic 2026 · 20:00 · Música")).toBeOnTheScreen();
    expect(within(rock).getByText("1 tipo de entrada")).toBeOnTheScreen();
    expect(within(rock).queryByText("Realizado")).toBeNull();
    expect(within(fest).getByText("3 tipos de entrada")).toBeOnTheScreen();
    expect(within(risas).getByText("Realizado")).toBeOnTheScreen();
    expect(resultado.falso.pedidosA("/eventos/mios")[0].encabezados["X-Usuario-Id"]).toBe(lucia.id);
  });

  it("al cambiar de usuario se ven los eventos del nuevo (US2-5)", async () => {
    const segunUsuario: FuncionRespuesta = (_url, init) => {
      const usuarioId = (init?.headers as Record<string, string>)["X-Usuario-Id"];
      return { status: 200, json: usuarioId === martin.id ? [hamletDeMartin] : [nocheDeRock] };
    };
    await abrirMisEventos(segunUsuario);
    expect(await screen.findByText("Noche de Rock en el Club")).toBeOnTheScreen();

    await irAPestana("Perfil");
    await fireEvent.press(await screen.findByRole("button", { name: "Cambiar usuario" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Elegir a Martín Benítez" }));
    await esperarPestanas();
    await irAPestana("Mis eventos");

    expect(await screen.findByText("Hamlet, versión contemporánea")).toBeOnTheScreen();
    expect(screen.queryByText("Noche de Rock en el Club")).toBeNull();
  });
});

describe("Mis eventos: estrellas de favoritos (feature 014, US3)", () => {
  const festivalEnCatalogo: EventoCatalogoVista = {
    ...festival,
    precioDesde: 20000,
    agotado: false,
    organizador: luciaOrganizadora,
  };
  const tresEventos: RespuestaFalsa[] = [{ status: 200, json: [nocheDeRock, festival, nocheDeRisas] }];

  it("solo un evento propio favorito tiene la estrella y ', en favoritos' (US3-3)", async () => {
    await abrirMisEventos(tresEventos, { [FAVORITOS]: [{ status: 200, json: [festivalEnCatalogo] }] });

    const conEstrella = await screen.findByRole("button", { name: /, en favoritos$/ });
    expect(conEstrella.props.accessibilityLabel).toBe(
      "Abrir Festival Sonidos del Sur, jue 10 dic 2026 · 14:00, en favoritos",
    );
    expect(within(conEstrella).getByTestId(MARCA, { includeHiddenElements: true })).toBeTruthy();
    const filas = screen.getAllByRole("button", { name: /^Abrir / });
    expect(filas.map((fila) => fila.props.accessibilityLabel)).toEqual([
      "Abrir Noche de Rock en el Club, mar 1 dic 2026 · 20:00",
      "Abrir Festival Sonidos del Sur, jue 10 dic 2026 · 14:00, en favoritos",
      "Abrir Stand-up: Noche de risas, realizado, sáb 7 nov 2026 · 22:00",
    ]);
    expect(screen.queryAllByTestId(MARCA, { includeHiddenElements: true })).toHaveLength(1);
  });

  it("con los favoritos fallando, la lista se ve igual y sin estrellas", async () => {
    await abrirMisEventos(tresEventos, {
      [FAVORITOS]: [{ status: 500, json: errorApi("ERROR_INTERNO", "Falló el servidor.") }],
    });

    expect(await screen.findAllByRole("button", { name: /^Abrir / })).toHaveLength(3);
    expect(screen.queryAllByTestId(MARCA, { includeHiddenElements: true })).toHaveLength(0);
    expect(screen.queryByText("Falló el servidor.")).toBeNull();
  });

  it("tocar la fila favorita abre el hub, que no tiene estrella para marcar", async () => {
    const resultado = await abrirMisEventos(tresEventos, {
      [FAVORITOS]: [{ status: 200, json: [festivalEnCatalogo, rockEnCatalogo] }],
      "/eventos/evento-festival": [{ status: 200, json: festivalCompleto }],
    });

    await fireEvent.press(
      await screen.findByRole("button", { name: /^Abrir Festival Sonidos del Sur, .*, en favoritos$/ }),
    );

    await waitFor(() => expect(resultado.getPathname()).toBe("/eventos/evento-festival"));
    expect(await screen.findByRole("button", { name: "Ver compras" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /favoritos/ })).toBeNull();
  });
});
