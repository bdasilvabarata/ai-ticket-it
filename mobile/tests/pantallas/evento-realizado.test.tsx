import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import { router } from "expo-router";

import { nocheDeRisas, nocheDeRisasCompleta, nocheDeRock } from "../helpers/eventos";
import { porRuta } from "../helpers/fetch-falso";
import { alertasCon, espiarAlertas, tituloDelHeader } from "../helpers/formulario";
import { esperarPestanas, irAPestana } from "../helpers/pestanas";
import { renderConDependencias } from "../helpers/render-con-dependencias";
import { lucia, todos } from "../helpers/usuarios";

async function abrirRealizado() {
  const resultado = await renderConDependencias({
    usuarioRecordado: lucia.id,
    respuestas: porRuta({
      "/usuarios/actual": [{ status: 200, json: lucia }],
      "/usuarios": [{ status: 200, json: todos }],
      "/eventos/mios": [{ status: 200, json: [nocheDeRock, nocheDeRisas] }],
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
  await waitFor(() => expect(resultado.getPathname()).toBe("/eventos/evento-noche-de-risas"));
  return resultado;
}

describe("Ver evento realizado (FR-006a)", () => {
  it("muestra el evento en solo lectura, con el header Evento realizado", async () => {
    await abrirRealizado();

    expect(await screen.findByText("Realizado")).toBeOnTheScreen();
    await waitFor(() => expect(tituloDelHeader()).toBe("Evento realizado"));
    expect(screen.getByRole("header", { name: "Stand-up: Noche de risas" })).toBeOnTheScreen();
    expect(screen.getByText("Teatro")).toBeOnTheScreen();
    expect(screen.getByText("sáb 7 nov 2026 · 22:00")).toBeOnTheScreen();
    expect(screen.getByText("Cuatro comediantes, una noche.")).toBeOnTheScreen();
    expect(screen.getByText("https://example.com/risas.jpg")).toBeOnTheScreen();
    expect(screen.getByText("General")).toBeOnTheScreen();
    expect(screen.getByText("Libre.")).toBeOnTheScreen();
    expect(screen.getByText("$ 12.000 · 80 disponibles")).toBeOnTheScreen();
  });

  it("no tiene acciones de editar, agregar, quitar ni eliminar, y al salir no pregunta", async () => {
    const alertas = espiarAlertas();
    const resultado = await abrirRealizado();
    await screen.findByText("Realizado");

    for (const nombre of [
      /^Editar/,
      /^Quitar/,
      "Agregar tipo de entrada",
      "Eliminar evento",
      "Guardar cambios",
    ]) {
      expect(screen.queryByRole("button", { name: nombre })).toBeNull();
    }
    expect(screen.queryByLabelText("Nombre del evento")).toBeNull();

    await act(() => router.back());
    await waitFor(() => expect(resultado.getPathname()).toBe("/mis-eventos"));
    expect(alertasCon(alertas, "¿Descartar los cambios?")).toHaveLength(0);
  });
});
