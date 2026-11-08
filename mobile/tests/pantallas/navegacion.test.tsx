import { screen } from "expo-router/testing-library";

import { porRuta } from "../helpers/fetch-falso";
import { botonesDePestanas, irAPestana } from "../helpers/pestanas";
import { renderConDependencias } from "../helpers/render-con-dependencias";
import { lucia, todos } from "../helpers/usuarios";

const PENDIENTE = "Esta sección todavía no está disponible.";

function entrarConfirmado() {
  return renderConDependencias({
    usuarioRecordado: lucia.id,
    respuestas: porRuta({
      "/usuarios/actual": [{ status: 200, json: lucia }],
      "/usuarios": [{ status: 200, json: todos }],
    }),
  });
}

describe("navegación principal (US3)", () => {
  it("muestra las cuatro pestañas en orden y con texto, y abre Explorar (US3-1, FR-017)", async () => {
    const resultado = await entrarConfirmado();

    expect(await screen.findByText(PENDIENTE)).toBeOnTheScreen();
    const pestanas = botonesDePestanas();
    expect(pestanas.map((boton) => boton.props.accessibilityLabel ?? boton.props["aria-label"])).toEqual([
      "Explorar, tab, 1 of 4",
      "Mis compras, tab, 2 of 4",
      "Mis eventos, tab, 3 of 4",
      "Perfil, tab, 4 of 4",
    ]);
    expect(pestanas[0]).toHaveTextContent("Explorar");
    expect(pestanas[1]).toHaveTextContent("Mis compras");
    expect(pestanas[2]).toHaveTextContent("Mis eventos");
    expect(pestanas[3]).toHaveTextContent("Perfil");
    expect(resultado.getPathname()).toBe("/");
  });

  it.each([
    ["Mis compras", "/mis-compras"],
    ["Mis eventos", "/mis-eventos"],
    ["Explorar", "/"],
  ])("la pestaña %s muestra su nombre y que todavía no está disponible (US3-2)", async (nombre, ruta) => {
    const resultado = await entrarConfirmado();
    await screen.findByText(PENDIENTE);
    if (nombre === "Explorar") await irAPestana("Mis compras"); // para volver a Explorar desde otra

    await irAPestana(nombre);

    expect(resultado.getPathname()).toBe(ruta);
    expect(screen.getByRole("header", { name: nombre })).toBeOnTheScreen();
    expect(screen.getByText(PENDIENTE)).toBeOnTheScreen();
  });
});
