import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import {
  errorApi,
  festival,
  festivalCompleto,
  nocheDeRisas,
  nocheDeRisasCompleta,
  nocheDeRock,
} from "../helpers/eventos";
import { porRuta, type RespuestaFalsa } from "../helpers/fetch-falso";
import { tituloDelHeader } from "../helpers/formulario";
import { esperarPestanas, irAPestana } from "../helpers/pestanas";
import { renderConDependencias } from "../helpers/render-con-dependencias";
import { lucia, todos } from "../helpers/usuarios";

const FILA_FESTIVAL = "Abrir Festival Sonidos del Sur, jue 10 dic 2026 · 14:00";
const FILA_RISAS = "Abrir Stand-up: Noche de risas, realizado, sáb 7 nov 2026 · 22:00";

/** Mis eventos de Lucía → toca la fila; el GET del evento responde `evento`. */
async function abrirHub(fila: string, evento: RespuestaFalsa[]) {
  const resultado = await renderConDependencias({
    usuarioRecordado: lucia.id,
    respuestas: porRuta({
      "/usuarios/actual": [{ status: 200, json: lucia }],
      "/usuarios": [{ status: 200, json: todos }],
      "/eventos/mios": [{ status: 200, json: [nocheDeRock, festival, nocheDeRisas] }],
      "/categorias": [{ status: 200, json: [{ id: "categoria-musica", nombre: "Música", descripcion: "" }] }],
      "/eventos/evento-festival": evento,
      "/eventos/evento-noche-de-risas": evento,
      "/compras": ["colgar"],
    }),
  });
  await esperarPestanas();
  await irAPestana("Mis eventos");
  await fireEvent.press(await screen.findByRole("button", { name: fila }));
  return resultado;
}

describe("hub del evento propio", () => {
  it("tocar una fila abre /eventos/[eventoId] con los datos y los tres accesos", async () => {
    const resultado = await abrirHub(FILA_FESTIVAL, [{ status: 200, json: festivalCompleto }]);

    await waitFor(() => expect(resultado.getPathname()).toBe("/eventos/evento-festival"));
    expect(await screen.findByRole("header", { name: "Festival Sonidos del Sur" })).toBeOnTheScreen();
    expect(tituloDelHeader()).toBe("Evento");
    expect(screen.getByText("Música")).toBeOnTheScreen();
    expect(screen.getByText("jue 10 dic 2026 · 14:00")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Ver compras" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Registrar ingreso" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Editar evento" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Ver detalle" })).toBeNull();
    expect(screen.queryByText("Realizado")).toBeNull();
    // El hub no es el formulario.
    expect(screen.queryByLabelText("Nombre del evento")).toBeNull();
  });

  it('"Editar evento" abre la edición en /eventos/[eventoId]/editar', async () => {
    const resultado = await abrirHub(FILA_FESTIVAL, [{ status: 200, json: festivalCompleto }]);
    await fireEvent.press(await screen.findByRole("button", { name: "Editar evento" }));

    await waitFor(() => expect(resultado.getPathname()).toBe("/eventos/evento-festival/editar"));
    expect(await screen.findByLabelText("Nombre del evento")).toHaveDisplayValue("Festival Sonidos del Sur");
    await waitFor(() => expect(tituloDelHeader()).toBe("Editar evento"));
  });

  it('"Ver compras" abre las compras del evento', async () => {
    const resultado = await abrirHub(FILA_FESTIVAL, [{ status: 200, json: festivalCompleto }]);
    await fireEvent.press(await screen.findByRole("button", { name: "Ver compras" }));
    await waitFor(() => expect(resultado.getPathname()).toBe("/eventos/evento-festival/compras"));

    await waitFor(() => expect(tituloDelHeader()).toBe("Compras del evento"));
  });

  it('"Registrar ingreso" abre la pantalla de ingreso', async () => {
    const resultado = await abrirHub(FILA_FESTIVAL, [{ status: 200, json: festivalCompleto }]);
    await fireEvent.press(await screen.findByRole("button", { name: "Registrar ingreso" }));

    await waitFor(() => expect(resultado.getPathname()).toBe("/eventos/evento-festival/ingreso"));
  });

  it('un evento realizado lleva la marca y "Ver detalle" en lugar de "Editar evento"', async () => {
    const resultado = await abrirHub(FILA_RISAS, [{ status: 200, json: nocheDeRisasCompleta }]);

    expect(await screen.findByRole("header", { name: "Stand-up: Noche de risas" })).toBeOnTheScreen();
    expect(screen.getByText("Realizado")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Editar evento" })).toBeNull();
    expect(screen.getByRole("button", { name: "Ver compras" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Ver detalle" }));
    await waitFor(() => expect(resultado.getPathname()).toBe("/eventos/evento-noche-de-risas/editar"));
    await waitFor(() => expect(tituloDelHeader()).toBe("Evento realizado"));
    // Abierto desde "Ver detalle", sin el aviso de "ya no se puede modificar".
    expect(screen.queryByText("El evento ya se realizó: no se puede modificar.")).toBeNull();
  });

  it("mientras carga muestra Cargando…", async () => {
    await abrirHub(FILA_FESTIVAL, ["colgar"]);
    expect(await screen.findByText("Cargando…")).toBeOnTheScreen();
  });

  it("un error muestra el mensaje del servidor con Reintentar", async () => {
    await abrirHub(FILA_FESTIVAL, [
      { status: 404, json: errorApi("EVENTO_NO_ENCONTRADO", "No existe el evento.") },
    ]);
    expect(await screen.findByText("No existe el evento.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeOnTheScreen();
  });
});
