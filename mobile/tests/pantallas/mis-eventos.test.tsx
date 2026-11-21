import { fireEvent, screen, within } from "expo-router/testing-library";

import { errorApi, festival, hamletDeMartin, nocheDeRisas, nocheDeRock } from "../helpers/eventos";
import { porRuta, type FuncionRespuesta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { esperarPestanas, irAPestana } from "../helpers/pestanas";
import { renderConDependencias } from "../helpers/render-con-dependencias";
import { lucia, martin, todos } from "../helpers/usuarios";

async function abrirMisEventos(misEventos: RespuestaFalsa[] | FuncionRespuesta) {
  const resultado = await renderConDependencias({
    usuarioRecordado: lucia.id,
    respuestas: porRuta({
      "/usuarios/actual": [{ status: 200, json: lucia }],
      "/usuarios": [{ status: 200, json: todos }],
      "/eventos/mios": typeof misEventos === "function" ? [misEventos] : misEventos,
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
